# M15 slice 01: Scoped operating evidence and retention

## Goal and observable outcome
Activity query/details/time actor service action result request-ID filters; shared service view; bounded filtered exports/access/config/version inventories; tamper verification and365-day Owner retention draft/review/apply with deletion impact and admitted background sweep.

## Scope and non-scope
Only the behavior above and tightly coupled tests/docs/evidence. No later milestone backup/restore implementation, product redesign, real LLM interoperability claim, service packs or upstream status/authority mutation.

## Dependencies and ordering
Existing accepted M13/M14; none within M15; governing milestone_15_plan_01.md and AGENTS/security/state/UX contracts apply.

## Entry point and end-to-end behavior
Console role-scoped API and visible Activity/Settings/service links lead to safe read/filter or scoped draft→review→explicit apply. Current permission is rechecked before mutation/export; unknown completion links operation status and never auto-retries. Slice03 exercises these actual entry points through HTTPS and disposable Docker.

## State transitions
Read preserves current state. Every sensitive action first admits durable audit. Reviewed scoped settings use current base/actor/fingerprint; only admitted committed settings publish. Retention preserves integrity/deletion attribution/security revocation evidence; limits preserve occupied counters. Browser state never stores secrets.

## Authorization
Member reads only own permitted activity, no global export/settings. Owner/Administrator/Auditor inspect non-secret authorized evidence; Owner alone writes limits/retention. Existing Administrator scanner editing remains. Audit outage/restricted sessions block every sensitive action and background work.

## Validation, failure and recovery
Strict bounded inputs, pagination/export/resource deadlines; no raw credentials/tokens/headers/cookies/bodies/proofs in errors/evidence. Storage/integrity failures fail closed with host repair and uncertain operation status. New external inputs have positive and negative cases.

## Implementation surfaces
ConsoleJournal, AuditSink, ConsoleStore/ConsoleServices, consoleHttp, consolePage/consolePeoplePage/consoleServicePage, new consoleEvidence/page, focused evidence/retention tests and operations docs.

## Tests and required commands
Filter types/unknown fields/time ranges/pagination/foreign Member actor/service/details; sanitized injected labels/query paths/secrets; inventory and export role/current-scope/bounds; audit outage/disk/permission/tamper; retention live revoke/unresolved operation preservation, crash checkpoint/restart and attributed deletion.
Focused `npm test -- <affected test files>` (pretest builds), related subsystem tests. Final slice additionally `npm test`, `npm run build`, actual browser/Docker scripts. If listen EPERM rerun identical command with loopback permission.

## Acceptance criteria
Milestone-required cases above pass; behavior/current role is exercised end-to-end; evidence has sanitized reproducible results and explicit pending M16 backup provider/NOT RUN realLLM boundary. No arbitrary50/100 hard cap or compliance claim.

## Commit boundary
One owned commit includes this plan, coupled code/tests/docs/evidence after required validation. Governing plan indexed status updated; exact resulting SHA reported to root externally. Exclude pre-existing test-results/ and upstream authority/status/goal files.

## Execution record
Implemented scoped activity, bounded exports, inventory/status reports, integrity verification,365day reviewed retention and hourly admitted sweep. Actual HTTPS keyboard/320px/role/outage validation PASS4groups; screenshots and browser-report.json under evidence/qa/secretsauce-mcp/milestone15/. Focused/related tests recorded in slice01-validation.md. Record and disk safety ceilings fail closed; signed redo recovery tested at prepare and chain-write interruption. Live revoke intents/unresolved starts retained. Parent d24d5f66832be2f44d7aef8ee8ccfde17e7537fb; exact slice SHA reported to root after commit.
