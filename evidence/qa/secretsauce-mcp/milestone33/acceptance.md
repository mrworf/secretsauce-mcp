# M33 acceptance — service navigation and contextual policy testing

Source definition `d0dffc6`, planning `49a58c3`; parent `f12be0e`. Slice 01 `cf54365`; final slice SHA recorded by delivery parent after commit. Tested input hashes are adjacent in `tested-inputs.json`.

| M33 criterion | Evidence |
|---|---|
| Back/Forward/deep link/refresh and accurate safe-work guards | `scripts/verify-console-navigation-browser.mjs`: actual native history across Overview/Access/editor, exact Advanced text, readonly sections, refresh saved location, malformed route, Stay/Save draft/Discard, Forward after save. Existing focused service browser checks creation direct steps, incomplete review and exact supported option round trips. |
| Tester returns focus/scroll without false dirty or stacked rule dialogs | Navigation browser: real dialog, Escape focus return, unchanged draft status, rule-dialog non-stacking, unsaved description retained and request selection retained in memory. Dialog close restores captured scroll and the original focus node. |
| Identity/service/destination/method/path/source, canonical target and eligibility/rule/default/protection, no I/O | Navigation browser allowed/default denied/custom method/invalid path/method, selected source and diagnostics disclosure. `console-advanced.test.ts` spies assert no fetch or substitution; canonical evaluator parity, defaults/ties, effective protection and no mutation retained. |
| Shared detection explicit wider Settings and guarded work | Detection screenshots; browser Stay/Discard and Back from explicitly named shared Settings. Operator documentation updated. |
| Errors/session loss/stale state and honest outcomes | Browser malformed route/method/path and session removal clear modal/protected work; no false success result retained. Existing advanced tests reject changed source, access and disabled state during worker wait. Draft save uses existing stale/uncertain response handling and does not activate. |
| Permissions and preserved capabilities | Added preview test: Owner/Administrator/Auditor may investigate, Member rejected. Browser Auditor readonly and Member denied inspection. Existing advanced/history/runtime tests preserve exact regex, custom methods and hidden typed options; no credential input/storage/history. |
| Approved visual/keyboard/narrow/enlarged state | [Visual review](../../../ux-acceptance/secretsauce-mcp/milestone33/visual-review.md), browser report and matching-state PNGs. Initial density corrected before final screenshots. |
| Independently demonstrable checkpoint | Standalone disposable HTTPS harness starts current local sources; no M34 behavior required and no live installation used. |

Validation completed before final slice commit:

- `npm run build` PASS during final implementation; final full-suite pretest also rebuilds.
- `npx vitest run test/console-advanced.test.ts test/console-history.test.ts test/console-service-runtime.test.ts --maxWorkers=2`: 35 tests passed for slice 01; new preview role test subsequently passed in the 13-test advanced subset.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-navigation-browser.mjs`: PASS. Durable browser report/screenshots under UX acceptance.
- Focused service browser: PASS; M31 policy dialogs browser: PASS; advanced console browser: PASS (6 checks, including canonical denied preview and stale review), temporary regression output `/tmp/m33-{focused,policy,advanced}-regression`. Browser regressions run sequentially.
- `npm test -- --maxWorkers=2`: PASS, 752 tests across 74 files, 120.14 seconds; no concurrent browser or Docker workload. Explicit final `npm run build`: PASS. Final navigation browser rerun also asserts exact scroll return.

A local listener `EPERM` was resolved through authorized loopback execution. Browser discovery caught a navigation read race, an incorrect deep-link string delimiter, and a stale selector after the new diagnostics heading; each was repaired and its affected browser check rerun. No assertion or timeout was weakened. No backend transport/container/recovery protocol was changed, so Docker crash/recovery remains the M34 integrated checkpoint. Real external ChatGPT/Codex connection remains the existing exception, not a claim of this local evidence.
