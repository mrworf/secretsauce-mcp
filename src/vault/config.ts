import { isAbsolute, normalize, resolve } from "node:path";
import { z } from "zod";
import { loadYamlConfig, validationDiagnostics } from "../yamlConfig.js";
import { configError } from "../errors.js";
import { readVaultKeyFile } from "./keyFile.js";
import { vaultError } from "./errors.js";

const absolutePath = z.string().min(1).max(4096).refine((value) => isAbsolute(value) && !value.includes("\0"), {
  message: "must be an absolute path without NUL",
});
const keyId = z.string().regex(/^[a-z][a-z0-9-]{0,62}$/);

const schema = z.object({
  version: z.literal(1),
  socket: z.object({
    path: absolutePath,
    mode: z.union([z.literal(0o600), z.literal(0o660)]).default(0o600),
  }).strict(),
  store_directory: absolutePath,
  active_root_key: keyId,
  root_keys: z.record(keyId, absolutePath).refine((value) => Object.keys(value).length >= 1 && Object.keys(value).length <= 16, {
    message: "must contain between one and sixteen root keys",
  }),
  caller_keys: z.object({
    data_plane: absolutePath,
    control_plane: absolutePath,
    backup: absolutePath,
  }).strict(),
  capability_keys: z.object({
    resolve: absolutePath,
    backup: absolutePath,
  }).strict(),
}).strict();

export interface VaultConfig {
  version: 1;
  socket: { path: string; mode: 0o600 | 0o660 };
  storeDirectory: string;
  activeRootKey: string;
  rootKeys: ReadonlyMap<string, Buffer>;
  callerKeys: {
    dataPlane: Buffer;
    controlPlane: Buffer;
    backup: Buffer;
  };
  capabilityKeys: {
    resolve: Buffer;
    backup: Buffer;
  };
}

export function loadVaultConfig(file: string): VaultConfig {
  if (!isAbsolute(file)) throw vaultError("vault_config_invalid");
  return loadYamlConfig(file, "vault config", validateVaultConfig);
}

export function validateVaultConfig(raw: unknown): VaultConfig {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw configError("Invalid vault config", validationDiagnostics(parsed.error.issues));
  }
  const value = parsed.data;
  if (!(value.active_root_key in value.root_keys)) {
    throw configError("Invalid vault config", [{
      detail: "active_root_key must name a configured root key",
      path: "active_root_key",
      configPath: ["active_root_key"],
    }]);
  }

  const paths = [
    value.socket.path,
    value.store_directory,
    ...Object.values(value.root_keys),
    value.caller_keys.data_plane,
    value.caller_keys.control_plane,
    value.caller_keys.backup,
    value.capability_keys.resolve,
    value.capability_keys.backup,
  ].map(canonicalPath);
  if (new Set(paths).size !== paths.length) throw vaultError("vault_config_invalid");

  try {
    return {
      version: 1,
      socket: { path: canonicalPath(value.socket.path), mode: value.socket.mode },
      storeDirectory: canonicalPath(value.store_directory),
      activeRootKey: value.active_root_key,
      rootKeys: new Map(Object.entries(value.root_keys).map(([id, path]) => [id, readVaultKeyFile(path)])),
      callerKeys: {
        dataPlane: readVaultKeyFile(value.caller_keys.data_plane),
        controlPlane: readVaultKeyFile(value.caller_keys.control_plane),
        backup: readVaultKeyFile(value.caller_keys.backup),
      },
      capabilityKeys: {
        resolve: readVaultKeyFile(value.capability_keys.resolve),
        backup: readVaultKeyFile(value.capability_keys.backup),
      },
    };
  } catch {
    throw vaultError("vault_config_invalid");
  }
}

function canonicalPath(value: string): string {
  return normalize(resolve(value));
}
