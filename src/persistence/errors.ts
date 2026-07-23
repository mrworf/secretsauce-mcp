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
  | "totp_replayed"
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
  totp_replayed: "The authenticator code has already been used.",
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
