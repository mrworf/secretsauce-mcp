import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProvisioningKeyAdapters } from "../src/vault/provisioningAdapters.js";
import {
  commitManifestRootRotation,
  configureManifest,
  initialProvisioningManifest,
  parseManifest,
  verifyManifestEntry,
  type VaultProvisioningManifest,
} from "../src/vault/provisioningManifest.js";
import {
  createVaultProvisioningRegistry,
  fingerprintProvisionedKey,
  VAULT_PROVISIONING_KEY_IDS,
  type VaultProvisioningKeyPaths,
} from "../src/vault/provisioningRegistry.js";
import {
  advanceRootRotationJournal,
  archivedRootPath,
  initialRootRotationJournal,
  parseRootRotationArguments,
  parseRootRotationJournal,
  rootRotationDisposition,
  RootRotationJournalStore,
  stagedRootPath,
  stageRootRotationKey,
  switchRootPhysicalVersion,
} from "../src/vault/rootRotation.js";

const INSTALLATION_ID = "10000000-0000-4000-8000-000000000001";
const REQUEST_ID = "1000000a-0000-7000-8000-000000000002";
const OTHER_REQUEST_ID = "10000000-0000-4000-8000-000000000003";

describe("root rotation command boundary", () => {
  it("accepts only the exact explicit command grammar", () => {
    expect(parseRootRotationArguments([])).toBeUndefined();
    expect(parseRootRotationArguments([
      "--rotate-root-key",
      "identity",
      "--rotation-request-id",
      REQUEST_ID,
    ])).toEqual({ target: "identity", requestId: REQUEST_ID });
    expect(parseRootRotationArguments([
      "--rotate-root-key",
      "vault",
      "--rotation-request-id",
      OTHER_REQUEST_ID,
    ])).toEqual({ target: "vault", requestId: OTHER_REQUEST_ID });

    for (const invalid of [
      ["--rotate-root-key", "identity"],
      [
        "--rotation-request-id",
        REQUEST_ID,
        "--rotate-root-key",
        "identity",
      ],
      [
        "--rotate-root-key",
        "unknown",
        "--rotation-request-id",
        REQUEST_ID,
      ],
      [
        "--rotate-root-key",
        "identity",
        "--rotation-request-id",
        REQUEST_ID.toUpperCase(),
      ],
      [
        "--rotate-root-key",
        "identity",
        "--rotation-request-id",
        "10000000-0000-7000-7000-000000000002",
      ],
      [
        "--rotate-root-key",
        "identity",
        "--rotation-request-id",
        REQUEST_ID,
        "--extra",
      ],
    ]) expect(() => parseRootRotationArguments(invalid)).toThrow();
  });

  it("selects new, resumable, and completed work without ambiguity", () => {
    const manifest = configuredManifest(paths());
    const request = { target: "identity" as const, requestId: REQUEST_ID };
    const journal = initialRootRotationJournal(
      manifest,
      request,
      "/keys/identity.envelope-root",
    );

    expect(rootRotationDisposition(manifest, undefined, undefined))
      .toEqual({ kind: "none" });
    expect(rootRotationDisposition(manifest, request, undefined))
      .toEqual({ kind: "new", request });
    expect(rootRotationDisposition(manifest, undefined, journal))
      .toEqual({ kind: "resume", journal });
    expect(() => rootRotationDisposition(
      manifest,
      { ...request, requestId: OTHER_REQUEST_ID },
      journal,
    )).toThrow();

    let completedJournal = advanceRootRotationJournal(journal, {
      phase: "staged",
      stagedFingerprint: "a".repeat(64),
    });
    for (const phase of [
      "activated",
      "rewrapping",
      "verified",
      "root_switched",
    ] as const) {
      completedJournal = advanceRootRotationJournal(
        completedJournal,
        { phase },
      );
    }
    const completed = commitManifestRootRotation(manifest, {
      requestId: REQUEST_ID,
      target: "identity",
      startingAggregate: manifest.aggregate!,
      oldPhysicalVersion: "legacy",
      newPhysicalVersion: REQUEST_ID,
      fingerprint: "a".repeat(64),
      completedAt: 42,
    });
    expect(rootRotationDisposition(
      completed,
      request,
      completedJournal,
    )).toEqual({
      kind: "completed",
      request,
    });
    expect(rootRotationDisposition(
      completed,
      undefined,
      completedJournal,
    )).toEqual({
      kind: "completed",
      request,
    });
    expect(() => rootRotationDisposition(
      completed,
      { target: "vault", requestId: REQUEST_ID },
      undefined,
    )).toThrow();
  });
});

describe("durable root rotation journal", () => {
  it("creates, advances, replaces, and reads canonical mode-0600 state", () => {
    const directory = secureTempDirectory("root-rotation-journal-");
    const file = join(directory, "rotation.json");
    const manifest = configuredManifest(paths());
    const journal = initialRootRotationJournal(
      manifest,
      { target: "vault", requestId: REQUEST_ID },
      "/keys/vault.envelope-root",
    );
    const store = new RootRotationJournalStore(file);

    expect(journal.oldPhysicalVersion).toBe("legacy");
    expect(journal.newPhysicalVersion).toBe(REQUEST_ID);
    expect(journal.phase).toBe("created");
    store.create(journal);
    expect(store.exists()).toBe(true);
    expect(lstatSync(file).mode & 0o777).toBe(0o600);
    expect(store.read()).toEqual(journal);
    expect(() => store.create(journal)).toThrow();

    const staged = advanceRootRotationJournal(journal, {
      phase: "staged",
      stagedFingerprint: "b".repeat(64),
    });
    store.replace(staged);
    expect(store.read()).toEqual(staged);
    expect(() => advanceRootRotationJournal(staged, {
      phase: "verified",
    })).toThrow();
    expect(() => advanceRootRotationJournal(staged, {
      phase: "staged",
    })).toThrow();
  });

  it("rejects tampering, noncanonical files, symlinks, and unsafe parents", () => {
    const directory = secureTempDirectory("root-rotation-invalid-");
    const file = join(directory, "rotation.json");
    const journal = initialRootRotationJournal(
      configuredManifest(paths()),
      { target: "vault", requestId: REQUEST_ID },
      "/keys/vault.envelope-root",
    );
    const store = new RootRotationJournalStore(file);
    store.create(journal);

    const source = readFileSync(file, "utf8");
    writeFileSync(
      file,
      source.replace(
        journal.checksum,
        `${journal.checksum.slice(0, -1)}${
          journal.checksum.endsWith("0") ? "1" : "0"
        }`,
      ),
      { mode: 0o600 },
    );
    expect(() => store.read()).toThrow();
    writeFileSync(file, `${JSON.stringify(journal, null, 2)}\n`, {
      mode: 0o600,
    });
    expect(() => store.read()).toThrow();

    const link = join(directory, "link.json");
    symlinkSync(file, link);
    expect(() => new RootRotationJournalStore(link).read()).toThrow();

    const unsafe = mkdtempSync(join(tmpdir(), "root-rotation-unsafe-"));
    chmodSync(unsafe, 0o777);
    expect(() => new RootRotationJournalStore(
      join(unsafe, "rotation.json"),
    ).create(journal)).toThrow();
  });

  it("preserves the prior journal when replacement fails before commit", () => {
    const directory = secureTempDirectory("root-rotation-atomic-");
    const file = join(directory, "rotation.json");
    const journal = initialRootRotationJournal(
      configuredManifest(paths()),
      { target: "vault", requestId: REQUEST_ID },
      "/keys/vault.envelope-root",
    );
    new RootRotationJournalStore(file).create(journal);
    const staged = advanceRootRotationJournal(journal, {
      phase: "staged",
      stagedFingerprint: "c".repeat(64),
    });
    const failing = new RootRotationJournalStore(file, () => {
      throw new Error("injected");
    });
    expect(() => failing.replace(staged)).toThrow();
    expect(new RootRotationJournalStore(file).read()).toEqual(journal);
  });
});

describe("root key staging and manifest receipt", () => {
  it("stages a new physical key without replacing the configured root", () => {
    const directory = secureTempDirectory("root-rotation-key-");
    const keyPaths = paths(directory);
    const registry = createVaultProvisioningRegistry(keyPaths);
    const entry = registry.find(
      (value) => value.id === "vault.envelope-root",
    )!;
    const adapter = createProvisioningKeyAdapters().get(entry.adapter)!;
    adapter.create(entry);
    const original = readFileSync(entry.path);
    const manifest = configuredManifest(keyPaths);
    const journal = initialRootRotationJournal(
      manifest,
      { target: "vault", requestId: REQUEST_ID },
      entry.path,
    );

    const staged = stageRootRotationKey(journal, entry, adapter);
    expect(staged.phase).toBe("staged");
    expect(staged.stagedFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(entry.path)).toEqual(original);
    expect(lstatSync(stagedRootPath(staged)).mode & 0o777).toBe(0o400);
    expect(() => stageRootRotationKey(journal, entry, adapter)).toThrow();
  });

  it("resumes every no-replace physical root switch boundary", () => {
    for (const failureStage of [
      "after_archive_link",
      "after_configured_unlink",
      "after_configured_link",
      "after_staged_unlink",
    ] as const) {
      const directory = secureTempDirectory(`root-switch-${failureStage}-`);
      const keyPaths = paths(directory);
      const registry = createVaultProvisioningRegistry(keyPaths);
      const entry = registry.find(
        (value) => value.id === "vault.envelope-root",
      )!;
      const adapter = createProvisioningKeyAdapters().get(entry.adapter)!;
      adapter.create(entry);
      const oldFingerprint = adapter.validate(entry);
      const manifest = configuredManifest(keyPaths, {
        "vault.envelope-root": oldFingerprint,
      });
      let journal = initialRootRotationJournal(
        manifest,
        { target: "vault", requestId: REQUEST_ID },
        entry.path,
      );
      journal = stageRootRotationKey(journal, entry, adapter);
      for (const phase of [
        "activated",
        "rewrapping",
        "verified",
      ] as const) {
        journal = advanceRootRotationJournal(journal, { phase });
      }
      let injected = false;
      expect(() => switchRootPhysicalVersion(
        journal,
        entry,
        adapter,
        (stage) => {
          if (!injected && stage === failureStage) {
            injected = true;
            throw new Error("injected");
          }
        },
      )).toThrow();

      const switched = switchRootPhysicalVersion(journal, entry, adapter);
      expect(switched.phase).toBe("root_switched");
      expect(adapter.validate(entry)).toBe(journal.stagedFingerprint);
      expect(adapter.validate({
        ...entry,
        path: archivedRootPath(journal),
      })).toBe(oldFingerprint);
      expect(existsSync(stagedRootPath(journal))).toBe(false);
    }
  });

  it("atomically records the physical version, fingerprint, and receipt", () => {
    const manifest = configuredManifest(paths());
    const beforeIds = manifest.entries.map((value) => value.id);
    const completed = commitManifestRootRotation(manifest, {
      requestId: REQUEST_ID,
      target: "identity",
      startingAggregate: manifest.aggregate!,
      oldPhysicalVersion: "legacy",
      newPhysicalVersion: REQUEST_ID,
      fingerprint: "d".repeat(64),
      completedAt: 123,
    });
    const entry = completed.entries.find(
      (value) => value.id === "identity.envelope-root",
    )!;

    expect(completed.entries.map((value) => value.id)).toEqual(beforeIds);
    expect(entry.activePhysicalVersion).toBe(REQUEST_ID);
    expect(entry.fingerprint).toBe("d".repeat(64));
    expect(completed.aggregate).not.toBe(manifest.aggregate);
    expect(completed.rotationReceipts).toEqual([{
      requestId: REQUEST_ID,
      target: "identity",
      oldPhysicalVersion: "legacy",
      newPhysicalVersion: REQUEST_ID,
      completedAt: 123,
    }]);
    expect(parseManifest(completed)).toEqual(completed);

    expect(commitManifestRootRotation(completed, {
      requestId: REQUEST_ID,
      target: "identity",
      startingAggregate: manifest.aggregate!,
      oldPhysicalVersion: "legacy",
      newPhysicalVersion: REQUEST_ID,
      fingerprint: "d".repeat(64),
      completedAt: 999,
    })).toEqual(completed);
    expect(() => commitManifestRootRotation(completed, {
      requestId: REQUEST_ID,
      target: "vault",
      startingAggregate: manifest.aggregate!,
      oldPhysicalVersion: "legacy",
      newPhysicalVersion: REQUEST_ID,
      fingerprint: "d".repeat(64),
      completedAt: 123,
    })).toThrow();
    expect(() => commitManifestRootRotation(manifest, {
      requestId: REQUEST_ID,
      target: "identity",
      startingAggregate: "0".repeat(64),
      oldPhysicalVersion: "legacy",
      newPhysicalVersion: REQUEST_ID,
      fingerprint: "d".repeat(64),
      completedAt: 123,
    })).toThrow();
    expect(() => parseManifest({
      ...completed,
      rotationReceipts: [
        completed.rotationReceipts![0],
        completed.rotationReceipts![0],
      ],
    })).toThrow();
  });
});

function configuredManifest(
  keyPaths: VaultProvisioningKeyPaths,
  fingerprintOverrides: Partial<Record<
    typeof VAULT_PROVISIONING_KEY_IDS[number],
    string
  >> = {},
): VaultProvisioningManifest {
  const registry = createVaultProvisioningRegistry(keyPaths);
  let manifest = initialProvisioningManifest(registry, INSTALLATION_ID);
  for (const [index, entry] of registry.entries()) {
    manifest = verifyManifestEntry(
      manifest,
      entry.id,
      fingerprintOverrides[entry.id]
        ?? fingerprintProvisionedKey(entry, Buffer.alloc(32, index + 1)),
    );
  }
  return configureManifest(manifest);
}

function paths(
  directory = "/keys",
): VaultProvisioningKeyPaths {
  return Object.fromEntries(VAULT_PROVISIONING_KEY_IDS.map((id) => [
    id,
    join(directory, id),
  ])) as VaultProvisioningKeyPaths;
}

function secureTempDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  chmodSync(directory, 0o700);
  return directory;
}
