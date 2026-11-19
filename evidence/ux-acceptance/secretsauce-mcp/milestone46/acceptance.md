# M46 acceptance — scoped Activity investigation

Scope: REC-RM-051/052, AUDIT-02.a/b and UX-IN22. Predicate slice published093fa1a; UI/support slice accompanies this report. No deployment or retention/persistence/role redesign.

| Required outcome | Executed proof |
|---|---|
| Predicate truth table | Evidence tests: positive OR, exclusion veto, cross-field AND, missing inverses, exact case/metacharacter literals, contradictions and order invariance. |
| Bounded valid/invalid inputs |32 valid/33 rejected, duplicates across comparisons, legacy conflict, unsupported/empty/control/oversize/result validation; inclusive/open/reversed UTC. HTTP accepts32×1024 Unicode and escaped-surrogate literals through search/detail/export; invalid CSRF rejected. |
| Hard scope across operations | Member own actor outside predicates; exact foreign actor/unassigned service denied; contextual service intersects query/detail/export; browser Clear/paging retains service context. Role restrictions and retained audit gates covered. |
| Successful searched state/export | Browser unsent chips and failed searches retain old count/export criteria; next page exports from offset50 with current predicates. Single current snapshot,500-row truncation,2MiB rejection and nested secret-value sanitization tested. Shared2s deadline includes projection and predicate pass. |
| Relocated reports | Actual download/assertions for Owner, Administrator and Auditor at People & Access / Settings Configuration tools / Health & retention; absent from Activity. Member filtered export absent. Report formats/guards unchanged. |
| Keyboard/layout/errors | Duplicate modal preserves attempted input, Close returns Add focus; chip removal returns input focus. Pending Search disables Clear/page actions. Desktop1440,390,320 and enlarged-text screenshots plus document/text range reflow pass. Previous-results failure, empty results and explicit context captured. |

## Validation

- Build PASS on final UI source.
- Focused evidence/HTTP/Settings:30 tests /3 files PASS. Final authentication gate rerun:17/17 evidence/HTTP PASS. Added2MiB cap assertion in existing evidence test passed separately.
- `CONSOLE_BROWSER_SCENARIO=m46` existing operations harness PASS; `browser-report.json` records joined Settings footer→service Activity→searched export and all-role report discovery. Final execution includes pending-search Clear guard and scoped summary copy.
- Actual screenshots opened and compared against UX8 shared layout and retained approved family. Independent reviewer assessed desktop/narrow/filter/duplicate/empty/Member states and final report placement. White cards, warm Search action, stacked narrow controls, literal chips and existing event cards retained. No new visual family.

Browser reproduction:

```sh
docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work \
  -e CONSOLE_BROWSER_SCENARIO=m46 \
  -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone46 \
  mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-operations-browser.mjs
```

## Transport and limits

New UI searches use authenticated CSRF-protected POST JSON, avoiding query-string chips. Search/detail/export authenticate before bounded body read and allow256KiB for maximum escaped literals; unrelated routes retain128KiB. Legacy GET exact clients remain compatible. User predicates never replace contextual service or actor authorization. No raw chip logs introduced. Export metadata sanitizes nested literals, and export is a current retained snapshot rather than frozen earlier rows.

Full clean-source regression and UX8-INTEGRATED checkpoint remain parent-owned, due before final goal acceptance. No external LLM connectivity claim. Unrelated private/untracked files untouched. No required M46 outcome deferred.
