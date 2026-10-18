# M35 slice 02: Complete New settings section cards

## Goal and scope
Replace old full proposal rendering with complete named section cards and bounded typed rows; final integrated visual and regression acceptance.
Observable outcome is independently useful read-only service review. Excludes M36 dialogs/exception changes, other editors and runtime behavior.

## Dependencies
Completed slice01. Implement in index order.

## Entry and state
Save existing Guided/Advanced draft and review; review data frozen for view lifetime. Switch semantic tabs locally, then back to edit. No save/apply on switching, no dirty state/persistent storage. Existing inline apply remains exact reviewed token and acknowledgments.

## Permissions and errors
Existing Owner/Administrator/recoveredOwner checks and stale server rejection retained. Never expose credential values or opaque review token in DOM/evidence. Loading/error behavior continues through existing API guard.

## Surfaces
src/consoleServicePage.ts, new review presentation helper, related styles, focused unit tests, synthetic HTTPS browser script and evidence. No backend mutation changes expected.

## Tests
Positive grouped values, common/custom typed options and complete proposal; negative absent-vs-null/empty/literal marker, stable identity replacement and reorder, own-property keys, unchanged/no-baseline; browser keyboard and tabs no mutation, no secret, role/stale rejection, desktop1440/narrow390+320/text200. Focused npx vitest run test/console-service-review.test.ts; browser after build. Final npm test -- --maxWorkers=2 and npm run build alone after browser acceptance.

## Acceptance and commit boundary
All slice behavior and focused evidence pass; source plan/tests/evidence committed together. All milestone criteria mapped and final evidence hashes captured. Status: planned.
