import type { ControlAuthenticationContext } from "./control/authentication.js";
import type { PersistenceQuery } from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import type {
  ReferenceAggregateCounts,
  ReferenceAggregateSource,
} from "./tokens.js";

const EXPIRING_MS = 30 * 86_400_000;
const SERVICE_LIMIT = 100;

type ComponentState = "ready" | "unavailable" | "unsupported";

export interface StatusServiceSnapshot {
  serviceId: string;
  name: string;
  lifecycle: "draft" | "published" | "archived";
  publicationGeneration: number;
  credentials: {
    configured: number;
    unconfigured: number;
    disabled: number;
    archived: number;
  };
  references: {
    state: "available" | "unavailable";
    gref: { active: number; expiring: number; expired: number };
    sec: { active: number; expiring: number; expired: number };
  };
  activeGrantCount: number;
  apiKeys: { active: number; expiring: number; expired: number };
  pendingRemediationCount: number;
}

export interface StatusDashboardSnapshot {
  generatedAt: number;
  services: StatusServiceSnapshot[];
  serviceCount: number;
  servicesTruncated: boolean;
  system?: {
    components: {
      database: Exclude<ComponentState, "unsupported">;
      schema: "ready" | "unsupported";
      vault: ComponentState;
      audit: Exclude<ComponentState, "unsupported">;
      identity: ComponentState;
    };
    jobs: {
      audit: JobSnapshot;
      activity: JobSnapshot;
      inactivity: JobSnapshot;
    };
    auditCapacity: {
      administrativeRows: number;
      runtimeRows: number;
      estimatedBytes: number;
      warnings: string[];
    };
    apiKeys: {
      active: number;
      expiring: number;
      expired: number;
      nonExpiring: number;
    };
    users: {
      suspended: number;
      deactivated: number;
      pendingEnrollment: number;
      activeWithoutServices: number;
    };
  };
}

export interface JobSnapshot {
  state: "ready" | "degraded" | "unavailable";
  nextRunAt: number | null;
  lastCompletedAt: number | null;
  lastOutcome: string | null;
  lastCode: string | null;
}

export class StatusDashboardError extends Error {
  constructor(readonly code: "forbidden" | "unavailable") {
    super(code);
    this.name = "StatusDashboardError";
  }
}

interface ServiceRow {
  service_id: string;
  name: string;
  lifecycle: StatusServiceSnapshot["lifecycle"];
  publication_generation: number;
  configured_count: number;
  unconfigured_count: number;
  disabled_count: number;
  archived_count: number;
  active_grant_count: number;
  active_key_count: number;
  expiring_key_count: number;
  expired_key_count: number;
  remediation_count: number;
}

export class StatusDashboardService {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly options: {
      now?: () => number;
      vaultReadiness?: () => Promise<ComponentState>;
      identityReadiness?: () => Promise<ComponentState>;
      referenceAggregates?: Pick<ReferenceAggregateSource, "referenceAggregates">;
    } = {},
  ) {}

  async snapshot(
    actor: ControlAuthenticationContext,
  ): Promise<StatusDashboardSnapshot> {
    requireViewer(actor);
    const now = safeNow(this.options.now ?? Date.now);
    try {
      const durable = await this.owner.execute({
        run: (database) => database.read((query) => ({
          rows: readServices(query, actor, now),
          count: readServiceCount(query, actor),
          ...(actor.role === "superadmin"
            ? { system: readSystem(query, now) }
            : {}),
        })),
      });
      const services = await Promise.all(durable.rows.map(async (row) => ({
        serviceId: row.service_id,
        name: row.name,
        lifecycle: row.lifecycle,
        publicationGeneration: row.publication_generation,
        credentials: {
          configured: row.configured_count,
          unconfigured: row.unconfigured_count,
          disabled: row.disabled_count,
          archived: row.archived_count,
        },
        references: await safeReferences(
          this.options.referenceAggregates,
          row.service_id,
        ),
        activeGrantCount: row.active_grant_count,
        apiKeys: {
          active: row.active_key_count,
          expiring: row.expiring_key_count,
          expired: row.expired_key_count,
        },
        pendingRemediationCount: row.remediation_count,
      } satisfies StatusServiceSnapshot)));
      if (actor.role !== "superadmin" || durable.system === undefined) {
        return {
          generatedAt: now,
          services,
          serviceCount: durable.count,
          servicesTruncated: durable.count > services.length,
        };
      }
      const [vault, identity] = await Promise.all([
        safeComponent(this.options.vaultReadiness),
        safeComponent(this.options.identityReadiness),
      ]);
      const readiness = this.owner.readiness;
      return {
        generatedAt: now,
        services,
        serviceCount: durable.count,
        servicesTruncated: durable.count > services.length,
        system: {
          ...durable.system,
          components: {
            database: readiness.database,
            schema: readiness.schema,
            vault,
            audit: readiness.administrativeAudit,
            identity,
          },
        },
      };
    } catch (error) {
      if (error instanceof StatusDashboardError) throw error;
      throw new StatusDashboardError("unavailable");
    }
  }
}

function readServices(
  query: PersistenceQuery,
  actor: ControlAuthenticationContext,
  now: number,
): ServiceRow[] {
  return query.all<ServiceRow>(`
    WITH authorized_services AS MATERIALIZED (
      SELECT services.id, services.name, services.lifecycle,
        services.publication_generation
      FROM services
      WHERE ? = 'superadmin'
      UNION ALL
      SELECT services.id, services.name, services.lifecycle,
        services.publication_generation
      FROM service_admins
      JOIN services ON services.id = service_admins.service_id
      WHERE ? = 'admin' AND service_admins.user_id = ?
    )
    SELECT
      authorized.id AS service_id, authorized.name, authorized.lifecycle,
      authorized.publication_generation,
      count(DISTINCT CASE WHEN credentials.status = 'configured'
        THEN credentials.id END) AS configured_count,
      count(DISTINCT CASE WHEN credentials.status = 'unconfigured'
        THEN credentials.id END) AS unconfigured_count,
      count(DISTINCT CASE WHEN credentials.status = 'disabled'
        THEN credentials.id END) AS disabled_count,
      count(DISTINCT CASE WHEN credentials.status = 'archived'
        THEN credentials.id END) AS archived_count,
      (
        SELECT count(DISTINCT grants.id)
        FROM oauth_grants AS grants
        WHERE grants.status = 'active'
          AND grants.absolute_expires_at > ?
          AND grants.idle_expires_at > ?
          AND EXISTS (
            SELECT 1
            FROM service_principal_assignments AS assignment
            WHERE assignment.service_id = authorized.id
              AND (
                assignment.selector_kind = 'all'
                OR (
                  assignment.selector_kind = 'user'
                  AND assignment.user_id = grants.user_id
                )
                OR (
                  assignment.selector_kind = 'group'
                  AND EXISTS (
                    SELECT 1 FROM service_group_members AS member
                    WHERE member.service_id = authorized.id
                      AND member.group_id = assignment.group_id
                      AND member.user_id = grants.user_id
                  )
                )
              )
          )
      ) AS active_grant_count,
      count(DISTINCT CASE
        WHEN keys.status = 'active'
          AND (keys.expires_at IS NULL OR keys.expires_at > ?)
        THEN keys.id END) AS active_key_count,
      count(DISTINCT CASE
        WHEN keys.status = 'active' AND keys.expires_at > ?
          AND keys.expires_at <= ?
        THEN keys.id END) AS expiring_key_count,
      count(DISTINCT CASE
        WHEN keys.status IN ('expired', 'revoked')
          OR (keys.expires_at IS NOT NULL AND keys.expires_at <= ?)
        THEN keys.id END) AS expired_key_count,
      count(DISTINCT CASE WHEN remediations.state IN ('open', 'acknowledged')
        THEN remediations.id END) AS remediation_count
    FROM authorized_services AS authorized
    LEFT JOIN service_credentials AS credentials
      ON credentials.service_id = authorized.id
    LEFT JOIN api_keys AS keys ON keys.service_id = authorized.id
    LEFT JOIN dashboard_remediations AS remediations
      ON remediations.service_id = authorized.id
    GROUP BY authorized.id, authorized.name, authorized.lifecycle,
      authorized.publication_generation
    ORDER BY authorized.name, authorized.id
    LIMIT ?
  `, [
    actor.role,
    actor.role,
    actor.principalId,
    now,
    now,
    now + EXPIRING_MS,
    now,
    now + EXPIRING_MS,
    now,
    SERVICE_LIMIT,
  ]);
}

function readServiceCount(
  query: PersistenceQuery,
  actor: ControlAuthenticationContext,
): number {
  return query.get<{ count: number }>(`
    WITH authorized_services(service_id) AS MATERIALIZED (
      SELECT id FROM services WHERE ? = 'superadmin'
      UNION ALL
      SELECT service_id FROM service_admins
      WHERE ? = 'admin' AND user_id = ?
    )
    SELECT count(*) AS count FROM authorized_services
  `, [actor.role, actor.role, actor.principalId])?.count ?? 0;
}

function readSystem(query: PersistenceQuery, now: number) {
  const audit = job(query, "audit_maintenance_state");
  const activity = job(query, "activity_projection_state");
  const inactivity = query.get<Record<string, unknown>>(`
    SELECT next_run_at, last_completed_at, last_outcome, last_code
    FROM security_job_state WHERE job_name = 'inactivity'
  `);
  const capacity = query.get<{
    administrative_rows: number;
    runtime_rows: number;
    estimated_bytes: number | null;
  }>(`
    SELECT
      (SELECT count(*) FROM administrative_audit_events) AS administrative_rows,
      (SELECT count(*) FROM runtime_audit_events) AS runtime_rows,
      (SELECT sum(pgsize) FROM dbstat WHERE name IN (
        'administrative_audit_events', 'administrative_audit_fts',
        'runtime_audit_events', 'runtime_audit_fts'
      )) AS estimated_bytes
  `)!;
  const keys = query.get<{
    active: number;
    expiring: number;
    expired: number;
    non_expiring: number;
  }>(`
    SELECT
      count(CASE WHEN status = 'active'
        AND (expires_at IS NULL OR expires_at > ?) THEN 1 END) AS active,
      count(CASE WHEN status = 'active' AND expires_at > ?
        AND expires_at <= ? THEN 1 END) AS expiring,
      count(CASE WHEN status IN ('expired', 'revoked')
        OR (expires_at IS NOT NULL AND expires_at <= ?) THEN 1 END) AS expired,
      count(CASE WHEN status = 'active' AND expires_at IS NULL THEN 1 END)
        AS non_expiring
    FROM api_keys
  `, [now + EXPIRING_MS, now, now + EXPIRING_MS, now])!;
  const users = query.get<{
    suspended: number;
    deactivated: number;
    pending: number;
    zero_services: number;
  }>(`
    SELECT
      count(CASE WHEN role = 'user' AND status = 'suspended' THEN 1 END)
        AS suspended,
      count(CASE WHEN role = 'user' AND status = 'deactivated' THEN 1 END)
        AS deactivated,
      count(CASE WHEN role = 'user'
        AND status IN ('invited', 'enrollment_required') THEN 1 END) AS pending,
      count(CASE WHEN role = 'user' AND status = 'active' AND NOT EXISTS (
        SELECT 1 FROM service_principal_assignments AS assignment
        WHERE assignment.selector_kind = 'all'
          OR (assignment.selector_kind = 'user' AND assignment.user_id = users.id)
          OR (assignment.selector_kind = 'group' AND EXISTS (
            SELECT 1 FROM service_group_members AS member
            WHERE member.service_id = assignment.service_id
              AND member.group_id = assignment.group_id
              AND member.user_id = users.id
          ))
      ) THEN 1 END) AS zero_services
    FROM users
  `)!;
  const estimatedBytes = capacity.estimated_bytes ?? 0;
  return {
    jobs: {
      audit,
      activity,
      inactivity: projectJob(inactivity),
    },
    auditCapacity: {
      administrativeRows: capacity.administrative_rows,
      runtimeRows: capacity.runtime_rows,
      estimatedBytes,
      warnings: [
        ...(estimatedBytes >= 1_073_741_824 ? ["capacity_planning_required"] : []),
      ],
    },
    apiKeys: {
      active: keys.active,
      expiring: keys.expiring,
      expired: keys.expired,
      nonExpiring: keys.non_expiring,
    },
    users: {
      suspended: users.suspended,
      deactivated: users.deactivated,
      pendingEnrollment: users.pending,
      activeWithoutServices: users.zero_services,
    },
  };
}

function job(query: PersistenceQuery, table: string): JobSnapshot {
  if (
    table !== "audit_maintenance_state"
    && table !== "activity_projection_state"
  ) return unavailableJob();
  return projectJob(query.get<Record<string, unknown>>(`
    SELECT next_run_at, last_completed_at, last_outcome, last_code
    FROM ${table} WHERE singleton = 1
  `));
}

function projectJob(row: Record<string, unknown> | undefined): JobSnapshot {
  if (row === undefined) return unavailableJob();
  const outcome = row.last_outcome === null ? null : String(row.last_outcome);
  return {
    state:
      outcome === "error" || outcome === "partial" ? "degraded" : "ready",
    nextRunAt: row.next_run_at === null ? null : Number(row.next_run_at),
    lastCompletedAt:
      row.last_completed_at === null ? null : Number(row.last_completed_at),
    lastOutcome: outcome,
    lastCode: row.last_code === null ? null : String(row.last_code),
  };
}

function unavailableJob(): JobSnapshot {
  return {
    state: "unavailable",
    nextRunAt: null,
    lastCompletedAt: null,
    lastOutcome: null,
    lastCode: null,
  };
}

async function safeComponent(
  adapter: (() => Promise<ComponentState>) | undefined,
): Promise<ComponentState> {
  if (adapter === undefined) return "unavailable";
  try {
    const result = await adapter();
    return result === "ready" || result === "unsupported" ? result : "unavailable";
  } catch {
    return "unavailable";
  }
}

async function safeReferences(
  source: Pick<ReferenceAggregateSource, "referenceAggregates"> | undefined,
  serviceId: string,
): Promise<StatusServiceSnapshot["references"]> {
  if (source === undefined) return unavailableReferences();
  try {
    const counts = await source.referenceAggregates({ serviceId });
    if (!validReferenceCounts(counts)) return unavailableReferences();
    return {
      state: "available",
      gref: {
        active: counts.gref.active,
        expiring: 0,
        expired: counts.gref.expired,
      },
      sec: {
        active: counts.sec.active,
        expiring: 0,
        expired: counts.sec.expired,
      },
    };
  } catch {
    return unavailableReferences();
  }
}

function validReferenceCounts(value: ReferenceAggregateCounts): boolean {
  return [value.gref, value.sec].every((counts) =>
    [counts.active, counts.expired, counts.invalid].every((count) =>
      Number.isSafeInteger(count) && count >= 0));
}

function unavailableReferences(): StatusServiceSnapshot["references"] {
  return {
    state: "unavailable",
    gref: { active: 0, expiring: 0, expired: 0 },
    sec: { active: 0, expiring: 0, expired: 0 },
  };
}

function requireViewer(actor: ControlAuthenticationContext): void {
  if (
    actor.method !== "browser_session"
    || (actor.role !== "admin" && actor.role !== "superadmin")
  ) throw new StatusDashboardError("forbidden");
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new StatusDashboardError("unavailable");
  }
  return value;
}
