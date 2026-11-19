# M48: Independent unassigned service imports

## Outcome and governing scope
Deliver exactly M48 of fixed goal M47–48: separate imported identities/names/values, optional ordinary access, and safe legacy mapping retirement. Governing contract: delivery/milestones/secretsauce-mcp/48-independent-unassigned-service-import.md; PRD MIGRATE-01–04/AUTHZ-02/CONFIG-01/03/05; STATE-10, SECRES-09, UX-IN24/C83, AGENTS.md. Definition 8c307a8/985b8d0, planning efcc8da/73f3eca. Parent owns delivery goal/status. New companion transaction starts b54f194; M47 completed. Only unrelated untracked passwd/session/test-results existed; they remain untouched/unread.

## Current findings and decisions
Importer currently overwrites by source ID, reuses values and accepts identity mappings. Legacy mapping provenance cannot prove ordinary post-import selections because old save has no explicit selection marker. Retire those ambiguous pending grants, preserve all live assignments, and record a visible reset notice. Explicit selection after retirement is ordinary current input. Reads must not mutate: use a controlled audited startup upgrade, including restored old drafts before normal service management. New import requests reject nonempty legacy mappings, preserve empty-list compatibility, and reserve independent target IDs/names atomically. Preserve v6 retained identity/generation and advance durable version only where necessary to prevent old mapping readers regaining authority.

## Slice index
| Slice | Outcome | Dependencies | Status | Commit |
|---|---|---|---|---|
| 01 | Safe independent import and legacy authority retirement API/state | M47 | pending | |
| 02 | No-mapping import UI and end-to-end correction/review qualification | 01 | pending | |

## Slice 01 contract
Implement separate ID/name allocation across all retained records and batch; source credential values attach only to allocated targets. Empty access applies but grants nobody execution. Retired mapping input cannot grant. Legacy transition preserves settings/current assignments/values and resets only ambiguous pending selection with notice, invalidates reviews and survives restart/recovery. Inspect/extend migration, HTTP, backup and version fixtures with meaningful positive/negative collision, bounds, stale/role/audit/uncertain tests. Publish backend and focused tests together. No general storage redesign or changed source file/env reading.

## Slice 02 contract
Remove mapping UI/copy and use ordinary optional initial access. Import result presents readable source→target names; uncertain completion directs durable inspection before retry. Reuse advanced synthetic HTTPS harness for import, credential correction, review/apply, collision independence and discard; inspect desktop1440,390 and320/200% screenshots against UX9 shared shell/footer. Extend directly affected roundtrip harness assertions. Publish UI, harness/evidence and completion notes together.

## Validation and safeguards
Focused Vitest with maxWorkers2 and build; existing API boundary fixtures reused. No live stores/secrets or deployment. No raw HTTP request logs. Full clean-tracked bounded-worker suite/build plus joined UX9-INTEGRATED belongs to outer goal after stable M48; do not run it concurrently with Docker. First out-of-area regression expands focused scope; second distinct spread escalates per packet. Prior M47 rendering and independent credential timing retained. No blanket tests solely for prose.

## Recovery and completion
Audit/current revision gate all mutations; unknown response requires durable inspection before duplicate import retry. New format cannot be read by older binaries; revert only with compatible recovery, never downgrade stored authority. Completion requires both commits, focused positive/negative results and inspected actual screenshots; final packet qualification remains outer-owned. No authority/status edits.

## Slice 01 validation and publication
Backend complete. Independent imports reserve IDs/names and source-value correspondence, reject retired mappings, preserve current records, and publish v7. Collision-generated labels beyond 200 characters fail with a source correction message rather than silently truncating. Audited startup retirement preserves restricted diagnostic access on reliable-storage audit failure; review rejects unretired metadata, explicit save/restore transitions retire it under admitted authority. Old writers had no provable explicit-selection marker, so old pending access is conservatively reset; ordinary post-retirement selections remain intact.

Focused migration/service/HTTP/discard: 44 passing checks after obsolete mapping expectations updated; sandbox listener/child-process EPERM retried with permissions, assertions unchanged. Import-upgrade 3 PASS including actual pinned v6 reader, idempotence and degraded diagnostics. Backup-domain4/install4/restore-recovery20 passed initially; one affected recovery-access case revealed empty legacy metadata being recreated, fixed and targeted case PASS. Migration final16 PASS; build PASS. No full suite. Restore positive eligibility/current-grant safety retained. Slice01 publication includes backend/tests/AGENTS/plan only; UI/browser remains slice02.
