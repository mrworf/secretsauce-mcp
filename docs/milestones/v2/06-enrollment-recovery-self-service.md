# Milestone 06: Enrollment, Recovery, And Self-Service

## Purpose and why

Complete the human credential lifecycle so new and existing local users can establish, recover, and replace authenticators without administrators ever reading TOTP seeds or persistent passwords.

## Dependencies

- Milestone 05.

## PRD traceability

- Sections 9.2–9.3 and 10.1–10.4/10.7: temporary credentials, enrollment, reset, self-service, and break glass.
- Section 17.1: enrollment states that block MCP.
- Sections 29.3, 33, and 34.1/34.4: secret handling, UX, and invalidation acceptance.

## Scope

- Implement cryptographically random, one-time-displayed temporary passwords with configurable bounded expiry defaulting to 72 hours.
- Implement restricted password-change and TOTP-enrollment sessions that cannot access ordinary control-plane or MCP functions.
- Add the complete new-local-user enrollment ceremony: permanent password selection, TOTP display/confirmation, activation, and temporary-credential invalidation.
- Add authorized administrative password and TOTP reset domain operations with required justification and correct session/grant/reference invalidation.
- Add self-service password change and TOTP replacement after current password+TOTP verification.
- Implement host-local break-glass reset for any existing account, preserving UUID/role, issuing a temporary password once, erasing TOTP, and recording OS actor metadata when available.
- Ensure password, TOTP, and email security changes increment the security epoch and terminate required state after successful completion.

## Not in scope

- User invitation and administrator profile/status UX, added in Milestone 07.
- Email or SMTP delivery, self-registration, recovery codes, passkeys, or password-reset email.
- System-wide password/TOTP events.
- MCP OAuth.

## Required behavior and interfaces

- Temporary passwords authorize only restricted enrollment/change flows and never MCP or full web sessions.
- TOTP seed/QR is displayed only to the enrolling user during the active ceremony and never retrievable afterward.
- Password reset preserves TOTP unless a separate TOTP reset is selected.
- TOTP reset never returns a new seed to an administrator.
- Successful self-service changes log out all sessions/grants/references, including the initiating session after the response completes.

## Security, authorization, invalidation, and audit

- Reset operations require the authorization and step-up context expected by later role workflows; no unguarded public reset endpoint exists.
- Temporary passwords, new passwords, TOTP seeds/codes, and QR payloads are excluded from audit and logs.
- Break-glass never accepts a user-selected password through command arguments.
- Audit records contain actor, target, justification, outcome, and invalidation counts without secret material.

## Tests

- Positive: first enrollment, temporary-password change, TOTP confirmation, self password change, self TOTP replacement, admin reset primitives, expiry handling, and break-glass reset.
- Negative: temporary password used for normal login/MCP, expired/reused temporary password, unconfirmed TOTP, wrong current authenticator, seed retrieval attempt, missing justification/step-up, CLI password argument, and target-not-found leakage.
- Boundary: one-time display behavior, temporary expiry edge, password-policy change during enrollment, and concurrent reset/enrollment.
- Integration: all sessions/grants/reference test doubles are invalidated atomically and failures leave prior authenticators usable.

## Acceptance criteria

- A bootstrapped or invited local identity can reach active status only after permanent password and confirmed TOTP.
- Administrative and self-service changes apply the required security-epoch invalidations.
- Break-glass safely recovers any existing account without weakening last-superadmin protections.
- No administrator can retrieve a user's TOTP seed or stored password.

## Planning handoff

Specify restricted-session records, temporary-password generation/display contract, enrollment transaction boundaries, QR rendering boundary, reset authorization hooks, invalidation service interface, CLI confirmation/input behavior, and failure rollback tests.
