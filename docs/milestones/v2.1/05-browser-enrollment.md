# Milestone 05: Browser Enrollment And Initial Superadmin

## Purpose and why

Complete the first browser-first user outcome: an infrastructure operator can
use one process-lifetime secret from container logs to establish a provisional
restricted ceremony and atomically create exactly one complete superadmin.
This follows setup gating so bootstrap authority never exists while keys or
application dependencies are unready.

## Dependencies

- `03` — Consumes safe `enrollment_required` startup, public route gating,
  durable application/audit readiness, and the branded setup-to-auth surface.

## PRD traceability

- `ENROLL-001`–`ENROLL-013` — bootstrap secret, neutral enrollment, provisional
  state, atomic initial identity, races, and redirect behavior.
- Sections 4–5, 8.4–8.5, 9, 10.2, 11.2–11.3, 12.2 and 12.4, 14.1, 15,
  16.1 and 16.3, 17.1 and 17.4, 21.2 and 21.6, 22, 23, and 25 — principles,
  lifecycle, failures, privacy, UX, acceptance, tests, and documentation.
- Section 24 question 1 — provisional initial-enrollment representation.

## Scope

- Generate at least 128 bits of bootstrap randomness after configured setup when
  zero users exist; retain it only in application memory and display exactly one
  clearly labeled line per process start in the operator-controlled log sink.
- Invalidate the secret on restart or successful initial commit and erase the
  in-memory copy where the runtime permits.
- Expose one neutral **Enroll account** entry and one first step requesting email
  plus **Enrollment code** for both bootstrap and temporary-password flows.
- Verify bootstrap and temporary credentials with bounded rate limits,
  constant-time comparison where applicable, uniform public failures, and
  comparable work.
- Represent valid bootstrap submission as a provisional restricted enrollment
  that is not a user, has no platform role, expires with the restricted-session
  lifetime, and cannot authorize ordinary behavior.
- Reuse the existing password/TOTP enrollment domain operation and unified
  accessible browser ceremony.
- Atomically commit unique normalized email, name, password hash, encrypted
  confirmed TOTP, active superadmin role, bootstrap marker, and immutable
  sanitized audit event.
- Make racing completion produce exactly one complete superadmin or no user.
- Consume restricted authority on success and redirect to ordinary login without
  creating an authenticated browser session.

## Not in scope

- Ordinary local/OIDC login implementation, authenticated account settings,
  automatic suspension, administrative reset authorization, or session/grant
  management.
- Email delivery, forgot-password behavior, recovery instructions, self-service
  recovery without a temporary credential, passkeys, recovery codes, or other
  authenticator types.
- Periodic bootstrap-secret rotation inside one process lifetime or a dedicated
  initial-superadmin URL.

## Required behavior and interfaces

- Public responses never reveal whether the code was a bootstrap secret or
  temporary password, whether a user exists, setup/account state, expiry, reuse,
  or eligibility.
- Valid bootstrap submission creates only restricted provisional state; user
  creation occurs only at the final atomic commit.
- Missing/invalid fields, invalid password, invalid or replayed TOTP, expiry,
  restart, persistence/audit failure, and concurrency loss create no initial
  user.
- Name is requested and TOTP seed/QR shown only after code validation within
  the restricted ceremony.
- Successful completion displays the exact PRD success copy at login and
  requires ordinary email/password/TOTP authentication.
- Existing-account enrollment uses the same ceremony after temporary-credential
  validation without acquiring initial bootstrap authority.

## Security, authorization, invalidation, and audit

- The bootstrap secret is bearer authority only for provisional first
  enrollment and cannot authorize control, OAuth, MCP, or any other endpoint.
- The raw bootstrap value appears only in its one intentional log line and never
  in persistence, APIs, browser responses, audits, telemetry, errors, or other
  logs.
- Passwords, temporary passwords, TOTP seeds/codes, and enrollment codes remain
  absent from ordinary logs, audits, analytics, telemetry, browser persistence,
  and error reports.
- Restricted session and CSRF state use domain-separated hashes, rotate as
  required, and never become an ordinary authenticated session.
- Initial identity and audit commit together; audit failure rolls back the user.

## Required tests and validation

- Positive tests cover first startup, code validation, restricted ceremony,
  password/TOTP confirmation, one atomic superadmin, redirect to login, and
  ordinary subsequent credential proof.
- Negative contract/browser tests cover every external field, malformed input,
  invalid/expired/reused code, invalid password/TOTP, replay, expiry, restart,
  unauthorized restricted-session use, persistence/audit failure, and
  enumeration attempts.
- Concurrency tests prove exactly one racing completion and no partial identity.
- Restart/process tests prove one new line per start, old-secret invalidation,
  successful-consumption invalidation, and raw-secret absence outside the
  intentional line.
- Browser/accessibility tests cover keyboard, focus, labels, autocomplete,
  password-manager paste/autofill, responsive layout, status announcements, and
  setup-state-neutral wording.
- Focused identity/browser tests, production build, full suite, OpenAPI
  conformance, and secret-artifact scan pass.

## Acceptance criteria

- [ ] A fresh ready installation can create exactly one complete superadmin
      using only container logs and the browser.
- [ ] No failure or race produces a partial user or authenticated session.
- [ ] The bootstrap secret has the exact lifetime and single-log-line exposure
      allowed by the PRD.
- [ ] Initial and temporary-password enrollment share one neutral accessible
      ceremony without public eligibility disclosure.
- [ ] Successful enrollment redirects to login and ordinary credentials are
      required before authenticated access.
- [ ] Required concurrency, browser, build, full-suite, OpenAPI, and secret-scan
      gates pass.

## Planning handoff

Resolve provisional-state storage and transaction ownership, bootstrap memory
erasure boundaries, intentional log-sink API, restricted-session binding,
constant/comparable verification work, completion race constraint, TOTP replay
fixture, and exact browser route state machine. Likely slices are: bootstrap
authority and provisional session; atomic shared enrollment domain; then
browser UX, concurrency, restart, and leakage qualification.
