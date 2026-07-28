import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VAULT_PROVISIONING_KEY_IDS,
  aggregateProvisionedKeys,
  createVaultProvisioningRegistry,
  fingerprintProvisionedKey,
  type VaultProvisioningKeyPaths,
} from "../src/vault/provisioningRegistry.js";

describe("fixed vault provisioning registry", () => {
  it("contains the exact feature-independent v2.1 identities and adapters", () => {
    const registry = createVaultProvisioningRegistry(paths());
    expect(registry.map((entry) => entry.id)).toEqual([
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
    ]);
    expect(registry).toHaveLength(11);
    expect(registry.find((entry) => entry.id === "oauth.signing")?.adapter)
      .toBe("rsa-pkcs8-pem-v1");
    expect(registry.filter((entry) =>
      entry.adapter === "symmetric-base64url-32-v1"
    )).toHaveLength(10);
  });

  it("rejects missing, unknown, relative, NUL, and colliding paths", () => {
    const missing = paths() as Record<string, string>;
    delete missing["oauth.signing"];
    expect(() => createVaultProvisioningRegistry(
      missing as VaultProvisioningKeyPaths,
    )).toThrow();

    const unknown = { ...paths(), "future.key": "/keys/future" };
    expect(() => createVaultProvisioningRegistry(
      unknown as VaultProvisioningKeyPaths,
    )).toThrow();

    for (const invalid of ["relative.key", "/keys/bad\0key"]) {
      expect(() => createVaultProvisioningRegistry({
        ...paths(),
        "oauth.token-hmac": invalid,
      })).toThrow();
    }
    expect(() => createVaultProvisioningRegistry({
      ...paths(),
      "oauth.token-hmac": paths()["identity.session-hmac"],
    })).toThrow();
  });

  it("domain-separates fingerprints and canonical aggregate commitments", () => {
    const registry = createVaultProvisioningRegistry(paths());
    const key = Buffer.alloc(32, 7);
    const fingerprints = registry.map((entry) => ({
      ...entry,
      fingerprint: fingerprintProvisionedKey(entry, key),
    }));
    expect(new Set(fingerprints.map((value) => value.fingerprint)).size)
      .toBe(registry.length);
    const aggregate = aggregateProvisionedKeys(fingerprints);
    expect(aggregate).toMatch(/^[0-9a-f]{64}$/);
    expect(aggregateProvisionedKeys([...fingerprints].reverse()))
      .toBe(aggregate);
    expect(JSON.stringify({ fingerprints, aggregate }))
      .not.toContain(key.toString("base64url"));
    key.fill(0);
  });
});

function paths(): VaultProvisioningKeyPaths {
  return Object.fromEntries(VAULT_PROVISIONING_KEY_IDS.map((id) => [
    id,
    join("/keys", id),
  ])) as VaultProvisioningKeyPaths;
}
