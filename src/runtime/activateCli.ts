import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { createInterface } from "node:readline/promises";
import { loadConfig } from "../config.js";
import { PersistenceWorker, type PersistenceOwner } from "../persistence/worker.js";
import { RuntimeActivationRepository } from "../runtimeSnapshots.js";
import type { GatewayConfig } from "../types.js";
import { PACKAGE_VERSION } from "../version.js";

export interface RuntimeActivationIo {
  readonly inputTerminal: boolean;
  readonly outputTerminal: boolean;
  question(prompt: string): Promise<string>;
  stdout(value: string): void;
  stderr(value: string): void;
}

export interface RuntimeActivationDependencies {
  loadConfiguration?: (path: string) => GatewayConfig;
  openPersistence?: (databaseFile: string) => PersistenceOwner;
  uuid?: () => string;
  correlationUuid?: () => string;
  now?: () => number;
  osActor?: () => string;
}

export async function runRuntimeActivationCli(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  io: RuntimeActivationIo,
  dependencies: RuntimeActivationDependencies = {},
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
    if (
      config.runtime?.authority !== "database"
      || config.persistence === undefined
    ) {
      return fail(io, "database_runtime_required", 1);
    }
    const confirmation = await io.question(
      "Make published v2 database configuration the sole MCP authority? Type ACTIVATE V2 to continue: ",
    );
    if (confirmation !== "ACTIVATE V2") {
      return fail(io, "activation_cancelled", 1);
    }
    persistence = (dependencies.openPersistence ?? openPersistence)(
      config.persistence.databaseFile,
    );
    const repository = new RuntimeActivationRepository(
      persistence,
      dependencies.now,
      dependencies.uuid,
    );
    const result = await repository.activate({
      correlationId: `req_${(dependencies.correlationUuid ?? randomUUID)()}`,
      osActor: boundedOsActor((dependencies.osActor ?? safeOsActor)()),
    });
    io.stdout(`${JSON.stringify({
      status: "active",
      authority: "database",
      activation_generation: result.activationGeneration,
      service_count: result.serviceCount,
    })}\n`);
    return 0;
  } catch {
    return fail(io, "activation_failed", 1);
  } finally {
    if (persistence !== undefined) {
      try {
        await persistence.close();
      } catch {
        // Preserve the stable outcome without exposing storage details.
      }
    }
  }
}

function openPersistence(databaseFile: string): PersistenceOwner {
  return PersistenceWorker.open({
    databaseFile,
    productVersion: PACKAGE_VERSION,
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

function fail(io: RuntimeActivationIo, code: string, exitCode: number): number {
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
    process.exitCode = await runRuntimeActivationCli(
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

if (process.argv[1]?.endsWith("/runtime/activateCli.js")) {
  void main();
}
