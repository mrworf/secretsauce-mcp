import { isAbsolute, normalize, relative, resolve } from "node:path";
import { z } from "zod";
import { loadYamlConfig, validationDiagnostics } from "../yamlConfig.js";
import { configError } from "../errors.js";
import { readVaultKeyFile } from "./keyFile.js";
import { vaultError } from "./errors.js";
import {
  createVaultProvisioningRegistry,
  type VaultProvisioningKeyPaths,
  type VaultProvisioningRegistryEntry,
} from "./provisioningRegistry.js";

const absolutePath = z.string().min(1).max(4096).refine((value) => isAbsolute(value) && !value.includes("\0"), {
  message: "must be an absolute path without NUL",
});
const keyId = z.string().regex(/^[a-z][a-z0-9-]{0,62}$/);

const schema = z.object({
  version: z.literal(1),
  status_socket: z.object({
    path: absolutePath,
    mode: z.union([z.literal(0o600), z.literal(0o660)]).default(0o600),
  }).strict(),
  credential_socket: z.object({
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
  setup: z.object({
    state_directory: absolutePath,
    adopt_existing_keys: z.boolean().default(false),
    key_paths: z.record(z.string(), absolutePath),
    retained_state: z.object({
      application_database: absolutePath,
      identity_store: absolutePath,
      oauth_store: absolutePath,
      vault_store: absolutePath,
      audit_store: absolutePath,
      installation_marker: absolutePath,
    }).strict(),
    identity_rotation: z.object({
      logical_root_key_id: z.string()
        .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
      database_file: absolutePath,
    }).strict().optional(),
    runtime_uid: z.number().int().min(1).max(0x7fffffff),
    runtime_gid: z.number().int().min(1).max(0x7fffffff),
    application_uid: z.number().int().min(1).max(0x7fffffff),
    application_gid: z.number().int().min(1).max(0x7fffffff),
    shared_gid: z.number().int().min(1).max(0x7fffffff),
  }).strict(),
}).strict();

export interface VaultStructuralConfig {
  version: 1;
  statusSocket: { path: string; mode: 0o600 | 0o660 };
  credentialSocket: { path: string; mode: 0o600 | 0o660 };
  storeDirectory: string;
  activeRootKey: string;
  setup: {
    stateDirectory: string;
    adoptExistingKeys: boolean;
    registry: readonly VaultProvisioningRegistryEntry[];
    retainedState: Readonly<Record<string, string>>;
    identityRotation?: {
      logicalRootKeyId: string;
      databaseFile: string;
    };
    runtimeUid: number;
    runtimeGid: number;
    applicationUid: number;
    applicationGid: number;
    sharedGid: number;
  };
  keyFiles: {
    rootKeys: Readonly<Record<string, string>>;
    callerKeys: {
      dataPlane: string;
      controlPlane: string;
      backup: string;
    };
    capabilityKeys: {
      resolve: string;
      backup: string;
    };
  };
}

export interface VaultConfig {
  version: 1;
  statusSocket: { path: string; mode: 0o600 | 0o660 };
  credentialSocket: { path: string; mode: 0o600 | 0o660 };
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
  const structural = validateVaultStructuralConfig(raw);
  try {
    return {
      version: 1,
      statusSocket: structural.statusSocket,
      credentialSocket: structural.credentialSocket,
      storeDirectory: structural.storeDirectory,
      activeRootKey: structural.activeRootKey,
      rootKeys: new Map(Object.entries(structural.keyFiles.rootKeys).map(
        ([id, path]) => [id, readVaultKeyFile(path)],
      )),
      callerKeys: {
        dataPlane: readVaultKeyFile(structural.keyFiles.callerKeys.dataPlane),
        controlPlane: readVaultKeyFile(structural.keyFiles.callerKeys.controlPlane),
        backup: readVaultKeyFile(structural.keyFiles.callerKeys.backup),
      },
      capabilityKeys: {
        resolve: readVaultKeyFile(structural.keyFiles.capabilityKeys.resolve),
        backup: readVaultKeyFile(structural.keyFiles.capabilityKeys.backup),
      },
    };
  } catch {
    throw vaultError("vault_config_invalid");
  }
}

export function loadVaultStructuralConfig(
  file: string,
): VaultStructuralConfig {
  if (!isAbsolute(file)) throw vaultError("vault_config_invalid");
  return loadYamlConfig(file, "vault config", validateVaultStructuralConfig);
}

export function validateVaultStructuralConfig(
  raw: unknown,
): VaultStructuralConfig {
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
    value.status_socket.path,
    value.credential_socket.path,
    value.store_directory,
    ...Object.values(value.root_keys),
    value.caller_keys.data_plane,
    value.caller_keys.control_plane,
    value.caller_keys.backup,
    value.capability_keys.resolve,
    value.capability_keys.backup,
  ].map(canonicalPath);
  if (new Set(paths).size !== paths.length) throw vaultError("vault_config_invalid");

  const registry = createVaultProvisioningRegistry(
    value.setup.key_paths as VaultProvisioningKeyPaths,
  );
  if (
    value.setup.application_uid !== value.setup.runtime_uid
    && (
      value.status_socket.mode !== 0o660
      || value.credential_socket.mode !== 0o660
    )
  ) throw vaultError("vault_config_invalid");
  const protectedPaths = new Set([
    canonicalPath(value.status_socket.path),
    canonicalPath(value.credential_socket.path),
    canonicalPath(value.store_directory),
    canonicalPath(value.setup.state_directory),
    ...Object.values(value.setup.retained_state).map(canonicalPath),
  ]);
  if (
    canonicalPath(value.setup.state_directory)
      === canonicalPath(value.store_directory)
    || registry.some((entry) => protectedPaths.has(entry.path))
  ) throw vaultError("vault_config_invalid");
  if (value.setup.identity_rotation !== undefined) {
    const inventoryDirectory = canonicalPath(
      value.setup.retained_state.application_database,
    );
    const databaseFile = canonicalPath(
      value.setup.identity_rotation.database_file,
    );
    const relationship = relative(inventoryDirectory, databaseFile);
    if (
      relationship.length === 0
      || relationship === ".."
      || relationship.startsWith("../")
      || isAbsolute(relationship)
      || protectedPaths.has(databaseFile)
      || paths.includes(databaseFile)
    ) throw vaultError("vault_config_invalid");
  }
  const expectedBindings: [string, string][] = [
    [value.root_keys[value.active_root_key]!, keyPath(registry, "vault.envelope-root")],
    [value.caller_keys.data_plane, keyPath(registry, "vault.caller.data-plane")],
    [value.caller_keys.control_plane, keyPath(registry, "vault.caller.control-plane")],
    [value.caller_keys.backup, keyPath(registry, "vault.caller.backup")],
    [value.capability_keys.resolve, keyPath(registry, "vault.capability.resolve")],
    [value.capability_keys.backup, keyPath(registry, "vault.capability.backup")],
    [value.store_directory, value.setup.retained_state.vault_store],
  ];
  if (expectedBindings.some(([left, right]) =>
    canonicalPath(left) !== canonicalPath(right)
  )) throw vaultError("vault_config_invalid");
  return {
    version: 1,
    statusSocket: {
      path: canonicalPath(value.status_socket.path),
      mode: value.status_socket.mode,
    },
    credentialSocket: {
      path: canonicalPath(value.credential_socket.path),
      mode: value.credential_socket.mode,
    },
    storeDirectory: canonicalPath(value.store_directory),
    activeRootKey: value.active_root_key,
    setup: {
      stateDirectory: canonicalPath(value.setup.state_directory),
      adoptExistingKeys: value.setup.adopt_existing_keys,
      registry,
      retainedState: Object.fromEntries(Object.entries(
        value.setup.retained_state,
      ).map(([id, path]) => [id, canonicalPath(path)])),
      ...(value.setup.identity_rotation === undefined
        ? {}
        : {
            identityRotation: {
              logicalRootKeyId:
                value.setup.identity_rotation.logical_root_key_id,
              databaseFile: canonicalPath(
                value.setup.identity_rotation.database_file,
              ),
            },
          }),
      runtimeUid: value.setup.runtime_uid,
      runtimeGid: value.setup.runtime_gid,
      applicationUid: value.setup.application_uid,
      applicationGid: value.setup.application_gid,
      sharedGid: value.setup.shared_gid,
    },
    keyFiles: {
      rootKeys: Object.fromEntries(Object.entries(value.root_keys).map(
        ([id, path]) => [id, canonicalPath(path)],
      )),
      callerKeys: {
        dataPlane: canonicalPath(value.caller_keys.data_plane),
        controlPlane: canonicalPath(value.caller_keys.control_plane),
        backup: canonicalPath(value.caller_keys.backup),
      },
      capabilityKeys: {
        resolve: canonicalPath(value.capability_keys.resolve),
        backup: canonicalPath(value.capability_keys.backup),
      },
    },
  };
}

function canonicalPath(value: string): string {
  return normalize(resolve(value));
}

function keyPath(
  registry: readonly VaultProvisioningRegistryEntry[],
  id: VaultProvisioningRegistryEntry["id"],
): string {
  return registry.find((entry) => entry.id === id)!.path;
}
