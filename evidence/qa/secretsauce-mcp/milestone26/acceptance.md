# M26 acceptance

Source: REC-RM-016 / UX-C43 / CONFIG-05, approved UX4. Parent 7adde2bdb8733c1476b10aa686b5b894897f432e; slice 01 172210a. Tested source/reference hashes: tested-inputs.json.

| Criterion | Evidence |
|---|---|
| Independent Active + draft and unavailable value/configuration | New service unit tests; lifecycle browser current state fixture, missing-value screenshot; no health probes |
| Real keyboard row link, independent actions, retained filter/search | Lifecycle browser keyboard link and return; direct URL; actual dialog interaction; search remains Container |
| Confirm Delete/Disable/Enable, retained archive and Disabled restore, Cancel no effect | Lifecycle browser Cancel/Escape and durable state checks; service runtime integration and service unit lifecycle test |
| Current role/dependency checks, stale confirmation/history/restore protections | Lifecycle fingerprint includes draft generation and existing revision/identity/value dependencies; malformed/stale/demotion unit tests; Auditor direct HTTP 403; archived review and restored stale draft rejection; existing history/runtime tests |
| Permission/state positive and negative, capability preservation and no output secrets | Focused 27 unit/API/runtime tests, exact advanced roundtrip tests; Member discovery/no grants, Auditor readonly and Owner/Administrator permissions. State views expose only availability. New fingerprint is optional for legacy callers; legacy commands still authorize and check current lifecycle; no direct enable command exists. |
| Actual screenshots and responsive keyboard/text | Visual review + browser-report.json, approved desktop/narrow match, 320px/200% document/component/text-range checks |
| Independent checkpoint | Existing review editor remains explicit Enable route; no later editor/credential-clearing redesign required. No deployment or live state used. |

## Commands

- npx vitest run test/console-services.test.ts test/console-services-http.test.ts test/console-service-runtime.test.ts --maxWorkers=2 — PASS, 27 tests (local loopback permission).
- npm run build — PASS.
- PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-lifecycle-browser.mjs — PASS, isolated synthetic HTTPS, final screenshots.
- PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers CONSOLE_BROWSER_EVIDENCE_DIR=/tmp/m26-m25-regression node scripts/verify-console-import-recovery-browser.mjs — PASS, predecessor mapping flow.
- PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers CONSOLE_BROWSER_EVIDENCE_DIR=/tmp/m26-services-regression node scripts/verify-console-services-browser.mjs — PASS, 8 existing create/edit/lifecycle checks.
- npm test -- --maxWorkers=2 — PASS, 730 tests across 73 files; 105.77 seconds, including pretest npm run build. No browser/Docker concurrent.

## Limitations and corrections
No transport/container/recovery format change; Docker crash/restore drill is unchanged and integrated M34 scope. External ChatGPT/Codex live validation exception remains unchanged. Browser lost-response fixture commits the same admitted lifecycle command then drops its response; subsequent UI refresh verifies durable state. Initial fixture attempted Playwright route.fetch without Node DNS mapping; corrected to local admitted-command injection. Initial row heading lifetime defect and narrow toolbar wrap were corrected before acceptance. Existing browser helper selectors now target real links instead of obsolete Open buttons; untouched journeys remain M34 integrated checks.
