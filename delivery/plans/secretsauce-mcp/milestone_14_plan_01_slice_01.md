# M14 plan 01 slice 01: Managed per-user consent and current MCP admission

Status: completed; committed with the unique subject `delivery: M14 slice 01 authorize enrolled MCP clients`; exact SHA recorded in slice02/index by the next transaction. Previous commit: 574f50c32902aef73acbe77e69611f89e43da159.

Goal / observable outcome: Enrolled active non-Auditor signs in with password and fresh TOTP, deliberately consents and gets PKCE-bound tokens. Current durable grant, identity generation, scopes and mode are rechecked after asynchronous boundaries and immediately before sensitive tool execution. Consent never assigns service access. Unmanaged legacy remains compatible.

Scope: this behavior and directly necessary domain, persistence, API/UI, documentation and tests. Non-scope: later milestone operations/backups/restore, automatic publication, additional OAuth modes.

Dependencies/order: M10–13 providers; first M14 slice. Governing plan: milestone_14_plan_01.md. Inspect provider implementation facts before editing; unknown mechanics are investigation tasks, not new product behavior.

Entry/end-to-end: browser OAuth or authenticated same-origin console API enters bounded validation, current authorization and mandatory durable admission; commit coherent state before reporting success. MCP authenticates independently per POST and rechecks before reference issuance or dispatch.

State/authorization: drafts have no effect; apply remains scoped and current-authorized. Immediate client revocation never awaits draft apply. Current enrolled identity, fixed role, explicit service assignment, durable grant/generation and audit availability govern admission. Neither privileged role nor consent creates service access. Pending/restricted identities and Auditor cannot execute.

Validation/errors/recovery: reject invalid/unknown inputs safely; preserve permitted non-secret context. No automatic retry of uncertain mutations. Existing operation status reconciles uncertainty. Audit/storage failure closes sensitive admission. Normal restart retains only durable current authorization; opaque gateway refs remain ephemeral.

Expected surfaces: src/builtinOAuth.ts, src/consoleStore.ts, src/auth.ts, src/server.ts, src/types.ts, MCP/gateway admission; managed OAuth tests.

Positive/negative validation: Successful MFA consent/code/refresh; wrong password/TOTP, replay, disabled/pending/Auditor, stale identity generation, PKCE/redirect/scope, audit outage and queued grant removal. Existing OAuth and MCP regressions.

Commands: focused vitest files and npm run build while stabilizing; related OAuth/MCP/console regressions before commit. Last slice runs npm test, npm run build and rendered browser script with required loopback permission if necessary.

Acceptance: described outcome demonstrated with current server enforcement and positive/negative evidence; no raw secrets in evidence. Real-client evidence never inferred from local tests.

Commit boundary: one coherent owned commit including this plan, implementation, tests and supporting docs/evidence. Inspect status/staged diff before and after; exclude test-results/. Record completed status and exact previous slice SHA in next slice; root records final exact SHA.

## Delivered evidence

Implemented fresh password/TOTP consent with explicit scope/identity/assignment distinction, one-use request-bound challenge/Origin and managed PKCE syntax. Hash-only fsync snapshots bind grants/JWT to current identity generation; legacy managed password-only authority denied. Current auth object/origin/path and live grant are checked after body/JWT/signing waits and before tool/reference/dispatch. Replay revokes old JWT authority and broker references; response completions cannot mint usable references after invalidation. Consent rejects Auditor, pending, disabled and audit/storage-degraded identities.

Validation: npm run build passed; 119 related tests passed across managed OAuth/auth/MCP/console auth/managed service runtime/reference suites, plus expanded managed context/challenge negatives rechecked before commit. Listener EPERM resolved by rerunning identical commands with loopback permission; no test weakening. Operator guidance in docs/console-mcp-clients.md. PRE-015 remains unverified.
