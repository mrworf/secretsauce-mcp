# Milestone 16: System-Owned API Keys

## Purpose and why

Enable safe automation of the management API without tying machine authority to human accounts or creating API-key superadmins. API roles are static product contracts independent of account roles.

## Dependencies

- Milestones 07, 09–12, and 15.

## PRD traceability

- Section 19: system ownership, key fields, static roles, authority, lifecycle, and audit.
- Sections 25, 29–30, and 34.5: API limits/contracts, authoritative permission matrix, and acceptance.
- Sections 31 and 33: redaction and one-time UX behavior.

## Scope

- Add recognizable high-entropy API keys shown once and persisted only as slow verifier hashes plus safe identifier, nickname, last four, immutable API role/resource scope, immutable expiry policy, status, timestamps, and creator audit reference.
- Implement mutually exclusive static API roles: `service` with exactly one immutable service UUID, `all_services`, and `system`; `system` does not inherit service authority.
- Allow assigned admins to create/revoke/view metadata for `service` keys on assigned services after browser step-up.
- Allow only superadmins to create/revoke/view `all_services` and `system` key metadata after browser step-up.
- Authenticate management API requests by key and apply per-key/source rate limits.
- Enforce every API-role cell in PRD Section 30 at endpoint level, independently of any creator/account role.
- Allow `service`/`all_services` user invite/view/reset authority but no profile edit or status/role change.
- Allow only `system` keys to edit, reset, suspend, reactivate, deactivate, permanently delete eligible ordinary/admin users, change `user`/`admin` roles, and manage permitted global settings without step-up; never expose or affect superadmins.
- Implement expiry, shortening-only expiration, revocation, and rotation as replacement+revoke.
- Add key metadata/activity UX and one-time raw-key confirmation.

## Not in scope

- API keys managing API keys, satisfying step-up, affecting superadmins, granting superadmin, restoring, global password/TOTP reset, vault-key operations, or self-use approval.
- Self-API-key credential/runtime protections, added in Milestone 17.
- Backup endpoint behavior, added in Milestone 21.
- Changing API role, service scope, or extending expiry after creation.

## Required behavior and interfaces

- Key authority depends only on key validity, immutable API role/resource scope, static permission matrix, target eligibility, and rate limits.
- Human account role/status changes never alter or revoke system-owned keys.
- `all_services` covers current/future services and is created with a durable warning.
- API password reset returns a temporary password once in a non-cacheable response; TOTP reset returns no seed.
- Raw key/verifier is never retrievable; visibility means only PRD-approved metadata.

## Security, authorization, invalidation, and audit

- Endpoint authorization is table-driven, deny-by-default, and tests cross-service, cross-role, superadmin, and interactive-only denials.
- No API-key path can invoke key lifecycle endpoints, even with `system`.
- Every use records key UUID, nickname snapshot, last four, API role/resource scope, target/action/outcome, and safe request metadata.
- Raw keys, verifier hashes, authorization headers, temporary passwords, and reset inputs are excluded from logs/audits.

## Tests

- Positive: one-time creation, service/all/system permitted matrix cells, key authentication, expiry shortening, rotation, revocation, user/admin system operations without step-up, and activity metadata.
- Negative: every denied matrix cell, cross-service service key, system key service configuration, profile/status edit by service/all, any superadmin visibility/effect, API-key lifecycle by key, role/scope/expiry expansion, raw-key retrieval, expired/revoked key, and rate limit.
- Boundary: forever/day-limited expiry, expiry instant, key/nickname/input sizes, verifier concurrency, creator deletion/role change, service archive, and repeated revocation.
- Integration: table-driven browser/account-role and API-role authorization contracts cover every management endpoint and prove independence.

## Acceptance criteria

- API keys are system principals with immutable static roles/scopes and one-way storage.
- Only `system` API keys can edit or change account status/role for ordinary users/admins, without step-up.
- No API key can view or affect a superadmin or manage API keys.
- Every endpoint is covered by the authoritative matrix and safe audit metadata.

## Planning handoff

Specify key wire format/prefix, entropy and hash parameters, schema/indexes, authentication middleware, static permission registry, endpoint coverage enforcement, expiry/rotation transactions, one-time response handling, limiter keys, metadata projections, and complete matrix-test generation.
