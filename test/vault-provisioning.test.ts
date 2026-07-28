import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createProvisioningKeyAdapters,
  pathInventoryAdapter,
  type RetainedStateClassification,
  type RetainedStateInventoryAdapter,
  type VaultProvisioningKeyAdapter,
} from "../src/vault/provisioningAdapters.js";
import {
  VaultProvisioner,
  type VaultProvisionerOptions,
} from "../src/vault/provisioning.js";
import {
  createProvisioningManifest,
  initialProvisioningManifest,
  readProvisioningManifest,
} from "../src/vault/provisioningManifest.js";
import {
  VAULT_PROVISIONING_KEY_IDS,
  createVaultProvisioningRegistry,
  type VaultProvisioningAdapterId,
  type VaultProvisioningKeyPaths,
} from "../src/vault/provisioningRegistry.js";

describe("vault provisioning state machine", () => {
  it("creates the complete manifest before keys and converges idempotently", () => {
    const fixture = setup();
    let creations = 0;
    const adapters = wrappedAdapters(fixture, {
      beforeCreate: () => {
        expect(existsSync(fixture.manifestFile)).toBe(true);
        expect(readProvisioningManifest(fixture.manifestFile).entries)
          .toHaveLength(11);
        creations += 1;
      },
    });
    const first = provisioner(fixture, { keyAdapters: adapters }).runOnce();
    expect(first.state).toBe("ready");
    expect(creations).toBe(11);
    const snapshots = fixture.registry.map((entry) =>
      readFileSync(entry.path)
    );
    const second = provisioner(fixture, { keyAdapters: adapters }).runOnce();
    expect(second.state).toBe("ready");
    expect(creations).toBe(11);
    fixture.registry.forEach((entry, index) => {
      expect(readFileSync(entry.path)).toEqual(snapshots[index]);
      snapshots[index]!.fill(0);
    });
  });

  it("resumes each pending interruption without replacing valid keys", () => {
    const fixture = setup();
    let failed = false;
    const interrupted = wrappedAdapters(fixture, {
      beforeCreate: (id) => {
        if (id === "vault.envelope-root" && !failed) {
          failed = true;
          throw new Error("injected write failure");
        }
      },
    });
    expect(provisioner(fixture, { keyAdapters: interrupted }).runOnce())
      .toMatchObject({ state: "preparing", retryPending: true });
    const retained = fixture.registry
      .filter((entry) => existsSync(entry.path))
      .map((entry) => [entry.path, readFileSync(entry.path)] as const);
    expect(retained.length).toBeGreaterThan(0);

    expect(provisioner(fixture).runOnce().state).toBe("ready");
    for (const [path, bytes] of retained) {
      expect(readFileSync(path)).toEqual(bytes);
      bytes.fill(0);
    }
  });

  it("applies the no-manifest key/adoption/retained-state matrix without prohibited writes", () => {
    for (const classification of [
      "present",
      "indeterminate",
    ] as const) {
      const fixture = setup(classification);
      const result = provisioner(fixture).runOnce();
      expect(result.state).toBe("configuration_error");
      expect(existsSync(fixture.manifestFile)).toBe(false);
      expect(fixture.registry.some((entry) => existsSync(entry.path))).toBe(false);
    }

    const partial = setup();
    createProvisioningKeyAdapters().get("symmetric-base64url-32-v1")!
      .create(partial.registry[0]!);
    expect(provisioner(partial).runOnce().state).toBe("configuration_error");
    expect(existsSync(partial.manifestFile)).toBe(false);
    expect(partial.registry.slice(1).some((entry) => existsSync(entry.path)))
      .toBe(false);

    const complete = setup();
    createAllKeys(complete);
    const before = complete.registry.map((entry) => readFileSync(entry.path));
    expect(provisioner(complete).runOnce().state).toBe("configuration_error");
    expect(existsSync(complete.manifestFile)).toBe(false);
    const adopted = provisioner(complete, { adoptExistingKeys: true }).runOnce();
    expect(adopted.state).toBe("ready");
    complete.registry.forEach((entry, index) => {
      expect(readFileSync(entry.path)).toEqual(before[index]);
      before[index]!.fill(0);
    });
  });

  it("fails closed for malformed pending and configured continuity without generating replacements", () => {
    const pending = setup();
    createProvisioningManifest(
      pending.manifestFile,
      initialProvisioningManifest(pending.registry),
    );
    writeFileSync(pending.registry[0]!.path, "malformed\n", { mode: 0o400 });
    expect(provisioner(pending).runOnce().state).toBe("configuration_error");
    expect(pending.registry.slice(1).some((entry) => existsSync(entry.path)))
      .toBe(false);

    const configured = setup();
    expect(provisioner(configured).runOnce().state).toBe("ready");
    const protectedKey = configured.registry[0]!.path;
    chmodSync(protectedKey, 0o600);
    expect(provisioner(configured).runOnce())
      .toMatchObject({ state: "configuration_error", errorCategory: "state_mismatch" });
    expect(readFileSync(protectedKey, "utf8")).not.toBe("");

    const future = setup();
    createProvisioningManifest(
      future.manifestFile,
      initialProvisioningManifest(future.registry),
    );
    const futureSource = JSON.parse(readFileSync(future.manifestFile, "utf8"));
    futureSource.version = 2;
    writeFileSync(
      future.manifestFile,
      `${JSON.stringify(futureSource)}\n`,
      { mode: 0o600 },
    );
    expect(provisioner(future).runOnce()).toMatchObject({
      state: "configuration_error",
      errorCategory: "unsupported_upgrade",
    });
  });

  it("validates real symmetric/RSA adapters and rejects noncanonical permissions", () => {
    const fixture = setup();
    createAllKeys(fixture);
    const adapters = createProvisioningKeyAdapters();
    for (const entry of fixture.registry) {
      expect(adapters.get(entry.adapter)!.validate(entry))
        .toMatch(/^[0-9a-f]{64}$/);
    }
    chmodSync(
      fixture.registry.find((entry) => entry.id === "oauth.signing")!.path,
      0o600,
    );
    expect(() => adapters.get("rsa-pkcs8-pem-v1")!.validate(
      fixture.registry.find((entry) => entry.id === "oauth.signing")!,
    )).toThrow();
  });

  it("classifies retained paths without exposing their contents", () => {
    const directory = mkdtempSync(join(tmpdir(), "vault-inventory-"));
    chmodSync(directory, 0o700);
    const absent = join(directory, "absent");
    expect(pathInventoryAdapter("absent", absent).classify())
      .toBe("absent_or_empty");
    const empty = join(directory, "empty");
    mkdirSync(empty, { mode: 0o700 });
    expect(pathInventoryAdapter("empty", empty).classify())
      .toBe("absent_or_empty");
    writeFileSync(join(empty, "record"), "protected-content");
    expect(pathInventoryAdapter("present", empty).classify()).toBe("present");
    const link = join(directory, "link");
    symlinkSync(empty, link);
    expect(pathInventoryAdapter("link", link).classify())
      .toBe("indeterminate");
  });
});

interface Fixture {
  manifestFile: string;
  registry: ReturnType<typeof createVaultProvisioningRegistry>;
  inventories: readonly RetainedStateInventoryAdapter[];
}

function setup(
  classification: RetainedStateClassification = "absent_or_empty",
): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "vault-provisioning-"));
  chmodSync(directory, 0o700);
  const keys = join(directory, "keys");
  const state = join(directory, "state");
  mkdirSync(keys, { mode: 0o700 });
  mkdirSync(state, { mode: 0o700 });
  const paths = Object.fromEntries(VAULT_PROVISIONING_KEY_IDS.map((id) => [
    id,
    join(keys, `${id}.key`),
  ])) as VaultProvisioningKeyPaths;
  return {
    manifestFile: join(state, "manifest.json"),
    registry: createVaultProvisioningRegistry(paths),
    inventories: [{
      id: "application",
      classify: () => classification,
    }],
  };
}

function provisioner(
  fixture: Fixture,
  overrides: Partial<VaultProvisionerOptions> = {},
): VaultProvisioner {
  return new VaultProvisioner({
    manifestFile: fixture.manifestFile,
    registry: fixture.registry,
    keyAdapters: createProvisioningKeyAdapters(),
    inventories: fixture.inventories,
    adoptExistingKeys: false,
    installationId: "20000000-0000-4000-8000-000000000001",
    ...overrides,
  });
}

function createAllKeys(fixture: Fixture): void {
  const adapters = createProvisioningKeyAdapters();
  for (const entry of fixture.registry) adapters.get(entry.adapter)!.create(entry);
}

function wrappedAdapters(
  fixture: Fixture,
  hooks: {
    beforeCreate?: (id: string) => void;
  },
): ReadonlyMap<VaultProvisioningAdapterId, VaultProvisioningKeyAdapter> {
  const actual = createProvisioningKeyAdapters();
  return new Map([...actual].map(([id, adapter]) => [id, {
    ...adapter,
    create: (entry) => {
      hooks.beforeCreate?.(entry.id);
      adapter.create(entry);
    },
  }]));
}
