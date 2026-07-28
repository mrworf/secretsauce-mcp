import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  configureManifest,
  createProvisioningManifest,
  initialProvisioningManifest,
  parseManifest,
  readProvisioningManifest,
  replaceProvisioningManifest,
  verifyManifestEntry,
} from "../src/vault/provisioningManifest.js";
import {
  VAULT_PROVISIONING_KEY_IDS,
  createVaultProvisioningRegistry,
  fingerprintProvisionedKey,
  type VaultProvisioningKeyPaths,
} from "../src/vault/provisioningRegistry.js";

describe("durable vault provisioning manifest", () => {
  it("progresses every fixed entry and commits a verified aggregate", () => {
    const registry = createVaultProvisioningRegistry(paths());
    let manifest = initialProvisioningManifest(
      registry,
      "10000000-0000-4000-8000-000000000001",
    );
    expect(manifest.state).toBe("provisioning");
    expect(manifest.entries.every((entry) => entry.status === "pending"))
      .toBe(true);
    for (const entry of registry) {
      manifest = verifyManifestEntry(
        manifest,
        entry.id,
        fingerprintProvisionedKey(entry, Buffer.alloc(32, 3)),
      );
    }
    manifest = configureManifest(manifest);
    expect(manifest.state).toBe("configured");
    expect(manifest.aggregate).toMatch(/^[0-9a-f]{64}$/);
    expect(parseManifest(manifest)).toEqual(manifest);
  });

  it("rejects unknown, duplicate, incomplete, future, and checksum-drifted state", () => {
    const manifest = initialProvisioningManifest(
      createVaultProvisioningRegistry(paths()),
    );
    for (const invalid of [
      { ...manifest, unknown: true },
      { ...manifest, version: 2 },
      {
        ...manifest,
        entries: manifest.entries.map((entry, index) =>
          index === 1 ? manifest.entries[0] : entry
        ),
      },
      {
        ...manifest,
        entries: manifest.entries.map((entry, index) =>
          index === 0 ? { ...entry, consumers: ["vault"] } : entry
        ),
      },
      {
        ...manifest,
        checksum: `${manifest.checksum[0] === "0" ? "1" : "0"}${manifest.checksum.slice(1)}`,
      },
    ]) expect(() => parseManifest(invalid)).toThrow();
    expect(() => parseManifest({ ...manifest, version: 2 }))
      .toThrowError(expect.objectContaining({
        category: "unsupported_upgrade",
      }));
    expect(() => parseManifest({
      ...manifest,
      entries: manifest.entries.map((entry, index) =>
        index === 0 ? { ...entry, id: "future.key" } : entry
      ),
    })).toThrowError(expect.objectContaining({
      category: "unsupported_upgrade",
    }));
    expect(() => configureManifest(manifest)).toThrow();
  });

  it("creates without replacement and atomically replaces canonical state", () => {
    const directory = mkdtempSync(join(tmpdir(), "vault-manifest-"));
    chmodSync(directory, 0o700);
    const file = join(directory, "manifest.json");
    const registry = createVaultProvisioningRegistry(paths());
    const initial = initialProvisioningManifest(registry);
    createProvisioningManifest(file, initial);
    expect(lstatSync(file).mode & 0o777).toBe(0o600);
    expect(readProvisioningManifest(file)).toEqual(initial);
    expect(() => createProvisioningManifest(file, initial)).toThrow();

    const next = verifyManifestEntry(
      initial,
      registry[0]!.id,
      fingerprintProvisionedKey(registry[0]!, Buffer.alloc(32, 4)),
    );
    replaceProvisioningManifest(file, next);
    expect(readProvisioningManifest(file)).toEqual(next);
    const source = readFileSync(file, "utf8");
    expect(source.endsWith("\n")).toBe(true);
    expect(source).not.toContain(Buffer.alloc(32, 4).toString("base64url"));

    const unsafe = mkdtempSync(join(tmpdir(), "vault-manifest-unsafe-"));
    chmodSync(unsafe, 0o777);
    expect(() => createProvisioningManifest(
      join(unsafe, "manifest.json"),
      initial,
    )).toThrow();
  });
});

function paths(): VaultProvisioningKeyPaths {
  return Object.fromEntries(VAULT_PROVISIONING_KEY_IDS.map((id) => [
    id,
    join("/keys", id),
  ])) as VaultProvisioningKeyPaths;
}
