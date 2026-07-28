# v2.1 Milestone 05 Acceptance

## Result

Milestone 05 is accepted. A ready zero-user process emits one 192-bit initial
enrollment secret, retains only its Argon2 verifier in process memory, and
accepts it through the same neutral enrollment-code route used by temporary
credentials. Provisional profile, restricted session, CSRF, and encrypted TOTP
state remain process-owned and create no user or ordinary authority.

Final confirmation rechecks the empty installation and atomically creates one
unique active superadmin, local password, confirmed encrypted TOTP
authenticator, accepted TOTP step, bootstrap marker, and administrative audit
event. Completion consumes every provisional value, advances the application
to operational behavior, clears the restricted cookie, and returns to ordinary
login without creating a browser session.

## Security and failure evidence

- Bootstrap generation uses 24 cryptographically random bytes and one dedicated
  startup line. Restart, close, and successful completion invalidate it.
- Bootstrap and temporary codes both perform bounded Argon2 verification.
  Public failures and the successful restricted response disclose no user,
  role, purpose, credential kind, eligibility, or setup state.
- Restricted cookie and CSRF values are opaque and domain-separated; provisional
  authority cannot authenticate ordinary control, OAuth, MCP, or gateway paths.
- Invalid email/profile fields, weak password, invalid or replayed TOTP, expiry,
  restart, reuse, persistence/audit failure, and concurrency loss create no
  partial identity.
- An injected audit-construction failure rolls back all identity rows. A
  two-completion race produces exactly one complete superadmin and one neutral
  loser.
- Password, enrollment code, raw bootstrap secret, TOTP seed/code, cookies, and
  restricted tokens are absent from ordinary logs, API responses, persistence,
  audits, and release artifacts.

## UX and documentation evidence

- `/control/enroll` provides labeled email and **Enrollment code** fields,
  profile and password fields, then authenticator setup and fresh confirmation.
- Fields use email, name, new-password, and one-time-code autocomplete metadata;
  paste is not blocked; controls meet the existing touch/focus baseline.
- Step changes focus the heading, failures and copy outcomes use live regions,
  and sensitive inputs are cleared on the relevant failure/success boundary.
- A local SVG QR is rendered from the standard `otpauth:` URI without an
  external request. The manual key is hidden until explicit reveal and has a
  copy action.
- Completion redirects to `/control/login?enrollment=complete`, whose neutral
  login surface announces: **Enrollment complete. Sign in with your new
  credentials.**
- README and configuration guidance document the intentional log line,
  process-lifetime invalidation, browser ceremony, no-partial-user transaction,
  and platform-log custody requirements.

## Validation

- Focused identity/enrollment: 20 tests passed.
- Focused browser/setup/accessibility: 15 tests passed.
- Production build: passed.
- Full suite: 164 files and 1,057 tests passed.
- Generated control OpenAPI: current.
- v2.1 readiness validator: 14 artifacts passed.
- Release artifact scan: 641 closed-scope files passed.

The initial sandboxed release scan could not spawn `git` (`EPERM`); the required
escalated rerun passed. Docker remains unavailable on this host and is retained
as an integrated Milestone 10 release qualification gate.
