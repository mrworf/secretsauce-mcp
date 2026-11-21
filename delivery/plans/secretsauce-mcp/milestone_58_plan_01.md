# M58: Restore without archived Activity installation

Parent checkpoint33671055c6410f853c1a407cb4fcd839bf083594; definition3a186ac/c096391 and planningcbc824c/f60e47b govern. One minimal-slice transaction for M58 only; outer owns status and UX13-INTEGRATED. At start only the original passwd/session/test-results paths are untracked; they remain unread and untouched.

## Slice01 — Verified restore preserves only current-host Activity

One coherent recovery behavior across worker verification, installation, rollback, evidence reachability and the existing recovery harness. Incoming local/nested archive evidence remains cryptographically and structurally verified, but no restore path constructs/installs its Activity rows. In-place restore retains current-host local journal and already-installed legacy domains exactly; clean-host restore installs no historical domains. Preserve metadata needed for verification, account/credential attribution, fresh incarnations, disabled/enrollment gates, state formats, staging, leases and crash cleanup. Incoming service history links cannot claim current-host evidence; retain only positively justified current-host lineage. Fence old/new public references through the existing stable-identity mapping. No new archive format, Activity purge, UI hiding, deployment or cryptography redesign.

Owned surfaces: consoleBackupWorker/worker helpers, consoleRestore/RestoreProvenance as necessary, existing recovery/provenance tests, recovery clean-host Docker harness, AGENTS durable guidance and this plan/evidence. No authority/status edits. Existing archive validation and worker deadlines remain required; no new unbounded main-thread processing. No secret/header/body logging.

Validation extends existing restore tests: old/current archives and nested sources excluded from query/detail/complete export; target-host local/post-snapshot/legacy domains remain; corrupt sources rejected; renamed reference invalidation, fresh incarnations, failure/rollback/restart continuity preserved. Build and focused affected suites only. Update exact-image drill assertions for no imported sources and renamed-route recovery; do not run/build Docker until outer freezes, passes full suite, and supplies the one final image. No graphical layout changes: reuse current Activity UI evidence; actual recovery/evidence paths are qualified by API and final same-image drill.

Commit the complete focused implementation with tests/harness and evidence. If a concrete defect in a published slice appears, add a narrow corrective entry/commit. First out-of-scope regression expands focused checks; second requires the outer planned full regression. Final targeted handoff reports candidate/source hashes, format facts and stopped workloads; final same-image in-place/clean-host/restart/rollback/launcher gate remains explicitly pending UX13-INTEGRATED, not waived.

## Progress

Plan persisted before production edits. Current finding: worker builds incoming rows twice (open validation and provenance stage), then installation assigns those domains. Restore fence currently passes managed IDs where public routing references are required. Focused implementation pending.

Slice01 targeted PASS: build and47checks/5files passed after identical loopback-permission rerun. Incoming projections eliminated, existing host domains/lineage preserved, public-reference fencing corrected, local restore reader floor10 retained even empty archive. Actual Docker harnesses extended/syntax checked only; final frozen suite and one-image clean-host/in-place/rollback/restart/launcher gate pending outer UX13-INTEGRATED. See evidence/qa/secretsauce-mcp/milestone58/targeted-acceptance.md. All test workloads stopped; no Docker or deployment run.
