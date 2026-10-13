# M23 — People account details and management

Status: completed; autonomous execution authorized by milestone orchestrator.
Parent: 54881d61e03cc848d57bdea9d550f53a83a88c2e. Product: secretsauce-mcp. Pre-existing untracked `test-results/` is excluded.

## Outcome and authority
Deliver the complete compact People list / full account detail journey, bounded Administrator contact and role editing, and durable truthful identity dates. Governing contract: delivery/milestones/secretsauce-mcp/23-people-details-and-account-management.md; PRD IDENT-02A/B, AUTHZ-02/03, IDENT-06, BACKUP-01/05; SECRES-06; STATE-07; UX3 IA07/IN12/R05/A06/V05, C38/39/42. M22 and M18 are completed dependencies.

## Scope and boundaries
Preserve all existing invitation, separate assisted resets, lifecycle, service assignment and client authority. No SMTP modes or M24 settings redesign. No live user instance or storage. Only synthetic isolated fixtures.

## Slice index
1. [Complete People journey](milestone_23_plan_01_slice_01.md) — completed. Identity state, revocation, account endpoint, metadata/archive behavior, compact list/detail UI and required tests form one independently reviewable behavior.

## Validation and acceptance
Map all six milestone acceptance criteria to focused API/state/security/metadata/archive tests plus real HTTPS browser evidence. Test allow/deny role matrix, stale/forged fields, continuity, durable uncertain-write revocation and notification outcomes. Verify exact qualifying login events and recovery preservation. Compare actual/reference screenshots at 1440 and 390, plus keyboard and 320/200% text ranges. Final `npm test` and `npm run build`; no concurrent browser/full-suite runs. Root owns final milestone status.

## Ownership
Owned relevant console People/store/HTTP/page/archive/restore/journal files, focused tests and browser script, M23 plans, docs and M23 QA/UX evidence only. Preserve unrelated files and all approved mockups.

## Completion
All six acceptance criteria map to `evidence/qa/secretsauce-mcp/milestone23/acceptance.md`; exact revisions and commands are in `validation.json`. Real screenshot comparison and corrected differences are in `evidence/ux-acceptance/secretsauce-mcp/milestone23/comparison.md`. One slice commit; root records its final SHA in the index/status closeout to avoid self-reference. Final suite: 710/710, 72 files; build passes. No required work deferred.
