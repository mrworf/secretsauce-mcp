# Milestone 09: Session And Agent-Connection Management

## Outcome

Users can inspect and immediately revoke their own browser sessions and agent
connections, while superadmins and qualifying service administrators receive
only the exact administrative authority defined by the v2.1 permission matrix.
Every bulk action is atomic, every administrative decision is reauthorized in
the mutation transaction, and all displayed or retained metadata is bounded and
privacy-safe.

## Current-state findings and decisions

- The v2 access workspace already lists own/global browser sessions and OAuth
  grants, revokes individual own records, and provides a superadmin-only OAuth
  bulk primitive. It does not yet implement browser-session bulk revocation,
  self agent bulk revocation, per-user administrative actions, or regular-admin
  all-services-managed authority.
- Existing global list routes admit only superadmins and existing individual
  administrative session revocation does not consume an operation-bound step-up
  proof. Administrative routes will use exact step-up operations and will
  consume the proof in the same generated-audit transaction as revocation.
- Browser sessions currently retain no authentication, device-family, or coarse
  source metadata. Migration 25 will add nullable bounded derived fields.
  Session creation will accept only the already-resolved canonical source and a
  length-bounded user-agent value, derive a conservative family label, and store
  only `/24` IPv4 or `/48` IPv6 output. Missing or unrecognized values become
  `Unknown`.
- The existing signed cursors are not bound to actor, scope, or filters.
  Access cursors will use a canonical context digest covering the viewer,
  resource, scope, and effective filters, so a cursor cannot cross an
  authorization or query boundary.
- Regular-admin visibility and mutation will be expressed as one complete grant
  predicate: the current owner is an active ordinary user, the grant reaches at
  least one currently active/published assigned service, and no reachable
  service lacks a current `service_admins` row for the actor. The same predicate
  will run inside the revocation transaction; no list result authorizes a later
  mutation.
- Row-bounded atomic updates are retained for v2.1 bulk revocation because the
  supported deployment is single-instance SQLite and existing token validation
  reads durable grant/session status on every authenticated request. Immutable
  generated audit remains in the same transaction.
- Operational rows will be retained by default. A bounded cleanup operation may
  delete only already-inactive rows after durable revocation evidence has been
  stored with owner, record, scope, and authorization facts sufficient for the
  idempotency window. Unknown or evidence-free deleted targets remain
  inaccessible rather than becoming no-change successes.
- Account Settings remains the `/access` workspace but will use the required
  Profile, Password and TOTP, Web sessions, and Agent connections grouping.
  Global and user-filtered administration reuse the same terminology and exact
  confirmation semantics.

## Slice plan

1. **Privacy-safe projections and self service:** migration and login metadata
   capture, conservative device/network derivation, context-bound pagination,
   self individual/all session and agent revocation, current-session cookie
   clearing, immediate enforcement, retained evidence, and positive/negative
   tests.
2. **Administrative authorization:** superadmin individual/per-user/global
   session and connection actions; qualifying regular-admin connection
   list/revoke; operation-bound step-up, confirmation, justification, generated
   audit, same-transaction role/owner/scope checks, uniform inaccessible
   results, race tests, and atomicity tests.
3. **Account and administration UX:** required settings groups, approved
   metadata, informational copy, user/global filters, individual and bulk
   confirmations, current-session warning/navigation, accessible status/focus,
   responsive behavior, and UI tests.
4. **Cleanup, documentation, and qualification:** bounded inactive-row cleanup
   with retained immutable evidence, access/operator documentation, supported
   scale tests, focused browser/OAuth/access tests, production build, full
   suite, OpenAPI conformance, readiness validation, release scan, acceptance
   evidence, and milestone status.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | this commit | Migration 25 stores only derived authentication/device/coarse-network metadata; local and OIDC session creation share conservative derivation; access cursors bind actor/scope/filters; self individual/all session and agent revocation is atomic and current-session bulk clears the cookie; 42 focused tests and production build passed | Operational cleanup evidence is deferred to slice 4 as planned. |
| 2 | pending | — | — | — |
| 3 | pending | — | — | — |
| 4 | pending | — | — | — |
