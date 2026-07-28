import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadVaultStructuralConfig } from "../src/vault/config.js";
import { readVaultKeyFile } from "../src/vault/keyFile.js";
import {
  pathInventoryAdapter,
  createProvisioningKeyAdapters,
} from "../src/vault/provisioningAdapters.js";
import {
  readProvisioningManifest,
} from "../src/vault/provisioningManifest.js";
import { VaultProvisioner } from "../src/vault/provisioning.js";
import {
  runRootRotationMaintenance,
} from "../src/vault/rootRotationCoordinator.js";
import { VaultRecordStore } from "../src/vault/recordStore.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { UuidV7Generator } from "../src/persistence/uuidV7.js";

const REQUEST_ID = "1000000a-0000-7000-8000-000000000002";
const OTHER_REQUEST_ID = "1000000a-0000-7000-8000-000000000003";
const NOW = 1_800_000_000_000;

describe("production root rotation coordinator", () => {
  it("completes and idempotently replays a populated vault-root rotation", async () => {
    const fixture = await configuredFixture("vault-complete", true);
    const manifestBefore = readProvisioningManifest(fixture.manifestFile);
    const rootBefore = readVaultKeyFile(fixture.rootPath);
    const result = await runRootRotationMaintenance({
      config: fixture.config,
      arguments: rotationArguments("vault", REQUEST_ID),
      now: () => NOW,
    });

    expect(result).toEqual({ kind: "completed", target: "vault" });
    const manifest = readProvisioningManifest(fixture.manifestFile);
    const rootEntry = manifest.entries.find(
      (value) => value.id === "vault.envelope-root",
    )!;
    expect(manifest.entries.map((value) => value.id))
      .toEqual(manifestBefore.entries.map((value) => value.id));
    expect(rootEntry.activePhysicalVersion).toBe(REQUEST_ID);
    expect(rootEntry.fingerprint).not.toBe(
      manifestBefore.entries.find(
        (value) => value.id === "vault.envelope-root",
      )!.fingerprint,
    );
    expect(manifest.rotationReceipts).toHaveLength(1);
    expect(existsSync(fixture.journalFile)).toBe(false);

    const newRoot = readVaultKeyFile(fixture.rootPath);
    expect(newRoot).not.toEqual(rootBefore);
    const retiredPath = `${fixture.rootPath}.rotation-legacy.retired`;
    expect(readVaultKeyFile(retiredPath)).toEqual(rootBefore);
    const store = new VaultRecordStore({
      directory: fixture.storeDirectory,
      activeRootKey: "root-primary",
      rootKeys: new Map([["root-primary", newRoot]]),
    });
    expect(store.resolve(
      fixture.locator!,
      1,
      fixture.binding!,
    ).toString()).toBe("coordinator-secret");
    store.close();

    const fingerprint = rootEntry.fingerprint;
    expect(await runRootRotationMaintenance({
      config: fixture.config,
      arguments: rotationArguments("vault", REQUEST_ID),
    })).toEqual({ kind: "replayed", target: "vault" });
    expect(readProvisioningManifest(fixture.manifestFile).entries.find(
      (value) => value.id === "vault.envelope-root",
    )!.fingerprint).toBe(fingerprint);
    rootBefore.fill(0);
    newRoot.fill(0);
  });

  it("completes identity rotation while holding the application writer lock", async () => {
    const fixture = await configuredFixture("identity-complete", false);
    const phases: string[] = [];
    expect(await runRootRotationMaintenance({
      config: fixture.config,
      arguments: rotationArguments("identity", REQUEST_ID),
      now: () => NOW,
      publish: (phase) => {
        phases.push(phase);
        if (phase === "rewrapping") {
          expect(() => PersistenceWorker.open({
            databaseFile: fixture.databaseFile,
            productVersion: "test",
          })).toThrowError(expect.objectContaining({
            code: "database_unavailable",
          }));
        }
      },
    })).toEqual({ kind: "completed", target: "identity" });
    expect(phases).toEqual([
      "preflight",
      "staged",
      "rewrapping",
      "verified",
      "committed",
    ]);
    expect(readProvisioningManifest(fixture.manifestFile).entries.find(
      (value) => value.id === "identity.envelope-root",
    )!.activePhysicalVersion).toBe(REQUEST_ID);
    const reopened = PersistenceWorker.open({
      databaseFile: fixture.databaseFile,
      productVersion: "test",
    });
    await reopened.close();
  });

  it("resumes every durable coordinator boundary without a repeated command", async () => {
    for (const stage of [
      "after_journal_create",
      "after_key_stage",
      "after_activation",
      "after_rewrap_batch",
      "after_verification",
      "after_root_switch",
      "after_manifest_commit",
      "after_journal_remove",
    ] as const) {
      const fixture = await configuredFixture(`resume-${stage}`, false);
      let injected = false;
      await expect(runRootRotationMaintenance({
        config: fixture.config,
        arguments: rotationArguments("vault", REQUEST_ID),
        now: () => NOW,
        failureInjector: (actual) => {
          if (!injected && actual === stage) {
            injected = true;
            throw new Error("injected");
          }
        },
      })).rejects.toThrow();

      const resumed = await runRootRotationMaintenance({
        config: fixture.config,
        arguments: [],
        now: () => NOW + 1,
      });
      expect(["completed", "replayed", "none"]).toContain(resumed.kind);
      const manifest = readProvisioningManifest(fixture.manifestFile);
      expect(manifest.rotationReceipts).toHaveLength(1);
      expect(manifest.entries.find(
        (value) => value.id === "vault.envelope-root",
      )!.activePhysicalVersion).toBe(REQUEST_ID);
      expect(existsSync(fixture.journalFile)).toBe(false);
    }
  }, 30_000);

  it("rejects malformed and conflicting requests before another rotation", async () => {
    const fixture = await configuredFixture("invalid", false);
    const before = readProvisioningManifest(fixture.manifestFile);
    await expect(runRootRotationMaintenance({
      config: fixture.config,
      arguments: ["--rotate-root-key", "vault"],
    })).rejects.toThrow();
    expect(readProvisioningManifest(fixture.manifestFile)).toEqual(before);
    expect(existsSync(fixture.journalFile)).toBe(false);

    await runRootRotationMaintenance({
      config: fixture.config,
      arguments: rotationArguments("vault", REQUEST_ID),
    });
    await expect(runRootRotationMaintenance({
      config: fixture.config,
      arguments: rotationArguments("identity", REQUEST_ID),
    })).rejects.toThrow();
    expect(readProvisioningManifest(fixture.manifestFile).rotationReceipts)
      .toHaveLength(1);
    expect(await runRootRotationMaintenance({
      config: fixture.config,
      arguments: rotationArguments("vault", REQUEST_ID),
    })).toMatchObject({ kind: "replayed" });

    await expect(runRootRotationMaintenance({
      config: fixture.config,
      arguments: rotationArguments("unknown", OTHER_REQUEST_ID),
    })).rejects.toThrow();
  });
});

interface Fixture {
  config: ReturnType<typeof loadVaultStructuralConfig>;
  manifestFile: string;
  journalFile: string;
  rootPath: string;
  storeDirectory: string;
  databaseFile: string;
  locator?: string;
  binding?: {
    serviceId: string;
    destinationId: string;
    credentialId: string;
  };
}

async function configuredFixture(
  name: string,
  populatedVault: boolean,
): Promise<Fixture> {
  const directory = mkdtempSync(join(tmpdir(), `rotation-${name}-`));
  chmodSync(directory, 0o700);
  const keys = secureDirectory(join(directory, "keys"));
  const state = secureDirectory(join(directory, "state"));
  const storeDirectory = secureDirectory(join(directory, "store"));
  const databaseDirectory = secureDirectory(join(directory, "database"));
  const oauth = secureDirectory(join(directory, "oauth"));
  const audit = secureDirectory(join(directory, "audit"));
  const installation = secureDirectory(join(directory, "installation"));
  const keyPaths = {
    "identity.envelope-root": join(keys, "identity-root.key"),
    "identity.session-hmac": join(keys, "identity-session.key"),
    "control.idempotency-hmac": join(keys, "control-idempotency.key"),
    "oauth.signing": join(keys, "oauth-signing.pem"),
    "oauth.token-hmac": join(keys, "oauth-token.key"),
    "vault.envelope-root": join(keys, "vault-root.key"),
    "vault.caller.data-plane": join(keys, "data-plane.key"),
    "vault.caller.control-plane": join(keys, "control-plane.key"),
    "vault.caller.backup": join(keys, "backup.key"),
    "vault.capability.resolve": join(keys, "resolve.key"),
    "vault.capability.backup": join(keys, "backup-capability.key"),
  };
  const databaseFile = join(databaseDirectory, "control.sqlite");
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
    store_directory: storeDirectory,
    active_root_key: "root-primary",
    root_keys: { "root-primary": keyPaths["vault.envelope-root"] },
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
      retained_state: {
        application_database: databaseDirectory,
        identity_store: databaseDirectory,
        oauth_store: oauth,
        vault_store: storeDirectory,
        audit_store: audit,
        installation_marker: installation,
      },
      identity_rotation: {
        logical_root_key_id: "identity-primary",
        database_file: databaseFile,
      },
      runtime_uid: process.getuid?.() ?? 1000,
      runtime_gid: process.getgid?.() ?? 1000,
      application_uid: process.getuid?.() ?? 1000,
      application_gid: process.getgid?.() ?? 1000,
      shared_gid: process.getgid?.() ?? 1000,
    },
  };
  const configFile = join(directory, "vault.json");
  writeFileSync(configFile, JSON.stringify(raw), "utf8");
  const config = loadVaultStructuralConfig(configFile);
  const keyAdapters = createProvisioningKeyAdapters((entry) => ({
    uid: process.getuid?.() ?? 0,
    gid: process.getgid?.() ?? 0,
    mode: entry.consumers.length === 2 ? 0o440 : 0o400,
  }));
  const provisioner = new VaultProvisioner({
    manifestFile: join(state, "manifest.json"),
    registry: config.setup.registry,
    keyAdapters,
    inventories: Object.entries(config.setup.retainedState).map(
      ([id, path]) => pathInventoryAdapter(id, path),
    ),
    adoptExistingKeys: false,
  });
  expect(provisioner.runOnce().state).toBe("ready");

  const database = PersistenceWorker.open({
    databaseFile,
    productVersion: "test",
    now: () => NOW,
  });
  await database.close();

  let locator: string | undefined;
  let binding: Fixture["binding"];
  if (populatedVault) {
    const root = readVaultKeyFile(keyPaths["vault.envelope-root"]);
    const generator = new UuidV7Generator({ now: () => NOW });
    binding = {
      serviceId: generator.next(),
      destinationId: generator.next(),
      credentialId: generator.next(),
    };
    const store = new VaultRecordStore({
      directory: storeDirectory,
      activeRootKey: "root-primary",
      rootKeys: new Map([["root-primary", root]]),
      now: () => NOW,
    });
    locator = store.create(
      binding,
      Buffer.from("coordinator-secret"),
    ).locator;
    store.close();
    root.fill(0);
  }
  return {
    config,
    manifestFile: join(state, "manifest.json"),
    journalFile: join(state, "rotation-journal.json"),
    rootPath: keyPaths["vault.envelope-root"],
    storeDirectory,
    databaseFile,
    ...(locator === undefined ? {} : { locator }),
    ...(binding === undefined ? {} : { binding }),
  };
}

function secureDirectory(path: string): string {
  mkdirSync(path, { mode: 0o700 });
  return path;
}

function rotationArguments(
  target: string,
  requestId: string,
): string[] {
  return [
    "--rotate-root-key",
    target,
    "--rotation-request-id",
    requestId,
  ];
}
