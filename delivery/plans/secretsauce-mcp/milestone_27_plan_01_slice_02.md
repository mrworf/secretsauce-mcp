# M27 slice 2: Focused lossless editing

## Goal/scope
Use selected Details/Destinations/Authentication/Access & policy/Secret detection/Review section with one global Guided/Advanced mode, preserving whole draft and literal fields. Direct creation step links, invalid JSON retained, safe unsaved navigation guards.
Excluded: domain-specialized redesign assigned M28 onward, authorization changes, live instance changes.
## Dependencies
M22 and existing console foundations; slice 1.
## Entry/state/permissions
Services → service detail. Read actual server snapshots; Owner/Administrator edit, Auditor read only, Member no administrative access. No navigation mutation. Draft save remains separate from explicit review/apply. Safe fields preserved on error, secret values never persisted in browser.
## Surfaces
src/consoleServicePage.ts, src/consolePresentation.ts; focused synthetic browser harness and evidence; operator docs.
## Validation
Positive: populated applied/draft views and selected section. Negative: absent applied, read-only role, API failure; no hidden mutator or inferred success. Mode roundtrip exact imported fields/custom methods/regex; invalid JSON cannot overwrite guided model; direct incomplete steps cannot activate; keyboard, narrow and 200% text.
Run focused service unit tests and actual HTTPS harness. Final slice also full bounded-worker suite/build and applicable browser regressions.
## Acceptance/commit
All scoped behavior observable and evidence recorded before one slice commit. Inspect exact owned diff; exclude test-results.
## Evidence
Pending implementation.
