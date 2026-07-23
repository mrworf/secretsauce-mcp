export type PersistenceErrorCode =
  | "database_unavailable"
  | "schema_unsupported"
  | "migration_failed"
  | "persistence_closed";

const messages: Record<PersistenceErrorCode, string> = {
  database_unavailable: "Persistence database is unavailable.",
  schema_unsupported: "Persistence schema is unsupported.",
  migration_failed: "Persistence migration failed.",
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
