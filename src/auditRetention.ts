import { randomUUID } from "node:crypto";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import type {
  AlwaysStepUpHandle,
  StepUpRepository,
} from "./identity/stepUp.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import { PersistenceError } from "./persistence/errors.js";
import {
  canonicalAdministrativeAuditDocument,
  canonicalRuntimeAuditDocument,
  type AuditCategory,
  type RuntimeAuditProjection,
} from "./persistence/auditDocuments.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import { administrativeActorSnapshot } from "./apiKeyAuthority.js";

const DAY_MS = 86_400_000;
const BATCH_LIMIT = 1_000;
const PLANNING_THRESHOLD_BYTES = 1_073_741_824;

export interface AuditRetentionSettings {
  administrativeDays: number | null;
  runtimeDays: number | null;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface AuditDomainCapacity {
  rowCount: number;
  oldestOccurredAt: number | null;
  newestOccurredAt: number | null;
  estimatedBytes: number;
  warnings: string[];
}

export interface AuditMaintenanceState {
  nextRunAt: number;
  leaseExpiresAt: number | null;
  lastStartedAt: number | null;
  lastCompletedAt: number | null;
  lastOutcome: "completed" | "partial" | "skipped" | "error" | null;
  lastCode: string | null;
  retainedAdministrativeCount: number;
  retainedRuntimeCount: number;
  repairedIndexCount: number;
  version: number;
}

export interface AuditRetentionOverview {
  settings: AuditRetentionSettings;
  administrative: AuditDomainCapacity;
  runtime: AuditDomainCapacity;
  maintenance: AuditMaintenanceState;
}

export class AuditRetentionError extends Error {
  constructor(
    readonly code: "forbidden" | "invalid" | "stale" | "unavailable",
  ) {
    super(code);
    this.name = "AuditRetentionError";
  }
}

interface RetentionRow {
  administrative_days: number | null;
  runtime_days: number | null;
  version: number;
  created_at: number;
  updated_at: number;
}

interface MaintenanceRow {
  next_run_at: number;
  lease_expires_at: number | null;
  last_started_at: number | null;
  last_completed_at: number | null;
  last_outcome: AuditMaintenanceState["lastOutcome"];
  last_code: string | null;
  retained_administrative_count: number;
  retained_runtime_count: number;
  repaired_index_count: number;
  version: number;
}

export class AuditRetentionService {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
    private readonly uuid: () => string = randomUUID,
    private readonly stepUps?: Pick<StepUpRepository, "withConsumedProofGenerated">,
  ) {}

  async overview(actor: ControlAuthenticationContext): Promise<AuditRetentionOverview> {
    requireSuperadmin(actor);
    return this.owner.execute({
      run: (database) => database.read((query) => readOverview(query)),
    });
  }

  async update(input: {
    actor: ControlAuthenticationContext;
    expectedVersion: number;
    administrativeDays: number | null;
    runtimeDays: number | null;
    justification: string;
    correlationId: string;
    proof?: AlwaysStepUpHandle;
  }): Promise<AuditRetentionOverview> {
    requireSuperadmin(input.actor);
    validateDays(input.administrativeDays);
    validateDays(input.runtimeDays);
    const now = safeNow(this.now);
    const mutate = (
      transaction: PersistenceTransaction,
    ): { value: AuditRetentionOverview; auditInput: AdministrativeAuditEventInput } => {
      const current = readRetention(transaction);
      if (current.version !== input.expectedVersion) {
        throw new PersistenceError("audit_retention_stale");
      }
      if (
        current.administrativeDays === input.administrativeDays
        && current.runtimeDays === input.runtimeDays
      ) throw new PersistenceError("audit_retention_invalid");
      const result = transaction.run(`
        UPDATE audit_retention_settings
        SET administrative_days = ?, runtime_days = ?,
            version = version + 1, updated_at = ?
        WHERE singleton = 1 AND version = ?
      `, [
        input.administrativeDays,
        input.runtimeDays,
        now,
        input.expectedVersion,
      ]);
      if (result.changes !== 1) throw new PersistenceError("audit_retention_stale");
      return {
        value: readOverview(transaction),
        auditInput: {
          actor: administrativeActorSnapshot(input.actor),
          action: "audit.retention.update",
          category: "audit",
          result: "allow",
          target: { type: "audit_retention", label: "audit-retention-settings" },
          justification: input.justification,
          changes: [
            {
              field: "administrative_days",
              before: current.administrativeDays,
              after: input.administrativeDays,
            },
            {
              field: "runtime_days",
              before: current.runtimeDays,
              after: input.runtimeDays,
            },
          ],
          correlationId: input.correlationId,
          source: { category: "audit" },
        },
      };
    };
    try {
      if (input.proof !== undefined) {
        if (this.stepUps === undefined) throw new AuditRetentionError("unavailable");
        return await this.stepUps.withConsumedProofGenerated(input.proof, mutate);
      }
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(mutate),
      });
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async run(input?: {
    actor: ControlAuthenticationContext;
    justification: string;
    correlationId: string;
    proof: AlwaysStepUpHandle;
  }): Promise<AuditRetentionOverview> {
    if (input !== undefined) requireSuperadmin(input.actor);
    const now = safeNow(this.now);
    const leaseOwner = this.uuid();
    const mutate = (
      transaction: PersistenceTransaction,
    ): { value: AuditRetentionOverview; auditInput: AdministrativeAuditEventInput } => {
      const state = readMaintenance(transaction);
      if (state.leaseExpiresAt !== null && state.leaseExpiresAt > now) {
        return {
          value: readOverview(transaction),
          auditInput: maintenanceAudit(input, "skipped", 0, 0, 0),
        };
      }
      transaction.run(`
        UPDATE audit_maintenance_state
        SET lease_owner = ?, lease_expires_at = ?, last_started_at = ?,
            last_outcome = NULL, last_code = NULL, version = version + 1,
            updated_at = ?
        WHERE singleton = 1
      `, [leaseOwner, now + 30_000, now, now]);
      const settings = readRetention(transaction);
      const administrative = deleteExpired(
        transaction,
        "administrative",
        settings.administrativeDays,
        now,
      );
      const runtime = deleteExpired(
        transaction,
        "runtime",
        settings.runtimeDays,
        now,
      );
      const repaired = repairIndexes(transaction, BATCH_LIMIT);
      const partial =
        administrative === BATCH_LIMIT
        || runtime === BATCH_LIMIT
        || repaired === BATCH_LIMIT;
      transaction.run(`
        UPDATE audit_maintenance_state
        SET next_run_at = ?, lease_owner = NULL, lease_expires_at = NULL,
            last_completed_at = ?, last_outcome = ?, last_code = ?,
            retained_administrative_count = ?,
            retained_runtime_count = ?, repaired_index_count = ?,
            version = version + 1, updated_at = ?
        WHERE singleton = 1 AND lease_owner = ?
      `, [
        now + 3_600_000,
        now,
        partial ? "partial" : "completed",
        partial ? "batch_limit" : "ok",
        administrative,
        runtime,
        repaired,
        now,
        leaseOwner,
      ]);
      return {
        value: readOverview(transaction),
        auditInput: maintenanceAudit(
          input,
          partial ? "partial" : "completed",
          administrative,
          runtime,
          repaired,
        ),
      };
    };
    try {
      if (input !== undefined) {
        if (this.stepUps === undefined) throw new AuditRetentionError("unavailable");
        return await this.stepUps.withConsumedProofGenerated(input.proof, mutate);
      }
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit(mutate),
      });
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

function readOverview(query: PersistenceQuery): AuditRetentionOverview {
  const settings = readRetention(query);
  const maintenance = readMaintenance(query);
  return {
    settings,
    administrative: capacity(query, "administrative", settings.administrativeDays),
    runtime: capacity(query, "runtime", settings.runtimeDays),
    maintenance,
  };
}

function readRetention(query: PersistenceQuery): AuditRetentionSettings {
  const row = query.get<RetentionRow>(`
    SELECT administrative_days, runtime_days, version, created_at, updated_at
    FROM audit_retention_settings WHERE singleton = 1
  `);
  if (row === undefined) throw new AuditRetentionError("unavailable");
  return {
    administrativeDays: row.administrative_days,
    runtimeDays: row.runtime_days,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readMaintenance(query: PersistenceQuery): AuditMaintenanceState {
  const row = query.get<MaintenanceRow>(`
    SELECT next_run_at, lease_expires_at, last_started_at, last_completed_at,
           last_outcome, last_code, retained_administrative_count,
           retained_runtime_count, repaired_index_count, version
    FROM audit_maintenance_state WHERE singleton = 1
  `);
  if (row === undefined) throw new AuditRetentionError("unavailable");
  return {
    nextRunAt: row.next_run_at,
    leaseExpiresAt: row.lease_expires_at,
    lastStartedAt: row.last_started_at,
    lastCompletedAt: row.last_completed_at,
    lastOutcome: row.last_outcome,
    lastCode: row.last_code,
    retainedAdministrativeCount: row.retained_administrative_count,
    retainedRuntimeCount: row.retained_runtime_count,
    repairedIndexCount: row.repaired_index_count,
    version: row.version,
  };
}

function capacity(
  query: PersistenceQuery,
  domain: "administrative" | "runtime",
  retentionDays: number | null,
): AuditDomainCapacity {
  const table = `${domain}_audit_events`;
  const index = `${domain}_audit_fts`;
  const row = query.get<{
    row_count: number;
    oldest: number | null;
    newest: number | null;
  }>(`
    SELECT count(*) AS row_count, min(occurred_at) AS oldest, max(occurred_at) AS newest
    FROM ${table}
  `)!;
  const bytes = query.get<{ bytes: number | null }>(`
    SELECT sum(pgsize) AS bytes FROM dbstat
    WHERE name IN (?, ?)
  `, [table, index])?.bytes ?? 0;
  const warnings = [
    ...(retentionDays !== null && retentionDays > 400
      ? ["retention_above_default"]
      : []),
    ...(retentionDays === null
      ? ["unlimited_retention_requires_capacity_planning"]
      : []),
    ...(bytes > PLANNING_THRESHOLD_BYTES
      ? ["audit_storage_above_planning_threshold"]
      : []),
  ];
  return {
    rowCount: row.row_count,
    oldestOccurredAt: row.oldest,
    newestOccurredAt: row.newest,
    estimatedBytes: bytes,
    warnings,
  };
}

function deleteExpired(
  transaction: PersistenceTransaction,
  domain: "administrative" | "runtime",
  retentionDays: number | null,
  now: number,
): number {
  if (retentionDays === null) return 0;
  const table = `${domain}_audit_events`;
  const index = `${domain}_audit_fts`;
  const cutoff = now - retentionDays * DAY_MS;
  const rows = transaction.all<{ sequence: number }>(`
    SELECT sequence FROM ${table}
    WHERE occurred_at <= ?
    ORDER BY occurred_at, sequence
    LIMIT ?
  `, [cutoff, BATCH_LIMIT]);
  for (const row of rows) {
    transaction.run(`DELETE FROM ${index} WHERE rowid = ?`, [row.sequence]);
    transaction.run(`DELETE FROM ${table} WHERE sequence = ?`, [row.sequence]);
  }
  return rows.length;
}

function repairIndexes(transaction: PersistenceTransaction, limit: number): number {
  let repaired = 0;
  for (const domain of ["administrative", "runtime"] as const) {
    if (repaired >= limit) break;
    const table = `${domain}_audit_events`;
    const index = `${domain}_audit_fts`;
    const rows = transaction.all<Record<string, unknown>>(`
      SELECT events.*
      FROM ${table} AS events
      LEFT JOIN ${index} AS search_index ON search_index.rowid = events.sequence
      WHERE search_index.rowid IS NULL
      ORDER BY events.sequence
      LIMIT ?
    `, [limit - repaired]);
    for (const row of rows) {
      const document = domain === "administrative"
        ? canonicalAdministrativeAuditDocument(administrativeDocument(row))
        : canonicalRuntimeAuditDocument(runtimeDocument(row));
      transaction.run(
        `INSERT INTO ${index} (rowid, event_id, document) VALUES (?, ?, ?)`,
        [Number(row.sequence), String(row.event_id), document],
      );
      repaired += 1;
    }
  }
  return repaired;
}

function administrativeDocument(row: Record<string, unknown>) {
  return {
    category: String(row.category) as AuditCategory,
    actor: {
      type: String(row.actor_type),
      ...(row.actor_id_snapshot === null ? {} : { id: String(row.actor_id_snapshot) }),
      label: String(row.actor_label_snapshot),
      ...(row.actor_role_snapshot === null ? {} : { role: String(row.actor_role_snapshot) }),
      authenticationMethod: String(row.authentication_method),
    },
    action: String(row.action),
    result: String(row.result),
    target: {
      type: String(row.target_type),
      ...(row.target_id_snapshot === null ? {} : { id: String(row.target_id_snapshot) }),
      label: String(row.target_label_snapshot),
    },
    ...(row.service_id_snapshot === null ? {} : { serviceId: String(row.service_id_snapshot) }),
    ...(row.service_label_snapshot === null
      ? {}
      : { serviceLabel: String(row.service_label_snapshot) }),
    ...(row.justification === null ? {} : { justification: String(row.justification) }),
    changes: JSON.parse(String(row.changes_json)) as Array<{
      field: string;
      before?: string | number | boolean | null;
      after?: string | number | boolean | null;
    }>,
    correlationId: String(row.correlation_id),
    source: JSON.parse(String(row.source_json)) as {
      category?: string;
      client?: string;
      osActor?: string;
    },
    ...(row.failure_code === null ? {} : { failureCode: String(row.failure_code) }),
  };
}

function runtimeDocument(row: Record<string, unknown>): RuntimeAuditProjection {
  return {
    eventId: String(row.event_id),
    occurredAt: Number(row.occurred_at),
    eventType: String(row.event_type),
    outcome: String(row.outcome) as RuntimeAuditProjection["outcome"],
    category: String(row.category) as AuditCategory,
    actorType: String(row.actor_type) as RuntimeAuditProjection["actorType"],
    ...(row.subject_id_snapshot === null ? {} : { subjectId: String(row.subject_id_snapshot) }),
    subjectLabel: String(row.subject_label_snapshot),
    ...(row.service_id_snapshot === null ? {} : { serviceId: String(row.service_id_snapshot) }),
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
    ...(row.correlation_id === null ? {} : { correlationId: String(row.correlation_id) }),
    source: JSON.parse(String(row.source_json)) as RuntimeAuditProjection["source"],
    ...(row.duration_ms === null ? {} : { durationMs: Number(row.duration_ms) }),
    ...(row.tls_verify === null ? {} : { tlsVerify: Number(row.tls_verify) === 1 }),
    ...(row.tokenization_count === null
      ? {}
      : { tokenizationCount: Number(row.tokenization_count) }),
    details: JSON.parse(String(row.details_json)) as RuntimeAuditProjection["details"],
  };
}

function maintenanceAudit(
  input: {
    actor: ControlAuthenticationContext;
    justification: string;
    correlationId: string;
  } | undefined,
  outcome: "completed" | "partial" | "skipped",
  administrative: number,
  runtime: number,
  repaired: number,
): AdministrativeAuditEventInput {
  return {
    actor: input === undefined
      ? {
          type: "job",
          label: "job:audit-maintenance",
          role: "system",
          authenticationMethod: "job",
        }
      : administrativeActorSnapshot(input.actor),
    action: "audit.maintenance.run",
    category: "audit",
    result: "allow",
    target: { type: "audit_maintenance", label: "audit-maintenance" },
    ...(input === undefined ? {} : { justification: input.justification }),
    changes: [
      { field: "outcome", after: outcome },
      { field: "administrative_deleted", after: administrative },
      { field: "runtime_deleted", after: runtime },
      { field: "index_repaired", after: repaired },
    ],
    correlationId: input?.correlationId ?? randomUUID(),
    source: { category: "audit" },
  };
}

function validateDays(value: number | null): void {
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 3_650)) {
    throw new AuditRetentionError("invalid");
  }
}

function requireSuperadmin(actor: ControlAuthenticationContext): void {
  if (actor.role !== "superadmin" || actor.method !== "browser_session") {
    throw new AuditRetentionError("forbidden");
  }
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AuditRetentionError("unavailable");
  }
  return value;
}

function normalizeError(error: unknown): AuditRetentionError {
  if (error instanceof AuditRetentionError) return error;
  if (error instanceof PersistenceError) {
    if (error.code === "audit_retention_stale") return new AuditRetentionError("stale");
    if (error.code === "audit_retention_invalid") return new AuditRetentionError("invalid");
  }
  return new AuditRetentionError("unavailable");
}
