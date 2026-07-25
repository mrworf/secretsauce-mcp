# Milestone 18: Security Settings And Automation

## Purpose and why

Make approved security controls configurable within documented bounds and automate inactivity lifecycle without weakening local authentication, last-superadmin safety, or immediate revocation semantics.

## Dependencies

- Milestones 05–08 and 16.

## PRD traceability

- Sections 9.1, 10.5–10.6, 11, 12, and 25: password policy, global events, sessions, inactivity, and limits.
- Sections 21–22 and 30: settings UX/API and permissions.
- Sections 34.1/34.4 and 40: acceptance and settled security decisions.

## Scope

- Add superadmin-configurable bounded settings for password minimum/blocklist policy version, session/grant lifetimes, step-up mode, login/TOTP/API/search/backup limits, and security-job intervals.
- Keep password minimum default 12, configurable 8–128, with no composition rules or routine maximum age.
- On stricter password policy, evaluate the supplied password after successful verification and route noncompliant local users into restricted change flow; do not attempt hash inspection.
- Add optional inactivity suspension and optional delayed deactivation, both disabled by default, based on qualifying activity defined by the PRD.
- Add justified manual/automated reactivation behavior and last-active-superadmin exclusions.
- Add stepped-up system-wide password-change and TOTP-reset transactions applying to all local users, including superadmins.
- Apply required logout/grant/reference/security-epoch invalidation while leaving system-owned API keys unaffected.
- Add settings/security-event APIs, UX, job state, and sanitized audits.

## Not in scope

- Password composition requirements, routine expiration, recovery codes, passkeys, or email notification.
- Suspending/deactivating system-owned API keys based on human inactivity.
- Security dashboard presentation, added in Milestone 20.
- Allowing API keys to trigger global password/TOTP events.

## Required behavior and interfaces

- Settings changes validate hard safety bounds and use optimistic concurrency.
- Lower lifetime values affect existing sessions/grants at next validation; increases apply only to newly issued state.
- Background refresh is not qualifying activity; successful interactive login, MCP request, or management API operation authenticated as that human is. Use of a system-owned API key never updates its creator's activity.
- Automated suspension/deactivation records rule/version as actor context and never removes the final active superadmin.
- Global TOTP reset erases all local seeds and logs out the initiating superadmin after commit.

## Security, authorization, invalidation, and audit

- Only browser-authenticated superadmins with required step-up can change security settings or trigger global events.
- `system` keys may manage only explicitly permitted non-interactive global settings, never global authenticator events.
- High-impact changes require exact confirmation and justification.
- Audits record safe old/new setting values and affected counts, never passwords, hashes, TOTP seeds/codes, session IDs, or tokens.

## Tests

- Positive: bounded setting updates, stricter-password next-login route, lifetime reduction/increase semantics, qualifying activity, optional suspend/deactivate jobs, reactivation, and both global events.
- Negative: out-of-range/unknown settings, non-superadmin change, API-key global event, missing step-up/justification, background refresh as activity, final-superadmin automation, and stale settings write.
- Boundary: password 8/12/128 limits, lifetime/rate extremes, exact inactivity/deactivation cutoff, job retry/idempotency, and concurrent activity/job execution.
- Integration: global events revoke all required sessions/grants/references atomically and preserve API keys; initiating superadmin completes the required restricted flow.

## Acceptance criteria

- Security options are bounded, audited, superadmin-controlled, and default safely.
- Automatic suspension/deactivation are optional and cannot lose the final superadmin.
- Stricter password policy is enforced at the next successful verification without guessing from hashes.
- Global password/TOTP events apply to all local users and immediately invalidate required state.

## Planning handoff

Specify settings schema/defaults/hard ranges, policy-version comparison, activity-update write strategy, job lease/idempotency, exact cutoff calculations, global-event batch transaction/recovery, invalidation fanout, confirmation UX, and API-role allowlist for permitted settings.
