# M18 slice 02: Independent Authenticator reset

## Goal and scope
Implement immediate factor/code/access invalidation, restricted MFA-only enrollment preserving password, explicit target confirmation, reissue, continuity and both-lost flow. Complete browser/operational documentation and cumulative acceptance.
No M19–21 settings or import work. Dependency: slice 01 committed.

## Entry points and transitions
People protected recovery endpoint and purpose-bound recipient continuation; current live actor/session/recent authentication authorizes issuance. Password issuance preserves access; completion consumes proof and factor verification atomically and advances generation. MFA issuance restricts and invalidates immediately; completion installs new factor only. Ordinary login follows each completion. No issuer session lifetime dependency.

## Authorization and failures
SECRES-05 matrix; reject self, disabled/invited/restored/external targets, arbitrary contact, stale or revoked issuer/target authority and wrong purpose/instance. Require verified channel, explicit confirmation and audit readiness. Reissue supersedes old proofs; abandoned MFA stays restricted. Unknown durable outcome never reports success or restores access. Minimum safe list/detail only for Administrators.

## Expected surfaces
src/consolePeople.ts, src/consolePeoplePage.ts, directly required store/HTTP integration; test/console-recovery.test.ts and targeted identity/HTTP/OAuth tests; scripts/verify-console-people-browser.mjs or dedicated assisted-reset harness; docs/console-operations.md; sanitized milestone evidence.

## Validation
Positive/negative inputs for every changed endpoint. Assert role matrix, valid TOTP/recovery, missing/bad/replayed factor, generation changes, issuer expiry/demotion, proof replay, audit and persistence failures, old access revocation and no secret logs. Slice 02 adds Owner concurrency, expired/reissued MFA, both-lost browser flow, keyboard/reflow and SMTP failure. Run focused vitest, related identity/HTTP/OAuth regressions; final slice npm test and npm run build plus actual HTTPS browser harness.

## Acceptance and commit boundary
All scoped behavior passes positive/negative tests; no authority expansion or live-instance changes. Commit implementation, tests, this plan and relevant docs/evidence together. Parent owns manifest; exclude test-results/. Record exact commit in governing index after commit.

## Status
Completed and validated; implementation commit pending. The companion retained this plan and two-slice structure. Supporting persistence work is required by the existing uncertainty/downgrade acceptance contract: format v2 prerequisite, generation-bearing reset intents, restart restriction, compatible config/recovery readers. No other milestone implemented. Final `npm test`: 69 files / 641 tests PASS; build PASS. Actual HTTPS dedicated reset browser: 33 checks PASS; retained people browser: 8 checks PASS. Exact acceptance mapping: evidence/qa/secretsauce-mcp/milestone18/acceptance.md.

Committed as `eb25cb3621fca84d76341d74d29b5327921267b3`; parent verified acceptance mapping and packet freshness.
