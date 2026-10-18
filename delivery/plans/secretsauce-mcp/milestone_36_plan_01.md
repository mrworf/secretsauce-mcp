# M36: Confirm service changes and explain exception scope

Parent: 09ae25e7ee6a6aec7d66e76f84a875c67d0776a9. Product secretsauce-mcp; fixed goal M35–36. M35 accepted. Source d84ac2265bd6c055a6da5edfe5f3d586137d30e9; planning 209e0fdef777ab9b31f1014bc335868ee9cbd44c. Approved UX-DESIGN-005.

## Scope and authority
Deliver REC-RM-028/029 and all requirements of milestone36. Preserve M35, exact review/exception identities, server authorization and atomic apply. No deployment, storage migration, transport or global Settings changes. Existing untracked test-results/ is unrelated and preserved. Root owns status.yaml.

## Slice index
|Slice|Plan|Outcome|Status|Commit|
|---|---|---|---|---|
|01|milestone_36_plan_01_slice_01.md|Confirm exact reviewed changes with individually explained exceptions and truthful completion recovery|complete|slice payload; exact SHA recorded by root acceptance|

One coherent vertical slice: exception labels and approval belong to the same decision and cannot be split without duplicating acceptance. Written planning gate completed before production.

## Validation and completion
Focused positive/negative risk scope and exact-ack tests; existing services/navigation/grants/recovered eligibility regressions; actual disposable HTTPS browser joined M35/M36 flow with keyboard/focus, cancel, pending, rejection, unknown status inspection, responsive/text200 and approved visual comparison. Freeze executable inputs before final browser then npm test -- --maxWorkers=2 and npm run build, without concurrent workloads. Evidence under evidence/qa/secretsauce-mcp/milestone36 and evidence/ux-acceptance/secretsauce-mcp/milestone36. No external client or live instance claims. Revert slice to roll back; no migration.

## Completion
All seven milestone criterion groups pass; see evidence/qa/secretsauce-mcp/milestone36/acceptance.md and validation.json. Final cumulative browser PASS, final full suite772 tests/77files (115.05s), build PASS, all13 input hashes unchanged. Earlier772-test pass was superseded by a return-section correction; final browser explicitly verifies it. Root reviewed actual modal references and found general appearance conforming. No deployment or unresolved blocker. Parent owns final acceptance and exact slice commit recording.
