# Milestone 06: Browser Login, Sessions, And Logout

## Purpose and why

Provide the complete branded authentication shell for local and configured OIDC
users, harden browser/restricted session delivery, and make logout a visible
durable security mutation with honest failure behavior. Later abuse, recovery,
and session-management outcomes require this stable browser-session contract.

## Dependencies

- `05` — Consumes the unified enrollment route, a complete initial identity,
  and the rule that enrollment returns to login without authentication.

## PRD traceability

- `LOGIN-001`–`LOGIN-007` — local/OIDC login and uniform failures.
- `LOGOUT-001`–`LOGOUT-006` — durable logout, failure signal, and retry.
- `SESSION-001`–`SESSION-008` — cookie, hash, rotation, CSRF, expiry, delivery,
  metadata, and security-claim contracts.
- Sections 3–5, 8.6, 10.4, 11.4, 12.3–12.5, 14–17, 21.3, 21.5–21.6, 22, 23,
  and 25 — preserved identity behavior, lifecycle, privacy, UX, tests, and
  documentation.

## Scope

- Implement the branded accessible login route with one local email/password/
  six-digit-TOTP submission and distinct configured OIDC alternatives.
- Preserve uniform 401 content and comparable work across nonexistent,
  suspended, deactivated, incomplete, password-invalid, and TOTP-invalid local
  accounts.
- Validate and honor only same-origin relative post-login destinations.
- Issue a fresh random opaque server-side session after successful local or OIDC
  authentication; never adopt attacker or restricted-session identifiers.
- Enforce secure host-scoped cookies, domain-separated server-side hashes,
  session/CSRF rotation, same-origin and CSRF protections, inactivity/absolute
  expiry, security epochs, account state, and per-request revocation.
- Restrict session, CSRF, authorization-code, access-token, and refresh-token
  values to their designated no-store delivery channels.
- Add accessible **Log out** and **Settings** navigation on every authenticated
  view.
- Make logout revoke the current session and commit required audit before
  clearing the cookie.
- On persistence/audit uncertainty, keep the session/cookie active, return
  retryable 503, preserve the authenticated page and focus, show the exact
  sanitized failure message, and emit only the bounded operator event.
- Allow a later retry to commit revocation/audit exactly once and finish logout.

## Not in scope

- New OIDC-provider configuration, OIDC-owned MFA/failure policy, automatic
  suspension counters, proxy source trust, administrative recovery, or session/
  connection list and bulk-revocation UI.
- Forgot-password, recovery instructions, remember-me, passkeys, or claims that
  session hijacking is impossible.
- Rigid session binding to IP address or full user-agent/source display.

## Required behavior and interfaces

- Local login collects all three factors together and never reveals which
  factor or account condition failed.
- Configured OIDC actions appear without exposing disabled/internal provider
  configuration; their failures retain existing uniform behavior and limits.
- Browser and restricted sessions remain separate opaque server-side records;
  authentication/privilege transitions rotate identifiers.
- Every request enforces current expiry, epoch, account, and revocation state.
- CSRF proofs appear only in no-store responses establishing/refreshing a
  browser session and remain in page memory.
- Logout success is never rendered, announced, or redirected through until
  revocation and audit are confirmed committed.
- Failed logout leaves an operable authenticated page and retry path with
  `Retry-After`.

## Security, authorization, invalidation, and audit

- Session/cookie/CSRF/token/code values remain absent from unrelated responses,
  errors, durable browser storage, logs, audits, and telemetry.
- Logout audit and revocation are atomic; uncertainty cannot create false user
  assurance.
- The `logout_revocation_unavailable` event includes only timestamp,
  correlation identifier, and `persistence` or `audit` category.
- Session fixation, stolen restricted authority, CSRF, expired/revoked sessions,
  and security-epoch invalidation fail closed.
- OAuth and MCP remain stateless at the HTTP transport layer and do not use
  browser session transport state as gateway authority.

## Required tests and validation

- Positive browser/contract tests cover local login, configured OIDC
  initiation/callback, safe relative resume, session rotation, authenticated
  navigation, logout, and recovered logout retry.
- Negative tests cover all account/factor states, open redirects, attacker and
  restricted identifiers, missing/bad CSRF/origin, cookie scope, expiry,
  revoked/epoch-invalid sessions, and prohibited delivery channels.
- Inject persistence and audit failures independently during logout and prove
  503/`Retry-After`, cookie/session retention, exact accessible copy, focus
  preservation, bounded event content, and exactly-once retry success.
- Security tests compare public failure content/work and scan responses, browser
  storage, logs, audits, telemetry, and test artifacts for prohibited values.
- Browser/accessibility tests cover wide/narrow layout, keyboard, focus,
  labels/autocomplete, paste/autofill, announcements, OIDC alternatives, and
  logout presence on every authenticated view.
- Focused identity/browser tests, production build, full suite, OpenAPI
  conformance, and secret-artifact scan pass.

## Acceptance criteria

- [ ] Local and OIDC users can authenticate through one branded accessible
      login surface without account/factor disclosure.
- [ ] Browser and restricted sessions satisfy the complete fixation, CSRF,
      rotation, expiry, revocation, and designated-channel contracts.
- [ ] Logout is available everywhere and clears its cookie only after atomic
      revocation/audit success.
- [ ] Injected logout failures visibly retain the active session and complete
      correctly on one later retry.
- [ ] No prohibited bearer or proof value appears outside its designated
      delivery channel.
- [ ] Required browser, security, build, full-suite, OpenAPI, and scan gates
      pass.

## Planning handoff

Resolve login/session route schemas, comparable-work test method, session/CSRF
rotation points, cookie/SameSite behavior across OIDC, in-memory CSRF handling,
validated destination parser, logout transaction/idempotency, operator-event
sink, and browser failure-state fixtures. Likely slices are: login and hardened
session lifecycle; branded navigation/OIDC integration; then durable logout,
failure/retry UX, and channel-leakage qualification.
