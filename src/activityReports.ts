import type { ControlAuthenticationContext } from "./control/authentication.js";
import { PersistenceError } from "./persistence/errors.js";
import type { PersistenceQuery } from "./persistence/transaction.js";
import { isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const SUPPRESSION_THRESHOLD = 3;

export type ActivityWindow = "24h" | "7d" | "30d" | "90d";

export interface ActivityCount {
  value: number | null;
  suppressed: boolean;
  threshold: number;
}

export interface ActivityReport {
  generatedAt: number;
  window: ActivityWindow;
  startAt: number;
  endAt: number;
  totals: {
    requests: number;
    allow: number;
    deny: number;
    error: number;
    credentialUses: number;
    tokenizations: number;
    apiKeyActivity: number;
    activeUsers: ActivityCount;
  };
  trend: Array<{
    bucketStart: number;
    requests: number;
    allow: number;
    deny: number;
    error: number;
    status1xx: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
  }>;
  services: Array<{
    serviceId: string;
    serviceName: string;
    requests: number;
    credentialUses: number;
    activeUsers: ActivityCount;
  }>;
  endpoints: Array<{
    serviceId: string;
    serviceName: string;
    category: string;
    requests: number;
  }>;
  freshness: {
    cursorSequence: number;
    sourceSequence: number;
    lastCompletedAt: number | null;
    partial: boolean;
  };
}

export class ActivityReportError extends Error {
  constructor(readonly code: "forbidden" | "invalid" | "unavailable") {
    super(code);
    this.name = "ActivityReportError";
  }
}

export class ActivityReportService {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async report(
    actor: ControlAuthenticationContext,
    input: { window?: ActivityWindow; serviceId?: string; limit?: number } = {},
  ): Promise<ActivityReport> {
    requireViewer(actor);
    const normalized = normalizeInput(input, safeNow(this.now));
    try {
      return await this.owner.execute({
        run: (database) => database.read((query) =>
          readReport(query, actor, normalized)),
      });
    } catch (error) {
      if (error instanceof ActivityReportError) throw error;
      throw new ActivityReportError("unavailable");
    }
  }
}

interface NormalizedInput {
  window: ActivityWindow;
  serviceId?: string;
  limit: number;
  generatedAt: number;
  startAt: number;
  endAt: number;
  bucketMs: number;
}

interface TotalRow {
  requests: number;
  allow_count: number;
  deny_count: number;
  error_count: number;
  credential_uses: number;
  tokenizations: number;
}

const scopedActivityCte = `
  WITH authorized_services(service_id, service_name) AS MATERIALIZED (
    SELECT services.id, services.name
    FROM services
    WHERE ? = 'superadmin'
    UNION ALL
    SELECT services.id, services.name
    FROM service_admins
    JOIN services ON services.id = service_admins.service_id
    WHERE ? = 'admin' AND service_admins.user_id = ?
  ),
  scoped_activity AS MATERIALIZED (
    SELECT activity.*, authorized_services.service_name
    FROM activity_hourly AS activity
    JOIN authorized_services
      ON authorized_services.service_id = activity.service_id
    WHERE activity.bucket_start >= ? AND activity.bucket_start < ?
      AND (? IS NULL OR activity.service_id = ?)
  )
`;

function readReport(
  query: PersistenceQuery,
  actor: ControlAuthenticationContext,
  input: NormalizedInput,
): ActivityReport {
  const scope = scopeParameters(actor, input);
  const totals = query.get<TotalRow>(`
    ${scopedActivityCte}
    SELECT
      coalesce(sum(request_count), 0) AS requests,
      coalesce(sum(CASE WHEN decision = 'allow' THEN request_count ELSE 0 END), 0)
        AS allow_count,
      coalesce(sum(CASE WHEN decision = 'deny' THEN request_count ELSE 0 END), 0)
        AS deny_count,
      coalesce(sum(CASE WHEN decision = 'error' THEN request_count ELSE 0 END), 0)
        AS error_count,
      coalesce(sum(credential_use_count), 0) AS credential_uses,
      coalesce(sum(tokenization_count), 0) AS tokenizations
    FROM scoped_activity
  `, scope)!;
  const trendRows = query.all<Record<string, number>>(`
    ${scopedActivityCte}
    SELECT
      (bucket_start / ?) * ? AS bucket_start,
      sum(request_count) AS requests,
      sum(CASE WHEN decision = 'allow' THEN request_count ELSE 0 END) AS allow_count,
      sum(CASE WHEN decision = 'deny' THEN request_count ELSE 0 END) AS deny_count,
      sum(CASE WHEN decision = 'error' THEN request_count ELSE 0 END) AS error_count,
      sum(CASE WHEN status_class = '1xx' THEN request_count ELSE 0 END) AS status_1xx,
      sum(CASE WHEN status_class = '2xx' THEN request_count ELSE 0 END) AS status_2xx,
      sum(CASE WHEN status_class = '3xx' THEN request_count ELSE 0 END) AS status_3xx,
      sum(CASE WHEN status_class = '4xx' THEN request_count ELSE 0 END) AS status_4xx,
      sum(CASE WHEN status_class = '5xx' THEN request_count ELSE 0 END) AS status_5xx
    FROM scoped_activity
    GROUP BY (bucket_start / ?) * ?
    ORDER BY bucket_start
  `, [...scope, input.bucketMs, input.bucketMs, input.bucketMs, input.bucketMs]);
  const services = query.all<{
    service_id: string;
    service_name: string;
    requests: number;
    credential_uses: number;
  }>(`
    ${scopedActivityCte}
    SELECT service_id, service_name, sum(request_count) AS requests,
      sum(credential_use_count) AS credential_uses
    FROM scoped_activity
    GROUP BY service_id, service_name
    ORDER BY requests DESC, service_name, service_id
    LIMIT ?
  `, [...scope, input.limit]);
  const serviceUsers = new Map(query.all<{
    service_id: string;
    active_users: number;
  }>(`
    WITH authorized_services(service_id) AS MATERIALIZED (
      SELECT id FROM services WHERE ? = 'superadmin'
      UNION ALL
      SELECT service_id FROM service_admins
      WHERE ? = 'admin' AND user_id = ?
    )
    SELECT subjects.service_id, count(DISTINCT subjects.subject_id) AS active_users
    FROM activity_hourly_subjects AS subjects
    JOIN authorized_services ON authorized_services.service_id = subjects.service_id
    WHERE subjects.bucket_start >= ? AND subjects.bucket_start < ?
      AND (? IS NULL OR subjects.service_id = ?)
    GROUP BY subjects.service_id
  `, scope).map((row) => [row.service_id, row.active_users]));
  const totalUsers = query.get<{ active_users: number }>(`
    WITH authorized_services(service_id) AS MATERIALIZED (
      SELECT id FROM services WHERE ? = 'superadmin'
      UNION ALL
      SELECT service_id FROM service_admins
      WHERE ? = 'admin' AND user_id = ?
    )
    SELECT count(DISTINCT subjects.subject_id) AS active_users
    FROM activity_hourly_subjects AS subjects
    JOIN authorized_services ON authorized_services.service_id = subjects.service_id
    WHERE subjects.bucket_start >= ? AND subjects.bucket_start < ?
      AND (? IS NULL OR subjects.service_id = ?)
  `, scope)?.active_users ?? 0;
  const endpoints = query.all<{
    service_id: string;
    service_name: string;
    endpoint_category: string;
    requests: number;
  }>(`
    ${scopedActivityCte}
    SELECT service_id, service_name, endpoint_category, sum(request_count) AS requests
    FROM scoped_activity
    WHERE endpoint_category_kind = 'policy_rule'
    GROUP BY service_id, service_name, endpoint_category
    ORDER BY requests DESC, service_name, endpoint_category, service_id
    LIMIT ?
  `, [...scope, input.limit]);
  const apiKeyActivity = query.get<{ activity_count: number }>(`
    WITH authorized_services(service_id) AS MATERIALIZED (
      SELECT id FROM services WHERE ? = 'superadmin'
      UNION ALL
      SELECT service_id FROM service_admins
      WHERE ? = 'admin' AND user_id = ?
    )
    SELECT count(*) AS activity_count
    FROM api_key_activity AS activity
    WHERE activity.occurred_at >= ? AND activity.occurred_at < ?
      AND (
        (? = 'superadmin' AND ? IS NULL)
        OR activity.service_id_snapshot IN (SELECT service_id FROM authorized_services)
      )
      AND (? IS NULL OR activity.service_id_snapshot = ?)
  `, [
    actor.role,
    actor.role,
    actor.principalId,
    input.startAt,
    input.endAt,
    actor.role,
    input.serviceId ?? null,
    input.serviceId ?? null,
    input.serviceId ?? null,
  ])?.activity_count ?? 0;
  const freshness = query.get<{
    cursor_sequence: number;
    source_sequence: number;
    last_completed_at: number | null;
    last_outcome: string | null;
  }>(`
    SELECT state.cursor_sequence,
      coalesce((SELECT max(sequence) FROM runtime_audit_events), 0) AS source_sequence,
      state.last_completed_at, state.last_outcome
    FROM activity_projection_state AS state WHERE singleton = 1
  `)!;

  return {
    generatedAt: input.generatedAt,
    window: input.window,
    startAt: input.startAt,
    endAt: input.endAt,
    totals: {
      requests: totals.requests,
      allow: totals.allow_count,
      deny: totals.deny_count,
      error: totals.error_count,
      credentialUses: totals.credential_uses,
      tokenizations: totals.tokenizations,
      apiKeyActivity,
      activeUsers: privateCount(totalUsers, actor.role),
    },
    trend: fillTrend(input, trendRows),
    services: services.map((row) => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      requests: row.requests,
      credentialUses: row.credential_uses,
      activeUsers: privateCount(serviceUsers.get(row.service_id) ?? 0, actor.role),
    })),
    endpoints: endpoints.map((row) => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      category: row.endpoint_category,
      requests: row.requests,
    })),
    freshness: {
      cursorSequence: freshness.cursor_sequence,
      sourceSequence: freshness.source_sequence,
      lastCompletedAt: freshness.last_completed_at,
      partial:
        freshness.cursor_sequence < freshness.source_sequence
        || freshness.last_outcome === "partial",
    },
  };
}

function scopeParameters(
  actor: ControlAuthenticationContext,
  input: NormalizedInput,
): Array<string | number | null> {
  return [
    actor.role,
    actor.role,
    actor.principalId,
    input.startAt,
    input.endAt,
    input.serviceId ?? null,
    input.serviceId ?? null,
  ];
}

function fillTrend(
  input: NormalizedInput,
  rows: Array<Record<string, number>>,
): ActivityReport["trend"] {
  const byBucket = new Map(rows.map((row) => [row.bucket_start, row]));
  const trend: ActivityReport["trend"] = [];
  for (
    let bucketStart = input.startAt;
    bucketStart < input.endAt;
    bucketStart += input.bucketMs
  ) {
    const row = byBucket.get(bucketStart);
    trend.push({
      bucketStart,
      requests: row?.requests ?? 0,
      allow: row?.allow_count ?? 0,
      deny: row?.deny_count ?? 0,
      error: row?.error_count ?? 0,
      status1xx: row?.status_1xx ?? 0,
      status2xx: row?.status_2xx ?? 0,
      status3xx: row?.status_3xx ?? 0,
      status4xx: row?.status_4xx ?? 0,
      status5xx: row?.status_5xx ?? 0,
    });
  }
  return trend;
}

function privateCount(value: number, role: string): ActivityCount {
  const suppressed =
    role === "admin" && value > 0 && value < SUPPRESSION_THRESHOLD;
  return {
    value: suppressed ? null : value,
    suppressed,
    threshold: SUPPRESSION_THRESHOLD,
  };
}

function normalizeInput(
  input: { window?: ActivityWindow; serviceId?: string; limit?: number },
  now: number,
): NormalizedInput {
  const window = input.window ?? "24h";
  const duration = {
    "24h": DAY_MS,
    "7d": 7 * DAY_MS,
    "30d": 30 * DAY_MS,
    "90d": 90 * DAY_MS,
  }[window];
  if (duration === undefined) throw new ActivityReportError("invalid");
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ActivityReportError("invalid");
  }
  if (input.serviceId !== undefined && !isUuidV7(input.serviceId)) {
    throw new ActivityReportError("invalid");
  }
  const bucketMs = window === "24h" || window === "7d" ? HOUR_MS : DAY_MS;
  const endAt = Math.floor(now / bucketMs) * bucketMs + bucketMs;
  return {
    window,
    ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
    limit,
    generatedAt: now,
    startAt: endAt - duration,
    endAt,
    bucketMs,
  };
}

function requireViewer(actor: ControlAuthenticationContext): void {
  if (
    actor.method !== "browser_session"
    || (actor.role !== "admin" && actor.role !== "superadmin")
  ) throw new ActivityReportError("forbidden");
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ActivityReportError("unavailable");
  }
  return value;
}
