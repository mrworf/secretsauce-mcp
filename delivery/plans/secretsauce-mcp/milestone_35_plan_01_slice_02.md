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
All slice behavior and focused evidence pass; source plan/tests/evidence committed together. All milestone criteria mapped and final evidence hashes captured. Status: complete; exact SHA recorded by parent acceptance.

Implementation findings: complete proposal uses domain-specific server/host/TLS, credential placement and rule/binary rows with exact typed fallback for uncommon data. Header preserves display identity, revision, affected scope, initial grants and admitted in-flight consequences in concise text. Comparison uses compact independent removal/addition pairs for rule replacement, exact identities, and explicit order metadata separate from literal identifiers named Order. Return-to-edit retains originating section. Final browser passed on frozen source, including exact proposal value multiplicity, current credential non-disclosure, readonly tabs, stale apply and Auditor rejection. Eight focused tests pass. Final full suite765 tests/76files PASS in113.91s; build PASS. Frozen executable input hashes verified; evidence/qa/secretsauce-mcp/milestone35/{acceptance.md,validation.json,tested-inputs.json}. Root approved final actual visual direction, with retained footer explicitly M36 scope.

Accepted implementation commit: `4ccf40f9d5d2e826c229aa959a74a75a0e1ab3f0`.
