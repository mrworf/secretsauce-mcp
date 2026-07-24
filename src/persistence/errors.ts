export type PersistenceErrorCode =
  | "database_unavailable"
  | "schema_unsupported"
  | "migration_failed"
  | "administrative_audit_required"
  | "invalid_audit_event"
  | "audit_persistence_failed"
  | "idempotency_conflict"
  | "invalid_idempotency_record"
  | "identity_not_found"
  | "identity_conflict"
  | "identity_stale"
  | "invalid_identity_transition"
  | "last_active_superadmin"
  | "bootstrap_unavailable"
  | "authentication_failed"
  | "authentication_method_required"
  | "totp_replayed"
  | "oauth_invalid_authorization"
  | "oauth_invalid_grant"
  | "oauth_capacity_exceeded"
  | "security_settings_invalid"
  | "security_settings_forbidden"
  | "security_settings_stale"
  | "audit_retention_invalid"
  | "audit_retention_stale"
  | "dashboard_not_found"
  | "dashboard_stale"
  | "restore_invalid"
  | "restore_not_found"
  | "restore_conflict"
  | "restore_expired"
  | "persistence_closed";

const messages: Record<PersistenceErrorCode, string> = {
  database_unavailable: "Persistence database is unavailable.",
  schema_unsupported: "Persistence schema is unsupported.",
  migration_failed: "Persistence migration failed.",
  administrative_audit_required: "Administrative audit event is required.",
  invalid_audit_event: "Administrative audit event is invalid.",
  audit_persistence_failed: "Administrative audit persistence failed.",
  idempotency_conflict: "The idempotency key conflicts with an earlier request.",
  invalid_idempotency_record: "The idempotency record is invalid.",
  identity_not_found: "Identity was not found.",
  identity_conflict: "Identity conflicts with an existing record.",
  identity_stale: "Identity version is stale.",
  invalid_identity_transition: "Identity transition is invalid.",
  last_active_superadmin: "The last active superadmin must be preserved.",
  bootstrap_unavailable: "Initial identity bootstrap is unavailable.",
  authentication_failed: "Authentication failed.",
  authentication_method_required: "An eligible authentication method is required.",
  totp_replayed: "The authenticator code has already been used.",
  oauth_invalid_authorization: "OAuth authorization is invalid.",
  oauth_invalid_grant: "OAuth grant is invalid.",
  oauth_capacity_exceeded: "OAuth state capacity is exhausted.",
  security_settings_invalid: "Security settings are invalid.",
  security_settings_forbidden: "Security settings access is forbidden.",
  security_settings_stale: "Security settings version is stale.",
  audit_retention_invalid: "Audit retention settings are invalid.",
  audit_retention_stale: "Audit retention settings version is stale.",
  dashboard_not_found: "Dashboard record was not found.",
  dashboard_stale: "Dashboard record version is stale.",
  restore_invalid: "Restore state is invalid.",
  restore_not_found: "Restore state was not found.",
  restore_conflict: "Restore state conflicts with the current operation.",
  restore_expired: "Restore state has expired.",
  persistence_closed: "Persistence owner is closed.",
};

export class PersistenceError extends Error {
  constructor(readonly code: PersistenceErrorCode) {
    super(messages[code]);
    this.name = "PersistenceError";
  }
}

export function mapPersistenceError(error: unknown, fallback: PersistenceErrorCode): PersistenceError {
  return error instanceof PersistenceError ? error : new PersistenceError(fallback);
}
