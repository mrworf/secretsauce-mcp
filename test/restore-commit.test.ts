import { describe, expect, it, vi } from "vitest";
import { RestoreCommitCoordinator, RestoreCommitError } from "../src/restoreCommit.js";
import { RestoreMaintenanceGate } from "../src/restoreMaintenance.js";
import { AlwaysStepUpHandle } from "../src/identity/stepUp.js";
import type { RestoreStateRepository } from "../src/restoreState.js";
import type { RestorePreviewCoordinator } from "../src/restorePreview.js";
import type { RestoreReplacementRepository } from "../src/restoreReplacement.js";
import type { PersistenceOwner } from "../src/persistence/worker.js";
import type { DecodedRestoreArchive } from "../src/restoreArchive.js";

const NOW = 1_800_000_000_000;
const USER_ID = "018f1f2e-7b3c-7a10-8000-000000000001";
const STAGE_ID = "018f1f2e-7b3c-7a10-8000-000000000010";
const PREVIEW_ID = "018f1f2e-7b3c-7a10-8000-000000000011";
const ARCHIVE_ID = "018f1f2e-7b3c-7a10-8000-000000000012";
const CREDENTIAL_ID = "018f1f2e-7b3c-7a10-8000-000000000020";
const SERVICE_ID = "018f1f2e-7b3c-7a10-8000-000000000021";
const DESTINATION_ID = "018f1f2e-7b3c-7a10-8000-000000000022";
const LOCATOR = "018f1f2e-7b3c-4a10-8000-000000000023";
const HASH = "a".repeat(64);
const DIGEST = "b".repeat(64);

describe("restore commit coordinator", () => {
  it("consumes exact step-up before maintenance and commits vault before database", async () => {
    const context = fixture();
    const passphrase = Buffer.from("correct passphrase");
    const result = await context.coordinator.commit(input(passphrase));

    expect(result).toMatchObject({
      stageId: STAGE_ID,
      previewId: PREVIEW_ID,
      signedOut: true,
      services: 1,
      revokedSessions: 2,
    });
    expect(context.order).toEqual([
      "step_up",
      "claim",
      "maintenance",
      "snapshot",
      "state:snapshot_ready",
      "vault",
      "journal:vault_applied",
      "state:vault_applied",
      "database",
      "journal:database_committed",
      "health",
      "state:health_passed",
      "journal:health_passed",
      "remove",
      "clear",
    ]);
    expect(passphrase.every((byte) => byte === 0)).toBe(true);
    expect(context.rollback).not.toHaveBeenCalled();
  });

  it("rejects digest, disposition, and confirmation mismatches before mutation", async () => {
    for (const mutate of [
      (context: ReturnType<typeof fixture>) => {
        context.preview.planDigest = "c".repeat(64);
      },
      (context: ReturnType<typeof fixture>) => {
        context.preview.secretDisposition = "configuration_only";
      },
    ]) {
      const context = fixture();
      mutate(context);
      await expect(
        context.coordinator.commit(input(Buffer.from("correct passphrase"))),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(context.order).toEqual([]);
    }

    const context = fixture();
    await expect(context.coordinator.commit({
      ...input(Buffer.from("correct passphrase")),
      confirmation: "RESTORE wrong",
    })).rejects.toMatchObject({ code: "conflict" });
    expect(context.order).toEqual([]);
  });

  it("rolls both stores back after database or health failure", async () => {
    for (const failure of ["database", "health"] as const) {
      const context = fixture(failure);
      await expect(
        context.coordinator.commit(input(Buffer.from("correct passphrase"))),
      ).rejects.toBeInstanceOf(RestoreCommitError);
      expect(context.rollback).toHaveBeenCalledOnce();
      expect(context.order).toContain("vault");
      expect(context.order.at(-1)).toBe("rollback");
      expect(context.maintenance.phase).toBe("open");
    }
  });

  it("fails closed when rollback cannot restore the recovery set", async () => {
    const context = fixture("database");
    context.rollback.mockRejectedValueOnce(new Error("injected"));
    await expect(
      context.coordinator.commit(input(Buffer.from("correct passphrase"))),
    ).rejects.toMatchObject({ code: "rollback_failed" });
    expect(context.maintenance.phase).toBe("open");
  });
});

function fixture(failure?: "database" | "health") {
  const order: string[] = [];
  const preview = previewRecord();
  const plan = evaluatedPlan();
  const repository = {
    previewForActor: vi.fn(async () => preview),
    claimPreviewInTransaction: vi.fn(() => {
      order.push("claim");
      return preview;
    }),
    enterMaintenance: vi.fn(async () => {
      order.push("maintenance");
    }),
    advanceState: vi.fn(async (
      _operationId: string,
      _expected: string,
      next: string,
    ) => {
      order.push(`state:${next}`);
    }),
    clearState: vi.fn(async () => {
      order.push("clear");
    }),
    markRolledBack: vi.fn(async () => undefined),
    finalizePreview: vi.fn(async () => undefined),
  };
  const previews = {
    withEvaluatedPlan: vi.fn(async (
      _input: unknown,
      use: (value: typeof plan) => Promise<unknown>,
    ) => use(plan)),
  };
  const maintenance = new RestoreMaintenanceGate();
  const recovery = {
    prepare: vi.fn(async () => {
      order.push("snapshot");
      return {};
    }),
    advance: vi.fn((_operationId: string, phase: string) => {
      order.push(`journal:${phase}`);
      return {};
    }),
    rollback: vi.fn(async () => {
      order.push("rollback");
    }),
    remove: vi.fn(() => {
      order.push("remove");
    }),
  };
  const replacement = {
    replace: vi.fn(async () => {
      order.push("database");
      if (failure === "database") throw new Error("injected");
      return replacementResult();
    }),
  };
  const vault = {
    replaceRestore: vi.fn(async () => {
      order.push("vault");
      return { replaced: true as const, recordCount: 1 };
    }),
    replaceEmpty: vi.fn(async () => {
      order.push("vault");
      return { replaced: true as const, recordCount: 0 as const };
    }),
  };
  const stepUps = {
    withConsumedProof: vi.fn(async (
      _proof: unknown,
      _audit: unknown,
      mutation: (transaction: never) => unknown,
    ) => {
      order.push("step_up");
      return mutation({} as never);
    }),
  };
  const owner = {
    execute: vi.fn(async () => undefined),
  };
  const health = vi.fn(async () => {
    order.push("health");
    return failure !== "health";
  });
  const coordinator = new RestoreCommitCoordinator(
    owner as unknown as PersistenceOwner,
    "/tmp/restore-commit.sqlite",
    repository as unknown as RestoreStateRepository,
    previews as unknown as RestorePreviewCoordinator,
    maintenance,
    recovery as never,
    replacement as unknown as RestoreReplacementRepository,
    vault,
    { issueBackup: vi.fn(() => "capability") },
    stepUps as never,
    health,
    () => NOW,
  );
  return {
    coordinator,
    order,
    preview,
    rollback: recovery.rollback,
    maintenance,
  };
}

function input(passphrase: Buffer) {
  return {
    actor: {
      method: "browser_session" as const,
      principalId: USER_ID,
      role: "superadmin" as const,
    },
    stageId: STAGE_ID,
    previewId: PREVIEW_ID,
    confirmation: `RESTORE ${ARCHIVE_ID}`,
    justification: "Replace the portable configuration now.",
    correlationId: "request-restore-commit",
    stepUpProof: new AlwaysStepUpHandle(PREVIEW_ID, STAGE_ID, USER_ID),
    passphrase,
  };
}

function previewRecord() {
  return {
    id: PREVIEW_ID,
    stageId: STAGE_ID,
    subjectUserId: USER_ID,
    archiveSha256: HASH,
    planDigest: DIGEST,
    secretDisposition: "encrypted_secrets" as
      "encrypted_secrets" | "configuration_only",
    counts: counts(),
    confirmationPhrase: `RESTORE ${ARCHIVE_ID}`,
    state: "ready" as const,
    expiresAt: NOW + 60_000,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function evaluatedPlan() {
  return {
    stageId: STAGE_ID,
    archiveSha256: HASH,
    planDigest: DIGEST,
    secretDisposition: "encrypted_secrets" as const,
    counts: counts(),
    decoded: {
      archiveId: ARCHIVE_ID,
      archiveSha256: HASH,
      secrets: Buffer.from("ciphertext"),
      secretSelection: [{
        serviceId: SERVICE_ID,
        destinationId: DESTINATION_ID,
        credentialId: CREDENTIAL_ID,
        locator: LOCATOR,
        generation: 1,
      }],
      counts: {
        services: 1,
        destinations: 1,
        credentials: 1,
        policies: 1,
        rules: 1,
      },
      services: [],
      credentials: [],
      policies: [],
    } as unknown as DecodedRestoreArchive,
  };
}

function counts() {
  return {
    services: 1,
    destinations: 1,
    credentials: 1,
    policies: 1,
    rules: 1,
    availableSecrets: 1,
    unavailableSecrets: 0,
    replacements: 0,
    removals: 0,
    revokedApiKeys: 1,
    revokedSessions: 2,
    revokedOauthGrants: 3,
    remediations: 4,
  };
}

function replacementResult() {
  return {
    services: 1,
    destinations: 1,
    credentials: 1,
    policies: 1,
    rules: 1,
    remediations: 4,
    revokedApiKeys: 1,
    revokedSessions: 2,
    revokedOauthGrants: 3,
  };
}
