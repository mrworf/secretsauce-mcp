# Milestone 08: Recovery And Reactivation

## Outcome

Every compromise-oriented administrative or host-local recovery invalidates
both local authenticators and returns the existing identity to restricted
enrollment with one one-time temporary password. No suspended identity can
become active with stale credentials, while authenticated self-service and
system-wide password-only changes retain TOTP exactly where specified.

## Current-state findings and decisions

- Administrative password reset currently issues a `password_reset` temporary
  credential, retains TOTP, and leaves account status unchanged. It must instead
  reuse the complete initial-enrollment state transition and erase both
  authenticators.
- The current reactivate route performs a direct suspended-to-active transition,
  has no idempotency record, and cannot return a one-time value. It will become
  an idempotent one-time mutation with the same reset-to-enrollment transaction
  as administrative reset.
- Deactivated restore enrollment and host-local break glass already have most
  of the required reset shape. Their shared transaction semantics will be
  aligned rather than creating another enrollment ceremony.
- Break glass currently accepts any role by UUID or normalized email. The
  service will enforce a current superadmin target inside the persistence
  boundary and keep its uniform command failure.
- OAuth grants/families/tokens are revoked by the user security-epoch trigger;
  browser/restricted sessions and durable invalidation records remain explicit
  transaction members. Runtime references lose usable authority because every
  subsequent MCP request authenticates independently.
- The existing `password_reset` restricted path is retained only for
  authenticated self-service/system-wide password-only behavior. Administrative
  recovery will issue `initial_enrollment` credentials and use the neutral
  password-plus-new-TOTP ceremony.

## Slice plan

1. **Administrative reset and suspended reactivation:** one atomic
   reset-to-enrollment repository primitive, both-authenticator invalidation,
   counter clearing, one-time/idempotent reactivation API, direct-transition
   prohibition, capability-revocation evidence, and positive/negative tests.
2. **Host-local break glass:** superadmin-only target enforcement, exact
   identity/role preservation, complete credential/capability/counter
   invalidation, uniform failures, and real command/restart tests.
3. **Recovery UX and preservation contracts:** neutral administrative warning
   and one-time result, expired/replayed temporary behavior, restricted-session
   privilege denial, successful enrollment clearing, explicit self-service and
   system-wide password-only TOTP preservation, and operator documentation.
4. **Qualification:** focused recovery/browser/process tests, production build,
   full suite, OpenAPI conformance, readiness validation, release scan,
   acceptance evidence, and milestone status.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | pending | — | — | — |
| 2 | pending | — | — | — |
| 3 | pending | — | — | — |
| 4 | pending | — | — | — |
