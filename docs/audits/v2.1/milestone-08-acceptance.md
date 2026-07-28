# v2.1 Milestone 08 Acceptance

## Result

Milestone 08 is accepted. Administrative password reset, suspended-account
reactivation, deactivated-account restoration, and host-local superadmin break
glass all converge on the restricted initial-enrollment ceremony. Compromise
recovery removes both local authenticators, clears qualifying failures, revokes
prior authority, moves the existing UUID to `enrollment_required`, and returns
one expiring temporary password through the approved one-time channel.

Direct `suspended` to `active` transition is no longer legal. Reactivation is an
idempotent one-time mutation that clears manual or automatic suspension
metadata and cannot replay its plaintext temporary value.

## Security and persistence evidence

- Administrative reset/reactivation atomically delete password, TOTP, pending
  TOTP, accepted TOTP steps, and qualifying failures; revoke browser and
  restricted sessions; advance the user security epoch; trigger durable OAuth
  grant/family/token revocation; publish invalidation; and commit sanitized
  audit and idempotency state.
- Old password/TOTP pairs fail after reset. Temporary authentication creates
  only a restricted enrollment session, and activation requires both a new
  password and confirmed new TOTP.
- Expired temporary credentials leave the identity non-operational. An
  authorized replacement value restarts the same enrollment ceremony without
  restoring old credentials.
- Host-local break glass accepts only a current superadmin selected by UUID or
  normalized email. Non-superadmin and unknown targets fail identically.
  Recovery preserves UUID and superadmin role while clearing suspension state,
  credentials, counters, sessions, and OAuth authority across process restart.
- Authenticated self-service password change continues to verify and retain the
  current TOTP. The system-wide password-change event also retains TOTP; only
  the separately authorized system-wide TOTP-reset event erases it.
- Administrative dialogs warn that password and authenticator are both erased.
  One-time output names its expiry and is never placed in browser persistence,
  URLs, logs, audits, or ordinary response history.

## Validation

- Focused recovery/domain/route/browser/global-event suite: 42 distinct tests
  passed.
- Focused contention-sensitive authentication and step-up suite: 15 tests
  passed.
- Production build: passed.
- Full suite: 167 files and 1,075 tests passed.
- Generated control OpenAPI: current.
- v2.1 readiness validator: 14 artifacts passed.
- Release artifact scan: passed for 650 closed-scope files.

The production build retains the existing advisory for a JavaScript chunk over
500 kB. The first full-suite run hit the sandbox's listener restriction and was
rerun with the required loopback/socket permission. Two Argon2-heavy tests use
explicit 15-second budgets to remain stable under full-suite contention. A
released-port race in the application shutdown test was replaced with a
kernel-assigned port held by the intended blocker. The release scan required
the sandbox's approved Git process permission; the unchanged scanner then
passed.
