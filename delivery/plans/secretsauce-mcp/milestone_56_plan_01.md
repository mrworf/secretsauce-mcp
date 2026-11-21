# M56: Complete filtered Activity

## Outcome and delivery context

One transaction for M56 only in outer UX13 goal55–58. Parent checkpoint ebf6e70; M55 accepted2520af4/7e6e7da. Definition3a186ac/c096391; planningcbc824c/f60e47b. Packet56-complete-filtered-activity.md, PRD AUDIT02a/b, UX-IN31, STATE13/SECRES12 and AGENTS govern. Outer owns status and final UX13-INTEGRATED. No tracked changes at start; original passwd/session/test-results remain unread/untouched.

## Current findings and decisions

Existing authenticated POST export has256KiB input/CSRF fences, but Activity slices offset+500 then serializes whole JSON under2MiB. Existing query already selects exact bounded100k/2s universe with hard scope. UI retains stale results, combined Custom/all-time and50-only paging. Reuse M55 local-time/success helpers and existing filter/authorization machinery. Implement bounded incremental Activity response on existing route, not client page assembly or durable export jobs; browser downloads only after transport completes. Preserve other export caps. No persistence/schema change.

## Scope and slices

| Slice | Observable outcome | Dependencies | Status | Commit |
|---|---|---|---|---|
|01|Authorized complete Activity download independent of page, bounded and cancelable|Existing selection/auth/audit|complete|3856259|
|02|Deliberate search/time/paging and actual browser acceptance of integrated download|01 and M55|complete|this slice commit|

### Slice01 contract

Own consoleEvidence/consoleHttp and directly affected evidence/API tests. Complete same-schema Activity snapshot (allmatches, startOffset0, no truncation), rechecked current session/role/context identity before async release; one expensive export at a time per store, bounded chunk buffering and elapsed delivery, cancellation/backpressure releases resources. Audit admission and failure/unknown outcomes retained. No raw filter/secret logging. Preserve100k/2s selection including predicates and unchanged scope/sanitization. Focused existing evidence/API tests extend >500/>2MiB, offset ignored, denied/stale role/context, invalid input, cancellation/concurrent/timeout failures. Commit independently after focused pass.

### Slice02 contract

Own consoleEvidencePage and necessary scoped styles/harness/evidence. Initial Last24h; separate All time/Custom, presets resolve at deliberate Search/Refresh; filter edits clear all stale results/count/paging/export, newer edits fence old responses. Page size25/50/100 retains searched absolute range, truthful totals/pages and Previous/Next. Export current successful search only, no success toast; retain applied retention, actual integrity errors and legacylocal sources. Focused test/build plus real synthetic HTTPS browser using sanitized gitarchive and owned overlays; inspect1440/390/320200 screenshots. Cover scoped/Member/Auditor behavior, dirty/pending/failure, exact bounds, multi-page download and overflow/focus. No M57/M58 behavior.

## Validation, rollback and completion

Reuse existing tests/harness; positive/negative external inputs required. No fullsuite or appimage here. Final frozen bounded-worker suite/build, joined final-source browser and exact same-image recovery is outer UX13-INTEGRATED afterM58. First distinct outside-scope regression expands focused checks; second/spread triggers outer full regression after repairs. Revert code only if needed; no durable data migration. Complete after both reviewable slice commits, focused API/browser acceptance, inspected screenshots and stopped workloads. No live deployment or credentials used.

## Execution notes

Plan persisted before production edits. Pending focused validation; no acceptance claim yet.

Slice01: build PASS; evidence unit/HTTP22 tests PASS after identical loopback-permission rerun (initial EPERM was environment). Complete700-row/>2MiB streaming,10000-row snapshot, offset ignored, cancellation/no closing frame, shared-slot release/concurrency, role loss and deadline covered. Existing invalid/maxescapedinput/Origin/CSRF/Member and predicate semantics retained. Synchronous internal Activity export now explicitly rejects to prevent a second unbounded path; production existing POST uses the bounded writer. One per-store output slot,30-second total output deadline, bounded single-row writes/backpressure, fresh authority/context/revision checks; errors after headers destroy transport. No full suite run.

Slice02: final sanitized-source build and actual HTTPS browser PASS. Search edits clear old result authority, pending responses cannot restore it, fixed searched bounds support25/50/100 pages, a shrunken offset gets one bounded page1 retry, and revisited Activity requires deliberate Search when no matching result context is retained. Complete735-row download from page2 and interrupted framing/no-download are exercised. Existing operating-envelope harness now uses the bounded writer/full-count assertions (syntax checked, workload not rerun here). Final screenshots inspected at1440/390/320 and200% text, including paging controls. Browser workloads stopped. Acceptance/source hashes are under evidence/ux-acceptance/secretsauce-mcp/milestone56; no full suite or deployment.
