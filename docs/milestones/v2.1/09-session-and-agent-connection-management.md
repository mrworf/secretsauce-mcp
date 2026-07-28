# Milestone 09: Session And Agent-Connection Management

## Purpose and why

Give users and authorized administrators one coherent, privacy-bounded place to
inspect and immediately revoke browser sessions and OAuth agent connections.
This milestone builds on the stable browser-session lifecycle but remains
independent of suspension/recovery work, so it can proceed in parallel.

## Dependencies

- `06` — Consumes authenticated account navigation, current browser-session
  enforcement, logout semantics, CSRF protections, and designated secret
  channels.

## PRD traceability

- `ACCESS-001`–`ACCESS-012` — self, regular-admin, superadmin, immediate,
  atomic, idempotent, scoped, and audited management behavior.
- Sections 5, 8.6, 9, 10.4, 11.5, 12.5, 14.2–14.4, 15, 17.5, 20, 21.5–21.6,
  22, 23, and 25 — goals, domain language, authority, workflow, privacy,
  performance, acceptance, tests, and documentation.
- Section 24 questions 3–5 — safe device derivation, revoked-row retention, and
  high-cardinality global revocation.

## Scope

- Add Account Settings groups for Profile, Password and TOTP, Web sessions, and
  Agent connections using consistent user-facing terminology.
- List the current user's active browser sessions and agent connections with
  bounded pagination and only PRD-approved display metadata.
- Allow self revocation of one/all browser sessions and one/all agent
  connections; self bulk browser revocation includes the initiating session.
- Allow superadmins to list/revoke any individual record, all records for one
  user, and all records globally.
- Add user-detail and global administrative views with exact-scope
  confirmation, justification/step-up where required, current-session warnings,
  and accessible status.
- Permit a regular admin to see/revoke only an ordinary user's nonempty agent
  connection whose complete current reachable-service set is managed by that
  admin; never expose browser sessions or admin/superadmin-owned connections.
- Reauthorize actor role, target eligibility, and complete current scope at the
  mutation boundary rather than trusting list/cached results.
- Make revocation immediately effective after commit, bulk operations atomic,
  authorized inactive targets audited no-change successes, and inaccessible
  targets uniformly non-disclosing.
- Permit physical cleanup only after immutable sanitized audit evidence and
  enough bounded ownership/scope evidence for the documented idempotency period
  commit atomically.
- Derive safe bounded device family and coarse `/24` IPv4 or `/48` IPv6 metadata.

## Not in scope

- New OAuth issuance behavior, service assignment/policy changes, API-key
  management, or access to raw sessions, cookies, CSRF proofs, authorization
  codes, tokens, token hashes, gateway references, user-agent strings, IP
  addresses, or forwarding chains.
- Regular-admin browser-session authority, authority over admin/superadmin
  owners, connections with zero reachable services, or connections containing
  any unmanaged service.
- Guaranteeing termination of work fully authenticated and dispatched before
  revocation commit.

## Required behavior and interfaces

- Missing metadata displays **Unknown** and never invalidates a session.
  Device/network data is informational and cannot rigidly bind authority.
- Current-session markers, timestamps, auth method, sanitized device family,
  coarse source, public client identity/name, scopes, service names, and current
  usability are the only displayed fields.
- Scope-first list/filter behavior does not disclose inaccessible target
  existence. Mutation repeats current authorization in the same durable
  decision boundary as revocation.
- The first request authenticated after commit rejects the revoked capability
  with no cache grace period.
- Bulk revocation changes all selected active records or none; global/self
  browser bulk includes and clears the initiating session after commit.
- Repeated revocation is a no-change success only when the inactive target's
  current authorization remains durably provable.

## Security, authorization, invalidation, and audit

- All management mutations enforce current actor, owner, service, step-up,
  confirmation, justification, CSRF, and audit requirements before target
  existence is disclosed.
- Administrative agent revocation cannot rely on stale projections or earlier
  checks and changes no user/grant/token/reference state if current scope fails.
- Revocation audit retains actor UUID/role/auth method, target UUID, opaque
  record UUID, scope, outcome/counts, timestamp, correlation ID, and required
  justification only.
- Raw bearer/proof/reference values, bodies, raw user agents, full IPs, and
  forwarding chains remain absent from UI, APIs, logs, audits, and telemetry.
- Immutable audit survives physical operational-row deletion under existing
  administrative retention.

## Required tests and validation

- Positive tests cover every self/superadmin action and qualifying regular-admin
  connection action, individual/per-user/global scope, authorized no-change,
  pagination, metadata, and physical cleanup with retained audit.
- Negative tests cover regular-admin browser access, privileged owners,
  zero-service/unmanaged-service grants, cross-service IDs, stale scope/role/
  owner eligibility, unknown/deleted targets, malformed filters/identifiers,
  missing confirmation/justification/step-up, and markup injection.
- Concurrency/persistence tests prove mutation-boundary reauthorization,
  immediate post-commit rejection, atomic bulk operations, initiating-session
  inclusion, audit coupling, and no state change on lost scope.
- Boundary/performance tests cover supported list sizes, global revocation,
  bounded transactions or logical epochs, pagination, and cleanup.
- Browser/accessibility tests cover account/admin views, wide/narrow layouts,
  current-session warnings, exact-scope confirmations, keyboard/focus/status,
  session-clearing navigation, and informational metadata copy.
- Focused access/OAuth/browser tests, production build, full suite, OpenAPI
  conformance, and privacy/secret scan pass.

## Acceptance criteria

- [ ] Users can safely inspect and revoke one/all of their browser sessions and
      agent connections.
- [ ] Superadmin and regular-admin authority exactly matches the PRD matrix at
      list and mutation time.
- [ ] The first newly authenticated request after commit rejects every revoked
      capability, including atomic bulk scope.
- [ ] Inactive, inaccessible, and physically deleted targets follow their exact
      non-disclosing/idempotency contracts.
- [ ] UI/API metadata and immutable audit contain only approved bounded fields.
- [ ] Required concurrency, browser, performance, build, full-suite, OpenAPI,
      and privacy gates pass.

## Planning handoff

Resolve list/revocation schemas, signed pagination, device-family derivation,
coarse source storage, mutation-boundary transaction or equivalent predicate,
global epoch versus bounded-row update, idempotency evidence retention, cleanup,
audit snapshots, and browser behavior after current-session revocation. Likely
slices are: self-service projections/actions; scoped administrative actions and
race safety; then global/bulk behavior, cleanup/audit, UX, and performance.
