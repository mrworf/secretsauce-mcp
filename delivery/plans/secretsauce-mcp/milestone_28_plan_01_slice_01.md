# M28 slice 01 — Edit one destination with clear certificate scope

## Goal and observable behavior

An Owner/Administrator sees allowed servers and the service certificate default, edits a selected destination in a focused advanced view, returns preserving all exact fields, and saves only a draft. Auditor reads the same effective scope; Member cannot mutate or inspect administrative configuration.

## Scope and dependency

Requires accepted M27 focused editor. Ordinary URL/matching explanation, visible service-wide TLS default, per-destination inherited/explicit effective certificate status, focused scheme/port/host/reference controls with cancel/keep, service reference access, repeated item focus. Existing backend validation and exception acknowledgments remain authoritative. No runtime transport algorithm, credential dialogs, policy dialog, lifecycle or grant redesign.

## Entry/state/authorization

Services → Configuration → Destinations → selected Advanced settings → keep/cancel → draft save → existing reviewed activation. Local options are cloned, kept atomically into the in-memory draft, and Cancel restores the prior selected destination while preserving other work. Existing backend save/review/apply guards continue checking current Owner/Administrator/enrollment, revision and durable audit; no new command. UI-only navigation never saves or activates. Read-only and Member paths remain restricted.

## Validation and errors

Linked local errors for URL, host matcher/regex and integer port bounds; preserve invalid non-secret input for correction, reject invalid keep/review without losing other work. Incomplete draft saving remains supported. Existing server validation remains final authority and unsafe TLS/HTTP/broad host exceptions require explicit review acknowledgment. Existing stale and uncertain command responses retain inspection/recovery route.

## Surfaces

`src/consoleServicePage.ts`, `src/consolePresentation.ts`, directly affected tests, new `scripts/verify-console-destinations-browser.mjs`, operator guidance and evidence. Investigate existing configuration normalization for exact vs suffix semantics and legacy name/id preservation before changing controls.

## Positive/negative checks

- Inherit/on/off and service default updates display effective value/source; overridden destination unchanged by service default; HTTP clearly distinguished.
- Exact/suffix/regex plus multiple imported matchers, schemes/ports/legacy identifiers remain literal through keep/cancel/global modes/save. Reject malformed regex, URL, bad/out-of-range ports; no silent correction/default.
- Selected destination only, Cancel/return retain safe draft, new destination focus and announcement, discoverable copyable MCP reference.
- Owner/Administrator saves, Auditor read-only, Member denied; malformed/direct unauthorized/stale save cannot publish; lost response not claimed success. Security exception acknowledgment remains required.
- Real HTTPS browser desktop/narrow/options, keyboard, 320px and doubled computed text ranges; screenshot comparison to approved references. Regression focused-editor and services harnesses run sequentially.
- Final full suite `npm test -- --maxWorkers=2` and `npm run build`; no concurrent browser workload. Unit/domain tests discovered from existing test tree, recorded with results.

## Acceptance / commit boundary

All seven M28 criteria mapped in evidence/qa/secretsauce-mcp/milestone28/acceptance.md and matching visual review with final input hashes. One commit includes this plan, implementation, tests, operator documentation and evidence, excluding pre-existing test-results. Parent records final SHA without self-reference.

Status: implemented and validated; commit pending.

## Execution and evidence

The runtime already supported inheritance; no transport/schema changes were needed. Selected options use cloned in-memory state. Keep/return and the existing save-before-leave guard include that state; Cancel restores only this visit. Imported legacy name fields stay name fields. Compact domain array rows and focused Connection/Host matching replaced initially excessive generic row height.

- Focused managed service/HTTP tests: 13 PASS.
- Final local HTTPS destination browser: PASS, including linked invalid fields, unchanged Cancel, lossless keep/global modes/save, unknown admitted response, safe save-before-leave and Auditor read-only.
- Focused-service, service-journey, friendly-forms regressions: PASS. Existing tests adapted only for new accessible labels/focused entry; assertions retained.
- Final `npm test -- --maxWorkers=2`: 731 tests / 73 files PASS, 104.04 seconds. `npm run build`: PASS (also executed by final full-suite pretest). No concurrent browser/Docker load.
- [Acceptance criterion map](../../../evidence/qa/secretsauce-mcp/milestone28/acceptance.md), [visual comparison](../../../evidence/ux-acceptance/secretsauce-mcp/milestone28/visual-review.md), [tested source hashes](../../../evidence/qa/secretsauce-mcp/milestone28/tested-inputs.json).

Parent records final exact commit SHA after acceptance. No extra user decision, waived requirement, live deployment or new external-client claim.
