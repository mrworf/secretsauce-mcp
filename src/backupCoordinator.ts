import { createHash } from "node:crypto";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { AlwaysStepUpHandle } from "./identity/stepUp.js";
import {
  PortableBackupProjectionService,
  type PortableBackupProjection,
} from "./backupProjection.js";
import {
  PORTABLE_EXCLUDED_DOMAINS,
  PORTABLE_INCLUDED_DOMAINS,
  createPortableArchive,
  type PortableArchiveResult,
} from "./portableArchive.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "./persistence/transaction.js";
import { isUuidV7, UuidV7Generator } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import { administrativeActorSnapshot } from "./apiKeyAuthority.js";
import type { VaultBackupSelection } from "./vault/backupSelection.js";
import { digestVaultBackupSelection } from "./vault/backupSelection.js";
import type { VaultBackupCapabilityIssuer } from "./vault/capabilities.js";

const AUTHORIZATION_TTL_MS = 5 * 60_000;
const RATE_WINDOW_MS = 60_000;
const RATE_ATTEMPTS = 3;
const MAX_RATE_ENTRIES = 10_000;
const MAX_CONCURRENT_EXPORTS = 2;
const CLEANUP_LIMIT = 100;

export const PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT =
  "I understand this backup permanently excludes identities, access grants, audit history, runtime state, and deployment configuration.";

export interface BackupVaultExporter {
  exportEncrypted(
    capability: string,
    passphrase: Uint8Array,
    selection: readonly VaultBackupSelection[],
  ): Promise<Buffer>;
}

export interface BackupStepUpConsumer {
  withConsumedProof<T>(
    handle: AlwaysStepUpHandle,
    auditInput: AdministrativeAuditEventInput,
    mutation: (transaction: PersistenceTransaction) => T,
  ): Promise<T>;
}

export interface PortableBackupResult {
  archiveId: string;
  archive: Buffer;
  sha256: string;
  bytes: number;
  mode: "credential-less" | "encrypted-secrets";
  counts: PortableBackupProjection["counts"];
}

export class BackupCoordinatorError extends Error {
  constructor(readonly code:
    | "invalid"
    | "forbidden"
    | "rate_limited"
    | "busy"
    | "vault_unavailable"
    | "export_failed"
  ) {
    super(code);
    this.name = "BackupCoordinatorError";
  }
}

interface RateEntry {
  count: number;
  resetAt: number;
}

export class PortableBackupCoordinator {
  readonly #projection: PortableBackupProjectionService;
  readonly #uuid: UuidV7Generator;
  readonly #rate = new Map<string, RateEntry>();
  #active = 0;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly productVersion: string,
    private readonly vault?: BackupVaultExporter,
    private readonly capabilities?: Pick<VaultBackupCapabilityIssuer, "issueBackup">,
    private readonly stepUps?: BackupStepUpConsumer,
    private readonly now: () => number = Date.now,
    projection?: PortableBackupProjectionService,
  ) {
    if (
      productVersion.length < 1
      || productVersion.length > 128
      || /[\u0000-\u001f\u007f]/u.test(productVersion)
    ) throw new BackupCoordinatorError("invalid");
    this.#projection = projection
      ?? new PortableBackupProjectionService(owner);
    this.#uuid = new UuidV7Generator({ now });
  }

  async create(input: {
    actor: ControlAuthenticationContext;
    includeSecrets: boolean;
    acknowledgement: string;
    correlationId: string;
    passphrase?: Uint8Array;
    stepUpProof?: AlwaysStepUpHandle;
  }): Promise<PortableBackupResult> {
    validateRequest(input);
    const timestamp = safeNow(this.now);
    const archiveId = this.#uuid.next();
    const authorized = await this.authorizedActor(
      input.actor,
      input.includeSecrets,
      timestamp,
    );
    if (!authorized) {
      await this.appendAudit(auditInput({
        actor: input.actor,
        archiveId,
        correlationId: input.correlationId,
        includeSecrets: input.includeSecrets,
        result: "deny",
        failureCode: "backup.forbidden",
      }));
      wipe(input.passphrase);
      throw new BackupCoordinatorError("forbidden");
    }
    if (!this.takeRate(input.actor.principalId, timestamp)) {
      await this.appendAudit(auditInput({
        actor: input.actor,
        archiveId,
        correlationId: input.correlationId,
        includeSecrets: input.includeSecrets,
        result: "deny",
        failureCode: "backup.rate_limited",
      }));
      wipe(input.passphrase);
      throw new BackupCoordinatorError("rate_limited");
    }
    if (this.#active >= MAX_CONCURRENT_EXPORTS) {
      await this.appendAudit(auditInput({
        actor: input.actor,
        archiveId,
        correlationId: input.correlationId,
        includeSecrets: input.includeSecrets,
        result: "deny",
        failureCode: "backup.busy",
      }));
      wipe(input.passphrase);
      throw new BackupCoordinatorError("busy");
    }

    this.#active += 1;
    let projection: PortableBackupProjection | undefined;
    let encryptedSecrets: Buffer | undefined;
    let portable: PortableArchiveResult | undefined;
    let authorizationClaimed = false;
    try {
      await this.cleanupExpired();
      projection = await this.#projection.project({
        includeSecrets: input.includeSecrets,
      });
      const operationDigest = input.includeSecrets
        ? digestVaultBackupSelection(projection.secretSelection)
        : createHash("sha256")
          .update("secretsauce:portable-backup:credential-less:v1:")
          .digest("hex");

      if (input.actor.method === "browser_session") {
        await this.issueAuthorization({
          id: archiveId,
          subjectUserId: input.actor.principalId,
          operationDigest,
          credentialCount: projection.counts.secrets,
          now: timestamp,
        });
        if (input.stepUpProof === undefined || this.stepUps === undefined) {
          throw new BackupCoordinatorError("forbidden");
        }
        try {
          await this.stepUps.withConsumedProof(
            input.stepUpProof,
            authorizationAudit(
              input.actor,
              archiveId,
              input.correlationId,
              input.includeSecrets,
            ),
            (transaction) => {
              if (!claimAuthorization(transaction, archiveId, timestamp)) {
                throw new BackupCoordinatorError("forbidden");
              }
            },
          );
        } catch {
          throw new BackupCoordinatorError("forbidden");
        }
        authorizationClaimed = true;
      }

      if (input.includeSecrets) {
        if (
          input.actor.method !== "browser_session"
          || input.passphrase === undefined
          || this.vault === undefined
          || this.capabilities === undefined
        ) throw new BackupCoordinatorError("vault_unavailable");
        const capability = this.capabilities.issueBackup({
          operation: "export_encrypted",
          authorizationId: archiveId,
          subjectId: input.actor.principalId,
          operationDigest,
        });
        try {
          encryptedSecrets = await this.vault.exportEncrypted(
            capability,
            input.passphrase,
            projection.secretSelection,
          );
        } catch {
          throw new BackupCoordinatorError("vault_unavailable");
        }
      }

      portable = createPortableArchive({
        archiveId,
        productVersion: this.productVersion,
        createdAtUtcMs: timestamp,
        mode: projection.mode,
        counts: projection.counts,
        documents: projection.documents,
        ...(encryptedSecrets === undefined
          ? {}
          : { secrets: encryptedSecrets }),
      });
      const successAudit = auditInput({
        actor: input.actor,
        archiveId,
        correlationId: input.correlationId,
        includeSecrets: input.includeSecrets,
        counts: projection.counts,
        archiveBytes: portable.archive.byteLength,
        archiveSha256: portable.sha256,
        result: "allow",
      });
      if (authorizationClaimed) {
        await this.finalizeAuthorization(
          archiveId,
          "completed",
          "completed",
          successAudit,
          portable,
        );
      } else {
        await this.appendAudit(successAudit);
      }
      return {
        archiveId,
        archive: portable.archive,
        sha256: portable.sha256,
        bytes: portable.archive.byteLength,
        mode: projection.mode,
        counts: projection.counts,
      };
    } catch (error) {
      portable?.archive.fill(0);
      const mapped = mapError(error);
      const failureAudit = auditInput({
        actor: input.actor,
        archiveId,
        correlationId: input.correlationId,
        includeSecrets: input.includeSecrets,
        ...(projection === undefined ? {} : { counts: projection.counts }),
        result: "error",
        failureCode: `backup.${mapped.code}`,
      });
      if (authorizationClaimed) {
        await this.finalizeAuthorization(
          archiveId,
          "failed",
          mapped.code,
          failureAudit,
        );
      } else {
        await this.appendAudit(failureAudit);
      }
      throw mapped;
    } finally {
      this.#active -= 1;
      encryptedSecrets?.fill(0);
      if (projection !== undefined) {
        for (const document of Object.values(projection.documents)) {
          document.fill(0);
        }
      }
      wipe(input.passphrase);
    }
  }

  private async authorizedActor(
    actor: ControlAuthenticationContext,
    includeSecrets: boolean,
    now: number,
  ): Promise<boolean> {
    if (!isUuidV7(actor.principalId)) return false;
    return this.owner.execute({
      run: (database) => database.read((query) => {
        if (
          actor.method === "browser_session"
          && actor.role === "superadmin"
        ) {
          return query.get<{ id: string }>(`
            SELECT id FROM users
            WHERE id = ? AND role = 'superadmin' AND status = 'active'
          `, [actor.principalId]) !== undefined;
        }
        if (
          !includeSecrets
          && actor.method === "api_key"
          && actor.role === "system"
          && actor.apiKey !== undefined
          && actor.apiKey.serviceId === undefined
        ) {
          const row = query.get<{
            nickname: string;
            last_four: string;
          }>(`
            SELECT nickname, last_four FROM api_keys
            WHERE id = ? AND api_role = 'system' AND service_id IS NULL
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > ?)
          `, [actor.principalId, now]);
          return row?.nickname === actor.apiKey.nickname
            && row.last_four === actor.apiKey.lastFour;
        }
        return false;
      }),
    }).catch(() => false);
  }

  private takeRate(principalId: string, now: number): boolean {
    for (const [id, entry] of this.#rate) {
      if (entry.resetAt <= now) this.#rate.delete(id);
    }
    const current = this.#rate.get(principalId);
    if (current !== undefined && current.resetAt > now) {
      if (current.count >= RATE_ATTEMPTS) return false;
      current.count += 1;
      return true;
    }
    if (this.#rate.size >= MAX_RATE_ENTRIES) return false;
    this.#rate.set(principalId, {
      count: 1,
      resetAt: now + RATE_WINDOW_MS,
    });
    return true;
  }

  private async issueAuthorization(input: {
    id: string;
    subjectUserId: string;
    operationDigest: string;
    credentialCount: number;
    now: number;
  }): Promise<void> {
    const inserted = await this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        cleanupExpired(transaction, input.now);
        return transaction.run(`
          INSERT INTO backup_export_authorizations (
            id, subject_user_id, operation_digest, state, credential_count,
            expires_at, version, created_at, updated_at
          ) VALUES (?, ?, ?, 'issued', ?, ?, 1, ?, ?)
        `, [
          input.id,
          input.subjectUserId,
          input.operationDigest,
          input.credentialCount,
          input.now + AUTHORIZATION_TTL_MS,
          input.now,
          input.now,
        ]).changes;
      }),
    }).catch(() => 0);
    if (inserted !== 1) throw new BackupCoordinatorError("export_failed");
  }

  private async finalizeAuthorization(
    id: string,
    state: "completed" | "failed",
    outcomeCode: string,
    audit: AdministrativeAuditEventInput,
    archive?: PortableArchiveResult,
  ): Promise<void> {
    const now = safeNow(this.now);
    const updated = await this.owner.execute({
      run: (database) => database.withGeneratedAdministrativeAuditOutcome(
        (transaction) => ({
          value: transaction.run(`
            UPDATE backup_export_authorizations
            SET state = ?, completed_at = ?, outcome_code = ?,
              archive_sha256 = ?, archive_bytes = ?,
              version = version + 1, updated_at = ?
            WHERE id = ? AND state = 'claimed'
          `, [
            state,
            now,
            outcomeCode,
            archive?.sha256 ?? null,
            archive?.archive.byteLength ?? null,
            now,
            id,
          ]).changes,
          auditInput: audit,
        }),
      ),
    });
    if (updated !== 1) throw new BackupCoordinatorError("export_failed");
  }

  private async appendAudit(
    input: AdministrativeAuditEventInput,
  ): Promise<void> {
    await this.owner.execute({
      run: (database) => {
        database.appendAdministrativeAudit(input);
      },
    });
  }

  private async cleanupExpired(): Promise<void> {
    const now = safeNow(this.now);
    await this.owner.execute({
      run: (database) => database.withOperationalTransaction(
        (transaction) => cleanupExpired(transaction, now),
      ),
    });
  }
}

function validateRequest(input: {
  actor: ControlAuthenticationContext;
  includeSecrets: boolean;
  acknowledgement: string;
  correlationId: string;
  passphrase?: Uint8Array;
}): void {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.actor !== "object"
    || input.actor === null
    || typeof input.includeSecrets !== "boolean"
    || input.acknowledgement !== PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT
    || !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(input.correlationId)
    || (input.includeSecrets
      ? !(input.passphrase instanceof Uint8Array)
        || input.passphrase.byteLength < 12
        || input.passphrase.byteLength > 1_024
      : input.passphrase !== undefined)
  ) {
    wipe(input?.passphrase);
    throw new BackupCoordinatorError("invalid");
  }
}

function claimAuthorization(
  transaction: PersistenceTransaction,
  id: string,
  now: number,
): boolean {
  return transaction.run(`
    UPDATE backup_export_authorizations
    SET state = 'claimed', claimed_at = ?,
      version = version + 1, updated_at = ?
    WHERE id = ? AND state = 'issued' AND expires_at > ?
  `, [now, now, id, now]).changes === 1;
}

function cleanupExpired(
  transaction: PersistenceTransaction,
  now: number,
): number {
  return transaction.run(`
    DELETE FROM backup_export_authorizations
    WHERE id IN (
      SELECT id FROM backup_export_authorizations
      WHERE expires_at <= ?
      ORDER BY expires_at, id
      LIMIT ?
    )
  `, [now, CLEANUP_LIMIT]).changes;
}

function authorizationAudit(
  actor: ControlAuthenticationContext,
  archiveId: string,
  correlationId: string,
  includeSecrets: boolean,
): AdministrativeAuditEventInput {
  return {
    actor: administrativeActorSnapshot(actor),
    action: "backup.authorize",
    category: "authorization",
    result: "allow",
    target: {
      type: "portable_backup",
      id: archiveId,
      label: `portable-backup:${archiveId}`,
    },
    changes: [{
      field: "mode",
      after: includeSecrets ? "encrypted-secrets" : "credential-less",
    }],
    correlationId,
    source: { category: "backup" },
  };
}

function auditInput(input: {
  actor: ControlAuthenticationContext;
  archiveId: string;
  correlationId: string;
  includeSecrets: boolean;
  counts?: PortableBackupProjection["counts"];
  archiveBytes?: number;
  archiveSha256?: string;
  result: "allow" | "deny" | "error";
  failureCode?: string;
}): AdministrativeAuditEventInput {
  return {
    actor: administrativeActorSnapshot(input.actor),
    action: "backup.export",
    category: "system",
    result: input.result,
    target: {
      type: "portable_backup",
      id: input.archiveId,
      label: `portable-backup:${input.archiveId}`,
    },
    changes: [
      {
        field: "mode",
        after: input.includeSecrets
          ? "encrypted-secrets"
          : "credential-less",
      },
      {
        field: "acknowledgement",
        after: PORTABLE_BACKUP_EXCLUSIONS_ACKNOWLEDGEMENT,
      },
      {
        field: "included_domains",
        after: PORTABLE_INCLUDED_DOMAINS.join(","),
      },
      {
        field: "excluded_domains",
        after: PORTABLE_EXCLUDED_DOMAINS.join(","),
      },
      ...(input.counts === undefined
        ? []
        : Object.entries(input.counts).map(([field, count]) => ({
            field: field === "secrets"
              ? "encrypted_record_count"
              : `${field}_count`,
            after: count,
          }))),
      ...(input.archiveBytes === undefined
        ? []
        : [{ field: "archive_bytes", after: input.archiveBytes }]),
      ...(input.archiveSha256 === undefined
        ? []
        : [{ field: "archive_sha256", after: input.archiveSha256 }]),
    ],
    correlationId: input.correlationId,
    source: { category: "backup" },
    ...(input.failureCode === undefined
      ? {}
      : { failureCode: input.failureCode }),
  };
}

function mapError(error: unknown): BackupCoordinatorError {
  return error instanceof BackupCoordinatorError
    ? error
    : new BackupCoordinatorError("export_failed");
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BackupCoordinatorError("export_failed");
  }
  return value;
}

function wipe(value: Uint8Array | undefined): void {
  if (value !== undefined) {
    Buffer.from(value.buffer, value.byteOffset, value.byteLength).fill(0);
  }
}
