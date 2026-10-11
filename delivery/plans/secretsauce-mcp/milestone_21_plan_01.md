# M21: Friendly configuration and lossless import

## Outcome and authority
All UX-IA06 capabilities use labeled controls and readable effective/review summaries, preserving exact same-draft semantics and existing advanced tooling. Governing contract: ../../milestones/secretsauce-mcp/21-friendly-configuration-and-import.md; product/ux/01-information-architecture.md UX-IA06; state/security contracts; AGENTS.md.

## Delivery goal
Product secretsauce-mcp; fixed M18–M21 goal, this transaction M21 only. Source/planning identity is pinned by workflow/delivery-planning/handoff.yaml and milestone status. Parent 631f866. M18–20 complete. Preexisting untracked test-results/ excluded. Root alone owns milestone status.

## Current state and decisions
Existing encrypted drafts, bounded schemas, importer and reviews remain authoritative. Service forms already cover many basic fields; catalog/rule options and mappings still require JSON. Reuse API contracts and create bounded typed controls rather than change semantic schemas. Import preserves supported legacy identifiers while new manual creation keeps restrictions. Read summaries show every supported value without exposing credentials. No new gateway features or upstream authority changes.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit |
| --- | --- | --- | --- | --- | --- |
| 01 | milestone_21_plan_01_slice_01.md | Guided lossless import | M20 | complete | pending SHA | |
| 02 | milestone_21_plan_01_slice_02.md | Catalog and policy friendly editors | 01 | pending | |
| 03 | milestone_21_plan_01_slice_03.md | Remaining capability summaries and browser acceptance | 02 | pending | |

## Cross-slice concerns
Preserve authorization, generation/revision/audit checks, write-only immediate actions, M20 atomic full-settings review, inheritance, exact regex/order/options and safe dictionary keys. No browser persistence. Host file/environment references never read. Bound recursive form construction and inputs to existing server constraints. Secret fields cleared after submission. No production deployment or user-instance access.

## Completion gate
Targeted positive/negative tests each slice, capability-level HTTPS browser tasks at desktop/320px/200% text with document/text-range checks, full npm test and npm run build. Evidence under evidence/qa/secretsauce-mcp/milestone21/. Record every UX-IA06 row. Existing gateway and security regressions stay passing.

## Rollback
UI changes retain compatible schemas and advanced tooling; imported drafts use existing persisted structure. Reverting UI must not revert users' configuration state.

## Execution notes
Planning self-check: three independently testable vertical outcomes; all slice plans persisted before production changes. No unresolved product questions.
