# M11 slice 01: Scoped draft/review/apply

Status: complete. Focused tests 24/24; build passed; evidence `evidence/qa/secretsauce-mcp/milestone11/slice01.md`. Commit identity recorded in Git history/root handoff. Parent transaction `9a9f619b3901b256ea6ebe242211425b0c00f874`.

## Goal and outcome
A current Owner or Administrator saves an incomplete service draft without execution effect, reviews a complete no-auth service and atomically activates it without restart.

## Scope and non-scope
Encrypted managed service/draft/review metadata; existing raw schema reuse, full lossless service projection; runtime publication; scoped instance name setting for reusable mixed-role permission enforcement. No identity administration or advanced editors.

## Dependencies
M10 identity/audit/store. First slice.

## Entry point and complete behavior
Authenticated management read/save/review/apply endpoints → current authorization and bounded strict input → dependency validation → encrypted commit → runtime map publication. Saved draft remains separate from applied service. Review carries sanitized current/proposed state, exact scope/base/dependencies and acknowledgments.

## State transitions
Draft → reviewed candidate → Active revision; reject incomplete/invalid/stale changes before publication. Owner-only instance changes cannot enter Administrator mixed drafts.

## Authorization
Current active Owner/Administrator writes; Auditor reads; Member no configuration view. Origin/CSRF and mandatory audit enforced; recheck permissions/base/dependencies at apply.

## Validation, errors and recovery
Positive no-auth first activation and every destination/placement representation; negative unknown fields, secret/source injection, invalid URL/regex/policy, stale base, role demotion, mixed Owner fields; injected preparation failure leaves applied revision; lost response operation status. Sanitized failures preserve safe task context. Uncertain completion uses actor-scoped operation status and current state reload, never blind replay. Faults are classified before fixing.

## Implementation surfaces
src/consoleServices.ts, src/config.ts, src/consoleStore.ts, src/consoleHttp.ts, src/server.ts, tests and service management docs.

## Tests and commands
Focused `npx vitest run test/console-services.test.ts` (plus runtime suite in slice 02); related console suites. Slice 03 runs `npm test`, `npm run build`, browser harness. All new external fields positive/negative; meaningful failure and concurrency evidence recorded.

## Acceptance
A no-auth service can be activated through the API and used immediately; drafts cannot execute; review is sanitized and exact; no partial stale/forbidden/preparation mutation.

## Commit boundary
One coherent slice commit includes this plan status, governing index status, production/tests/docs and owned evidence. Unrelated `test-results/` excluded. No milestone status/source authority changes. Implementation unknowns investigated within settled semantics; genuine authority blockers reported to root.
