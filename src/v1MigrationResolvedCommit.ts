import { createHash } from "node:crypto";
import type { RestoreRecoveryManager } from "./restoreRecovery.js";
import type { V1MigrationPreflight } from "./v1MigrationState.js";
import {
  V1MigrationCommitError,
  type V1MigratedVaultRecord,
  type V1MigrationCommitRepository,
  type V1MigrationCommitResult,
} from "./v1MigrationCommit.js";
import {
  V1MigrationResolvedPlan,
} from "./v1MigrationSecrets.js";
import type { VaultCredentialBinding, VaultRecordMetadata } from "./vault/recordStore.js";
import { UuidV7Generator } from "./persistence/uuidV7.js";

export type V1MigrationResolvedCommitErrorCode =
  | "invalid_plan"
  | "vault_failed"
  | "health_failed"
  | "rollback_failed"
  | "preflight_changed"
  | "already_completed"
  | "bootstrap_required"
  | "target_not_empty"
  | "runtime_active"
  | "unavailable";

export class V1MigrationResolvedCommitError extends Error {
  constructor(readonly code: V1MigrationResolvedCommitErrorCode) {
    super("Resolved v1 migration commit could not be completed.");
    this.name = "V1MigrationResolvedCommitError";
  }
}

export interface V1MigrationControlVault {
  create(input: {
    binding: VaultCredentialBinding;
    secret: Uint8Array;
    locator: string;
    captureLastFour?: boolean;
  }): Promise<{ locator: string; metadata: VaultRecordMetadata }>;
  metadata(
    locator: string,
    binding: VaultCredentialBinding,
  ): Promise<VaultRecordMetadata>;
  readiness(): Promise<{ status: "ready" | "locked" | "degraded"; recordCount: number }>;
}

export interface V1MigrationCommitRecovery {
  prepare: RestoreRecoveryManager["prepare"];
  advance: RestoreRecoveryManager["advance"];
  rollback: RestoreRecoveryManager["rollback"];
  remove: RestoreRecoveryManager["remove"];
}

export class V1MigrationResolvedCommitCoordinator {
  readonly #uuid: () => string;

  constructor(
    private readonly databaseFile: string,
    private readonly commits: V1MigrationCommitRepository,
    private readonly recovery: V1MigrationCommitRecovery,
    private readonly vault: V1MigrationControlVault,
    private readonly databaseHealth: () => Promise<boolean>,
    now: () => number = Date.now,
    uuid?: () => string,
  ) {
    const generator = new UuidV7Generator({ now });
    this.#uuid = uuid ?? (() => generator.next());
  }

  async commit(input: {
    resolved: V1MigrationResolvedPlan;
    correlationId: string;
    osActor: string;
  }): Promise<V1MigrationCommitResult> {
    let guard: V1MigrationPreflight | undefined;
    let migrationId: string | undefined;
    let snapshotReady = false;
    let rollbackReady = false;
    let databaseCommitted = false;
    let healthPassed = false;
    let committed: V1MigrationCommitResult | undefined;
    try {
      validateResolved(input.resolved);
      guard = await this.commits.preflight();
      migrationId = this.#uuid();
      await this.recovery.prepare({
        operationId: migrationId,
        actorId: guard.guardianSuperadminId,
        archiveSha256: input.resolved.base.sourceSha256,
        planDigest: input.resolved.digest,
        databaseFile: this.databaseFile,
      });
      snapshotReady = true;

      // The authenticated rollback journal must say mutation may have begun
      // before the first vault create can become durable.
      this.recovery.advance(migrationId, "vault_applied");
      rollbackReady = true;
      const records = await this.createVaultRecords(
        migrationId,
        input.resolved,
      );
      committed = await this.commits.commitResolved({
        plan: input.resolved.base,
        guard,
        migrationId,
        planDigest: input.resolved.digest,
        records,
        correlationId: input.correlationId,
        osActor: input.osActor,
      });
      databaseCommitted = true;
      this.recovery.advance(migrationId, "database_committed");
      if (!await this.databaseHealth()) {
        throw new V1MigrationResolvedCommitError("health_failed");
      }
      await this.verifyVaultRecords(input.resolved, records);
      this.recovery.advance(migrationId, "health_passed");
      healthPassed = true;
      try {
        this.recovery.remove();
      } catch {
        // Startup recovery discards an authenticated health_passed journal.
      }
      return committed;
    } catch (error) {
      const code = resolvedCommitCode(error);
      if (healthPassed && committed !== undefined) return committed;
      if (rollbackReady && migrationId !== undefined) {
        try {
          await this.recovery.rollback({
            operationId: migrationId,
            databaseFile: this.databaseFile,
          });
          try {
            this.recovery.remove();
          } catch {
            // Startup recovery safely discards a rolled_back journal.
          }
        } catch {
          throw new V1MigrationResolvedCommitError("rollback_failed");
        }
      } else if (snapshotReady) {
        try {
          this.recovery.remove();
        } catch {
          throw new V1MigrationResolvedCommitError("rollback_failed");
        }
      }
      if (databaseCommitted && code === "unavailable") {
        throw new V1MigrationResolvedCommitError("health_failed");
      }
      throw new V1MigrationResolvedCommitError(code);
    } finally {
      input.resolved.dispose();
    }
  }

  private async createVaultRecords(
    migrationId: string,
    resolved: V1MigrationResolvedPlan,
  ): Promise<Map<string, V1MigratedVaultRecord>> {
    const records = new Map<string, V1MigratedVaultRecord>();
    for (const credentialId of resolved.configuredCredentialIds()) {
      const located = locateCredential(resolved, credentialId);
      const value = resolved.credentialValue(credentialId);
      if (value === undefined) {
        throw new V1MigrationResolvedCommitError("invalid_plan");
      }
      const locator = deterministicLocator(migrationId, credentialId);
      let created: { locator: string; metadata: VaultRecordMetadata };
      try {
        created = await this.vault.create({
          binding: located.binding,
          secret: value,
          locator,
          captureLastFour: false,
        });
      } catch {
        throw new V1MigrationResolvedCommitError("vault_failed");
      }
      if (
        created.locator !== locator
        || created.metadata.status !== "configured"
        || !Number.isSafeInteger(created.metadata.generation)
        || created.metadata.generation < 1
      ) throw new V1MigrationResolvedCommitError("vault_failed");
      records.set(credentialId, {
        locator,
        generation: created.metadata.generation,
      });
    }
    return records;
  }

  private async verifyVaultRecords(
    resolved: V1MigrationResolvedPlan,
    records: ReadonlyMap<string, V1MigratedVaultRecord>,
  ): Promise<void> {
    let readiness: Awaited<ReturnType<V1MigrationControlVault["readiness"]>>;
    try {
      readiness = await this.vault.readiness();
    } catch {
      throw new V1MigrationResolvedCommitError("health_failed");
    }
    if (readiness.status !== "ready" || readiness.recordCount < records.size) {
      throw new V1MigrationResolvedCommitError("health_failed");
    }
    for (const [credentialId, record] of records) {
      const located = locateCredential(resolved, credentialId);
      let metadata: VaultRecordMetadata;
      try {
        metadata = await this.vault.metadata(record.locator, located.binding);
      } catch {
        throw new V1MigrationResolvedCommitError("health_failed");
      }
      if (
        metadata.status !== "configured"
        || metadata.generation !== record.generation
      ) throw new V1MigrationResolvedCommitError("health_failed");
    }
  }
}

function validateResolved(resolved: V1MigrationResolvedPlan): void {
  if (
    !(resolved instanceof V1MigrationResolvedPlan)
    || resolved.resolutionMode !== "allowlisted"
    || resolved.report.resolutionMode !== "allowlisted"
    || resolved.report.planDigest !== resolved.digest
    || !/^[a-f0-9]{64}$/.test(resolved.digest)
    || resolved.report.counts.configuredCredentials < 1
    || resolved.configuredCredentialIds().length
      !== resolved.report.counts.configuredCredentials
  ) throw new V1MigrationResolvedCommitError("invalid_plan");
}

function locateCredential(
  resolved: V1MigrationResolvedPlan,
  credentialId: string,
): { binding: VaultCredentialBinding } {
  for (const service of resolved.base.services) {
    if (service.credentials.some(({ id }) => id === credentialId)) {
      return {
        binding: {
          serviceId: service.id,
          destinationId: service.id,
          credentialId,
        },
      };
    }
  }
  throw new V1MigrationResolvedCommitError("invalid_plan");
}

function deterministicLocator(
  migrationId: string,
  credentialId: string,
): string {
  const bytes = createHash("sha256")
    .update("secretsauce-v1-migration-locator-v1\0")
    .update(migrationId)
    .update("\0")
    .update(credentialId)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  bytes.fill(0);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function resolvedCommitCode(
  error: unknown,
): V1MigrationResolvedCommitErrorCode {
  if (error instanceof V1MigrationResolvedCommitError) return error.code;
  if (error instanceof V1MigrationCommitError) {
    return error.code === "invalid_plan"
      ? "invalid_plan"
      : error.code;
  }
  return "unavailable";
}
