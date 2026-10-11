# M21 slice 02: Catalog and policy controls

## Goal, scope and entry point
Typed bounded nested options; repeatable pattern/exclusion/allow rows; Extend/Replace; named policy methods/hosts/paths, scanning and binary overrides; same-draft expert fidelity.
User enters Services/Configuration tools or Settings, edits supported values, saves a draft and reviews through existing authorized commit paths. No automatic activation.

## Non-scope
New gateway semantics, host reads, replacement persistence/import architecture, unrelated milestones, live user state.

## Dependencies
M20 complete; previous slice complete.

## State, authorization and recovery
Existing API validates current role, enrolled identity, draft generation, scope and audit. Values remain exact; errors retain only non-secret context and focus linked fields. Server rejection produces no partial accepted mutation. Immediate value actions remain separate. Read-only roles receive summaries without write controls.

## Expected surfaces
src/consoleServicePage.ts and shared friendly form module; server schemas unchanged; focused controls tests

## Validation
positive nested types, regex literals, ordering and inheritance; negative invalid regex/type/depth/count and unauthorized/stale saves. Run narrow tests then related console regressions; final slice runs full suite/build and real HTTPS browser. Every new input has positive and negative coverage.

## Acceptance and commit boundary
Deliver complete stated behavior with tests, documentation and evidence. One reviewable commit for this slice; exclude test-results and root status. Status pending.

## Delivered evidence
Secretlint rules/status, Extend/Replace, custom pattern/name/exclusion/allow rows, sensitive-name catalog and bounded typed nested options now edit the same draft. Policy method/host/path rows, source reordering, priority, disabled-rule checklist and binary controls preserve exact semantics. Optional expert JSON remains available. Actual HTTPS forms harness verifies invalid regex rejection, exact persisted regex/nested options (including boolean/number edits), policy overrides, keyboard and 320px. 24 targeted advanced/migration tests and build pass. Evidence: evidence/qa/secretsauce-mcp/milestone21/forms/browser-report.json. Complete; SHA in next checkpoint.
