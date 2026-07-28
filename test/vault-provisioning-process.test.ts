import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { parse, stringify } from "yaml";
import {
  ControlVaultClient,
  readVaultProvisioningStatus,
} from "../src/vault/client.js";
import { readVaultKeyFile } from "../src/vault/keyFile.js";
import { startVaultService } from "../src/vault/main.js";
import { VaultSetupAuthority } from "../src/vault/setupAuthority.js";
import {
  validateAssignedRuntimeProvisionedKeys,
} from "../src/vault/runtimeProvisioning.js";
import {
  VAULT_PROVISIONING_KEY_IDS,
  type VaultProvisioningKeyPaths,
} from "../src/vault/provisioningRegistry.js";

describe("vault provisioning entrypoint lifecycle", () => {
  it("provisions fresh keys, drops setup authority, then opens credentials", async () => {
    const fixture = configFixture();
    const drop = vi.fn((_uid, _gid, _groups) => {
      expect(existsSync(fixture.credentialSocket)).toBe(false);
      expect(existsSync(join(fixture.stateDirectory, "manifest.json")))
        .toBe(true);
    });
    const service = await startVaultService(fixture.configFile, drop);
    try {
      expect(drop).toHaveBeenCalledOnce();
      expect(await readVaultProvisioningStatus(fixture.statusSocket))
        .toBe("ready");
      await expect(statusCode(fixture.statusSocket, "HEAD", "/v1/status"))
        .resolves.toBe(404);
      await expect(statusCode(
        fixture.statusSocket,
        "GET",
        "/v1/status?detail=true",
      )).resolves.toBe(400);
      await expect(statusCode(
        fixture.statusSocket,
        "GET",
        "/v1/status",
        "x",
      )).resolves.toBe(400);
      expect(existsSync(fixture.credentialSocket)).toBe(true);
      for (const path of Object.values(fixture.keyPaths)) {
        expect(lstatSync(path).isFile()).toBe(true);
      }
      const controlKey = readVaultKeyFile(
        fixture.keyPaths["vault.caller.control-plane"],
      );
      const control = new ControlVaultClient({
        socketPath: fixture.credentialSocket,
        key: controlKey,
      });
      controlKey.fill(0);
      await expect(control.readiness()).resolves.toMatchObject({
        status: "ready",
      });
      control.close();
    } finally {
      await service.close();
    }
  });

  it("drops setup authority and remains status-only for retained-state mismatch", async () => {
    const fixture = configFixture();
    mkdirSync(fixture.retained.application_database, {
      mode: 0o700,
      recursive: true,
    });
    writeFileSync(
      join(fixture.retained.application_database, "state"),
      "retained",
    );
    const drop = vi.fn();
    const service = await startVaultService(fixture.configFile, drop);
    try {
      expect(drop).toHaveBeenCalledOnce();
      expect(await readVaultProvisioningStatus(fixture.statusSocket))
        .toBe("configuration_error");
      expect(existsSync(fixture.credentialSocket)).toBe(false);
      expect(Object.values(fixture.keyPaths).some(existsSync)).toBe(false);
    } finally {
      await service.close();
    }
  });

  it("fails closed when post-drop runtime validation detects key tampering", async () => {
    const fixture = configFixture();
    const drop = vi.fn(() => {
      chmodSync(fixture.keyPaths["vault.caller.control-plane"], 0o400);
    });
    const service = await startVaultService(fixture.configFile, drop);
    try {
      expect(drop).toHaveBeenCalledOnce();
      expect(await readVaultProvisioningStatus(fixture.statusSocket))
        .toBe("configuration_error");
      expect(existsSync(fixture.credentialSocket)).toBe(false);
    } finally {
      await service.close();
    }
  });

  it("requires complete application manifest-validation inputs and exact assignments", async () => {
    const fixture = configFixture();
    const service = await startVaultService(fixture.configFile, vi.fn());
    try {
      const environment = {
        SECRETSAUCE_VAULT_MANIFEST_FILE:
          join(fixture.stateDirectory, "manifest.json"),
        SECRETSAUCE_VAULT_KEY_OWNER_UID:
          String(process.getuid?.() ?? 0),
        SECRETSAUCE_VAULT_SHARED_GID:
          String(process.getgid?.() ?? 0),
      };
      expect(() => validateAssignedRuntimeProvisionedKeys(
        environment,
        [{
          id: "vault.caller.control-plane",
          path: fixture.keyPaths["vault.caller.control-plane"],
        }],
      )).not.toThrow();
      expect(() => validateAssignedRuntimeProvisionedKeys(
        {
          ...environment,
          SECRETSAUCE_VAULT_SHARED_GID: undefined,
        },
        [{
          id: "vault.caller.control-plane",
          path: fixture.keyPaths["vault.caller.control-plane"],
        }],
      )).toThrow();
      expect(() => validateAssignedRuntimeProvisionedKeys(
        environment,
        [{
          id: "vault.caller.control-plane",
          path: fixture.keyPaths["vault.caller.data-plane"],
        }],
      )).toThrow();
    } finally {
      await service.close();
    }
  });

  it("closes status and credentials when privilege release cannot be proven", async () => {
    const fixture = configFixture();
    await expect(startVaultService(fixture.configFile, () => {
      throw new Error("injected privilege failure");
    })).rejects.toThrow();
    expect(existsSync(fixture.statusSocket)).toBe(false);
    expect(existsSync(fixture.credentialSocket)).toBe(false);
  });

  it("makes the setup authority object unusable before invoking the drop", () => {
    const fixture = configFixture();
    const manifest = join(fixture.stateDirectory, "manifest.json");
    writeFileSync(manifest, "{}\n", { mode: 0o600 });
    const runOnce = vi.fn(() => ({
      state: "configuration_error" as const,
      retryPending: false as const,
      errorCategory: "state_mismatch" as const,
    }));
    const authority = new VaultSetupAuthority(
      { runOnce },
      manifest,
      [{ path: fixture.keyDirectory, gid: process.getgid?.() ?? 1000 }],
      process.getuid?.() ?? 1000,
      process.getgid?.() ?? 1000,
      process.getgid?.() ?? 1000,
    );
    const drop = vi.fn(() => {
      expect(() => authority.runOnce()).toThrow();
    });
    authority.relinquish(drop);
    expect(drop).toHaveBeenCalledOnce();
    expect(() => authority.relinquish(drop)).toThrow();
  });

  it("keeps the registry invariant across arbitrary feature configuration", () => {
    const fixture = configFixture();
    const raw = parse(
      readFileSync(fixture.configFile, "utf8"),
    ) as Record<string, any>;
    expect(Object.keys(raw.setup.key_paths).sort())
      .toEqual([...VAULT_PROVISIONING_KEY_IDS].sort());
    expect(JSON.stringify(raw.setup)).not.toContain("feature");
  });
});

interface ConfigFixture {
  configFile: string;
  statusSocket: string;
  credentialSocket: string;
  stateDirectory: string;
  keyDirectory: string;
  keyPaths: VaultProvisioningKeyPaths;
  retained: Record<string, string>;
}

function statusCode(
  socketPath: string,
  method: string,
  path: string,
  body?: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const requestValue = request({
      socketPath,
      method,
      path,
      headers: body === undefined
        ? undefined
        : { "content-length": Buffer.byteLength(body) },
    }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });
    requestValue.once("error", reject);
    if (body !== undefined) requestValue.write(body);
    requestValue.end();
  });
}

function configFixture(): ConfigFixture {
  const directory = mkdtempSync(join(tmpdir(), "vault-entrypoint-"));
  chmodSync(directory, 0o700);
  const run = join(directory, "run");
  const keys = join(directory, "keys");
  const state = join(directory, "state");
  mkdirSync(run, { mode: 0o700 });
  mkdirSync(keys, { mode: 0o700 });
  mkdirSync(state, { mode: 0o700 });
  const keyPaths = Object.fromEntries(VAULT_PROVISIONING_KEY_IDS.map((id) => [
    id,
    join(keys, `${id}.key`),
  ])) as VaultProvisioningKeyPaths;
  const retained = {
    application_database: join(directory, "retained", "database"),
    identity_store: join(directory, "retained", "identity"),
    oauth_store: join(directory, "retained", "oauth"),
    vault_store: join(directory, "vault-store"),
    audit_store: join(directory, "retained", "audit"),
    installation_marker: join(directory, "retained", "installation"),
  };
  const statusSocket = join(run, "status.sock");
  const credentialSocket = join(run, "credential.sock");
  const raw = {
    version: 1,
    status_socket: { path: statusSocket, mode: 0o600 },
    credential_socket: { path: credentialSocket, mode: 0o600 },
    store_directory: retained.vault_store,
    active_root_key: "root-primary",
    root_keys: {
      "root-primary": keyPaths["vault.envelope-root"],
    },
    caller_keys: {
      data_plane: keyPaths["vault.caller.data-plane"],
      control_plane: keyPaths["vault.caller.control-plane"],
      backup: keyPaths["vault.caller.backup"],
    },
    capability_keys: {
      resolve: keyPaths["vault.capability.resolve"],
      backup: keyPaths["vault.capability.backup"],
    },
    setup: {
      state_directory: state,
      adopt_existing_keys: false,
      key_paths: keyPaths,
      retained_state: retained,
      runtime_uid: process.getuid?.() ?? 1000,
      runtime_gid: process.getgid?.() ?? 1000,
      application_uid: process.getuid?.() ?? 1000,
      application_gid: process.getgid?.() ?? 1000,
      shared_gid: process.getgid?.() ?? 1000,
    },
  };
  const configFile = join(directory, "vault.yaml");
  writeFileSync(configFile, stringify(raw), "utf8");
  return {
    configFile,
    statusSocket,
    credentialSocket,
    stateDirectory: state,
    keyDirectory: keys,
    keyPaths,
    retained,
  };
}
