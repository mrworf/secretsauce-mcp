# M26 — Service lifecycle rows

Parent: 7adde2bdb8733c1476b10aa686b5b894897f432e. Product: secretsauce-mcp. Only pre-existing untracked path: test-results/ (excluded). Authority: milestone 26, UX4/UX-IA09/IN03/C43, REC-RM-016; planning handoff 49a58c3. No deployment or authority edits.

## Plan review
Two independently reviewable outcomes: readable linked lifecycle rows; then guarded lifecycle actions on those rows. Preserve current draft/apply and archive semantics. Activation opens explicit existing configuration review, never silently applies. The later editor/history milestones remain excluded. No unresolved product decisions.

## Slices
1. [Linked lifecycle/readiness rows](milestone_26_plan_01_slice_01.md) — complete (commit recorded by parent).
2. [Confirmed lifecycle actions](milestone_26_plan_01_slice_02.md) — pending.

## Validation
Focused service tests per slice. At final milestone npm test -- --maxWorkers=2 and npm run build, sequentially from browser work. Actual HTTPS browser role/state/action journeys, 1440×1000 and 390×844 screenshots against approved services references, keyboard and 320px/200% text ranges. Evidence under evidence/ux-acceptance/secretsauce-mcp/milestone26 and evidence/qa/secretsauce-mcp/milestone26. No downstream transport change or new Docker-specific behavior.
