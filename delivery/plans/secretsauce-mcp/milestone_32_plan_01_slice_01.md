# M32 slice 01 — Understand credential placement

Authority and parent: milestone32 / REC-RM-024 / UX4, parent df4206e. Existing authorized workflow supplies implementation plan generation. Preserve test-results/. No new product decisions.

## Outcome and scope
An operator sees contextual Header/Query/Body placement labels, accurate gateway-owned-header consequences and placeholder-only prefix/value/suffix preview in a two-column authentication card. Single custom placement hint is visible. Docs link explains LLM use. Existing destination matcher semantics/default policy/reason guidance remain accurate and tested; no capability/literal dropped.
## Behavior and state
Guided Authentication edits the same safe draft. Changing kind updates local label/help/preview without save/apply. Header ownership stays explicit/default-off; invalid non-header enforcement cannot be applied. Value dialogs remain independent M30 work. No resolved value enters preview. Preserve custom names, spaces and unknown kinds. Read-only view retains safe metadata.
## Permissions and errors
Existing configuration permissions apply; no new API. Required cues only reflect actual schema requirements (generic placement name remains optional unless enforced header). Validate malformed controlled fields through existing draft/review. No hidden mutation on guidance/navigation.
## Surfaces and validation
consoleServicePage/Presentation and operator docs; browser help harness; focused existing services/presentation/header tests. Actual desktop/narrow/200% screenshots compare approved authentication and details; test live contextual updates, exact-literal roundtrip, no secret echo, keyboard and generic hint. Existing M30 browser regression before final acceptance.
## Acceptance / commit
All above behaviors independently visible without slice02. Focused tests and actual browser help checks pass. One commit includes this plan, implementation, tests and evidence; parent records exact SHA. Full suite mandated at final milestone after slice02.

## Result
Implemented. Focused Vitest: 18 tests / 3 files PASS (console-services, console-services-http, header-enforcement). Build PASS. Actual service-help HTTPS Chromium harness PASS after correcting inherited fieldset grid and checkbox help placement found in screenshot inspection. Desktop/390/320/200% screenshots and visual review under evidence/ux-acceptance/secretsauce-mcp/milestone32. No production/backend input changes; representative custom placement roundtrip plus invalid enforced-header and placeholder safety exercised. Final full suite/regressions remain slice02 boundary. Root records exact slice SHA.
