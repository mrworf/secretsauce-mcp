import { createHmac, randomBytes } from "node:crypto";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import type {
  AlwaysStepUpHandle,
  StepUpRepository,
} from "./identity/stepUp.js";
import { administrativeActorSnapshot } from "./apiKeyAuthority.js";
import type { AdministrativeAuditEventInput } from "./persistence/administrativeAudit.js";
import { PersistenceError } from "./persistence/errors.js";
import type {
  PersistenceQuery,
  PersistenceTransaction,
} from "./persistence/transaction.js";
import { UuidV7Generator, isUuidV7 } from "./persistence/uuidV7.js";
import type { PersistenceOwner } from "./persistence/worker.js";

const STALE_KEY_MS = 90 * 86_400_000;

type Severity = "info" | "warning" | "critical";
type RemediationState = "open" | "acknowledged" | "dismissed" | "resolved";

export interface SecuritySignal {
  code: string;
  severity: Severity;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  serviceId?: string;
  remediationId?: string;
  remediationState?: RemediationState;
  remediationVersion?: number;
}

export interface SecurityDashboardSnapshot {
  generatedAt: number;
  signals: SecuritySignal[];
  remediations: Array<{
    id: string;
    code: string;
    severity: Severity;
    serviceId?: string;
    generation: number;
    state: RemediationState;
    firstSeenAt: number;
    lastSeenAt: number;
    version: number;
  }>;
}

export class SecurityDashboardError extends Error {
  constructor(
    readonly code:
      | "forbidden"
      | "invalid"
      | "not_found"
      | "stale"
      | "unavailable",
  ) {
    super(code);
    this.name = "SecurityDashboardError";
  }
}

interface CurrentFinding {
  code: string;
  category: "identity" | "credential" | "api_key";
  severity: Severity;
  serviceId?: string;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

interface RemediationRow {
  id: string;
  finding_key_hash: string;
  code: string;
  category: CurrentFinding["category"];
  severity: Severity;
  service_id: string | null;
  generation: number;
  state: RemediationState;
  first_seen_at: number;
  last_seen_at: number;
  version: number;
}

export class SecurityDashboardService {
  readonly #key: Buffer;
  readonly #uuid: () => string;

  constructor(
    private readonly owner: PersistenceOwner,
    options: {
      now?: () => number;
      findingKey?: Uint8Array;
      uuid?: () => string;
      stepUps?: Pick<StepUpRepository, "withConsumedProofGenerated">;
    } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.#key = Buffer.from(options.findingKey ?? randomBytes(32));
    const generator = new UuidV7Generator({ now: this.now });
    this.#uuid = options.uuid ?? (() => generator.next());
    this.stepUps = options.stepUps;
  }

  private readonly now: () => number;
  private readonly stepUps:
    | Pick<StepUpRepository, "withConsumedProofGenerated">
    | undefined;

  async snapshot(
    actor: ControlAuthenticationContext,
  ): Promise<SecurityDashboardSnapshot> {
    requireViewer(actor);
    const now = safeNow(this.now);
    try {
      await this.reconcile(now);
      return await this.owner.execute({
        run: (database) => database.read((query) =>
          readSnapshot(query, actor, now)),
      });
    } catch (error) {
      if (error instanceof SecurityDashboardError) throw error;
      throw new SecurityDashboardError("unavailable");
    }
  }

  async updateRemediation(input: {
    actor: ControlAuthenticationContext;
    remediationId: string;
    expectedVersion: number;
    state: "acknowledged" | "dismissed";
    justification: string;
    correlationId: string;
    proof?: AlwaysStepUpHandle;
  }): Promise<SecurityDashboardSnapshot["remediations"][number]> {
    requireViewer(input.actor);
    validateMutation(input);
    if (input.proof === undefined || this.stepUps === undefined) {
      throw new SecurityDashboardError("forbidden");
    }
    const now = safeNow(this.now);
    const mutate = (transaction: PersistenceTransaction) => {
      const row = authorizedRemediation(
        transaction,
        input.actor,
        input.remediationId,
      );
      if (row === undefined) throw new PersistenceError("dashboard_not_found");
      if (row.version !== input.expectedVersion) {
        throw new PersistenceError("dashboard_stale");
      }
      const update = transaction.run(`
        UPDATE dashboard_remediations
        SET state = ?,
          acknowledged_by = CASE WHEN ? = 'acknowledged' THEN ? ELSE NULL END,
          acknowledged_at = CASE WHEN ? = 'acknowledged' THEN ? ELSE NULL END,
          dismissed_by = CASE WHEN ? = 'dismissed' THEN ? ELSE NULL END,
          dismissed_at = CASE WHEN ? = 'dismissed' THEN ? ELSE NULL END,
          justification = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?
      `, [
        input.state,
        input.state,
        input.actor.principalId,
        input.state,
        now,
        input.state,
        input.actor.principalId,
        input.state,
        now,
        input.justification,
        now,
        row.id,
        input.expectedVersion,
      ]);
      if (update.changes !== 1) throw new PersistenceError("dashboard_stale");
      const updated = authorizedRemediation(transaction, input.actor, row.id)!;
      return {
        value: wireRemediation(updated),
        auditInput: remediationAudit(input, row, updated),
      };
    };
    try {
      return await this.stepUps.withConsumedProofGenerated(input.proof, mutate);
    } catch (error) {
      if (error instanceof PersistenceError) {
        if (error.code === "dashboard_not_found") {
          throw new SecurityDashboardError("not_found");
        }
        if (error.code === "dashboard_stale") {
          throw new SecurityDashboardError("stale");
        }
        if (error.code === "authentication_failed") {
          throw new SecurityDashboardError("forbidden");
        }
      }
      throw new SecurityDashboardError("unavailable");
    }
  }

  private async reconcile(now: number): Promise<void> {
    await this.owner.execute({
      run: (database) => database.withOperationalTransaction((transaction) => {
        const findings = currentFindings(transaction, now);
        const activeHashes: string[] = [];
        for (const finding of findings) {
          const hash = this.findingHash(finding);
          activeHashes.push(hash);
          const existing = transaction.get<RemediationRow>(`
            SELECT * FROM dashboard_remediations WHERE finding_key_hash = ?
          `, [hash]);
          if (existing === undefined) {
            transaction.run(`
              INSERT INTO dashboard_remediations (
                id, finding_key_hash, code, category, severity, service_id,
                generation, state, first_seen_at, last_seen_at, version,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 1, 'open', ?, ?, 1, ?, ?)
            `, [
              this.#uuid(),
              hash,
              finding.code,
              finding.category,
              finding.severity,
              finding.serviceId ?? null,
              finding.firstSeenAt,
              finding.lastSeenAt,
              now,
              now,
            ]);
          } else if (existing.state === "resolved") {
            transaction.run(`
              UPDATE dashboard_remediations
              SET generation = generation + 1, state = 'open',
                severity = ?, first_seen_at = ?, last_seen_at = ?,
                acknowledged_by = NULL, acknowledged_at = NULL,
                dismissed_by = NULL, dismissed_at = NULL, justification = NULL,
                version = version + 1, updated_at = ?
              WHERE id = ?
            `, [
              finding.severity,
              finding.firstSeenAt,
              finding.lastSeenAt,
              now,
              existing.id,
            ]);
          } else {
            transaction.run(`
              UPDATE dashboard_remediations
              SET severity = ?, last_seen_at = ?, version = version + 1,
                updated_at = ?
              WHERE id = ? AND (
                severity <> ? OR last_seen_at <> ?
              )
            `, [
              finding.severity,
              finding.lastSeenAt,
              now,
              existing.id,
              finding.severity,
              finding.lastSeenAt,
            ]);
          }
        }
        if (activeHashes.length === 0) {
          transaction.run(`
            UPDATE dashboard_remediations
            SET state = 'resolved', version = version + 1, updated_at = ?
            WHERE state <> 'resolved'
          `, [now]);
        } else {
          transaction.run(`
            UPDATE dashboard_remediations
            SET state = 'resolved', version = version + 1, updated_at = ?
            WHERE state <> 'resolved'
              AND finding_key_hash NOT IN (${
                activeHashes.map(() => "?").join(", ")
              })
          `, [now, ...activeHashes]);
        }
      }),
    });
  }

  private findingHash(finding: CurrentFinding): string {
    return createHmac("sha256", this.#key)
      .update("secretsauce.dashboard-finding.v1\0")
      .update(finding.code)
      .update("\0")
      .update(finding.serviceId ?? "global")
      .digest("hex");
  }
}

function currentFindings(
  query: PersistenceQuery,
  now: number,
): CurrentFinding[] {
  const rows = query.all<{
    code: string;
    category: CurrentFinding["category"];
    severity: Severity;
    service_id: string | null;
    finding_count: number;
    first_seen_at: number;
    last_seen_at: number;
  }>(`
    SELECT 'credential.missing' AS code, 'credential' AS category,
      'warning' AS severity, services.id AS service_id,
      1 AS finding_count, services.created_at AS first_seen_at,
      services.updated_at AS last_seen_at
    FROM services
    WHERE services.lifecycle <> 'archived'
      AND NOT EXISTS (
        SELECT 1 FROM service_credentials
        WHERE service_id = services.id AND status = 'configured'
      )
    UNION ALL
    SELECT 'api_key.non_expiring', 'api_key', 'warning', api_keys.service_id,
      count(*), min(api_keys.created_at), max(api_keys.updated_at)
    FROM api_keys
    WHERE api_keys.status = 'active' AND api_keys.expires_at IS NULL
    GROUP BY api_keys.service_id
    UNION ALL
    SELECT 'api_key.stale', 'api_key', 'warning', api_keys.service_id,
      count(*), min(api_keys.created_at), max(api_keys.updated_at)
    FROM api_keys
    WHERE api_keys.status = 'active'
      AND coalesce(api_keys.last_used_at, api_keys.created_at) <= ?
    GROUP BY api_keys.service_id
    UNION ALL
    SELECT 'identity.pending_enrollment', 'identity', 'warning', NULL,
      count(*), min(users.created_at), max(users.updated_at)
    FROM users
    WHERE users.status IN ('invited', 'enrollment_required')
    HAVING count(*) > 0
    UNION ALL
    SELECT 'identity.zero_services', 'identity', 'warning', NULL,
      count(*), min(users.created_at), max(users.updated_at)
    FROM users
    WHERE users.role = 'user' AND users.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM service_principal_assignments AS assignment
        WHERE assignment.selector_kind = 'all'
          OR (assignment.selector_kind = 'user' AND assignment.user_id = users.id)
          OR (assignment.selector_kind = 'group' AND EXISTS (
            SELECT 1 FROM service_group_members AS member
            WHERE member.service_id = assignment.service_id
              AND member.group_id = assignment.group_id
              AND member.user_id = users.id
          ))
      )
    HAVING count(*) > 0
  `, [now - STALE_KEY_MS]);
  return rows.map((row) => ({
    code: row.code,
    category: row.category,
    severity: row.severity,
    ...(row.service_id === null ? {} : { serviceId: row.service_id }),
    count: row.finding_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));
}

function readSnapshot(
  query: PersistenceQuery,
  actor: ControlAuthenticationContext,
  now: number,
): SecurityDashboardSnapshot {
  const remediations = query.all<RemediationRow>(`
    WITH authorized_services(service_id) AS MATERIALIZED (
      SELECT id FROM services WHERE ? = 'superadmin'
      UNION ALL
      SELECT service_id FROM service_admins
      WHERE ? = 'admin' AND user_id = ?
    )
    SELECT remediation.*
    FROM dashboard_remediations AS remediation
    WHERE (
      (? = 'superadmin' AND remediation.service_id IS NULL)
      OR remediation.service_id IN (SELECT service_id FROM authorized_services)
    )
      AND remediation.state <> 'resolved'
      AND remediation.state <> 'dismissed'
    ORDER BY
      CASE remediation.severity
        WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      remediation.last_seen_at DESC, remediation.code, remediation.id
    LIMIT 100
  `, [actor.role, actor.role, actor.principalId, actor.role]);
  const historical = query.all<{
    code: string;
    severity: Severity;
    service_id: string | null;
    signal_count: number;
    first_seen_at: number;
    last_seen_at: number;
  }>(`
    WITH authorized_services(service_id) AS MATERIALIZED (
      SELECT id FROM services WHERE ? = 'superadmin'
      UNION ALL
      SELECT service_id FROM service_admins
      WHERE ? = 'admin' AND user_id = ?
    ),
    closed_signals AS MATERIALIZED (
      SELECT
        CASE
          WHEN event_type = 'self_api_key_blocked' THEN 'self_api_key.blocked'
          WHEN category = 'authentication' AND outcome IN ('deny', 'error')
            THEN 'authentication.failure'
          ELSE 'security.runtime'
        END AS code,
        CASE WHEN event_type = 'self_api_key_blocked'
          THEN 'critical' ELSE 'warning' END AS severity,
        service_id_snapshot AS service_id, occurred_at
      FROM runtime_audit_events
      WHERE event_type = 'self_api_key_blocked'
        OR (category = 'authentication' AND outcome IN ('deny', 'error'))
    )
    SELECT code, severity, service_id, count(*) AS signal_count,
      min(occurred_at) AS first_seen_at, max(occurred_at) AS last_seen_at
    FROM closed_signals
    WHERE (
      (? = 'superadmin' AND service_id IS NULL)
      OR service_id IN (SELECT service_id FROM authorized_services)
    )
    GROUP BY code, severity, service_id
    ORDER BY last_seen_at DESC, code, service_id
    LIMIT 100
  `, [actor.role, actor.role, actor.principalId, actor.role]);
  const currentCounts = new Map(currentFindings(query, now).map((finding) => [
    `${finding.code}\0${finding.serviceId ?? "global"}`,
    finding.count,
  ]));
  const remediationSignals: SecuritySignal[] = remediations.map((row) => ({
    code: row.code,
    severity: row.severity,
    count: currentCounts.get(
      `${row.code}\0${row.service_id ?? "global"}`,
    ) ?? 1,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    ...(row.service_id === null ? {} : { serviceId: row.service_id }),
    remediationId: row.id,
    remediationState: row.state,
    remediationVersion: row.version,
  }));
  return {
    generatedAt: now,
    signals: [
      ...remediationSignals,
      ...historical.map((row) => ({
        code: row.code,
        severity: row.severity,
        count: row.signal_count,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
        ...(row.service_id === null ? {} : { serviceId: row.service_id }),
      })),
    ].sort((left, right) =>
      severityRank(left.severity) - severityRank(right.severity)
      || right.lastSeenAt - left.lastSeenAt
      || left.code.localeCompare(right.code)),
    remediations: remediations.map(wireRemediation),
  };
}

function authorizedRemediation(
  query: PersistenceQuery,
  actor: ControlAuthenticationContext,
  id: string,
): RemediationRow | undefined {
  return query.get<RemediationRow>(`
    WITH authorized_services(service_id) AS MATERIALIZED (
      SELECT id FROM services WHERE ? = 'superadmin'
      UNION ALL
      SELECT service_id FROM service_admins
      WHERE ? = 'admin' AND user_id = ?
    )
    SELECT remediation.*
    FROM dashboard_remediations AS remediation
    WHERE remediation.id = ?
      AND (
        (? = 'superadmin' AND remediation.service_id IS NULL)
        OR remediation.service_id IN (SELECT service_id FROM authorized_services)
      )
      AND remediation.state <> 'resolved'
  `, [actor.role, actor.role, actor.principalId, id, actor.role]);
}

function wireRemediation(row: RemediationRow) {
  return {
    id: row.id,
    code: row.code,
    severity: row.severity,
    ...(row.service_id === null ? {} : { serviceId: row.service_id }),
    generation: row.generation,
    state: row.state,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    version: row.version,
  };
}

function remediationAudit(
  input: {
    actor: ControlAuthenticationContext;
    state: "acknowledged" | "dismissed";
    justification: string;
    correlationId: string;
  },
  before: RemediationRow,
  after: RemediationRow,
): AdministrativeAuditEventInput {
  return {
    actor: administrativeActorSnapshot(input.actor),
    action: `dashboard.remediation.${input.state}`,
    category: "security",
    result: "allow",
    target: {
      type: "dashboard_remediation",
      id: before.id,
      label: before.code,
    },
    ...(before.service_id === null ? {} : { serviceId: before.service_id }),
    justification: input.justification,
    changes: [
      { field: "state", before: before.state, after: after.state },
      { field: "generation", before: before.generation, after: after.generation },
    ],
    correlationId: input.correlationId,
    source: { category: "control", client: "browser" },
  };
}

function validateMutation(input: {
  remediationId: string;
  expectedVersion: number;
  state: string;
  justification: string;
  correlationId: string;
}): void {
  if (
    !isUuidV7(input.remediationId)
    || !Number.isSafeInteger(input.expectedVersion)
    || input.expectedVersion < 1
    || (input.state !== "acknowledged" && input.state !== "dismissed")
    || input.justification.length < 1
    || input.justification.length > 1_024
    || /[\r\n\p{C}]/u.test(input.justification)
    || input.correlationId.length < 1
    || input.correlationId.length > 128
    || !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input.correlationId,
    )
  ) throw new SecurityDashboardError("invalid");
}

function requireViewer(actor: ControlAuthenticationContext): void {
  if (
    actor.method !== "browser_session"
    || (actor.role !== "admin" && actor.role !== "superadmin")
  ) throw new SecurityDashboardError("forbidden");
}

function severityRank(severity: Severity): number {
  return severity === "critical" ? 0 : severity === "warning" ? 1 : 2;
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new SecurityDashboardError("unavailable");
  }
  return value;
}
