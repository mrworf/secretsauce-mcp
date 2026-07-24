import type { ControlAuthenticationContext } from "./control/authentication.js";
import { administrativeActorSnapshot, currentApiKey } from "./apiKeyAuthority.js";
import { PASSWORD_BLOCKLIST_VERSION } from "./identity/password.js";
import { PersistenceError } from "./persistence/errors.js";
import type { PersistenceQuery } from "./persistence/transaction.js";
import type { PersistenceOwner } from "./persistence/worker.js";
import type { GatewayConfig } from "./types.js";

export interface SecuritySettings {
  passwordMinimumLength: number;
  passwordBlocklistVersion: number;
  passwordPolicyVersion: number;
  adminSessionAbsoluteMs: number;
  adminSessionInactivityMs: number;
  userSessionAbsoluteMs: number;
  userSessionInactivityMs: number;
  oauthAccessTokenMs: number;
  oauthRefreshInactivityMs: number;
  oauthRefreshAbsoluteMs: number;
  stepUpMode: "five_minutes" | "always";
  loginAttempts: number;
  loginWindowMs: number;
  passwordAttempts: number;
  passwordWindowMs: number;
  totpAttempts: number;
  totpWindowMs: number;
  managementApiAttempts: number;
  managementApiWindowMs: number;
  searchAttempts: number;
  searchWindowMs: number;
  backupAttempts: number;
  backupWindowMs: number;
  inactivitySuspensionDays: number | null;
  suspendedDeactivationDays: number | null;
  securityJobIntervalMs: number;
  securityJobBatchSize: number;
  securityJobWallTimeMs: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export type SecuritySettingsSeed = Omit<
  SecuritySettings,
  "passwordPolicyVersion" | "version" | "createdAt" | "updatedAt"
>;

export type SecuritySettingsPatch = Partial<SecuritySettingsSeed>;

type MutableSettingKey = keyof SecuritySettingsPatch;

const SYSTEM_API_KEY_FIELDS = new Set<MutableSettingKey>([
  "managementApiAttempts",
  "managementApiWindowMs",
  "searchAttempts",
  "searchWindowMs",
  "backupAttempts",
  "backupWindowMs",
  "securityJobIntervalMs",
  "securityJobBatchSize",
  "securityJobWallTimeMs",
]);

const COLUMN_BY_KEY: Readonly<Record<MutableSettingKey, string>> = {
  passwordMinimumLength: "password_minimum_length",
  passwordBlocklistVersion: "password_blocklist_version",
  adminSessionAbsoluteMs: "admin_session_absolute_ms",
  adminSessionInactivityMs: "admin_session_inactivity_ms",
  userSessionAbsoluteMs: "user_session_absolute_ms",
  userSessionInactivityMs: "user_session_inactivity_ms",
  oauthAccessTokenMs: "oauth_access_token_ms",
  oauthRefreshInactivityMs: "oauth_refresh_inactivity_ms",
  oauthRefreshAbsoluteMs: "oauth_refresh_absolute_ms",
  stepUpMode: "step_up_mode",
  loginAttempts: "login_attempts",
  loginWindowMs: "login_window_ms",
  passwordAttempts: "password_attempts",
  passwordWindowMs: "password_window_ms",
  totpAttempts: "totp_attempts",
  totpWindowMs: "totp_window_ms",
  managementApiAttempts: "management_api_attempts",
  managementApiWindowMs: "management_api_window_ms",
  searchAttempts: "search_attempts",
  searchWindowMs: "search_window_ms",
  backupAttempts: "backup_attempts",
  backupWindowMs: "backup_window_ms",
  inactivitySuspensionDays: "inactivity_suspension_days",
  suspendedDeactivationDays: "suspended_deactivation_days",
  securityJobIntervalMs: "security_job_interval_ms",
  securityJobBatchSize: "security_job_batch_size",
  securityJobWallTimeMs: "security_job_wall_time_ms",
};

const AUDIT_FIELD_BY_KEY: Readonly<Record<MutableSettingKey, string>> = {
  ...COLUMN_BY_KEY,
  passwordMinimumLength: "policy.minimum_length",
  passwordBlocklistVersion: "policy.blocklist_version",
  passwordAttempts: "verification.attempts",
  passwordWindowMs: "verification.window_ms",
};

interface SecuritySettingsRow {
  password_minimum_length: number;
  password_blocklist_version: number;
  password_policy_version: number;
  admin_session_absolute_ms: number;
  admin_session_inactivity_ms: number;
  user_session_absolute_ms: number;
  user_session_inactivity_ms: number;
  oauth_access_token_ms: number;
  oauth_refresh_inactivity_ms: number;
  oauth_refresh_absolute_ms: number;
  step_up_mode: "five_minutes" | "always";
  login_attempts: number;
  login_window_ms: number;
  password_attempts: number;
  password_window_ms: number;
  totp_attempts: number;
  totp_window_ms: number;
  management_api_attempts: number;
  management_api_window_ms: number;
  search_attempts: number;
  search_window_ms: number;
  backup_attempts: number;
  backup_window_ms: number;
  inactivity_suspension_days: number | null;
  suspended_deactivation_days: number | null;
  security_job_interval_ms: number;
  security_job_batch_size: number;
  security_job_wall_time_ms: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export class SecuritySettingsError extends Error {
  constructor(readonly code: "invalid" | "forbidden" | "stale" | "unavailable") {
    super("Security settings could not be updated.");
    this.name = "SecuritySettingsError";
  }
}

export class SecuritySettingsStore {
  #current: SecuritySettings;

  constructor(initial: SecuritySettings) {
    this.#current = immutableSettings(validateSettings(initial));
  }

  current(): SecuritySettings {
    return this.#current;
  }

  replace(next: SecuritySettings): void {
    const validated = validateSettings(next);
    if (validated.version <= this.#current.version) {
      throw new SecuritySettingsError("stale");
    }
    this.#current = immutableSettings(validated);
  }
}

export class SecuritySettingsRepository {
  constructor(
    private readonly owner: PersistenceOwner,
    private readonly now: () => number = Date.now,
  ) {}

  async initialize(seed: SecuritySettingsSeed): Promise<SecuritySettings> {
    const validated = validateSeed(seed);
    try {
      return await this.owner.execute({
        run: (database) => database.withOperationalTransaction((transaction) => {
          const existing = readRow(transaction);
          if (existing !== undefined) return rowToSettings(existing);
          const now = safeNow(this.now);
          transaction.run(`
            INSERT INTO security_settings (
              singleton, password_minimum_length, password_blocklist_version,
              password_policy_version, admin_session_absolute_ms,
              admin_session_inactivity_ms, user_session_absolute_ms,
              user_session_inactivity_ms, oauth_access_token_ms,
              oauth_refresh_inactivity_ms, oauth_refresh_absolute_ms,
              step_up_mode, login_attempts, login_window_ms,
              password_attempts, password_window_ms, totp_attempts,
              totp_window_ms, management_api_attempts,
              management_api_window_ms, search_attempts, search_window_ms,
              backup_attempts, backup_window_ms, inactivity_suspension_days,
              suspended_deactivation_days, security_job_interval_ms,
              security_job_batch_size, security_job_wall_time_ms,
              version, created_at, updated_at
            ) VALUES (
              1, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
            )
          `, seedParameters(validated, now));
          transaction.run(`
            INSERT INTO security_job_state (
              job_name, next_run_at, lease_owner, lease_expires_at,
              cursor_time, cursor_id, last_started_at, last_completed_at,
              last_outcome, last_code, suspended_count, deactivated_count,
              protected_count, version, created_at, updated_at
            ) VALUES (
              'inactivity', ?, NULL, NULL, NULL, NULL, NULL, NULL,
              NULL, NULL, 0, 0, 0, 1, ?, ?
            )
          `, [now + validated.securityJobIntervalMs, now, now]);
          const inserted = readRow(transaction);
          if (inserted === undefined) throw new PersistenceError("database_unavailable");
          return rowToSettings(inserted);
        }),
      });
    } catch (error) {
      if (error instanceof SecuritySettingsError) throw error;
      throw new SecuritySettingsError("unavailable");
    }
  }

  async read(): Promise<SecuritySettings> {
    try {
      const row = await this.owner.execute({
        run: (database) => database.read((query) => readRow(query)),
      });
      if (row === undefined) throw new SecuritySettingsError("unavailable");
      return rowToSettings(row);
    } catch (error) {
      if (error instanceof SecuritySettingsError) throw error;
      throw new SecuritySettingsError("unavailable");
    }
  }

  async update(input: {
    actor: ControlAuthenticationContext;
    expectedVersion: number;
    patch: SecuritySettingsPatch;
    justification: string;
    correlationId: string;
  }): Promise<SecuritySettings> {
    validateUpdateInput(input);
    try {
      return await this.owner.execute({
        run: (database) => database.withGeneratedAdministrativeAudit((transaction) => {
          authorizeMutation(transaction, input.actor, input.patch, this.now);
          const currentRow = readRow(transaction);
          if (currentRow === undefined) throw new PersistenceError("database_unavailable");
          const current = rowToSettings(currentRow);
          if (current.version !== input.expectedVersion) {
            throw new PersistenceError("security_settings_stale");
          }
          if (
            input.patch.passwordBlocklistVersion !== undefined
            && input.patch.passwordBlocklistVersion < current.passwordBlocklistVersion
          ) throw new PersistenceError("security_settings_invalid");
          let candidate: SecuritySettings;
          try {
            candidate = validateSettings({
              ...current,
              ...input.patch,
              passwordPolicyVersion:
                (
                  (
                    input.patch.passwordMinimumLength !== undefined
                    && input.patch.passwordMinimumLength >
                      current.passwordMinimumLength
                  )
                  || (
                    input.patch.passwordBlocklistVersion !== undefined
                    && input.patch.passwordBlocklistVersion >
                      current.passwordBlocklistVersion
                  )
                )
                  ? current.passwordPolicyVersion + 1
                  : current.passwordPolicyVersion,
              version: current.version + 1,
              updatedAt: safeNow(this.now),
            });
          } catch (error) {
            if (error instanceof SecuritySettingsError) {
              throw new PersistenceError("security_settings_invalid");
            }
            throw error;
          }
          const changedKeys = (Object.keys(input.patch) as MutableSettingKey[])
            .filter((key) => input.patch[key] !== current[key]);
          if (changedKeys.length === 0) {
            throw new PersistenceError("security_settings_invalid");
          }
          const assignments = [
            ...changedKeys.map((key) => `${COLUMN_BY_KEY[key]} = ?`),
            "password_policy_version = ?",
            "version = version + 1",
            "updated_at = ?",
          ];
          const result = transaction.run(`
            UPDATE security_settings SET ${assignments.join(", ")}
            WHERE singleton = 1 AND version = ?
          `, [
            ...changedKeys.map((key) => candidate[key] ?? null),
            candidate.passwordPolicyVersion,
            candidate.updatedAt,
            current.version,
          ]);
          if (result.changes !== 1) {
            throw new PersistenceError("security_settings_stale");
          }
          if (candidate.passwordPolicyVersion !== current.passwordPolicyVersion) {
            transaction.run(`
              UPDATE identity_security_state
              SET password_policy_version = ?, version = version + 1,
                  updated_at = ?
              WHERE singleton = 1
            `, [candidate.passwordPolicyVersion, candidate.updatedAt]);
          }
          const committed = readRow(transaction);
          if (committed === undefined) throw new PersistenceError("database_unavailable");
          const value = rowToSettings(committed);
          return {
            value,
            auditInput: {
              actor: administrativeActorSnapshot(input.actor),
              action: "security.settings.update",
              result: "allow",
              target: { type: "security_settings", label: "global-security-settings" },
              justification: input.justification,
              changes: changedKeys.map((key) => ({
                field: AUDIT_FIELD_BY_KEY[key],
                before: current[key],
                after: value[key],
              })),
              correlationId: input.correlationId,
              source: { category: "security" },
            },
          };
        }),
      });
    } catch (error) {
      if (error instanceof SecuritySettingsError) throw error;
      if (error instanceof PersistenceError) {
        if (error.code === "security_settings_invalid") {
          throw new SecuritySettingsError("invalid");
        }
        if (error.code === "security_settings_forbidden") {
          throw new SecuritySettingsError("forbidden");
        }
        if (error.code === "security_settings_stale") {
          throw new SecuritySettingsError("stale");
        }
      }
      throw new SecuritySettingsError("unavailable");
    }
  }
}

export function securitySettingsSeed(config: GatewayConfig): SecuritySettingsSeed {
  if (config.identity === undefined) throw new SecuritySettingsError("unavailable");
  const oauth = config.auth.mode === "builtin_oauth"
      && config.auth.builtinOAuth.identitySource === "database"
    ? config.auth.builtinOAuth
    : undefined;
  return validateSeed({
    passwordMinimumLength: config.identity.password.minimumLength,
    passwordBlocklistVersion: PASSWORD_BLOCKLIST_VERSION,
    adminSessionAbsoluteMs: config.identity.sessions.adminAbsoluteMs,
    adminSessionInactivityMs: config.identity.sessions.adminInactivityMs,
    userSessionAbsoluteMs: config.identity.sessions.userAbsoluteMs,
    userSessionInactivityMs: config.identity.sessions.userInactivityMs,
    oauthAccessTokenMs: oauth?.accessTokenTtlMs ?? 300_000,
    oauthRefreshInactivityMs: oauth?.refreshTokenIdleTtlMs ?? 2_592_000_000,
    oauthRefreshAbsoluteMs: oauth?.refreshTokenMaxTtlMs ?? 7_776_000_000,
    stepUpMode: config.identity.stepUpMode,
    loginAttempts: config.identity.limits.loginAttempts,
    loginWindowMs: config.identity.limits.loginWindowMs,
    passwordAttempts: config.identity.limits.passwordAttempts,
    passwordWindowMs: config.identity.limits.passwordWindowMs,
    totpAttempts: config.identity.limits.totpAttempts,
    totpWindowMs: config.identity.limits.totpWindowMs,
    managementApiAttempts: 120,
    managementApiWindowMs: 60_000,
    searchAttempts: 30,
    searchWindowMs: 60_000,
    backupAttempts: 2,
    backupWindowMs: 3_600_000,
    inactivitySuspensionDays: null,
    suspendedDeactivationDays: null,
    securityJobIntervalMs: 300_000,
    securityJobBatchSize: 500,
    securityJobWallTimeMs: 30_000,
  });
}

function authorizeMutation(
  query: PersistenceQuery,
  actor: ControlAuthenticationContext,
  patch: SecuritySettingsPatch,
  now: () => number,
): void {
  if (actor.method === "browser_session" && actor.role === "superadmin") {
    const user = query.get<{ role: string; status: string }>(
      "SELECT role, status FROM users WHERE id = ?",
      [actor.principalId],
    );
    if (user?.role === "superadmin" && user.status === "active") return;
  }
  if (actor.method === "api_key" && actor.role === "system") {
    try {
      currentApiKey(query, actor, now);
    } catch {
      throw new PersistenceError("security_settings_forbidden");
    }
    if (
      Object.keys(patch).every((key) =>
        SYSTEM_API_KEY_FIELDS.has(key as MutableSettingKey))
    ) return;
  }
  throw new PersistenceError("security_settings_forbidden");
}

function validateUpdateInput(input: {
  actor: ControlAuthenticationContext;
  expectedVersion: number;
  patch: SecuritySettingsPatch;
  justification: string;
  correlationId: string;
}): void {
  if (
    !Number.isSafeInteger(input.expectedVersion)
    || input.expectedVersion < 1
    || typeof input.justification !== "string"
    || input.justification.length < 1
    || input.justification.length > 1_024
    || input.justification !== input.justification.trim()
    || /[\0\r\n]/.test(input.justification)
    || typeof input.correlationId !== "string"
    || !/^(?:req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input.correlationId,
    )
    || Object.keys(input.patch).length < 1
    || Object.keys(input.patch).some((key) =>
      !(key in COLUMN_BY_KEY))
  ) throw new SecuritySettingsError("invalid");
}

function validateSeed(seed: SecuritySettingsSeed): SecuritySettingsSeed {
  validateSettings({
    ...seed,
    passwordPolicyVersion: 1,
    version: 1,
    createdAt: 0,
    updatedAt: 0,
  });
  return { ...seed };
}

function validateSettings(settings: SecuritySettings): SecuritySettings {
  bounded(settings.passwordMinimumLength, 8, 128);
  bounded(settings.passwordBlocklistVersion, 1, 2_147_483_647);
  positive(settings.passwordPolicyVersion);
  bounded(settings.adminSessionAbsoluteMs, 3_600_000, 86_400_000);
  bounded(settings.adminSessionInactivityMs, 300_000, 7_200_000);
  bounded(settings.userSessionAbsoluteMs, 3_600_000, 259_200_000);
  bounded(settings.userSessionInactivityMs, 300_000, 86_400_000);
  bounded(settings.oauthAccessTokenMs, 60_000, 900_000);
  bounded(settings.oauthRefreshInactivityMs, 86_400_000, 7_776_000_000);
  bounded(settings.oauthRefreshAbsoluteMs, 604_800_000, 31_536_000_000);
  if (!["five_minutes", "always"].includes(settings.stepUpMode)) invalid();
  bounded(settings.loginAttempts, 3, 20);
  bounded(settings.loginWindowMs, 300_000, 3_600_000);
  bounded(settings.passwordAttempts, 3, 20);
  bounded(settings.passwordWindowMs, 300_000, 3_600_000);
  bounded(settings.totpAttempts, 3, 10);
  bounded(settings.totpWindowMs, 60_000, 900_000);
  bounded(settings.managementApiAttempts, 10, 600);
  bounded(settings.managementApiWindowMs, 60_000, 3_600_000);
  bounded(settings.searchAttempts, 5, 120);
  bounded(settings.searchWindowMs, 60_000, 3_600_000);
  bounded(settings.backupAttempts, 1, 10);
  bounded(settings.backupWindowMs, 900_000, 86_400_000);
  nullableBounded(settings.inactivitySuspensionDays, 1, 3_650);
  nullableBounded(settings.suspendedDeactivationDays, 1, 3_650);
  bounded(settings.securityJobIntervalMs, 60_000, 86_400_000);
  bounded(settings.securityJobBatchSize, 50, 2_000);
  bounded(settings.securityJobWallTimeMs, 5_000, 120_000);
  positive(settings.version);
  if (
    !Number.isSafeInteger(settings.createdAt)
    || !Number.isSafeInteger(settings.updatedAt)
    || settings.createdAt < 0
    || settings.updatedAt < settings.createdAt
    || settings.adminSessionInactivityMs >= settings.adminSessionAbsoluteMs
    || settings.userSessionInactivityMs >= settings.userSessionAbsoluteMs
    || settings.oauthRefreshInactivityMs > settings.oauthRefreshAbsoluteMs
  ) invalid();
  return { ...settings };
}

function bounded(value: number, minimum: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) invalid();
}

function positive(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) invalid();
}

function nullableBounded(
  value: number | null,
  minimum: number,
  maximum: number,
): void {
  if (value !== null) bounded(value, minimum, maximum);
}

function invalid(): never {
  throw new SecuritySettingsError("invalid");
}

function safeNow(now: () => number): number {
  const value = Math.trunc(now());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new SecuritySettingsError("unavailable");
  }
  return value;
}

function readRow(query: PersistenceQuery): SecuritySettingsRow | undefined {
  return query.get<SecuritySettingsRow>(`
    SELECT
      password_minimum_length, password_blocklist_version,
      password_policy_version, admin_session_absolute_ms,
      admin_session_inactivity_ms, user_session_absolute_ms,
      user_session_inactivity_ms, oauth_access_token_ms,
      oauth_refresh_inactivity_ms, oauth_refresh_absolute_ms, step_up_mode,
      login_attempts, login_window_ms, password_attempts, password_window_ms,
      totp_attempts, totp_window_ms, management_api_attempts,
      management_api_window_ms, search_attempts, search_window_ms,
      backup_attempts, backup_window_ms, inactivity_suspension_days,
      suspended_deactivation_days, security_job_interval_ms,
      security_job_batch_size, security_job_wall_time_ms, version,
      created_at, updated_at
    FROM security_settings WHERE singleton = 1
  `);
}

function rowToSettings(row: SecuritySettingsRow): SecuritySettings {
  return validateSettings({
    passwordMinimumLength: row.password_minimum_length,
    passwordBlocklistVersion: row.password_blocklist_version,
    passwordPolicyVersion: row.password_policy_version,
    adminSessionAbsoluteMs: row.admin_session_absolute_ms,
    adminSessionInactivityMs: row.admin_session_inactivity_ms,
    userSessionAbsoluteMs: row.user_session_absolute_ms,
    userSessionInactivityMs: row.user_session_inactivity_ms,
    oauthAccessTokenMs: row.oauth_access_token_ms,
    oauthRefreshInactivityMs: row.oauth_refresh_inactivity_ms,
    oauthRefreshAbsoluteMs: row.oauth_refresh_absolute_ms,
    stepUpMode: row.step_up_mode,
    loginAttempts: row.login_attempts,
    loginWindowMs: row.login_window_ms,
    passwordAttempts: row.password_attempts,
    passwordWindowMs: row.password_window_ms,
    totpAttempts: row.totp_attempts,
    totpWindowMs: row.totp_window_ms,
    managementApiAttempts: row.management_api_attempts,
    managementApiWindowMs: row.management_api_window_ms,
    searchAttempts: row.search_attempts,
    searchWindowMs: row.search_window_ms,
    backupAttempts: row.backup_attempts,
    backupWindowMs: row.backup_window_ms,
    inactivitySuspensionDays: row.inactivity_suspension_days,
    suspendedDeactivationDays: row.suspended_deactivation_days,
    securityJobIntervalMs: row.security_job_interval_ms,
    securityJobBatchSize: row.security_job_batch_size,
    securityJobWallTimeMs: row.security_job_wall_time_ms,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function seedParameters(seed: SecuritySettingsSeed, now: number): Array<
  string | number | null
> {
  return [
    seed.passwordMinimumLength,
    seed.passwordBlocklistVersion,
    seed.adminSessionAbsoluteMs,
    seed.adminSessionInactivityMs,
    seed.userSessionAbsoluteMs,
    seed.userSessionInactivityMs,
    seed.oauthAccessTokenMs,
    seed.oauthRefreshInactivityMs,
    seed.oauthRefreshAbsoluteMs,
    seed.stepUpMode,
    seed.loginAttempts,
    seed.loginWindowMs,
    seed.passwordAttempts,
    seed.passwordWindowMs,
    seed.totpAttempts,
    seed.totpWindowMs,
    seed.managementApiAttempts,
    seed.managementApiWindowMs,
    seed.searchAttempts,
    seed.searchWindowMs,
    seed.backupAttempts,
    seed.backupWindowMs,
    seed.inactivitySuspensionDays,
    seed.suspendedDeactivationDays,
    seed.securityJobIntervalMs,
    seed.securityJobBatchSize,
    seed.securityJobWallTimeMs,
    now,
    now,
  ];
}

function immutableSettings(settings: SecuritySettings): SecuritySettings {
  return Object.freeze({ ...settings });
}
