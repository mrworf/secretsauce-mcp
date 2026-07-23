import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { createInterface } from "node:readline/promises";
import { sanitizeAuditText } from "../auditSanitizer.js";
import { loadConfig } from "../config.js";
import type { GatewayConfig } from "../types.js";
import { PACKAGE_VERSION } from "../version.js";
import { IdentityError } from "./errors.js";
import { IdentityRepository } from "./repository.js";
import { generateTemporaryPassword } from "./credentialLifecycle.js";
import { hashPassword } from "./password.js";
import { PersistenceWorker, type PersistenceOwner } from "../persistence/worker.js";

export interface IdentityBootstrapIo {
  readonly inputTerminal: boolean;
  readonly outputTerminal: boolean;
  question(prompt: string): Promise<string>;
  stdout(value: string): void;
  stderr(value: string): void;
}

export interface IdentityBootstrapDependencies {
  loadConfiguration?: (path: string) => GatewayConfig;
  openPersistence?: (
    databaseFile: string,
    config: GatewayConfig,
  ) => PersistenceOwner;
  identityUuid?: () => string;
  correlationUuid?: () => string;
  now?: () => number;
  osActor?: () => string;
}

export async function runIdentityBootstrapCli(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  io: IdentityBootstrapIo,
  dependencies: IdentityBootstrapDependencies = {},
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

    const email = await io.question("Email: ");
    const givenName = await io.question("Given name (optional): ");
    const familyName = await io.question("Family name (optional): ");
    const confirmation = await io.question(
      "Create the enrollment-pending initial superadmin? Type YES to continue: ",
    );
    if (confirmation !== "YES") return fail(io, "bootstrap_cancelled", 1);

    persistence = (dependencies.openPersistence ?? openPersistence)(
      config.persistence.databaseFile,
      config,
    );
    const identities = new IdentityRepository(persistence, {
      ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
      ...(dependencies.identityUuid === undefined ? {} : { uuid: dependencies.identityUuid }),
    });
    const temporaryPassword = generateTemporaryPassword(
      config.identity.password.minimumLength,
    );
    const temporaryBytes = Buffer.from(temporaryPassword, "utf8");
    let encodedHash: string;
    try {
      encodedHash = await hashPassword(temporaryBytes);
    } finally {
      temporaryBytes.fill(0);
    }
    const expiresAt = Math.trunc((dependencies.now ?? Date.now)()) +
      config.identity.temporaryPasswordTtlMs;
    const identity = await identities.bootstrapInitialSuperadmin({
      email,
      givenName,
      familyName,
    }, {
      actor: {
        type: "local_cli",
        label: "host-local operator",
        authenticationMethod: "host_terminal",
      },
      correlationId: `req_${(dependencies.correlationUuid ?? randomUUID)()}`,
      source: {
        category: "break_glass",
        client: "identity-bootstrap-cli",
        osActor: (dependencies.osActor ?? safeOsActor)(),
      },
      justification: "Initialize the first enrollment-pending superadmin identity.",
    }, {
      encodedHash,
      expiresAt,
    });
    io.stdout(`${JSON.stringify({
      status: "enrollment_required",
      user_id: identity.id,
      role: identity.role,
      enrollment: "pending",
      temporary_password: temporaryPassword,
      expires_at: expiresAt,
    })}\n`);
    return 0;
  } catch (error) {
    if (error instanceof IdentityError && error.code === "bootstrap_unavailable") {
      return fail(io, "bootstrap_unavailable", 1);
    }
    return fail(io, "bootstrap_failed", 1);
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

function safeOsActor(): string {
  try {
    return userInfo().username;
  } catch {
    return "local-operator";
  }
}

function fail(io: IdentityBootstrapIo, code: string, exitCode: number): number {
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
    process.exitCode = await runIdentityBootstrapCli(
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

if (process.argv[1]?.endsWith("/identity/bootstrapCli.js")) {
  void main();
}
