# M20: Focused Settings and exact review

## Outcome
One authorized Settings destination at a time, explicit current navigation, safe unsaved transitions and one exact atomic review across saved Settings sections.

## Delivery-goal context
Product: secretsauce-mcp. Goal: M18–M21; this transaction owns M20 only. Root owns milestone status. Parent commit: 86df359. Packet: delivery/milestones/secretsauce-mcp/status.yaml; approved handoff: workflow/delivery-planning/handoff.yaml. Autonomous generation and delivery authorized by milestone orchestrator. Pre-existing untracked test-results/ excluded.

## Governing contracts
[Milestone](../../milestones/secretsauce-mcp/20-focused-settings-and-navigation.md), PRD UX-01/02/03/04 CONFIG-03, canonical UX2 IA01/05 IN01/02/05 R04 V04 A05 C26/27 and STATE-01/02. Preserve security authority and M18/M19 behavior.

## Current-state findings
Settings currently appends every domain into one page; draft managers/reviews are separate. Primary current state is inconsistently cleared. Existing HTTPS browser fixtures and state tests provide isolated synthetic state. Full-scope atomic review needs prepare-before-commit coordination, not sequential HTTP apply.

## Scope and decisions
Retain existing domain models and validators. Add a focused presentation shell and non-secret URL destination. Keep secrets only in transient fields. Coordinate exact eligible saved drafts; existing standalone APIs remain compatible. New forms/import capabilities are M21, excluded. No lifecycle, role, host recovery or authentication policy redesign.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit | Evidence |
|---|---|---|---|---|---|---|
| 01 | [plan](milestone_20_plan_01_slice_01.md) | Selected navigation and focused sections | none | completed | 74b1140 | focused-settings-browser-report.json |
| 02 | [plan](milestone_20_plan_01_slice_02.md) | Guarded edits, search and error focus | 01 | completed | b17c0cf | focused-settings-browser-report.json |
| 03 | [plan](milestone_20_plan_01_slice_03.md) | Exact atomic Settings review | 01,02 | completed | abf03d02746922ce5a524ff105e13595acd7b999 | [acceptance](../../../evidence/qa/secretsauce-mcp/milestone20/acceptance.md) |

## Cross-slice concerns
Server authorization remains authoritative. Settings navigation changes no applied state. Draft dependency versions/current roles must be rechecked at final apply. Audit admission precedes mutation; uncertain completion reports unknown. No persistent browser secret state. Preserve runtime pools and generations. Use only disposable HTTPS/browser fixtures.

## Completion gate
Focused direct and HTTPS browser tests cover all milestone acceptance clauses; role matrices, links/back, guard branches, search/error focus, stale/dependency/demotion atomic rejection, 320px and 200% text ranges. Run npm test and npm run build once stable. Store sanitized evidence under evidence/qa/secretsauce-mcp/milestone20/. Review cumulative diff and per-slice commits.

## Rollback and recovery
Presentation rollback does not remove saved drafts. Additive review coordination must fail closed when review authority is absent; never replay actions on navigation. Existing deployed state remains untouched.

## Execution notes
Planning gate complete before production edits. No current baseline failures reported by preceding milestones. No required scope deferred.

## Completed validation
Three planned slices delivered; final suite 71 files/662 tests and build PASS. Exact acceptance mappings and retained actual HTTPS regressions are in evidence/qa/secretsauce-mcp/milestone20/acceptance.md. No product/authority changes, deployment or live-user instance mutation. User-visible saved drafts survive section navigation; whole reviewed configuration applies atomically. Two earlier implementation commits: 74b1140 and b17c0cf; final slice commit reference is supplied to the root status checkpoint.
