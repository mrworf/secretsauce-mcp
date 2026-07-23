import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { createInterface } from "node:readline/promises";
import { sanitizeAuditText } from "../auditSanitizer.js";
import { loadConfig } from "../config.js";
import { PersistenceWorker, type PersistenceOwner } from "../persistence/worker.js";
import type { GatewayConfig } from "../types.js";
import { PACKAGE_VERSION } from "../version.js";
import {
  CredentialLifecycleError,
  LocalCredentialLifecycleRepository,
  LocalCredentialLifecycleService,
} from "./credentialLifecycle.js";

export interface BreakGlassIo {
  readonly inputTerminal: boolean;
  readonly outputTerminal: boolean;
  question(prompt: string): Promise<string>;
  stdout(value: string): void;
  stderr(value: string): void;
}

export interface BreakGlassDependencies {
  loadConfiguration?: (path: string) => GatewayConfig;
  openPersistence?: (databaseFile: string, config: GatewayConfig) => PersistenceOwner;
  correlationUuid?: () => string;
  identityUuid?: () => string;
  now?: () => number;
  random?: (size: number) => Buffer;
  osActor?: () => string;
}

export async function runBreakGlassCli(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  io: BreakGlassIo,
  dependencies: BreakGlassDependencies = {},
): Promise<number> {
  let persistence: PersistenceOwner | undefined;
  try {
    if (args.length !== 0) return fail(io, "invalid_arguments", 2);
    if (!io.inputTerminal || !io.outputTerminal) {
      return fail(io, "terminal_required", 2);
    }
    const configPath = env.CONFIG_PATH;
    if (configPath === undefined || configPath.length === 0) {
      return fail(io, "config_required", 2);
    }
    const config = (dependencies.loadConfiguration ?? loadConfig)(configPath);
    if (config.persistence === undefined) {
      return fail(io, "persistence_required", 1);
    }
    if (config.identity === undefined) {
      return fail(io, "identity_required", 1);
    }
    const identifier = await io.question("Existing user UUID or email: ");
    const confirmation = await io.question(
      "Erase this account's authenticators and require enrollment? Type RESET to continue: ",
    );
    if (confirmation !== "RESET") return fail(io, "break_glass_cancelled", 1);

    persistence = (dependencies.openPersistence ?? openPersistence)(
      config.persistence.databaseFile,
      config,
    );
    const service = new LocalCredentialLifecycleService({
      repository: new LocalCredentialLifecycleRepository(
        persistence,
        dependencies.now,
      ),
      config: config.identity,
      ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
      ...(dependencies.random === undefined ? {} : { random: dependencies.random }),
      ...(dependencies.identityUuid === undefined ? {} : { uuid: dependencies.identityUuid }),
    });
    const result = await service.breakGlassReset({
      identifier,
      authorization: {
        allowed: true,
        targetUserId: "",
        capability: "affect_superadmin",
        humanStepUpSatisfied: false,
        actor: {
          type: "local_cli",
          label: "host-local operator",
          authenticationMethod: "host_terminal",
        },
        correlationId: `req_${(dependencies.correlationUuid ?? randomUUID)()}`,
        source: {
          category: "break_glass",
          client: "identity-break-glass-cli",
          osActor: boundedOsActor((dependencies.osActor ?? safeOsActor)()),
        },
      },
    });
    io.stdout(`${JSON.stringify({
      status: "enrollment_required",
      user_id: result.userId,
      role: result.role,
      temporary_password: result.temporaryPassword,
      expires_at: result.expiresAt,
      invalidation_pending: result.invalidationPending,
    })}\n`);
    return 0;
  } catch (error) {
    if (
      error instanceof CredentialLifecycleError &&
      ["identity_not_found", "credential_lifecycle_unavailable"].includes(error.code)
    ) return fail(io, "break_glass_failed", 1);
    return fail(io, "break_glass_failed", 1);
  } finally {
    if (persistence !== undefined) {
      try {
        await persistence.close();
      } catch {
        // Preserve the stable command outcome and never print storage details.
      }
    }
  }
}

function openPersistence(databaseFile: string, config: GatewayConfig): PersistenceOwner {
  const configuredSecrets = Object.values(config.services).flatMap(
    (service) => service.credentials.map((credential) => credential.secret),
  );
  return PersistenceWorker.open({
    databaseFile,
    productVersion: PACKAGE_VERSION,
    sanitizeAuditText: (value) => sanitizeAuditText(value, configuredSecrets),
  });
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

function fail(io: BreakGlassIo, code: string, exitCode: number): number {
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
    process.exitCode = await runBreakGlassCli(
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

if (process.argv[1]?.endsWith("/identity/breakGlassCli.js")) {
  void main();
}
