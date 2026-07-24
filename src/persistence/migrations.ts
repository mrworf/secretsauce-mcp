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

const migration0006 = `
ALTER TABLE identity_invalidation_events RENAME TO identity_invalidation_events_v5;

CREATE TABLE identity_invalidation_events (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'password_reset', 'totp_reset', 'password_change', 'totp_change',
      'break_glass', 'enrollment', 'profile_email_change', 'suspension',
      'reactivation', 'deactivation', 'role_change', 'enrollment_restore'
    )
  ),
  browser_sessions_revoked INTEGER NOT NULL CHECK (browser_sessions_revoked >= 0),
  restricted_sessions_revoked INTEGER NOT NULL CHECK (restricted_sessions_revoked >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  dispatched_at INTEGER CHECK (dispatched_at IS NULL OR dispatched_at >= created_at),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
) STRICT;

INSERT INTO identity_invalidation_events (
  id, user_id, reason, browser_sessions_revoked, restricted_sessions_revoked,
  created_at, dispatched_at, attempts
)
SELECT
  id, user_id, reason, browser_sessions_revoked, restricted_sessions_revoked,
  created_at, dispatched_at, attempts
FROM identity_invalidation_events_v5;

DROP TABLE identity_invalidation_events_v5;

CREATE INDEX identity_invalidation_events_dispatch_idx
  ON identity_invalidation_events (dispatched_at, created_at, id);
CREATE INDEX identity_invalidation_events_user_idx
  ON identity_invalidation_events (user_id, created_at, id);
`;

const migration0007 = `
ALTER TABLE users ADD COLUMN email_source TEXT NOT NULL DEFAULT 'local'
  CHECK (length(email_source) BETWEEN 1 AND 69);
ALTER TABLE users ADD COLUMN given_name_source TEXT NOT NULL DEFAULT 'local'
  CHECK (length(given_name_source) BETWEEN 1 AND 69);
ALTER TABLE users ADD COLUMN family_name_source TEXT NOT NULL DEFAULT 'local'
  CHECK (length(family_name_source) BETWEEN 1 AND 69);

ALTER TABLE external_identities ADD COLUMN last_authenticated_at INTEGER
  CHECK (last_authenticated_at IS NULL OR last_authenticated_at >= 0);
ALTER TABLE external_identities ADD COLUMN last_claim_update_at INTEGER
  CHECK (last_claim_update_at IS NULL OR last_claim_update_at >= 0);

CREATE TABLE identity_oidc_flows (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  provider_id TEXT NOT NULL CHECK (
    length(provider_id) BETWEEN 1 AND 64
    AND provider_id = lower(provider_id)
    AND provider_id NOT GLOB '*[^a-z0-9_.-]*'
  ),
  purpose TEXT NOT NULL CHECK (
    purpose IN ('login', 'restricted_link', 'superadmin_link')
  ),
  state_hash TEXT NOT NULL UNIQUE CHECK (
    length(state_hash) = 64
    AND state_hash = lower(state_hash)
    AND state_hash NOT GLOB '*[^0-9a-f]*'
  ),
  envelope_json TEXT NOT NULL CHECK (
    length(envelope_json) BETWEEN 1 AND 8192
    AND json_valid(envelope_json)
  ),
  target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  actor_session_id TEXT CHECK (
    actor_session_id IS NULL OR length(actor_session_id) = 36
  ),
  target_version INTEGER CHECK (
    target_version IS NULL OR target_version > 0
  ),
  redirect_uri TEXT NOT NULL CHECK (
    length(redirect_uri) BETWEEN 8 AND 2048
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  claimed_at INTEGER CHECK (
    claimed_at IS NULL OR claimed_at >= created_at
  ),
  consumed_at INTEGER CHECK (
    consumed_at IS NULL OR (
      claimed_at IS NOT NULL AND consumed_at >= claimed_at
    )
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
) STRICT;

CREATE INDEX identity_oidc_flows_expiry_idx
  ON identity_oidc_flows (expires_at, state_hash);
CREATE INDEX identity_oidc_flows_target_idx
  ON identity_oidc_flows (target_user_id, provider_id, created_at);

ALTER TABLE identity_invalidation_events RENAME TO identity_invalidation_events_v6;

CREATE TABLE identity_invalidation_events (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'password_reset', 'totp_reset', 'password_change', 'totp_change',
      'break_glass', 'enrollment', 'profile_email_change', 'suspension',
      'reactivation', 'deactivation', 'role_change', 'enrollment_restore',
      'provider_link_change'
    )
  ),
  browser_sessions_revoked INTEGER NOT NULL CHECK (browser_sessions_revoked >= 0),
  restricted_sessions_revoked INTEGER NOT NULL CHECK (restricted_sessions_revoked >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  dispatched_at INTEGER CHECK (dispatched_at IS NULL OR dispatched_at >= created_at),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
) STRICT;

INSERT INTO identity_invalidation_events (
  id, user_id, reason, browser_sessions_revoked, restricted_sessions_revoked,
  created_at, dispatched_at, attempts
)
SELECT
  id, user_id, reason, browser_sessions_revoked, restricted_sessions_revoked,
  created_at, dispatched_at, attempts
FROM identity_invalidation_events_v6;

DROP TABLE identity_invalidation_events_v6;

CREATE INDEX identity_invalidation_events_dispatch_idx
  ON identity_invalidation_events (dispatched_at, created_at, id);
CREATE INDEX identity_invalidation_events_user_idx
  ON identity_invalidation_events (user_id, created_at, id);
`;

const migration0008 = `
CREATE TABLE services (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 1 AND 64
    AND slug = lower(slug)
    AND substr(slug, 1, 1) GLOB '[a-z]'
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description TEXT CHECK (
    description IS NULL OR length(description) BETWEEN 1 AND 1024
  ),
  documentation_url TEXT CHECK (
    documentation_url IS NULL OR length(documentation_url) BETWEEN 8 AND 2048
  ),
  lifecycle TEXT NOT NULL DEFAULT 'draft'
    CHECK (lifecycle IN ('draft', 'published', 'archived')),
  draft_digest TEXT NOT NULL CHECK (
    length(draft_digest) = 64
    AND draft_digest = lower(draft_digest)
    AND draft_digest NOT GLOB '*[^0-9a-f]*'
  ),
  published_revision_id TEXT,
  published_digest TEXT CHECK (
    published_digest IS NULL OR (
      length(published_digest) = 64
      AND published_digest = lower(published_digest)
      AND published_digest NOT GLOB '*[^0-9a-f]*'
    )
  ),
  publication_generation INTEGER NOT NULL DEFAULT 0
    CHECK (publication_generation >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE INDEX services_lifecycle_slug_idx ON services (lifecycle, slug, id);

CREATE TABLE service_destinations (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  slug TEXT NOT NULL CHECK (
    length(slug) BETWEEN 1 AND 64
    AND slug = lower(slug)
    AND substr(slug, 1, 1) GLOB '[a-z]'
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  base_url TEXT NOT NULL CHECK (length(base_url) BETWEEN 8 AND 2048),
  schemes_json TEXT NOT NULL CHECK (
    length(schemes_json) BETWEEN 2 AND 128 AND json_valid(schemes_json)
  ),
  hosts_json TEXT NOT NULL CHECK (
    length(hosts_json) BETWEEN 2 AND 16384 AND json_valid(hosts_json)
  ),
  ports_json TEXT NOT NULL CHECK (
    length(ports_json) BETWEEN 2 AND 512 AND json_valid(ports_json)
  ),
  tls_verify INTEGER NOT NULL CHECK (tls_verify IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (service_id, slug)
) STRICT;

CREATE INDEX service_destinations_service_idx
  ON service_destinations (service_id, slug, id);

CREATE TABLE service_admins (
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  PRIMARY KEY (service_id, user_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX service_admins_service_idx
  ON service_admins (service_id, user_id);
CREATE INDEX service_admins_user_idx
  ON service_admins (user_id, service_id);

CREATE TABLE service_config_versions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  document_json TEXT NOT NULL CHECK (
    length(document_json) BETWEEN 2 AND 1048576 AND json_valid(document_json)
  ),
  digest TEXT NOT NULL CHECK (
    length(digest) = 64 AND digest = lower(digest)
    AND digest NOT GLOB '*[^0-9a-f]*'
  ),
  source_revision_id TEXT,
  publication_generation INTEGER NOT NULL CHECK (publication_generation > 0),
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'superadmin')),
  published_at INTEGER NOT NULL CHECK (published_at >= 0),
  UNIQUE (service_id, sequence)
) STRICT;

CREATE INDEX service_config_versions_service_idx
  ON service_config_versions (service_id, sequence DESC, id);
CREATE INDEX service_config_versions_retention_idx
  ON service_config_versions (service_id, published_at, id);

CREATE TABLE service_invalidation_events (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL CHECK (length(service_id) = 36),
  publication_generation INTEGER NOT NULL CHECK (publication_generation > 0),
  reason TEXT NOT NULL CHECK (
    reason IN ('publication', 'rollback', 'archive', 'delete')
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  dispatched_at INTEGER CHECK (dispatched_at IS NULL OR dispatched_at >= created_at),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
) STRICT;

CREATE INDEX service_invalidation_events_dispatch_idx
  ON service_invalidation_events (dispatched_at, created_at, id);
CREATE INDEX service_invalidation_events_service_idx
  ON service_invalidation_events (service_id, created_at, id);
`;

const migration0009 = `
CREATE TABLE service_groups (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  normalized_name TEXT NOT NULL CHECK (
    length(normalized_name) BETWEEN 1 AND 120
    AND normalized_name = lower(normalized_name)
  ),
  description TEXT CHECK (
    description IS NULL OR length(description) BETWEEN 1 AND 1024
  ),
  lifecycle TEXT NOT NULL DEFAULT 'active'
    CHECK (lifecycle IN ('active', 'archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (service_id, normalized_name),
  UNIQUE (service_id, id)
) STRICT;

CREATE INDEX service_groups_service_idx
  ON service_groups (service_id, lifecycle, normalized_name, id);

CREATE TABLE service_group_members (
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (service_id, group_id)
    REFERENCES service_groups(service_id, id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE INDEX service_group_members_service_idx
  ON service_group_members (service_id, group_id, user_id);
CREATE INDEX service_group_members_user_idx
  ON service_group_members (user_id, service_id, group_id);

CREATE TABLE service_principal_assignments (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  selector_kind TEXT NOT NULL CHECK (selector_kind IN ('all', 'group', 'user')),
  group_id TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (
    (selector_kind = 'all' AND group_id IS NULL AND user_id IS NULL)
    OR (selector_kind = 'group' AND group_id IS NOT NULL AND user_id IS NULL)
    OR (selector_kind = 'user' AND group_id IS NULL AND user_id IS NOT NULL)
  ),
  FOREIGN KEY (service_id, group_id)
    REFERENCES service_groups(service_id, id) ON DELETE CASCADE
) STRICT;

CREATE UNIQUE INDEX service_principal_assignment_all_idx
  ON service_principal_assignments (service_id)
  WHERE selector_kind = 'all';
CREATE UNIQUE INDEX service_principal_assignment_group_idx
  ON service_principal_assignments (service_id, group_id)
  WHERE selector_kind = 'group';
CREATE UNIQUE INDEX service_principal_assignment_user_idx
  ON service_principal_assignments (service_id, user_id)
  WHERE selector_kind = 'user';
CREATE INDEX service_principal_assignments_service_idx
  ON service_principal_assignments (service_id, selector_kind, id);
CREATE INDEX service_principal_assignments_user_idx
  ON service_principal_assignments (user_id, service_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE service_assignment_states (
  service_id TEXT PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  authorization_generation INTEGER NOT NULL DEFAULT 0
    CHECK (authorization_generation >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

INSERT INTO service_assignment_states (
  service_id, version, authorization_generation, created_at, updated_at
)
SELECT id, 1, 0, created_at, updated_at FROM services;

CREATE TABLE assignment_invalidation_events (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  affected_user_id TEXT CHECK (
    affected_user_id IS NULL OR (
      length(affected_user_id) = 36
      AND affected_user_id = lower(affected_user_id)
    )
  ),
  authorization_generation INTEGER NOT NULL
    CHECK (authorization_generation > 0),
  reason TEXT NOT NULL CHECK (
    reason IN ('service_selector', 'group_membership', 'group_archive', 'group_delete')
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  dispatched_at INTEGER CHECK (dispatched_at IS NULL OR dispatched_at >= created_at),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
) STRICT;

CREATE INDEX assignment_invalidation_events_dispatch_idx
  ON assignment_invalidation_events (dispatched_at, created_at, id);
CREATE INDEX assignment_invalidation_events_service_idx
  ON assignment_invalidation_events (
    service_id, authorization_generation, affected_user_id, id
  );
`;

const migration0010 = `
CREATE TABLE service_credentials (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  normalized_name TEXT NOT NULL CHECK (
    length(normalized_name) BETWEEN 1 AND 120
    AND normalized_name = lower(normalized_name)
  ),
  description TEXT CHECK (
    description IS NULL OR length(description) BETWEEN 1 AND 1024
  ),
  usage_kind TEXT NOT NULL CHECK (usage_kind IN ('header', 'query', 'body')),
  usage_name TEXT NOT NULL CHECK (length(usage_name) BETWEEN 1 AND 256),
  usage_prefix TEXT CHECK (
    usage_prefix IS NULL OR length(usage_prefix) BETWEEN 1 AND 512
  ),
  usage_suffix TEXT CHECK (
    usage_suffix IS NULL OR length(usage_suffix) BETWEEN 1 AND 512
  ),
  enforce_header_ownership INTEGER NOT NULL DEFAULT 0
    CHECK (enforce_header_ownership IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'unconfigured'
    CHECK (status IN ('configured', 'unconfigured', 'disabled', 'archived')),
  vault_state TEXT NOT NULL DEFAULT 'idle'
    CHECK (
      vault_state IN (
        'idle', 'pending_create', 'pending_replace', 'pending_delete',
        'pending_archive', 'reconcile'
      )
    ),
  vault_locator TEXT CHECK (
    vault_locator IS NULL OR (
      length(vault_locator) = 36
      AND vault_locator = lower(vault_locator)
      AND substr(vault_locator, 15, 1) = '4'
      AND substr(vault_locator, 20, 1) IN ('8', '9', 'a', 'b')
      AND vault_locator NOT GLOB '*[^0-9a-f-]*'
    )
  ),
  vault_generation INTEGER CHECK (
    vault_generation IS NULL OR vault_generation > 0
  ),
  last_four TEXT CHECK (
    last_four IS NULL OR (
      length(last_four) BETWEEN 1 AND 4
      AND last_four NOT GLOB '*[^ -~]*'
    )
  ),
  value_updated_at INTEGER CHECK (
    value_updated_at IS NULL OR value_updated_at >= 0
  ),
  authorization_generation INTEGER NOT NULL DEFAULT 0
    CHECK (authorization_generation >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (service_id, normalized_name),
  UNIQUE (service_id, id),
  CHECK (
    (vault_locator IS NULL AND vault_generation IS NULL)
    OR (vault_locator IS NOT NULL AND vault_generation IS NOT NULL)
  ),
  CHECK (
    vault_state <> 'idle'
    OR (
      status IN ('unconfigured', 'archived')
      AND vault_locator IS NULL
      AND vault_generation IS NULL
      AND last_four IS NULL
      AND value_updated_at IS NULL
    )
    OR (
      status IN ('configured', 'disabled')
      AND vault_locator IS NOT NULL
      AND vault_generation IS NOT NULL
      AND value_updated_at IS NOT NULL
    )
  )
) STRICT;

CREATE INDEX service_credentials_service_idx
  ON service_credentials (service_id, status, normalized_name, id);
CREATE INDEX service_credentials_vault_state_idx
  ON service_credentials (vault_state, updated_at, id)
  WHERE vault_state <> 'idle';

CREATE TABLE credential_principal_assignments (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  selector_kind TEXT NOT NULL CHECK (selector_kind IN ('all', 'group', 'user')),
  group_id TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (
    (selector_kind = 'all' AND group_id IS NULL AND user_id IS NULL)
    OR (selector_kind = 'group' AND group_id IS NOT NULL AND user_id IS NULL)
    OR (selector_kind = 'user' AND group_id IS NULL AND user_id IS NOT NULL)
  ),
  FOREIGN KEY (service_id, credential_id)
    REFERENCES service_credentials(service_id, id) ON DELETE CASCADE,
  FOREIGN KEY (service_id, group_id)
    REFERENCES service_groups(service_id, id) ON DELETE CASCADE
) STRICT;

CREATE UNIQUE INDEX credential_principal_assignment_all_idx
  ON credential_principal_assignments (credential_id)
  WHERE selector_kind = 'all';
CREATE UNIQUE INDEX credential_principal_assignment_group_idx
  ON credential_principal_assignments (credential_id, group_id)
  WHERE selector_kind = 'group';
CREATE UNIQUE INDEX credential_principal_assignment_user_idx
  ON credential_principal_assignments (credential_id, user_id)
  WHERE selector_kind = 'user';
CREATE INDEX credential_principal_assignments_service_idx
  ON credential_principal_assignments (
    service_id, credential_id, selector_kind, id
  );
CREATE INDEX credential_principal_assignments_user_idx
  ON credential_principal_assignments (user_id, service_id, credential_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE credential_invalidation_events (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  affected_user_id TEXT CHECK (
    affected_user_id IS NULL OR (
      length(affected_user_id) = 36
      AND affected_user_id = lower(affected_user_id)
    )
  ),
  authorization_generation INTEGER NOT NULL
    CHECK (authorization_generation > 0),
  reason TEXT NOT NULL CHECK (
    reason IN (
      'selector', 'disable', 'enable', 'value_replace', 'value_delete',
      'archive', 'delete'
    )
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  dispatched_at INTEGER CHECK (dispatched_at IS NULL OR dispatched_at >= created_at),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  CHECK (
    length(credential_id) = 36
    AND credential_id = lower(credential_id)
  )
) STRICT;

CREATE INDEX credential_invalidation_events_dispatch_idx
  ON credential_invalidation_events (dispatched_at, created_at, id);
CREATE INDEX credential_invalidation_events_service_idx
  ON credential_invalidation_events (
    service_id, credential_id, authorization_generation, affected_user_id, id
  );

CREATE TABLE credential_vault_operations (
  credential_id TEXT PRIMARY KEY REFERENCES service_credentials(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (
    operation IN ('create', 'replace', 'delete_value', 'archive')
  ),
  locator TEXT NOT NULL CHECK (
    length(locator) = 36 AND locator = lower(locator)
    AND substr(locator, 15, 1) = '4'
    AND substr(locator, 20, 1) IN ('8', '9', 'a', 'b')
    AND locator NOT GLOB '*[^0-9a-f-]*'
  ),
  expected_generation INTEGER CHECK (
    expected_generation IS NULL OR expected_generation > 0
  ),
  target_generation INTEGER CHECK (
    target_generation IS NULL OR target_generation > 0
  ),
  prior_status TEXT NOT NULL CHECK (
    prior_status IN ('configured', 'unconfigured', 'disabled')
  ),
  phase TEXT NOT NULL CHECK (
    phase IN ('prepared', 'vault_applied', 'reconcile')
  ),
  result_category TEXT CHECK (
    result_category IS NULL OR length(result_category) BETWEEN 1 AND 64
  ),
  started_at INTEGER NOT NULL CHECK (started_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= started_at),
  FOREIGN KEY (service_id, credential_id)
    REFERENCES service_credentials(service_id, id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE INDEX credential_vault_operations_phase_idx
  ON credential_vault_operations (phase, updated_at, credential_id);
`;

const migration0011 = `
CREATE TABLE policies (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  credential_id TEXT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  normalized_name TEXT NOT NULL CHECK (
    length(normalized_name) BETWEEN 1 AND 120
    AND normalized_name = lower(normalized_name)
  ),
  description TEXT CHECK (
    description IS NULL OR length(description) BETWEEN 1 AND 1024
  ),
  operating_mode TEXT NOT NULL DEFAULT 'deny'
    CHECK (operating_mode IN ('allow', 'deny')),
  lifecycle TEXT NOT NULL DEFAULT 'active'
    CHECK (lifecycle IN ('active', 'archived')),
  evaluation_generation INTEGER NOT NULL DEFAULT 0
    CHECK (evaluation_generation >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (service_id, id),
  UNIQUE (service_id, credential_id, normalized_name),
  FOREIGN KEY (service_id, credential_id)
    REFERENCES service_credentials(service_id, id) ON DELETE CASCADE
) STRICT;

CREATE UNIQUE INDEX policies_active_service_boundary_idx
  ON policies (service_id)
  WHERE credential_id IS NULL AND lifecycle = 'active';
CREATE UNIQUE INDEX policies_active_credential_boundary_idx
  ON policies (credential_id)
  WHERE credential_id IS NOT NULL AND lifecycle = 'active';
CREATE INDEX policies_service_idx
  ON policies (service_id, lifecycle, credential_id, normalized_name, id);

CREATE TABLE policy_rules (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  policy_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  normalized_name TEXT NOT NULL CHECK (
    length(normalized_name) BETWEEN 1 AND 120
    AND normalized_name = lower(normalized_name)
  ),
  reason TEXT CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 1024),
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  priority INTEGER NOT NULL CHECK (
    priority BETWEEN -1000000000 AND 1000000000
  ),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  methods_json TEXT NOT NULL CHECK (
    length(methods_json) BETWEEN 2 AND 4096 AND json_valid(methods_json)
  ),
  hosts_json TEXT NOT NULL CHECK (
    length(hosts_json) BETWEEN 2 AND 32768 AND json_valid(hosts_json)
  ),
  paths_json TEXT NOT NULL CHECK (
    length(paths_json) BETWEEN 2 AND 65536 AND json_valid(paths_json)
  ),
  response_safeguards_json TEXT NOT NULL CHECK (
    length(response_safeguards_json) BETWEEN 2 AND 4096
    AND json_valid(response_safeguards_json)
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (service_id, policy_id, normalized_name),
  UNIQUE (service_id, policy_id, id),
  FOREIGN KEY (service_id, policy_id)
    REFERENCES policies(service_id, id) ON DELETE CASCADE
) STRICT;

CREATE INDEX policy_rules_evaluation_idx
  ON policy_rules (
    service_id, policy_id, enabled, priority DESC, effect DESC, id
  );

CREATE TABLE policy_rule_principal_assignments (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  policy_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  selector_kind TEXT NOT NULL CHECK (
    selector_kind IN ('all', 'group', 'user')
  ),
  group_id TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (
    (selector_kind = 'all' AND group_id IS NULL AND user_id IS NULL)
    OR (selector_kind = 'group' AND group_id IS NOT NULL AND user_id IS NULL)
    OR (selector_kind = 'user' AND group_id IS NULL AND user_id IS NOT NULL)
  ),
  FOREIGN KEY (service_id, policy_id, rule_id)
    REFERENCES policy_rules(service_id, policy_id, id) ON DELETE CASCADE,
  FOREIGN KEY (service_id, group_id)
    REFERENCES service_groups(service_id, id) ON DELETE CASCADE
) STRICT;

CREATE UNIQUE INDEX policy_rule_assignment_all_idx
  ON policy_rule_principal_assignments (rule_id)
  WHERE selector_kind = 'all';
CREATE UNIQUE INDEX policy_rule_assignment_group_idx
  ON policy_rule_principal_assignments (rule_id, group_id)
  WHERE selector_kind = 'group';
CREATE UNIQUE INDEX policy_rule_assignment_user_idx
  ON policy_rule_principal_assignments (rule_id, user_id)
  WHERE selector_kind = 'user';
CREATE INDEX policy_rule_assignments_service_idx
  ON policy_rule_principal_assignments (
    service_id, policy_id, rule_id, selector_kind, id
  );
CREATE INDEX policy_rule_assignments_user_idx
  ON policy_rule_principal_assignments (user_id, service_id, policy_id, rule_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE policy_invalidation_events (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  policy_id TEXT NOT NULL,
  rule_id TEXT,
  affected_user_id TEXT,
  evaluation_generation INTEGER NOT NULL
    CHECK (evaluation_generation > 0),
  reason TEXT NOT NULL CHECK (
    reason IN (
      'policy', 'rule', 'selector', 'archive', 'delete', 'copy'
    )
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  dispatched_at INTEGER CHECK (
    dispatched_at IS NULL OR dispatched_at >= created_at
  ),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  FOREIGN KEY (service_id, policy_id)
    REFERENCES policies(service_id, id) ON DELETE CASCADE,
  CHECK (
    length(rule_id) IS NULL OR (
      length(rule_id) = 36 AND rule_id = lower(rule_id)
    )
  ),
  CHECK (
    affected_user_id IS NULL OR (
      length(affected_user_id) = 36 AND affected_user_id = lower(affected_user_id)
    )
  )
) STRICT;

CREATE INDEX policy_invalidation_events_dispatch_idx
  ON policy_invalidation_events (dispatched_at, created_at, id);
CREATE INDEX policy_invalidation_events_service_idx
  ON policy_invalidation_events (
    service_id, policy_id, evaluation_generation, affected_user_id, id
  );
`;

const migration0012 = `
CREATE TABLE policy_copy_batch_members (
  batch_id TEXT NOT NULL CHECK (
    length(batch_id) = 36 AND batch_id = lower(batch_id)
    AND substr(batch_id, 15, 1) = '7'
    AND substr(batch_id, 20, 1) IN ('8', '9', 'a', 'b')
    AND batch_id NOT GLOB '*[^0-9a-f-]*'
  ),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0 AND ordinal < 20),
  service_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  PRIMARY KEY (batch_id, ordinal),
  UNIQUE (batch_id, policy_id),
  FOREIGN KEY (service_id, policy_id)
    REFERENCES policies(service_id, id) ON DELETE CASCADE
) STRICT;

CREATE INDEX policy_copy_batch_members_policy_idx
  ON policy_copy_batch_members (service_id, policy_id, batch_id);
`;

const migration0013 = `
CREATE TABLE runtime_activation (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  state TEXT NOT NULL CHECK (state IN ('inactive', 'active')),
  activation_generation INTEGER NOT NULL CHECK (activation_generation >= 0),
  global_reference_epoch INTEGER NOT NULL CHECK (global_reference_epoch >= 0),
  version INTEGER NOT NULL CHECK (version > 0),
  activated_at INTEGER CHECK (activated_at IS NULL OR activated_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  CHECK (
    (state = 'inactive' AND activated_at IS NULL)
    OR (state = 'active' AND activated_at IS NOT NULL)
  )
) STRICT;

INSERT INTO runtime_activation (
  singleton, state, activation_generation, global_reference_epoch,
  version, activated_at, updated_at
) VALUES (1, 'inactive', 0, 0, 1, NULL, 0);

CREATE TABLE runtime_service_snapshots (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  publication_generation INTEGER NOT NULL CHECK (publication_generation > 0),
  document_json TEXT NOT NULL CHECK (
    length(document_json) BETWEEN 2 AND 4194304
  ),
  digest TEXT NOT NULL CHECK (
    length(digest) = 64
    AND digest = lower(digest)
    AND digest NOT GLOB '*[^0-9a-f]*'
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  UNIQUE (service_id, id)
) STRICT;

CREATE INDEX runtime_service_snapshots_history_idx
  ON runtime_service_snapshots (
    service_id, publication_generation DESC, created_at DESC, id
  );

CREATE TABLE runtime_active_services (
  service_id TEXT PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL UNIQUE,
  publication_generation INTEGER NOT NULL CHECK (publication_generation > 0),
  activated_at INTEGER NOT NULL CHECK (activated_at >= 0),
  FOREIGN KEY (service_id, snapshot_id)
    REFERENCES runtime_service_snapshots(service_id, id) ON DELETE CASCADE
) STRICT;

CREATE TABLE runtime_invalidation_checkpoints (
  stream_name TEXT PRIMARY KEY CHECK (
    stream_name IN ('identity', 'service', 'credential', 'policy')
  ),
  last_created_at INTEGER NOT NULL CHECK (last_created_at >= 0),
  last_event_id TEXT CHECK (
    last_event_id IS NULL OR (
      length(last_event_id) = 36 AND last_event_id = lower(last_event_id)
    )
  ),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
) STRICT;

INSERT INTO runtime_invalidation_checkpoints (
  stream_name, last_created_at, last_event_id, updated_at
) VALUES
  ('identity', 0, NULL, 0),
  ('service', 0, NULL, 0),
  ('credential', 0, NULL, 0),
  ('policy', 0, NULL, 0);
`;

const migration0014 = `
ALTER TABLE accepted_totp_steps RENAME TO accepted_totp_steps_pre_oauth;

CREATE TABLE accepted_totp_steps (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_step INTEGER NOT NULL CHECK (time_step >= 0),
  purpose TEXT NOT NULL CHECK (
    purpose IN ('confirmation', 'login', 'step_up', 'oauth')
  ),
  accepted_at INTEGER NOT NULL CHECK (accepted_at >= 0),
  PRIMARY KEY (user_id, time_step)
) STRICT, WITHOUT ROWID;

INSERT INTO accepted_totp_steps (user_id, time_step, purpose, accepted_at)
SELECT user_id, time_step, purpose, accepted_at
FROM accepted_totp_steps_pre_oauth;

DROP TABLE accepted_totp_steps_pre_oauth;

CREATE INDEX accepted_totp_steps_time_idx
  ON accepted_totp_steps (accepted_at, user_id, time_step);

ALTER TABLE identity_oidc_flows RENAME TO identity_oidc_flows_pre_mcp_oauth;

CREATE TABLE identity_oidc_flows (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  provider_id TEXT NOT NULL CHECK (
    length(provider_id) BETWEEN 1 AND 64
    AND provider_id = lower(provider_id)
    AND provider_id NOT GLOB '*[^a-z0-9_.-]*'
  ),
  purpose TEXT NOT NULL CHECK (
    purpose IN ('login', 'restricted_link', 'superadmin_link', 'mcp_oauth')
  ),
  state_hash TEXT NOT NULL UNIQUE CHECK (
    length(state_hash) = 64 AND state_hash = lower(state_hash)
    AND state_hash NOT GLOB '*[^0-9a-f]*'
  ),
  envelope_json TEXT NOT NULL CHECK (
    length(envelope_json) BETWEEN 1 AND 8192 AND json_valid(envelope_json)
  ),
  target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  actor_session_id TEXT CHECK (
    actor_session_id IS NULL OR length(actor_session_id) = 36
  ),
  target_version INTEGER CHECK (
    target_version IS NULL OR target_version > 0
  ),
  oauth_intent_id TEXT CHECK (
    oauth_intent_id IS NULL OR (
      length(oauth_intent_id) = 36 AND oauth_intent_id = lower(oauth_intent_id)
    )
  ),
  redirect_uri TEXT NOT NULL CHECK (length(redirect_uri) BETWEEN 8 AND 2048),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  claimed_at INTEGER CHECK (claimed_at IS NULL OR claimed_at >= created_at),
  consumed_at INTEGER CHECK (
    consumed_at IS NULL OR (
      claimed_at IS NOT NULL AND consumed_at >= claimed_at
    )
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (
    (purpose = 'mcp_oauth' AND oauth_intent_id IS NOT NULL)
    OR (purpose <> 'mcp_oauth' AND oauth_intent_id IS NULL)
  )
) STRICT;

INSERT INTO identity_oidc_flows (
  id, provider_id, purpose, state_hash, envelope_json,
  target_user_id, actor_user_id, actor_session_id, target_version,
  oauth_intent_id, redirect_uri, created_at, expires_at,
  claimed_at, consumed_at, version
)
SELECT
  id, provider_id, purpose, state_hash, envelope_json,
  target_user_id, actor_user_id, actor_session_id, target_version,
  NULL, redirect_uri, created_at, expires_at, claimed_at, consumed_at, version
FROM identity_oidc_flows_pre_mcp_oauth;

DROP TABLE identity_oidc_flows_pre_mcp_oauth;

CREATE INDEX identity_oidc_flows_expiry_idx
  ON identity_oidc_flows (expires_at, state_hash);
CREATE INDEX identity_oidc_flows_target_idx
  ON identity_oidc_flows (target_user_id, provider_id, created_at);
CREATE INDEX identity_oidc_flows_oauth_intent_idx
  ON identity_oidc_flows (oauth_intent_id, consumed_at, expires_at);

CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  client_identifier TEXT NOT NULL UNIQUE CHECK (
    length(client_identifier) BETWEEN 1 AND 2048
  ),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 256),
  metadata_json TEXT NOT NULL CHECK (length(metadata_json) BETWEEN 2 AND 16384),
  metadata_digest TEXT NOT NULL CHECK (
    length(metadata_digest) = 64
    AND metadata_digest = lower(metadata_digest)
    AND metadata_digest NOT GLOB '*[^0-9a-f]*'
  ),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived')),
  first_seen_at INTEGER NOT NULL CHECK (first_seen_at >= 0),
  last_seen_at INTEGER NOT NULL CHECK (last_seen_at >= first_seen_at),
  version INTEGER NOT NULL CHECK (version > 0)
) STRICT;

CREATE INDEX oauth_clients_lifecycle_idx
  ON oauth_clients (lifecycle, last_seen_at DESC, id);

CREATE TABLE oauth_grants (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id),
  resource TEXT NOT NULL CHECK (length(resource) BETWEEN 1 AND 2048),
  scopes_json TEXT NOT NULL CHECK (length(scopes_json) BETWEEN 2 AND 4096),
  authentication_method TEXT NOT NULL CHECK (
    authentication_method IN ('local_password_totp', 'oidc')
  ),
  issued_security_epoch INTEGER NOT NULL CHECK (issued_security_epoch >= 0),
  issued_global_epoch INTEGER NOT NULL CHECK (issued_global_epoch >= 0),
  issued_access_ttl_ms INTEGER NOT NULL CHECK (
    issued_access_ttl_ms BETWEEN 60000 AND 900000
  ),
  issued_refresh_idle_ms INTEGER NOT NULL CHECK (
    issued_refresh_idle_ms BETWEEN 86400000 AND 7776000000
  ),
  issued_refresh_absolute_ms INTEGER NOT NULL CHECK (
    issued_refresh_absolute_ms BETWEEN 604800000 AND 31536000000
    AND issued_refresh_absolute_ms >= issued_refresh_idle_ms
  ),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  last_used_at INTEGER NOT NULL CHECK (last_used_at >= issued_at),
  absolute_expires_at INTEGER NOT NULL CHECK (absolute_expires_at > issued_at),
  idle_expires_at INTEGER NOT NULL CHECK (
    idle_expires_at > issued_at AND idle_expires_at <= absolute_expires_at
  ),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= issued_at),
  revocation_reason TEXT CHECK (
    revocation_reason IS NULL OR revocation_reason IN (
      'user_security', 'global_security', 'role_status', 'manual',
      'refresh_replay', 'expired'
    )
  ),
  version INTEGER NOT NULL CHECK (version > 0),
  CHECK (
    (status = 'active' AND revoked_at IS NULL AND revocation_reason IS NULL)
    OR (status <> 'active' AND revoked_at IS NOT NULL
      AND revocation_reason IS NOT NULL)
  )
) STRICT;

CREATE INDEX oauth_grants_user_status_idx
  ON oauth_grants (user_id, status, absolute_expires_at, id);
CREATE INDEX oauth_grants_client_status_idx
  ON oauth_grants (client_id, status, absolute_expires_at, id);

CREATE TABLE oauth_authorization_intents (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  handle_hash TEXT NOT NULL UNIQUE CHECK (
    length(handle_hash) = 64
    AND handle_hash = lower(handle_hash)
    AND handle_hash NOT GLOB '*[^0-9a-f]*'
  ),
  client_id TEXT NOT NULL REFERENCES oauth_clients(id),
  redirect_uri TEXT NOT NULL CHECK (length(redirect_uri) BETWEEN 1 AND 2048),
  resource TEXT NOT NULL CHECK (length(resource) BETWEEN 1 AND 2048),
  scopes_json TEXT NOT NULL CHECK (length(scopes_json) BETWEEN 2 AND 4096),
  code_challenge TEXT NOT NULL CHECK (
    length(code_challenge) = 43
    AND code_challenge NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  state_envelope_json TEXT CHECK (
    state_envelope_json IS NULL
    OR length(state_envelope_json) BETWEEN 2 AND 8192
  ),
  provider_id TEXT CHECK (
    provider_id IS NULL OR length(provider_id) BETWEEN 1 AND 64
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= created_at)
) STRICT;

CREATE INDEX oauth_authorization_intents_expiry_idx
  ON oauth_authorization_intents (consumed_at, expires_at, id);

CREATE TABLE oauth_authorization_codes (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  code_hash TEXT NOT NULL UNIQUE CHECK (
    length(code_hash) = 64
    AND code_hash = lower(code_hash)
    AND code_hash NOT GLOB '*[^0-9a-f]*'
  ),
  grant_id TEXT NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id),
  redirect_uri TEXT NOT NULL CHECK (length(redirect_uri) BETWEEN 1 AND 2048),
  resource TEXT NOT NULL CHECK (length(resource) BETWEEN 1 AND 2048),
  scopes_json TEXT NOT NULL CHECK (length(scopes_json) BETWEEN 2 AND 4096),
  code_challenge TEXT NOT NULL CHECK (
    length(code_challenge) = 43
    AND code_challenge NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  issued_security_epoch INTEGER NOT NULL CHECK (issued_security_epoch >= 0),
  issued_global_epoch INTEGER NOT NULL CHECK (issued_global_epoch >= 0),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  consumed_at INTEGER CHECK (consumed_at IS NULL OR consumed_at >= issued_at)
) STRICT;

CREATE INDEX oauth_authorization_codes_expiry_idx
  ON oauth_authorization_codes (consumed_at, expires_at, id);

CREATE TABLE oauth_refresh_families (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  grant_id TEXT NOT NULL UNIQUE REFERENCES oauth_grants(id) ON DELETE CASCADE,
  current_sequence INTEGER NOT NULL CHECK (current_sequence >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  last_used_at INTEGER NOT NULL CHECK (last_used_at >= issued_at),
  absolute_expires_at INTEGER NOT NULL CHECK (absolute_expires_at > issued_at),
  idle_expires_at INTEGER NOT NULL CHECK (
    idle_expires_at > issued_at AND idle_expires_at <= absolute_expires_at
  ),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= issued_at),
  revocation_reason TEXT CHECK (
    revocation_reason IS NULL OR revocation_reason IN (
      'user_security', 'global_security', 'role_status', 'manual',
      'refresh_replay', 'expired'
    )
  ),
  version INTEGER NOT NULL CHECK (version > 0),
  CHECK (
    (status = 'active' AND revoked_at IS NULL AND revocation_reason IS NULL)
    OR (status <> 'active' AND revoked_at IS NOT NULL
      AND revocation_reason IS NOT NULL)
  )
) STRICT;

CREATE INDEX oauth_refresh_families_expiry_idx
  ON oauth_refresh_families (status, idle_expires_at, absolute_expires_at, id);

CREATE TABLE oauth_refresh_tokens (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64
    AND token_hash = lower(token_hash)
    AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  family_id TEXT NOT NULL REFERENCES oauth_refresh_families(id)
    ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'used', 'revoked')),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  used_at INTEGER CHECK (used_at IS NULL OR used_at >= issued_at),
  UNIQUE (family_id, sequence),
  CHECK (
    (status = 'active' AND used_at IS NULL)
    OR (status <> 'active' AND used_at IS NOT NULL)
  )
) STRICT;

CREATE UNIQUE INDEX oauth_refresh_tokens_one_active_idx
  ON oauth_refresh_tokens (family_id) WHERE status = 'active';

CREATE TABLE oauth_access_tokens (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64
    AND token_hash = lower(token_hash)
    AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  grant_id TEXT NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES oauth_refresh_families(id) ON DELETE CASCADE,
  scopes_json TEXT NOT NULL CHECK (length(scopes_json) BETWEEN 2 AND 4096),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  last_used_at INTEGER NOT NULL CHECK (last_used_at >= issued_at),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked'))
) STRICT;

CREATE INDEX oauth_access_tokens_grant_idx
  ON oauth_access_tokens (grant_id, status, expires_at, id);
CREATE INDEX oauth_access_tokens_expiry_idx
  ON oauth_access_tokens (status, expires_at, id);

CREATE TRIGGER oauth_user_security_revoke
AFTER UPDATE OF security_epoch, role, status ON users
WHEN OLD.security_epoch <> NEW.security_epoch
  OR OLD.role <> NEW.role
  OR OLD.status <> NEW.status
BEGIN
  UPDATE oauth_grants
  SET status = 'revoked',
      revoked_at = max(NEW.updated_at, issued_at),
      revocation_reason = CASE
        WHEN OLD.role <> NEW.role OR OLD.status <> NEW.status
          THEN 'role_status'
        ELSE 'user_security'
      END,
      version = version + 1
  WHERE user_id = NEW.id AND status = 'active';
  UPDATE oauth_refresh_families
  SET status = 'revoked',
      revoked_at = max(NEW.updated_at, issued_at),
      revocation_reason = CASE
        WHEN OLD.role <> NEW.role OR OLD.status <> NEW.status
          THEN 'role_status'
        ELSE 'user_security'
      END,
      version = version + 1
  WHERE grant_id IN (
    SELECT id FROM oauth_grants WHERE user_id = NEW.id
  ) AND status = 'active';
  UPDATE oauth_refresh_tokens
  SET status = 'revoked', used_at = max(NEW.updated_at, issued_at)
  WHERE family_id IN (
    SELECT families.id
    FROM oauth_refresh_families families
    JOIN oauth_grants grants ON grants.id = families.grant_id
    WHERE grants.user_id = NEW.id
  ) AND status = 'active';
  UPDATE oauth_access_tokens
  SET status = 'revoked'
  WHERE grant_id IN (
    SELECT id FROM oauth_grants WHERE user_id = NEW.id
  ) AND status = 'active';
END;

CREATE TRIGGER oauth_global_security_revoke
AFTER UPDATE OF global_security_epoch ON identity_security_state
WHEN OLD.global_security_epoch <> NEW.global_security_epoch
BEGIN
  UPDATE oauth_grants
  SET status = 'revoked',
      revoked_at = max(NEW.updated_at, issued_at),
      revocation_reason = 'global_security',
      version = version + 1
  WHERE status = 'active';
  UPDATE oauth_refresh_families
  SET status = 'revoked',
      revoked_at = max(NEW.updated_at, issued_at),
      revocation_reason = 'global_security',
      version = version + 1
  WHERE status = 'active';
  UPDATE oauth_refresh_tokens
  SET status = 'revoked', used_at = max(NEW.updated_at, issued_at)
  WHERE status = 'active';
  UPDATE oauth_access_tokens SET status = 'revoked' WHERE status = 'active';
END;
`;

const migration0015 = `
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  identifier TEXT NOT NULL UNIQUE CHECK (
    length(identifier) = 16
    AND identifier NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  verifier_hash TEXT NOT NULL CHECK (
    length(verifier_hash) BETWEEN 64 AND 512
    AND verifier_hash LIKE '$argon2id$%'
  ),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 512),
  last_four TEXT NOT NULL CHECK (
    length(last_four) = 4
    AND last_four NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  api_role TEXT NOT NULL CHECK (
    api_role IN ('service', 'all_services', 'system')
  ),
  service_id TEXT CHECK (
    service_id IS NULL OR (
      length(service_id) = 36
      AND service_id = lower(service_id)
      AND substr(service_id, 15, 1) = '7'
      AND substr(service_id, 20, 1) IN ('8', '9', 'a', 'b')
      AND service_id NOT GLOB '*[^0-9a-f-]*'
    )
  ),
  expiration_policy TEXT NOT NULL CHECK (
    expiration_policy IN ('forever', 'timestamp')
  ),
  expires_at INTEGER CHECK (expires_at IS NULL OR expires_at >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'revoked')),
  creator_id TEXT NOT NULL CHECK (
    length(creator_id) = 36
    AND creator_id = lower(creator_id)
    AND substr(creator_id, 15, 1) = '7'
    AND substr(creator_id, 20, 1) IN ('8', '9', 'a', 'b')
    AND creator_id NOT GLOB '*[^0-9a-f-]*'
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  last_used_at INTEGER CHECK (
    last_used_at IS NULL OR last_used_at >= created_at
  ),
  revoked_at INTEGER CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  ),
  CHECK (
    (api_role = 'service' AND service_id IS NOT NULL)
    OR (api_role IN ('all_services', 'system') AND service_id IS NULL)
  ),
  CHECK (
    (expiration_policy = 'forever' AND expires_at IS NULL)
    OR (expiration_policy = 'timestamp' AND expires_at IS NOT NULL)
  ),
  CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL)
    OR (status IN ('active', 'expired') AND revoked_at IS NULL)
  )
) STRICT;

CREATE INDEX api_keys_status_expiry_idx
  ON api_keys (status, expires_at, id);
CREATE INDEX api_keys_service_status_idx
  ON api_keys (service_id, status, id)
  WHERE service_id IS NOT NULL;
CREATE INDEX api_keys_creator_idx
  ON api_keys (creator_id, created_at, id);

CREATE TABLE api_key_activity (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  nickname_snapshot TEXT NOT NULL CHECK (
    length(nickname_snapshot) BETWEEN 1 AND 512
  ),
  last_four_snapshot TEXT NOT NULL CHECK (
    length(last_four_snapshot) = 4
    AND last_four_snapshot NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  api_role_snapshot TEXT NOT NULL CHECK (
    api_role_snapshot IN ('service', 'all_services', 'system')
  ),
  service_id_snapshot TEXT CHECK (
    service_id_snapshot IS NULL OR length(service_id_snapshot) = 36
  ),
  action TEXT NOT NULL CHECK (
    length(action) BETWEEN 1 AND 128
    AND action NOT GLOB '*[^a-z0-9_.-]*'
  ),
  outcome TEXT NOT NULL CHECK (
    outcome IN ('allow', 'deny', 'error')
  ),
  target_type TEXT NOT NULL CHECK (
    length(target_type) BETWEEN 1 AND 64
    AND target_type NOT GLOB '*[^a-z0-9_.-]*'
  ),
  target_id TEXT CHECK (
    target_id IS NULL OR length(target_id) BETWEEN 1 AND 128
  ),
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  source_digest TEXT CHECK (
    source_digest IS NULL OR (
      length(source_digest) = 64
      AND source_digest = lower(source_digest)
      AND source_digest NOT GLOB '*[^0-9a-f]*'
    )
  ),
  failure_code TEXT CHECK (
    failure_code IS NULL OR (
      length(failure_code) BETWEEN 1 AND 128
      AND failure_code NOT GLOB '*[^a-z0-9_.-]*'
    )
  ),
  occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0),
  CHECK (
    (outcome = 'allow' AND failure_code IS NULL)
    OR (outcome IN ('deny', 'error') AND failure_code IS NOT NULL)
  )
) STRICT;

CREATE INDEX api_key_activity_key_time_idx
  ON api_key_activity (api_key_id, occurred_at DESC, id DESC);
CREATE INDEX api_key_activity_time_idx
  ON api_key_activity (occurred_at, id);
`;

const migration0016 = `
ALTER TABLE service_config_versions RENAME TO service_config_versions_pre_api_keys;

CREATE TABLE service_config_versions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  document_json TEXT NOT NULL CHECK (
    length(document_json) BETWEEN 2 AND 1048576 AND json_valid(document_json)
  ),
  digest TEXT NOT NULL CHECK (
    length(digest) = 64 AND digest = lower(digest)
    AND digest NOT GLOB '*[^0-9a-f]*'
  ),
  source_revision_id TEXT,
  publication_generation INTEGER NOT NULL CHECK (publication_generation > 0),
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (
    actor_role IN ('admin', 'superadmin', 'service', 'all_services')
  ),
  published_at INTEGER NOT NULL CHECK (published_at >= 0),
  UNIQUE (service_id, sequence)
) STRICT;

INSERT INTO service_config_versions (
  id, service_id, sequence, document_json, digest, source_revision_id,
  publication_generation, actor_user_id, actor_role, published_at
)
SELECT
  id, service_id, sequence, document_json, digest, source_revision_id,
  publication_generation, actor_user_id, actor_role, published_at
FROM service_config_versions_pre_api_keys;

DROP TABLE service_config_versions_pre_api_keys;

CREATE INDEX service_config_versions_service_idx
  ON service_config_versions (service_id, sequence DESC, id);
CREATE INDEX service_config_versions_retention_idx
  ON service_config_versions (service_id, published_at, id);
`;

const migration0017 = `
ALTER TABLE credential_vault_operations
  ADD COLUMN approval_api_key_id TEXT
    REFERENCES api_keys(id) ON DELETE RESTRICT
    CHECK (
      approval_api_key_id IS NULL OR (
        length(approval_api_key_id) = 36
        AND approval_api_key_id = lower(approval_api_key_id)
        AND substr(approval_api_key_id, 15, 1) = '7'
        AND substr(approval_api_key_id, 20, 1) IN ('8', '9', 'a', 'b')
        AND approval_api_key_id NOT GLOB '*[^0-9a-f-]*'
      )
    );
ALTER TABLE credential_vault_operations
  ADD COLUMN approval_user_id TEXT
    REFERENCES users(id) ON DELETE RESTRICT
    CHECK (
      approval_user_id IS NULL OR (
        length(approval_user_id) = 36
        AND approval_user_id = lower(approval_user_id)
        AND substr(approval_user_id, 15, 1) = '7'
        AND substr(approval_user_id, 20, 1) IN ('8', '9', 'a', 'b')
        AND approval_user_id NOT GLOB '*[^0-9a-f-]*'
      )
    );
ALTER TABLE credential_vault_operations
  ADD COLUMN approval_nickname TEXT CHECK (
    approval_nickname IS NULL OR length(approval_nickname) BETWEEN 1 AND 512
  );
ALTER TABLE credential_vault_operations
  ADD COLUMN approval_last_four TEXT CHECK (
    approval_last_four IS NULL OR (
      length(approval_last_four) = 4
      AND approval_last_four NOT GLOB '*[^A-Za-z0-9_-]*'
    )
  );
ALTER TABLE credential_vault_operations
  ADD COLUMN approval_justification_digest TEXT CHECK (
    approval_justification_digest IS NULL OR (
      length(approval_justification_digest) = 64
      AND approval_justification_digest = lower(approval_justification_digest)
      AND approval_justification_digest NOT GLOB '*[^0-9a-f]*'
    )
  );

CREATE TRIGGER credential_vault_approval_insert_shape
BEFORE INSERT ON credential_vault_operations
WHEN (
  (NEW.approval_api_key_id IS NULL) +
  (NEW.approval_user_id IS NULL) +
  (NEW.approval_nickname IS NULL) +
  (NEW.approval_last_four IS NULL) +
  (NEW.approval_justification_digest IS NULL)
) NOT IN (0, 5)
BEGIN
  SELECT RAISE(ABORT, 'invalid pending self API key approval');
END;

CREATE TRIGGER credential_vault_approval_update_shape
BEFORE UPDATE OF
  approval_api_key_id, approval_user_id, approval_nickname,
  approval_last_four, approval_justification_digest
ON credential_vault_operations
WHEN (
  (NEW.approval_api_key_id IS NULL) +
  (NEW.approval_user_id IS NULL) +
  (NEW.approval_nickname IS NULL) +
  (NEW.approval_last_four IS NULL) +
  (NEW.approval_justification_digest IS NULL)
) NOT IN (0, 5)
BEGIN
  SELECT RAISE(ABORT, 'invalid pending self API key approval');
END;

CREATE TABLE credential_self_api_key_approvals (
  credential_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE RESTRICT,
  vault_generation INTEGER NOT NULL CHECK (vault_generation > 0),
  approved_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  nickname_snapshot TEXT NOT NULL CHECK (
    length(nickname_snapshot) BETWEEN 1 AND 512
  ),
  last_four_snapshot TEXT NOT NULL CHECK (
    length(last_four_snapshot) = 4
    AND last_four_snapshot NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  justification_digest TEXT NOT NULL CHECK (
    length(justification_digest) = 64
    AND justification_digest = lower(justification_digest)
    AND justification_digest NOT GLOB '*[^0-9a-f]*'
  ),
  approved_at INTEGER NOT NULL CHECK (approved_at >= 0),
  FOREIGN KEY (service_id, credential_id)
    REFERENCES service_credentials(service_id, id) ON DELETE CASCADE
) STRICT;

CREATE INDEX credential_self_api_key_approvals_key_idx
  ON credential_self_api_key_approvals (api_key_id, credential_id);
CREATE INDEX credential_self_api_key_approvals_service_idx
  ON credential_self_api_key_approvals (service_id, credential_id);
`;

const migration0018 = `
ALTER TABLE users ADD COLUMN last_qualifying_activity_at INTEGER
  CHECK (
    last_qualifying_activity_at IS NULL
    OR last_qualifying_activity_at >= created_at
  );
ALTER TABLE users ADD COLUMN suspended_at INTEGER
  CHECK (suspended_at IS NULL OR suspended_at >= created_at);
ALTER TABLE users ADD COLUMN suspension_origin TEXT
  CHECK (suspension_origin IS NULL OR suspension_origin IN ('manual', 'inactivity'));
ALTER TABLE users ADD COLUMN suspension_rule_version INTEGER
  CHECK (suspension_rule_version IS NULL OR suspension_rule_version > 0);

UPDATE users
SET last_qualifying_activity_at = max(
  created_at,
  coalesce(last_login_at, created_at),
  coalesce(last_authenticated_at, created_at)
);

CREATE TRIGGER users_suspension_metadata_insert_guard
BEFORE INSERT ON users
WHEN
  (NEW.suspended_at IS NULL) <> (NEW.suspension_origin IS NULL)
  OR (
    NEW.suspension_origin = 'inactivity'
    AND NEW.suspension_rule_version IS NULL
  )
  OR (
    NEW.suspension_origin IS NOT NULL
    AND NEW.status <> 'suspended'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid suspension metadata');
END;

CREATE TRIGGER users_suspension_metadata_update_guard
BEFORE UPDATE OF status, suspended_at, suspension_origin, suspension_rule_version
ON users
WHEN
  (NEW.suspended_at IS NULL) <> (NEW.suspension_origin IS NULL)
  OR (
    NEW.suspension_origin = 'inactivity'
    AND NEW.suspension_rule_version IS NULL
  )
  OR (
    NEW.suspension_origin IS NOT NULL
    AND NEW.status <> 'suspended'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid suspension metadata');
END;

ALTER TABLE identity_security_state
  ADD COLUMN password_policy_version INTEGER NOT NULL DEFAULT 1
  CHECK (password_policy_version > 0);
ALTER TABLE identity_security_state
  ADD COLUMN password_change_epoch INTEGER NOT NULL DEFAULT 1
  CHECK (password_change_epoch > 0);
ALTER TABLE local_password_credentials
  ADD COLUMN password_change_epoch INTEGER NOT NULL DEFAULT 1
  CHECK (password_change_epoch > 0);

CREATE TABLE security_settings (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  password_minimum_length INTEGER NOT NULL
    CHECK (password_minimum_length BETWEEN 8 AND 128),
  password_blocklist_version INTEGER NOT NULL
    CHECK (password_blocklist_version BETWEEN 1 AND 2147483647),
  password_policy_version INTEGER NOT NULL CHECK (password_policy_version > 0),
  admin_session_absolute_ms INTEGER NOT NULL
    CHECK (admin_session_absolute_ms BETWEEN 3600000 AND 86400000),
  admin_session_inactivity_ms INTEGER NOT NULL
    CHECK (admin_session_inactivity_ms BETWEEN 300000 AND 7200000),
  user_session_absolute_ms INTEGER NOT NULL
    CHECK (user_session_absolute_ms BETWEEN 3600000 AND 259200000),
  user_session_inactivity_ms INTEGER NOT NULL
    CHECK (user_session_inactivity_ms BETWEEN 300000 AND 86400000),
  oauth_access_token_ms INTEGER NOT NULL
    CHECK (oauth_access_token_ms BETWEEN 60000 AND 900000),
  oauth_refresh_inactivity_ms INTEGER NOT NULL
    CHECK (oauth_refresh_inactivity_ms BETWEEN 86400000 AND 7776000000),
  oauth_refresh_absolute_ms INTEGER NOT NULL
    CHECK (oauth_refresh_absolute_ms BETWEEN 604800000 AND 31536000000),
  step_up_mode TEXT NOT NULL
    CHECK (step_up_mode IN ('five_minutes', 'always')),
  login_attempts INTEGER NOT NULL CHECK (login_attempts BETWEEN 3 AND 20),
  login_window_ms INTEGER NOT NULL
    CHECK (login_window_ms BETWEEN 300000 AND 3600000),
  password_attempts INTEGER NOT NULL CHECK (password_attempts BETWEEN 3 AND 20),
  password_window_ms INTEGER NOT NULL
    CHECK (password_window_ms BETWEEN 300000 AND 3600000),
  totp_attempts INTEGER NOT NULL CHECK (totp_attempts BETWEEN 3 AND 10),
  totp_window_ms INTEGER NOT NULL
    CHECK (totp_window_ms BETWEEN 60000 AND 900000),
  management_api_attempts INTEGER NOT NULL
    CHECK (management_api_attempts BETWEEN 10 AND 600),
  management_api_window_ms INTEGER NOT NULL
    CHECK (management_api_window_ms BETWEEN 60000 AND 3600000),
  search_attempts INTEGER NOT NULL CHECK (search_attempts BETWEEN 5 AND 120),
  search_window_ms INTEGER NOT NULL
    CHECK (search_window_ms BETWEEN 60000 AND 3600000),
  backup_attempts INTEGER NOT NULL CHECK (backup_attempts BETWEEN 1 AND 10),
  backup_window_ms INTEGER NOT NULL
    CHECK (backup_window_ms BETWEEN 900000 AND 86400000),
  inactivity_suspension_days INTEGER
    CHECK (
      inactivity_suspension_days IS NULL
      OR inactivity_suspension_days BETWEEN 1 AND 3650
    ),
  suspended_deactivation_days INTEGER
    CHECK (
      suspended_deactivation_days IS NULL
      OR suspended_deactivation_days BETWEEN 1 AND 3650
    ),
  security_job_interval_ms INTEGER NOT NULL
    CHECK (security_job_interval_ms BETWEEN 60000 AND 86400000),
  security_job_batch_size INTEGER NOT NULL
    CHECK (security_job_batch_size BETWEEN 50 AND 2000),
  security_job_wall_time_ms INTEGER NOT NULL
    CHECK (security_job_wall_time_ms BETWEEN 5000 AND 120000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK (admin_session_inactivity_ms < admin_session_absolute_ms),
  CHECK (user_session_inactivity_ms < user_session_absolute_ms),
  CHECK (oauth_refresh_inactivity_ms <= oauth_refresh_absolute_ms)
) STRICT;

CREATE TABLE security_global_events (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND id = lower(id)
    AND substr(id, 15, 1) = '7'
    AND substr(id, 20, 1) IN ('8', '9', 'a', 'b')
    AND id NOT GLOB '*[^0-9a-f-]*'
  ),
  kind TEXT NOT NULL CHECK (kind IN ('password_change', 'totp_reset')),
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role TEXT NOT NULL CHECK (actor_role = 'superadmin'),
  justification TEXT NOT NULL CHECK (
    length(justification) BETWEEN 1 AND 1024
    AND justification = trim(justification)
    AND instr(justification, char(0)) = 0
    AND instr(justification, char(10)) = 0
    AND instr(justification, char(13)) = 0
  ),
  affected_users INTEGER NOT NULL CHECK (affected_users >= 0),
  resulting_global_epoch INTEGER NOT NULL CHECK (resulting_global_epoch > 0),
  resulting_password_policy_version INTEGER NOT NULL
    CHECK (resulting_password_policy_version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
) STRICT;

CREATE INDEX security_global_events_time_idx
  ON security_global_events (created_at DESC, id DESC);

CREATE TABLE security_job_state (
  job_name TEXT PRIMARY KEY CHECK (job_name = 'inactivity'),
  next_run_at INTEGER NOT NULL CHECK (next_run_at >= 0),
  lease_owner TEXT CHECK (
    lease_owner IS NULL
    OR (
      length(lease_owner) = 36
      AND lease_owner = lower(lease_owner)
      AND substr(lease_owner, 15, 1) = '7'
      AND substr(lease_owner, 20, 1) IN ('8', '9', 'a', 'b')
      AND lease_owner NOT GLOB '*[^0-9a-f-]*'
    )
  ),
  lease_expires_at INTEGER CHECK (
    lease_expires_at IS NULL OR lease_expires_at >= 0
  ),
  cursor_time INTEGER CHECK (cursor_time IS NULL OR cursor_time >= 0),
  cursor_id TEXT CHECK (
    cursor_id IS NULL
    OR (
      length(cursor_id) = 36
      AND cursor_id = lower(cursor_id)
      AND substr(cursor_id, 15, 1) = '7'
      AND substr(cursor_id, 20, 1) IN ('8', '9', 'a', 'b')
      AND cursor_id NOT GLOB '*[^0-9a-f-]*'
    )
  ),
  last_started_at INTEGER CHECK (last_started_at IS NULL OR last_started_at >= 0),
  last_completed_at INTEGER CHECK (
    last_completed_at IS NULL OR last_completed_at >= 0
  ),
  last_outcome TEXT CHECK (
    last_outcome IS NULL OR last_outcome IN ('completed', 'partial', 'skipped', 'error')
  ),
  last_code TEXT CHECK (
    last_code IS NULL
    OR (
      length(last_code) BETWEEN 1 AND 64
      AND last_code NOT GLOB '*[^a-z0-9_.-]*'
    )
  ),
  suspended_count INTEGER NOT NULL DEFAULT 0 CHECK (suspended_count >= 0),
  deactivated_count INTEGER NOT NULL DEFAULT 0 CHECK (deactivated_count >= 0),
  protected_count INTEGER NOT NULL DEFAULT 0 CHECK (protected_count >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL)),
  CHECK ((cursor_time IS NULL) = (cursor_id IS NULL))
) STRICT;
`;

const migration0019 = `
ALTER TABLE administrative_audit_events ADD COLUMN sequence INTEGER;
ALTER TABLE administrative_audit_events ADD COLUMN category TEXT NOT NULL DEFAULT 'other'
  CHECK (category IN (
    'authentication', 'authorization', 'identity', 'service', 'credential',
    'policy', 'security', 'system', 'audit', 'other'
  ));
ALTER TABLE administrative_audit_events ADD COLUMN service_label_snapshot TEXT
  CHECK (
    service_label_snapshot IS NULL
    OR length(service_label_snapshot) BETWEEN 1 AND 256
  );

UPDATE administrative_audit_events SET sequence = rowid;
CREATE UNIQUE INDEX administrative_audit_events_sequence_idx
  ON administrative_audit_events (sequence);
CREATE INDEX administrative_audit_events_timeline_idx
  ON administrative_audit_events (occurred_at DESC, sequence DESC);
CREATE INDEX administrative_audit_events_category_time_idx
  ON administrative_audit_events (category, occurred_at DESC, sequence DESC);

CREATE VIRTUAL TABLE administrative_audit_fts USING fts5(
  event_id UNINDEXED,
  document,
  content='',
  contentless_delete=1,
  tokenize='unicode61 remove_diacritics 2'
);

INSERT INTO administrative_audit_fts (rowid, event_id, document)
SELECT
  sequence,
  event_id,
  lower(
    category || ' ' || actor_type || ' ' || coalesce(actor_id_snapshot, '') || ' ' ||
    actor_label_snapshot || ' ' || coalesce(actor_role_snapshot, '') || ' ' ||
    authentication_method || ' ' || action || ' ' || result || ' ' ||
    target_type || ' ' || coalesce(target_id_snapshot, '') || ' ' ||
    target_label_snapshot || ' ' || coalesce(service_id_snapshot, '') || ' ' ||
    coalesce(service_label_snapshot, '') || ' ' || coalesce(justification, '') || ' ' ||
    changes_json || ' ' || correlation_id || ' ' || source_json || ' ' ||
    coalesce(failure_code, '')
  )
FROM administrative_audit_events;

CREATE TRIGGER administrative_audit_events_immutable
BEFORE UPDATE ON administrative_audit_events
BEGIN
  SELECT RAISE(ABORT, 'administrative audit events are immutable');
END;

CREATE TABLE runtime_audit_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE CHECK (
    length(event_id) = 36
    AND event_id = lower(event_id)
    AND substr(event_id, 15, 1) = '7'
    AND substr(event_id, 20, 1) IN ('8', '9', 'a', 'b')
    AND event_id NOT GLOB '*[^0-9a-f-]*'
  ),
  occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0),
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 1 AND 128),
  outcome TEXT NOT NULL CHECK (outcome IN ('allow', 'deny', 'error', 'warning')),
  category TEXT NOT NULL CHECK (category IN (
    'authentication', 'authorization', 'identity', 'service', 'credential',
    'policy', 'security', 'system', 'audit', 'other'
  )),
  actor_type TEXT NOT NULL CHECK (
    actor_type IN ('oauth_user', 'api_key', 'anonymous', 'system')
  ),
  subject_id_snapshot TEXT,
  subject_label_snapshot TEXT NOT NULL CHECK (
    length(subject_label_snapshot) BETWEEN 1 AND 256
  ),
  service_id_snapshot TEXT,
  service_label_snapshot TEXT CHECK (
    service_label_snapshot IS NULL
    OR length(service_label_snapshot) BETWEEN 1 AND 256
  ),
  destination TEXT,
  action TEXT,
  method TEXT,
  target_host TEXT,
  target_path TEXT,
  downstream_status INTEGER CHECK (
    downstream_status IS NULL OR downstream_status BETWEEN 100 AND 599
  ),
  policy_rule TEXT,
  reason TEXT,
  failure_code TEXT,
  correlation_id TEXT,
  source_json TEXT NOT NULL CHECK (
    length(source_json) <= 4096 AND json_valid(source_json)
  ),
  duration_ms INTEGER CHECK (
    duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000
  ),
  tls_verify INTEGER CHECK (tls_verify IS NULL OR tls_verify IN (0, 1)),
  tokenization_count INTEGER CHECK (
    tokenization_count IS NULL OR tokenization_count BETWEEN 0 AND 100000
  ),
  details_json TEXT NOT NULL CHECK (
    length(details_json) <= 16384 AND json_valid(details_json)
  )
) STRICT;

CREATE INDEX runtime_audit_events_timeline_idx
  ON runtime_audit_events (occurred_at DESC, sequence DESC);
CREATE INDEX runtime_audit_events_service_time_idx
  ON runtime_audit_events (service_id_snapshot, occurred_at DESC, sequence DESC);
CREATE INDEX runtime_audit_events_subject_time_idx
  ON runtime_audit_events (subject_id_snapshot, occurred_at DESC, sequence DESC);
CREATE INDEX runtime_audit_events_category_time_idx
  ON runtime_audit_events (category, occurred_at DESC, sequence DESC);

CREATE VIRTUAL TABLE runtime_audit_fts USING fts5(
  event_id UNINDEXED,
  document,
  content='',
  contentless_delete=1,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER runtime_audit_events_immutable
BEFORE UPDATE ON runtime_audit_events
BEGIN
  SELECT RAISE(ABORT, 'runtime audit events are immutable');
END;

CREATE TABLE audit_retention_settings (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  administrative_days INTEGER CHECK (
    administrative_days IS NULL OR administrative_days BETWEEN 1 AND 3650
  ),
  runtime_days INTEGER CHECK (
    runtime_days IS NULL OR runtime_days BETWEEN 1 AND 3650
  ),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

INSERT INTO audit_retention_settings (
  singleton, administrative_days, runtime_days, version, created_at, updated_at
) VALUES (1, 400, 400, 1, 0, 0);

CREATE TABLE audit_maintenance_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  next_run_at INTEGER NOT NULL CHECK (next_run_at >= 0),
  lease_owner TEXT,
  lease_expires_at INTEGER,
  last_started_at INTEGER,
  last_completed_at INTEGER,
  last_outcome TEXT CHECK (
    last_outcome IS NULL OR last_outcome IN ('completed', 'partial', 'skipped', 'error')
  ),
  last_code TEXT,
  retained_administrative_count INTEGER NOT NULL DEFAULT 0 CHECK (
    retained_administrative_count >= 0
  ),
  retained_runtime_count INTEGER NOT NULL DEFAULT 0 CHECK (
    retained_runtime_count >= 0
  ),
  repaired_index_count INTEGER NOT NULL DEFAULT 0 CHECK (
    repaired_index_count >= 0
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
) STRICT;

INSERT INTO audit_maintenance_state (
  singleton, next_run_at, version, created_at, updated_at
) VALUES (1, 0, 1, 0, 0);
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
  {
    version: 6,
    name: "user_administration_lifecycle",
    sql: migration0006,
  },
  {
    version: 7,
    name: "generic_oidc_provider",
    sql: migration0007,
  },
  {
    version: 8,
    name: "service_management",
    sql: migration0008,
  },
  {
    version: 9,
    name: "groups_and_assignments",
    sql: migration0009,
  },
  {
    version: 10,
    name: "credential_management",
    sql: migration0010,
  },
  {
    version: 11,
    name: "policy_management_explanation",
    sql: migration0011,
  },
  {
    version: 12,
    name: "policy_bulk_copy_idempotency",
    sql: migration0012,
  },
  {
    version: 13,
    name: "persisted_runtime_authorization",
    sql: migration0013,
  },
  {
    version: 14,
    name: "multiuser_mcp_oauth",
    sql: migration0014,
  },
  {
    version: 15,
    name: "system_owned_api_keys",
    sql: migration0015,
  },
  {
    version: 16,
    name: "api_key_service_revision_actors",
    sql: migration0016,
  },
  {
    version: 17,
    name: "self_api_key_protection",
    sql: migration0017,
  },
  {
    version: 18,
    name: "security_settings_automation",
    sql: migration0018,
  },
  {
    version: 19,
    name: "audit_search_retention",
    sql: migration0019,
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
