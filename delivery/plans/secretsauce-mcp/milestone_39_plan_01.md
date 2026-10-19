# M39: Focused guided service navigation

Parent 22c59f55baab1fa4790ce03c6e65317b73b2ffe9; product secretsauce-mcp. Source 69611ec52040a3619e0e503b0abdc223e995f4a1; planning f75b7edd69e6927ac5d94292401dc23c36a45d5a. Root owns status. Unrelated test-results/ excluded.

## Scope and authority
M39 / REC-RM-032 / UX-C61/63 removes the standalone guided Secret detection destination, with safe old-entry compatibility. Existing editor indices 0–4 stay stable; old edit=5 resolves to Access & policy (3). Readonly section indices stay stable independently: old section=4 resolves to Access & policy (3), section=5 remains Review. Preserve shared Settings, policy scanning controls, complete review, saved/imported data, permissions and history guards. No markers/slider/runtime/API/storage changes or deployment.

## Slice index
| Slice | Plan | Outcome | Status | Commit |
|---|---|---|---|---|
|01|milestone_39_plan_01_slice_01.md|Navigate remaining sections and old entries safely without losing configuration|complete|recorded by parent acceptance|

One complete navigation outcome includes compatibility, preservation and browser evidence; separating the removed link from safe old navigation would create an incomplete slice. Plans inspected before production changes. No unresolved product decision.

## Validation
Focused route compatibility and existing history/editor tests, real disposable HTTPS browser covering creation/edit/read-only old links, Back/Forward, dirty guards, policy controls and Settings, exact data preservation and role negatives. Matching desktop/narrow/text200 visuals against UX6 routed feedback003 appearance with only removed-section delta. Final frozen npm test -- --maxWorkers=2 alone then npm run build. QA/UX evidence in milestone39. No live ChatGPT/Codex qualification or local-instance changes.

## Completion evidence
Focused 16 tests PASS; actual disposable HTTPS browser PASS; final frozen full suite 775 tests / 78 files PASS (122.39 seconds); build PASS. All 176 tested input hashes verified unchanged. QA: evidence/qa/secretsauce-mcp/milestone39/acceptance.md, validation.json, tested-inputs.json. UX: evidence/ux-acceptance/secretsauce-mcp/milestone39/visual-review.md and final/. Root independently inspected desktop/narrow/text200 composition and scanning dialog. Development harness corrections preserved stale revision/access rejection; no weakened checks or production workaround. No blocker or deployment. Implementation SHA recorded by parent acceptance.

Parent acceptance: implementation commit `718f4f74ba31c805d820345837b3cdd20f2032c6`; all M39 criteria verified and accepted.
