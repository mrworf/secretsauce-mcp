# M50 targeted acceptance

Core slice `f69026e`; final UI/evidence slice contains this report. All M50 scoped outcomes are complete; permanent service deletion remains M51. Full product qualification remains outer-owned UX10-INTEGRATED.

## Evidence and checks

Core positive/negative evidence is in slice1-acceptance.md and console-credential-removal.test.ts (13 cases). Existing immediate clearing14/history6/services17, migration17, import-upgrade3, restore-install4/backups22 and credential recovery5 passed in the documented focused runs. Final build PASS; service-review8 PASS. No assertion or timeout weakened. No live deployment/credentials used.

Final actual browser/recovery command:

`docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work -e CONSOLE_REMOVAL_SCENARIO=1 -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone50/browser mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-credential-dialogs-browser.mjs`

PASS: named conventional Remove credential button; modal consequence/Cancel/focus; saved-draft-only removal saves without clearing; New settings default with exact cleanup list; approval Cancel preserves value; actual Apply deletes only intended saved-only key while retaining applied key and unrelated orphan. The same disposable run creates actual encrypted archives through the backup worker, verifies current snapshot excludes deleted value, restores an earlier archive Disabled with fresh incarnation, and restarts with an old unresolved cleanup intent without deleting the restored value. Temporary synthetic store and archive material are cleaned up; no real mount or service contacted.

Backend coverage additionally proves applied-key removal, repeated save/reopen, re-add/discard, shared full-draft (Guided/Advanced) server semantics, malformed client-injected intent, current-role/session/stale replacement, explicit no-auth validity, audit admission and completion faults, pre/post-write coherent outcomes, degraded diagnostic startup then healthy restart, v8 import/restart and actual pinned v7-reader rejection. Existing API CSRF and authenticated mutation routes remain unchanged; no new unguarded endpoint introduced. Browser Advanced mode and every fault screen are not separately recaptured; backend negatives and existing shared route evidence are the bounded qualification basis.

## Visual comparison

Opened actual desktop removal viewport, desktop grouped cleanup review, narrow modal and final320/200% review screenshots. Compared the existing grouped review/dialog family to manifest feedback004 new-desktop and UX-IN25/R12/V11/A13 with UX10 precedence. Existing wide canvas, section cards, warm accent, readable context and New settings-first order retained; exact cleanup consequences are visible above the review tabs. Outer reviewer also inspected removal desktop and cleanup-review390 and found clear semantics/readable grouping. New modal returns focus to opener on Cancel and to next credential/Add on confirm. Controls/text fit320 without clipping; final review buttons stack and tab labels wrap whole words.

The first enlarged-text measurement preceded responsive observers; two animation frames now precede the unchanged document/text-range assertions. Image inspection subsequently found inherited review action/tab word splitting despite no geometric overflow; narrow controls now wrap/stack and final screenshots were regenerated/reinspected. Full-page modal images include the dimmed underlying tall editor; the desktop viewport capture demonstrates actual dialog hierarchy. No unseen state or universal visual acceptance claimed.

## Contract mapping and limits

- Intended applied/saved-only cleanup, cancel/discard/re-add/orphan/reference retention: focused removal tests + real saved-only browser journey.
- Exact review/current dependency/session binding and coherent atomic Apply: removal tests, captured review and observed resulting state.
- Authority/input/audit/unknown/restart/reuse fences: focused negatives, preserved authenticated API gates and actual old-reader test.
- Backup absence/older explicit recovery/fresh generation: encrypted recovery tests plus joined Docker backup/restore/restart scenario.
- Shared button/modal/plain copy/review UX: inspected final screenshots and keyboard/overflow checks; SMTP and independent value controls unchanged.

Known limitations: no external downstream interoperability or deployment qualified here. Final frozen-source full suite/build and joined M49–51 qualification remain required at UX10-INTEGRATED. This report does not waive retained runtime response-scanning limitations, audit retention, or older encrypted backup contents.

## Final-regression fixture correction

The frozen integrated run exposed six assisted-reset failures with one cause: legacy tests attempted to downgrade an existing v3 identity state through ordinary commit. M50's monotonic writer correctly retained v3, so those fixtures never reached their intended v1/v2 migration boundaries. A test-only helper now writes an explicit older encrypted snapshot, removing v3 display metadata and rejecting newer domain formats. Production behavior is unchanged. Exact v2, authority revocation after uncertain writes, preserved MFA on failed first migration, and absence of premature reset intent assertions remain intact.

Focused correction validation: `npx vitest run test/console-assisted-reset-oauth.test.ts test/console-assisted-resets.test.ts test/console-migration.test.ts test/console-import-upgrade.test.ts --maxWorkers=2` PASS (4 files, 44 tests), including newer-format import/restart coverage. `npm run build` PASS. No browser requalification required for fixture-only changes; the outer orchestrator must rerun the frozen full suite against the corrective commit.
