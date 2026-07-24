import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { AlwaysStepUpHandle } from "./identity/stepUp.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import type { PersistenceTransaction } from "./persistence/transaction.js";
import { UuidV7Generator } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import type {
  EvaluatedRestorePlan,
  RestorePreviewCoordinator,
} from "./restorePreview.js";
import type {
  RestoreReplacementRepository,
  RestoreReplacementResult,
} from "./restoreReplacement.js";
import type { RestoreRecoveryManager } from "./restoreRecovery.js";
import type { RestoreMaintenanceGate } from "./restoreMaintenance.js";
import {
  RestoreStateError,
  type RestorePreview,
  type RestoreStateRepository,
} from "./restoreState.js";
import {
  canonicalizeVaultBackupSelection,
  digestVaultBackupSelection,
} from "./vault/backupSelection.js";
import type { VaultBackupCapabilityIssuer } from "./vault/capabilities.js";

export class RestoreCommitError extends Error {
  constructor(
    readonly code:
      | "invalid"
      | "forbidden"
      | "not_found"
      | "expired"
      | "conflict"
      | "unavailable"
      | "health_failed"
      | "rollback_failed",
  ) {
    super(code);
    this.name = "RestoreCommitError";
  }
}

export interface RestoreCommitVault {
  replaceRestore(
    capability: string,
    passphrase: Uint8Array,
    archive: Uint8Array,
    selection: readonly {
      serviceId: string;
      destinationId: string;
      credentialId: string;
      locator: string;
      generation: number;
    }[],
  ): Promise<{ replaced: true; recordCount: number }>;
  replaceEmpty(
    capability: string,
  ): Promise<{ replaced: true; recordCount: 0 }>;
}

export interface RestoreCommitStepUps {
  withConsumedProof<T>(
    handle: AlwaysStepUpHandle,
    auditInput: AdministrativeAuditEventInput,
    mutation: (transaction: PersistenceTransaction) => T,
  ): Promise<T>;
}

export interface RestoreCommitRecovery {
  prepare: RestoreRecoveryManager["prepare"];
  advance: RestoreRecoveryManager["advance"];
  rollback: RestoreRecoveryManager["rollback"];
  remove: RestoreRecoveryManager["remove"];
}

export interface RestoreCommitResult extends RestoreReplacementResult {
  operationId: string;
  stageId: string;
  previewId: string;
  signedOut: true;
}

export class RestoreCommitCoordinator {
  readonly #uuid: UuidV7Generator;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly databaseFile: string,
    private readonly repository: RestoreStateRepository,
    private readonly previews: RestorePreviewCoordinator,
    private readonly maintenance: RestoreMaintenanceGate,
    private readonly recovery: RestoreCommitRecovery,
    private readonly replacement: RestoreReplacementRepository,
    private readonly vault: RestoreCommitVault,
    private readonly capabilities: Pick<VaultBackupCapabilityIssuer, "issueBackup">,
    private readonly stepUps: RestoreCommitStepUps,
    private readonly health: () => Promise<boolean>,
    now: () => number = Date.now,
  ) {
    this.#uuid = new UuidV7Generator({ now });
  }

  async commit(input: {
    actor: ControlAuthenticationContext;
    stageId: string;
    previewId: string;
    confirmation: string;
    justification: string;
    correlationId: string;
    stepUpProof?: AlwaysStepUpHandle;
    passphrase?: Uint8Array;
  }): Promise<RestoreCommitResult> {
    const operationId = this.#uuid.next();
    let claimed = false;
    let maintenanceEntered = false;
    let snapshotReady = false;
    let vaultApplied = false;
    let databaseCommitted = false;
    let exclusive: { release(): void } | undefined;
    try {
      validateInput(input);
      if (
        input.actor.method !== "browser_session"
        || input.actor.role !== "superadmin"
        || input.stepUpProof === undefined
      ) throw new RestoreCommitError("forbidden");
      const preview = await this.repository.previewForActor(
        input.previewId,
        input.stageId,
        input.actor.principalId,
      );
      if (
        preview.state !== "ready"
        || input.confirmation !== preview.confirmationPhrase
      ) throw new RestoreCommitError("conflict");

      return await this.previews.withEvaluatedPlan({
        actor: input.actor,
        stageId: input.stageId,
        ...(input.passphrase === undefined
          ? {}
          : { passphrase: input.passphrase }),
      }, async (plan) => {
        verifyPlan(preview, plan, input.passphrase !== undefined);
        await this.stepUps.withConsumedProof(
          input.stepUpProof!,
          authorizationAudit(input, operationId),
          (transaction) => {
            this.repository.claimPreviewInTransaction(transaction, {
              previewId: preview.id,
              stageId: preview.stageId,
              subjectUserId: input.actor.principalId,
              archiveSha256: plan.archiveSha256,
              planDigest: plan.planDigest,
            });
          },
        );
        claimed = true;

        exclusive = await this.maintenance.acquireExclusive(
          30_000,
          async () => {
            await this.repository.enterMaintenance(operationId);
            maintenanceEntered = true;
          },
        );
        await this.recovery.prepare({
          operationId,
          actorId: input.actor.principalId,
          archiveSha256: plan.archiveSha256,
          planDigest: plan.planDigest,
          databaseFile: this.databaseFile,
        });
        snapshotReady = true;
        await this.repository.advanceState(
          operationId,
          "maintenance",
          "snapshot_ready",
        );

        const selection = canonicalizeVaultBackupSelection(
          plan.decoded.secretSelection,
        );
        const operationDigest = digestVaultBackupSelection(
          plan.secretDisposition === "encrypted_secrets" ? selection : [],
        );
        const capability = this.capabilities.issueBackup({
          operation: plan.secretDisposition === "encrypted_secrets"
            ? "replace_restore"
            : "replace_empty",
          authorizationId: this.#uuid.next(),
          subjectId: input.actor.principalId,
          operationDigest,
          restorePlanId: operationId,
          archiveSha256: plan.archiveSha256,
          planDigest: plan.planDigest,
        });
        if (plan.secretDisposition === "encrypted_secrets") {
          const result = await this.vault.replaceRestore(
            capability,
            input.passphrase!,
            plan.decoded.secrets!,
            selection,
          );
          if (result.recordCount !== selection.length) {
            throw new RestoreCommitError("unavailable");
          }
        } else {
          await this.vault.replaceEmpty(capability);
        }
        vaultApplied = true;
        this.recovery.advance(operationId, "vault_applied");
        await this.repository.advanceState(
          operationId,
          "snapshot_ready",
          "vault_applied",
        );

        const replaced = await this.replacement.replace({
          operationId,
          previewId: preview.id,
          stageId: preview.stageId,
          actorId: input.actor.principalId,
          archiveSha256: plan.archiveSha256,
          planDigest: plan.planDigest,
          decoded: plan.decoded,
          availableSecretCredentialIds:
            plan.secretDisposition === "encrypted_secrets"
              ? selection.map((entry) => entry.credentialId)
              : [],
        });
        databaseCommitted = true;
        this.recovery.advance(operationId, "database_committed");
        if (!await this.health()) throw new RestoreCommitError("health_failed");
        await this.repository.advanceState(
          operationId,
          "database_committed",
          "health_passed",
        );
        this.recovery.advance(operationId, "health_passed");
        this.recovery.remove();
        await this.repository.clearState(operationId);
        return {
          operationId,
          stageId: preview.stageId,
          previewId: preview.id,
          signedOut: true,
          ...replaced,
        };
      });
    } catch (error) {
      const code = commitCode(error);
      if (vaultApplied) {
        try {
          await this.recovery.rollback({
            operationId,
            databaseFile: this.databaseFile,
          });
        } catch {
          await this.auditFailure(input, operationId, "rollback_failed");
          throw new RestoreCommitError("rollback_failed");
        }
      } else if (maintenanceEntered) {
        try {
          if (snapshotReady) this.recovery.remove();
          await this.repository.markRolledBack(operationId);
          await this.repository.clearState(operationId);
        } catch {
          await this.auditFailure(input, operationId, "rollback_failed");
          throw new RestoreCommitError("rollback_failed");
        }
      }
      if (claimed && !databaseCommitted) {
        try {
          await this.repository.finalizePreview(
            input.previewId,
            "failed",
            `restore_${code}`,
          );
        } catch {
          // The recovery snapshot may already have restored the pre-claim state.
        }
      }
      await this.auditFailure(input, operationId, code);
      throw new RestoreCommitError(code);
    } finally {
      exclusive?.release();
      wipe(input.passphrase);
    }
  }

  private async auditFailure(
    input: {
      actor: ControlAuthenticationContext;
      stageId: string;
      previewId: string;
      correlationId: string;
    },
    operationId: string,
    code: RestoreCommitError["code"],
  ): Promise<void> {
    try {
      await this.owner.execute({
        run: (database) => database.appendAdministrativeAudit({
          actor: {
            type: "browser_session",
            id: input.actor.principalId,
            label: "restore-superadmin",
            role: input.actor.role,
            authenticationMethod: input.actor.method,
          },
          action: "restore.commit",
          category: "system",
          result: "deny",
          target: {
            type: "portable_restore",
            id: input.previewId,
            label: `portable-restore:${input.previewId}`,
          },
          changes: [
            { field: "operation_id", after: operationId },
            { field: "stage_id", after: input.stageId },
            { field: "failure_phase", after: failurePhase(code) },
          ],
          correlationId: input.correlationId,
          source: { category: "restore" },
          failureCode: `restore.${code}`,
        }),
      });
    } catch {
      // Preserve the stable restore result if audit storage is unavailable.
    }
  }
}

function validateInput(input: {
  stageId: string;
  previewId: string;
  confirmation: string;
  justification: string;
  correlationId: string;
}): void {
  const bytes = Buffer.byteLength(input.justification, "utf8");
  if (
    bytes < 10
    || bytes > 1_024
    || input.justification.trim() !== input.justification
    || input.confirmation.length < 1
    || input.confirmation.length > 128
    || input.correlationId.length < 1
  ) throw new RestoreCommitError("invalid");
}

function verifyPlan(
  preview: RestorePreview,
  plan: EvaluatedRestorePlan,
  passphraseProvided: boolean,
): void {
  if (
    preview.stageId !== plan.stageId
    || preview.archiveSha256 !== plan.archiveSha256
    || preview.planDigest !== plan.planDigest
    || preview.secretDisposition !== plan.secretDisposition
    || (
      plan.secretDisposition === "encrypted_secrets"
        ? !passphraseProvided
        : passphraseProvided
    )
  ) throw new RestoreCommitError("conflict");
}

function authorizationAudit(
  input: {
    actor: ControlAuthenticationContext;
    previewId: string;
    correlationId: string;
  },
  operationId: string,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "browser_session",
      id: input.actor.principalId,
      label: "restore-superadmin",
      role: input.actor.role,
      authenticationMethod: input.actor.method,
    },
    action: "restore.authorize",
    category: "authentication",
    result: "allow",
    target: {
      type: "portable_restore",
      id: input.previewId,
      label: `portable-restore:${input.previewId}`,
    },
    changes: [{ field: "operation_id", after: operationId }],
    correlationId: input.correlationId,
    source: { category: "restore" },
  };
}

function commitCode(error: unknown): RestoreCommitError["code"] {
  if (error instanceof RestoreCommitError) return error.code;
  if (error instanceof RestoreStateError) return error.restoreCode;
  return "unavailable";
}

function failurePhase(code: RestoreCommitError["code"]): string {
  if (code === "health_failed") return "health_gate";
  if (code === "rollback_failed") return "rollback";
  return "commit";
}

function wipe(value: Uint8Array | undefined): void {
  value?.fill(0);
}
