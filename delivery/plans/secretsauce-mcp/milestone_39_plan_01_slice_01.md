# M39 slice 01: Remove empty guided destination with safe navigation

## Goal and boundary
Create/edit services through five remaining sections; legacy detection entries reach Access & policy without changing data or permissions. Readonly keeps its independent Review index. M27/M33 complete; M37/M38 accepted. Authority M39 contract and UX6 UX-G07/IA09/10/IN15/A09/C61/C63.

## Behavior and state
Remove only standalone detection navigation/content. Normalize legacy numeric route at editor/read-only boundary, retaining existing valid indices and malformed-route rejection. History stores location metadata only; alias routing does not rewrite older entries or mutate drafts. Guided/Advanced keep exact rule scanning fields. Existing dirty Stay/Save/Discard and focus restoration remain. Shared Settings normal navigation retains authorization and unsaved guard. No new inputs beyond compatibility handling of existing URL values.

## Surfaces
src/consoleServicePage.ts plus a focused route helper if needed; test/console-history.test.ts or focused route tests; scripts/verify-console-navigation-browser.mjs; this plan and milestone39 QA/UX evidence. Root status and unrelated test-results/ excluded.

## Validation and error handling
Test positive current/legacy editable and readonly indices, negative malformed/out-of-range input, exact imported scanning fields across guided/advanced/save/apply, current role restrictions and stale apply. Actual HTTPS browser tests create/edit omission, legacy aliases, Back/Forward preservation and dirty Stay/Save/Discard, no false dirty, policy controls/shared Settings and complete review. Existing view-epoch protection must remain. Screenshot desktop 1440, narrow390/320 and text200 with document/text-range checks; compare approved feedback003 composition. Source frozen for final full suite npm test -- --maxWorkers=2 and npm run build with no concurrent browser/Docker. Any failure investigated in focused subset first. No secret-bearing Playwright request logs.

## Acceptance and commit
All five M39 criteria map to durable QA/UX evidence. One implementation commit includes code/tests/plans/evidence only after checks pass. Parent records final SHA in acceptance. External ChatGPT/Codex connection remains unqualified locally; runtime/public contracts unchanged.

## Validation record
Planning gate self-check: one independent reversible behavior, exact compatibility spaces identified, no unresolved authority or permissions changes.

## Completion evidence
Focused 16 tests PASS; actual disposable HTTPS browser PASS; final frozen full suite 775 tests / 78 files PASS (122.39 seconds); build PASS. All 176 tested input hashes verified unchanged. QA: evidence/qa/secretsauce-mcp/milestone39/acceptance.md, validation.json, tested-inputs.json. UX: evidence/ux-acceptance/secretsauce-mcp/milestone39/visual-review.md and final/. Root independently inspected desktop/narrow/text200 composition and scanning dialog. Development harness corrections preserved stale revision/access rejection; no weakened checks or production workaround. No blocker or deployment. Implementation SHA recorded by parent acceptance.

Parent acceptance: implementation commit `718f4f74ba31c805d820345837b3cdd20f2032c6`; all M39 criteria verified and accepted.
