# M36 acceptance evidence

Tested input: `tested-inputs.json`, based on accepted M35/root commit09ae25e7ee6a6aec7d66e76f84a875c67d0776a9. Only presentation and error-status metadata changed; service apply, exception identity generation, audit, transport and storage remain unchanged. Browser sources and tests were stable for the final passing browser; hashes were captured before the final full suite and verified afterward.

| Criterion | Evidence / result |
|---|---|
| No-exception and multiple-exception confirmation, no mutation on opening/cancel, focus/context restoration | Actual HTTPS `scripts/verify-console-approval-browser.mjs`: named heading focus, keyboard trap, Cancel/Escape, immutable state snapshot, retained Changes/New settings. Both valid confirmation variants pass. |
| All individual acknowledgments, exact server authority, reopen/stale/role/dependency safety | New focused test sends missing, partial, extra and friendly-label-forged acknowledgment inputs to existing manager; all reject without activation, exact originals succeed. Browser stale revision and Auditor demotion reject; reopened/stale checkboxes reset. Existing service/runtime/credential tests retain base/draft/credential and initial-grant eligibility fences. |
| TLS inherited/overridden scope, mixed protocols | Seven focused approval tests cover false default + true override, true/omitted + false override, all inherited, HTTP-only, mixed HTTP/HTTPS and separate obligations. Duplicate IDs are filtered by actual risk before displaying context. No change to transport or original exception identities. |
| Safe distinguishable labels, other risks and recovered permissions | Unit tests use duplicate/missing/internal IDs, malformed and userinfo/query-bearing URLs, own-property names, broad matching, reduced scanning, default allow and recovered risk. Actual browser confirms URL secret parts absent and hostile HTML rendered inert. Existing recovered Owner-only contract remains unchanged and covered by full regression. |
| Pending/rejected/success/unknown outcomes | Browser delays actual POST: Continue and cancellation disabled, Escape cannot dismiss, one submission. Known success names active revision1; stale/permission rejection retains safe work. Malformed successful response after actual durable commit leaves outcome unknown, Continue disabled; current service read observes active revision2 before viewing current configuration. No blind resend. Existing durable completion uncertainty test checks published revision and operation status. |
| Matching visual variants and accessibility | UX evidence at `evidence/ux-acceptance/secretsauce-mcp/milestone36/visual-review.md`; actual desktop1440×1000, narrow390×844/320×800 and doubled text at320. Document/text-range overflow checks pass; keyboard trap/focus/Escape pass. Root independently inspected desktop/390 exception and desktop no-exception screenshots. |
| Joined M35/M36 and supported custom data | Browser edits Guided then Advanced, saves custom method/regex/binary settings, compares Changes and full typed New settings, approves into active revision. Sanitizer and no persistent browser storage checks pass. M35 pure rendering tests and combined browser preserve exact values, array order, own-property names and no-baseline/no-change states. |

## Validation

- Focused initial service/review/approval:25 tests passed; affected helper rerun after duplicate-risk filter:7 approval tests passed. Final full suite covers the final helper again.
- Cumulative actual HTTPS browser: PASS, `evidence/ux-acceptance/secretsauce-mcp/milestone36/final/browser-report.json`. Chromium cache `/tmp/secretsauce-feedback-browsers`; disposable synthetic example.org DNS mapping and isolated temporary storage. No live instance touched.
- Final bounded full suite:772 tests/77files PASS (115.05s); separate build PASS. All13 frozen hashes verified unchanged. See `validation.json`.

## Resolved test iterations

Initial local listener EPERM was rerun with narrow permission. Early fixture failures were asynchronous review capture/demotion races, fixed by awaiting the visible completed review. Playwright request fetching did not inherit Chromium DNS mapping; replaced by malformed response injection in the disposable HTTPS server after a real commit. Destroying the socket can cause browser transport retries, so the final fixture supplies a complete HTTP response with invalid JSON and confirms one admitted submission. Browser failure reporting now excludes request call logs. These are superseded fixture/environment results, not remaining application failures.

No required behavior is deferred. No new Docker recovery or downstream transport changes require broader recovery drills. Existing external real-client validation exception remains; no real ChatGPT/Codex connection or deployment is claimed.
