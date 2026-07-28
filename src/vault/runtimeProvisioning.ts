import { isAbsolute } from "node:path";
import {
  createProvisioningKeyAdapters,
  type ProvisionedKeyOwnership,
} from "./provisioningAdapters.js";
import {
  readProvisioningManifest,
} from "./provisioningManifest.js";
import type {
  VaultProvisioningKeyId,
  VaultProvisioningRegistryEntry,
} from "./provisioningRegistry.js";
import {
  VAULT_PROVISIONING_REGISTRY_DEFINITION,
} from "./provisioningRegistry.js";
import { vaultError } from "./errors.js";

export function validateRuntimeProvisionedKeys(options: {
  manifestFile: string;
  registry: readonly VaultProvisioningRegistryEntry[];
  requiredIds: readonly VaultProvisioningKeyId[];
  ownership(
    entry: VaultProvisioningRegistryEntry,
  ): ProvisionedKeyOwnership;
}): void {
  if (
    options.requiredIds.length < 1
    || new Set(options.requiredIds).size !== options.requiredIds.length
    || new Set(options.registry.map((entry) => entry.id)).size
      !== options.registry.length
  ) throw vaultError("vault_config_invalid");
  const manifest = readProvisioningManifest(options.manifestFile);
  if (manifest.state !== "configured") {
    throw vaultError("vault_config_invalid");
  }
  const adapters = createProvisioningKeyAdapters(options.ownership);
  for (const id of options.requiredIds) {
    const registryEntry = options.registry.find((entry) => entry.id === id);
    const manifestEntry = manifest.entries.find((entry) => entry.id === id);
    if (
      registryEntry === undefined
      || manifestEntry === undefined
      || manifestEntry.status !== "verified"
      || manifestEntry.fingerprint === undefined
    ) throw vaultError("vault_config_invalid");
    let actual: string;
    try {
      actual = adapters.get(registryEntry.adapter)!.validate(registryEntry);
    } catch {
      throw vaultError("vault_config_invalid");
    }
    if (actual !== manifestEntry.fingerprint) {
      throw vaultError("vault_config_invalid");
    }
  }
}

export function validateAssignedRuntimeProvisionedKeys(
  environment: NodeJS.ProcessEnv,
  assignments: readonly {
    id: VaultProvisioningKeyId;
    path: string;
  }[],
): void {
  const manifestFile = environment.SECRETSAUCE_VAULT_MANIFEST_FILE;
  const sharedGidText = environment.SECRETSAUCE_VAULT_SHARED_GID;
  const ownerUidText = environment.SECRETSAUCE_VAULT_KEY_OWNER_UID;
  if (
    manifestFile === undefined
    && sharedGidText === undefined
    && ownerUidText === undefined
  ) return;
  if (
    manifestFile === undefined
    || sharedGidText === undefined
    || ownerUidText === undefined
  ) throw vaultError("vault_config_invalid");
  const sharedGid = parseIdentifier(sharedGidText);
  const ownerUid = parseIdentifier(ownerUidText);
  if (
    assignments.length < 1
    || assignments.length > VAULT_PROVISIONING_REGISTRY_DEFINITION.length
    || new Set(assignments.map((entry) => entry.id)).size !== assignments.length
    || assignments.some((entry) =>
      !isAbsolute(entry.path) || entry.path.includes("\0")
    )
  ) throw vaultError("vault_config_invalid");
  const registry = assignments.map(({ id, path }) => {
    const definition = VAULT_PROVISIONING_REGISTRY_DEFINITION.find(
      (entry) => entry.id === id,
    );
    if (
      definition === undefined
      || !definition.consumers.includes("application")
      || !definition.consumers.includes("vault")
    ) throw vaultError("vault_config_invalid");
    return { ...definition, path };
  });
  validateRuntimeProvisionedKeys({
    manifestFile,
    registry,
    requiredIds: assignments.map((entry) => entry.id),
    ownership: () => ({ uid: ownerUid, gid: sharedGid, mode: 0o440 }),
  });
}

function parseIdentifier(value: string): number {
  if (!/^(0|[1-9][0-9]{0,9})$/.test(value)) {
    throw vaultError("vault_config_invalid");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0x7fffffff) {
    throw vaultError("vault_config_invalid");
  }
  return parsed;
}
