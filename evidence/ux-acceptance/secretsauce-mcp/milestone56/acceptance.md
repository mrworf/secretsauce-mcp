# M56 focused acceptance

Two coherent slices: bounded complete export (3856259), then deliberate search/paging and completed-response download. All M56 targeted criteria pass; final UX13-INTEGRATED remains outer-owned.

| Requirement | Evidence |
|---|---|
| Initial Last24h, separate All time/Custom, local display and UTC machine bounds | Actual HTTPS browser default, cleared preset inputs, custom reversed-range rejection; M55 local-time helpers reused |
| Filter edits remove rows/count/paging/export; delayed or failed requests cannot restore stale results | Server-owned delayed and failed searches; change during pending query; direct Back returns to explicit Search |
| Fixed searched range and truthful25/50/100 paging | Browser next/page-size assertions, unchanged From bound, shrinking135-row result resets once to page1 |
| Complete export independent of page and former caps | Core10000-row and700-row/>2MiB tests; actual735-row browser JSON download from page2; startOffset0 and no truncation |
| Bounded admission, cancellation and current authorization | Focused invalid/maxescaped input, Origin/CSRF/Member, concurrent export, revocation,30s deadline and cancellation tests; incomplete JSON cannot finish |
| Transport failure is not a successful download | Actual HTTPS server destroys response after partial JSON; browser shows failure and emits no download |
| Service scope, roles and existing predicates | Existing focused evidence tests retained; browser service scope survives Clear, Auditor export available, Member export absent/foreign actor rejected |
| Visual and keyboard family | Inspected1440/390/320 screenshots and320px200% text/paging; document and visible text-range overflow assertion; initial keyboard sign-in retained |

Validation: TypeScript build PASS. Focused evidence unit/HTTP suites:22 tests across2 files PASS (identical loopback-permission rerun after environment EPERM). Final browser PASS is in browser/browser-report.json. The fixture's first run stopped at a mistaken link selector for the existing button tab; corrected fixture and final run pass. A second final-source run includes the history guard and its actual Back assertion. No product assertions were removed.

Export retains existing100,000-row/2-second selection including predicates; a per-store single output slot and30-second delivery bound include serialization/backpressure. No500-row or2MiB successful truncation remains. Other report kinds retain existing caps. Current-host legacy evidence remains included; incoming-archive restore behavior is M58, unchanged here. Synchronous internal Activity export rejects explicitly, preventing a second unbounded implementation. The operating-envelope harness was updated to the supported writer and complete-count contract; only its syntax was checked in this milestone.

Actual images preserve the inherited console spacing, colors, card controls and hierarchy. Narrow controls stack with readable page labels/actions. Long synthetic event identifiers wrap without clipping. The parent independently inspected desktop grouping and the initial enlarged capture; this is bounded acceptance of captured Activity states, not a product-wide visual audit. No extra download-success notification appears.

Reproduction: create a sanitized `git archive` export with the exact owned source/harness overlay listed in source-revisions.json. Run the existing Playwright image with that tree at `/work`, read-only locked node_modules, and only this browser evidence directory at `/artifacts`:

```sh
docker run --rm --user 1000:1000 --mount type=bind,src=/tmp/m56-browser-source,dst=/work --mount type=bind,src=/home/ha/projects/secretsauce/node_modules,dst=/work/node_modules,readonly --mount type=bind,src=/home/ha/projects/secretsauce/evidence/ux-acceptance/secretsauce-mcp/milestone56/browser,dst=/artifacts -w /work -e CONSOLE_BROWSER_EVIDENCE_DIR=/artifacts mcr.microsoft.com/playwright:v1.64.0-noble sh -c 'npm run build && node scripts/verify-console-activity-browser.mjs'
```

Synthetic HTTPS only, no live store or unrelated working-tree files mounted. Request call logs and form values omitted from failures. All browser workloads stopped. No full suite, application image, recovery drill or deployment run here; outer UX13-INTEGRATED retains those gates after M58.
