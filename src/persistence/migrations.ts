import { createHash } from "node:crypto";

export interface PersistenceMigration {
  version: number;
  name: string;
  sql: string;
}

const migration0001 = `
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
  checksum TEXT NOT NULL CHECK (length(checksum) = 64),
  applied_at INTEGER NOT NULL CHECK (applied_at >= 0),
  product_version TEXT NOT NULL CHECK (length(product_version) BETWEEN 1 AND 64)
) STRICT;

CREATE TABLE administrative_audit_events (
  event_id TEXT PRIMARY KEY CHECK (
    length(event_id) = 36
    AND event_id = lower(event_id)
  ),
  occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0),
  actor_type TEXT NOT NULL CHECK (
    actor_type IN ('browser_session', 'api_key', 'local_cli', 'system', 'job')
  ),
  actor_id_snapshot TEXT CHECK (actor_id_snapshot IS NULL OR length(actor_id_snapshot) BETWEEN 1 AND 128),
  actor_label_snapshot TEXT NOT NULL CHECK (length(actor_label_snapshot) BETWEEN 1 AND 256),
  actor_role_snapshot TEXT CHECK (actor_role_snapshot IS NULL OR length(actor_role_snapshot) BETWEEN 1 AND 64),
  authentication_method TEXT NOT NULL CHECK (length(authentication_method) BETWEEN 1 AND 64),
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 128),
  result TEXT NOT NULL CHECK (result IN ('allow', 'deny', 'error')),
  target_type TEXT NOT NULL CHECK (length(target_type) BETWEEN 1 AND 64),
  target_id_snapshot TEXT CHECK (target_id_snapshot IS NULL OR length(target_id_snapshot) BETWEEN 1 AND 128),
  target_label_snapshot TEXT NOT NULL CHECK (length(target_label_snapshot) BETWEEN 1 AND 256),
  service_id_snapshot TEXT CHECK (service_id_snapshot IS NULL OR length(service_id_snapshot) BETWEEN 1 AND 128),
  justification TEXT CHECK (justification IS NULL OR length(justification) BETWEEN 1 AND 1024),
  changes_json TEXT NOT NULL DEFAULT '[]' CHECK (length(changes_json) <= 16384 AND json_valid(changes_json)),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128),
  source_json TEXT NOT NULL DEFAULT '{}' CHECK (length(source_json) <= 4096 AND json_valid(source_json)),
  failure_code TEXT CHECK (failure_code IS NULL OR length(failure_code) BETWEEN 1 AND 128)
) STRICT;

CREATE INDEX administrative_audit_events_time_idx
  ON administrative_audit_events (occurred_at, event_id);
CREATE INDEX administrative_audit_events_service_time_idx
  ON administrative_audit_events (service_id_snapshot, occurred_at, event_id)
  WHERE service_id_snapshot IS NOT NULL;
CREATE INDEX administrative_audit_events_actor_time_idx
  ON administrative_audit_events (actor_id_snapshot, occurred_at, event_id)
  WHERE actor_id_snapshot IS NOT NULL;
CREATE INDEX administrative_audit_events_result_time_idx
  ON administrative_audit_events (result, occurred_at, event_id);
`;

export const PERSISTENCE_MIGRATIONS: readonly PersistenceMigration[] = [{
  version: 1,
  name: "persistence_and_administrative_audit_foundation",
  sql: migration0001,
}];

export function migrationChecksum(migration: PersistenceMigration): string {
  return createHash("sha256")
    .update(`${migration.version}\0${migration.name}\0${migration.sql}`, "utf8")
    .digest("hex");
}

export function validateMigrationRegistry(migrations: readonly PersistenceMigration[]): void {
  for (let index = 0; index < migrations.length; index += 1) {
    const migration = migrations[index];
    if (
      migration === undefined ||
      migration.version !== index + 1 ||
      migration.name.length < 1 ||
      migration.name.length > 128 ||
      migration.sql.trim().length === 0
    ) {
      throw new Error("Invalid persistence migration registry.");
    }
  }
}
