import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  RestoreStateError,
  RestoreStateRepository,
  type RestoreCounts,
} from "../src/restoreState.js";
import { PersistenceWorker } from "../src/persistence/worker.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const OTHER_USER_ID = "018f1f2e-7b3c-7a10-8000-000000000002";
const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const OPERATION_ID = "018f1f2e-7b3c-7a10-8000-000000000020";
const SHA = "a".repeat(64);
const PLAN = "b".repeat(64);
const workers = new Set<PersistenceWorker>();

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
});

describe("durable restore state", () => {
  it("binds a validated stage and preview to one actor, archive hash, and plan", async () => {
    const { repository } = await fixture();
    const stage = await repository.createStage({
      subjectUserId: USER_ID,
      archiveId: ARCHIVE_ID,
      archiveSha256: SHA,
      archiveBytes: 4096,
    });
    expect(stage).toMatchObject({
      subjectUserId: USER_ID,
      archiveId: ARCHIVE_ID,
      archiveSha256: SHA,
      archiveBytes: 4096,
      state: "validated",
    });
    expect(stage.storageKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const preview = await repository.createPreview({
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: SHA,
      planDigest: PLAN,
      secretDisposition: "encrypted_secrets",
      counts: COUNTS,
    });
    expect(preview).toMatchObject({
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: SHA,
      planDigest: PLAN,
      secretDisposition: "encrypted_secrets",
      counts: COUNTS,
      confirmationPhrase: `RESTORE ${ARCHIVE_ID}`,
      state: "ready",
    });
    expect((await repository.stageForActor(stage.id, USER_ID)).state)
      .toBe("previewed");

    const claimed = await repository.claimPreview({
      previewId: preview.id,
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: SHA,
      planDigest: PLAN,
    });
    expect(claimed.state).toBe("claimed");
    await repository.finalizePreview(preview.id, "completed", "completed");
    expect((await repository.stageForActor(stage.id, USER_ID)).state)
      .toBe("completed");
  });

  it("rejects actor, digest, replay, and invalid secret-count boundaries", async () => {
    const { repository } = await fixture();
    const stage = await repository.createStage({
      subjectUserId: USER_ID,
      archiveId: ARCHIVE_ID,
      archiveSha256: SHA,
      archiveBytes: 1,
    });
    await expect(repository.stageForActor(stage.id, OTHER_USER_ID))
      .rejects.toEqual(new RestoreStateError("not_found"));
    await expect(repository.createPreview({
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: "c".repeat(64),
      planDigest: PLAN,
      secretDisposition: "configuration_only",
      counts: { ...COUNTS, availableSecrets: 0 },
    })).rejects.toEqual(new RestoreStateError("conflict"));
    await expect(repository.createPreview({
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: SHA,
      planDigest: PLAN,
      secretDisposition: "configuration_only",
      counts: COUNTS,
    })).rejects.toEqual(new RestoreStateError("invalid"));

    const preview = await repository.createPreview({
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: SHA,
      planDigest: PLAN,
      secretDisposition: "configuration_only",
      counts: { ...COUNTS, availableSecrets: 0 },
    });
    const exact = {
      previewId: preview.id,
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: SHA,
      planDigest: PLAN,
    };
    await expect(repository.claimPreview({
      ...exact,
      planDigest: "c".repeat(64),
    })).rejects.toEqual(new RestoreStateError("conflict"));
    await repository.claimPreview(exact);
    await expect(repository.claimPreview(exact))
      .rejects.toEqual(new RestoreStateError("conflict"));
  });

  it("expires only idle rows and never turns a claimed plan reusable", async () => {
    const context = await fixture();
    const stage = await context.repository.createStage({
      subjectUserId: USER_ID,
      archiveId: ARCHIVE_ID,
      archiveSha256: SHA,
      archiveBytes: 4096,
    });
    const preview = await context.repository.createPreview({
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: SHA,
      planDigest: PLAN,
      secretDisposition: "configuration_only",
      counts: { ...COUNTS, availableSecrets: 0 },
    });
    context.now.value += 60 * 60_000;
    expect(await context.repository.cleanupExpired()).toBe(2);
    await expect(context.repository.stageForActor(stage.id, USER_ID))
      .rejects.toEqual(new RestoreStateError("expired"));
    await expect(context.repository.claimPreview({
      previewId: preview.id,
      stageId: stage.id,
      subjectUserId: USER_ID,
      archiveSha256: SHA,
      planDigest: PLAN,
    })).rejects.toEqual(new RestoreStateError("conflict"));
  });

  it("advances one exact restore operation through bounded recovery phases", async () => {
    const { repository } = await fixture();
    expect(await repository.state()).toMatchObject({ phase: "inactive" });
    expect(await repository.enterMaintenance(OPERATION_ID)).toMatchObject({
      phase: "maintenance",
      operationId: OPERATION_ID,
    });
    await expect(repository.enterMaintenance(ARCHIVE_ID))
      .rejects.toEqual(new RestoreStateError("conflict"));
    const snapshot = await repository.advanceState(
      OPERATION_ID,
      "maintenance",
      "snapshot_ready",
    );
    expect(snapshot).toMatchObject({
      phase: "snapshot_ready",
      operationId: OPERATION_ID,
      recoveryExpiresAt: NOW + 24 * 60 * 60_000,
    });
    await expect(repository.advanceState(
      OPERATION_ID,
      "snapshot_ready",
      "database_committed",
    )).rejects.toEqual(new RestoreStateError("invalid"));
    await repository.advanceState(
      OPERATION_ID,
      "snapshot_ready",
      "vault_applied",
    );
    await repository.advanceState(
      OPERATION_ID,
      "vault_applied",
      "database_committed",
    );
    await repository.advanceState(
      OPERATION_ID,
      "database_committed",
      "health_passed",
    );
    expect(await repository.clearState(OPERATION_ID)).toMatchObject({
      phase: "inactive",
    });
  });
});

const COUNTS: RestoreCounts = {
  services: 1,
  destinations: 2,
  credentials: 3,
  policies: 4,
  rules: 5,
  availableSecrets: 2,
  unavailableSecrets: 1,
  replacements: 6,
  removals: 7,
  revokedApiKeys: 8,
  revokedSessions: 9,
  revokedOauthGrants: 10,
  remediations: 11,
};

async function fixture() {
  const now = { value: NOW };
  const worker = PersistenceWorker.open({
    databaseFile: join(
      mkdtempSync(join(tmpdir(), "restore-state-")),
      "control.sqlite",
    ),
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
        `, [id, email, email, now.value, now.value]);
      }
    }),
  });
  return {
    now,
    worker,
    repository: new RestoreStateRepository(worker, () => now.value),
  };
}
