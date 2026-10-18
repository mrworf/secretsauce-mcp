# M27 slice 1: Grouped current configuration

## Goal/scope
Replace flattened Overview with connection/authentication/policy/access cards. Provide identical read-only focused grouping. Loading/failure explicitly distinct from missing configuration.
Excluded: domain-specialized redesign assigned M28 onward, authorization changes, live instance changes.
## Dependencies
M22 and existing console foundations; no other M27 slice.
## Entry/state/permissions
Services → service detail. Read actual server snapshots; Owner/Administrator edit, Auditor read only, Member no administrative access. No navigation mutation. Draft save remains separate from explicit review/apply. Safe fields preserved on error, secret values never persisted in browser.
## Surfaces
src/consoleServicePage.ts, src/consolePresentation.ts; focused synthetic browser harness and evidence; operator docs.
## Validation
Positive: populated applied/draft views and selected section. Negative: absent applied, read-only role, API failure; no hidden mutator or inferred success. Compare overview to approved desktop/narrow references.
Run focused service unit tests and actual HTTPS harness. Final slice also full bounded-worker suite/build and applicable browser regressions.
## Acceptance/commit
All scoped behavior observable and evidence recorded before one slice commit. Inspect exact owned diff; exclude test-results.
## Evidence
Completed grouped Overview and Auditor section selection. `npm run build` PASS. Focused service/domain HTTP tests 12 PASS after unchanged loopback rerun. Synthetic HTTPS browser harness PASS: populated applied versus pending values, draft-only no-current state, Auditor grouping/no controls, failed load error; desktop/narrow screenshots reviewed. Final comprehensive evidence and source hashes will be recorded in slice 2.

Accepted commit provenance: `46528c58fa2f6408443350df65fadf66bc54b165`.
