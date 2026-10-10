# M14 plan 01 slice 02: Inspect and revoke connected clients

Status: completed; commit identified by unique subject `delivery: M14 slice 02 govern connected clients`. Previous commit: 1d990b22096479aab4336e36797b8b97b90ec83a.

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

Investigation decision: persist bounded, expiry-pruned grant revocation verifiers in encrypted console state before removing refresh snapshots. These contain grant identifiers and expiry, never reusable tokens; they fence restart after uncertain snapshot completion. Issuance bounds combined active refresh records and unexpired revocations. Replay and own/Owner revocation consume the same durable authority; role/security generation still fences all older account grants.

Delivered: own-only non-secret connected-client list and confirmed revoke API/UI; fixed-role/current-session/Origin/CSRF server enforcement. Owner target security callback clears codes/grants and preserves generation fence. Bounded original-max-expiry encrypted tombstones govern refresh/JWT and pending signing; replay uses identical durable revocation. Capacity validation has no side effects; actual save/completion uncertainty fences live references and durable tombstones prevent old-snapshot resurrection.

Validation: npm run build passed; 85 tests across connected-client/managed OAuth/auth/people HTTP/domain passed. Includes own/foreign/malformed/unconfirmed/extra inputs, two independent grants, Origin/CSRF/Auditor/restricted/audit outage, capacity no-mutation, issue/refresh revoke races and uncertain-completion reload. Actual keyboard/320px rendered evidence remains slice04.

Additional persistence fault coverage: original-expiry grant selectors in the durable journal's revocation start fence admission on reload even when pre-rename encrypted-state save and secondary snapshot write both fail. Runtime intent map loads only unexpired selectors and prunes during maintenance/capacity checks. Combined active/snapshot and unique verifier counts bound issuance. Added targeted simultaneous-write-failure/reload case; 18 new/related client and managed tests pass, final 8 client tests rechecked after capacity adjustment.
