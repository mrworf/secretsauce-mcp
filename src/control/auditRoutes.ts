import {
  AUDIT_CATEGORIES,
} from "../persistence/auditDocuments.js";
import {
  AuditSearchError,
  type AuditDomain,
  type AuditSearchFilter,
  type AuditSearchService,
} from "../auditSearch.js";
import {
  AuditRetentionError,
  type AuditRetentionOverview,
  type AuditRetentionService,
} from "../auditRetention.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const outcomeSchema = z.enum(["allow", "deny", "error", "warning"]);
const presetSchema = z.enum(["24h", "7d", "30d", "90d", "year"]);
const utcSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
);
const querySchema = z.object({
  q: z.string().min(1).max(256).optional(),
  category: z.enum(AUDIT_CATEGORIES).optional(),
  outcome: outcomeSchema.optional(),
  action: z.string().min(1).max(128).regex(/^[a-z][a-z0-9_.-]*$/).optional(),
  service_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(),
  preset: presetSchema.optional(),
  start_utc: utcSchema.optional(),
  end_utc: utcSchema.optional(),
  limit: z.string().regex(/^(?:[1-9]|[1-9]\d|100)$/).optional(),
  cursor: z.string().min(16).max(2_048)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).optional(),
}).strict();
const selfQuerySchema = querySchema.pick({
  preset: true,
  start_utc: true,
  end_utc: true,
  limit: true,
  cursor: true,
});
const eventSchema = z.object({
  domain: z.enum(["administrative", "runtime"]),
  event_id: z.string().uuid(),
  occurred_at: z.number().int().nonnegative(),
  category: z.string().min(1).max(64),
  outcome: outcomeSchema,
  action: z.string().min(1).max(128),
  actor_id: z.string().uuid().optional(),
  actor_label: z.string().min(1).max(256),
  target_id: z.string().uuid().optional(),
  target_label: z.string().min(1).max(256).optional(),
  service_id: z.string().uuid().optional(),
  service_label: z.string().min(1).max(256).optional(),
  correlation_id: z.string().min(1).max(128).optional(),
  justification: z.string().min(1).max(1_024).optional(),
  failure_code: z.string().min(1).max(128).optional(),
  changes: z.array(z.unknown()).max(100),
  source: z.record(z.string(), z.unknown()),
  details: z.record(z.string(), z.unknown()),
}).strict();
const pageSchema = z.object({
  events: z.array(eventSchema).max(100),
  next_cursor: z.string().max(2_048).optional(),
}).strict();
const exportFilterSchema = z.object({
  q: z.string().min(1).max(256).optional(),
  category: z.enum(AUDIT_CATEGORIES).optional(),
  outcome: outcomeSchema.optional(),
  action: z.string().min(1).max(128).regex(/^[a-z][a-z0-9_.-]*$/).optional(),
  service_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(),
  preset: presetSchema.optional(),
  start_utc: utcSchema.optional(),
  end_utc: utcSchema.optional(),
  justification: z.string().min(1).max(1_024)
    .refine((value) => value === value.trim() && !/[\0\r\n]/.test(value)),
}).strict();
const exportSchema = z.object({
  filename: z.enum([
    "secretsauce-administrative-audit.ndjson",
    "secretsauce-runtime-audit.ndjson",
  ]),
  media_type: z.literal("application/x-ndjson"),
  content: z.string().max(5 * 1_024 * 1_024),
  row_count: z.number().int().min(0).max(10_000),
  byte_count: z.number().int().min(0).max(5 * 1_024 * 1_024),
}).strict();
const nullableDaysSchema = z.number().int().min(1).max(3_650).nullable();
const capacitySchema = z.object({
  row_count: z.number().int().nonnegative(),
  oldest_occurred_at: z.number().int().nonnegative().nullable(),
  newest_occurred_at: z.number().int().nonnegative().nullable(),
  estimated_bytes: z.number().int().nonnegative(),
  warnings: z.array(z.enum([
    "retention_above_default",
    "unlimited_retention_requires_capacity_planning",
    "audit_storage_above_planning_threshold",
  ])).max(3),
}).strict();
const maintenanceSchema = z.object({
  next_run_at: z.number().int().nonnegative(),
  lease_expires_at: z.number().int().nonnegative().nullable(),
  last_started_at: z.number().int().nonnegative().nullable(),
  last_completed_at: z.number().int().nonnegative().nullable(),
  last_outcome: z.enum(["completed", "partial", "skipped", "error"]).nullable(),
  last_code: z.string().max(64).nullable(),
  retained_administrative_count: z.number().int().nonnegative().max(1_000),
  retained_runtime_count: z.number().int().nonnegative().max(1_000),
  repaired_index_count: z.number().int().nonnegative().max(1_000),
  version: z.number().int().positive(),
}).strict();
const retentionSchema = z.object({
  settings: z.object({
    administrative_days: nullableDaysSchema,
    runtime_days: nullableDaysSchema,
    version: z.number().int().positive(),
    created_at: z.number().int().nonnegative(),
    updated_at: z.number().int().nonnegative(),
  }).strict(),
  administrative: capacitySchema,
  runtime: capacitySchema,
  maintenance: maintenanceSchema,
}).strict();
const RETENTION_ACKNOWLEDGEMENT = "I ACCEPT AUDIT RETENTION CHANGES";
const justificationSchema = z.string().min(1).max(1_024)
  .refine((value) => value === value.trim() && !/[\0\r\n]/.test(value));

export function registerAuditRoutes(
  registry: ControlRouteRegistry,
  service: AuditSearchService,
  retention?: AuditRetentionService,
): void {
  registerDomain(registry, service, "administrative");
  registerDomain(registry, service, "runtime");
  registry.register(defineControlRoute({
    id: "audits.self_security",
    method: "GET",
    path: "/api/v2/audits/self-security",
    summary: "List the authenticated user's own security evidence",
    tags: ["Audit"],
    authentication: ["browser_session"],
    permission: "authenticated",
    stepUp: "none",
    schemas: { query: selfQuerySchema, response: pageSchema },
    rateLimit: "search",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, query }) => {
      try {
        return { data: wirePage(await service.selfSecurity(authentication!, filter(query))) };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));
  if (retention !== undefined) registerRetentionRoutes(registry, retention);
}

function registerRetentionRoutes(
  registry: ControlRouteRegistry,
  retention: AuditRetentionService,
): void {
  registry.register(defineControlRoute({
    id: "audits.retention.get",
    method: "GET",
    path: "/api/v2/audits/retention",
    summary: "Read audit retention settings and capacity estimates",
    tags: ["Audit"],
    authentication: ["browser_session"],
    permission: "view_administrative_audit",
    stepUp: "none",
    schemas: { response: retentionSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication }) => retentionResult(
      retention.overview(authentication!),
    ),
  }));
  registry.register(defineControlRoute({
    id: "audits.retention.update",
    method: "PATCH",
    path: "/api/v2/audits/retention",
    summary: "Update independently bounded audit retention settings",
    tags: ["Audit"],
    authentication: ["browser_session"],
    permission: "manage_audit_retention",
    stepUp: "five_minutes",
    schemas: {
      body: z.object({
        administrative_days: nullableDaysSchema,
        runtime_days: nullableDaysSchema,
        justification: justificationSchema,
        acknowledgement: z.literal(RETENTION_ACKNOWLEDGEMENT),
      }).strict(),
      response: retentionSchema,
    },
    rateLimit: "management",
    auditAction: "audit.retention.update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({
      authentication,
      body,
      expectedVersion,
      requestId,
      stepUpProof,
    }) => retentionResult(retention.update({
      actor: authentication!,
      expectedVersion: expectedVersion!,
      administrativeDays: body.administrative_days,
      runtimeDays: body.runtime_days,
      justification: body.justification,
      correlationId: requestId,
      ...(stepUpProof === undefined ? {} : { proof: stepUpProof }),
    })),
  }));
  registry.register(defineControlRoute({
    id: "audits.retention.run",
    method: "POST",
    path: "/api/v2/audits/retention/run",
    summary: "Run bounded audit retention and index maintenance",
    tags: ["Audit"],
    authentication: ["browser_session"],
    permission: "manage_audit_retention",
    stepUp: "always",
    schemas: {
      body: z.object({
        justification: justificationSchema,
        acknowledgement: z.literal(RETENTION_ACKNOWLEDGEMENT),
      }).strict(),
      response: retentionSchema,
    },
    rateLimit: "management",
    auditAction: "audit.maintenance.run",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({
      authentication,
      body,
      requestId,
      stepUpProof,
    }) => {
      if (stepUpProof === undefined) {
        throw new ControlContractError(
          503,
          "maintenance",
          "Audit maintenance is unavailable.",
        );
      }
      return retentionResult(retention.run({
        actor: authentication!,
        justification: body.justification,
        correlationId: requestId,
        proof: stepUpProof,
      }));
    },
  }));
  registry.register(defineControlRoute({
    id: "audits.maintenance.get",
    method: "GET",
    path: "/api/v2/audits/maintenance",
    summary: "Read bounded audit maintenance state",
    tags: ["Audit"],
    authentication: ["browser_session"],
    permission: "view_administrative_audit",
    stepUp: "none",
    schemas: { response: maintenanceSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication }) => {
      const overview = await retentionResultValue(
        retention.overview(authentication!),
      );
      return { data: wireMaintenance(overview.maintenance), version: overview.maintenance.version };
    },
  }));
}

function registerDomain(
  registry: ControlRouteRegistry,
  service: AuditSearchService,
  domain: AuditDomain,
): void {
  registry.register(defineControlRoute({
    id: `audits.${domain}`,
    method: "GET",
    path: `/api/v2/audits/${domain}`,
    summary: `Search scoped ${domain} audit evidence`,
    tags: ["Audit"],
    authentication: ["browser_session"],
    permission: domain === "administrative"
      ? "view_administrative_audit"
      : "view_runtime_audit",
    stepUp: "none",
    schemas: { query: querySchema, response: pageSchema },
    rateLimit: "search",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, query }) => {
      try {
        return {
          data: wirePage(await service.search(
            authentication!,
            domain,
            filter(query),
            `audits.${domain}`,
          )),
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));
  registry.register(defineControlRoute({
    id: `audits.${domain}.export`,
    method: "POST",
    path: `/api/v2/audits/${domain}/export`,
    summary: `Export scoped ${domain} audit evidence as bounded NDJSON`,
    tags: ["Audit"],
    authentication: ["browser_session"],
    permission: "export_audit",
    stepUp: "none",
    schemas: { body: exportFilterSchema, response: exportSchema },
    rateLimit: "search",
    auditAction: "audit.export",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, body, requestId }) => {
      try {
        const { justification, ...rawFilter } = body;
        const exported = await service.export(
          authentication!,
          domain,
          filter(rawFilter),
          justification,
          requestId,
        );
        return {
          data: {
            filename: exported.filename as
              | "secretsauce-administrative-audit.ndjson"
              | "secretsauce-runtime-audit.ndjson",
            media_type: exported.mediaType,
            content: exported.content,
            row_count: exported.rowCount,
            byte_count: exported.byteCount,
          },
        };
      } catch (error) {
        throw contractError(error);
      }
    },
  }));
}

function filter(query: {
  q?: string | undefined;
  category?: (typeof AUDIT_CATEGORIES)[number] | undefined;
  outcome?: "allow" | "deny" | "error" | "warning" | undefined;
  action?: string | undefined;
  service_id?: string | undefined;
  actor_id?: string | undefined;
  preset?: "24h" | "7d" | "30d" | "90d" | "year" | undefined;
  start_utc?: string | undefined;
  end_utc?: string | undefined;
  limit?: string | undefined;
  cursor?: string | undefined;
}): AuditSearchFilter {
  return {
    ...(query.q === undefined ? {} : { q: query.q }),
    ...(query.category === undefined ? {} : { category: query.category }),
    ...(query.outcome === undefined ? {} : { outcome: query.outcome }),
    ...(query.action === undefined ? {} : { action: query.action }),
    ...(query.service_id === undefined ? {} : { serviceId: query.service_id }),
    ...(query.actor_id === undefined ? {} : { actorId: query.actor_id }),
    ...(query.preset === undefined ? {} : { preset: query.preset }),
    ...(query.start_utc === undefined ? {} : { startUtc: query.start_utc }),
    ...(query.end_utc === undefined ? {} : { endUtc: query.end_utc }),
    ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
  };
}

function wirePage(page: Awaited<ReturnType<AuditSearchService["search"]>>) {
  return {
    events: page.events.map((event) => ({
      domain: event.domain,
      event_id: event.eventId,
      occurred_at: event.occurredAt,
      category: event.category,
      outcome: event.outcome as "allow" | "deny" | "error" | "warning",
      action: event.action,
      ...(event.actorId === undefined ? {} : { actor_id: event.actorId }),
      actor_label: event.actorLabel,
      ...(event.targetId === undefined ? {} : { target_id: event.targetId }),
      ...(event.targetLabel === undefined ? {} : { target_label: event.targetLabel }),
      ...(event.serviceId === undefined ? {} : { service_id: event.serviceId }),
      ...(event.serviceLabel === undefined ? {} : { service_label: event.serviceLabel }),
      ...(event.correlationId === undefined ? {} : { correlation_id: event.correlationId }),
      ...(event.justification === undefined ? {} : { justification: event.justification }),
      ...(event.failureCode === undefined ? {} : { failure_code: event.failureCode }),
      changes: event.changes,
      source: event.source,
      details: event.details,
    })),
    ...(page.nextCursor === undefined ? {} : { next_cursor: page.nextCursor }),
  };
}

async function retentionResult(
  value: Promise<AuditRetentionOverview>,
) {
  const overview = await retentionResultValue(value);
  return {
    data: wireRetention(overview),
    version: overview.settings.version,
  };
}

async function retentionResultValue(
  value: Promise<AuditRetentionOverview>,
): Promise<AuditRetentionOverview> {
  try {
    return await value;
  } catch (error) {
    throw contractError(error);
  }
}

function wireRetention(value: AuditRetentionOverview) {
  return {
    settings: {
      administrative_days: value.settings.administrativeDays,
      runtime_days: value.settings.runtimeDays,
      version: value.settings.version,
      created_at: value.settings.createdAt,
      updated_at: value.settings.updatedAt,
    },
    administrative: wireCapacity(value.administrative),
    runtime: wireCapacity(value.runtime),
    maintenance: wireMaintenance(value.maintenance),
  };
}

function wireCapacity(value: AuditRetentionOverview["administrative"]) {
  return {
    row_count: value.rowCount,
    oldest_occurred_at: value.oldestOccurredAt,
    newest_occurred_at: value.newestOccurredAt,
    estimated_bytes: value.estimatedBytes,
    warnings: value.warnings as Array<
      | "retention_above_default"
      | "unlimited_retention_requires_capacity_planning"
      | "audit_storage_above_planning_threshold"
    >,
  };
}

function wireMaintenance(value: AuditRetentionOverview["maintenance"]) {
  return {
    next_run_at: value.nextRunAt,
    lease_expires_at: value.leaseExpiresAt,
    last_started_at: value.lastStartedAt,
    last_completed_at: value.lastCompletedAt,
    last_outcome: value.lastOutcome,
    last_code: value.lastCode,
    retained_administrative_count: value.retainedAdministrativeCount,
    retained_runtime_count: value.retainedRuntimeCount,
    repaired_index_count: value.repairedIndexCount,
    version: value.version,
  };
}

function contractError(error: unknown): ControlContractError {
  if (error instanceof AuditRetentionError) {
    if (error.code === "forbidden") {
      return new ControlContractError(403, "forbidden", "The operation is not permitted.");
    }
    if (error.code === "stale") {
      return new ControlContractError(
        409,
        "stale_version",
        "The resource changed. Refresh and retry.",
      );
    }
    if (error.code === "invalid") {
      return new ControlContractError(400, "invalid_request", "Audit retention is invalid.");
    }
    return new ControlContractError(503, "maintenance", "Audit maintenance is unavailable.");
  }
  if (error instanceof AuditSearchError) {
    return error.code === "forbidden"
      ? new ControlContractError(403, "forbidden", "The operation is not permitted.")
      : new ControlContractError(400, "invalid_request", "The audit filter is invalid.");
  }
  if (error instanceof ControlContractError) return error;
  return new ControlContractError(500, "internal_error", "The request could not be completed.");
}
