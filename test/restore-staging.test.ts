import {
  chmodSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { createPortableArchive } from "../src/portableArchive.js";
import { PersistenceWorker } from "../src/persistence/worker.js";
import { restoreStageCoordinatorFromEnvironment } from "../src/control/server.js";
import {
  PrivateRestoreStageStore,
  RestoreStageCoordinator,
  RestoreStagingError,
} from "../src/restoreStaging.js";
import { RestoreStateRepository } from "../src/restoreState.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const OTHER_USER_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const STORAGE_KEY = "018f1f2e-7b3c-7a10-8000-000000000010";
const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000099";
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("private restore stage store", () => {
  it("atomically stores, bounds, reads, and removes an opaque stage file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "restore-store-"));
    const store = new PrivateRestoreStageStore(directory);
    const archive = Buffer.from("bounded archive");
    await store.write(STORAGE_KEY, archive);
    expect(await store.read(STORAGE_KEY, archive.byteLength)).toEqual(archive);
    await expect(store.read(STORAGE_KEY, archive.byteLength + 1))
      .rejects.toEqual(new RestoreStagingError("unavailable"));
    await store.remove(STORAGE_KEY);
    await expect(store.read(STORAGE_KEY, archive.byteLength))
      .rejects.toEqual(new RestoreStagingError("unavailable"));
  });

  it("rejects relative, broad-permission, and linked directories or files", async () => {
    expect(() => new PrivateRestoreStageStore("relative"))
      .toThrowError(new RestoreStagingError("unavailable"));

    const broad = mkdtempSync(join(tmpdir(), "restore-broad-"));
    chmodSync(broad, 0o755);
    expect(() => new PrivateRestoreStageStore(broad))
      .toThrowError(new RestoreStagingError("unavailable"));

    const target = mkdtempSync(join(tmpdir(), "restore-target-"));
    const link = `${target}-link`;
    symlinkSync(target, link);
    expect(() => new PrivateRestoreStageStore(link))
      .toThrowError(new RestoreStagingError("unavailable"));

    const directory = mkdtempSync(join(tmpdir(), "restore-linked-file-"));
    const store = new PrivateRestoreStageStore(directory);
    const outside = join(directory, "outside");
    writeFileSync(outside, "outside");
    symlinkSync(outside, join(directory, `${STORAGE_KEY}.tar.gz`));
    await expect(store.read(STORAGE_KEY, 7))
      .rejects.toEqual(new RestoreStagingError("unavailable"));
  });
});

describe("restore stage coordinator", () => {
  it("validates, persists, rehashes, expires, and actor-binds a stage", async () => {
    const context = await fixture();
    const archive = emptyArchive();
    const stage = await context.coordinator.stage({
      actor: browserActor(USER_ID),
      archive,
    });
    expect(stage).toMatchObject({
      subjectUserId: USER_ID,
      archiveId: ARCHIVE_ID,
      archiveBytes: archive.byteLength,
      state: "validated",
    });
    expect(await context.coordinator.status(browserActor(USER_ID), stage.id))
      .toMatchObject({ id: stage.id });
    await expect(context.coordinator.status(
      browserActor(OTHER_USER_ID),
      stage.id,
    )).rejects.toEqual(new RestoreStagingError("not_found"));
    const read = await context.coordinator.read(browserActor(USER_ID), stage.id);
    expect(read.archive).toEqual(archive);
    read.archive.fill(0);

    context.now.value += 60 * 60_000;
    expect(await context.coordinator.cleanup()).toBe(1);
    await expect(context.coordinator.status(browserActor(USER_ID), stage.id))
      .rejects.toEqual(new RestoreStagingError("not_found"));
  });

  it("rejects invalid archives, non-browser actors, and a second active upload", async () => {
    const context = await fixture();
    await expect(context.coordinator.stage({
      actor: browserActor(USER_ID),
      archive: Buffer.from("not gzip"),
    })).rejects.toEqual(new RestoreStagingError("invalid"));
    await expect(context.coordinator.stage({
      actor: { ...browserActor(USER_ID), method: "api_key" } as never,
      archive: emptyArchive(),
    })).rejects.toEqual(new RestoreStagingError("forbidden"));
    await context.coordinator.stage({
      actor: browserActor(USER_ID),
      archive: emptyArchive(),
    });
    await expect(context.coordinator.stage({
      actor: browserActor(USER_ID),
      archive: emptyArchive(),
    })).rejects.toEqual(new RestoreStagingError("conflict"));
  });

  it("requires the restore directory and recovery key deployment settings together", async () => {
    const context = await fixture();
    expect(restoreStageCoordinatorFromEnvironment(
      context.worker,
      {},
    )).toBeUndefined();
    expect(() => restoreStageCoordinatorFromEnvironment(
      context.worker,
      { SECRETSAUCE_RESTORE_DIRECTORY: context.directory },
    )).toThrow("Restore deployment configuration is incomplete.");
    expect(restoreStageCoordinatorFromEnvironment(
      context.worker,
      {
        SECRETSAUCE_RESTORE_DIRECTORY: context.directory,
        SECRETSAUCE_RESTORE_RECOVERY_KEY_FILE: "/run/secrets/restore.key",
      },
    )).toBeInstanceOf(RestoreStageCoordinator);
  });
});

async function fixture() {
  const now = { value: NOW };
  const directory = mkdtempSync(join(tmpdir(), "restore-coordinator-"));
  const worker = PersistenceWorker.open({
    databaseFile: join(directory, "control.sqlite"),
    productVersion: "test",
    now: () => now.value,
  });
  workers.add(worker);
  await worker.execute({
    run: (database) => database.withOperationalTransaction((transaction) => {
      for (const [id, email] of [
        [USER_ID, "restore@example.org"],
        [OTHER_USER_ID, "other@example.org"],
      ]) {
        transaction.run(`
          INSERT INTO users (
            id, email, normalized_email, given_name, family_name, role, status,
            security_epoch, password_policy_version, version, created_at,
            updated_at
          ) VALUES (?, ?, ?, 'Restore', 'Admin', 'superadmin', 'active',
            1, 1, 1, ?, ?)
        `, [id, email, email, NOW, NOW]);
      }
    }),
  });
  const repository = new RestoreStateRepository(worker, () => now.value);
  const store = new PrivateRestoreStageStore(directory);
  return {
    now,
    worker,
    directory,
    coordinator: new RestoreStageCoordinator(
      repository,
      store,
      () => now.value,
    ),
  };
}

function browserActor(principalId: string) {
  return {
    method: "browser_session" as const,
    principalId,
    role: "superadmin" as const,
  };
}

function emptyArchive(): Buffer {
  return createPortableArchive({
    archiveId: ARCHIVE_ID,
    productVersion: "0.1.0-test",
    createdAtUtcMs: NOW,
    mode: "credential-less",
    counts: {
      services: 0,
      destinations: 0,
      credentials: 0,
      policies: 0,
      rules: 0,
      secrets: 0,
    },
    documents: {
      services: yaml({
        kind: "services",
        schema_version: 1,
        services: [],
      }),
      credentials: yaml({
        credentials: [],
        kind: "credentials",
        schema_version: 1,
      }),
      policies: yaml({
        kind: "policies",
        policies: [],
        schema_version: 1,
      }),
    },
  }).archive;
}

function yaml(value: unknown): Buffer {
  return Buffer.from(stringifyYaml(value, {
    aliasDuplicateObjects: false,
    lineWidth: 0,
  }));
}
