# Milestone 05: Local Authentication, Sessions, And Step-Up

## Purpose and why

Provide secure local authentication for the control plane and high-risk browser actions. Local accounts require password plus mandatory TOTP, uniform failures, revocable server-side sessions, and transaction-bound step-up before administrative workflows can be exposed.

## Dependencies

- Milestone 04.

## PRD traceability

- Sections 8.2 and 9: local provider, password, TOTP, and enumeration resistance.
- Section 11: sessions and step-up.
- Sections 21.2, 25, 29.3, and 34.1/34.4: browser, rate-limit, secret-input, and invalidation acceptance.

## Scope

- Implement Argon2id password hashing/verification with stable Unicode normalization, minimum-length policy, no truncation, and compromised/context blocklist checks for new passwords.
- Encrypt local TOTP seeds, implement RFC 6238 enrollment primitives, narrow skew, confirmation, accepted-time-step replay prevention, and separate attempt limits.
- Implement uniform local login failure behavior and comparable verification work across nonexistent, ineligible, and invalid accounts.
- Implement opaque, random, server-side web sessions in Secure/HttpOnly cookies with role-specific absolute/inactivity defaults and immediate revocation.
- Implement global `five_minutes` and `always` password+TOTP step-up modes, including exact-transaction single-use nonces for `always`.
- Add account/security-epoch validation on every session use.
- Apply separate bounded limits by account/keyed identity and direct source for login, password, and TOTP work.

## Not in scope

- New-user enrollment workflow, temporary passwords, administrative resets, or self-service replacement.
- MCP OAuth authorization.
- Generic OIDC.
- Configuration UX for changing default lifetimes or rate limits.

## Required behavior and interfaces

- Only an active, fully enrolled local identity can obtain a normal web session.
- A successful login updates safe activity timestamps without revealing account existence on failure.
- Reducing configured session lifetimes affects existing sessions during validation; increases apply only to newly issued sessions.
- Step-up proof is bound to the initiating session, actor, permitted action/target, mode, and expiry.
- Accepted TOTP steps cannot be reused for login, enrollment confirmation, or step-up as applicable.

## Security, authorization, invalidation, and audit

- Authentication pages and responses are non-cacheable and never echo password/TOTP input.
- Session cookies are scoped to the control-plane origin and are never accepted by MCP routes.
- Successful/failed login and step-up events are sanitized and rate-limit aware.
- Logging out or security-epoch mismatch revokes the server-side session immediately.

## Tests

- Positive: password hash/verify, confirmed TOTP, both session lifetime classes, idle refresh, logout, five-minute step-up, and exact-transaction `always` step-up.
- Negative: nonexistent/wrong-password parity, admin-state ineligibility, malformed/oversized input, wrong/replayed/skewed TOTP, stolen/expired/revoked session, CSRF on login-adjacent mutations, and nonce reuse/wrong target.
- Boundary: passwords of 8/12/128+ characters as policy permits, lifetime limits, TOTP window edges, attempt/concurrency caps, and clock movement.
- Integration: real browser-cookie HTTP flow, persistence across process restart where designed, and immediate epoch revocation.

## Acceptance criteria

- Local password+TOTP login and revocable web sessions work with uniform public failures.
- Both step-up modes enforce their exact PRD semantics.
- Rate limits reject before excessive verification work without leaking account existence.
- Secret inputs are absent from logs, audits, API bodies, URLs, and caches.

## Planning handoff

Specify password/TOTP libraries and parameters, blocklist source/update approach, encrypted seed envelope, replay record lifecycle, session schema/cookie policy, trusted direct-source derivation, limiter bounds, step-up nonce shape, and deterministic time/concurrency tests.
