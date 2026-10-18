# M27 focused service configuration acceptance

Scope: REC-RM-017/018, CONFIG-01/03, UX-IA09/IN15/C44/C45. Two minimal slices; no domain persistence, authorization, gateway transport, credential-clear, or policy algorithm changes. Parent source 0b09efa; slice 1 46528c5.

## Evidence and checks

The dedicated `scripts/verify-console-focused-service-browser.mjs` uses an actual isolated HTTPS gateway, protected ConsoleStore and Playwright Chromium, with synthetic example.org fixtures. Its browser-report.json records exact tested implementation/reference SHA256 values. No live review container, volume or user credential is accessed.

| Milestone acceptance | Evidence |
|---|---|
| Actual Overview, pending draft, clear no-current guidance and exceptions | Dedicated browser distinguishes current name from pending name; four grouped cards; draft-only guidance and failed-load negative; overview screenshots. |
| One selected section | Dedicated populated Details → Destinations traversal verifies other section input absent; six section links; regression-services and regression-friendly exercise specialized controls still retained. |
| Read-only grouping; no empty-on-error | Auditor selected sections and full read-only Advanced; no Save controls; injected detail load failure shows error. Import regression checks direct Auditor mutation 403. |
| Draft-only save and full explicit activation | Dedicated save asserts applied description unchanged; existing service regression creates and explicitly reviews/applies all exceptions and rejects stale activation. |
| Lossless whole-draft mode | Dedicated exact equality across Guided/Advanced for custom method, regex source, binary settings and safe description/docs; friendly regression retains nested typed catalog, rule scanner/binary and destination scheme/port/TLS options. |
| Direct incomplete creation traversal | Dedicated jumps 1→3→2→5→1 with safe input retained; failed incomplete review leaves no applied service; service regression completes five steps by keyboard. |
| Respectful nonredundant Details/global mode | Matching details and advanced images: About this service, local help, MCP reference, one global Guided/Advanced control; no section-local full-editor links. |
| Browser navigation and invalid input | Dedicated Back/Forward section restoration and malformed section-location rejection without losing fields; Stay/Discard guards; malformed, empty and wrong-structure JSON remain in editor and cannot overwrite/save; advanced regression confirms preview inputs do not dirty draft. |
| Permissions, state, unchanged capabilities, no secret output | Existing service HTTP/domain tests, service/import/advanced regressions; no local/session storage; value inputs cleared, rendered review excludes synthetic secret; server role/Origin/CSRF/stale/audit checks remain intact. |
| Actual visual/keyboard/narrow/text acceptance | Dedicated 1440×1031 desktop, 390px matching narrow and 320px; Details/Advanced at 200% computed text inspect document and text ranges. Existing service regression inspects component/text geometry for creation and advanced destination/value forms. |
| Independent checkpoint | Focused editing, actual Overview, imported recovery and explicit draft/review operate with existing specialized destination, credential, rule and review controls. No later milestone implementation is needed to demonstrate this outcome. |

## Visual comparison

Compared actual Overview with approved overview-desktop/narrow PNGs and rendered approved details.html/advanced.html with actual same-width pages. Source hashes are in browser-report.json. Layout retains the approved shell, broad horizontal workspace, 180px section rail, white bordered cards, rust active/action treatment, two-column Details fields, full-width description, footer action group, lifecycle/current-revision and separate draft indicators, and single global mode control. The ← Services link is guarded. Narrow screens wrap section links and stack fields/actions; 200% text remains readable without horizontal document/text overflow. General appearance matches; no scoped visual waiver is claimed. Synthetic fixture text and operational button labels differ; proposal-only banners are not application UI.

Creation comparison is scoped to M27's five directly navigable steps, single mode control, focused form and footer. Existing nested destination advanced options remain accessible and unchanged pending M28's explicitly separate specialized destination redesign; this is the milestone boundary, not an exception to delivered M27 scope. Rule/value/review specialized redesign similarly remains assigned to later milestones.

## Regression findings resolved

- Focused Configuration initially omitted imported identity recovery. The editor now retains its corrective callout; the complete M25 recovery journey passes.
- A retained service editor exposed generic preview field handlers marking unrelated draft state dirty. Preview-only inputs no longer mark the draft dirty; the original advanced policy tester journey passes without an unsaved prompt.
- Browser fixtures previously reused identical saved-banner text before asynchronous saves/refreshes completed. They now await the response/current state. Explicit list navigation after reload accounts for the newly retained service URL. No timeout or assertion was weakened.
- Legacy advanced harness Settings labels/actions were updated to the already-delivered Settings UX; it makes a real catalog edit before saving instead of attempting a disabled no-op.

## Commands

- `npm run build`: PASS.
- `npx vitest run test/console-services-http.test.ts test/console-services.test.ts --maxWorkers=2`: 12 PASS; initial sandbox loopback EPERM rerun unchanged with permission.
- Dedicated focused service browser: PASS.
- Existing service, lifecycle, import recovery, friendly forms and advanced browser regressions: PASS; each report stored beneath this directory. Runs were sequential, isolated and headless.
- `npm test -- --maxWorkers=2`: PASS, 73 files / 730 tests, 105.50 seconds. Includes the pretest TypeScript build.

Operational checks: no Docker launcher, recovery, transport or host configuration changes; this is console presentation/navigation only. Actual HTTPS loopback is exercised. The milestone's external ChatGPT/Codex exception is unchanged; these fixtures do not establish external LLM interoperability or deployment readiness.

Final runtime source is covered by the dedicated browser report's hashes and the complete suite. Older regression screenshots precede the final service lifecycle header adjustment; their domain assertions remain applicable, while final header/layout/role/mode evidence is supplied by the dedicated screenshots. No later production edit follows the full suite.
