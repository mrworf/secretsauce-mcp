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
