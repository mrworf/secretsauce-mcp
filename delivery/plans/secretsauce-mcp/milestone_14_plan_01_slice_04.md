# M14 plan 01 slice 04: Client setup, restart and local rendered verification

Status: completed locally; PRE-015 remains external acceptance gate. Previous commit: 72bd873a46de1e4f772e67e4d979470b70ccfe7e.

Goal / observable outcome: Distinct secret-free ChatGPT/Codex guidance separates issuer/resource origins from full MCP URL, explains reachability, restart/reacquisition and mode/endpoint reconnect. Validate real local HTTPS, keyboard, 320px consent/clients/settings/errors/read-only states; full regression/build. Supply runnable real-client operator evidence procedure; PRE-015 remains externally unverified until authorized real platforms execute it.

Scope: this behavior and directly necessary domain, persistence, API/UI, documentation and tests. Non-scope: later milestone operations/backups/restore, automatic publication, additional OAuth modes.

Dependencies/order: M10–13 providers; completed slice 03. Governing plan: milestone_14_plan_01.md. Inspect provider implementation facts before editing; unknown mechanics are investigation tasks, not new product behavior.

Entry/end-to-end: browser OAuth or authenticated same-origin console API enters bounded validation, current authorization and mandatory durable admission; commit coherent state before reporting success. MCP authenticates independently per POST and rechecks before reference issuance or dispatch.

State/authorization: drafts have no effect; apply remains scoped and current-authorized. Immediate client revocation never awaits draft apply. Current enrolled identity, fixed role, explicit service assignment, durable grant/generation and audit availability govern admission. Neither privileged role nor consent creates service access. Pending/restricted identities and Auditor cannot execute.

Validation/errors/recovery: reject invalid/unknown inputs safely; preserve permitted non-secret context. No automatic retry of uncertain mutations. Existing operation status reconciles uncertainty. Audit/storage failure closes sensitive admission. Normal restart retains only durable current authorization; opaque gateway refs remain ephemeral.

Expected surfaces: client docs/UI, scripts/verify-console-clients-browser.mjs, evidence/qa/secretsauce-mcp/milestone14; operator template.

Positive/negative validation: Normal restart preserves config/signing/current refresh and denies old/replayed/revoked generations; lost ephemeral refs require reacquisition. Full npm test and npm run build. Browser UX-C01,C07,C13,C15,C20,C21,C22. Real platform evidence explicitly pending, never mocked acceptance.

Commands: focused vitest files and npm run build while stabilizing; related OAuth/MCP/console regressions before commit. Last slice runs npm test, npm run build and rendered browser script with required loopback permission if necessary.

Acceptance: described outcome demonstrated with current server enforcement and positive/negative evidence; no raw secrets in evidence. Real-client evidence never inferred from local tests.

Commit boundary: one coherent owned commit including this plan, implementation, tests and supporting docs/evidence. Inspect status/staged diff before and after; exclude test-results/. Record completed status and exact previous slice SHA in next slice; root records final exact SHA.

Delivered: distinct current official ChatGPT/Codex guidance and copyable secret-free origins/full URL with clipboard fallback; narrowly matched RFC8252 loopback port compatibility with actual requested code/exchange binding; real-browser consent Origin/CSP fixes and expired restart page; actual synthetic HTTPS keyboard/320px evidence; real-client runnable operator packet and sanitized template. No real-client proof claimed.

Validation: npm test PASS, 511 tests/53 files with unchanged loopback-enabled command after EPERM; npm run build PASS. Browser PASS, five grouped UX checks/fourteen masked screenshots and no persistent application browser storage/traces. Primary source review and local contract coverage in evidence/qa/secretsauce-mcp/milestone14. Final exact SHA is recorded by root; preceding slice SHA above.
