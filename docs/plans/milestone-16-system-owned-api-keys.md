# Milestone 16 System-Owned API Keys Plan

## Outcome

Add durable, system-owned management API keys with three mutually exclusive
static roles (`service`, `all_services`, and `system`). A raw key is generated
and displayed only by creation or rotation, while persistence contains only a
recognizable identifier, an Argon2id verifier, the last four characters, safe
metadata, immutable authority, and lifecycle timestamps.

Browser administrators manage key metadata after human step-up. API-key
principals can call only management endpoints explicitly allowed by the
authoritative permission matrix; no API key can manage keys, satisfy step-up,
view or affect a superadmin, invoke restore/global-authenticator/vault
operations, or gain authority from its creator's account.

Self-key detection and downstream credential approval remain Milestone 17.
Backup behavior remains Milestone 21.

## Wire format and verifier boundary

- Raw keys use `ssk_v1_<identifier>_<secret>`.
- `identifier` is 12 random bytes encoded as canonical base64url (16
  characters). It is non-secret, unique, and selects one verifier row without
  scanning the table.
- `secret` is 32 random bytes encoded as canonical base64url (43 characters).
  The complete key therefore carries 256 secret bits and has a recognizable,
  versioned grammar.
- Parsing is exact and bounded: ASCII only, fixed segment sizes, canonical
  base64url decode/re-encode, and no whitespace or alternate encodings.
- Hash only the complete UTF-8 raw key with dedicated Argon2id parameters
  matching the reviewed local-password floor: 64 MiB memory, time cost 3,
  parallelism 1, 32-byte output, and a random 16-byte salt.
- Verification is bounded by a process-local semaphore of four concurrent
  Argon2 operations. Saturation fails closed as `rate_limited`; an unknown
  identifier performs one dummy verifier check so recognizable invalid keys do
  not create an obvious fast path.
- Secret buffers are zeroed after hashing/verification. Raw keys, hashes, and
  `Authorization` values never enter logs, audits, errors, or later reads.

## Durable schema and immutable invariants

Migration 0015 adds:

- `api_keys`: UUID primary key; unique identifier; verifier hash; nickname;
  last four; role; nullable service UUID; expiration policy (`forever` or
  `timestamp`); nullable expiry; status; creator UUID audit reference without
  an ownership foreign key; version; created/updated/last-used/revoked times.
- checks enforce `service` role iff exactly one service UUID is present,
  non-service roles iff it is absent, expiry-policy consistency, safe bounded
  nickname/identifier/hash/suffix values, and lifecycle timestamp consistency;
- unique identifier and `(status, expires_at, id)`,
  `(service_id, status, id)`, and creator indexes;
- `api_key_activity`: bounded retained safe-use records with key UUID,
  immutable nickname/last-four/role/scope snapshots, action/target/outcome,
  request ID, direct-source digest, and timestamp. It contains no request body,
  header, raw source address, raw key, verifier, password/reset value, or
  response material.

Role, service scope, and original expiry policy/value are never updated. A
finite expiry may only move earlier. A forever key cannot be changed to finite.
Effective `expired` status is projected at reads/authentication when
`expires_at <= now`; persisted `revoked` remains terminal. Repeated revocation
is an idempotent no-change result.

## Authentication and request-use audit

Add an `ApiKeyAuthenticator` before the browser/restricted-session
authenticators:

1. Ignore requests without `Authorization`.
2. Accept only one exact `Bearer <ssk_v1_...>` value within a strict byte cap.
   Any malformed or duplicate authorization value fails uniformly.
3. Parse the identifier, fetch one candidate row, perform the bounded slow
   verification, and reject revoked or boundary-expired keys.
4. Atomically advance `last_used_at` and append a safe authentication-use
   record. Return a trusted `ControlAuthenticationContext` containing method
   `api_key`, key UUID, static role, and immutable service scope.
5. The existing limiter applies both direct-source and key UUID windows after
   authentication. Verifier concurrency provides the pre-authentication abuse
   bound.

Route authorization appends an activity outcome for permitted and denied
API-key calls using route ID, safe target UUIDs, and request ID. Authentication
failure records contain only a safe identifier when one was successfully
parsed. Existing completion logs continue to expose UUID/method only.

## Static policy and domain enforcement

The existing Section 30 permission table remains the sole role-to-capability
registry. Add a coverage assertion requiring every registered management route
to declare whether `api_key` is accepted and, when accepted, to use a matrix
capability. Browser-only endpoints remain browser-only.

Extend the trusted authentication context with immutable API-key scope, and
update authorization seams as follows:

- `scoped_service` requires the request's service UUID to equal the key scope;
- `all_services`, `all_ordinary_users`, `ordinary_users_without_assignment`,
  and `permitted_settings` accept only their corresponding static API role;
- related-user service keys require current ordinary-user relationship to the
  scoped service;
- every target-user path resolves the target before mutation and hard-denies
  superadmin rows for all API-key roles;
- API-key requests never enter browser step-up verification.

Repositories continue to re-read browser actors and their live role/status.
For API-key actors they instead require the middleware-supplied key UUID,
role, and service scope to match a fresh active `api_keys` row in the same
transaction before mutation. Domain checks then enforce service scope, target
eligibility, and role-specific operations. This prevents a revoked/expired key
or forged context from mutating between authentication and commit.

Allow `api_key` on the existing service, destination, credential, policy,
group, membership, invitation, ordinary-user view/reset, profile/status/role,
admin-account, and permitted settings routes exactly where Section 30 allows.
Keep key lifecycle, own-account/security/grant/session, service-admin
assignment, permanent service deletion, global authenticator, credential
export, restore, self-key approval, and vault routes interactive-only.
`system` does not inherit any service route.

API-authorized password reset uses the existing temporary-password machinery,
returns the temporary password once from a no-store response, and records only
`temporary_access_issued`. TOTP reset returns metadata only. No API role can
target a superadmin or grant `superadmin`.

## Key lifecycle transactions

Browser-only, no-store routes:

- `GET /api/v2/api-keys`
- `POST /api/v2/api-keys`
- `GET /api/v2/api-keys/{api_key_id}`
- `PATCH /api/v2/api-keys/{api_key_id}` for nickname and finite-expiry
  shortening
- `POST /api/v2/api-keys/{api_key_id}/revoke`
- `POST /api/v2/api-keys/{api_key_id}/rotate`
- `GET /api/v2/api-keys/{api_key_id}/activity`

List/detail/activity use signed keyset cursors and apply actor scope in SQL
before filtering/pagination. An admin can access only `service` keys for
currently assigned services. A superadmin can access every key.

Creation validates a required normalized nickname (1–128 Unicode code points,
512 UTF-8 bytes), exact role/scope pairing, and either `forever` or an integer
day lifetime from 1 through 3650. `all_services` requires the exact durable
confirmation `I UNDERSTAND THIS KEY COVERS CURRENT AND FUTURE SERVICES`.
The response is `201`, no-store, and contains `one_time_key` exactly once.

PATCH uses `If-Match`. Nickname may change; audit/activity retain snapshots.
Expiry accepts only a new timestamp strictly between now and the existing
finite expiry. It cannot change a forever policy, revive an expired/revoked
key, or extend authority.

Revoke uses `If-Match`, justification, and is idempotent after the first
transition. Rotation requires the old version and justification, creates a
replacement with the same immutable role/scope/expiry policy, and revokes the
old key in one transaction. A finite replacement retains the old absolute
expiry, never a fresh lifetime. The new raw key is returned once.

Creation/rotation do not use generic response replay because replay would
require retaining raw key material. A repeated submission must create no
ambiguous second result: concurrent `If-Match` protects rotation and clients
must treat a lost one-time response as requiring a fresh rotation.

## Metadata and browser workspace

Add the “API keys” workspace for admins and superadmins:

- role-aware list/detail with nickname, UUID, last four, role/service, status,
  created/last-used/expiry/revocation times, and recent safe activity;
- assigned-service admins can create, shorten, rotate, and revoke only keys in
  their current service scope;
- superadmins can manage all roles and must acknowledge the durable
  `all_services` warning;
- creation/rotation uses a dedicated confirmation screen with one copy control
  and explicit text that the value cannot be retrieved again;
- metadata reloads never contain the raw value or verifier.

## Minimal delivery slices

1. Migration 0015, key grammar/generation, Argon2id verifier pool, repository
   creation/projection, and positive/negative/boundary tests.
2. Key metadata list/detail/update/revoke/rotate/activity transactions,
   actor-scoped visibility, audited one-time semantics, and concurrency tests.
3. API-key authentication composition, expiry/revocation/creator-independence,
   per-key/source and verifier-concurrency limiting, safe use auditing, and
   positive/negative tests.
4. Static scope authorization and transactional API-principal revalidation
   across service/configuration/group/credential/policy routes, with complete
   service/all/system positive and denied matrix tests.
5. API-key ordinary/admin user operations, one-time password reset,
   no-seed TOTP reset, superadmin hard denial, and browser/API-role independence
   tests.
6. Strict key-lifecycle HTTP/OpenAPI contracts and complete registered-endpoint
   authentication/permission coverage tests.
7. Responsive browser workspace, one-time confirmation UX, activity metadata,
   durable warning, accessibility, and negative display tests.
8. Operator documentation, production build, OpenAPI currency, full regression,
   acceptance review, and milestone status update.

Every completed slice receives positive and negative tests, the full `npm test`
regression, and one concise commit.

## Acceptance matrix

- Storage: exact key grammar/entropy, canonical decoding, supported verifier,
  identifier uniqueness, no raw persistence/retrieval, zeroed buffers.
- Lifecycle: forever/1-day/3650-day bounds, exact expiry instant, shortening
  only, no extension/policy change, replacement-plus-revoke, repeated revoke.
- Browser scope: assigned admin only its service keys; lost assignment hides
  metadata; superadmin global visibility; required step-up.
- API roles: every Section 30 endpoint cell exercised; `service` cross-service
  denial; `all_services` current/future service behavior; `system` no service
  inheritance.
- Users: related/all invitations, views, password and TOTP reset; only `system`
  profile/status/user-admin/role/delete authority; no superadmin visibility or
  effect.
- Hard denials: key lifecycle, step-up, restore, global password/TOTP, secret
  export, self-key approval, vault operations, service-admin assignment, and
  permanent service deletion.
- Independence: creator suspension/deactivation/deletion and role changes do not
  alter key authority; service archive does not broaden or silently retarget a
  scoped key.
- Abuse/audit: per-source, per-key, and verifier-concurrency limits; allow,
  deny, invalid, expired, and revoked activity contains safe snapshots only.
- Exposure: raw keys appear only in creation/rotation responses; verifier,
  authorization header, temporary password, reset input, request body, and
  response body never appear in logs, audits, metadata, OpenAPI examples, or UI
  reloads.
