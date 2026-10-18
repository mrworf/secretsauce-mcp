# M31 acceptance — focused policy authoring

Parent `4b76b3f2ac9ba733cdd6a10963551570ebad44ef`; source d0dffc6; planning 49a58c3. One coherent slice; final commit provenance is recorded by the delivery orchestrator.

## Contract coverage

| Criterion | Current evidence |
| --- | --- |
| No empty Basic form; same Add/Edit, exact prefill, cancel restores rule/focus | HTTPS browser: no old rule-id field, shared dialog, deep exact comparison after cancel/Escape/no-op Keep, restored dirty badge, initial/final focus. |
| Common selections and custom methods | GET/POST/etc checkboxes, retained PROPFIND visible and editable in Advanced, REPORT added, custom sequence unchanged on no-op. Invalid whitespace token rejected locally. |
| Priority/effects/exact-prefix-regex/hosts/reasons/scanner/binary/options | Browser adds and edits both effects, canonical literal escaping, extra regexes, imported constructor reference, disabled scanner rules, binary scan/unlimited/size. Invalid regex/canonical path/priority/duplicate ID/scanner selection/size rejected without source mutation. Full Advanced service roundtrip compared exactly. Existing shared typed catalog forms regression and advanced tests remain passing; service rules do not copy or rewrite global typed catalog options. |
| Effective ordering / movement | Four-rule fixture proves descending priority, Deny tie and stable same-effect order; bounded movement swaps peer source positions only, unchanged numeric priorities. Disabled boundaries and impact explained. Runtime algorithms unchanged, existing policy/preview tests pass. |
| Actionable local errors / contextual names | Dialog alert links focus affected inputs and associate descriptions; visible Edit/Delete with accessible rule reference; no mutation on invalid Keep. |
| Permissions/state/unchanged capability | Owner and Administrator save, demoted editor rejected server-side, Auditor read-only, Member inspection/authoring denied. Stale save retains proposed explanation; admitted lost response reports unknown, durable reopening shows actual draft. Existing service regression exercises review/apply with credentials/destinations, and friendly forms exercises scanner and binary controls. No secret entry/logging surface added. |
| Actual visual/accessibility | [Visual review](../../../ux-acceptance/secretsauce-mcp/milestone31/visual-review.md), complete production screenshots and browser report: desktop, 390/320px, all-text 200%, keyboard focus/return. |
| Independently demonstrable | Rules author/save now; M32 help/M33 tester navigation/M34 integrated recovery remain separate. No later outcome substitutes for current acceptance. |

## Validation record

- Focused `npm test -- --maxWorkers=2 test/console-services.test.ts test/console-advanced.test.ts test/policy.test.ts test/basic-policy.test.ts`: 32/32 passing.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-policy-dialogs-browser.mjs`: PASS; final source hashes captured separately.
- Existing `verify-console-services-browser.mjs`: PASS, 8 checks, local setup 2219 ms. Updated intentional heading/new-dialog selectors only.
- Existing `verify-console-friendly-forms-browser.mjs`: PASS, including shared typed catalogs and rule scanner/binary controls.
- Initial HTTPS sandbox listener EPERM was rerun with loopback permission. Initial regression failures were obsolete heading/inline-form selectors, updated to the specified new UI without weakening outcomes. New unit fixture initially expected save to validate a binary size that is intentionally activation-time validated; corrected to malformed typed input, with size validation separately proven in the dialog. No production behavior weakened.
- Final complete `npm test -- --maxWorkers=2`: **749 tests / 74 files PASS**, 106.46 seconds, no concurrent browser/Docker work. Final `npm run build`: PASS. A CSS-only narrow stacking adjustment after suite start was covered by a fresh final M31 browser run and final build; executable behavior/tests are unchanged. See validation.json for pre-adjustment stylesheet hash and tested-inputs.json for final sources.

No downstream transport, container launcher or recovery protocol changed; Docker crash/recovery drills remain the explicit M34 integrated gate. Actual external ChatGPT/Codex connection is not claimed by local tests. No live instance or volumes touched.
