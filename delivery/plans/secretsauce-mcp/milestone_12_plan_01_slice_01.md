# M12 slice 01: People, invitations and external registry

Goal/outcome: Owner invite/reissue/revoke with 72-hour verifier-only proofs; restricted password/fresh TOTP enrollment; four-role people inspection, immediate role/disable/session/grant revoke with enrolled last-Owner continuity; explicit issuer+subject registration without console login or authmode activation.

Scope: the outcome above. Non-scope: later OAuth consent/activation, import, backups/restore, custom roles/groups, public signup, real external email. Dependencies: M10/M11; none before this slice.

Entry points: same-origin console GET inspection and explicit POST commands; protected host terminal only for host recovery. All mutation checks current actor, target, CSRF/origin, durable audit and action-bound five-minute proof when required. Pending capabilities grant only their selected operation. Encrypted state changes atomically and invalidates sessions/references before reporting success. Failed validation leaves safe non-secret context; uncertain completion returns operation ID for reconciliation without blind retry.

Implementation surfaces: ConsoleStore, new consolePeople module, consoleHttp, consoleServices eligibility/runtime binding, people tests. Investigation: preserve existing transport and store runtime callbacks outside encrypted snapshots; no framework replacement.

Positive/negative validation: role matrix direct calls; invalid/malformed email/role/target/pair; duplicate issuer/subject; preview immutable; wrong identity/purpose/generation/replay/expiry; concurrent completion and last-Owner races; recent proof expiry and audit failure. Commands: npm test -- test/console-people.test.ts test/console-recovery.test.ts test/console-notifications.test.ts test/console-people-http.test.ts (only existing slice files); npm run build. Related console suites after stabilizing; full npm test and actual browser evidence on slice 03.

Acceptance: every scoped behavior succeeds with permitted current authority and rejects forbidden/malformed/expired/replayed input; no secret/proof logging; last Owner remains safe; committed outcome matches authoritative contracts. Commit boundary includes this plan, behavior/tests/docs and validation evidence; excludes root workflow/status and test-results/. Resulting commit recorded by governing evidence through git history (no self-referential SHA).
