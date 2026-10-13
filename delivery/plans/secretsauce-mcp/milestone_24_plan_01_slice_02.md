# M24 slice 02: Populated Settings lifecycle

## Goal and scope
All six sections current/pending/unsaved forms, changed-field in-use hints, no-op protection, explicit durable Save for later and Review changes, scoped discard, safe navigation, complete atomic review/apply/result, diagnostics/backup consistency and all required visual compositions.
Observable outcome is fully exercisable through the authorized console and APIs. No upstream authority changes, unrelated milestones, new queues or live instance modifications.

## Dependencies and entry behavior
Slice 01 committed. Owner enters Settings; read-only roles retain scoped views. Follow M24 functional requirements 1–9 and STATE-02/08, SECRES-07, UX3. Keep Settings review a complete atomic activation. Identity actions remain immediate and separate.

## State, permission and error contract
Persist encrypted revisions before success. Recheck active enrolled role, session, recent authentication where required, audit and dependency versions. None requires explicit current Owner acknowledgment; restore cannot inherit it. Retain safe non-secret input on failed saves; unknown outcomes require state lookup; stale reviews reject. Preserve independent SMTP deletion fences and all advanced exact values.

## Expected surfaces
consoleNotifications/consoleSettings/consoleStore/recovery schema and install; consoleSettingsPage/consolePeoplePage/consoleOperationsPage/consoleBackupsPage/presentation; corresponding tests, browser and Docker fixtures; deployment documentation and evidence. Investigate implementation details before edits; no invented product behavior.

## Validation
Direct API forbidden/stale/failed/unknown/no-op/scoped discard; cross-section atomicity; retained settings/operations/backups/SMTP deletion/friendly forms HTTPS browsers; all seven required matched screenshots, keyboard, 320 CSS px and 200% document/text-range reflow; npm test and npm run build.
New external inputs have positive and negative tests. Focused and subsystem tests before commit; full canonical suite/build at milestone completion. Loopback escalation when required, no test weakening. Preserve existing test-results/.

## Acceptance and commit boundary
Meet the scoped requirements and map evidence in milestone acceptance. Commit this plan, owned implementation/tests/docs/evidence together only after required checks. Source hashes plus final commit establish reproducibility. Slice 01 transport can be tested/reverted independently; slice 02 completes common Settings presentation and milestone acceptance.

## Execution
Pending.
