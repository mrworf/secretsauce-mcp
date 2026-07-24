import type Database from "better-sqlite3";
import type { RuntimeAuditProjection } from "./persistence/auditDocuments.js";

export interface ActivityProjectionWriter {
  run(sql: string, parameters?: readonly ActivitySqlValue[]): Database.RunResult;
}

type ActivitySqlValue = string | number | bigint | Buffer | null;

export function projectHourlyActivity(
  writer: ActivityProjectionWriter,
  sequence: number,
  event: RuntimeAuditProjection,
  projectedAt: number,
): boolean {
  if (
    event.eventType !== "service_request"
    || event.serviceId === undefined
    || event.serviceLabel === undefined
    || event.destination === undefined
    || event.method === undefined
  ) return false;
  const projected = writer.run(`
    INSERT OR IGNORE INTO activity_projected_events (
      event_id, sequence, projected_at
    ) VALUES (?, ?, ?)
  `, [event.eventId, sequence, projectedAt]);
  if (projected.changes !== 1) return false;

  const bucketStart = Math.floor(event.occurredAt / 3_600_000) * 3_600_000;
  const categoryKind = event.policyRule === undefined
    ? "boundary_default"
    : "policy_rule";
  const category = event.policyRule ??
    `boundary_default_${event.outcome === "deny" ? "deny" : "allow"}`;
  const decision = event.outcome === "deny"
    ? "deny"
    : event.outcome === "allow"
      ? "allow"
      : "error";
  const statusClass = event.downstreamStatus === undefined
    ? "none"
    : `${Math.floor(event.downstreamStatus / 100)}xx`;
  writer.run(`
    INSERT INTO activity_hourly (
      bucket_start, service_id, service_label_snapshot, destination, method,
      endpoint_category_kind, endpoint_category, decision, status_class,
      request_count, credential_use_count, tokenization_count,
      duration_sum_ms, duration_count, first_occurred_at, last_occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (
      bucket_start, service_id, destination, method, endpoint_category_kind,
      endpoint_category, decision, status_class
    ) DO UPDATE SET
      service_label_snapshot = excluded.service_label_snapshot,
      request_count = activity_hourly.request_count + 1,
      credential_use_count =
        activity_hourly.credential_use_count + excluded.credential_use_count,
      tokenization_count =
        activity_hourly.tokenization_count + excluded.tokenization_count,
      duration_sum_ms =
        activity_hourly.duration_sum_ms + excluded.duration_sum_ms,
      duration_count =
        activity_hourly.duration_count + excluded.duration_count,
      first_occurred_at =
        min(activity_hourly.first_occurred_at, excluded.first_occurred_at),
      last_occurred_at =
        max(activity_hourly.last_occurred_at, excluded.last_occurred_at)
  `, [
    bucketStart,
    event.serviceId,
    event.serviceLabel,
    event.destination,
    event.method,
    categoryKind,
    category,
    decision,
    statusClass,
    event.credentialUseCount ?? 0,
    event.tokenizationCount ?? 0,
    event.durationMs ?? 0,
    event.durationMs === undefined ? 0 : 1,
    event.occurredAt,
    event.occurredAt,
  ]);
  if (event.subjectId !== undefined) {
    writer.run(`
      INSERT OR IGNORE INTO activity_hourly_subjects (
        bucket_start, service_id, subject_id
      ) VALUES (?, ?, ?)
    `, [bucketStart, event.serviceId, event.subjectId]);
  }
  return true;
}
