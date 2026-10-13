# M22 slice 02: Collision-free service authoring and approved visual fidelity
## Goal and scope
Collision-free service authoring and approved visual fidelity. Product secretsauce-mcp. Governing contract: delivery/milestones/secretsauce-mcp/22-readable-forms-and-services.md; UX3 UX-IA08/IN11/R05/A06/V05/C37/C41/C42; docs/web-console-prd.md UX-02/03/04 CONFIG-01; AGENTS.md. Parent 6f4cb32; unrelated test-results/ excluded. Autonomous M22 only within root goal M22–24. No schema, authorization, stored-state or gateway changes; preserve exact literals and existing save/review behavior. Never touch running review instance.

Excludes account editing and populated Settings lifecycle/SMTP. Dependencies: slice 01 committed.
## Entry and behavior
Existing console routes and form controls retain their handlers, state and permissions. Present current labels, required cues and short help; preserve values and guards across navigation. Normal-flow responsive composition, no clipped capabilities.
## State and authorization
Presentation-only. Existing API authority, draft review and immediate secret actions unchanged. Errors preserve safe work and clear secret inputs where current contract requires.
## Implementation surfaces
src/consoleServicePage.ts wizard, shared CSS, browser verification and evidence.
## Validation and recovery
Actual HTTPS service five steps plus retained round-trip/import tests; invalid required field, Back preservation, repeatable add/remove/errors/help/long text, 1280/320 screenshots, keyboard/200% text; compare approved service and shared Email references; full npm test and build. No tests weakened. Listener EPERM requires same-command permission rerun. Required indicators must not alter optional validation. Capture sanitized synthetic evidence only.
## Acceptance
Every scoped observable behavior passes positive and negative checks; retained functionality reachable; no material approved visual drift remains. Required tests pass.
## Commit boundary
One coherent commit including implementation, focused tests, this plan and evidence. Status completed. Introducing slice commit owns this plan and evidence; root closeout records exact SHA.

## Execution and evidence
- Slice 01 prerequisite: 0c5da08cc2275f9f6d5fa1307473708d7ad0de50.
- Same five-step service state/validation and API; explicit marker spans, fluid columns, compact destination cards, retained advanced connection controls, full-width action footer and readable narrow actions.
- New primary host matching uses existing host matcher schema; invalid URL leaves draft unchanged, valid suffix/exact choice is verified, no existing literals silently normalized.
- Visual review corrected card density, title/remove alignment, header account/location and footer placement. Real screenshots match general approved composition; references unchanged.
- Investigation discovered duplicate auth-resource IDs in existing external OAuth form. Required/optional decoration oscillated on the wrong label and stalled the renderer. Local-label lookup is idempotent; external resource now uses unique ID/FormData name and independent round-trip assertions. No backend authority changed.
- `npm test` final PASS: 668 tests/71 files; build PASS. Isolated HTTPS services, focused Settings, friendly forms, friendly import and recovery browsers PASS. Exact evidence/hashes and failure classification: evidence/qa/secretsauce-mcp/milestone22/validation.json; acceptance mapping: acceptance.md. Visual pairs: evidence/ux-acceptance/secretsauce-mcp/milestone22/comparison.json.
- Preexisting test-results/ remains excluded. No live user instance or external MCP service touched.
