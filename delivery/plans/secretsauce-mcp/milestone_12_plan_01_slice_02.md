# M12 slice 02: Self, Owner and protected host recovery

Goal/outcome: Nonenumerating established-contact password reset retaining MFA; password plus fresh TOTP or unused recovery code factor replacement; Owner assistance with recent action-bound proof and trusted channel category; target restriction and immediate invalidation; issuer authority recheck; protected host CLI selected-Owner reenrollment after audit repair.

Scope: the outcome above. Non-scope: later OAuth consent/activation, import, backups/restore, custom roles/groups, public signup, real external email. Dependencies: M10/M11; slice 01.

Entry points: same-origin console GET inspection and explicit POST commands; protected host terminal only for host recovery. All mutation checks current actor, target, CSRF/origin, durable audit and action-bound five-minute proof when required. Pending capabilities grant only their selected operation. Encrypted state changes atomically and invalidates sessions/references before reporting success. Failed validation leaves safe non-secret context; uncertain completion returns operation ID for reconciliation without blind retry.

Implementation surfaces: consolePeople recovery operations, consoleStore factor eligibility and invalidation, consoleHttp public bounded recovery routes, consoleSetup host command, recovery tests/runbook. Investigation: preserve existing transport and store runtime callbacks outside encrypted snapshots; no framework replacement.

Positive/negative validation: password-only rejection; recovery-code race/replay; stale issuer; reset cannot replace factor; expiry/identity/purpose/generation/reissue; bounded target/source/global attempts; account disabled/restricted; session and grant invalidation; audit outage/repair and host proof reissue. Commands: npm test -- test/console-people.test.ts test/console-recovery.test.ts test/console-notifications.test.ts test/console-people-http.test.ts (only existing slice files); npm run build. Related console suites after stabilizing; full npm test and actual browser evidence on slice 03.

Acceptance: every scoped behavior succeeds with permitted current authority and rejects forbidden/malformed/expired/replayed input; no secret/proof logging; last Owner remains safe; committed outcome matches authoritative contracts. Commit boundary includes this plan, behavior/tests/docs and validation evidence; excludes root workflow/status and test-results/. Resulting commit recorded by governing evidence through git history (no self-referential SHA).
