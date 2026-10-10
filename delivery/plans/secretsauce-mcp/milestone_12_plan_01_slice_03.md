# M12 slice 03: Optional delivery and completed role/account UI

Goal/outcome: Owner-only SMTP scoped encrypted draft/review/apply/test, protected write-only credentials and bounded safe delivery states; manual one-time fragment links; role-sensitive Services/People/Activity/Settings/My account/client shell; enrollment/recovery keyboard flows and 320px evidence.

Scope: the outcome above. Non-scope: later OAuth consent/activation, import, backups/restore, custom roles/groups, public signup, real external email. Dependencies: M10/M11; slice 02.

Entry points: same-origin console GET inspection and explicit POST commands; protected host terminal only for host recovery. All mutation checks current actor, target, CSRF/origin, durable audit and action-bound five-minute proof when required. Pending capabilities grant only their selected operation. Encrypted state changes atomically and invalidates sessions/references before reporting success. Failed validation leaves safe non-secret context; uncertain completion returns operation ID for reconciliation without blind retry.

Implementation surfaces: consoleNotifications transport, consolePeoplePage UI, consoleHttp, consolePage role shell, SMTP/HTTP tests, browser harness, operator docs and acceptance evidence. Investigation: preserve existing transport and store runtime callbacks outside encrypted snapshots; no framework replacement.

Positive/negative validation: malformed host/address/port/credential/settings; unsafe SMTP errors/timeouts/failure; stale draft/actor/recent proof; synthetic local TLS SMTP and manual fallback; direct HTTP role matrix; browser proof history removal/non-persistent storage; keyboard seed/code/recovery and narrow reflow. Commands: npm test -- test/console-people.test.ts test/console-recovery.test.ts test/console-notifications.test.ts test/console-people-http.test.ts (only existing slice files); npm run build. Related console suites after stabilizing; full npm test and actual browser evidence on slice 03.

Acceptance: every scoped behavior succeeds with permitted current authority and rejects forbidden/malformed/expired/replayed input; no secret/proof logging; last Owner remains safe; committed outcome matches authoritative contracts. Commit boundary includes this plan, behavior/tests/docs and validation evidence; excludes root workflow/status and test-results/. Resulting commit recorded by governing evidence through git history (no self-referential SHA).
