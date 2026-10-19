# M40 — Policy scanning override markers

Parent: 2066aa60c0a438c325888975627bab1534be9eae. Product: secretsauce-mcp.
Contract: delivery/milestones/secretsauce-mcp/40-policy-scanning-override-markers.md; UX6 UX-IN16/V08/A09/C62–63.
Pre-existing dirty paths: unrelated untracked test-results/ only; preserve. Root owns status.yaml.

## Scope and slice index

One coherent presentation slice: [01](milestone_40_plan_01_slice_01.md), neutral explicit-override marker plus complete browser lifecycle and regression evidence. No slider, runtime/storage/API changes or deployment. All existing exact literals, policy risk classification and approval boundaries remain unchanged.

## Plan review

Dependencies M31 and current UX6 authority are satisfied; M37–39 accepted. Presence of either owned override field (including empty explicit binary object and default-equivalent/increased protection) is the marker criterion. Inherited rules have neither. One slice is independently reviewable/revertible; splitting styling from behavior would not deliver a useful outcome. No unresolved product decision.

## Validation and acceptance

Actual isolated HTTPS policy-dialog browser, focused policy/review tests, joined review-to-active approval browser, desktop/narrow/text200 visual comparison against approved feedback003/004 family. Freeze sources/tests/harness before final evidence. Final npm test -- --maxWorkers=2 alone and npm run build mandated. No browser/Docker concurrent with final suite. Acceptance maps every M40 criterion in evidence/qa/secretsauce-mcp/milestone40/acceptance.md.

Status: complete; slice commit recorded by parent acceptance.

## Completed validation

25 focused tests PASS; both actual HTTPS browsers PASS; final frozen full suite 775 tests in 78 files PASS (127.94s), final build PASS. All 230 source/test/harness/lock inputs unchanged against tested-inputs.json. QA: evidence/qa/secretsauce-mcp/milestone40/acceptance.md and validation.json; UX: evidence/ux-acceptance/secretsauce-mcp/milestone40/visual-review.md. Root records exact slice commit in acceptance transaction.

Parent acceptance: implementation commit `678da0aafd6e45959a990cb1e66ac69845671297`; all M40 criteria verified and accepted. Fixed M37–40 delivery goal complete.
