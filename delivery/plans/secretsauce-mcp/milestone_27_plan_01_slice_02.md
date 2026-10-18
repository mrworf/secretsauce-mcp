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
Completed. Dedicated HTTPS browser PASS against final source hashes: selected populated sections; current lifecycle/revision and pending/unsaved context; one full-service Guided/Advanced mode; exact regex/custom-method/binary roundtrip; malformed/empty/wrong-shape JSON stays editable and cannot save; direct creation links and incomplete review; safe Back/Forward/Stay/Discard; Auditor sections and complete read-only Advanced. Approved matching 1440/390 and 320/200% text screenshots reviewed.

Existing services, lifecycle, import-recovery, friendly-forms, advanced browser regressions PASS. Restored mapping recovery in focused Configuration, and excluded preview inputs from service dirty tracking. Fixture synchronization uses acknowledged responses and current completion state, not sleeps. Legacy Settings adapter follows existing current labels and genuine change-before-save behavior.

`npm run build` PASS. Final `npm test -- --maxWorkers=2`: 73 files / 730 tests PASS (105.50s), without browser concurrency. Exact final hashes, command summary, visual comparison and all-criteria coverage: `evidence/ux-acceptance/secretsauce-mcp/milestone27/{acceptance.md,validation.json,browser-report.json}`.

Commit boundary includes this plan, source, operator help, browser fixture compatibility and sanitized evidence. No authority or milestone status edits; root owns acceptance. Commit provenance is the slice commit itself and parent closeout, avoiding self-referential SHA.
