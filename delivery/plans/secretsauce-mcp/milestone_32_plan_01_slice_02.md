# M32 slice 02 — Understand and confirm execution access

Authority and parent: milestone32 / REC-RM-024 / UX4, parent df4206e. Existing authorized workflow supplies implementation plan generation. Preserve test-results/. No new product decisions.

## Outcome and scope
Existing Access shows one compact row per current assignment and permitted Add/Remove actions. Roles alone do not grant service execution; request policy still applies. Initial configuration selections are proposed until review/apply, imported mapping remains separate.
## Behavior and state
Existing add/remove uses named target confirmation, current dependency fingerprint, server authorization/eligibility, durable audit admission and current list refresh. Confirming changes immediately; Cancel/Escape has no effect. Unknown reply disables repeat mutation until current durable state is inspected; no automatic retry/success claim. Keep legacy API inputs compatible while UI always binds fingerprint. Read-only Auditor sees safe summaries; Member detail remains forbidden.
## Errors / tests
Positive Owner/Administrator current grant/remove; negative missing confirmation, malformed fingerprint, stale identity/service state, role demotion, ineligible target, unauthorized direct HTTP/origin/CSRF. Unknown admitted response and failed durable inspection remain explicit. Initial grants never execute before apply. No secret output. Fresh fields require explicit eligible selection.
## Surfaces and validation
consoleServices/access command, consoleServicePage/Presentation, console services domain/HTTP tests, help/access HTTPS browser and operator guidance. Screenshot desktop/narrow/200% and keyboard/Cancel/focus against approved access; inspect details/authentication/policy. Final full suite/build and M30/M31 regression sequential. No transport change so no new downstream TLS or Docker drill (M34 integrated checks unchanged).
## Acceptance / commit
Every milestone criterion mapped to durable evidence and final tested hashes; no material unapproved visual drift. One slice commit after all required checks. Root records exact SHA and status; preserve earlier slice commit.

## Implementation and focused result
Current Access now uses compact assignment rows and a named dialog with explicit eligible selection, current dependency confirmation, Cancel/Escape and focus bounds. The optional API fingerprint preserves legacy command compatibility; all UI commands bind it. Failed/unknown mutation disables submission, offers current durable assignment lookup and requires a newly opened confirmation; reopening always reads current state. Initial grants remain proposed and separate from import mappings. No schema/runtime credential or transport changes.

Focused domain/HTTP: 16 tests across2 files PASS including malformed/stale/current-role/Origin/CSRF and no pre-activation grant. Actual service-help browser PASS at1440/390/320/200% text with unknown-response and failed-inspection recovery. M30 credential and M31 policy browser regressions PASS. Root-requested plain label 'Add credential' replaces technical 'Add credential identity'; matching regression selector updated.

Final suite result and exact SHA recorded at acceptance below.

## Acceptance
Complete. Final `npm test -- --maxWorkers=2`:751 tests/74 files PASS in105.84s. Final `npm run build`:PASS. Browser workloads stopped before full suite. Approved HTML-only access/details rendered independently after suite for actual screenshot comparison; general appearance conforms. Final source hashes in evidence/qa/secretsauce-mcp/milestone32/tested-inputs.json. Criterion map and regression reports in acceptance directory. Exact slice02 SHA recorded by parent, not self-referentially embedded.

Accepted commit provenance: `ff87637d6cda9a5744cb3c96d62db93758e2ff18`.
