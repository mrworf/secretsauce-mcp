# v2.1 Milestone 06 Acceptance

## Result

Milestone 06 is accepted. Local password/TOTP and configured OIDC identities use
one branded login route. Local authentication collects all three factors in one
labeled submission, preserves the existing uniform failure contract, clears
secret fields, and returns only a newly issued server-side browser session.
Configured OIDC providers appear as distinct alternatives without disclosing
disabled or internal configuration.

Post-login navigation accepts only canonical `/control`-rooted relative
destinations. Authority forms, cross-origin URLs, backslashes, control
characters, wrong roots, and routing-changing normalization are rejected before
authentication results can honor them.

## Session and security evidence

- Browser sessions retain fresh opaque identifiers, domain-separated hash-only
  persistence, strict host cookies, rotating in-memory CSRF proofs, inactivity
  and absolute expiry, account-state and security-epoch validation, per-request
  revocation checks, and restart continuity under stable key files.
- Restricted enrollment authority remains isolated from ordinary browser
  sessions, OAuth, MCP, and gateway authority. Successful authentication never
  adopts caller-provided or restricted-session identifiers.
- Existing negative suites cover nonexistent, suspended, incomplete,
  wrong-password, wrong-TOTP, corrupt-authenticator, malformed/oversized input,
  stale/missing CSRF, bad origin, expiry, revocation, epoch invalidation, and
  prohibited token delivery.
- Password, TOTP, session, CSRF, authorization-code, access-token, and refresh
  values remain absent from unrelated errors, logs, audits, telemetry, durable
  browser storage, and committed release artifacts.

## Durable logout evidence

- Settings and Log out are present through the authenticated application shell.
  Logout refreshes the in-memory CSRF proof before submitting revocation.
- Successful logout atomically commits session revocation and required audit,
  then clears the host-scoped cookie and navigates to login.
- Independently injected audit and persistence uncertainty returns 503 with
  `Retry-After: 3`, does not send a clearing cookie, retains the authenticated
  page, restores focus to Log out, and leaves a working retry.
- The exact accessible failure is: **Logout could not be completed. This
  session is still active. Try again.**
- Each uncertainty emits only timestamp, level, event, correlation identifier,
  and the bounded `audit` or `persistence` category. A later retry completes
  revocation without a false prior success.

## Validation

- Focused authentication/OIDC/session/browser UI: 30 tests passed.
- Hardened browser-session integration: 5 tests passed.
- Production build: passed.
- Full suite: 165 files and 1,061 tests passed.
- Generated control OpenAPI: current.
- v2.1 readiness validator: 14 artifacts passed.
- Release artifact scan: passed against the committed closed scope.

The production build retains the existing advisory for a JavaScript chunk over
500 kB. Docker remains unavailable on this host and is retained as an integrated
Milestone 10 release qualification gate.
