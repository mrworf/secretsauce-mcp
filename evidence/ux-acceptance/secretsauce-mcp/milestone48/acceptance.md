# M48 focused acceptance

PASS for milestone scope; full UX9-INTEGRATED qualification remains the outer delivery goal's pending gate. No deployment.

## Outcome mapping
| Contract | Evidence |
|---|---|
| Separate IDs/names across all retained states and a batch; exact old values/grants untouched | console-migration collision case, repeated-name suffix and 200-character boundary; browser same-ID Transfer import creates independent Imported Transfer example |
| Fresh empty access/no mapping; optional ordinary choices; zero-access activation denies execution | migration/HTTP tests; actual import→missing credential→incomplete review→Set value→New settings→acknowledge→Active browser journey; manager admission rejects the unassigned Owner |
| Legacy unresolved access reset without reupload; safe fields/values/live grants retained | startup/explicit-save tests, actual restore case with never-applied mapped proposal and retained opaque live assignment; browser visible reset notice with no checked identities |
| Stale/role/CSRF/retired mapping/audit/unknown/readers | focused service/HTTP/import tests; actual pinned v6 reader rejects v7; restricted diagnostics test; restart and restore cases; simulated unknown HTTP response prevents duplicate resubmission and offers inspection |
| Shared M47 editor/review/discard and responsive appearance | actual captured import, policy, incomplete/complete review, approval, Active state and subsequent saved-draft discard; current values/applied settings retained |

## Validation
- Build: PASS on final product source.
- Migration final:16 PASS. Services17, HTTP6 and discard4 passed focused run. Import-upgrade3 PASS, including actual prior reader and reliable-storage restricted diagnostics.
- Backup-domain4 and restore-install4 PASS. Restore-recovery20 unaffected cases passed; directly changed opaque-live plus mapped-never-active recovery case passed after retiring legacy provenance before draft reconstruction. No timeout/assertion weakened.
- Initial sandbox listener/child-process EPERM retried under permitted loopback/local process access. No full suite run in this companion.
- Browser `browser-report.json`: PASS. Existing transfer harness downloads actual gateway/catalog bytes and reimports them into a second disposable instance. Same-origin primary browser then imports a colliding source, corrects missing material and activates with no grants; snapshots/assertions preserve exact policy literals and independent credentials.
- Harness-only races/fixture failures: await actual discard completion; simulated unknown response uses API `message` field. Corrected and final run passes.

## Visual qualification
Compared preserved approved feedback003 policy composition and UX9/UX-IN24 deltas with actual runtime captures. Shared warm-accent navigation, white bordered cards, widths, hierarchy, separate lifecycle/Draft, optional access and persistent footer remain coherent. Desktop import-result, optional-access, grouped review/approval/Active states; 390 import result and reset access; 320/200% import result were visually inspected. Document and visible text-range overflow checks passed. Full-page fixed-footer shots can overlay content at their capture scroll position: `legacy-access-reset-390-focus.png` explicitly shows the entire reset notice/choices above the footer. Masked code/input imagery is not proof of exact literals; assertions provide that evidence. No claim about unseen states.

## Reproduction
Run after `npm ci` and `npm run build` in repository root:

```sh
docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work -e CONSOLE_BROWSER_SCENARIO=transfer -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone48 mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-advanced-browser.mjs
```

Synthetic HTTPS only; temporary encrypted stores removed on completion; request call logs suppressed and password/code screenshot elements masked. No real credentials or external LLM required. Slice1 `3bba19d`; slice2 is this evidence payload, resolve via Git history. Source hashes in `source-revisions.json` distinguish final tested product/harness content from later status publication.
