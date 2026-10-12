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

## Delivered behavior and evidence
Readable applied/configuration/history/full-review values and named differences; destination numeric port/scheme rows; OAuth URL/scope rows and number/unit lifetimes; required SMTP TLS selection/read metadata; applied limits; guarded diagnostic info/debug editor with existing atomic publication. Domain row/list reordering remains lossless; summary lookups are own-property-safe. Expanded actual HTTPS forms/import plus service, focused-settings, OAuth client, operations, SMTP, backup and advanced/history scenarios pass, including Auditor no-write views, 320px/200% text-range checks, malformed fields and exact persisted drafts. See milestone21 capability-coverage.md and validation.json for final command results. Existing raw JSON remains optional, never sole ordinary configuration. No source authority changes or external services needed. Status complete after final full-suite gate; final SHA supplied to root for status/index checkpoint.

Final gate: frozen-source `npm test` PASS, 71 files / 668 tests, 42.93s, after removing concurrent browser CPU work; unchanged 10ms timeout fixture also passed in isolation. `npm run build` PASS. Nine HTTPS browser reports PASS with exact report/source hashes in validation.json. No remaining implementation blocker.
