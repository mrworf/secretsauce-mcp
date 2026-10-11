# M21 slice 01: Guided lossless import

## Goal, scope and entry point
Direct Services entry; main/catalog uploads and paste; explicit eligible identity selectors and credential rows; readable unresolved results; valid legacy IDs on first import; preserve role/state boundaries.
User enters Services/Configuration tools or Settings, edits supported values, saves a draft and reviews through existing authorized commit paths. No automatic activation.

## Non-scope
New gateway semantics, host reads, replacement persistence/import architecture, unrelated milestones, live user state.

## Dependencies
M20 complete; none within M21.

## State, authorization and recovery
Existing API validates current role, enrolled identity, draft generation, scope and audit. Values remain exact; errors retain only non-secret context and focus linked fields. Server rejection produces no partial accepted mutation. Immediate value actions remain separate. Read-only roles receive summaries without write controls.

## Expected surfaces
src/consoleServicePage.ts, src/consoleMigration.ts, test/console-advanced.test.ts or focused import test; browser harness

## Validation
positive main and optional catalogs, missing defaults, exact local/external mapping, edge IDs first import/edit/export; negative stale/demoted/unknown/alias/oversize/disabled/rotation/unsafe source. Run narrow tests then related console regressions; final slice runs full suite/build and real HTTPS browser. Every new input has positive and negative coverage.

## Acceptance and commit boundary
Deliver complete stated behavior with tests, documentation and evidence. One reviewable commit for this slice; exclude test-results and root status. Status pending.

## Delivered evidence
Guided HTTPS upload/paste import and identity selector pass (evidence/qa/secretsauce-mcp/milestone21/import/browser-report.json). Malformed input fails with source-linked recovery. Blank optional catalogs use bundled defaults; exact external identity metadata is exposed only in existing administrative eligible lists. Legacy punctuation and constructor/toString/prototype import/edit/apply/export/lookup covered; existing raw schema drops __proto__, so unsupported source is explicitly rejected atomically instead of silently losing it. Existing new-creation restrictions unchanged. Targeted migration/services tests and build pass. Slice complete; commit recorded in next index checkpoint.
