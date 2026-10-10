# M11 slice 02: Immediate credentials, access and lifecycle

Status: pending. Parent transaction `9a9f619b3901b256ea6ebe242211425b0c00f874`.

## Goal and outcome
Authorized write-only value changes and explicit access/lifecycle actions immediately affect admission and references while old dispatched responses stay protected.

## Scope and non-scope
Versioned encrypted values; dependency deletion; grant/revoke eligible users; disable/archive/unarchive; revocation generation fencing and admitted revision evidence. No role editor or consent flow.

## Dependencies
Slice 01 complete.

## Entry point and complete behavior
Authenticated target-specific commands → current role/dependency/audit checks → encrypted atomic change → synchronous runtime publication/invalidation.

## State transitions
Rotate version and invalidate affected service references; delete only unreferenced identity; remove grant revokes subject references; disable/archive removes runtime service and revokes references; unarchive Disabled; re-enable uses fresh review.

## Authorization
Current Owner/Administrator write only; roles confer no execution grant. Eligible active Owner/Administrator/Member identities explicitly selected. Legacy subject compatibility preserved without granting console authority.

## Validation, errors and recovery
Positive credential create/replace/delete, assignment, lifecycle; negative invalid value/id/target/confirmation, dependencies, stale grant snapshot; actual concurrent delayed response/rotate/revoke and body-await request; no old references/quota reset; old credential bytes protected. Sanitized failures preserve safe task context. Uncertain completion uses actor-scoped operation status and current state reload, never blind replay. Faults are classified before fixing.

## Implementation surfaces
src/consoleServices.ts, src/tokens.ts, src/responseTokenizer.ts, src/gateway.ts, tests/docs.

## Tests and commands
Focused `npx vitest run test/console-services.test.ts` (plus runtime suite in slice 02); related console suites. Slice 03 runs `npm test`, `npm run build`, browser harness. All new external fields positive/negative; meaningful failure and concurrency evidence recorded.

## Acceptance
Immediate changes block new dispatch; old completion cannot revive references; response protection uses admitted credentials; unaffected broker and limiter state persists.

## Commit boundary
One coherent slice commit includes this plan status, governing index status, production/tests/docs and owned evidence. Unrelated `test-results/` excluded. No milestone status/source authority changes. Implementation unknowns investigated within settled semantics; genuine authority blockers reported to root.
