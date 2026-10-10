# M13 implementation plan 01

Product: secretsauce-mcp. Contract: delivery/milestones/secretsauce-mcp/13-advanced-policy-and-migration.md. Parent commit: 4793f72a41f1ca6d51d00b623ffe2e7dc63bb564.

Scope: exactly M13, single organization/four fixed roles, canonical web-console-ux-1. Preserve MCP/authentication contracts and managed atomic audit admission. M14 owns MCP authentication controls and M15 operating controls. No service packs, host browsing, downstream calls in preview, or live access restoration.

Authority reviewed: docs/web-console-prd.md (CONFIG-03/04, POLICY-01–04, MIGRATE-01–04), product/architecture/web-console-state-contract.md (STATE-01–03), product/security/web-console-security-contract.md (SECRES-01/04), product/ux/01-information-architecture.md coverage table and product/ux/02-interaction-patterns.md, responsive/visual/accessibility and acceptance checklist. Read referenced contracts before each slice.

Pre-existing untracked test-results/ is unrelated and excluded. Commit explicit owned paths only. Each slice has focused positive/negative tests; end-of-milestone full npm test/build and HTTPS browser checks. On listen EPERM repeat the same command with loopback permission. No raw values/bodies/headers/cookies in evidence.

## Slice index

- 01: [Lossless service policy authoring and safe explanation](milestone_13_plan_01_slice_01.md) — completed; commit: resolve unique slice01 subject from history.
- 02: [Shared inherited response protection settings](milestone_13_plan_01_slice_02.md) — planned; commit: pending.
- 03: [Explicit legacy migration and sanitized export](milestone_13_plan_01_slice_03.md) — planned; commit: pending.
- 04: [Last-50 configuration history and rendered acceptance](milestone_13_plan_01_slice_04.md) — planned; commit: pending.
