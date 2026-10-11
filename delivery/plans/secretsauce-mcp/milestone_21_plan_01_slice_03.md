# M21 slice 03: Capability summaries and complete browser acceptance

## Goal, scope and entry point
Friendly applied/read/review across every UX-IA06 row; OAuth row/duration controls, destination row controls, preserved limits/email/backups/health; actual browser tasks and capability mapping.
User enters Services/Configuration tools or Settings, edits supported values, saves a draft and reviews through existing authorized commit paths. No automatic activation.

## Non-scope
New gateway semantics, host reads, replacement persistence/import architecture, unrelated milestones, live user state.

## Dependencies
M20 complete; previous slice complete.

## State, authorization and recovery
Existing API validates current role, enrolled identity, draft generation, scope and audit. Values remain exact; errors retain only non-secret context and focus linked fields. Server rejection produces no partial accepted mutation. Immediate value actions remain separate. Read-only roles receive summaries without write controls.

## Expected surfaces
console page modules, scripts/verify-console-friendly-browser.mjs, docs/console-operations.md, milestone21 evidence

## Validation
all capability form/read/roundtrip matrix, read-only authorization, browser keyboard/320px/200% text, npm test, npm run build. Run narrow tests then related console regressions; final slice runs full suite/build and real HTTPS browser. Every new input has positive and negative coverage.

## Acceptance and commit boundary
Deliver complete stated behavior with tests, documentation and evidence. One reviewable commit for this slice; exclude test-results and root status. Status pending.
