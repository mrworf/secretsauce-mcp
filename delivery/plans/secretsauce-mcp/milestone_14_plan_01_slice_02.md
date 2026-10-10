# M14 plan 01 slice 02: Inspect and revoke connected clients

Status: planned. Previous commit: previous completed slice SHA, recorded before implementation.

Goal / observable outcome: Users inspect only their own non-secret grant metadata and confirm immediate revoke; Owner existing target revocation invalidates all grants. Revocation survives restart and invalidates subject references, including uncertain completion. Read-only roles/sessions cannot mutate.

Scope: this behavior and directly necessary domain, persistence, API/UI, documentation and tests. Non-scope: later milestone operations/backups/restore, automatic publication, additional OAuth modes.

Dependencies/order: M10–13 providers; completed slice 01. Governing plan: milestone_14_plan_01.md. Inspect provider implementation facts before editing; unknown mechanics are investigation tasks, not new product behavior.

Entry/end-to-end: browser OAuth or authenticated same-origin console API enters bounded validation, current authorization and mandatory durable admission; commit coherent state before reporting success. MCP authenticates independently per POST and rechecks before reference issuance or dispatch.

State/authorization: drafts have no effect; apply remains scoped and current-authorized. Immediate client revocation never awaits draft apply. Current enrolled identity, fixed role, explicit service assignment, durable grant/generation and audit availability govern admission. Neither privileged role nor consent creates service access. Pending/restricted identities and Auditor cannot execute.

Validation/errors/recovery: reject invalid/unknown inputs safely; preserve permitted non-secret context. No automatic retry of uncertain mutations. Existing operation status reconciles uncertainty. Audit/storage failure closes sensitive admission. Normal restart retains only durable current authorization; opaque gateway refs remain ephemeral.

Expected surfaces: connected-client domain/API/UI, console page account/people, grant tests.

Positive/negative validation: Own list/revoke success; cross-user ID, invalid/unknown/expired IDs, unconfirmed inputs, Auditor/read-only, audit failure, access-token and refresh rejection, already-running completion fencing.

Commands: focused vitest files and npm run build while stabilizing; related OAuth/MCP/console regressions before commit. Last slice runs npm test, npm run build and rendered browser script with required loopback permission if necessary.

Acceptance: described outcome demonstrated with current server enforcement and positive/negative evidence; no raw secrets in evidence. Real-client evidence never inferred from local tests.

Commit boundary: one coherent owned commit including this plan, implementation, tests and supporting docs/evidence. Inspect status/staged diff before and after; exclude test-results/. Record completed status and exact previous slice SHA in next slice; root records final exact SHA.
