# M32 — Understand configuration and execution access

Parent: `df4206e07756693c69b40b38e7d7628b8321203c`. Product `secretsauce-mcp`.
Authority: milestone 32; REC-RM-024; approved UX4 details/access/authentication/policy; UX-IA10, UX-IN15/16, UX-C46/52. Source d0dffc6; planning 49a58c3. Only pre-existing dirty path: `test-results/` (excluded).

## Ordered slices
1. [Contextual configuration guidance](milestone_32_plan_01_slice_01.md): placement fields/placeholder, local help and approved authentication structure.
2. [Explicit execution access](milestone_32_plan_01_slice_02.md): current vs proposed, immediate confirmed add/remove, dependency/unknown handling and final acceptance.

All slice plans persisted before production edits. No navigation/tester redesign (M33), credential mutation changes, destination/rule redesign, implicit grants, roles, deployment or live volumes. Keep exact existing literals and generic capabilities. Root owns goal/status and exact final commit provenance.

## Validation
Focused service/presentation/HTTP and header tests while iterating. Actual disposable HTTPS browser matching approved desktop/390px plus 320px/200% text, keyboard and negative boundaries. Final full suite `npm test -- --maxWorkers=2`, build, no browser/Docker overlap. Existing M30/M31 regression harnesses sequential. Final evidence under milestone32 QA/UX directories with hashes, criteria map and visual comparison.

## Results
Slice01 committed `be330b2` with focused tests and actual browser evidence. Slice02 delivered current/proposed access and confirmation boundaries; 751 tests /74 files and final build PASS. See [acceptance](../../../evidence/qa/secretsauce-mcp/milestone32/acceptance.md) and [visual review](../../../evidence/ux-acceptance/secretsauce-mcp/milestone32/visual-review.md). Root records exact slice02 commit SHA after successful commit.
