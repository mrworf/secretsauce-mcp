# Milestone 05 Local Authentication Acceptance Review

## Review conclusion

Milestone 05 is complete within its assigned boundary. The implementation
authenticates already active and fully configured local identities with a
password plus mandatory TOTP, issues revocable server-side browser sessions,
and enforces both fixed five-minute and exact-transaction `always` step-up.

No enrollment, temporary-password, reset, recovery, replacement, administrative
identity-management, generic OIDC, or multi-user MCP OAuth workflow was added.
Those remain assigned to later milestones, beginning with Milestone 06.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Password policy and verification | NFKC normalization, code-point/byte bounds, bundled/operator/context blocklists, fixed Argon2id parameters, bounded encoding parser, dummy verification path, positive/negative/boundary tests |
| Encrypted mandatory TOTP | RFC 6238 six-digit/30-second implementation, fixed ±1 window, AES-256-GCM envelope with wrapped DEK and bound metadata, confirmation primitives, plaintext-buffer cleanup tests |
| Replay prevention | Unique `(user_id,time_step)` persistence record consumed in the same immediate transaction as login or step-up; sequential and concurrent replay tests |
| Uniform local login | Active/configured eligibility checked without public distinction; nonexistent, inactive, incomplete, wrong-password, wrong-TOTP, corrupt-envelope, rate, concurrency, audit-failure, and persistence-failure cases |
| Revocable browser sessions | Independent random session/CSRF values stored only as domain-separated hashes; strict host cookie, no-store responses, CSRF rotation, absolute/idle enforcement, logout and epoch revocation |
| Lifetime semantics | Role-class defaults and bounds; validation takes the smaller of issued/current lifetime; reduction and non-extension tests for existing sessions |
| Five-minute step-up | Current-user password plus fresh TOTP sets fixed session elevation; expiry, replay, session, and epoch tests |
| Always step-up | Hash-only proof bound to session/user/mode/method/route/targets/version/idempotency/body/epochs/expiry and consumed with mutation plus audit in one transaction |
| Abuse controls | Separate keyed login/password/TOTP windows and password/TOTP global/source concurrency budgets using the direct socket source |
| Lifecycle and readiness | Production start/restart, idempotent double-close, in-memory key destruction, and sanitized `checks.identity` ready/unavailable behavior |
| Operator guidance | `docs/local-authentication.md` documents stable read-only keys, writable database state, limits, cookies/origin, lifetime reductions, phishing limitations, step-up, and the M06 handoff |

## Security review

- Identity key files are closed, regular, non-linked mode-`0400` files. Root,
  session-HMAC, and idempotency keys must be distinct; configuration failure
  does not echo their paths or values.
- Password, TOTP, seed, cookie, CSRF, and raw proof values are excluded from
  durable audit fields and structured request logs. Session, CSRF, and proof
  persistence contains keyed hashes rather than bearer values.
- Authentication performs bounded parsing and rate/concurrency admission before
  expensive password work. Invalid and ineligible identities receive the same
  public authentication failure and comparable password/TOTP verification work.
- Browser authentication is isolated to the control listener. The cookie is
  host-only, secure, HTTP-only, strict-same-site, and never accepted by MCP.
- Every session use rechecks status, complete authenticator state, absolute and
  idle expiry, revocation, and user/global security epochs.
- An `always` proof cannot authorize a changed method, registered route, target
  set, body, expected version, idempotency key, session, user, or epoch. A
  protected handler cannot report success without transactional consumption.
- API keys cannot request or satisfy password-plus-TOTP human step-up.
- Health reports only stable readiness names and states. Injected identity
  readiness failures do not expose internal error text.

## Deliberate handoff

Milestone 06 must add the restricted enrollment and recovery ceremonies. It
must activate the bootstrap superadmin only when permanent-password policy and
TOTP confirmation commit together, preserve the cross-purpose accepted-step
replay invariant, and use the existing session/epoch invalidation primitives.

Milestone 07 may expose administrative lifecycle mutations only through the
existing authorization and transactional step-up handles. Milestone 14 must
keep MCP OAuth independent from control cookies and administrative identities.

## Validation

- `npm run build:server`
- focused password, TOTP, authentication, browser-session, control-contract,
  step-up, readiness, and documentation tests
- `npm run check:control-openapi`
- `git diff --check`
- unchanged `npm test` with required loopback and Unix-socket permission:
  **60 test files and 527 tests passed**
