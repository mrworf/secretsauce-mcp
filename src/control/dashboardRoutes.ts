import type { ActivityAggregationService } from "../activityAggregation.js";
import {
  ActivityReportError,
  type ActivityReportService,
} from "../activityReports.js";
import {
  SecurityDashboardError,
  type SecurityDashboardService,
} from "../securityDashboard.js";
import {
  StatusDashboardError,
  type StatusDashboardService,
} from "../statusDashboard.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const windowSchema = z.enum(["24h", "7d", "30d", "90d"]);
const countSchema = z.object({
  value: z.number().int().nonnegative().nullable(),
  suppressed: z.boolean(),
  threshold: z.literal(3),
}).strict();
const activitySchema = z.object({
  generated_at: z.number().int().nonnegative(),
  window: windowSchema,
  start_at: z.number().int().nonnegative(),
  end_at: z.number().int().nonnegative(),
  totals: z.object({
    requests: z.number().int().nonnegative(),
    allow: z.number().int().nonnegative(),
    deny: z.number().int().nonnegative(),
    error: z.number().int().nonnegative(),
    credential_uses: z.number().int().nonnegative(),
    tokenizations: z.number().int().nonnegative(),
    api_key_activity: z.number().int().nonnegative(),
    active_users: countSchema,
  }).strict(),
  trend: z.array(z.object({
    bucket_start: z.number().int().nonnegative(),
    requests: z.number().int().nonnegative(),
    allow: z.number().int().nonnegative(),
    deny: z.number().int().nonnegative(),
    error: z.number().int().nonnegative(),
    status_1xx: z.number().int().nonnegative(),
    status_2xx: z.number().int().nonnegative(),
    status_3xx: z.number().int().nonnegative(),
    status_4xx: z.number().int().nonnegative(),
    status_5xx: z.number().int().nonnegative(),
  }).strict()).max(168),
  services: z.array(z.object({
    service_id: z.string().uuid(),
    service_name: z.string().min(1).max(120),
    requests: z.number().int().nonnegative(),
    credential_uses: z.number().int().nonnegative(),
    active_users: countSchema,
  }).strict()).max(100),
  endpoints: z.array(z.object({
    service_id: z.string().uuid(),
    service_name: z.string().min(1).max(120),
    category: z.string().min(1).max(256),
    requests: z.number().int().nonnegative(),
  }).strict()).max(100),
  freshness: z.object({
    cursor_sequence: z.number().int().nonnegative(),
    source_sequence: z.number().int().nonnegative(),
    last_completed_at: z.number().int().nonnegative().nullable(),
    partial: z.boolean(),
  }).strict(),
}).strict();
const referenceKindSchema = z.object({
  active: z.number().int().nonnegative(),
  expiring: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
}).strict();
const jobSchema = z.object({
  state: z.enum(["ready", "degraded", "unavailable"]),
  next_run_at: z.number().int().nonnegative().nullable(),
  last_completed_at: z.number().int().nonnegative().nullable(),
  last_outcome: z.string().max(64).nullable(),
  last_code: z.string().max(64).nullable(),
}).strict();
const statusSchema = z.object({
  generated_at: z.number().int().nonnegative(),
  services: z.array(z.object({
    service_id: z.string().uuid(),
    name: z.string().min(1).max(120),
    lifecycle: z.enum(["draft", "published", "archived"]),
    publication_generation: z.number().int().nonnegative(),
    credentials: z.object({
      configured: z.number().int().nonnegative(),
      unconfigured: z.number().int().nonnegative(),
      disabled: z.number().int().nonnegative(),
      archived: z.number().int().nonnegative(),
    }).strict(),
    references: z.object({
      state: z.enum(["available", "unavailable"]),
      gref: referenceKindSchema,
      sec: referenceKindSchema,
    }).strict(),
    active_grant_count: z.number().int().nonnegative(),
    api_keys: z.object({
      active: z.number().int().nonnegative(),
      expiring: z.number().int().nonnegative(),
      expired: z.number().int().nonnegative(),
    }).strict(),
    pending_remediation_count: z.number().int().nonnegative(),
  }).strict()).max(100),
  service_count: z.number().int().nonnegative(),
  services_truncated: z.boolean(),
  system: z.object({
    components: z.object({
      database: z.enum(["ready", "unavailable"]),
      schema: z.enum(["ready", "unsupported"]),
      vault: z.enum(["ready", "unavailable", "unsupported"]),
      audit: z.enum(["ready", "unavailable"]),
      identity: z.enum(["ready", "unavailable", "unsupported"]),
    }).strict(),
    jobs: z.object({
      audit: jobSchema,
      activity: jobSchema,
      inactivity: jobSchema,
    }).strict(),
    audit_capacity: z.object({
      administrative_rows: z.number().int().nonnegative(),
      runtime_rows: z.number().int().nonnegative(),
      estimated_bytes: z.number().int().nonnegative(),
      warnings: z.array(z.literal("capacity_planning_required")).max(1),
    }).strict(),
    api_keys: z.object({
      active: z.number().int().nonnegative(),
      expiring: z.number().int().nonnegative(),
      expired: z.number().int().nonnegative(),
      non_expiring: z.number().int().nonnegative(),
    }).strict(),
    users: z.object({
      suspended: z.number().int().nonnegative(),
      deactivated: z.number().int().nonnegative(),
      pending_enrollment: z.number().int().nonnegative(),
      active_without_services: z.number().int().nonnegative(),
    }).strict(),
  }).strict().optional(),
}).strict();
const remediationSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(64),
  severity: z.enum(["info", "warning", "critical"]),
  service_id: z.string().uuid().optional(),
  generation: z.number().int().positive(),
  state: z.enum(["open", "acknowledged", "dismissed", "resolved"]),
  first_seen_at: z.number().int().nonnegative(),
  last_seen_at: z.number().int().nonnegative(),
  version: z.number().int().positive(),
}).strict();
const securitySchema = z.object({
  generated_at: z.number().int().nonnegative(),
  signals: z.array(z.object({
    code: z.string().min(1).max(64),
    severity: z.enum(["info", "warning", "critical"]),
    count: z.number().int().positive(),
    first_seen_at: z.number().int().nonnegative(),
    last_seen_at: z.number().int().nonnegative(),
    service_id: z.string().uuid().optional(),
    remediation_id: z.string().uuid().optional(),
    remediation_state: z.enum([
      "open", "acknowledged", "dismissed", "resolved",
    ]).optional(),
    remediation_version: z.number().int().positive().optional(),
  }).strict()).max(200),
  remediations: z.array(remediationSchema).max(100),
}).strict();
const projectionStateSchema = z.object({
  next_run_at: z.number().int().nonnegative(),
  lease_expires_at: z.number().int().nonnegative().nullable(),
  cursor_sequence: z.number().int().nonnegative(),
  last_started_at: z.number().int().nonnegative().nullable(),
  last_completed_at: z.number().int().nonnegative().nullable(),
  last_outcome: z.enum(["completed", "partial", "skipped", "error"]).nullable(),
  last_code: z.string().max(64).nullable(),
  projected_count: z.number().int().nonnegative().max(1_000),
  deleted_bucket_count: z.number().int().nonnegative().max(1_000),
  version: z.number().int().positive(),
}).strict();
const justificationSchema = z.string().min(1).max(1_024)
  .refine((value) => value === value.trim() && !/[\0\r\n]/.test(value));
const REBUILD_ACKNOWLEDGEMENT = "REBUILD ACTIVITY AGGREGATES";

export function registerDashboardRoutes(
  registry: ControlRouteRegistry,
  dependencies: {
    activity: ActivityReportService;
    status: StatusDashboardService;
    security: SecurityDashboardService;
    aggregation: ActivityAggregationService;
  },
): void {
  registry.register(defineControlRoute({
    id: "dashboard.activity.get",
    method: "GET",
    path: "/api/v2/dashboard/activity",
    summary: "Read bounded scope-first activity reports",
    tags: ["Dashboard"],
    authentication: ["browser_session"],
    permission: "view_activity_dashboard",
    stepUp: "none",
    schemas: {
      query: z.object({
        window: windowSchema.optional(),
        service_id: z.string().uuid().optional(),
        limit: z.string().regex(/^(?:[1-9]|[1-9]\d|100)$/).optional(),
      }).strict(),
      response: activitySchema,
    },
    rateLimit: "search",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, query }) => {
      try {
        return {
          data: wireActivity(await dependencies.activity.report(authentication!, {
            ...(query.window === undefined ? {} : { window: query.window }),
            ...(query.service_id === undefined
              ? {}
              : { serviceId: query.service_id }),
            ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
          })),
        };
      } catch (error) {
        throw dashboardError(error);
      }
    },
  }));
  registry.register(defineControlRoute({
    id: "dashboard.status.get",
    method: "GET",
    path: "/api/v2/dashboard/status",
    summary: "Read sanitized role-scoped service and component status",
    tags: ["Dashboard"],
    authentication: ["browser_session"],
    permission: "view_status_dashboard",
    stepUp: "none",
    schemas: { response: statusSchema },
    rateLimit: "search",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication }) => {
      try {
        return { data: wireStatus(await dependencies.status.snapshot(authentication!)) };
      } catch (error) {
        throw dashboardError(error);
      }
    },
  }));
  registry.register(defineControlRoute({
    id: "dashboard.security.get",
    method: "GET",
    path: "/api/v2/dashboard/security",
    summary: "Read the closed scoped security signal catalog",
    tags: ["Dashboard"],
    authentication: ["browser_session"],
    permission: "view_security_dashboard",
    stepUp: "none",
    schemas: { response: securitySchema },
    rateLimit: "search",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication }) => {
      try {
        return {
          data: wireSecurity(await dependencies.security.snapshot(authentication!)),
        };
      } catch (error) {
        throw dashboardError(error);
      }
    },
  }));
  registry.register(defineControlRoute({
    id: "dashboard.remediations.get",
    method: "GET",
    path: "/api/v2/dashboard/remediations",
    summary: "List current scoped dashboard remediations",
    tags: ["Dashboard"],
    authentication: ["browser_session"],
    permission: "view_security_dashboard",
    stepUp: "none",
    schemas: {
      response: z.object({
        remediations: z.array(remediationSchema).max(100),
      }).strict(),
    },
    rateLimit: "search",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication }) => {
      try {
        const snapshot = await dependencies.security.snapshot(authentication!);
        return { data: { remediations: snapshot.remediations.map(wireRemediation) } };
      } catch (error) {
        throw dashboardError(error);
      }
    },
  }));
  registry.register(defineControlRoute({
    id: "dashboard.remediations.update",
    method: "PATCH",
    path: "/api/v2/dashboard/remediations/{remediation_id}",
    summary: "Acknowledge or dismiss one exact scoped remediation",
    tags: ["Dashboard"],
    authentication: ["browser_session"],
    permission: "manage_dashboard_remediations",
    stepUp: "always",
    schemas: {
      params: z.object({ remediation_id: z.string().uuid() }).strict(),
      body: z.object({
        state: z.enum(["acknowledged", "dismissed"]),
        justification: justificationSchema,
      }).strict(),
      response: remediationSchema,
    },
    rateLimit: "management",
    auditAction: "dashboard.remediation.update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({
      authentication,
      params,
      body,
      expectedVersion,
      requestId,
      stepUpProof,
    }) => {
      try {
        return {
          data: wireRemediation(await dependencies.security.updateRemediation({
            actor: authentication!,
            remediationId: params.remediation_id,
            expectedVersion: expectedVersion!,
            state: body.state,
            justification: body.justification,
            correlationId: requestId,
            ...(stepUpProof === undefined ? {} : { proof: stepUpProof }),
          })),
        };
      } catch (error) {
        throw dashboardError(error);
      }
    },
  }));
  registry.register(defineControlRoute({
    id: "dashboard.activity.rebuild",
    method: "POST",
    path: "/api/v2/dashboard/activity/rebuild",
    summary: "Run one bounded activity aggregate rebuild batch",
    tags: ["Dashboard"],
    authentication: ["browser_session"],
    permission: "rebuild_activity_dashboard",
    stepUp: "always",
    schemas: {
      body: z.object({
        acknowledgement: z.literal(REBUILD_ACKNOWLEDGEMENT),
        justification: justificationSchema,
      }).strict(),
      response: projectionStateSchema,
    },
    rateLimit: "management",
    auditAction: "activity.projection.run",
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
          "Activity maintenance is unavailable.",
        );
      }
      try {
        return {
          data: wireProjectionState(await dependencies.aggregation.run({
            actor: authentication!,
            justification: body.justification,
            correlationId: requestId,
            proof: stepUpProof,
          })),
        };
      } catch (error) {
        throw dashboardError(error);
      }
    },
  }));
}

function wireActivity(value: Awaited<ReturnType<ActivityReportService["report"]>>) {
  return {
    generated_at: value.generatedAt,
    window: value.window,
    start_at: value.startAt,
    end_at: value.endAt,
    totals: {
      requests: value.totals.requests,
      allow: value.totals.allow,
      deny: value.totals.deny,
      error: value.totals.error,
      credential_uses: value.totals.credentialUses,
      tokenizations: value.totals.tokenizations,
      api_key_activity: value.totals.apiKeyActivity,
      active_users: value.totals.activeUsers,
    },
    trend: value.trend.map((row) => ({
      bucket_start: row.bucketStart,
      requests: row.requests,
      allow: row.allow,
      deny: row.deny,
      error: row.error,
      status_1xx: row.status1xx,
      status_2xx: row.status2xx,
      status_3xx: row.status3xx,
      status_4xx: row.status4xx,
      status_5xx: row.status5xx,
    })),
    services: value.services.map((row) => ({
      service_id: row.serviceId,
      service_name: row.serviceName,
      requests: row.requests,
      credential_uses: row.credentialUses,
      active_users: row.activeUsers,
    })),
    endpoints: value.endpoints.map((row) => ({
      service_id: row.serviceId,
      service_name: row.serviceName,
      category: row.category,
      requests: row.requests,
    })),
    freshness: {
      cursor_sequence: value.freshness.cursorSequence,
      source_sequence: value.freshness.sourceSequence,
      last_completed_at: value.freshness.lastCompletedAt,
      partial: value.freshness.partial,
    },
  };
}

function wireStatus(value: Awaited<ReturnType<StatusDashboardService["snapshot"]>>) {
  return {
    generated_at: value.generatedAt,
    services: value.services.map((service) => ({
      service_id: service.serviceId,
      name: service.name,
      lifecycle: service.lifecycle,
      publication_generation: service.publicationGeneration,
      credentials: service.credentials,
      references: service.references,
      active_grant_count: service.activeGrantCount,
      api_keys: service.apiKeys,
      pending_remediation_count: service.pendingRemediationCount,
    })),
    service_count: value.serviceCount,
    services_truncated: value.servicesTruncated,
    ...(value.system === undefined ? {} : {
      system: {
        components: value.system.components,
        jobs: {
          audit: wireJob(value.system.jobs.audit),
          activity: wireJob(value.system.jobs.activity),
          inactivity: wireJob(value.system.jobs.inactivity),
        },
        audit_capacity: {
          administrative_rows: value.system.auditCapacity.administrativeRows,
          runtime_rows: value.system.auditCapacity.runtimeRows,
          estimated_bytes: value.system.auditCapacity.estimatedBytes,
          warnings: value.system.auditCapacity.warnings,
        },
        api_keys: {
          active: value.system.apiKeys.active,
          expiring: value.system.apiKeys.expiring,
          expired: value.system.apiKeys.expired,
          non_expiring: value.system.apiKeys.nonExpiring,
        },
        users: {
          suspended: value.system.users.suspended,
          deactivated: value.system.users.deactivated,
          pending_enrollment: value.system.users.pendingEnrollment,
          active_without_services: value.system.users.activeWithoutServices,
        },
      },
    }),
  };
}

function wireJob(value: {
  state: "ready" | "degraded" | "unavailable";
  nextRunAt: number | null;
  lastCompletedAt: number | null;
  lastOutcome: string | null;
  lastCode: string | null;
}) {
  return {
    state: value.state,
    next_run_at: value.nextRunAt,
    last_completed_at: value.lastCompletedAt,
    last_outcome: value.lastOutcome,
    last_code: value.lastCode,
  };
}

function wireSecurity(
  value: Awaited<ReturnType<SecurityDashboardService["snapshot"]>>,
) {
  return {
    generated_at: value.generatedAt,
    signals: value.signals.map((signal) => ({
      code: signal.code,
      severity: signal.severity,
      count: signal.count,
      first_seen_at: signal.firstSeenAt,
      last_seen_at: signal.lastSeenAt,
      ...(signal.serviceId === undefined ? {} : { service_id: signal.serviceId }),
      ...(signal.remediationId === undefined
        ? {}
        : { remediation_id: signal.remediationId }),
      ...(signal.remediationState === undefined
        ? {}
        : { remediation_state: signal.remediationState }),
      ...(signal.remediationVersion === undefined
        ? {}
        : { remediation_version: signal.remediationVersion }),
    })),
    remediations: value.remediations.map(wireRemediation),
  };
}

function wireRemediation(value: {
  id: string;
  code: string;
  severity: "info" | "warning" | "critical";
  serviceId?: string;
  generation: number;
  state: "open" | "acknowledged" | "dismissed" | "resolved";
  firstSeenAt: number;
  lastSeenAt: number;
  version: number;
}) {
  return {
    id: value.id,
    code: value.code,
    severity: value.severity,
    ...(value.serviceId === undefined ? {} : { service_id: value.serviceId }),
    generation: value.generation,
    state: value.state,
    first_seen_at: value.firstSeenAt,
    last_seen_at: value.lastSeenAt,
    version: value.version,
  };
}

function wireProjectionState(
  value: Awaited<ReturnType<ActivityAggregationService["state"]>>,
) {
  return {
    next_run_at: value.nextRunAt,
    lease_expires_at: value.leaseExpiresAt,
    cursor_sequence: value.cursorSequence,
    last_started_at: value.lastStartedAt,
    last_completed_at: value.lastCompletedAt,
    last_outcome: value.lastOutcome,
    last_code: value.lastCode,
    projected_count: value.projectedCount,
    deleted_bucket_count: value.deletedBucketCount,
    version: value.version,
  };
}

function dashboardError(error: unknown): ControlContractError {
  if (
    error instanceof ActivityReportError
    || error instanceof StatusDashboardError
    || error instanceof SecurityDashboardError
  ) {
    if (error.code === "forbidden") {
      return new ControlContractError(403, "forbidden", "Dashboard access is forbidden.");
    }
    if (error.code === "invalid") {
      return new ControlContractError(400, "invalid_request", "Dashboard request is invalid.");
    }
    if (error.code === "not_found") {
      return new ControlContractError(404, "not_found", "Dashboard record was not found.");
    }
    if (error.code === "stale") {
      return new ControlContractError(412, "stale_version", "Dashboard record version is stale.");
    }
  }
  return new ControlContractError(503, "maintenance", "Dashboard is unavailable.");
}
