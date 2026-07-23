# Milestone 07 User Administration And Lifecycle Acceptance Review

## Review conclusion

Milestone 07 is complete within its assigned boundary. The control plane now
provides viewer-scoped user/profile APIs and responsive browser views, local
invitation, guarded resets and lifecycle transitions, role changes, and
permanent deletion with retained immutable audit evidence.

Admin relationship resolution deliberately remains fail-closed until
Milestones 09–10 supply service membership. No service assignment, generic OIDC,
API-key authority, or automatic inactivity workflow was added.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Role matrix | Table-driven policy over actor UUID/role, target UUID/role/state, action, and relationship scope; ordinary self-only and admin fail-closed tests |
| Authorized reads | Secret-free projections, bounded search/filter/limit, stable ordering, signed viewer/scope/filter-bound cursors, no-store responses, strong ETags |
| Profile behavior | Self and authorized target edits, normalized duplicate-email guard, name-only versioning, atomic email security-epoch invalidation |
| Invitation and resets | Generated Argon2id temporary values, one-time display, hash-only idempotent replay, invited-to-enrollment handoff, password/TOTP reset semantics |
| Lifecycle | Suspend/reactivate, deactivate, enrollment restoration, role changes, legal-transition guards, UUID/profile preservation, durable invalidation |
| Step-up and concurrency | Central permission check, five-minute or transaction-bound proof, `If-Match`, immediate transaction re-read, idempotency conflict checks |
| Superadmin invariant | Same-transaction count/update checks across demotion, suspension, and deactivation, including concurrent mixed paths; no superadmin deletion |
| Deletion | Deactivated user/admin only, complete current relation inventory removed, no tombstone, bootstrap cleanup, retained target-snapshot audit |
| Failure audit | Sensitive contract and domain failures write sanitized deny/error events; missing-precondition evidence includes safe actor/target snapshots |
| Browser UX | Authenticated role bootstrap, self-only user privacy, related-admin controls, responsive list/detail/forms, confirmation and justification, one-time live panel |

## Security review

- Authentication, origin/CSRF, coarse permission, relationship scope, step-up,
  schema, concurrency, and idempotency checks occur before the domain mutation.
- Domain transactions re-read mutable authorization inputs. Credential erasure,
  epoch changes, session revocation, invalidation, idempotency, proof
  consumption, and success audit commit atomically where applicable.
- Sensitive failure auditing consumes only schema-validated justification and
  UUIDv7 identifiers. It does not persist raw bodies, headers, cookies,
  credentials, proofs, or response payloads.
- Admin directory and mutation authority fail closed while the relationship
  resolver has no evidence. The UI does not widen server authority.
- One-time temporary values are returned only on first execution, remain only in
  transient component state, and are not placed in URLs or browser storage.
- Permanent deletion is a physical event, not a status. Cascades and the
  explicit bootstrap cleanup remove current operational identity relations while
  denormalized administrative audit snapshots remain intelligible.

## Deliberate handoff

Milestones 09–10 provide service/group persistence and activate the existing
admin relationship hook without changing endpoint schemas. Milestones 13–15
attach runtime references and OAuth grants to durable invalidation. Milestone 16
adds system-owned API-key authority without granting human step-up or
superadmin-only actions.

## Validation

- production server and responsive web build
- focused policy, cursor, profile, lifecycle, deletion, control HTTP, failure
  audit, and browser UI tests
- generated control OpenAPI consistency
- `git diff --check`
- full suite with required loopback and Unix-socket permission:
  **67 test files and 565 tests passed**

Accepted implementation commit: `98fa7b3`.
