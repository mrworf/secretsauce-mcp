# M28 — Focused destination configuration

Product: secretsauce-mcp. Governing contract: `delivery/milestones/secretsauce-mcp/28-destination-configuration.md` (REC-RM-019, BASE-01, POLICY-04, UX-IN15/C46).
Parent: `0a8225aa81bf8cc20a3f1e51e79a5ab5aa39c953`. Definition `d0dffc6`, planning `49a58c3`; ready handoff `workflow/delivery-planning/handoff.yaml`. M27 completed. Pre-existing untracked `test-results/` is excluded.

## Persisted slice index

1. [Focused destination editing](milestone_28_plan_01_slice_01.md) — visible certificate defaults, ordinary host guidance, focused options and safe return, exact round-trip and browser acceptance. One independently testable destination journey; no artificial UI/backend split.

## Constraints

Preserve existing draft/review/apply, role/audit/dependency enforcement, destination transport semantics, imported IDs and literal fields. Do not implement M29–34 credential/policy/navigation redesign. No live deployment or data changes. Current browser references: approved UX4 destinations desktop/narrow and destination-options HTML. Historical proposal banners are not part of production UI.

## Validation and completion

Focused destination input and managed service tests during iteration. Actual local HTTPS browser covers ordinary/options, inheritance, invalid inputs, roles/stale/unknown outcomes, keyboard and 320px/200% text, comparison to approved references. Final full suite `npm test -- --maxWorkers=2`, build, applicable browser regressions sequentially. No concurrent full suite/browser workload. No downstream transport changes expected; if required, actual self-signed transport test becomes mandatory. Record QA/visual evidence and tested source hashes. Parent records final exact slice commit after acceptance; root owns milestone status.

Status: implemented and validated; root acceptance pending. One slice commit contains the complete destination journey. Exact SHA will be recorded by parent after commit.

Evidence: [acceptance](../../../evidence/qa/secretsauce-mcp/milestone28/acceptance.md), [visual review](../../../evidence/ux-acceptance/secretsauce-mcp/milestone28/visual-review.md). Full suite: 731 tests / 73 files PASS (104.04s), build PASS; destination and three relevant browser regressions PASS.
