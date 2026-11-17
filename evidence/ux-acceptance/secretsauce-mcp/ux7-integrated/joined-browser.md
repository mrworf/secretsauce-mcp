# Joined UX7 browser qualification

PASS. Product candidate: a70c898 (unchanged through outer checkpoint ac158cf). This continuation changes only the existing harness, M42 plan qualification note and evidence. Outer full-suite/build qualification is recorded separately by orchestration; no duplicate suite run here. Browser execution waited for explicit outer all-clear.

## Observed journey
1. Browser downloads named sanitized gateway YAML and optional catalog files with existing transient-error/retry and Member-denial checks.
2. Exact downloaded bytes are imported through the actual provider into a separate isolated encrypted store; destinations/policy/credential placements and catalog objects compare exactly, no activation/access/secret transfer.
3. The same downloaded service content, with a fresh service ID and display name, is imported through the actual browser import form together with both catalogs. This avoids inheriting any existing value. Import result opens Overview: Needs configuration, exact missing credential and Fix Authentication; no premature Review shortcut.
4. Fix Authentication focuses Set value; only that section is marked. Set saves a synthetic value through its existing dialog; marker clears. Access & policy → Review & apply opens actual New settings by default. Exact binary limit12345b and original regex/options are retained.
5. Approve changes opens its real confirmation dialog. Continue is disabled until every security exception checkbox is acknowledged. Continue activates the service. Backend active projection and exact policy equality are asserted; no execution assignment is automatically granted.

Screenshots opened and inspected: joined-import-needs-value.png, joined-import-review.png, joined-import-approval.png, joined-import-active.png. Clear layout, focused correction, default review tab, visible exceptions and active summary match current approved behavior. Shared screenshot helper masks password/code/pre regions, so pink marks on review are evidence redaction, not runtime rendering. Exact values are checked by browser/provider assertions, not inferred from masked pixels.

## Reproduction
```sh
docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work -e CONSOLE_BROWSER_SCENARIO=transfer -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/ux7-integrated mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-advanced-browser.mjs
```

Result: Configuration transfer browser PASS; browser-report.json lists assertions. Synthetic local HTTPS and disposable encrypted stores only; no live mounts. No credentials or request call logs printed. Existing responsive transfer checks also reran. Current M43 focused/populated/history and M44 credential/modes/populated evidence remains applicable; no related product source changed. This test does not claim a second browser login into the second-instance store, real external MCP/LLM connectivity, or deployment.
