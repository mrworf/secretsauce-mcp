import { randomUUID } from "node:crypto";
import { projectHourlyActivity } from "./activityProjection.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import type {
  AuditCategory,
  RuntimeAuditProjection,
} from "./persistence/auditDocuments.js";
import { PersistenceError } from "./persistence/errors.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const RETENTION_MS = 400 * DAY_MS;
const BATCH_LIMIT = 1_000;
const LEASE_MS = 30_000;

export interface ActivityProjectionState {
  nextRunAt: number;
  leaseExpiresAt: number | null;
  cursorSequence: number;
  lastStartedAt: number | null;
  lastCompletedAt: number | null;
  lastOutcome: "completed" | "partial" | "skipped" | "error" | null;
  lastCode: string | null;
  projectedCount: number;
  deletedBucketCount: number;
  version: number;
}

interface StateRow {
  next_run_at: number;
  lease_expires_at: number | null;
  cursor_sequence: number;
  last_started_at: number | null;
  last_completed_at: number | null;
  last_outcome: ActivityProjectionState["lastOutcome"];
  last_code: string | null;
  projected_count: number;
  deleted_bucket_count: number;
  version: number;
}

type RuntimeRow = Record<string, unknown> & {
  sequence: number;
  event_id: string;
  occurred_at: number;
};

export class ActivityAggregationService {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
    private readonly uuid: () => string = randomUUID,
  ) {}

  async state(): Promise<ActivityProjectionState> {
    return this.owner.execute({
      run: (database) => database.read(readState),
    });
  }

  async run(): Promise<ActivityProjectionState> {
    const now = safeNow(this.now);
    const leaseOwner = this.uuid();
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(
          (transaction) => {
            const current = readState(transaction);
            if (
              current.leaseExpiresAt !== null
              && current.leaseExpiresAt > now
            ) {
              transaction.run(`
                UPDATE activity_projection_state
                SET last_outcome = 'skipped', last_code = 'lease_active',
                    version = version + 1, updated_at = ?
                WHERE singleton = 1
              `, [now]);
              return {
                value: readState(transaction),
                auditInput: maintenanceAudit("skipped", 0, 0),
              };
            }
            transaction.run(`
              UPDATE activity_projection_state
              SET lease_owner = ?, lease_expires_at = ?, last_started_at = ?,
                  last_outcome = NULL, last_code = NULL,
                  version = version + 1, updated_at = ?
              WHERE singleton = 1
            `, [leaseOwner, now + LEASE_MS, now, now]);

            const rows = transaction.all<RuntimeRow>(`
              SELECT *
              FROM runtime_audit_events
              WHERE sequence > ?
              ORDER BY sequence
              LIMIT ?
            `, [current.cursorSequence, BATCH_LIMIT]);
            let projectedCount = 0;
            for (const row of rows) {
              if (
                projectHourlyActivity(
                  transaction,
                  Number(row.sequence),
                  runtimeProjection(row),
                  now,
                )
              ) projectedCount += 1;
            }
            const cursor = rows.at(-1)?.sequence ?? current.cursorSequence;
            const deletedBucketCount = deleteExpiredBuckets(transaction, now);
            const deletedLedgerCount = deleteExpiredLedger(transaction, now);
            const partial =
              rows.length === BATCH_LIMIT
              || deletedBucketCount === BATCH_LIMIT
              || deletedLedgerCount === BATCH_LIMIT;
            transaction.run(`
              UPDATE activity_projection_state
              SET next_run_at = ?, lease_owner = NULL, lease_expires_at = NULL,
                  cursor_sequence = ?, last_completed_at = ?,
                  last_outcome = ?, last_code = ?, projected_count = ?,
                  deleted_bucket_count = ?, version = version + 1,
                  updated_at = ?
              WHERE singleton = 1 AND lease_owner = ?
            `, [
              now + HOUR_MS,
              cursor,
              now,
              partial ? "partial" : "completed",
              partial ? "batch_limit" : "ok",
              projectedCount,
              deletedBucketCount,
              now,
              leaseOwner,
            ]);
            return {
              value: readState(transaction),
              auditInput: maintenanceAudit(
                partial ? "partial" : "completed",
                projectedCount,
                deletedBucketCount,
              ),
            };
          },
        ),
      });
    } catch {
      throw new PersistenceError("database_unavailable");
    }
  }
}

function readState(query: PersistenceQuery): ActivityProjectionState {
  const row = query.get<StateRow>(`
    SELECT next_run_at, lease_expires_at, cursor_sequence, last_started_at,
      last_completed_at, last_outcome, last_code, projected_count,
      deleted_bucket_count, version
    FROM activity_projection_state WHERE singleton = 1
  `);
  if (row === undefined) throw new PersistenceError("database_unavailable");
  return {
    nextRunAt: row.next_run_at,
    leaseExpiresAt: row.lease_expires_at,
    cursorSequence: row.cursor_sequence,
    lastStartedAt: row.last_started_at,
    lastCompletedAt: row.last_completed_at,
    lastOutcome: row.last_outcome,
    lastCode: row.last_code,
    projectedCount: row.projected_count,
    deletedBucketCount: row.deleted_bucket_count,
    version: row.version,
  };
}

function deleteExpiredBuckets(
  transaction: PersistenceTransaction,
  now: number,
): number {
  const cutoff = Math.max(0, now - RETENTION_MS);
  const cutoffBucket = Math.floor(cutoff / HOUR_MS) * HOUR_MS;
  const buckets = transaction.all<{ bucket_start: number }>(`
    SELECT DISTINCT bucket_start
    FROM activity_hourly
    WHERE bucket_start < ?
    ORDER BY bucket_start
    LIMIT ?
  `, [cutoffBucket, BATCH_LIMIT]).map((row) => row.bucket_start);
  if (buckets.length === 0) return 0;
  const placeholders = buckets.map(() => "?").join(", ");
  transaction.run(
    `DELETE FROM activity_hourly_subjects WHERE bucket_start IN (${placeholders})`,
    buckets,
  );
  transaction.run(
    `DELETE FROM activity_hourly WHERE bucket_start IN (${placeholders})`,
    buckets,
  );
  return buckets.length;
}

function deleteExpiredLedger(
  transaction: PersistenceTransaction,
  now: number,
): number {
  const cutoff = Math.max(0, now - RETENTION_MS);
  const rows = transaction.all<{ event_id: string }>(`
    SELECT projected.event_id
    FROM activity_projected_events AS projected
    LEFT JOIN runtime_audit_events AS events
      ON events.sequence = projected.sequence
    WHERE events.sequence IS NULL OR events.occurred_at < ?
    ORDER BY projected.sequence
    LIMIT ?
  `, [cutoff, BATCH_LIMIT]);
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.event_id);
  transaction.run(
    `DELETE FROM activity_projected_events WHERE event_id IN (${
      ids.map(() => "?").join(", ")
    })`,
    ids,
  );
  return ids.length;
}

function runtimeProjection(row: RuntimeRow): RuntimeAuditProjection {
  return {
    eventId: String(row.event_id),
    occurredAt: Number(row.occurred_at),
    eventType: String(row.event_type),
    outcome: String(row.outcome) as RuntimeAuditProjection["outcome"],
    category: String(row.category) as AuditCategory,
    actorType: String(row.actor_type) as RuntimeAuditProjection["actorType"],
    ...(row.subject_id_snapshot === null
      ? {}
      : { subjectId: String(row.subject_id_snapshot) }),
    subjectLabel: String(row.subject_label_snapshot),
    ...(row.service_id_snapshot === null
      ? {}
      : { serviceId: String(row.service_id_snapshot) }),
    ...(row.service_label_snapshot === null
      ? {}
      : { serviceLabel: String(row.service_label_snapshot) }),
    ...(row.destination === null ? {} : { destination: String(row.destination) }),
    ...(row.action === null ? {} : { action: String(row.action) }),
    ...(row.method === null ? {} : { method: String(row.method) }),
    ...(row.target_host === null ? {} : { targetHost: String(row.target_host) }),
    ...(row.target_path === null ? {} : { targetPath: String(row.target_path) }),
    ...(row.downstream_status === null
      ? {}
      : { downstreamStatus: Number(row.downstream_status) }),
    ...(row.policy_rule === null ? {} : { policyRule: String(row.policy_rule) }),
    ...(row.reason === null ? {} : { reason: String(row.reason) }),
    ...(row.failure_code === null ? {} : { failureCode: String(row.failure_code) }),
    ...(row.correlation_id === null
      ? {}
      : { correlationId: String(row.correlation_id) }),
    source: JSON.parse(String(row.source_json)) as RuntimeAuditProjection["source"],
    ...(row.duration_ms === null ? {} : { durationMs: Number(row.duration_ms) }),
    ...(row.tls_verify === null
      ? {}
      : { tlsVerify: Number(row.tls_verify) === 1 }),
    ...(row.tokenization_count === null
      ? {}
      : { tokenizationCount: Number(row.tokenization_count) }),
    credentialUseCount: Number(row.credential_use_count ?? 0),
    details: JSON.parse(String(row.details_json)) as RuntimeAuditProjection["details"],
  };
}

function maintenanceAudit(
  outcome: "completed" | "partial" | "skipped",
  projected: number,
  deletedBuckets: number,
): AdministrativeAuditEventInput {
  return {
    actor: {
      type: "job",
      label: "job:activity-projection",
      role: "system",
      authenticationMethod: "job",
    },
    action: "activity.projection.run",
    category: "audit",
    result: "allow",
    target: { type: "activity_projection", label: "activity-projection" },
    changes: [
      { field: "outcome", after: outcome },
      { field: "projected_count", after: projected },
      { field: "deleted_bucket_count", after: deletedBuckets },
    ],
    correlationId: randomUUID(),
    source: { category: "job" },
  };
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PersistenceError("database_unavailable");
  }
  return value;
}
