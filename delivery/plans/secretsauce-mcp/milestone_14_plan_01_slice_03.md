# M14 plan 01 slice 03: Owner-reviewed authentication settings and explicit advanced modes

Status: completed. Previous commit: 3972bbb37de62c3c03a35ad84a092695a18d5349.

Goal / observable outcome: Owner saves scoped authentication draft, reviews sanitized impact, confirms password/TOTP and atomically applies only reviewed auth/endpoint fields. Stable signing keys and hash-only state persist. External exact issuer/subject registry and explicit legacy shared attribution never authorize console. Imported M13 proposals stay inactive until deliberately selected/reviewed.

Scope: this behavior and directly necessary domain, persistence, API/UI, documentation and tests. Non-scope: later milestone operations/backups/restore, automatic publication, additional OAuth modes.

Dependencies/order: M10–13 providers; completed slice 02. Governing plan: milestone_14_plan_01.md. Inspect provider implementation facts before editing; unknown mechanics are investigation tasks, not new product behavior.

Entry/end-to-end: browser OAuth or authenticated same-origin console API enters bounded validation, current authorization and mandatory durable admission; commit coherent state before reporting success. MCP authenticates independently per POST and rechecks before reference issuance or dispatch.

State/authorization: drafts have no effect; apply remains scoped and current-authorized. Immediate client revocation never awaits draft apply. Current enrolled identity, fixed role, explicit service assignment, durable grant/generation and audit availability govern admission. Neither privileged role nor consent creates service access. Pending/restricted identities and Auditor cannot execute.

Validation/errors/recovery: reject invalid/unknown inputs safely; preserve permitted non-secret context. No automatic retry of uncertain mutations. Existing operation status reconciles uncertainty. Audit/storage failure closes sensitive admission. Normal restart retains only durable current authorization; opaque gateway refs remain ephemeral.

Expected surfaces: auth settings domain/API/UI, runtime configuration publication, migration integration/docs/tests.

Positive/negative validation: Builtin/external/bearer settings valid and invalid bounds; non-Owner/restricted/stale review/dependency, secret omission, exact pair mismatch/cross-subject; explicit imported proposal; audit and persistence uncertainty; mode change invalidates old authorization/references.

Commands: focused vitest files and npm run build while stabilizing; related OAuth/MCP/console regressions before commit. Last slice runs npm test, npm run build and rendered browser script with required loopback permission if necessary.

Acceptance: described outcome demonstrated with current server enforcement and positive/negative evidence; no raw secrets in evidence. Real-client evidence never inferred from local tests.

Commit boundary: one coherent owned commit including this plan, implementation, tests and supporting docs/evidence. Inspect status/staged diff before and after; exclude test-results/. Record completed status and exact previous slice SHA in next slice; root records final exact SHA.

Investigation resolution: built-in settings retain/generate stable encrypted signing material and use managed refresh directory; advanced bearer retains shared subject bearer-dev with explicit assignments. External issuer-owned JWTs map exact issuer/principal pair to registered UUID, capturing/rechecking registry authorizationGeneration for each admission/queued operation. Disable/re-enable does not perpetually revoke issuer-owned JWTs; old gateway references remain invalid. No third-party token verifiers or additional claim requirements. Imported global auth proposals are converted without reading source files/environment and must be explicitly selected before Owner review/recent apply.

Delivered: Owner-only scoped draft/review/recent-MFA apply; write-only bearer, exact external UUID admission with pre-verification registry snapshot; immutable mode/endpoint fencing; stable signing across modes; store-owned startup refresh path and durable authentication revision in grants; human duration inputs; explicit inactive imported proposals. Existing broker/scanner/limiter resources survive publication.

Validation: npm run build PASS. Related six-file suite PASS, 49 tests. Queued bearer body and external verification fences pass. Sanitized evidence: evidence/qa/secretsauce-mcp/milestone14/slice03-validation.md. New settings HTTP CSRF/Origin, malformed/unauthorized/stale/audit/error cases and committed uncertain completion covered. Real client PRE-015 remains unverified, owned by root acceptance.
