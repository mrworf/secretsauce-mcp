import { lstatSync } from "node:fs";
import { join } from "node:path";
import {
  IdentityRootRotationAdapter,
  preflightIdentityRootStore,
} from "../identity/rootRotation.js";
import { PersistenceWorker } from "../persistence/worker.js";
import type { VaultStructuralConfig } from "./config.js";
import { vaultError } from "./errors.js";
import {
  createProvisioningKeyAdapters,
  readProvisionedSymmetricKey,
  type ProvisionedKeyOwnership,
  type VaultProvisioningKeyAdapter,
} from "./provisioningAdapters.js";
import {
  commitManifestRootRotation,
  readProvisioningManifest,
  replaceProvisioningManifest,
  type VaultProvisioningManifest,
} from "./provisioningManifest.js";
import type {
  VaultProvisioningRegistryEntry,
} from "./provisioningRegistry.js";
import {
  advanceRootRotationJournal,
  archivedRootPath,
  initialRootRotationJournal,
  parseRootRotationArguments,
  rootRotationDisposition,
  RootRotationJournalStore,
  stageRootRotationKey,
  stagedRootPath,
  switchRootPhysicalVersion,
  type RootRotationJournal,
} from "./rootRotation.js";
import {
  VaultRecordRootRotationAdapter,
  preflightVaultRecordRoot,
} from "./recordStore.js";

const ROTATION_BATCH_SIZE = 100;

export interface RootRotationMaintenanceResult {
  kind: "none" | "completed" | "replayed";
  target?: "identity" | "vault";
}

export interface RootRotationMaintenanceOptions {
  config: VaultStructuralConfig;
  arguments: readonly string[];
  now?: () => number;
  publish?: (phase:
    | "preflight"
    | "staged"
    | "rewrapping"
    | "verified"
    | "committed"
    | "replayed"
  ) => void;
  failureInjector?: (stage:
    | "after_journal_create"
    | "after_key_stage"
    | "after_activation"
    | "after_rewrap_batch"
    | "after_verification"
    | "after_root_switch"
    | "after_manifest_commit"
    | "after_journal_remove"
  ) => void;
}

export async function runRootRotationMaintenance(
  options: RootRotationMaintenanceOptions,
): Promise<RootRotationMaintenanceResult> {
  const request = parseRootRotationArguments(options.arguments);
  const manifestFile = join(options.config.setup.stateDirectory, "manifest.json");
  const journalStore = new RootRotationJournalStore(join(
    options.config.setup.stateDirectory,
    "rotation-journal.json",
  ));
  const manifest = readProvisioningManifest(manifestFile);
  const journal = journalStore.exists() ? journalStore.read() : undefined;
  const disposition = rootRotationDisposition(manifest, request, journal);
  if (disposition.kind === "none") return { kind: "none" };
  if (disposition.kind === "completed") {
    if (journal !== undefined) journalStore.remove();
    options.publish?.("replayed");
    return { kind: "replayed", target: disposition.request.target };
  }

  const target = disposition.kind === "new"
    ? disposition.request.target
    : disposition.journal.target;
  const keyId = target === "identity"
    ? "identity.envelope-root"
    : "vault.envelope-root";
  const registryEntry = options.config.setup.registry.find(
    (value) => value.id === keyId,
  );
  const manifestEntry = manifest.entries.find((value) => value.id === keyId);
  if (
    registryEntry === undefined
    || manifestEntry?.status !== "verified"
    || manifestEntry.fingerprint === undefined
  ) throw vaultError("vault_config_invalid");
  const ownership = keyOwnership(options.config, registryEntry);
  const adapters = createProvisioningKeyAdapters(
    (entry) => keyOwnership(options.config, entry),
  );
  const keyAdapter = adapters.get(registryEntry.adapter)!;
  validateNonTargetKeys(
    options.config,
    manifest,
    keyId,
    adapters,
  );
  options.publish?.("preflight");

  let current = disposition.kind === "resume"
    ? disposition.journal
    : undefined;
  let identityOwner: PersistenceWorker | undefined;
  let identityAdapter: IdentityRootRotationAdapter | undefined;
  let vaultAdapter: VaultRecordRootRotationAdapter | undefined;
  let oldRoot: Buffer | undefined;
  let newRoot: Buffer | undefined;
  try {
    if (
      current !== undefined
      && ["staged", "activated", "rewrapping"].includes(current.phase)
    ) {
      assertConfiguredFingerprint(
        registryEntry,
        keyAdapter,
        current.oldFingerprint,
      );
      assertPathFingerprint(
        { ...registryEntry, path: stagedRootPath(current) },
        keyAdapter,
        current.stagedFingerprint!,
      );
    }
    if (current?.phase === "root_switched") {
      assertConfiguredFingerprint(
        registryEntry,
        keyAdapter,
        current.stagedFingerprint!,
      );
      assertPathFingerprint(
        { ...registryEntry, path: archivedRootPath(current) },
        keyAdapter,
        current.oldFingerprint,
      );
    }
    if (current === undefined || current.phase === "created") {
      assertConfiguredFingerprint(
        registryEntry,
        keyAdapter,
        manifestEntry.fingerprint,
      );
      oldRoot = readProvisionedSymmetricKey(registryEntry, ownership);
      if (target === "identity") {
        const identity = requireIdentityConfig(options.config);
        assertExistingDatabase(identity.databaseFile);
        identityOwner = PersistenceWorker.open({
          databaseFile: identity.databaseFile,
          productVersion: "2.1-root-rotation",
        });
        await preflightIdentityRootStore(
          identityOwner,
          identity.logicalRootKeyId,
          oldRoot,
        );
      } else {
        preflightVaultStore(
          options.config,
          oldRoot,
        );
      }
    }

    if (current === undefined) {
      current = initialRootRotationJournal(
        manifest,
        disposition.kind === "new"
          ? disposition.request
          : unreachable(),
        registryEntry.path,
      );
      journalStore.create(current);
      options.failureInjector?.("after_journal_create");
    }

    if (current.phase === "created") {
      current = stageRootRotationKey(current, registryEntry, keyAdapter);
      journalStore.replace(current);
      options.failureInjector?.("after_key_stage");
      options.publish?.("staged");
    }

    if (["staged", "activated", "rewrapping"].includes(current.phase)) {
      oldRoot ??= readProvisionedSymmetricKey(registryEntry, ownership);
      newRoot = readProvisionedSymmetricKey(
        { ...registryEntry, path: stagedRootPath(current) },
        ownership,
      );
      if (target === "identity") {
        const identity = requireIdentityConfig(options.config);
        if (identityOwner === undefined) {
          assertExistingDatabase(identity.databaseFile);
          identityOwner = PersistenceWorker.open({
            databaseFile: identity.databaseFile,
            productVersion: "2.1-root-rotation",
          });
        }
        identityAdapter = IdentityRootRotationAdapter.attach(identityOwner, {
          logicalRootKeyId: identity.logicalRootKeyId,
          oldRoot,
          newRoot,
        });
        identityOwner = undefined;
        await identityAdapter.preflight();
      } else {
        vaultAdapter = new VaultRecordRootRotationAdapter({
          directory: options.config.storeDirectory,
          logicalRootKeyId: options.config.activeRootKey,
          oldRoot,
          newRoot,
        });
        vaultAdapter.preflight();
      }
    }

    if (current.phase === "staged") {
      current = advanceRootRotationJournal(current, { phase: "activated" });
      journalStore.replace(current);
      options.failureInjector?.("after_activation");
    }
    if (current.phase === "activated") {
      current = advanceRootRotationJournal(current, { phase: "rewrapping" });
      journalStore.replace(current);
      options.publish?.("rewrapping");
    }
    if (current.phase === "rewrapping") {
      while (true) {
        const batch = target === "identity"
          ? await identityAdapter!.rewrapBatch(
              current.cursor,
              ROTATION_BATCH_SIZE,
            )
          : vaultAdapter!.rewrapBatch(
              current.cursor,
              ROTATION_BATCH_SIZE,
            );
        current = advanceRootRotationJournal(current, {
          phase: "rewrapping",
          cursor: batch.cursor ?? null,
          scannedCount: safeAdd(current.scannedCount, batch.scannedCount),
          rewrappedCount: safeAdd(
            current.rewrappedCount,
            batch.rewrappedCount,
          ),
        });
        journalStore.replace(current);
        options.failureInjector?.("after_rewrap_batch");
        if (batch.cursor === undefined) break;
      }
      if (target === "identity") await identityAdapter!.verifyZero();
      else vaultAdapter!.verifyZero();
      current = advanceRootRotationJournal(current, { phase: "verified" });
      journalStore.replace(current);
      options.failureInjector?.("after_verification");
      options.publish?.("verified");
    }

    await identityAdapter?.close();
    identityAdapter = undefined;
    vaultAdapter?.close();
    vaultAdapter = undefined;

    if (current.phase === "verified") {
      current = switchRootPhysicalVersion(
        current,
        registryEntry,
        keyAdapter,
      );
      journalStore.replace(current);
      options.failureInjector?.("after_root_switch");
    }
    if (current.phase !== "root_switched") {
      throw vaultError("vault_config_invalid");
    }
    const completed = commitManifestRootRotation(manifest, {
      requestId: current.requestId,
      target: current.target,
      startingAggregate: current.startingAggregate,
      oldPhysicalVersion: current.oldPhysicalVersion,
      newPhysicalVersion: current.newPhysicalVersion,
      fingerprint: current.stagedFingerprint!,
      completedAt: safeTimestamp(options.now?.() ?? Date.now()),
    });
    replaceProvisioningManifest(manifestFile, completed);
    options.failureInjector?.("after_manifest_commit");
    journalStore.remove();
    options.failureInjector?.("after_journal_remove");
    options.publish?.("committed");
    return { kind: "completed", target };
  } finally {
    await identityAdapter?.close();
    await identityOwner?.close();
    vaultAdapter?.close();
    oldRoot?.fill(0);
    newRoot?.fill(0);
  }
}

function validateNonTargetKeys(
  config: VaultStructuralConfig,
  manifest: VaultProvisioningManifest,
  targetId: VaultProvisioningRegistryEntry["id"],
  adapters: ReadonlyMap<string, VaultProvisioningKeyAdapter>,
): void {
  for (const entry of config.setup.registry) {
    if (entry.id === targetId) continue;
    const expected = manifest.entries.find((value) => value.id === entry.id);
    if (
      expected?.status !== "verified"
      || expected.fingerprint === undefined
      || adapters.get(entry.adapter)?.validate(entry) !== expected.fingerprint
    ) throw vaultError("vault_config_invalid");
  }
}

function assertConfiguredFingerprint(
  entry: VaultProvisioningRegistryEntry,
  adapter: VaultProvisioningKeyAdapter,
  expected: string,
): void {
  if (adapter.validate(entry) !== expected) {
    throw vaultError("vault_config_invalid");
  }
}

function assertPathFingerprint(
  entry: VaultProvisioningRegistryEntry,
  adapter: VaultProvisioningKeyAdapter,
  expected: string,
): void {
  if (adapter.validate(entry) !== expected) {
    throw vaultError("vault_config_invalid");
  }
}

function keyOwnership(
  config: VaultStructuralConfig,
  entry: VaultProvisioningRegistryEntry,
): ProvisionedKeyOwnership {
  if (entry.consumers.length === 2) {
    return {
      uid: process.getuid?.() === 0 ? 0 : config.setup.runtimeUid,
      gid: config.setup.sharedGid,
      mode: 0o440,
    };
  }
  return entry.consumers[0] === "application"
    ? {
        uid: config.setup.applicationUid,
        gid: config.setup.applicationGid,
        mode: 0o400,
      }
    : {
        uid: config.setup.runtimeUid,
        gid: config.setup.runtimeGid,
        mode: 0o400,
      };
}

function requireIdentityConfig(config: VaultStructuralConfig): {
  logicalRootKeyId: string;
  databaseFile: string;
} {
  if (config.setup.identityRotation === undefined) {
    throw vaultError("vault_config_invalid");
  }
  return config.setup.identityRotation;
}

function assertExistingDatabase(file: string): void {
  try {
    const metadata = lstatSync(file);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error("invalid");
    }
  } catch {
    throw vaultError("vault_config_invalid");
  }
}

function preflightVaultStore(
  config: VaultStructuralConfig,
  oldRoot: Buffer,
): void {
  try {
    preflightVaultRecordRoot(
      config.storeDirectory,
      config.activeRootKey,
      oldRoot,
    );
  } catch {
    throw vaultError("vault_config_invalid");
  }
}

function safeTimestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw vaultError("vault_config_invalid");
  }
  return value;
}

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw vaultError("vault_config_invalid");
  return result;
}

function unreachable(): never {
  throw vaultError("vault_config_invalid");
}
