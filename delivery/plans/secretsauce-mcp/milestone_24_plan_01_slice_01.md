# M24 slice 01: Explicit email transport

## Goal and scope
Schema, bounded SMTP transport, durable state compatibility, acknowledgment tied to reviewed endpoint/mode/configuration and credential dependencies, current applied test, restored proposal, email mode/authentication controls and write-only values.
Observable outcome is fully exercisable through the authorized console and APIs. No upstream authority changes, unrelated milestones, new queues or live instance modifications.

## Dependencies and entry behavior
M22/M19/M20 complete. Owner enters Settings; read-only roles retain scoped views. Follow M24 functional requirements 1–9 and STATE-02/08, SECRES-07, UX3. Keep Settings review a complete atomic activation. Identity actions remain immediate and separate.

## State, permission and error contract
Persist encrypted revisions before success. Recheck active enrolled role, session, recent authentication where required, audit and dependency versions. None requires explicit current Owner acknowledgment; restore cannot inherit it. Retain safe non-secret input on failed saves; unknown outcomes require state lookup; stale reviews reject. Preserve independent SMTP deletion fences and all advanced exact values.

## Expected surfaces
consoleNotifications/consoleSettings/consoleStore/recovery schema and install; consoleSettingsPage/consolePeoplePage/consoleOperationsPage/consoleBackupsPage/presentation; corresponding tests, browser and Docker fixtures; deployment documentation and evidence. Investigate implementation details before edits; no invented product behavior.

## Validation
Real local valid and invalid TLS certificate/identity; plaintext with/without auth; default/legacy/unknown mode; Owner/recent/stale/unacknowledged negatives; queued dependency changes; credential deletion and disabled reset uniformity; migration/restart/backup/restore and isolated Docker recovery.
New external inputs have positive and negative tests. Focused and subsystem tests before commit; full canonical suite/build at milestone completion. Loopback escalation when required, no test weakening. Preserve existing test-results/.

## Acceptance and commit boundary
Meet the scoped requirements and map evidence in milestone acceptance. Commit this plan, owned implementation/tests/docs/evidence together only after required checks. Source hashes plus final commit establish reproducibility. Slice 01 transport can be tested/reverted independently; slice 02 completes common Settings presentation and milestone acceptance.

## Execution
Implemented; validation in evidence/qa/secretsauce-mcp/milestone24/slice-01.md. Exact commit recorded by root closeout.

Implementation commit: `f83dd1abc01738586ef357cdf0e304f9e430fc6a`. Root accepted the completed slice and milestone evidence.
