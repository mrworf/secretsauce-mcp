# M30 acceptance

Contract: delivery/milestones/secretsauce-mcp/30-credential-value-dialogs.md. One shared UI slice, consuming accepted M27 and M29; no credential persistence, transport or admission redesign.

| Criterion | Evidence |
|---|---|
| No inline secret input, explicit immediate Save and truthful metadata | credential-dialogs browser checks absence of inline password controls, successful Replace/Set version and actor, existing draft not silently saved. Opening new-service dialog does not save; explicit Save value explains and creates its prerequisite inactive draft. |
| Cancel/Escape, completion, validation and no persistent secret | Browser blank/invalid canonical input checks; bounded keyboard focus; input removed/cleared and return focus; storage empty; sanitized page text and empty-input screenshots. |
| Continue independent of replacement and draft separation | Creation Continue reaches policy with no supplied value; safe existing suffix remains after immediate replacement and unknown outcome; no current draft created by existing-service value action. |
| Referenced Clear versus key deletion, unknown recovery | Existing M29 admitted delete behavior retained; current metadata loaded before confirmation. Browser checks referenced retained-key consequence and Clear/Set. Lost-response injection admits once then aborts; failed lookup blocks save, explicit lookup recovers metadata before reopened confirmation. Browser and full service-domain tests cover unreferenced removal and current/saved dependencies. |
| Add focus/scroll/announcement and accessibility | Browser measures new field viewport/focus and announcement; preserved existing suffix; 390/320 and 200% text range checks, dialog action reachability. |
| Permissions, boundary inputs and capability preservation | Owner/Administrator success, mid-dialog Auditor demotion rejection, Auditor read-only; stale confirmation rejected; malformed/blank canonical input and transport fault paths. Existing M29 tests retain Member/API authorization and durable generation/fencing coverage. Services browser preserves multiple destinations and credential placements. |
| Actual visual comparison | ../.. UX evidence: evidence/ux-acceptance/secretsauce-mcp/milestone30/visual-review.md and screenshots compared to approved authentication/replace/clear references. |
| Independently demonstrable | Both creation and focused Authentication operate without M31–34; later background help redesign is explicitly outside M30 acceptance. |

## Validation record

- `npm test -- --maxWorkers=2`: PASS, 748 tests in 74 files, 106.48 seconds. Includes current M29 storage/authorization/backup/fencing tests. No browser or Docker workload ran concurrently.
- `npm run build`: PASS.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-credential-dialogs-browser.mjs`: PASS; final result in the adjacent UX browser report.
- Existing `verify-console-credential-clear-browser.mjs`: PASS, evidence redirected to `/tmp/m30-clear-regression` so M29 accepted evidence remains immutable.
- Existing `verify-console-services-browser.mjs`: PASS, eight checks, setup 2272 ms; evidence redirected to `/tmp/m30-services-regression`. Multiple destinations, exact/suffix/regex options and multiple header/query placements retain their supported behavior.

Production source and full-suite tests stayed unchanged after the passing full suite. Browser-only fixture additions subsequently strengthened new-draft timing and orphan-key coverage; their final browser result is current. `tested-inputs.json` freezes tested source, tests, tooling and three browser harnesses. Browser uses real synthetic HTTPS and disposable state only; no live deployment or external LLM connection was changed. No Docker drill is newly required for these browser-only changes; M34 retains its integrated operational gate.

## Failure classification

The initial browser test revealed native modal Tab could leave the modal; explicit focus wrapping corrected that implementation defect. Fixture corrections supplied a valid new-service destination and refreshed confirmation after role transition; no production validation was weakened. Network-loss simulation admits the command once through the same manager and aborts the response, avoiding external DNS dependency. No assertions/timeouts were relaxed.
