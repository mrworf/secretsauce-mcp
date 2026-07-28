# Milestone 05: Browser Enrollment And Initial Superadmin

## Outcome

A ready installation with zero users emits one process-lifetime initial
enrollment secret, accepts it through the same neutral browser entry used by
temporary credentials, and creates exactly one complete active superadmin in a
single audited transaction. No provisional attempt creates a user or grants
ordinary authority.

## Governing contracts

- PRD `ENROLL-001`–`ENROLL-013` and Acceptance 21.2.
- Milestone
  [`05-browser-enrollment.md`](../../milestones/v2.1/05-browser-enrollment.md).
- Architecture [`ux.md`](../../architecture/v2.1/ux.md) unified enrollment and
  the existing identity data/API contracts.
- Milestone 03 setup-to-enrollment gating.

## Current-state findings

- Temporary-password enrollment already provides bounded Argon2 verification,
  domain-separated restricted-session and CSRF hashes, password policy, TOTP
  encryption and replay detection, atomic activation/audit, and uniform public
  errors.
- That path requires an existing invited or enrollment-required user. The
  legacy host bootstrap CLI therefore creates a partial superadmin before the
  browser ceremony and cannot satisfy the v2.1 provisional contract.
- Setup lifecycle already establishes the exact safe boundary: configured vault,
  durable persistence/audit readiness, and a zero-user count before starting
  the control surface.
- The setup page links to `/control/enroll`, but the production web bundle has
  no enrollment route or page.

## Decisions

- `InitialEnrollmentAuthority` is process-owned and memory-only. It owns an
  Argon2 bootstrap verifier, one current secret lifetime, hashed restricted
  session and CSRF values, provisional profile, and pending encrypted TOTP
  envelope. Restart abandons the entire authority.
- Bootstrap verification uses the same attempt and in-flight limits and the
  same password-hash verification primitive as temporary credentials.
  Rejections remain one neutral contract.
- A provisional session carries a freshly generated UUID only as an internal
  transaction binding. It is not persisted, is not a user, and is accepted only
  by the restricted enrollment routes.
- Initial and temporary paths share `LocalEnrollmentService` password policy,
  TOTP creation/decryption/verification, route contracts, cookie, CSRF, and
  completion ceremony. Branching is internal and never returned as credential
  type or setup state.
- The final initial transaction rechecks zero users and absent bootstrap marker,
  inserts the active superadmin, local password and confirmed TOTP, accepted
  step, bootstrap marker, and audit together. A second completion loses without
  partial state.
- Startup writes the raw bootstrap secret through a dedicated one-line sink,
  immediately clears the printable buffer after the write, and retains only
  the Argon2 verifier. Successful commit closes the authority.

## Slice plan

### Slice 1: Process-lifetime bootstrap and provisional restricted authority

**Contract:** generate and intentionally display one bootstrap secret only
after ready zero-user startup; accept it with email through the neutral
enrollment login without creating persistence or ordinary authority.

**Evidence:** entropy/encoding, exact one-line output, zero-user gating,
restart/close invalidation, success and invalid inputs, bounded comparable
verification, cookie/CSRF restriction, and absence from persistence/responses.

### Slice 2: Shared password/TOTP ceremony and atomic first identity

**Contract:** collect the provisional profile, run the existing policy and TOTP
domain operations, and atomically commit exactly one complete superadmin.

**Evidence:** successful credential proof after explicit login; missing,
malformed, weak, invalid/replayed/expired inputs; persistence/audit failure;
completion races; no partial user, role, authenticator, marker, session, or
audit.

### Slice 3: Neutral accessible browser workflow and qualification

**Contract:** `/control/enroll` provides the unified three-step ceremony for
bootstrap and temporary credentials and returns to login without signing in.

**Evidence:** labels, autocomplete, keyboard/focus/status behavior, paste,
responsive rendering, exact success copy, safe failure recovery, browser route
tests, process/restart leakage tests, production build, full suite, OpenAPI,
readiness, and release scan.

## Cross-slice constraints

- The raw bootstrap secret may appear only in its intentional startup line.
- Provisional authority cannot authenticate control, OAuth, MCP, or gateway
  behavior and never becomes a browser session.
- Every new external field has positive and negative tests.
- Each completed slice is independently testable and receives one concise
  commit; full-suite gates run at milestone closure.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | this commit | 6/6 authority tests plus 10/10 existing enrollment tests; 192-bit secret with one dedicated startup line; Argon2 verifier; bounded memory-only provisional sessions; restart/close invalidation; domain-separated cookie and CSRF hashes; neutral enrollment-code route; setup gating admits only the enrollment surface | Full production-process log capture and post-commit lifecycle advancement remain Slice 3 qualification. |
| 2 | completed | this commit | 10/10 initial-authority tests, 10/10 established enrollment tests, 3/3 lifecycle tests, and server build; in-memory profile/TOTP pending state; shared password policy, encrypted TOTP, and replay verifier; one transaction creates unique active superadmin, local credentials, accepted step, bootstrap marker, and audit; ordinary login proof; exact one-winner race; invalid profile/password/TOTP, expiry, and injected audit rollback leave zero users | Ordinary maintenance timers remain stopped until the initial commit; later abuse-control slices will add an explicit post-enrollment job-start boundary. |
| 3 | pending | — | — | — |
