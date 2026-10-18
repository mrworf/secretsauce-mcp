# M28 acceptance — destination configuration

Transaction parent: `0a8225aa81bf8cc20a3f1e51e79a5ab5aa39c953`. One coherent slice; definition `d0dffc6`, planning `49a58c3`, REC-RM-019. No transport/runtime algorithm or command schema changed.

## Criterion coverage

| M28 criterion | Delivered evidence |
| --- | --- |
| Visible service certificate default and effective source | Always-visible separate Certificate verification card; each server and selected options state inherited vs override and HTTP semantics. Browser tests default off/on, explicit true/false and inherit. Auditor inspection states the same scope. |
| Focused advanced options, safe exact return | Selected-destination Connection and Host matching views, no nested disclosure. Clone-based Cancel, Keep, return focus and save-before-leave. Final browser verifies exact arrays, legacy name reference and unrelated custom policy. |
| Discoverable references | Details displays/copies the MCP service reference. Destination reference is in advanced connection settings; legacy `name` remains `name` when untouched, custom imported rule ID persists. |
| Linked errors and explicit exceptions | URL, regex, suffix and integer port bounds link to controls. Browser rejected invalid URL/regex/IP suffix/65536; domain tests cover invalid direct inputs. Existing reviewed apply requires acknowledgments for HTTP/broad matching/default-allow/TLS exceptions. No silent activation. |
| Permissions, states and round-trip | Owner browser path, Administrator save/domain apply, Auditor read-only, Member detail/save denied. Existing HTTP Origin/CSRF/session checks plus current-role/stale boundary tests run. Lost admitted save response reports unknown and inspection route. Metadata contains no values; backend secret exclusion tests remain. |
| Actual browser/visual/keyboard/reflow | Final destination harness PASS; complete desktop, 390px, 320px and doubled computed text range captures for ordinary destinations, Connection and Host matching. Matching-reference review is linked below. |
| Independent checkpoint | All destination behavior works against M27 foundations without M29–34; review/save boundaries remain unchanged. |

## Validation

- `npx vitest run test/console-services.test.ts test/console-services-http.test.ts --maxWorkers=2` — PASS, 13 tests / 2 files. New test covers exact inherited/override references, Administrator mutation, Auditor/Member denial, stale save and exception acknowledgments.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-destinations-browser.mjs` — PASS against final source; local disposable HTTPS, no live review deployment. See browser-report.json and final source hashes.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers CONSOLE_BROWSER_EVIDENCE_DIR=/tmp/m28-focused-regression node scripts/verify-console-focused-service-browser.mjs` — PASS; focused editor/global modes and lossless hidden fields.
- Same environment with `/tmp/m28-services-regression` and `scripts/verify-console-services-browser.mjs` — PASS, 8 full service journey checks including grouped destination variants and review.
- Same environment with `/tmp/m28-friendly-regression` and `scripts/verify-console-friendly-forms-browser.mjs` — PASS; exact advanced scheme/port/matching/TLS edits.
- `npm test -- --maxWorkers=2` — PASS, 731 tests / 73 files, 104.04 seconds; final source.
- `npm run build` — PASS; full suite pretest also builds.

Regression checks preceded the final safe-options-leave integration; final destination browser explicitly covers the new guard path and unchanged global mode preservation. Full-suite evidence covers final source. Existing assertions/timeouts were not weakened. Final suite ran without concurrent browser or Docker load.

Early browser iterations corrected a key-order-sensitive test comparison, a fixture-only request interception, a direct-location Auditor setup, and visual density. The final lost-response fixture admits via the manager and drops only the response. No production validation was weakened to satisfy fixtures.

No downstream transport change: no extra self-signed downstream drill required. Local browser itself uses synthetic self-signed HTTPS. Docker crash/recovery drills remain the explicit M34 integrated gate; no image/launcher/state-format change in M28. Actual external ChatGPT/Codex connection is not claimed.

[Visual review](../../../ux-acceptance/secretsauce-mcp/milestone28/visual-review.md). Exact tested inputs: [tested-inputs.json](tested-inputs.json). Parent records exact slice SHA after acceptance.
