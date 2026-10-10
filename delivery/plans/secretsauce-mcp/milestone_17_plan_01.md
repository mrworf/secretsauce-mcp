# M17: Safe instance recovery

Transaction start: b08d4b8efaf3742eeb41bfdc9a90f437b768525c. Product: secretsauce-mcp.
Pre-existing unrelated work: untracked test-results/; excluded from this transaction.
Root owns milestone/embedded delivery-goal status and final acceptance.
Goal record: [active status](../../milestones/secretsauce-mcp/status.yaml) → delivery_goal,
fixed scope M10–M17, current M17 only. Definition payload
06dd0ee59defd1a75db121f1d8133c7100238b80; planning payload
865aa5710bcb9ff6c4641e177452ab9c50619a19. Authority:
[contract](../../milestones/secretsauce-mcp/17-safe-instance-recovery.md),
[PRD](../../../docs/web-console-prd.md),
[security](../../../product/security/web-console-security-contract.md),
[state](../../../product/architecture/web-console-state-contract.md),
[UX](../../../product/ux/manifest.yaml), accepted D001–012. Source hashes stay root-owned.


## Contract and scope

Deliver only milestone 17, consuming accepted M10–16. Normative authority is
17-safe-instance-recovery.md, BACKUP03–06, STATE05/06, SECRES02/04 and canonical UX.
No selective restore, old authentication restoration, bulk resumption, HA or remote
rollback guarantees. No product-authority edits. Actual ChatGPT/Codex integration is
NOT RUN under the explicit local-validation authorization; every local check remains required.

## Installation approach

Keep the current host master key, local management journal and mandatory gateway audit
mount as independently owned installation dependencies. Recover archived business secrets,
configuration and signing PEM inside a newly encrypted local state envelope; archived
journal/master keys authenticate imported evidence, never replace local append ownership.
The local origin, bind/storage/audit paths remain deployment-owned and explicitly validated.
A protected redo/selection record plus encrypted staged and full prior envelopes governs
atomic state-file installation and startup selection. Prior envelope retains live factor store
only for failed-install rollback, clears sessions/grants/proofs and is never downloadable.
Completed restricted installation cannot roll back because enrollment is hard.

## Sequence and commits

| Slice | Independently observable behavior | Plan | Status | Commit | Evidence |
| --- | --- | --- | --- | --- | --- |
| 01 | Authorized bounded archive validation and impact preview, without replacement | [slice 01](milestone_17_plan_01_slice_01.md) | completed | recorded externally after commit | preview tests11/2 plus preservation15/4; HTTPS4groups |
| 02 | Crash-safe installation, fresh restricted enrollment and explicit review/resumption with truthful provenance | [slice 02](milestone_17_plan_01_slice_02.md) | planned | pending | pending |
| 03 | Operational recovery/runbook and final browser/Docker/protocol preservation acceptance | [slice 03](milestone_17_plan_01_slice_03.md) | planned | pending | pending |

All slice plans exist before production edits. Inspect each before its slice. No readiness
suite repetition: accepted baseline 585 tests/61 files and build. Focused tests per slice;
final npm test and npm run build after final production changes. Actual HTTPS browser
and isolated Docker drills are mandatory, kernel app/audit mount leases retained.

## Resource and authority boundaries

One bounded preview per installation, encrypted staging only; five-minute review lease
expiry releases shared backup/restore slot and clears plaintext references. Preview and
commit bind exact archive digest, nominee, actor generation and operation; commit rechecks
recent Owner authority or newly issued host proof and current capacity. Host proof and
continuation are verifier-only, instance/operation bound, bounded attempts; continuation
30 minutes begins only after installed enrollment stage. No secret URLs, logs or storage.
Crypto uses existing bounded worker, occupied slot through termination. No unbounded
multipart parsing, extraction, host file browser or archive-driven paths.
Maintenance fences console/OAuth/gateway before credential substitution, drains dispatched
work under original finite deadlines. Pre-restore export uses an internal lease-owned
composition without externally releasing or bypassing shared job admission.

## Acceptance and evidence

All four M17 criteria require positive/negative/fault evidence, not happy path alone.
Artifacts: evidence/qa/secretsauce-mcp/milestone17/ and
 evidence/platform/secretsauce-mcp/milestone17/. Record conditional measured recovery
clock, unavailable audit interval and all old access rejection. Final UX-C01–25 matrix
combines current recovery screenshots/tasks and preserved existing journeys. Inherited
11 dependency advisories remain transparent follow-up; no certification claim.

## Deployment rebinding and rollback decisions

| Value | Source on recovered installation |
| --- | --- |
| Console origin, server resource, built-in issuer | Current host-authorized HTTPS origin; source identity remains provenance |
| MCP path and server bind/TLS listener files | Current explicit deployment configuration; validate protected required files before replacement |
| App master key and app directory | Current protected host material; never imported overwrite |
| Gateway audit files/key/identity | Current independently appendable mount, retained in-place or new authorized clean-host binding |
| Management journal/key | Current host local journal; archive domain only authenticated imported evidence |
| Backup directory | Current validated mounted/default storage; archived host path is not writable authority |
| OAuth refresh store path | Current app directory; old snapshot grants invalidated for successful install AND failed rollback |
| Credential placement, business secrets, OAuth signing PEM | Verified archived semantic configuration; signing PEM retained, live grant authority cleared |
| Required external certificate/file dependencies | Explicit existing deployment files or reject with safe missing-input guidance |

Rollback source clears sessions, all proofs/setup enrollment/material pending and grants,
increments security and account generations and clears runtime OAuth codes/refresh state
and broker references. Only prior factor store remains to permit fresh ordinary login.
Maintenance remains until runtime publication and healthy audit are durable. Imported
provenance remains imported in subsequent backup/recovery and overlapping copies deduplicate;
strict cumulative size/count limits refuse unbounded growth. Sanitization considers both
restored and local secret contexts.

## Deferred follow-ups

Actual real LLM connections: [explicit exception](../../../workflow/delivery/local-validation-authorization.md).
Inherited dependency advisories: M15 triage, separate reviewed patch. No SOC2/release claim.
Completed installation enrollment failure uses protected host reissue, never old-state rollback.
