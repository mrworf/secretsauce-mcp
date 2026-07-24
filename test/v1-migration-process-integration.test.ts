import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import { RestoreRecoveryManager } from "../src/restoreRecovery.js";
import { V1MigrationCommitRepository } from "../src/v1MigrationCommit.js";
import { createV1MigrationPlan } from "../src/v1MigrationPlan.js";
import {
  resolveV1MigrationCredentials,
  V1MigrationResolutionContext,
} from "../src/v1MigrationSecrets.js";
import {
  V1MigrationResolvedCommitCoordinator,
  V1MigrationResolvedCommitError,
} from "../src/v1MigrationResolvedCommit.js";
import { readV1MigrationSource } from "../src/v1MigrationSource.js";
import { VaultBackupCapabilityIssuer } from "../src/vault/capabilities.js";
import { BackupVaultClient, ControlVaultClient } from "../src/vault/client.js";
import { encodeVaultKey } from "../src/vault/keyFile.js";

const NOW = 1_800_000_000_000;
const SUPERADMIN_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const CORRELATION_ID = "req_018f1f2e-7b3c-4a10-8000-000000000099";
const children = new Set<ChildProcessWithoutNullStreams>();
const childOutput = new Map<ChildProcessWithoutNullStreams, Buffer[]>();
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map(async (worker) => {
    try {
      await worker.close();
    } catch {
      // The recovery test may have atomically replaced the owned database.
    }
  }));
  workers.clear();
  await Promise.all([...children].map(stopChild));
});

describe("resolved migration with standalone vault broker", () => {
  it("commits a real control-plane vault record and removes recovery artifacts", async () => {
    const fixture = await setup();
    const child = await startChild(fixture.configFile, fixture.socketPath);
    const result = await fixture.coordinator(true).commit({
      resolved: fixture.resolved,
      correlationId: CORRELATION_ID,
      osActor: "process-integration",
    });

    const credential = await fixture.worker.execute({
      run: (database) => database.read((query) => query.get<{
        id: string;
        service_id: string;
        vault_locator: string;
        vault_generation: number;
      }>(`
        SELECT id, service_id, vault_locator, vault_generation
        FROM service_credentials
      `)!),
    });
    await expect(fixture.control.metadata(credential.vault_locator, {
      serviceId: credential.service_id,
      destinationId: credential.service_id,
      credentialId: credential.id,
    })).resolves.toMatchObject({ generation: credential.vault_generation });
    expect(result.serviceCount).toBe(1);
    expect(fixture.backupReadiness()).toEqual({ state: "completed" });
    expect(fixture.resolved.configuredCredentialIds()).toEqual([]);
    fixture.close();
    expect(await stopChild(child)).not.toContain("real-process-secret");
  }, 20_000);

  it("restores both SQLite and the real vault after a post-commit health failure", async () => {
    const fixture = await setup();
    const child = await startChild(fixture.configFile, fixture.socketPath);
    await expect(fixture.coordinator(false).commit({
      resolved: fixture.resolved,
      correlationId: CORRELATION_ID,
      osActor: "process-integration",
    })).rejects.toEqual(new V1MigrationResolvedCommitError("health_failed"));

    await fixture.worker.close();
    workers.delete(fixture.worker);
    const database = new Database(fixture.databaseFile, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(database.prepare("SELECT count(*) FROM services").pluck().get()).toBe(0);
      expect(database.prepare(
        "SELECT state FROM v1_migration_state WHERE singleton = 1",
      ).pluck().get()).toBe("pending");
      expect(database.prepare(
        "SELECT state FROM runtime_activation WHERE singleton = 1",
      ).pluck().get()).toBe("inactive");
    } finally {
      database.close();
    }
    await expect(fixture.control.readiness()).resolves.toEqual({
      status: "ready",
      recordCount: 0,
    });
    expect(fixture.resolved.configuredCredentialIds()).toEqual([]);
    fixture.close();
    expect(await stopChild(child)).not.toContain("real-process-secret");
  }, 20_000);
});

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "v1-migration-process-"));
  chmodSync(directory, 0o700);
  const runDirectory = join(directory, "run");
  const keyDirectory = join(directory, "keys");
  const recoveryDirectory = join(directory, "recovery");
  mkdirSync(runDirectory, { mode: 0o700 });
  mkdirSync(keyDirectory, { mode: 0o700 });
  mkdirSync(recoveryDirectory, { mode: 0o700 });
  const keys = {
    root: Buffer.alloc(32, 0x31),
    data: Buffer.alloc(32, 0x32),
    control: Buffer.alloc(32, 0x33),
    backup: Buffer.alloc(32, 0x34),
    resolve: Buffer.alloc(32, 0x35),
    backupCapability: Buffer.alloc(32, 0x36),
    recovery: Buffer.alloc(32, 0x37),
  };
  const keyFiles: Record<string, string> = {};
  for (const [name, key] of Object.entries(keys)) {
    const file = join(keyDirectory, `${name}.key`);
    writeFileSync(file, `${encodeVaultKey(key)}\n`, { mode: 0o400 });
    keyFiles[name] = file;
  }
  const socketPath = join(runDirectory, "vault.sock");
  const configFile = join(directory, "vault.yaml");
  writeFileSync(configFile, JSON.stringify({
    version: 1,
    socket: { path: socketPath, mode: 0o600 },
    store_directory: join(directory, "store"),
    active_root_key: "root-a",
    root_keys: { "root-a": keyFiles.root },
    caller_keys: {
      data_plane: keyFiles.data,
      control_plane: keyFiles.control,
      backup: keyFiles.backup,
    },
    capability_keys: {
      resolve: keyFiles.resolve,
      backup: keyFiles.backupCapability,
    },
  }));

  const databaseFile = join(directory, "control.sqlite");
  const worker = PersistenceWorker.open({
    databaseFile,
    productVersion: "test",
    now: () => NOW,
  });
  workers.add(worker);
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      transaction.run(`
        INSERT INTO users (
          id, email, normalized_email, given_name, family_name, role, status,
          security_epoch, password_policy_version, version, created_at,
          updated_at
        ) VALUES (?, 'root@example.org', 'root@example.org', 'Root', 'Admin',
          'superadmin', 'active', 1, 1, 1, ?, ?)
      `, [SUPERADMIN_ID, NOW, NOW]);
    }),
  });
  const sourceFile = join(directory, "source.yaml");
  writeFileSync(sourceFile, `services:
  example:
    name: Example
    destinations:
      - name: primary
        base_url: https://api.example.org/
    credentials:
      - id: token
        usage: {kind: header, name: X-Token}
        source: {kind: env, name: SELECTED_TOKEN}
`);
  const plan = createV1MigrationPlan(readV1MigrationSource(sourceFile), {
    uuid: deterministicUuid(0x38),
  });
  const allowlist = join(directory, "allowlist.yaml");
  writeFileSync(
    allowlist,
    "version: 1\nenvironment: [SELECTED_TOKEN]\nfiles: []\n",
    { mode: 0o400 },
  );
  const resolutionContext = new V1MigrationResolutionContext(
    Buffer.alloc(32, 0x39),
  );
  const resolved = resolveV1MigrationCredentials(plan, {
    allowlistFile: allowlist,
    environment: { SELECTED_TOKEN: "real-process-secret" },
    context: resolutionContext,
  });
  const control = new ControlVaultClient({
    socketPath,
    key: keys.control,
  });
  const backup = new BackupVaultClient({
    socketPath,
    key: keys.backup,
  });
  const issuer = new VaultBackupCapabilityIssuer(
    keys.backupCapability,
  );
  const recovery = new RestoreRecoveryManager(
    recoveryDirectory,
    keyFiles.recovery!,
    backup,
    issuer,
  );
  const commits = new V1MigrationCommitRepository(
    worker,
    () => NOW,
    deterministicUuid(0x3a),
  );
  return {
    configFile,
    socketPath,
    databaseFile,
    worker,
    resolved,
    control,
    coordinator: (healthy: boolean) =>
      new V1MigrationResolvedCommitCoordinator(
        databaseFile,
        commits,
        recovery,
        control,
        async () => healthy,
        () => NOW,
        deterministicUuid(0x3b),
      ),
    backupReadiness: () => {
      const database = new Database(databaseFile, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        return {
          state: database.prepare(
            "SELECT state FROM v1_migration_state WHERE singleton = 1",
          ).pluck().get(),
        };
      } finally {
        database.close();
      }
    },
    close: () => {
      resolutionContext.dispose();
      recovery.close();
      control.close();
      backup.close();
    },
  };
}

function deterministicUuid(byte: number): () => string {
  const generator = new UuidV7Generator({
    now: () => NOW,
    random: () => Buffer.alloc(10, byte),
  });
  return () => generator.next();
}

async function startChild(
  configFile: string,
  socketPath: string,
): Promise<ChildProcessWithoutNullStreams> {
  const child = spawn(process.execPath, ["dist/vault/main.js"], {
    cwd: process.cwd(),
    env: { ...process.env, SECRETSAUCE_VAULT_CONFIG: configFile },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
  childOutput.set(child, chunks);
  children.add(child);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(socketPath)) return child;
    if (child.exitCode !== null) {
      throw new Error(`Vault child exited before readiness: ${Buffer.concat(chunks).toString("utf8")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Vault child did not become ready.");
}

async function stopChild(child: ChildProcessWithoutNullStreams): Promise<string> {
  if (!children.has(child)) return "";
  const outputPromise = collectExit(child);
  child.kill("SIGTERM");
  const output = await outputPromise;
  children.delete(child);
  childOutput.delete(child);
  return output;
}

async function collectExit(child: ChildProcessWithoutNullStreams): Promise<string> {
  const chunks = childOutput.get(child) ?? [];
  if (child.exitCode === null) {
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
  return Buffer.concat(chunks).toString("utf8");
}
