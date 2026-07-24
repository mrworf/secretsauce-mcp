import { createHash } from "node:crypto";
import type { ControlAuthenticationContext } from "./control/authentication.js";
import { ControlCursorCodec } from "./control/contracts.js";
import type { AuditCategory } from "./persistence/auditDocuments.js";
import type { PersistenceOwner } from "./persistence/worker.js";

export type AuditDomain = "administrative" | "runtime";
export type AuditPreset = "24h" | "7d" | "30d" | "90d" | "year";

export interface AuditSearchFilter {
  q?: string;
  category?: AuditCategory;
  outcome?: "allow" | "deny" | "error" | "warning";
  action?: string;
  serviceId?: string;
  actorId?: string;
  preset?: AuditPreset;
  startUtc?: string;
  endUtc?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditSearchPage {
  events: AuditSearchEvent[];
  nextCursor?: string;
}

export interface AuditExport {
  filename: string;
  mediaType: "application/x-ndjson";
  content: string;
  rowCount: number;
  byteCount: number;
}

export interface AuditSearchEvent {
  domain: AuditDomain;
  eventId: string;
  occurredAt: number;
  category: string;
  outcome: string;
  action: string;
  actorId?: string;
  actorLabel: string;
  targetId?: string;
  targetLabel?: string;
  serviceId?: string;
  serviceLabel?: string;
  correlationId?: string;
  justification?: string;
  failureCode?: string;
  changes: unknown[];
  source: Record<string, unknown>;
  details: Record<string, unknown>;
}

interface AuditRow extends Record<string, unknown> {
  sequence: number;
  event_id: string;
  occurred_at: number;
  category: string;
}

export class AuditSearchError extends Error {
  constructor(
    readonly code: "forbidden" | "invalid_filter" | "export_limit",
  ) {
    super(code);
    this.name = "AuditSearchError";
  }
}

export class AuditSearchService {
  readonly #cursors: ControlCursorCodec;

  constructor(
    private readonly persistence: PersistenceOwner,
    cursorKey: Buffer,
    private readonly now: () => number = Date.now,
  ) {
    this.#cursors = new ControlCursorCodec(cursorKey, now);
  }

  async search(
    authentication: ControlAuthenticationContext,
    domain: AuditDomain,
    input: AuditSearchFilter,
    routeId = `audits.${domain}`,
  ): Promise<AuditSearchPage> {
    requireExplorer(authentication);
    const normalized = normalizeFilter(input, this.now());
    const serviceIds = authentication.role === "superadmin"
      ? undefined
      : await this.assignedServices(authentication.principalId);
    const scopeDigest = digest({
      role: authentication.role,
      services: serviceIds ?? "all",
    });
    const binding = {
      routeId,
      principalId: authentication.principalId,
      scopeDigest,
      sort: "occurred_desc_sequence_desc",
      filterDigest: digest({ domain, ...normalized, cursor: undefined }),
    };
    const last = input.cursor === undefined
      ? undefined
      : parseLastKey(this.#cursors.decode(input.cursor, binding).lastKey);
    const rows = await this.persistence.execute({
      run: (database) => database.read((query) =>
        query.all<AuditRow>(
          searchSql(domain, normalized, serviceIds, last),
          searchParameters(normalized, serviceIds, last),
        )),
    });
    const hasNext = rows.length > normalized.limit;
    const selected = rows.slice(0, normalized.limit);
    const events = selected.map((row) => projectRow(domain, row));
    const tail = selected.at(-1);
    return {
      events,
      ...(hasNext && tail !== undefined
        ? {
            nextCursor: this.#cursors.encode({
              ...binding,
              lastKey: `${tail.occurred_at}:${tail.sequence}`,
            }),
          }
        : {}),
    };
  }

  async selfSecurity(
    authentication: ControlAuthenticationContext,
    input: Pick<AuditSearchFilter, "preset" | "startUtc" | "endUtc" | "limit" | "cursor">,
  ): Promise<AuditSearchPage> {
    if (!["user", "admin", "superadmin"].includes(authentication.role)) {
      throw new AuditSearchError("forbidden");
    }
    const normalized = normalizeFilter(input, this.now());
    const binding = {
      routeId: "audits.self_security",
      principalId: authentication.principalId,
      scopeDigest: digest({ self: authentication.principalId }),
      sort: "occurred_desc_sequence_desc",
      filterDigest: digest({ ...normalized, cursor: undefined }),
    };
    const last = input.cursor === undefined
      ? undefined
      : parseLastKey(this.#cursors.decode(input.cursor, binding).lastKey);
    const parameters: Array<string | number | null> = [
      authentication.principalId,
      authentication.principalId,
      normalized.start,
      normalized.end,
    ];
    const pageClause = last === undefined
      ? ""
      : " AND (occurred_at < ? OR (occurred_at = ? AND sequence < ?))";
    if (last !== undefined) parameters.push(last.occurredAt, last.occurredAt, last.sequence);
    parameters.push(normalized.limit + 1);
    const rows = await this.persistence.execute({
      run: (database) => database.read((query) => query.all<AuditRow>(`
        SELECT *
        FROM administrative_audit_events
        WHERE (actor_id_snapshot = ? OR target_id_snapshot = ?)
          AND category IN ('authentication', 'authorization', 'security')
          AND occurred_at >= ? AND occurred_at <= ?
          ${pageClause}
        ORDER BY occurred_at DESC, sequence DESC
        LIMIT ?
      `, parameters)),
    });
    const hasNext = rows.length > normalized.limit;
    const selected = rows.slice(0, normalized.limit);
    const tail = selected.at(-1);
    return {
      events: selected.map((row) => {
        const {
          justification: _justification,
          changes: _changes,
          source: _source,
          ...event
        } = projectRow("administrative", row);
        return {
          ...event,
          changes: [],
          source: {},
        };
      }),
      ...(hasNext && tail !== undefined
        ? {
            nextCursor: this.#cursors.encode({
              ...binding,
              lastKey: `${tail.occurred_at}:${tail.sequence}`,
            }),
          }
        : {}),
    };
  }

  async export(
    authentication: ControlAuthenticationContext,
    domain: AuditDomain,
    input: Omit<AuditSearchFilter, "limit" | "cursor">,
    justification: string,
    requestId: string,
  ): Promise<AuditExport> {
    requireExplorer(authentication);
    let cursor: string | undefined;
    const lines: string[] = [];
    let byteCount = 0;
    do {
      const page = await this.search(
        authentication,
        domain,
        {
          ...input,
          limit: 100,
          ...(cursor === undefined ? {} : { cursor }),
        },
        `audits.${domain}.export`,
      );
      for (const event of page.events) {
        if (lines.length >= 10_000) throw new AuditSearchError("export_limit");
        const line = `${JSON.stringify(event)}\n`;
        const nextBytes = byteCount + Buffer.byteLength(line, "utf8");
        if (nextBytes > 5 * 1_024 * 1_024) throw new AuditSearchError("export_limit");
        lines.push(line);
        byteCount = nextBytes;
      }
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    await this.persistence.execute({
      run: (database) => {
        database.appendAdministrativeAudit({
          actor: {
            type: "browser_session",
            id: authentication.principalId,
            label: `user:${authentication.principalId}`,
            role: authentication.role,
            authenticationMethod: authentication.method,
          },
          category: "audit",
          action: "audit.export",
          result: "allow",
          target: { type: "audit_domain", label: domain },
          ...(input.serviceId === undefined ? {} : {
            serviceId: input.serviceId,
            serviceLabel: `service:${input.serviceId}`,
          }),
          justification,
          changes: [
            {
              field: "filter_fields",
              after: Object.keys(input).sort().join(",") || "none",
            },
            { field: "row_count", after: lines.length },
            { field: "byte_count", after: byteCount },
          ],
          correlationId: requestId,
          source: { category: "control", client: "browser" },
        });
      },
    });
    return {
      filename: `secretsauce-${domain}-audit.ndjson`,
      mediaType: "application/x-ndjson",
      content: lines.join(""),
      rowCount: lines.length,
      byteCount,
    };
  }

  close(): void {
    this.#cursors.close();
  }

  private async assignedServices(userId: string): Promise<string[]> {
    return this.persistence.execute({
      run: (database) => database.read((query) =>
        query.all<{ service_id: string }>(
          "SELECT service_id FROM service_admins WHERE user_id = ? ORDER BY service_id",
          [userId],
        ).map((row) => row.service_id)),
    });
  }
}

interface NormalizedFilter {
  q?: string;
  category?: AuditCategory;
  outcome?: "allow" | "deny" | "error" | "warning";
  action?: string;
  serviceId?: string;
  actorId?: string;
  start: number;
  end: number;
  limit: number;
}

function normalizeFilter(input: AuditSearchFilter, now: number): NormalizedFilter {
  const limit = input.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new AuditSearchError("invalid_filter");
  }
  if (input.preset !== undefined && (input.startUtc !== undefined || input.endUtc !== undefined)) {
    throw new AuditSearchError("invalid_filter");
  }
  if ((input.startUtc === undefined) !== (input.endUtc === undefined)) {
    throw new AuditSearchError("invalid_filter");
  }
  const safeNow = Math.trunc(now);
  if (!Number.isSafeInteger(safeNow) || safeNow < 0) throw new AuditSearchError("invalid_filter");
  let start = 0;
  let end = safeNow;
  if (input.preset !== undefined) {
    const durations: Record<AuditPreset, number> = {
      "24h": 86_400_000,
      "7d": 7 * 86_400_000,
      "30d": 30 * 86_400_000,
      "90d": 90 * 86_400_000,
      year: 365 * 86_400_000,
    };
    start = Math.max(0, safeNow - durations[input.preset]);
  } else if (input.startUtc !== undefined && input.endUtc !== undefined) {
    start = parseUtc(input.startUtc);
    end = parseUtc(input.endUtc);
    if (start > end || end - start > 400 * 366 * 86_400_000) {
      throw new AuditSearchError("invalid_filter");
    }
  }
  const q = input.q === undefined ? undefined : literalFtsQuery(input.q);
  return {
    ...(q === undefined ? {} : { q }),
    ...(input.category === undefined ? {} : { category: input.category }),
    ...(input.outcome === undefined ? {} : { outcome: input.outcome }),
    ...(input.action === undefined ? {} : { action: input.action }),
    ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
    ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
    start,
    end,
    limit,
  };
}

function literalFtsQuery(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  if (
    normalized.length < 1 ||
    [...normalized].length > 256 ||
    /\p{C}/u.test(normalized)
  ) {
    throw new AuditSearchError("invalid_filter");
  }
  const tokens = normalized.split(/\s+/u);
  if (tokens.length > 16) throw new AuditSearchError("invalid_filter");
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"`).join(" AND ");
}

function parseUtc(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new AuditSearchError("invalid_filter");
  }
  const parsed = Date.parse(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || new Date(parsed).toISOString() !== value) {
    throw new AuditSearchError("invalid_filter");
  }
  return parsed;
}

function searchSql(
  domain: AuditDomain,
  filter: NormalizedFilter,
  serviceIds: string[] | undefined,
  last: { occurredAt: number; sequence: number } | undefined,
): string {
  const table = domain === "administrative"
    ? "administrative_audit_events"
    : "runtime_audit_events";
  const fts = domain === "administrative"
    ? "administrative_audit_fts"
    : "runtime_audit_fts";
  const actorColumn = domain === "administrative"
    ? "actor_id_snapshot"
    : "subject_id_snapshot";
  const actionColumn = domain === "administrative" ? "action" : "coalesce(action, event_type)";
  const conditions = [
    "occurred_at >= ?",
    "occurred_at <= ?",
    ...(filter.category === undefined ? [] : ["category = ?"]),
    ...(filter.outcome === undefined
      ? []
      : [domain === "administrative" ? "result = ?" : "outcome = ?"]),
    ...(filter.action === undefined ? [] : [`${actionColumn} = ?`]),
    ...(filter.serviceId === undefined ? [] : ["service_id_snapshot = ?"]),
    ...(filter.actorId === undefined ? [] : [`${actorColumn} = ?`]),
    ...(last === undefined
      ? []
      : ["(occurred_at < ? OR (occurred_at = ? AND sequence < ?))"]),
  ];
  const scope = serviceIds === undefined
    ? "1 = 1"
    : serviceIds.length === 0
      ? "0 = 1"
      : `service_id_snapshot IN (${serviceIds.map(() => "?").join(", ")})`;
  const ftsJoin = filter.q === undefined
    ? ""
    : `JOIN ${fts} AS search_index ON search_index.rowid = scoped.sequence`;
  const ftsCondition = filter.q === undefined ? "" : ` AND ${fts} MATCH ?`;
  return `
    WITH scoped AS MATERIALIZED (
      SELECT *
      FROM ${table}
      WHERE ${scope}
    )
    SELECT scoped.*
    FROM scoped
    ${ftsJoin}
    WHERE ${conditions.join(" AND ")}
    ${ftsCondition}
    ORDER BY occurred_at DESC, sequence DESC
    LIMIT ?
  `;
}

function searchParameters(
  filter: NormalizedFilter,
  serviceIds: string[] | undefined,
  last: { occurredAt: number; sequence: number } | undefined,
): Array<string | number | null> {
  return [
    ...(serviceIds ?? []),
    filter.start,
    filter.end,
    ...(filter.category === undefined ? [] : [filter.category]),
    ...(filter.outcome === undefined ? [] : [filter.outcome]),
    ...(filter.action === undefined ? [] : [filter.action]),
    ...(filter.serviceId === undefined ? [] : [filter.serviceId]),
    ...(filter.actorId === undefined ? [] : [filter.actorId]),
    ...(last === undefined ? [] : [last.occurredAt, last.occurredAt, last.sequence]),
    ...(filter.q === undefined ? [] : [filter.q]),
    filter.limit + 1,
  ];
}

function projectRow(domain: AuditDomain, row: AuditRow): AuditSearchEvent {
  if (domain === "administrative") {
    return {
      domain,
      eventId: String(row.event_id),
      occurredAt: Number(row.occurred_at),
      category: String(row.category),
      outcome: String(row.result),
      action: String(row.action),
      ...(row.actor_id_snapshot === null ? {} : { actorId: String(row.actor_id_snapshot) }),
      actorLabel: String(row.actor_label_snapshot),
      ...(row.target_id_snapshot === null ? {} : { targetId: String(row.target_id_snapshot) }),
      targetLabel: String(row.target_label_snapshot),
      ...(row.service_id_snapshot === null ? {} : { serviceId: String(row.service_id_snapshot) }),
      ...(row.service_label_snapshot === null ? {} : { serviceLabel: String(row.service_label_snapshot) }),
      correlationId: String(row.correlation_id),
      ...(row.justification === null ? {} : { justification: String(row.justification) }),
      ...(row.failure_code === null ? {} : { failureCode: String(row.failure_code) }),
      changes: parseArray(row.changes_json),
      source: parseObject(row.source_json),
      details: {},
    };
  }
  return {
    domain,
    eventId: String(row.event_id),
    occurredAt: Number(row.occurred_at),
    category: String(row.category),
    outcome: String(row.outcome),
    action: String(row.action ?? row.event_type),
    ...(row.subject_id_snapshot === null ? {} : { actorId: String(row.subject_id_snapshot) }),
    actorLabel: String(row.subject_label_snapshot),
    ...(row.service_id_snapshot === null ? {} : { serviceId: String(row.service_id_snapshot) }),
    ...(row.service_label_snapshot === null ? {} : { serviceLabel: String(row.service_label_snapshot) }),
    ...(row.correlation_id === null ? {} : { correlationId: String(row.correlation_id) }),
    ...(row.failure_code === null ? {} : { failureCode: String(row.failure_code) }),
    changes: [],
    source: parseObject(row.source_json),
    details: parseObject(row.details_json),
  };
}

function parseArray(value: unknown): unknown[] {
  const parsed = JSON.parse(String(value)) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function parseObject(value: unknown): Record<string, unknown> {
  const parsed = JSON.parse(String(value)) as unknown;
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function parseLastKey(value: string): { occurredAt: number; sequence: number } {
  const match = /^(\d+):(\d+)$/.exec(value);
  const occurredAt = Number(match?.[1]);
  const sequence = Number(match?.[2]);
  if (
    match === null ||
    !Number.isSafeInteger(occurredAt) ||
    !Number.isSafeInteger(sequence) ||
    occurredAt < 0 ||
    sequence < 1
  ) throw new AuditSearchError("invalid_filter");
  return { occurredAt, sequence };
}

function requireExplorer(authentication: ControlAuthenticationContext): void {
  if (!["admin", "superadmin"].includes(authentication.role)) {
    throw new AuditSearchError("forbidden");
  }
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
