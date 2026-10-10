# M14 implementation plan 01

Product: secretsauce-mcp. Contract: delivery/milestones/secretsauce-mcp/14-mcp-client-access.md. Parent commit: 574f50c32902aef73acbe77e69611f89e43da159.

Scope: exactly M14; enrolled multi-user MCP OAuth/consent and client governance, Owner scoped authentication settings, preserved external/legacy modes, setup and restart. No M15 operations/backups, SSO, service packs or publication. Canonical authority: docs/web-console-prd.md BASE/AUTHZ/IDENT/MCP/CONFIG/SEC/CAP-CFG/MIGRATE; product/security/web-console-security-contract.md SECRES-01/04; product/architecture/web-console-state-contract.md STATE-01–03; product/ux 01–07 (web-console-ux-1); packet index/traceability. Provider M10–13 accepted.

Pre-existing untracked test-results/ is excluded; explicit owned staging only. Never record secrets, token/proof values, auth headers/cookies or response bodies. All new external input has positive/negative coverage. Preserve live scanner/broker/limiter and generation fences. Full npm test and npm run build at completion; same command with loopback permission on EPERM.

PRE-015 requires authorized real ChatGPT AND Codex: consent/discovery/reference/request/denial/revoke/restart/reconnect against synthetic assigned service. Local work may proceed; acceptance is externally gated. No infrastructure publication authorized. PRE-016 is outside this milestone. Root owns milestone status/acceptance and final provenance.

## Slice index

- 01: [Managed per-user consent and current MCP admission](milestone_14_plan_01_slice_01.md) — completed; commit: 1d990b22096479aab4336e36797b8b97b90ec83a.
- 02: [Inspect and revoke connected clients](milestone_14_plan_01_slice_02.md) — completed; commit: 3972bbb37de62c3c03a35ad84a092695a18d5349.
- 03: [Owner-reviewed authentication settings and explicit advanced modes](milestone_14_plan_01_slice_03.md) — completed; commit: 72bd873a46de1e4f772e67e4d979470b70ccfe7e.
- 04: [Client setup, restart and local rendered verification](milestone_14_plan_01_slice_04.md) — completed locally; commit: 1eb00d117664858d81252543b46c53cb8b46638d; PRE-015 external acceptance pending.
