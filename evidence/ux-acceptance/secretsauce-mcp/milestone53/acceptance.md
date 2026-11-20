# M53 targeted acceptance

PASS for M53 on source hashes in browser-report.json; source UX12 428bae3/077b71b and planned contract8d853fb/392684a. Slice01 b72e318; slice02 includes response-baseline race correction plus joined visual evidence. No M54 implementation or deployment.

- Mixed lifecycle alignment: DOM corresponding-column equality and actual desktop/390/320200 screenshots PASS. Inspected against approved feedback003 service appearance plus UX12-R14; shared rows/colors/control hierarchy retained. Narrow action fragmentation found by image inspection and corrected to stacking, then regenerated/inspected.
- Direct review: Overview/footer safe stale revision opens actual incomplete review, missing value names credential key, no approval enabled. Local edits during baseline refresh survive.
- Safety: real competing proposal, cross-tab replacement after Save, unknown save (exactly one attempt), local edits during inspect/review retain editor and cannot display stale approval. Model tests cover distinct incarnation, content/removal intent, absent draft, lifecycle, independent values/current grants and actual Apply→identical-resave ABA.
- Existing authorization/CSRF/service operations: focused HTTP/model/navigation29tests PASS. Final model19tests+build PASS after added response-baseline assertions; other10 tests unchanged/current. Initial listener EPERM resolved by same-command loopback escalation, no assertion changes.
- Keyboard/reflow: existing harness checks document/text-range overflow and every visible editor control above footer at320/200%. Actual images inspected; no material difference in captured states. Unseen states not visually certified.

Commands: `npm test -- --maxWorkers=2 test/console-services.test.ts test/console-services-http.test.ts test/console-service-navigation.test.ts`; final `npm test -- --maxWorkers=2 test/console-services.test.ts`. Pretest built TypeScript.

Browser: `docker run --rm --network host --user "$(id -u):$(id -g)" -e CONSOLE_BROWSER_SCENARIO=review-entry -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone53 -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-service-editor-browser.mjs`. All data synthetic, no live mounts or real downstream calls. Existing compact-auth branch also runs; report excludes unrelated legacy scenario claims. Output log retains legacy M47 prefix only; scenario evidence is M53.

Full frozen regression and affected old-reader/recovery/application-image qualification belong to outer UX12-INTEGRATED after M54 and remain pending. No release qualification claimed.
