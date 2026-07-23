export type PersistenceErrorCode =
  | "database_unavailable"
  | "schema_unsupported"
  | "migration_failed"
  | "administrative_audit_required"
  | "invalid_audit_event"
  | "audit_persistence_failed"
  | "idempotency_conflict"
  | "invalid_idempotency_record"
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
