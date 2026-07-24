import { z } from "./zod.js";
import {
  RecoveryRemediationError,
  type RecoveryRemediationService,
} from "../recoveryRemediations.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";

const uuid = z.string().uuid();
const taskSchema = z.object({
  kind: z.enum(["migration", "restore"]),
  operation_id: uuid,
  id: uuid,
  service_id: uuid,
  service_slug: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  target_id: uuid.optional(),
  task_kind: z.enum([
    "assign_service_admin",
    "assign_service_access",
    "supply_credential",
    "review_enable_policy",
    "assign_enable_policy",
    "validate_publish_service",
    "missing_archive_secret",
  ]),
  state: z.enum(["open", "completed", "dismissed"]),
  derived_from_current_state: z.boolean(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
}).strict();
const responseSchema = z.object({
  migration: z.object({
    state: z.enum(["pending", "completed"]),
    migration_id: uuid.optional(),
    resolution_mode: z.enum([
      "definitions_only",
      "resolved_credentials",
    ]).optional(),
    services: z.number().int().nonnegative().max(10_000),
    credentials: z.number().int().nonnegative().max(10_000),
    configured_credentials: z.number().int().nonnegative().max(10_000),
    discarded_acl_entries: z.number().int().nonnegative().max(1_000_000),
    completed_at: z.number().int().nonnegative().optional(),
  }).strict(),
  latest_restore: z.object({
    restore_id: uuid,
    state: z.enum(["completed", "failed"]),
    outcome_code: z.string().regex(/^[a-z0-9_.-]{1,64}$/),
    services: z.number().int().nonnegative().max(10_000),
    credentials: z.number().int().nonnegative().max(10_000),
    available_secrets: z.number().int().nonnegative().max(10_000),
    unavailable_secrets: z.number().int().nonnegative().max(10_000),
    completed_at: z.number().int().nonnegative(),
  }).strict().optional(),
  counts: z.object({
    total: z.number().int().nonnegative().max(100_000),
    open: z.number().int().nonnegative().max(100_000),
    completed: z.number().int().nonnegative().max(100_000),
    dismissed: z.number().int().nonnegative().max(100_000),
  }).strict(),
  tasks: z.array(taskSchema).max(100),
  next_cursor: z.string().regex(
    /^(?:migration|restore):[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  ).optional(),
}).strict();

export function registerRecoveryRoutes(
  registry: ControlRouteRegistry,
  recovery: RecoveryRemediationService,
): void {
  registry.register(defineControlRoute({
    id: "recovery.remediations.get",
    method: "GET",
    path: "/api/v2/recovery/remediations",
    summary: "Read bounded durable restore and migration remediation state",
    tags: ["Recovery"],
    authentication: ["browser_session"],
    expandApiKeyAuthentication: false,
    permission: "manage_global_settings",
    stepUp: "none",
    schemas: {
      query: z.object({
        limit: z.string().regex(/^(?:[1-9]|[1-9]\d|100)$/).optional(),
        cursor: z.string().regex(
          /^(?:migration|restore):[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ).optional(),
      }).strict(),
      response: responseSchema,
    },
    rateLimit: "search",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async ({ authentication, query }) => {
      try {
        const snapshot = await recovery.snapshot(authentication!, {
          ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        });
        return { data: wireSnapshot(snapshot) };
      } catch (error) {
        if (
          error instanceof RecoveryRemediationError
          && error.code === "forbidden"
        ) {
          throw new ControlContractError(403, "forbidden", "Access denied.");
        }
        if (
          error instanceof RecoveryRemediationError
          && error.code === "invalid_input"
        ) {
          throw new ControlContractError(400, "invalid_request", "Invalid request.");
        }
        throw new ControlContractError(
          503,
          "dependency_unavailable",
          "Recovery state is unavailable.",
        );
      }
    },
  }));
}

function wireSnapshot(
  value: Awaited<ReturnType<RecoveryRemediationService["snapshot"]>>,
) {
  return {
    migration: {
      state: value.migration.state,
      ...(value.migration.migrationId === undefined
        ? {}
        : { migration_id: value.migration.migrationId }),
      ...(value.migration.resolutionMode === undefined
        ? {}
        : { resolution_mode: value.migration.resolutionMode }),
      services: value.migration.services,
      credentials: value.migration.credentials,
      configured_credentials: value.migration.configuredCredentials,
      discarded_acl_entries: value.migration.discardedAclEntries,
      ...(value.migration.completedAt === undefined
        ? {}
        : { completed_at: value.migration.completedAt }),
    },
    ...(value.latestRestore === undefined
      ? {}
      : {
          latest_restore: {
            restore_id: value.latestRestore.restoreId,
            state: value.latestRestore.state,
            outcome_code: value.latestRestore.outcomeCode,
            services: value.latestRestore.services,
            credentials: value.latestRestore.credentials,
            available_secrets: value.latestRestore.availableSecrets,
            unavailable_secrets: value.latestRestore.unavailableSecrets,
            completed_at: value.latestRestore.completedAt,
          },
        }),
    counts: value.counts,
    tasks: value.tasks.map((task) => ({
      kind: task.kind,
      operation_id: task.operationId,
      id: task.id,
      service_id: task.serviceId,
      service_slug: task.serviceSlug,
      ...(task.targetId === undefined ? {} : { target_id: task.targetId }),
      task_kind: task.taskKind,
      state: task.state,
      derived_from_current_state: task.derivedFromCurrentState,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    })),
    ...(value.nextCursor === undefined
      ? {}
      : { next_cursor: value.nextCursor }),
  };
}
