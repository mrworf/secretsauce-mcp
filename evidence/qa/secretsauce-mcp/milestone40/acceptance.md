# M40 acceptance evidence

Parent: 2066aa60c0a438c325888975627bab1534be9eae. One presentation-only slice. Canonical authority: M40 contract and UX6 UX-IN16/V08/A09/C62–63. No deployment, scanner/API/storage/permission change or slider.

| Criterion | Evidence | Result |
|---|---|---|
| Every explicit override, including increasing/default-equivalent; inherited absent | final/policy/browser-report.json; override-variants screenshots; Object.hasOwn classification covers either owned family, including empty binary object | PASS |
| Add/edit/cancel/removal update local marker; exact custom values/order retained | Policy browser checks cancel addition/removal, keep addition/removal, Add marker, 123457b, unlimited, PROPFIND/REPORT/custom regex, Guided/Advanced, unchanged durable draft before Save | PASS |
| Actual risk and exact acknowledgment gates remain separate; stale/unauthorized reject | 25 focused policy/basic-policy/review/approval tests; policy demotion/stale browser and joined approval browser; no changes to exception classification or server | PASS |
| Arbitrary supported sizes/unlimited retained; zero/invalid rejection distinct from scan=false | Policy browser validates 0kb/nonsense/unsupported literals, retains 123457b/25kb/unlimited and separate scan flag; runtime policy regressions unchanged | PASS |
| Desktop/narrow/text200 approved appearance, visible non-hover marker, no overflow | UX visual-review.md and actual policy/approval captures; document/text-range checks, focus/Cancel/Escape | PASS |

Commands: focused npm test -- --maxWorkers=2 test/policy.test.ts test/basic-policy.test.ts test/console-service-review.test.ts test/console-service-approval.test.ts: 25 tests in four files PASS. Actual HTTPS scripts verify-console-policy-dialogs-browser.mjs and verify-console-approval-browser.mjs PASS with PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers and isolated milestone40 evidence directories. Both suppress Playwright request call logs.

A first joined approval run found a harness expectation mismatch: newly visiting Access & policy changed the section returned to by Back to edit, while a later regression expected Details. Restored explicit Details navigation before review, without product changes, and reran joined approval successfully. Policy evidence remains current: only the independent approval harness changed afterward. All executable inputs frozen before final full suite; hashes recorded in tested-inputs.json. Final suite/build outcome recorded in validation.json.

External ChatGPT/Codex connection remains the previously accepted manual limitation; generated local fixtures establish local behavior only. No new waiver or required work deferred. No AGENTS lesson needed: existing request-log suppression requirement applied to extended harness.
