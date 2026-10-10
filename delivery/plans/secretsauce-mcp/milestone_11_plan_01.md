# M11 managed service configuration delivery

Parent: `9a9f619b3901b256ea6ebe242211425b0c00f874`; product `secretsauce-mcp`. Pre-existing unowned path: `test-results/`. Governing authority: milestone 11, PRD CONFIG/AUTHZ/POLICY/SEC, STATE-01/02 and approved UX manifest. No authority changes; M12 identity administration, M13 advanced authoring/import and M14 MFA consent remain excluded.

## Mechanism
Use the existing encrypted, single-writer ConsoleStore commit as the serialized durable transaction. Persist sanitized raw service drafts separately from runtime configuration and write-only versioned credential values. Reuse existing service validation/normalization; preserve all advanced fields and restore regex executable objects after decryption. Scoped reviews bind candidate, base configuration revision and current dependency fingerprint. Service publication updates a shared runtime configuration service-map pointer synchronously after durable state installation; retain broker, scanner pool, denial store and capacity counters. Management changes and admission have no await inside their critical section. After asynchronous authentication/body work, MCP handlers use the current published map. Dispatched work captures its service/credential context; response issuance uses a revocation generation fence so old completion protects secret bytes without reviving usable references.

## Slice index
1. [Scoped draft/review/apply](milestone_11_plan_01_slice_01.md): complete; evidence `evidence/qa/secretsauce-mcp/milestone11/slice01.md`; commit recorded in Git history/root handoff.
2. [Immediate credentials, access and lifecycle](milestone_11_plan_01_slice_02.md): pending.
3. [Service-first console and five-step setup](milestone_11_plan_01_slice_03.md): pending.

## Validation and evidence
Focused positive/negative management and runtime tests per slice; preparation faults, stale/mixed-role/dependency changes and operation reconciliation; concurrent dispatch/rotation/revoke and body-await overlap; preserved TLS/path/JSON/binary/Base64/cookie/header regressions. End `npm test`, `npm run build`, declared Playwright actual HTTPS keyboard and 320px checks. Evidence under `evidence/qa/secretsauce-mcp/milestone11/`. Root owns milestone acceptance/status. Stage only owned explicit paths. Each completed slice commits its plan, implementation, tests and evidence; commit IDs recorded in root handoff/history (avoid self-referential SHA).
