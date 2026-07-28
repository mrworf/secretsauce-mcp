# Milestone 08: Recovery And Reactivation

## Purpose and why

Make every compromise-oriented recovery path reset both local authenticators and
route the user through restricted enrollment, while preserving the narrower
self-service password-change contract. This closes the lifecycle created by
automatic suspension and prevents direct reactivation with stale credentials.

## Dependencies

- `05` — Consumes the unified temporary-credential enrollment ceremony and
  restricted-session isolation.
- `07` — Consumes suspended state, qualifying-failure counters, complete
  user-capability invalidation, and final-superadmin suspension behavior.

## PRD traceability

- `RECOVER-001`–`RECOVER-007` — reset, reactivation, break glass, self-service,
  and system-wide behavior.
- Sections 3–7, 9, 10.3, 11.3, 12.2, 13.5, 15, 17.4–17.5, 21.4, 22, 23,
  and 25 — preserved behavior, actors, lifecycle, failures, security, UX,
  acceptance, tests, and documentation.

## Scope

- Change administrative password reset and every suspended-account reactivation
  to invalidate both password and TOTP, move the account to
  `enrollment_required`, issue one temporary password, and require the unified
  restricted ceremony.
- Prohibit direct `suspended` to `active` transition for every suspension
  origin.
- Keep expired temporary credentials in `enrollment_required` until an
  authorized administrator issues another reset.
- Update host-local superadmin break glass to preserve user UUID and
  superadmin role while resetting both authenticators, clearing suspension
  counters, reactivating through restricted enrollment, and revoking all user
  sessions, grants, tokens, and references.
- Preserve authenticated self-service password change with current TOTP
  verification and retained TOTP authenticator.
- Preserve system-wide forced password change with TOTP retained unless the
  separately authorized system-wide TOTP reset is selected.
- Update administrator/user UX and operator documentation for the changed
  recovery semantics and temporary-credential expiry.

## Not in scope

- Email delivery, forgot-password/recovery links, self-service recovery without
  a valid temporary credential, passkeys, recovery codes, or new authenticators.
- OIDC-provider password/MFA recovery, automatic suspension policy changes, or
  direct activation of a suspended account.
- A remote break-glass API or changing the last-superadmin manual mutation
  protections.

## Required behavior and interfaces

- Administrative reset and suspended reactivation return a one-time temporary
  password only through the existing approved one-time secret channel and leave
  the target unable to authenticate normally.
- Completing restricted enrollment establishes a new password and confirmed new
  TOTP before activation and clears qualifying-failure counters.
- Expiry, replay, invalid TOTP, audit/persistence failure, or incomplete
  enrollment leaves the account non-operational with old credentials invalid.
- No restricted reset/recovery session can authorize ordinary control, OAuth,
  or MCP behavior or become a normal browser session.
- Break glass targets only a superadmin under host-local authority and preserves
  immutable identity/role while invalidating all prior user authority.
- Self-service and system-wide password-only changes retain TOTP exactly as the
  PRD specifies.

## Security, authorization, invalidation, and audit

- Administrative reset/reactivation retains current role authorization,
  step-up, confirmation, justification, last-superadmin rules where applicable,
  and sanitized transactional audit.
- Break glass is host-local, unavailable to browser/control/OAuth/MCP, and
  revokes every user capability before the reset lifecycle can complete.
- Temporary passwords, new passwords, TOTP seeds/codes, sessions, tokens, and
  references never enter ordinary logs, audits, telemetry, errors, or browser
  persistence.
- Password/TOTP invalidation, state change, counter clearing, capability
  revocation, and required audit are atomic where the PRD requires one security
  transition.
- Uniform enrollment/login failures do not expose target state, expiry, reuse,
  or eligibility.

## Required tests and validation

- Positive tests cover administrative reset, every suspended reactivation
  origin, expired-code replacement, host break glass, self-service password
  change, and both system-wide forced-change variants.
- Negative tests cover direct activation, old password/TOTP reuse, expired/
  replayed temporary credentials, restricted-session privilege attempts,
  unauthorized/under-stepped administration, non-superadmin break-glass target,
  and persistence/audit failure.
- Persistence/concurrency tests prove atomic authenticator invalidation, state
  transition, counter clearing, capability revocation, identity/role
  preservation, and no partial recovery.
- Browser/accessibility tests cover neutral enrollment, administrative warning
  and one-time value, responsive restricted ceremony, exact status/failure
  behavior, and successful return to login.
- Process tests exercise host-local break glass and immediate rejection of all
  pre-reset sessions, grants, tokens, and references.
- Focused identity/recovery/browser tests, production build, full suite, OpenAPI
  conformance, and secret-artifact scan pass.

## Acceptance criteria

- [ ] Every administrative reset, suspended reactivation, and break-glass
      recovery invalidates both password and TOTP and requires restricted
      enrollment.
- [ ] No direct suspended-to-active transition or old credential/capability
      remains usable.
- [ ] Break glass preserves UUID/role while clearing counters and revoking all
      user authority.
- [ ] Self-service and system-wide password-only changes retain TOTP unless the
      separately authorized reset is selected.
- [ ] Failure and expiry never create a partially active account or ordinary
      recovery session.
- [ ] Required process, browser, build, full-suite, OpenAPI, and secret-scan
      gates pass.

## Planning handoff

Resolve state-transition reuse, one-time temporary-password channel and
idempotency, transaction boundaries, break-glass composition, global-reset
interaction, invalidation evidence, failure injection, and admin/user browser
copy. Likely slices are: administrative reset/reactivation domain changes;
host-local break glass and invalidation; then self/system variants, UX,
documentation, and complete lifecycle qualification.
