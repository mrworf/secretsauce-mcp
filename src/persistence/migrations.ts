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

const migration0002 = `
CREATE TABLE control_idempotency_records (
  key_hash TEXT PRIMARY KEY CHECK (
    length(key_hash) = 64
    AND key_hash = lower(key_hash)
    AND key_hash NOT GLOB '*[^0-9a-f]*'
  ),
  principal_id TEXT NOT NULL CHECK (
    length(principal_id) = 36
    AND principal_id = lower(principal_id)
  ),
  route_id TEXT NOT NULL CHECK (
    length(route_id) BETWEEN 1 AND 128
    AND route_id NOT GLOB '*[^a-z0-9_.-]*'
  ),
  request_digest TEXT NOT NULL CHECK (
    length(request_digest) = 64
    AND request_digest = lower(request_digest)
    AND request_digest NOT GLOB '*[^0-9a-f]*'
  ),
  result_reference TEXT NOT NULL CHECK (
    length(result_reference) = 36
    AND result_reference = lower(result_reference)
  ),
  response_status INTEGER NOT NULL CHECK (
    response_status BETWEEN 200 AND 299
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  completed_at INTEGER NOT NULL CHECK (
    completed_at >= created_at
  ),
  expires_at INTEGER NOT NULL CHECK (
    expires_at > completed_at
  )
) STRICT;

CREATE INDEX control_idempotency_expiry_idx
  ON control_idempotency_records (expires_at, key_hash);
CREATE INDEX control_idempotency_principal_route_idx
  ON control_idempotency_records (principal_id, route_id, expires_at);
`;

const migration0003 = `
CREATE TABLE users (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id = lower(id)
    AND substr(id, 9, 1) = '-'
    AND substr(id, 14, 1) = '-'
    AND substr(id, 19, 1) = '-'
    AND substr(id, 24, 1) = '-'
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  normalized_email TEXT NOT NULL UNIQUE CHECK (
    length(normalized_email) BETWEEN 3 AND 254
    AND normalized_email = lower(normalized_email)
  ),
  given_name TEXT NOT NULL CHECK (length(given_name) <= 128),
  family_name TEXT NOT NULL CHECK (length(family_name) <= 128),
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'user')),
  status TEXT NOT NULL CHECK (
    status IN ('invited', 'enrollment_required', 'active', 'suspended', 'deactivated')
  ),
  security_epoch INTEGER NOT NULL DEFAULT 1 CHECK (security_epoch > 0),
  password_policy_version INTEGER NOT NULL DEFAULT 1 CHECK (password_policy_version > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE INDEX users_status_role_idx ON users (status, role, id);

CREATE TABLE local_authenticator_states (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_state TEXT NOT NULL CHECK (
    password_state IN ('not_configured', 'temporary', 'configured', 'disabled')
  ),
  totp_state TEXT NOT NULL CHECK (
    totp_state IN ('not_configured', 'configured', 'disabled')
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE TABLE external_identities (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36
    AND id = lower(id)
    AND substr(id, 9, 1) = '-'
    AND substr(id, 14, 1) = '-'
    AND substr(id, 19, 1) = '-'
    AND substr(id, 24, 1) = '-'
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL CHECK (
    length(provider_id) BETWEEN 1 AND 64
    AND provider_id = lower(provider_id)
    AND provider_id NOT GLOB '*[^a-z0-9_.-]*'
  ),
  issuer TEXT NOT NULL CHECK (length(issuer) BETWEEN 8 AND 2048),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (provider_id, issuer, subject)
) STRICT;

CREATE INDEX external_identities_user_idx
  ON external_identities (user_id, provider_id, id);

CREATE TABLE identity_security_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  global_security_epoch INTEGER NOT NULL CHECK (global_security_epoch > 0),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

INSERT INTO identity_security_state (
  singleton, global_security_epoch, version, created_at, updated_at
) VALUES (1, 1, 1, 0, 0);

CREATE TABLE identity_bootstrap (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
) STRICT;
`;

const migration0004 = `
ALTER TABLE users ADD COLUMN last_login_at INTEGER
  CHECK (last_login_at IS NULL OR last_login_at >= 0);
ALTER TABLE users ADD COLUMN last_authenticated_at INTEGER
  CHECK (last_authenticated_at IS NULL OR last_authenticated_at >= 0);

CREATE TABLE local_password_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encoded_hash TEXT NOT NULL CHECK (length(encoded_hash) BETWEEN 64 AND 512),
  policy_version INTEGER NOT NULL CHECK (policy_version > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE TABLE local_totp_authenticators (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  envelope_json TEXT NOT NULL CHECK (
    length(envelope_json) BETWEEN 128 AND 4096 AND json_valid(envelope_json)
  ),
  root_key_id TEXT NOT NULL CHECK (
    length(root_key_id) BETWEEN 1 AND 64
    AND root_key_id NOT GLOB '*[^A-Za-z0-9._-]*'
  ),
  generation INTEGER NOT NULL CHECK (generation > 0),
  confirmed_at INTEGER NOT NULL CHECK (confirmed_at >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE TABLE accepted_totp_steps (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_step INTEGER NOT NULL CHECK (time_step >= 0),
  purpose TEXT NOT NULL CHECK (purpose IN ('confirmation', 'login', 'step_up')),
  accepted_at INTEGER NOT NULL CHECK (accepted_at >= 0),
  PRIMARY KEY (user_id, time_step)
) STRICT, WITHOUT ROWID;

CREATE INDEX accepted_totp_steps_time_idx
  ON accepted_totp_steps (accepted_at, user_id, time_step);

CREATE TABLE browser_sessions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL UNIQUE CHECK (
    length(session_hash) = 64 AND session_hash = lower(session_hash)
    AND session_hash NOT GLOB '*[^0-9a-f]*'
  ),
  csrf_hash TEXT NOT NULL UNIQUE CHECK (
    length(csrf_hash) = 64 AND csrf_hash = lower(csrf_hash)
    AND csrf_hash NOT GLOB '*[^0-9a-f]*'
  ),
  role_class TEXT NOT NULL CHECK (role_class IN ('admin', 'user')),
  issued_security_epoch INTEGER NOT NULL CHECK (issued_security_epoch > 0),
  issued_global_epoch INTEGER NOT NULL CHECK (issued_global_epoch > 0),
  issued_absolute_ms INTEGER NOT NULL CHECK (issued_absolute_ms > 0),
  issued_inactivity_ms INTEGER NOT NULL CHECK (issued_inactivity_ms > 0),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  last_activity_at INTEGER NOT NULL CHECK (last_activity_at >= issued_at),
  absolute_expires_at INTEGER NOT NULL CHECK (absolute_expires_at > issued_at),
  step_up_at INTEGER CHECK (step_up_at IS NULL OR step_up_at >= issued_at),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= issued_at),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
) STRICT;

CREATE INDEX browser_sessions_user_active_idx
  ON browser_sessions (user_id, revoked_at, absolute_expires_at, id);
CREATE INDEX browser_sessions_expiry_idx
  ON browser_sessions (absolute_expires_at, id);

CREATE TABLE identity_step_up_proofs (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  proof_hash TEXT NOT NULL UNIQUE CHECK (
    length(proof_hash) = 64 AND proof_hash = lower(proof_hash)
    AND proof_hash NOT GLOB '*[^0-9a-f]*'
  ),
  session_id TEXT NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (length(method) BETWEEN 3 AND 16 AND method = upper(method)),
  route_id TEXT NOT NULL CHECK (
    length(route_id) BETWEEN 1 AND 128
    AND route_id NOT GLOB '*[^a-z0-9_.-]*'
  ),
  targets_json TEXT NOT NULL CHECK (length(targets_json) <= 4096 AND json_valid(targets_json)),
  expected_version INTEGER CHECK (expected_version IS NULL OR expected_version > 0),
  idempotency_key_hash TEXT CHECK (
    idempotency_key_hash IS NULL OR (
      length(idempotency_key_hash) = 64
      AND idempotency_key_hash = lower(idempotency_key_hash)
      AND idempotency_key_hash NOT GLOB '*[^0-9a-f]*'
    )
  ),
  body_digest TEXT NOT NULL CHECK (
    length(body_digest) = 64 AND body_digest = lower(body_digest)
    AND body_digest NOT GLOB '*[^0-9a-f]*'
  ),
  issued_security_epoch INTEGER NOT NULL CHECK (issued_security_epoch > 0),
  issued_global_epoch INTEGER NOT NULL CHECK (issued_global_epoch > 0),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= issued_at)
) STRICT;

CREATE INDEX identity_step_up_proofs_expiry_idx
  ON identity_step_up_proofs (expires_at, consumed_at, id);
CREATE INDEX identity_step_up_proofs_session_idx
  ON identity_step_up_proofs (session_id, consumed_at, expires_at, id);
`;

const migration0005 = `
CREATE TABLE identity_temporary_passwords (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encoded_hash TEXT NOT NULL CHECK (length(encoded_hash) BETWEEN 64 AND 512),
  purpose TEXT NOT NULL CHECK (
    purpose IN ('initial_enrollment', 'password_reset', 'break_glass')
  ),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= issued_at),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= issued_at),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
) STRICT;

CREATE INDEX identity_temporary_passwords_expiry_idx
  ON identity_temporary_passwords (expires_at, consumed_at, revoked_at, user_id);

CREATE TABLE identity_restricted_sessions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (
    purpose IN ('initial_enrollment', 'password_change', 'totp_enrollment', 'totp_replacement')
  ),
  session_hash TEXT NOT NULL UNIQUE CHECK (
    length(session_hash) = 64 AND session_hash = lower(session_hash)
    AND session_hash NOT GLOB '*[^0-9a-f]*'
  ),
  csrf_hash TEXT NOT NULL UNIQUE CHECK (
    length(csrf_hash) = 64 AND csrf_hash = lower(csrf_hash)
    AND csrf_hash NOT GLOB '*[^0-9a-f]*'
  ),
  issued_security_epoch INTEGER NOT NULL CHECK (issued_security_epoch > 0),
  issued_global_epoch INTEGER NOT NULL CHECK (issued_global_epoch > 0),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= issued_at),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
) STRICT;

CREATE INDEX identity_restricted_sessions_user_active_idx
  ON identity_restricted_sessions (user_id, revoked_at, expires_at, id);
CREATE INDEX identity_restricted_sessions_expiry_idx
  ON identity_restricted_sessions (expires_at, revoked_at, id);

CREATE TABLE identity_pending_totp (
  restricted_session_id TEXT PRIMARY KEY
    REFERENCES identity_restricted_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  authenticator_id TEXT NOT NULL UNIQUE CHECK (
    length(authenticator_id) = 36 AND authenticator_id = lower(authenticator_id)
    AND substr(authenticator_id, 15, 1) = '7'
    AND substr(authenticator_id, 20, 1) IN ('8', '9', 'a', 'b')
    AND authenticator_id NOT GLOB '*[^0-9a-f-]*'
  ),
  envelope_json TEXT NOT NULL CHECK (
    length(envelope_json) BETWEEN 128 AND 4096 AND json_valid(envelope_json)
  ),
  root_key_id TEXT NOT NULL CHECK (
    length(root_key_id) BETWEEN 1 AND 64
    AND root_key_id NOT GLOB '*[^A-Za-z0-9._-]*'
  ),
  generation INTEGER NOT NULL CHECK (generation > 0),
  password_policy_version INTEGER NOT NULL CHECK (password_policy_version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
) STRICT;

CREATE INDEX identity_pending_totp_user_idx
  ON identity_pending_totp (user_id, expires_at, restricted_session_id);

CREATE TABLE identity_invalidation_events (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (
    reason IN ('password_reset', 'totp_reset', 'password_change', 'totp_change', 'break_glass', 'enrollment')
  ),
  browser_sessions_revoked INTEGER NOT NULL CHECK (browser_sessions_revoked >= 0),
  restricted_sessions_revoked INTEGER NOT NULL CHECK (restricted_sessions_revoked >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  dispatched_at INTEGER CHECK (dispatched_at IS NULL OR dispatched_at >= created_at),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
) STRICT;

CREATE INDEX identity_invalidation_events_dispatch_idx
  ON identity_invalidation_events (dispatched_at, created_at, id);
CREATE INDEX identity_invalidation_events_user_idx
  ON identity_invalidation_events (user_id, created_at, id);
`;

export const PERSISTENCE_MIGRATIONS: readonly PersistenceMigration[] = [
  {
    version: 1,
    name: "persistence_and_administrative_audit_foundation",
    sql: migration0001,
  },
  {
    version: 2,
    name: "control_idempotency_foundation",
    sql: migration0002,
  },
  {
    version: 3,
    name: "identity_bootstrap_foundation",
    sql: migration0003,
  },
  {
    version: 4,
    name: "local_authentication_foundation",
    sql: migration0004,
  },
  {
    version: 5,
    name: "enrollment_recovery_self_service",
    sql: migration0005,
  },
];

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
