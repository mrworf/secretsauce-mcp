# M25: Resolve imported identities without reupload

## Outcome
An administrator can inspect each unresolved imported subject, explicitly map it to an eligible identity inside its saved service draft, retain unrelated work and reach fresh review without activation.

## Delivery-goal context
- Product: secretsauce-mcp; status: delivery/milestones/secretsauce-mcp/status.yaml.
- Active packet: M25–34; only M25 belongs to this transaction.
- Source d0dffc6; planning 49a58c3; transaction parent 549f7d8bdc38dd84f34280895f24091b6fa1dd7e.
- Resume mode: new. Pre-existing untracked test-results/ is excluded.

## Governing contracts
Milestone 25-import-identity-recovery.md; MIGRATE-01/02, UX-IA10/C51/V05/V06/A07/R06/C42/C53; approved UX4 import-recovery desktop/narrow reference; STATE-01/02/03/09, SECRES-08 and AGENTS.md. No authority changes.

## Current-state findings
Import persists only missing subject names; review directs reupload. Save preserves blockers, and assignment checkboxes correctly do not resolve them. Existing admitted synchronous commits, dependency fingerprints and encrypted draft storage can support a bounded explicit correction. Source indexes must be retained when available; old drafts must honestly show field context without inventing an index.

## Decisions and scope
One vertical slice: mapping inspection, admitted correction, preservation, review, browser journey and operator instructions are inseparable for this recovery outcome. Persist bounded original-subject metadata alongside drafts, never raw YAML or secrets. Scope correction to the selected service and list other affected services; no silent cross-service changes. New-service mappings propose grants only; existing applied assignments remain unchanged. Recheck exact targets at review. No service lifecycle, credential-clearing, general editor redesign or other M26–34 work.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit | Evidence |
|---|---|---|---|---|---|---|
| 01 | [slice 01](milestone_25_plan_01_slice_01.md) | Resolve imported identities in a saved draft | M21 | completed | containing slice commit; finalized SHA recorded by root | evidence/qa/secretsauce-mcp/milestone25/acceptance.md |

## Cross-slice concerns
Keep source literals and own-property-safe keys; authorized Auditor inspection without writes, Member denied inspection. Mapping revision/generation and identity dependency fingerprints reject stale targets. Audit admission gates mutation, unknown outcomes trigger durable-state inspection before retry. No execution or value mutation. Recovery schema preserves safe source metadata. Browser validation uses disposable HTTPS state only.

## Completion gate
Focused migration/services/HTTP/recovery tests; actual browser import-to-review with keyboard, desktop/narrow/200% text, visual comparison to approved references; npm test and npm run build once final. Record evidence under evidence/qa/secretsauce-mcp/milestone25 and evidence/ux-acceptance/secretsauce-mcp/milestone25. Root owns milestone status acceptance.

## Rollback and recovery
Revert code only with a compatible encrypted-state reader; additive metadata does not replace live assignments. Never revert live data to undo correction. Unknown mutation results require reloading durable draft and remaining issues before another command.

## Execution notes
Planning inspected before production edits. No baseline test failure established. No downstream transport or Docker launcher changes planned; local HTTPS is the operational fixture for this scope.

## Completed evidence
Slice 01 is implemented and validated. Final `npm test -- --maxWorkers=2` passes 728 tests / 73 files, including its pretest build; separate `npm run build` passes. Actual HTTPS browser recovery passes with desktop/narrow/320px/all-text-200% evidence. `git diff --check` passes. Final source hashes and commands are recorded in evidence/qa/secretsauce-mcp/milestone25/validation.json. Root owns milestone acceptance and final SHA insertion.

Automatic worker concurrency produced timing failures; affected backup/gateway tests passed unchanged with two workers, and two complete bounded runs passed (last after final UI corrections). No assertion or timeout changed. Existing transport/launcher untouched, so no additional Docker acceptance was required for M25; M34 retains integrated Docker drills. Source index absence on legacy drafts is honestly represented by the containing field. Mapping is deliberately per service; no cross-service correction or activation is inferred.
