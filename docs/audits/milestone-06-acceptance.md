# Milestone 06 Enrollment, Recovery, And Self-Service Acceptance Review

## Review conclusion

Milestone 06 is complete within its assigned boundary. Local identities can
activate only through permanent-password policy validation and confirmed TOTP;
administrative reset primitives are authorization-guarded; users can replace
their own password or TOTP only after fresh current-factor verification; and a
terminal-only break-glass command can recover any existing account without
changing its UUID or role.

Milestone 07 remains responsible for invitation, user lifecycle, and guarded
administrative reset HTTP routes. Later grant/reference systems consume the
durable invalidation events introduced here.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Temporary credentials | Random bounded base64url values, configurable 1h–7d expiry, Argon2id-only persistence, single bootstrap/reset/CLI display, expired/reused/concurrent tests |
| Restricted isolation | Separate host-only secure cookie and rotating CSRF, purpose/state/epoch validation on every request, route-aware authentication, ordinary control/MCP rejection |
| Initial enrollment | Password re-entry and policy-version recheck, encrypted one-time TOTP response, atomic password/TOTP install, activation, epoch increment, revocation, invalidation, and audit |
| Password recovery | Temporary login yields only `password_change`; completion requires the preserved current TOTP and atomically installs the new password |
| TOTP recovery | Password-only recovery is eligible only after TOTP reset, yields only `totp_enrollment`, and never gives an administrator a seed |
| Self-service | Current password plus fresh current TOTP gates password replacement and two-step TOTP replacement; success revokes initiating and sibling sessions |
| Administrative primitives | Explicit authorization decision, target binding, superadmin capability/step-up rule, bounded justification, atomic reset/invalidation/audit |
| Break glass | No arguments, direct input/output terminals, UUID/email selection, exact confirmation, generated password, UUID/role preservation, authenticator erasure, OS actor audit, uniform failure |
| Secret handling | No passwords, TOTP codes/seeds, cookies, or opaque tokens in logs/audit; pending TOTP is envelope-encrypted and deleted on completion; no retrieval route |
| Abuse and concurrency | Direct-source/keyed-account windows plus password/TOTP inflight budgets; fresh-step replay protection; exactly one concurrent confirmation winner |

## Security review

- Authentication, purpose/state/epoch checks, CSRF, and policy validation occur
  before credential mutation. Temporary or restricted cookies cannot authorize
  ordinary control-plane or MCP operations.
- Enrollment commits credential installation, accepted TOTP step, activation,
  security-epoch increment, session revocation, durable invalidation, and audit
  in one immediate transaction. Failed confirmation leaves the prior state
  usable.
- Password reset preserves TOTP. TOTP reset erases the authenticator and returns
  no seed. Self-service TOTP replacement retains the old authenticator until the
  new seed is confirmed.
- Every successful credential change invalidates browser and restricted sessions.
  Durable hash-only invalidation records let later OAuth grant and gateway
  reference subsystems attach without weakening transactionality.
- Break glass is host authority, not a remote API. It does not accept a password,
  does not echo target identifiers on failure, and preserves the selected role
  while requiring complete enrollment again.
- TOTP remains replay-resistant but not phishing-resistant; operator guidance
  retains the HTTPS/origin and step-up cautions.

## Deliberate handoff

Milestone 07 may expose user creation, invitation, lifecycle, and reset routes
only through the guarded domain operations and transactional authorization
contracts. Milestones 13–15 must consume durable invalidation events for runtime
references and OAuth grants. No service-specific tool/profile behavior was
added.

## Validation

- production server and web build
- focused configuration, migration, credential lifecycle, restricted enrollment,
  self-service, bootstrap, break-glass, control contract, and documentation tests
- `npm run check:control-openapi`
- `git diff --check`
- full suite with required loopback and Unix-socket permission:
  **63 test files and 545 tests passed**

Accepted implementation commit: `613de32`.
