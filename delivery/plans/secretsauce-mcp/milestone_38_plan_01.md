# M38: Visible review exceptions

Parent 12436b3d3b16d727dd14bd3b6a5069856954a35a; product secretsauce-mcp. Source 69611ec52040a3619e0e503b0abdc223e995f4a1; planning f75b7edd69e6927ac5d94292401dc23c36a45d5a. Root owns status. Unrelated test-results/ excluded.

## Scope and authority
M38 / REC-RM-031 / UX-C60/63: actual safe exception bullets above approval on both tabs, neutral none state. Reuse exact existing label semantics and untouched acknowledgment keys. Preserve M37 default and M36 dialog. No M39/40, runtime/API/storage/scanner changes or deployment.

## Slice index
| Slice | Plan | Outcome | Status | Commit |
|---|---|---|---|---|
|01|milestone_38_plan_01_slice_01.md|Read all actual exceptions before approval without waiving acknowledgments|complete|recorded by parent acceptance|

One coherent presentation outcome including tests and visual evidence; further splitting would separate directly required validation. Plans persisted and reviewed before production changes; no product ambiguity.

## Validation
Extend existing approval HTTPS harness for zero/one/many bullets on both tabs, exact risk-label agreement, inert/safe rendering, no acknowledgment persistence, existing stale/role/unknown boundaries. Compare desktop/narrow/text200 against UX5 appearance with UX6 delta. Focused approval tests; final frozen npm test -- --maxWorkers=2 and npm run build alone. QA and UX evidence under milestone38. External LLM exception retained; no live instance changes.

## Completion evidence
Focused 7 tests PASS; actual HTTPS browser PASS; final frozen full suite 772/77 PASS in 121.00s and build PASS. Eight source/dependency hashes verified unchanged. Evidence: evidence/qa/secretsauce-mcp/milestone38/acceptance.md, validation.json, tested-inputs.json; evidence/ux-acceptance/secretsauce-mcp/milestone38/visual-review.md and final/. Root independently accepted desktop visual direction. No blocker, no deployment. Exact implementation SHA recorded by parent acceptance.

Parent acceptance: implementation commit `b4038b7ac169b0db1bc0ec0ae2057dc211c0f6a1`; all M38 criteria verified and accepted.
