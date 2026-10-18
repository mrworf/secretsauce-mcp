# M35: Grouped service review

## Outcome
Compare only changed values in aligned section pairs and inspect the complete sanitized proposal in a separate tab without changing review authority.

## Delivery-goal context
Product secretsauce-mcp; status delivery/milestones/secretsauce-mcp/status.yaml. Fixed goal M35–36; this transaction only M35. Source d84ac2265bd6c055a6da5edfe5f3d586137d30e9; planning 209e0fdef777ab9b31f1014bc335868ee9cbd44c. Parent b90856e0d22a884dfc42a35aea35a66facb61a39. New autonomous transaction; approved UX-DESIGN-005.

## Governing contracts
Milestone35 all five acceptance clauses; REC-RM-027, CONFIG-03/POLICY-04, UX-IN17/R07/V07/A08/C54–58, AGENTS.md. Approved feedback004 screenshots.

## Findings and decisions
Existing review endpoint provides sanitized immutable current/proposed plus scope, grants, disruption and opaque review binding. Existing inline acknowledgment/apply remains until M36. Presentation helpers are delivered in same-origin script; pure comparison helpers will be tested independently and reused in browser. Match unique stable list IDs only; positional comparison for anonymous lists with explicit ordering information. Preserve all own properties and typed literals.

## Scope
Only service review presentation. Exclude M36 approval dialog/TLS wording, global Settings, transport, schema, credential lifecycle, deployment. Existing test-results/ is unrelated and excluded.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit | Evidence |
|---|---|---|---|---|---|---|
|01|milestone_35_plan_01_slice_01.md|Grouped changes and local tabs|none|complete|7816f7ccd002089e00043378bd04deec83529a3d|slice01 browser +5 focused tests|
|02|milestone_35_plan_01_slice_02.md|Complete grouped new settings|01|complete|4ccf40f9d5d2e826c229aa959a74a75a0e1ab3f0|final browser +765 tests/build|

## Cross-slice concerns
No storage/API migration. Retain server authorization, sanitized read model, review identity/dependencies and exact exceptions. No new network calls on tabs. Immediate credential/access metadata stays outside pending changes. Existing audit and atomic publication untouched. Synthetic local HTTPS only; no external clients/live instance.

## Completion gate
Focused typed/identity/order/own-property tests; actual HTTPS desktop/narrow/text200 and keyboard/read-only/stale/role/secret checks; compare screenshots to approved references. Final npm test -- --maxWorkers=2 and npm run build without browser/Docker concurrency. Record tested hashes and criterion evidence.

## Rollback
Revert presentation commits; no data migration or retained configuration change.

## Execution notes
Planning completed before production edits. Baseline accepted M34:757 tests/75files and build. No known baseline failure.

Final milestone evidence: evidence/qa/secretsauce-mcp/milestone35/acceptance.md and tested-inputs.json; evidence/ux-acceptance/secretsauce-mcp/milestone35/visual-review.md. All five criterion groups delivered and validated. No production schema/runtime or live-instance change. Parent owns milestone acceptance/status.
