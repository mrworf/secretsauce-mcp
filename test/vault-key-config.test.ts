import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadVaultConfig } from "../src/vault/config.js";
import { VaultError } from "../src/vault/errors.js";
import { createVaultKeyFile, encodeVaultKey, readVaultKeyFile } from "../src/vault/keyFile.js";
import { runVaultKeyCli } from "../src/vault/keyCli.js";

describe("vault key files and configuration", () => {
  it("atomically creates a non-printing mode-0400 key and reports safe status", () => {
    const directory = secureDirectory("vault-key-create");
    const file = join(directory, "caller.key");
    const stdout: string[] = [];
    const stderr: string[] = [];

    expect(runVaultKeyCli(["generate", "--output", file], {
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    })).toBe(0);
    expect(stdout).toEqual(['{"status":"created"}\n']);
    expect(stderr).toEqual([]);
    expect(lstatSync(file).mode & 0o777).toBe(0o400);
    expect(lstatSync(file).nlink).toBe(1);
    expect(readFileSync(file, "utf8")).toMatch(/^[A-Za-z0-9_-]{43}\n$/);
    expect(readVaultKeyFile(file)).toHaveLength(32);

    stdout.length = 0;
    expect(runVaultKeyCli(["status", "--file", file], {
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    })).toBe(0);
    expect(stdout).toEqual(['{"status":"valid"}\n']);
  });

  it("refuses replacement, permissive directories/files, links, and malformed keys without exposing values", () => {
    const directory = secureDirectory("vault-key-denials");
    const file = join(directory, "key");
    createVaultKeyFile(file, () => Buffer.alloc(32, 7));
    const original = readFileSync(file, "utf8");
    expect(() => createVaultKeyFile(file, () => Buffer.alloc(32, 8))).toThrow(VaultError);
    expect(readFileSync(file, "utf8")).toBe(original);

    chmodSync(file, 0o600);
    expect(() => readVaultKeyFile(file)).toThrowError(expect.objectContaining({ code: "vault_key_invalid" }));
    chmodSync(file, 0o400);
    const link = join(directory, "link");
    symlinkSync(file, link);
    expect(() => readVaultKeyFile(link)).toThrowError(expect.objectContaining({ code: "vault_key_invalid" }));

    const malformed = join(directory, "malformed");
    writeFileSync(malformed, "private-key-material\n", { mode: 0o400 });
    let serialized = "";
    try {
      readVaultKeyFile(malformed);
    } catch (error) {
      serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
    }
    expect(serialized).not.toContain("private-key-material");

    const unsafeDirectory = secureDirectory("vault-key-unsafe");
    chmodSync(unsafeDirectory, 0o777);
    expect(() => createVaultKeyFile(join(unsafeDirectory, "key"))).toThrow(VaultError);
  });

  it("loads an exact closed config with distinct role and capability keys", () => {
    const fixture = vaultFixture();
    const config = loadVaultConfig(fixture.configFile);

    expect(config.version).toBe(1);
    expect(config.statusSocket.mode).toBe(0o600);
    expect(config.credentialSocket.mode).toBe(0o600);
    expect(config.rootKeys.get("root-primary")).toHaveLength(32);
    expect(config.callerKeys.dataPlane).not.toEqual(config.callerKeys.controlPlane);
    expect(config.capabilityKeys.resolve).not.toEqual(config.capabilityKeys.backup);
  });

  it("rejects unknown fields, relative/colliding paths, missing active roots, and unsafe key material", () => {
    for (const mutate of [
      (raw: Record<string, any>) => { raw.unexpected = true; },
      (raw: Record<string, any>) => {
        raw.credential_socket.path = "vault.sock";
      },
      (raw: Record<string, any>) => { raw.active_root_key = "root-missing"; },
      (raw: Record<string, any>) => { raw.capability_keys.resolve = raw.caller_keys.data_plane; },
      (raw: Record<string, any>) => {
        delete raw.setup.key_paths["oauth.token-hmac"];
      },
      (raw: Record<string, any>) => { raw.setup.runtime_uid = 0; },
      (raw: Record<string, any>) => {
        raw.setup.application_uid += 1;
      },
      (raw: Record<string, any>) => {
        raw.setup.key_paths["identity.envelope-root"] =
          raw.setup.state_directory;
      },
      (raw: Record<string, any>) => {
        raw.setup.retained_state.vault_store =
          join(raw.setup.retained_state.vault_store, "other");
      },
    ]) {
      const fixture = vaultFixture();
      const raw = fixture.raw;
      mutate(raw);
      writeFileSync(fixture.configFile, yaml(raw), "utf8");
      expect(() => loadVaultConfig(fixture.configFile)).toThrow();
    }

    const fixture = vaultFixture();
    chmodSync(fixture.raw.caller_keys.backup, 0o644);
    expect(() => loadVaultConfig(fixture.configFile)).toThrowError(expect.objectContaining({
      code: "vault_config_invalid",
      message: "Vault configuration is invalid.",
    }));
  });
});

function secureDirectory(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), `${name}-`));
  chmodSync(directory, 0o700);
  return directory;
}

function vaultFixture(): { configFile: string; raw: Record<string, any> } {
  const directory = secureDirectory("vault-config");
  const keys = join(directory, "keys");
  mkdirSync(keys, { mode: 0o700 });
  const names = ["root", "data", "control", "backup", "resolve-cap", "backup-cap"];
  const paths = Object.fromEntries(names.map((name, index) => {
    const path = join(keys, `${name}.key`);
    writeFileSync(path, `${encodeVaultKey(Buffer.alloc(32, index + 1))}\n`, { mode: 0o400 });
    return [name, path];
  }));
  for (const name of [
    "identity-root",
    "identity-session",
    "control-idempotency",
    "oauth-token",
  ]) {
    const path = join(keys, `${name}.key`);
    writeFileSync(path, `${encodeVaultKey(Buffer.alloc(32, name.length))}\n`, {
      mode: 0o400,
    });
    paths[name] = path;
  }
  const oauthSigning = join(keys, "oauth-signing.pem");
  const generated = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  writeFileSync(oauthSigning, generated.privateKey, { mode: 0o400 });
  paths["oauth-signing"] = oauthSigning;
  const state = join(directory, "state");
  const retained = join(directory, "retained");
  mkdirSync(state, { mode: 0o700 });
  mkdirSync(retained, { mode: 0o700 });
  const raw = {
    version: 1,
    status_socket: {
      path: join(directory, "run", "status.sock"),
      mode: 0o600,
    },
    credential_socket: {
      path: join(directory, "run", "credential.sock"),
      mode: 0o600,
    },
    store_directory: join(directory, "store"),
    active_root_key: "root-primary",
    root_keys: { "root-primary": paths.root },
    caller_keys: {
      data_plane: paths.data,
      control_plane: paths.control,
      backup: paths.backup,
    },
    capability_keys: {
      resolve: paths["resolve-cap"],
      backup: paths["backup-cap"],
    },
    setup: {
      state_directory: state,
      adopt_existing_keys: true,
      key_paths: {
        "identity.envelope-root": paths["identity-root"],
        "identity.session-hmac": paths["identity-session"],
        "control.idempotency-hmac": paths["control-idempotency"],
        "oauth.signing": paths["oauth-signing"],
        "oauth.token-hmac": paths["oauth-token"],
        "vault.envelope-root": paths.root,
        "vault.caller.data-plane": paths.data,
        "vault.caller.control-plane": paths.control,
        "vault.caller.backup": paths.backup,
        "vault.capability.resolve": paths["resolve-cap"],
        "vault.capability.backup": paths["backup-cap"],
      },
      retained_state: {
        application_database: join(retained, "application.db"),
        identity_store: join(retained, "identity"),
        oauth_store: join(retained, "oauth"),
        vault_store: join(directory, "store"),
        audit_store: join(retained, "audit"),
        installation_marker: join(retained, "installation"),
      },
      runtime_uid: process.getuid?.() ?? 1000,
      runtime_gid: process.getgid?.() ?? 1000,
      application_uid: process.getuid?.() ?? 1000,
      application_gid: process.getgid?.() ?? 1000,
      shared_gid: process.getgid?.() ?? 1000,
    },
  };
  const configFile = join(directory, "vault.yaml");
  writeFileSync(configFile, yaml(raw), "utf8");
  return { configFile, raw };
}

function yaml(value: unknown): string {
  return JSON.stringify(value);
}
