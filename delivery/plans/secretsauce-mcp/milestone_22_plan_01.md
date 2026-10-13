# M22: Readable forms and service configuration
## Outcome
Readable, wide, accessible forms and a collision-free five-step service authoring journey matching approved visual composition.
## Delivery-goal context
Product secretsauce-mcp. Governing contract: delivery/milestones/secretsauce-mcp/22-readable-forms-and-services.md; UX3 UX-IA08/IN11/R05/A06/V05/C37/C41/C42; docs/web-console-prd.md UX-02/03/04 CONFIG-01; AGENTS.md. Parent 6f4cb32; unrelated test-results/ excluded. Autonomous M22 only within root goal M22–24. No schema, authorization, stored-state or gateway changes; preserve exact literals and existing save/review behavior. Never touch running review instance.
Status/packet: delivery/milestones/secretsauce-mcp/status.yaml; source/planning provenance: workflow/delivery-planning/handoff.yaml. New transaction, fixed goal M22–24, current M22.
## Findings and decisions
Console is vanilla DOM generated from TypeScript strings. Shared field helpers and stylesheet are centralized. Existing wizard uses browser list markers in a wrapping flex list (collision source). Preserve APIs and IDs, enhance common controls and use normal-flow explicit markers. Match approved neutral surfaces, orange accents, rails and meaningful desktop columns without changing M24 lifecycle. No product decisions unresolved.
## Scope
Shared language, shell, input cues and help; then complete service forms and visual evidence. Excludes M23 account model/detail and M24 settings lifecycle/SMTP.
## Slice index
| Slice | Plan | Outcome | Dependency | Status | Commit | Evidence |
|---|---|---|---|---|---|---|
| 01 | [slice 01](milestone_22_plan_01_slice_01.md) | Shared readable forms and shell | none | completed | introducing slice commit; recorded at next checkpoint | shared/focused-settings-browser-report.json |
| 02 | [slice 02](milestone_22_plan_01_slice_02.md) | Service journey and visual acceptance | 01 | pending | | |
## Cross-slice concerns
No migration, no authorization changes. Required status follows current control state. No browser secret persistence or new external inputs. Preserve unsaved guards and exact values. Isolated HTTPS synthetic browser only.
## Completion gate
Focused forms/unit/browser regressions; service five steps, six overlap states at 1280/320, add/remove/error/help/long strings, keyboard, 200% text and document/text-range bounds. Actual/ref screenshot comparisons 1440/390 where provided, including service-desktop and shared Email composition. npm test and npm run build. Inspect cumulative diff and evidence before root acceptance.
## Rollback
Revert presentation commits; no stored-state migration.
## Execution notes
Planning persisted before production edits. Root owns goal/status transition. Slice hashes recorded by next commit/root closeout to avoid self-reference.
