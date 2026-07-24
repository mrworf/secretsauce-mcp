import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";
import {
  digestVaultBackupSelection,
  type VaultBackupSelection,
} from "../src/vault/backupSelection.js";
import { VaultCapabilityAuthority } from "../src/vault/capabilities.js";
import { BackupVaultClient, ControlVaultClient, DataVaultClient } from "../src/vault/client.js";
import { encodeVaultKey } from "../src/vault/keyFile.js";
import { runVaultHealthCli } from "../src/vault/healthCli.js";
import { createControlVaultReadiness } from "../src/vault/readiness.js";
import type { VaultCredentialBinding } from "../src/vault/recordStore.js";

const children = new Set<ChildProcessWithoutNullStreams>();

afterEach(async () => {
  await Promise.all([...children].map(stopChild));
});

describe("standalone vault broker process", () => {
  it("persists encrypted credentials across real process restart without emitting their value", async () => {
    const fixture = processFixture();
    const secret = Buffer.from("separate-process-private-4321");
    const first = await startChild(fixture.configFile, fixture.socketPath);
    try {
      const healthOutput: string[] = [];
      await expect(runVaultHealthCli({
        SECRETSAUCE_VAULT_SOCKET: fixture.socketPath,
        SECRETSAUCE_VAULT_DATA_KEY_FILE: fixture.raw.caller_keys.data_plane,
      }, (value) => healthOutput.push(value))).resolves.toBe(0);
      expect(healthOutput).toEqual(['{"status":"ready"}\n']);
      expect(healthOutput.join("")).not.toContain(fixture.socketPath);
      const controlReadiness = createControlVaultReadiness({
        SECRETSAUCE_VAULT_SOCKET: fixture.socketPath,
        SECRETSAUCE_VAULT_CONTROL_KEY_FILE: fixture.raw.caller_keys.control_plane,
      })!;
      await expect(controlReadiness.readiness()).resolves.toBe("ready");
      controlReadiness.close();

      const control = new ControlVaultClient({ socketPath: fixture.socketPath, key: fixture.keys.control });
      const data = new DataVaultClient({ socketPath: fixture.socketPath, key: fixture.keys.data });
      const backup = new BackupVaultClient({ socketPath: fixture.socketPath, key: fixture.keys.backup });
      const created = await control.create({
        binding: fixture.binding,
        secret,
        captureLastFour: true,
      });
      expect(created.metadata).toMatchObject({ generation: 1, lastFour: "4321" });
      const token = issueResolve(fixture, created.locator, 1);
      await expect(data.resolveForRequest({
        capability: token,
        locator: created.locator,
        generation: 1,
        binding: fixture.binding,
      }, (value) => value.toString())).resolves.toBe(secret.toString());
      const passphrase = Buffer.from("process backup passphrase");
      const selection = [{
        ...fixture.binding,
        locator: created.locator,
        generation: 1,
      }];
      const archive = await backup.exportEncrypted(
        issueBackup(fixture, "export_encrypted", selection),
        passphrase,
        selection,
      );
      await control.replace({
        locator: created.locator,
        generation: 1,
        binding: fixture.binding,
        secret: Buffer.from("temporary-replacement"),
      });
      await backup.importEncrypted(issueBackup(fixture, "import_encrypted"), passphrase, archive);
      archive.fill(0);
      passphrase.fill(0);
      control.close();
      data.close();
      backup.close();

      const firstOutput = await stopChild(first);
      expect(firstOutput).not.toContain(secret.toString());
      expect(existsSync(fixture.socketPath)).toBe(false);
      const stoppedOutput: string[] = [];
      await expect(runVaultHealthCli({
        SECRETSAUCE_VAULT_SOCKET: fixture.socketPath,
        SECRETSAUCE_VAULT_DATA_KEY_FILE: fixture.raw.caller_keys.data_plane,
      }, (value) => stoppedOutput.push(value))).resolves.toBe(1);
      expect(stoppedOutput).toEqual(['{"status":"unavailable"}\n']);

      const second = await startChild(fixture.configFile, fixture.socketPath);
      const restartedControl = new ControlVaultClient({ socketPath: fixture.socketPath, key: fixture.keys.control });
      const restartedData = new DataVaultClient({ socketPath: fixture.socketPath, key: fixture.keys.data });
      expect(await restartedControl.metadata(created.locator, fixture.binding)).toEqual(created.metadata);
      await expect(restartedData.resolveForRequest({
        capability: issueResolve(fixture, created.locator, 1),
        locator: created.locator,
        generation: 1,
        binding: fixture.binding,
      }, (value) => value.toString())).resolves.toBe(secret.toString());
      restartedControl.close();
      restartedData.close();
      expect(await stopChild(second)).not.toContain(secret.toString());
    } finally {
      secret.fill(0);
    }
  });

  it("fails startup safely when a required key is missing", async () => {
    const fixture = processFixture();
    fixture.raw.caller_keys.data_plane = join(dirnameOf(fixture.configFile), "missing.key");
    writeFileSync(fixture.configFile, JSON.stringify(fixture.raw), "utf8");
    const child = spawn(process.execPath, ["dist/vault/main.js"], {
      cwd: process.cwd(),
      env: { ...process.env, SECRETSAUCE_VAULT_CONFIG: fixture.configFile },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.add(child);
    const output = await collectExit(child);
    children.delete(child);
    expect(child.exitCode).toBe(1);
    expect(output).toContain("vault_startup_failed");
    expect(output).not.toContain("missing.key");
    expect(output).not.toContain(fixture.configFile);
  });

  it("rejects partial or relative readiness configuration without echoing inputs", () => {
    for (const environment of [
      { SECRETSAUCE_VAULT_SOCKET: "/private/runtime/vault.sock" },
      { SECRETSAUCE_VAULT_CONTROL_KEY_FILE: "/private/keys/control.key" },
      {
        SECRETSAUCE_VAULT_SOCKET: "relative.sock",
        SECRETSAUCE_VAULT_CONTROL_KEY_FILE: "/private/keys/control.key",
      },
    ]) {
      let serialized = "";
      try {
        createControlVaultReadiness(environment);
      } catch (error) {
        serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      expect(serialized).toContain("vault_config_invalid");
      expect(serialized).not.toContain("private/runtime");
      expect(serialized).not.toContain("private/keys");
      expect(serialized).not.toContain("relative.sock");
    }
    expect(createControlVaultReadiness({})).toBeUndefined();
  });
});

interface ProcessFixture {
  configFile: string;
  socketPath: string;
  raw: Record<string, any>;
  keys: {
    data: Buffer;
    control: Buffer;
    backup: Buffer;
    resolve: Buffer;
    backupCapability: Buffer;
  };
  binding: VaultCredentialBinding;
  authority: VaultCapabilityAuthority;
}

function processFixture(): ProcessFixture {
  const directory = mkdtempSync(join(tmpdir(), "vault-process-"));
  chmodSync(directory, 0o700);
  const run = join(directory, "run");
  const keysDirectory = join(directory, "keys");
  mkdirSync(run, { mode: 0o700 });
  mkdirSync(keysDirectory, { mode: 0o700 });
  const keys = {
    root: Buffer.alloc(32, 20),
    data: Buffer.alloc(32, 21),
    control: Buffer.alloc(32, 22),
    backup: Buffer.alloc(32, 23),
    resolve: Buffer.alloc(32, 24),
    backupCapability: Buffer.alloc(32, 25),
  };
  const keyPaths: Record<string, string> = {};
  for (const [name, key] of Object.entries(keys)) {
    const file = join(keysDirectory, `${name}.key`);
    writeFileSync(file, `${encodeVaultKey(key)}\n`, { mode: 0o400 });
    keyPaths[name] = file;
  }
  const socketPath = join(run, "vault.sock");
  const raw = {
    version: 1,
    socket: { path: socketPath, mode: 0o600 },
    store_directory: join(directory, "store"),
    active_root_key: "root-a",
    root_keys: { "root-a": keyPaths.root },
    caller_keys: {
      data_plane: keyPaths.data,
      control_plane: keyPaths.control,
      backup: keyPaths.backup,
    },
    capability_keys: {
      resolve: keyPaths.resolve,
      backup: keyPaths.backupCapability,
    },
  };
  const configFile = join(directory, "vault.yaml");
  writeFileSync(configFile, JSON.stringify(raw), "utf8");
  const generator = new UuidV7Generator();
  const binding = {
    serviceId: generator.next(),
    destinationId: generator.next(),
    credentialId: generator.next(),
  };
  return {
    configFile,
    socketPath,
    raw,
    keys,
    binding,
    authority: new VaultCapabilityAuthority({
      resolveKey: keys.resolve,
      backupKey: keys.backupCapability,
    }),
  };
}

function issueResolve(fixture: ProcessFixture, locator: string, generation: number): string {
  return fixture.authority.issueResolve({
    subjectId: new UuidV7Generator().next(),
    grantEpoch: 1,
    securityEpoch: 1,
    ...fixture.binding,
    locator,
    generation,
    method: "GET",
    pathDigest: "c".repeat(64),
    requestId: `req_${randomUUID()}`,
    operationDigest: "d".repeat(64),
  });
}

function issueBackup(
  fixture: ProcessFixture,
  operation: "export_encrypted" | "import_encrypted",
  selection?: readonly VaultBackupSelection[],
): string {
  return fixture.authority.issueBackup({
    operation,
    authorizationId: new UuidV7Generator().next(),
    subjectId: new UuidV7Generator().next(),
    operationDigest: operation === "export_encrypted"
      ? digestVaultBackupSelection(selection!)
      : "f".repeat(64),
  });
}

async function startChild(configFile: string, socketPath: string): Promise<ChildProcessWithoutNullStreams> {
  const child = spawn(process.execPath, ["dist/vault/main.js"], {
    cwd: process.cwd(),
    env: { ...process.env, SECRETSAUCE_VAULT_CONFIG: configFile },
    stdio: ["pipe", "pipe", "pipe"],
  });
  children.add(child);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(socketPath)) return child;
    if (child.exitCode !== null) throw new Error("Vault child exited before readiness.");
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
  return output;
}

async function collectExit(child: ChildProcessWithoutNullStreams): Promise<string> {
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  return Buffer.concat(chunks).toString("utf8");
}

function dirnameOf(file: string): string {
  return file.slice(0, file.lastIndexOf("/"));
}
