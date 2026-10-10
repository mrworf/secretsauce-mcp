# M15 slice 02: Effective live limits and truthful health

## Goal and observable outcome
Owner scoped limits draft/review/apply for request/response/time/concurrency/reference/denial/auth/scanner plus added regex-worker bounds; units/usage/capacity results; role-safe gateway/storage/audit/scanner/SMTP/backup health and bounded public status.

## Scope and non-scope
Only the behavior above and tightly coupled tests/docs/evidence. No later milestone backup/restore implementation, product redesign, real LLM interoperability claim, service packs or upstream status/authority mutation.

## Dependencies and ordering
Existing accepted M13/M14; prior M15 slices; governing milestone_15_plan_01.md and AGENTS/security/state/UX contracts apply.

## Entry point and end-to-end behavior
Console role-scoped API and visible Activity/Settings/service links lead to safe read/filter or scoped draft→review→explicit apply. Current permission is rechecked before mutation/export; unknown completion links operation status and never auto-retries. Slice03 exercises these actual entry points through HTTPS and disposable Docker.

## State transitions
Read preserves current state. Every sensitive action first admits durable audit. Reviewed scoped settings use current base/actor/fingerprint; only admitted committed settings publish. Retention preserves integrity/deletion attribution/security revocation evidence; limits preserve occupied counters. Browser state never stores secrets.

## Authorization
Member reads only own permitted activity, no global export/settings. Owner/Administrator/Auditor inspect non-secret authorized evidence; Owner alone writes limits/retention. Existing Administrator scanner editing remains. Audit outage/restricted sessions block every sensitive action and background work.

## Validation, failure and recovery
Strict bounded inputs, pagination/export/resource deadlines; no raw credentials/tokens/headers/cookies/bodies/proofs in errors/evidence. Storage/integrity failures fail closed with host repair and uncertain operation status. New external inputs have positive and negative cases.

## Implementation surfaces
Live limiter/denial/scanner/token/OAuth/metadata modules, ConsoleStore/ConsoleServices, server runtime bindings, new consoleOperations/page, focused limits/health tests.

## Tests and required commands
Every numeric/group input valid/invalid/unknown/combinations; stale role/base/review; concurrent lowering below occupied counters preserves active work and blocks new allocation; noisy identity containment; scanner regex bounds/timeout/termination; missing key/storage/audit/SMTP/capacity and pending backup; forged proxy headers do not confer trust.
Focused `npm test -- <affected test files>` (pretest builds), related subsystem tests. Final slice additionally `npm test`, `npm run build`, actual browser/Docker scripts. If listen EPERM rerun identical command with loopback permission.

## Acceptance criteria
Milestone-required cases above pass; behavior/current role is exercised end-to-end; evidence has sanitized reproducible results and explicit pending M16 backup provider/NOT RUN realLLM boundary. No arbitrary50/100 hard cap or compliance claim.

## Commit boundary
One owned commit includes this plan, coupled code/tests/docs/evidence after required validation. Governing plan indexed status updated; exact resulting SHA reported to root externally. Exclude pre-existing test-results/ and upstream authority/status/goal files.

## Execution record
Pending implementation.
