# M49 focused acceptance

PASS for both planned slices. Slice1 checkpoint `96119cc` and slice1-acceptance.md cover shared sign-in/service clarity. Slice2 is the commit containing this report; exact tested content hashes are in slice2-source-revisions.json. Parent owns milestone status and UX10-INTEGRATED.

## Settings behavior and checks

All Settings renderers take an explicit private mount. The rail/panel and loading state render first; completed sections publish together only into the still-current panel. Compound Health/authentication reads and Configuration tools retain view-generation checks; errors and Retry stay in the panel. Dedicated SMTP/export/recovery tasks retain deliberate full-workspace navigation. The shared footer, dirty-save guards and write-only values remain unchanged.

Build PASS. `npm test -- --maxWorkers=2 test/console-settings.test.ts test/console-settings-http.test.ts` executed the existing console-settings.test.ts only (13 tests PASS; no file exists at the latter filter). No HTTP coverage is inferred from that nonexistent filter. Slice1's six protected service HTTP tests and six auth tests also passed. No backend/API/storage semantics changed.

Final disposable browser command: `docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone49/settings mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-populated-settings-browser.mjs` — PASS.

Runtime assertions cover frame-by-frame outer-content leaks and rail alignment while Health is delayed at1440/390/320, no partial editable form, Health→Email stale response suppression, failed Email load with panel alert and successful Retry, delayed Configuration tools with correct task selection and no wrong return link, all six section mounts, SMTP blank credential dialog/cancel, pending vs current values, multiple Health forms, partial-save failure/retry dependencies, stale apply, unknown-save reconciliation, offline/no invented fields, Auditor read-only and absent Email. Actual320/200% text range/document reflow and focused control clearance above fixed footer pass.

During this slice: frame-monitor initialization originally preceded a full page navigation (fixture reset, corrected); Configuration tools epoch initially preceded currentNav advancement (local implementation defect, corrected). Final visual inspection found duplicate global load errors and a dead return-to-fields link; load errors now stay in the panel. These were within the intended Settings impact boundary. No distinct out-of-area regression or weakened assertion.

## Visual review

Opened actual settings-loading1440, loaded390, load-error desktop, Email320/200% and tools desktop captures; compared against manifest's approved feedback002 Health/Email and inherited shared Settings pattern, with UX10 precedence. Rail/content geometry, card typography/colors and spacious admin canvas preserved. Loading shows no controls before complete reads; errors/Retry remain in the selected region. Fixed bars in full-page captures appear at viewport-relative positions; harness focus measurements establish reachability rather than relying on those images alone. Parent also inspected shared sign-in1440, advisory390 viewport and Settings/tools desktop. No unseen state or whole-platform release is certified.

## Boundaries and completion

M49 five outcomes satisfied: distinct nonblocking no-access warning; compact sign-in and separate replacement task; generic helper removal; stable async Settings including tools; Overview navigation duplicates removed. Authentication/proofs/roles, explicit grants, SMTP timing and secret mutation contracts preserved. No deployment, permanent deletion or Apply-time cleanup implemented here.

Full frozen-source bounded-worker tests/build, joined journeys and changed recovery remain due at UX10-INTEGRATED after M51. Existing M47/48 and prior integrated evidence remain baseline for unchanged behavior. Only unrelated passwd/session/test-results remain outside this transaction.
