import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import { PersistenceError } from "./persistence/errors.js";
import type { PersistenceTransaction } from "./persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import type { SecuritySettings } from "./securitySettings.js";
import type { AlwaysStepUpHandle, StepUpRepository } from "./identity/stepUp.js";

interface Candidate {
  id: string;
  role: "superadmin" | "admin" | "user";
  status: "active" | "suspended";
  version: number;
  last_qualifying_activity_at: number;
  suspended_at: number | null;
  suspension_origin: "manual" | "inactivity" | null;
}

export interface InactivityJobState {
  nextRunAt: number;
  leaseExpiresAt: number | null;
  lastStartedAt: number | null;
  lastCompletedAt: number | null;
  lastOutcome: "completed" | "partial" | "skipped" | "error" | null;
  lastCode: string | null;
  suspendedCount: number;
  deactivatedCount: number;
  protectedCount: number;
  version: number;
}

export class InactivityJob {
  readonly #ownerId: string;
  readonly #uuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    private readonly settings: () => SecuritySettings,
    private readonly now: () => number = Date.now,
    options: { ownerId?: string; uuid?: () => string } = {},
  ) {
    const generator = new UuidV7Generator({ now });
    this.#ownerId = options.ownerId ?? generator.next();
    if (!isUuidV7(this.#ownerId)) {
      throw new Error("Inactivity job owner must be UUIDv7.");
    }
    this.#uuid = options.uuid ?? (() => generator.next());
  }

  async state(): Promise<InactivityJobState> {
    return this.owner.execute({
      run: (database) => database.read((query) => {
        const row = query.get<{
          next_run_at: number;
          lease_expires_at: number | null;
          last_started_at: number | null;
          last_completed_at: number | null;
          last_outcome: InactivityJobState["lastOutcome"];
          last_code: string | null;
          suspended_count: number;
          deactivated_count: number;
          protected_count: number;
          version: number;
        }>("SELECT * FROM security_job_state WHERE job_name = 'inactivity'");
        if (row === undefined) throw new PersistenceError("database_unavailable");
        return {
          nextRunAt: row.next_run_at,
          leaseExpiresAt: row.lease_expires_at,
          lastStartedAt: row.last_started_at,
          lastCompletedAt: row.last_completed_at,
          lastOutcome: row.last_outcome,
          lastCode: row.last_code,
          suspendedCount: row.suspended_count,
          deactivatedCount: row.deactivated_count,
          protectedCount: row.protected_count,
          version: row.version,
        };
      }),
    });
  }

  async run(
    force = false,
    authorization?: {
      proof: AlwaysStepUpHandle;
      stepUps: Pick<StepUpRepository, "withConsumedProof">;
      audit: AdministrativeAuditEventInput;
    },
  ): Promise<InactivityJobState> {
    const startedAt = safeNow(this.now);
    const settings = this.settings();
    const acquired = authorization === undefined
      ? await this.acquire(startedAt, settings.securityJobWallTimeMs, force)
      : await authorization.stepUps.withConsumedProof(
          authorization.proof,
          authorization.audit,
          (transaction) => this.acquireTransaction(
            transaction,
            startedAt,
            settings.securityJobWallTimeMs,
            force,
          ),
        );
    if (!acquired) return this.state();
    let suspended = 0;
    let deactivated = 0;
    let protectedCount = 0;
    let partial = false;
    try {
      const deadline = startedAt + settings.securityJobWallTimeMs;
      while (suspended + deactivated < settings.securityJobBatchSize) {
        if (safeNow(this.now) >= deadline) {
          partial = true;
          break;
        }
        const transition = await this.transitionOne(settings, startedAt);
        if (transition === "none") break;
        if (transition === "suspended") suspended += 1;
        if (transition === "deactivated") deactivated += 1;
        if (transition === "protected") {
          protectedCount += 1;
          break;
        }
      }
      if (suspended + deactivated >= settings.securityJobBatchSize) {
        partial = await this.hasCandidate(settings, startedAt);
      }
      return await this.complete(
        safeNow(this.now),
        settings,
        partial ? "partial" : (
          settings.inactivitySuspensionDays === null
          && settings.suspendedDeactivationDays === null
            ? "skipped"
            : "completed"
        ),
        partial ? "batch_or_wall_limit" : (
          protectedCount > 0 ? "last_superadmin_protected" : "ok"
        ),
        suspended,
        deactivated,
        protectedCount,
      );
    } catch (error) {
      await this.complete(
        safeNow(this.now),
        settings,
        "error",
        "job_failed",
        suspended,
        deactivated,
        protectedCount,
      ).catch(() => undefined);
      throw error;
    }
  }

  private async acquire(
    now: number,
    wallTimeMs: number,
    force: boolean,
  ): Promise<boolean> {
    return this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) =>
        this.acquireTransaction(transaction, now, wallTimeMs, force)),
    });
  }

  private acquireTransaction(
    transaction: PersistenceTransaction,
    now: number,
    wallTimeMs: number,
    force: boolean,
  ): boolean {
    const result = transaction.run(`
          UPDATE security_job_state
          SET lease_owner = ?, lease_expires_at = ?,
              last_started_at = ?, last_outcome = NULL, last_code = NULL,
              version = version + 1, updated_at = ?
          WHERE job_name = 'inactivity'
            AND (? = 1 OR next_run_at <= ?)
            AND (lease_owner IS NULL OR lease_expires_at <= ?)
        `, [
          this.#ownerId,
          now + wallTimeMs + 60_000,
          now,
          now,
          force ? 1 : 0,
          now,
          now,
        ]);
    return result.changes === 1;
  }

  private async transitionOne(
    settings: SecuritySettings,
    now: number,
  ): Promise<"suspended" | "deactivated" | "protected" | "none"> {
    return this.owner.execute({
      run: (database) => {
        const suspensionCutoff = settings.inactivitySuspensionDays === null
          ? undefined
          : now - settings.inactivitySuspensionDays * 86_400_000;
        const deactivationCutoff =
          settings.suspendedDeactivationDays === null
            ? undefined
            : now - settings.suspendedDeactivationDays * 86_400_000;
        const candidate = database.read((query) => query.get<Candidate>(`
          SELECT id, role, status, version, last_qualifying_activity_at,
            suspended_at, suspension_origin
          FROM users
          WHERE ((
              ? IS NOT NULL AND status = 'active'
              AND last_qualifying_activity_at <= ?
            ) OR (
              ? IS NOT NULL AND status = 'suspended'
              AND suspended_at <= ?
            ))
            AND NOT (
              role = 'superadmin' AND status = 'active'
              AND (
                SELECT count(*) FROM users
                WHERE role = 'superadmin' AND status = 'active'
              ) <= 1
            )
          ORDER BY
            CASE role WHEN 'superadmin' THEN 1 ELSE 0 END,
            CASE status
              WHEN 'active' THEN last_qualifying_activity_at
              ELSE suspended_at
            END,
            id
          LIMIT 1
        `, [
          suspensionCutoff ?? null,
          suspensionCutoff ?? 0,
          deactivationCutoff ?? null,
          deactivationCutoff ?? 0,
        ]));
        if (candidate === undefined) {
          if (
            suspensionCutoff !== undefined
            && database.read((query) => query.get<{ present: number }>(`
              SELECT 1 AS present FROM users
              WHERE role = 'superadmin' AND status = 'active'
                AND last_qualifying_activity_at <= ?
                AND (
                  SELECT count(*) FROM users
                  WHERE role = 'superadmin' AND status = 'active'
                ) <= 1
              LIMIT 1
            `, [suspensionCutoff])) !== undefined
          ) return "protected";
          return "none";
        }
        return database.withGeneratedAdministrativeAudit((transaction) => {
          const eventId = this.#uuid();
          if (!isUuidV7(eventId)) throw new PersistenceError("database_unavailable");
          const counts = revokeSessions(transaction, candidate.id, now);
          if (candidate.status === "active") {
            const updated = transaction.run(`
              UPDATE users
              SET status = 'suspended', suspended_at = ?,
                  suspension_origin = 'inactivity',
                  suspension_rule_version = ?,
                  security_epoch = security_epoch + 1,
                  version = version + 1, updated_at = ?
              WHERE id = ? AND version = ? AND status = 'active'
                AND last_qualifying_activity_at <= ?
            `, [
              now,
              settings.version,
              now,
              candidate.id,
              candidate.version,
              suspensionCutoff ?? 0,
            ]);
            if (updated.changes !== 1) throw new PersistenceError("identity_stale");
            insertInvalidation(
              transaction,
              eventId,
              candidate.id,
              "suspension",
              counts,
              now,
            );
            return {
              value: "suspended" as const,
              auditInput: automatedAudit(
                candidate,
                "suspended",
                settings.version,
                now,
              ),
            };
          }
          transaction.run("DELETE FROM local_password_credentials WHERE user_id = ?", [candidate.id]);
          transaction.run("DELETE FROM local_totp_authenticators WHERE user_id = ?", [candidate.id]);
          transaction.run("DELETE FROM identity_temporary_passwords WHERE user_id = ?", [candidate.id]);
          transaction.run("DELETE FROM identity_pending_totp WHERE user_id = ?", [candidate.id]);
          transaction.run(`
            UPDATE local_authenticator_states
            SET password_state = 'disabled', totp_state = 'disabled',
                version = version + 1, updated_at = ?
            WHERE user_id = ?
          `, [now, candidate.id]);
          const updated = transaction.run(`
            UPDATE users
            SET status = 'deactivated', suspended_at = NULL,
                suspension_origin = NULL, suspension_rule_version = NULL,
                security_epoch = security_epoch + 1,
                version = version + 1, updated_at = ?
            WHERE id = ? AND version = ? AND status = 'suspended'
              AND suspended_at <= ?
          `, [now, candidate.id, candidate.version, deactivationCutoff ?? 0]);
          if (updated.changes !== 1) throw new PersistenceError("identity_stale");
          insertInvalidation(
            transaction,
            eventId,
            candidate.id,
            "deactivation",
            counts,
            now,
          );
          return {
            value: "deactivated" as const,
            auditInput: automatedAudit(
              candidate,
              "deactivated",
              settings.version,
              now,
            ),
          };
        });
      },
    });
  }

  private async hasCandidate(
    settings: SecuritySettings,
    now: number,
  ): Promise<boolean> {
    const suspend = settings.inactivitySuspensionDays === null
      ? undefined
      : now - settings.inactivitySuspensionDays * 86_400_000;
    const deactivate = settings.suspendedDeactivationDays === null
      ? undefined
      : now - settings.suspendedDeactivationDays * 86_400_000;
    return this.owner.execute({
      run: (database) => database.read((query) => query.get<{ present: number }>(`
        SELECT 1 AS present FROM users
        WHERE (? IS NOT NULL AND status = 'active'
          AND last_qualifying_activity_at <= ?)
          OR (? IS NOT NULL AND status = 'suspended'
            AND suspended_at <= ?)
        LIMIT 1
      `, [suspend ?? null, suspend ?? 0, deactivate ?? null, deactivate ?? 0]))
        !== undefined,
    });
  }

  private async complete(
    now: number,
    settings: SecuritySettings,
    outcome: NonNullable<InactivityJobState["lastOutcome"]>,
    code: string,
    suspended: number,
    deactivated: number,
    protectedCount: number,
  ): Promise<InactivityJobState> {
    await this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const result = transaction.run(`
          UPDATE security_job_state
          SET next_run_at = ?, lease_owner = NULL, lease_expires_at = NULL,
              cursor_time = NULL, cursor_id = NULL,
              last_completed_at = ?, last_outcome = ?, last_code = ?,
              suspended_count = ?, deactivated_count = ?,
              protected_count = ?, version = version + 1, updated_at = ?
          WHERE job_name = 'inactivity' AND lease_owner = ?
        `, [
          now + settings.securityJobIntervalMs,
          now,
          outcome,
          code,
          suspended,
          deactivated,
          protectedCount,
          now,
          this.#ownerId,
        ]);
        if (result.changes !== 1) throw new PersistenceError("database_unavailable");
      }),
    });
    return this.state();
  }
}

function revokeSessions(
  transaction: PersistenceTransaction,
  userId: string,
  now: number,
): { browser: number; restricted: number } {
  const browser = Number(transaction.run(`
    UPDATE browser_sessions SET revoked_at = ?, version = version + 1
    WHERE user_id = ? AND revoked_at IS NULL
  `, [now, userId]).changes);
  const restricted = Number(transaction.run(`
    UPDATE identity_restricted_sessions SET revoked_at = ?, version = version + 1
    WHERE user_id = ? AND revoked_at IS NULL
  `, [now, userId]).changes);
  return { browser, restricted };
}

function insertInvalidation(
  transaction: PersistenceTransaction,
  id: string,
  userId: string,
  reason: string,
  counts: { browser: number; restricted: number },
  now: number,
): void {
  transaction.run(`
    INSERT INTO identity_invalidation_events (
      id, user_id, reason, browser_sessions_revoked,
      restricted_sessions_revoked, created_at, dispatched_at, attempts
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
  `, [id, userId, reason, counts.browser, counts.restricted, now]);
}

function automatedAudit(
  candidate: Candidate,
  status: "suspended" | "deactivated",
  settingsVersion: number,
  now: number,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "system",
      label: "security-inactivity-job",
      authenticationMethod: "automation",
    },
    action: status === "suspended"
      ? "identity.inactivity_suspend"
      : "identity.inactivity_deactivate",
    result: "allow",
    target: {
      type: "user",
      id: candidate.id,
      label: `user:${candidate.id}`,
    },
    changes: [
      { field: "status", before: candidate.status, after: status },
      { field: "settings_version", after: settingsVersion },
      { field: "cutoff_evaluated_at", after: now },
      ...(candidate.suspension_origin === null
        ? []
        : [{ field: "prior_suspension_origin", before: candidate.suspension_origin }]),
    ],
    correlationId: `req_${candidate.id}`,
    source: { category: "security_automation" },
  };
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PersistenceError("database_unavailable");
  }
  return value;
}
