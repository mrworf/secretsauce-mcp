import { createHash } from "node:crypto";
import { isAbsolute, normalize, resolve } from "node:path";
import { vaultError } from "./errors.js";

export const VAULT_PROVISIONING_KEY_IDS = [
  "identity.envelope-root",
  "identity.session-hmac",
  "control.idempotency-hmac",
  "oauth.signing",
  "oauth.token-hmac",
  "vault.envelope-root",
  "vault.caller.data-plane",
  "vault.caller.control-plane",
  "vault.caller.backup",
  "vault.capability.resolve",
  "vault.capability.backup",
] as const;

export type VaultProvisioningKeyId =
  typeof VAULT_PROVISIONING_KEY_IDS[number];
export type VaultProvisioningAdapterId =
  | "symmetric-base64url-32-v1"
  | "rsa-pkcs8-pem-v1";

export interface VaultProvisioningRegistryEntry {
  id: VaultProvisioningKeyId;
  adapter: VaultProvisioningAdapterId;
  formatVersion: 1;
  consumers: readonly ("application" | "vault")[];
  path: string;
}

export type VaultProvisioningKeyPaths = Readonly<
  Record<VaultProvisioningKeyId, string>
>;

export const VAULT_PROVISIONING_REGISTRY_DEFINITION: readonly Omit<
  VaultProvisioningRegistryEntry,
  "path"
>[] = [
  entry("identity.envelope-root", "symmetric-base64url-32-v1", ["application"]),
  entry("identity.session-hmac", "symmetric-base64url-32-v1", ["application"]),
  entry("control.idempotency-hmac", "symmetric-base64url-32-v1", ["application"]),
  entry("oauth.signing", "rsa-pkcs8-pem-v1", ["application"]),
  entry("oauth.token-hmac", "symmetric-base64url-32-v1", ["application"]),
  entry("vault.envelope-root", "symmetric-base64url-32-v1", ["vault"]),
  entry("vault.caller.data-plane", "symmetric-base64url-32-v1", ["application", "vault"]),
  entry("vault.caller.control-plane", "symmetric-base64url-32-v1", ["application", "vault"]),
  entry("vault.caller.backup", "symmetric-base64url-32-v1", ["application", "vault"]),
  entry("vault.capability.resolve", "symmetric-base64url-32-v1", ["application", "vault"]),
  entry("vault.capability.backup", "symmetric-base64url-32-v1", ["application", "vault"]),
] as const;

export function createVaultProvisioningRegistry(
  paths: VaultProvisioningKeyPaths,
): readonly VaultProvisioningRegistryEntry[] {
  const supplied = Object.keys(paths).sort();
  const expected = [...VAULT_PROVISIONING_KEY_IDS].sort();
  if (
    supplied.length !== expected.length
    || supplied.some((value, index) => value !== expected[index])
  ) throw vaultError("vault_config_invalid");
  const seenPaths = new Set<string>();
  return VAULT_PROVISIONING_REGISTRY_DEFINITION.map((definition) => {
    const configured = paths[definition.id];
    if (
      typeof configured !== "string"
      || !isAbsolute(configured)
      || configured.includes("\0")
    ) throw vaultError("vault_config_invalid");
    const path = normalize(resolve(configured));
    if (seenPaths.has(path)) throw vaultError("vault_config_invalid");
    seenPaths.add(path);
    return Object.freeze({ ...definition, path });
  });
}

export function fingerprintProvisionedKey(
  entryValue: Pick<
    VaultProvisioningRegistryEntry,
    "id" | "adapter" | "formatVersion"
  >,
  canonicalKeyBytes: Uint8Array,
): string {
  if (canonicalKeyBytes.byteLength < 1 || canonicalKeyBytes.byteLength > 16_384) {
    throw vaultError("vault_key_invalid");
  }
  return createHash("sha256")
    .update("secretsauce:provisioned-key-fingerprint:v1\0")
    .update(entryValue.id)
    .update("\0")
    .update(entryValue.adapter)
    .update("\0")
    .update(String(entryValue.formatVersion))
    .update("\0")
    .update(canonicalKeyBytes)
    .digest("hex");
}

export function aggregateProvisionedKeys(
  entries: readonly {
    id: VaultProvisioningKeyId;
    adapter: VaultProvisioningAdapterId;
    formatVersion: 1;
    fingerprint: string;
  }[],
): string {
  if (entries.length !== VAULT_PROVISIONING_KEY_IDS.length) {
    throw vaultError("vault_config_invalid");
  }
  const sorted = [...entries].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  if (
    new Set(sorted.map((value) => value.id)).size !== sorted.length
    || sorted.some((value) =>
      !VAULT_PROVISIONING_KEY_IDS.includes(value.id)
      || !/^[0-9a-f]{64}$/.test(value.fingerprint)
    )
  ) throw vaultError("vault_config_invalid");
  const hash = createHash("sha256")
    .update("secretsauce:provisioned-key-aggregate:v1\0");
  for (const value of sorted) {
    hash
      .update(value.id)
      .update("\0")
      .update(value.adapter)
      .update("\0")
      .update(String(value.formatVersion))
      .update("\0")
      .update(value.fingerprint)
      .update("\0");
  }
  return hash.digest("hex");
}

function entry(
  id: VaultProvisioningKeyId,
  adapter: VaultProvisioningAdapterId,
  consumers: readonly ("application" | "vault")[],
): Omit<VaultProvisioningRegistryEntry, "path"> {
  return Object.freeze({
    id,
    adapter,
    formatVersion: 1,
    consumers: Object.freeze([...consumers]),
  });
}
