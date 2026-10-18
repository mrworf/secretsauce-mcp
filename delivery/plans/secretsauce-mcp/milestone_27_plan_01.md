# M27 focused service editing

Parent HEAD: 0b09efaddcb314d0c908d561fbf480cf1c7904e0. Product: secretsauce-mcp. Source: milestone 27, definition d0dffc6, planning 49a58c3; approved UX4 feedback003. Pre-existing `test-results/` is excluded.

## Outcome and boundary
Deliver grouped actual Overview and focused role-permitted configuration with one lossless whole-draft mode switch. Preserve all domain algorithms and fields. No destination/credential/policy specialized redesign, lifecycle semantics, authority edits, deployment or goal-status changes.

## Slice index
1. milestone_27_plan_01_slice_01.md — Completed, commit 46528c5: grouped applied overview and read-only focused sections.
2. milestone_27_plan_01_slice_02.md — Completed: populated focused editor, global modes and directly navigable creation (slice commit identifies provenance).

## Validation
Dedicated synthetic HTTPS browser harness covers positive/negative state and permissions, exact advanced roundtrips, unsaved/invalid transitions, approved desktop/narrow screenshots, keyboard and 200% text range overflow. Focused service tests per slice; build and complete `npm test -- --maxWorkers=2` at final milestone. Run applicable browser regressions sequentially. Preserve no-secret metadata and local-only disposable fixtures. Evidence under evidence/ux-acceptance/secretsauce-mcp/milestone27.

Planning inspection: slices independently useful; only selected section renders; specialized controls remain existing until their milestones. Final review is explicit, save remains draft-only, server authorization unchanged.

## Final outcome
All M27 acceptance rows are mapped in evidence/ux-acceptance/secretsauce-mcp/milestone27/acceptance.md. Full suite 730 tests / 73 files PASS; build and six actual HTTPS browser suites PASS. No live instance mutations or product authority changes. Later specialized destination/credential/rule/review redesign remains outside this milestone.

Accepted commit provenance: `58686d04b39880df3b86f0634d5bd7d4a874a0b7`.
