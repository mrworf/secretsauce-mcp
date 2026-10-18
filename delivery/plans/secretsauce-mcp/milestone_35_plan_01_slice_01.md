# M35 slice 01: Grouped Changes and immutable review tabs

## Goal and scope
Replace text-wall differences with typed section pairs; initially keep existing full proposal renderer inside New settings. Tabs retain all scope/grant/disruption and inline approval controls.
Observable outcome is independently useful read-only service review. Excludes M36 dialogs/exception changes, other editors and runtime behavior.

## Dependencies
Existing M27/M33 and approved UX5. Implement in index order.

## Entry and state
Save existing Guided/Advanced draft and review; review data frozen for view lifetime. Switch semantic tabs locally, then back to edit. No save/apply on switching, no dirty state/persistent storage. Existing inline apply remains exact reviewed token and acknowledgments.

## Permissions and errors
Existing Owner/Administrator/recoveredOwner checks and stale server rejection retained. Never expose credential values or opaque review token in DOM/evidence. Loading/error behavior continues through existing API guard.

## Surfaces
src/consoleServicePage.ts, new review presentation helper, related styles, focused unit tests, synthetic HTTPS browser script and evidence. No backend mutation changes expected.

## Tests
Positive grouped values, common/custom typed options and complete proposal; negative absent-vs-null/empty/literal marker, stable identity replacement and reorder, own-property keys, unchanged/no-baseline; browser keyboard and tabs no mutation, no secret, role/stale rejection, desktop1440/narrow390+320/text200. Focused npx vitest run test/console-service-review.test.ts; browser after build. Final full suite/build deferred to slice02.

## Acceptance and commit boundary
All slice behavior and focused evidence pass; source plan/tests/evidence committed together. Existing full proposal rendering deliberately retained until02. Status: complete; commit recorded by parent acceptance.

Validation: focused5 tests PASS; build PASS; disposable HTTPS browser PASS (keyboard/read-only/return-to-edit,1440/390/320/text200). Evidence evidence/ux-acceptance/secretsauce-mcp/milestone35/slice01/. First sandbox EPERM rerun unchanged with loopback permission. Existing full proposal renderer deliberately remains for slice02.

Accepted implementation commit: `7816f7ccd002089e00043378bd04deec83529a3d`.
