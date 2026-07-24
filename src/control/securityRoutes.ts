import type { InactivityJob } from "../inactivityJob.js";
import {
  SecuritySettingsError,
  type SecuritySettingsPatch,
  type SecuritySettingsRepository,
  type SecuritySettingsStore,
} from "../securitySettings.js";
import { ControlContractError } from "./contracts.js";
import { defineControlRoute, type ControlRouteRegistry } from "./routeRegistry.js";
import { z } from "./zod.js";

const ACKNOWLEDGEMENT = "I ACCEPT SYSTEM-WIDE SECURITY POLICY CHANGES";
const integer = z.number().int();
const nullableDays = integer.min(1).max(3_650).nullable();
const patchSchema = z.object({
  password_minimum_length: integer.min(8).max(128).optional(),
  password_blocklist_version: integer.positive().optional(),
  admin_session_absolute_ms: integer.optional(),
  admin_session_inactivity_ms: integer.optional(),
  user_session_absolute_ms: integer.optional(),
  user_session_inactivity_ms: integer.optional(),
  oauth_access_token_ms: integer.optional(),
  oauth_refresh_inactivity_ms: integer.optional(),
  oauth_refresh_absolute_ms: integer.optional(),
  step_up_mode: z.enum(["five_minutes", "always"]).optional(),
  login_attempts: integer.optional(),
  login_window_ms: integer.optional(),
  password_attempts: integer.optional(),
  password_window_ms: integer.optional(),
  totp_attempts: integer.optional(),
  totp_window_ms: integer.optional(),
  management_api_attempts: integer.optional(),
  management_api_window_ms: integer.optional(),
  search_attempts: integer.optional(),
  search_window_ms: integer.optional(),
  backup_attempts: integer.optional(),
  backup_window_ms: integer.optional(),
  inactivity_suspension_days: nullableDays.optional(),
  suspended_deactivation_days: nullableDays.optional(),
  security_job_interval_ms: integer.optional(),
  security_job_batch_size: integer.optional(),
  security_job_wall_time_ms: integer.optional(),
  justification: z.string().min(1).max(1_024),
  acknowledgement: z.string().max(128).optional(),
}).strict();
const settingsSchema = z.object({
  password_minimum_length: integer,
  password_blocklist_version: integer,
  password_policy_version: integer,
  admin_session_absolute_ms: integer,
  admin_session_inactivity_ms: integer,
  user_session_absolute_ms: integer,
  user_session_inactivity_ms: integer,
  oauth_access_token_ms: integer,
  oauth_refresh_inactivity_ms: integer,
  oauth_refresh_absolute_ms: integer,
  step_up_mode: z.enum(["five_minutes", "always"]),
  login_attempts: integer,
  login_window_ms: integer,
  password_attempts: integer,
  password_window_ms: integer,
  totp_attempts: integer,
  totp_window_ms: integer,
  management_api_attempts: integer,
  management_api_window_ms: integer,
  search_attempts: integer,
  search_window_ms: integer,
  backup_attempts: integer,
  backup_window_ms: integer,
  inactivity_suspension_days: nullableDays,
  suspended_deactivation_days: nullableDays,
  security_job_interval_ms: integer,
  security_job_batch_size: integer,
  security_job_wall_time_ms: integer,
  version: integer.positive(),
  created_at: integer.nonnegative(),
  updated_at: integer.nonnegative(),
}).strict();
const jobSchema = z.object({
  next_run_at: integer.nonnegative(),
  lease_expires_at: integer.nonnegative().nullable(),
  last_started_at: integer.nonnegative().nullable(),
  last_completed_at: integer.nonnegative().nullable(),
  last_outcome: z.enum(["completed", "partial", "skipped", "error"]).nullable(),
  last_code: z.string().max(64).nullable(),
  suspended_count: integer.nonnegative(),
  deactivated_count: integer.nonnegative(),
  protected_count: integer.nonnegative(),
  version: integer.positive(),
}).strict();

export interface SecurityRouteDependencies {
  repository: SecuritySettingsRepository;
  store: SecuritySettingsStore;
  inactivityJob: InactivityJob;
}

export function registerSecurityRoutes(
  registry: ControlRouteRegistry,
  dependencies: SecurityRouteDependencies,
): void {
  registry.register(defineControlRoute({
    id: "security.settings.get",
    method: "GET",
    path: "/api/v2/security/settings",
    summary: "Read global security settings",
    tags: ["Security"],
    authentication: ["browser_session", "api_key"],
    permission: "manage_global_settings",
    stepUp: "none",
    schemas: { response: settingsSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async () => run(async () => {
      const value = await dependencies.repository.read();
      if (value.version > dependencies.store.current().version) {
        dependencies.store.replace(value);
      }
      return { data: wireSettings(value), version: value.version };
    }),
  }));

  registry.register(defineControlRoute({
    id: "security.settings.update",
    method: "PATCH",
    path: "/api/v2/security/settings",
    summary: "Update bounded global security settings",
    tags: ["Security"],
    authentication: ["browser_session", "api_key"],
    permission: "manage_global_settings",
    stepUp: "five_minutes",
    schemas: { body: patchSchema, response: settingsSchema },
    rateLimit: "management",
    auditAction: "security.settings.update",
    secretFields: [],
    cache: "no-store",
    concurrency: "if-match",
    idempotency: "none",
    handler: async ({
      authentication,
      body,
      expectedVersion,
      requestId,
    }) => run(async () => {
      const patch = patchFromWire(body);
      if (
        authentication!.method === "browser_session"
        && requiresAcknowledgement(patch)
        && body.acknowledgement !== ACKNOWLEDGEMENT
      ) throw new ControlContractError(
        400,
        "invalid_request",
        "The exact security policy acknowledgement is required.",
      );
      const value = await dependencies.repository.update({
        actor: authentication!,
        expectedVersion: expectedVersion!,
        patch,
        justification: body.justification,
        correlationId: requestId,
      });
      dependencies.store.replace(value);
      return { data: wireSettings(value), version: value.version };
    }),
  }));

  registry.register(defineControlRoute({
    id: "security.inactivity_job.get",
    method: "GET",
    path: "/api/v2/security/jobs/inactivity",
    summary: "Read inactivity automation state",
    tags: ["Security"],
    authentication: ["browser_session"],
    permission: "manage_global_settings",
    stepUp: "none",
    schemas: { response: jobSchema },
    rateLimit: "management",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async () => {
      const state = await dependencies.inactivityJob.state();
      return { data: wireJob(state), version: state.version };
    },
  }));

  registry.register(defineControlRoute({
    id: "security.inactivity_job.run",
    method: "POST",
    path: "/api/v2/security/jobs/inactivity/run",
    summary: "Run inactivity automation now",
    tags: ["Security"],
    authentication: ["browser_session"],
    permission: "manage_global_settings",
    stepUp: "always",
    schemas: {
      body: z.object({
        justification: z.string().min(1).max(1_024),
        acknowledgement: z.literal(ACKNOWLEDGEMENT),
      }).strict(),
      response: jobSchema,
    },
    rateLimit: "management",
    auditAction: "security.inactivity_job.run",
    secretFields: [],
    cache: "no-store",
    concurrency: "none",
    idempotency: "none",
    handler: async () => {
      const state = await dependencies.inactivityJob.run(true);
      return { data: wireJob(state), version: state.version };
    },
  }));
}

function patchFromWire(
  body: z.infer<typeof patchSchema>,
): SecuritySettingsPatch {
  const mapping = {
    password_minimum_length: "passwordMinimumLength",
    password_blocklist_version: "passwordBlocklistVersion",
    admin_session_absolute_ms: "adminSessionAbsoluteMs",
    admin_session_inactivity_ms: "adminSessionInactivityMs",
    user_session_absolute_ms: "userSessionAbsoluteMs",
    user_session_inactivity_ms: "userSessionInactivityMs",
    oauth_access_token_ms: "oauthAccessTokenMs",
    oauth_refresh_inactivity_ms: "oauthRefreshInactivityMs",
    oauth_refresh_absolute_ms: "oauthRefreshAbsoluteMs",
    step_up_mode: "stepUpMode",
    login_attempts: "loginAttempts",
    login_window_ms: "loginWindowMs",
    password_attempts: "passwordAttempts",
    password_window_ms: "passwordWindowMs",
    totp_attempts: "totpAttempts",
    totp_window_ms: "totpWindowMs",
    management_api_attempts: "managementApiAttempts",
    management_api_window_ms: "managementApiWindowMs",
    search_attempts: "searchAttempts",
    search_window_ms: "searchWindowMs",
    backup_attempts: "backupAttempts",
    backup_window_ms: "backupWindowMs",
    inactivity_suspension_days: "inactivitySuspensionDays",
    suspended_deactivation_days: "suspendedDeactivationDays",
    security_job_interval_ms: "securityJobIntervalMs",
    security_job_batch_size: "securityJobBatchSize",
    security_job_wall_time_ms: "securityJobWallTimeMs",
  } as const;
  return Object.fromEntries(
    Object.entries(mapping).flatMap(([wire, domain]) => {
      const value = body[wire as keyof typeof body];
      return value === undefined ? [] : [[domain, value]];
    }),
  ) as SecuritySettingsPatch;
}

function requiresAcknowledgement(patch: SecuritySettingsPatch): boolean {
  const ordinary = new Set<keyof SecuritySettingsPatch>([
    "loginAttempts", "loginWindowMs", "passwordAttempts", "passwordWindowMs",
    "totpAttempts", "totpWindowMs", "managementApiAttempts",
    "managementApiWindowMs", "searchAttempts", "searchWindowMs",
    "backupAttempts", "backupWindowMs",
  ]);
  return (Object.keys(patch) as Array<keyof SecuritySettingsPatch>)
    .some((key) => !ordinary.has(key));
}

function wireSettings(value: ReturnType<SecuritySettingsStore["current"]>) {
  return {
    password_minimum_length: value.passwordMinimumLength,
    password_blocklist_version: value.passwordBlocklistVersion,
    password_policy_version: value.passwordPolicyVersion,
    admin_session_absolute_ms: value.adminSessionAbsoluteMs,
    admin_session_inactivity_ms: value.adminSessionInactivityMs,
    user_session_absolute_ms: value.userSessionAbsoluteMs,
    user_session_inactivity_ms: value.userSessionInactivityMs,
    oauth_access_token_ms: value.oauthAccessTokenMs,
    oauth_refresh_inactivity_ms: value.oauthRefreshInactivityMs,
    oauth_refresh_absolute_ms: value.oauthRefreshAbsoluteMs,
    step_up_mode: value.stepUpMode,
    login_attempts: value.loginAttempts,
    login_window_ms: value.loginWindowMs,
    password_attempts: value.passwordAttempts,
    password_window_ms: value.passwordWindowMs,
    totp_attempts: value.totpAttempts,
    totp_window_ms: value.totpWindowMs,
    management_api_attempts: value.managementApiAttempts,
    management_api_window_ms: value.managementApiWindowMs,
    search_attempts: value.searchAttempts,
    search_window_ms: value.searchWindowMs,
    backup_attempts: value.backupAttempts,
    backup_window_ms: value.backupWindowMs,
    inactivity_suspension_days: value.inactivitySuspensionDays,
    suspended_deactivation_days: value.suspendedDeactivationDays,
    security_job_interval_ms: value.securityJobIntervalMs,
    security_job_batch_size: value.securityJobBatchSize,
    security_job_wall_time_ms: value.securityJobWallTimeMs,
    version: value.version,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

function wireJob(value: Awaited<ReturnType<InactivityJob["state"]>>) {
  return {
    next_run_at: value.nextRunAt,
    lease_expires_at: value.leaseExpiresAt,
    last_started_at: value.lastStartedAt,
    last_completed_at: value.lastCompletedAt,
    last_outcome: value.lastOutcome,
    last_code: value.lastCode,
    suspended_count: value.suspendedCount,
    deactivated_count: value.deactivatedCount,
    protected_count: value.protectedCount,
    version: value.version,
  };
}

async function run<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ControlContractError) throw error;
    if (error instanceof SecuritySettingsError) {
      if (error.code === "invalid") {
        throw new ControlContractError(400, "invalid_request", "Security settings are invalid.");
      }
      if (error.code === "forbidden") {
        throw new ControlContractError(403, "forbidden", "Security settings change denied.");
      }
      if (error.code === "stale") {
        throw new ControlContractError(409, "stale_version", "Security settings changed.");
      }
    }
    throw new ControlContractError(503, "maintenance", "Security automation is unavailable.");
  }
}
