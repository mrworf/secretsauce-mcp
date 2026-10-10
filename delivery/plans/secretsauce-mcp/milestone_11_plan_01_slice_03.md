# M11 slice 03: Service-first console and five-step setup

Status: complete. Full suite 427/427 across41 files; build and both actual HTTPS browser harnesses pass. Evidence `evidence/qa/secretsauce-mcp/milestone11/slice03.md` and `acceptance.md`. Review corrections included own-safe disabled runtime lookups, positive partial-body fixture, literal-prefix policy escaping, direct grouped editing and compact desktop summaries. Parent transaction `9a9f619b3901b256ea6ebe242211425b0c00f874`.

## Goal and outcome
First Owner completes Details → Destination → Authentication → Access & policy → Review with keyboard, safe Back/draft behavior and readable applied state at 320px.

## Scope and non-scope
Search/filter list with Archived and separate draft/exception state; Overview/Configuration/Access/Activity tabs; grouped multi-destination/credential forms, inherited TLS, basic policy; immediate confirmations; full review/stale compare/reload and uncertain-operation guidance. Advanced authoring remains M13.

## Dependencies
Slices 01–02 APIs complete.

## Entry point and complete behavior
Console login → Services → Add service steps → optional immediate value save → draft save/review → exact exceptions acknowledged → apply → detail current state.

## State transitions
Browser retains only non-secret in-memory form draft; no persistent storage. Values clear after action. Navigate with explicit unsaved confirmation; cancelled immediate actions unchanged.

## Authorization
Current role controls are refreshed from status; server is authoritative. Read-only/audit restricted actors omit writes.

## Validation, errors and recovery
Actual HTTPS rendered keyboard setup under 15 minutes; 320px list/forms/review/confirm/errors; positive multiple destination/placement form roundtrip; negative validation/stale/forbidden/offline states and cancel; full npm test/build regression. Sanitized failures preserve safe task context. Uncertain completion uses actor-scoped operation status and current state reload, never blind replay. Faults are classified before fixing.

## Implementation surfaces
src/consolePage.ts, src/consoleServicePage.ts, scripts/verify-console-services-browser.mjs, tests, evidence/docs.

## Tests and commands
Focused `npx vitest run test/console-services.test.ts` (plus runtime suite in slice 02); related console suites. Slice 03 runs `npm test`, `npm run build`, browser harness. All new external fields positive/negative; meaningful failure and concurrency evidence recorded.

## Acceptance
Required UX-C02/03/05/06/07/08/10/15/20/21/22/25 observable checks; all four M11 criteria mapped to evidence.

## Commit boundary
One coherent slice commit includes this plan status, governing index status, production/tests/docs and owned evidence. Unrelated `test-results/` excluded. No milestone status/source authority changes. Implementation unknowns investigated within settled semantics; genuine authority blockers reported to root.
