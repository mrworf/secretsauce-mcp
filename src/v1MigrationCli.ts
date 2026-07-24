import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { createInterface } from "node:readline/promises";
import { loadConfig } from "./config.js";
import { PersistenceWorker } from "./persistence/worker.js";
import { RestoreRecoveryManager } from "./restoreRecovery.js";
import type { GatewayConfig } from "./types.js";
import {
  V1MigrationCommitError,
  V1MigrationCommitRepository,
  type V1MigrationCommitResult,
} from "./v1MigrationCommit.js";
import {
  createV1MigrationPlan,
  type V1MigrationIdMap,
  type V1MigrationPlan,
  type V1MigrationReport,
} from "./v1MigrationPlan.js";
import {
  resolveV1MigrationCredentials,
  V1MigrationAllowlistError,
  V1MigrationResolutionContext,
  type V1MigrationResolvedPlan,
} from "./v1MigrationSecrets.js";
import {
  V1MigrationResolvedCommitCoordinator,
  V1MigrationResolvedCommitError,
} from "./v1MigrationResolvedCommit.js";
import {
  readV1MigrationSource,
  V1MigrationSourceError,
} from "./v1MigrationSource.js";
import {
  createBackupVaultAccess,
  createControlVaultReadiness,
} from "./vault/readiness.js";
import { PACKAGE_VERSION } from "./version.js";

export interface V1MigrationCliIo {
  readonly inputTerminal: boolean;
  readonly outputTerminal: boolean;
  question(prompt: string): Promise<string>;
  stdout(value: string): void;
  stderr(value: string): void;
}

export interface V1MigrationCliDependencies {
  loadConfiguration?: (path: string) => GatewayConfig;
  executeDefinitions?: (input: {
    config: GatewayConfig;
    plan: V1MigrationPlan;
    correlationId: string;
    osActor: string;
  }) => Promise<V1MigrationCommitResult>;
  executeResolved?: (input: {
    environment: NodeJS.ProcessEnv;
    config: GatewayConfig;
    resolved: V1MigrationResolvedPlan;
    correlationId: string;
    osActor: string;
  }) => Promise<V1MigrationCommitResult>;
  uuid?: () => string;
  correlationUuid?: () => string;
  osActor?: () => string;
}

class V1MigrationCliError extends Error {
  constructor(readonly code: string) {
    super("V1 migration command failed.");
    this.name = "V1MigrationCliError";
  }
}

export async function runV1MigrationCli(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  io: V1MigrationCliIo,
  dependencies: V1MigrationCliDependencies = {},
): Promise<number> {
  let resolutionContext: V1MigrationResolutionContext | undefined;
  let initialResolved: V1MigrationResolvedPlan | undefined;
  let commitResolved: V1MigrationResolvedPlan | undefined;
  try {
    const command = parseArguments(args);
    if (command.mode === "commit" && (!io.inputTerminal || !io.outputTerminal)) {
      throw new V1MigrationCliError("terminal_required");
    }
    const configPath = requiredEnvironment(environment, "CONFIG_PATH", "config_required");
    const sourcePath = requiredEnvironment(
      environment,
      "SECRETSAUCE_V1_CONFIG",
      "source_required",
    );
    const config = (dependencies.loadConfiguration ?? loadConfig)(configPath);
    validateTarget(config);
    const source = readV1MigrationSource(sourcePath);
    const plan = createV1MigrationPlan(source, {
      ...(dependencies.uuid === undefined ? {} : { uuid: dependencies.uuid }),
    });

    let report: V1MigrationReport;
    let expectedDigest: string;
    if (command.resolveCredentials) {
      const allowlistFile = requiredEnvironment(
        environment,
        "SECRETSAUCE_MIGRATION_ALLOWLIST_FILE",
        "allowlist_required",
      );
      resolutionContext = new V1MigrationResolutionContext();
      initialResolved = resolveV1MigrationCredentials(plan, {
        allowlistFile,
        environment,
        context: resolutionContext,
      });
      report = initialResolved.report;
      expectedDigest = initialResolved.digest;
    } else {
      report = plan.report;
      expectedDigest = plan.digest;
    }

    if (command.mode === "dry-run") {
      io.stdout(`${JSON.stringify(cliReport(report, "dry_run"))}\n`);
      return 0;
    }

    const confirmationPhrase = `MIGRATE V1 ${source.sha256.slice(0, 12)}`;
    io.stdout(`${JSON.stringify({
      ...cliReport(report, "confirmation_required"),
      confirmationPhrase,
    })}\n`);
    initialResolved?.dispose();
    initialResolved = undefined;
    const confirmation = await io.question(
      `Commit this one-time migration? Type ${confirmationPhrase} to continue: `,
    );
    if (confirmation !== confirmationPhrase) {
      throw new V1MigrationCliError("confirmation_cancelled");
    }

    const rebuilt = rebuildPlan(
      sourcePath,
      plan.idMap,
      source.sha256,
      plan.digest,
    );
    let result: V1MigrationCommitResult;
    const correlationId = `req_${(dependencies.correlationUuid ?? randomUUID)()}`;
    const osActor = boundedOsActor((dependencies.osActor ?? safeOsActor)());
    if (command.resolveCredentials) {
      commitResolved = resolveV1MigrationCredentials(rebuilt, {
        allowlistFile: environment.SECRETSAUCE_MIGRATION_ALLOWLIST_FILE!,
        environment,
        context: resolutionContext!,
      });
      if (commitResolved.digest !== expectedDigest) {
        throw new V1MigrationCliError("migration_plan_changed");
      }
      result = await (dependencies.executeResolved ?? executeResolved)({
        environment,
        config,
        resolved: commitResolved,
        correlationId,
        osActor,
      });
    } else {
      if (rebuilt.digest !== expectedDigest) {
        throw new V1MigrationCliError("migration_plan_changed");
      }
      result = await (dependencies.executeDefinitions ?? executeDefinitions)({
        config,
        plan: rebuilt,
        correlationId,
        osActor,
      });
    }
    io.stdout(`${JSON.stringify({
      outcome: "committed",
      migrationId: result.migrationId,
      activationGeneration: result.activationGeneration,
      serviceCount: result.serviceCount,
      remediationCount: result.remediationCount,
    })}\n`);
    return 0;
  } catch (error) {
    return fail(io, cliErrorCode(error), error instanceof V1MigrationCliError
      && ["invalid_arguments", "terminal_required", "config_required", "source_required", "allowlist_required"].includes(error.code)
      ? 2
      : 1);
  } finally {
    initialResolved?.dispose();
    commitResolved?.dispose();
    resolutionContext?.dispose();
  }
}

function parseArguments(args: readonly string[]): {
  mode: "dry-run" | "commit";
  resolveCredentials: boolean;
} {
  if (
    args.length < 1
    || args.length > 2
    || (args[0] !== "dry-run" && args[0] !== "commit")
    || (args.length === 2 && args[1] !== "--resolve-credentials")
  ) throw new V1MigrationCliError("invalid_arguments");
  return {
    mode: args[0],
    resolveCredentials: args[1] === "--resolve-credentials",
  };
}

function requiredEnvironment(
  environment: NodeJS.ProcessEnv,
  name: string,
  code: string,
): string {
  const value = environment[name];
  if (value === undefined || value.length === 0) {
    throw new V1MigrationCliError(code);
  }
  return value;
}

function validateTarget(config: GatewayConfig): void {
  if (
    config.runtime?.authority !== "database"
    || config.persistence === undefined
  ) throw new V1MigrationCliError("database_runtime_required");
  if (config.identity === undefined) {
    throw new V1MigrationCliError("identity_required");
  }
  if (Object.keys(config.services).length !== 0) {
    throw new V1MigrationCliError("database_runtime_required");
  }
}

function rebuildPlan(
  sourcePath: string,
  idMap: V1MigrationIdMap,
  expectedSourceSha256: string,
  expectedBaseDigest: string,
): V1MigrationPlan {
  try {
    const source = readV1MigrationSource(sourcePath);
    if (source.sha256 !== expectedSourceSha256) {
      throw new V1MigrationCliError("migration_plan_changed");
    }
    const plan = createV1MigrationPlan(source, { idMap });
    if (plan.digest !== expectedBaseDigest) {
      throw new V1MigrationCliError("migration_plan_changed");
    }
    return plan;
  } catch (error) {
    if (error instanceof V1MigrationCliError) throw error;
    throw new V1MigrationCliError("migration_plan_changed");
  }
}

function cliReport(
  report: V1MigrationReport,
  outcome: "dry_run" | "confirmation_required",
): Record<string, unknown> {
  return {
    formatVersion: report.formatVersion,
    sourceSchemaVersion: report.sourceSchemaVersion,
    sourceSha256: report.sourceSha256,
    planDigest: report.planDigest,
    resolutionMode: report.resolutionMode,
    counts: report.counts,
    services: report.services,
    warningCounts: report.warningCounts,
    outcome,
  };
}

async function executeDefinitions(input: {
  config: GatewayConfig;
  plan: V1MigrationPlan;
  correlationId: string;
  osActor: string;
}): Promise<V1MigrationCommitResult> {
  const persistence = PersistenceWorker.open({
    databaseFile: input.config.persistence!.databaseFile,
    productVersion: PACKAGE_VERSION,
  });
  try {
    return await new V1MigrationCommitRepository(persistence)
      .commitDefinitions(input);
  } finally {
    await persistence.close();
  }
}

async function executeResolved(input: {
  environment: NodeJS.ProcessEnv;
  config: GatewayConfig;
  resolved: V1MigrationResolvedPlan;
  correlationId: string;
  osActor: string;
}): Promise<V1MigrationCommitResult> {
  const control = createControlVaultReadiness(input.environment);
  const backup = createBackupVaultAccess(input.environment);
  const recoveryDirectory = input.environment.SECRETSAUCE_RESTORE_DIRECTORY;
  const recoveryKeyFile =
    input.environment.SECRETSAUCE_RESTORE_RECOVERY_KEY_FILE;
  if (
    control?.controlClient === undefined
    || backup === undefined
    || recoveryDirectory === undefined
    || recoveryKeyFile === undefined
  ) {
    control?.close();
    backup?.close();
    throw new V1MigrationCliError("vault_recovery_required");
  }
  const databaseFile = input.config.persistence!.databaseFile;
  const recovery = new RestoreRecoveryManager(
    recoveryDirectory,
    recoveryKeyFile,
    backup.client,
    backup.issuer,
  );
  let persistence: PersistenceWorker | undefined;
  try {
    await recovery.resume({ databaseFile });
    persistence = PersistenceWorker.open({
      databaseFile,
      productVersion: PACKAGE_VERSION,
    });
    const coordinator = new V1MigrationResolvedCommitCoordinator(
      databaseFile,
      new V1MigrationCommitRepository(persistence),
      recovery,
      control.controlClient,
      async () => {
        const readiness = persistence!.readiness;
        return readiness.database === "ready"
          && readiness.schema === "ready"
          && readiness.administrativeAudit === "ready";
      },
    );
    return await coordinator.commit(input);
  } finally {
    if (persistence !== undefined) await persistence.close();
    recovery.close();
    control.close();
    backup.close();
  }
}

function cliErrorCode(error: unknown): string {
  if (error instanceof V1MigrationCliError) return error.code;
  if (error instanceof V1MigrationCommitError) return error.code;
  if (error instanceof V1MigrationResolvedCommitError) return error.code;
  if (error instanceof V1MigrationAllowlistError) return error.code;
  if (error instanceof V1MigrationSourceError) return error.reason;
  return "migration_failed";
}

function boundedOsActor(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  return [...normalized].slice(0, 128).join("") || "local-operator";
}

function safeOsActor(): string {
  try {
    return userInfo().username;
  } catch {
    return "local-operator";
  }
}

function fail(io: V1MigrationCliIo, code: string, exitCode: number): number {
  io.stderr(`${JSON.stringify({ error: { code } })}\n`);
  return exitCode;
}

async function main(): Promise<void> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  try {
    process.exitCode = await runV1MigrationCli(
      process.argv.slice(2),
      process.env,
      {
        inputTerminal: process.stdin.isTTY === true,
        outputTerminal: process.stdout.isTTY === true,
        question: (prompt) => readline.question(prompt),
        stdout: (value) => process.stdout.write(value),
        stderr: (value) => process.stderr.write(value),
      },
    );
  } finally {
    readline.close();
  }
}

if (process.argv[1]?.endsWith("/v1MigrationCli.js")) {
  void main();
}
