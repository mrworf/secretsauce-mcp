# M15: Operate and inspect the managed instance

## Outcome
Authorized users investigate sanitized, scoped activity; operators export bounded evidence and review attributed retention deletion. Owners manage effective live limits without resetting occupied state. Health and single-instance deployment evidence describe actual local behavior.

## Delivery-goal context
- Goal status: workflow/delivery (root orchestrator owns selection/status)
- Product ID: secretsauce-mcp
- Active packet: delivery/milestones/secretsauce-mcp; compiled hash 8fabbc634d279f3be9a6c8590580a6b12bad891ea4b821aa805aeeb331dfe312
- Source transaction: 06dd0ee59defd1a75db121f1d8133c7100238b80
- Planning transaction: 865aa5710bcb9ff6c4641e177452ab9c50619a19
- Fixed goal context: M10–17; this transaction implements only M15
- Resume mode: new; parent d24d5f66832be2f44d7aef8ee8ccfde17e7537fb
- Pre-existing dirty path: untracked test-results/; excluded throughout

## Governing contracts
[Milestone](../../milestones/secretsauce-mcp/15-operating-evidence-and-limits.md), [PRD](../../../docs/web-console-prd.md): AUTHZ-02, AUDIT-01–04, OPS-01–06, CONFIG-03, CAP-CFG-06, CAP-ACCEPT-01, SEC-01/03, MCP-04, UX-01–04, SECRES-04. [Security](../../../product/security/web-console-security-contract.md), [state contract](../../../product/architecture/web-console-state-contract.md), [UX manifest](../../../product/ux/manifest.yaml) and 01–07 govern all surfaces. [AGENTS](../../../AGENTS.md) applies. Root retains upstream authority/freshness/status ownership.

## Current-state findings
M14 baseline passed 511 tests/53 files and build. Activity currently reads only console last100, omits gateway requests/filters/exports. Durable chains/checkpoints and single writer exist; retention does not. Config-backed token/OAuth capacity changes work but inflight/denial/scanner bounds require live updates. Existing settings, shared scanner editing, authentication and SMTP must stay reachable. Public health is bounded. Backup jobs have no provider until M16.

## Decisions
Use existing durable audit and encrypted managed store, no analytics service. Bound each evidence scan/export/storage window; reject exhaustion rather than silently delete records. Retention rewrites only expired evidence under attributed durable admission and integrity-checked recoverable checkpoint, preserving unresolved operations and live revocation intents. Settings changes use scoped draft/review/current role/base checks and publish committed state even when completion is uncertain. Update occupied resource bounds in place. Never trust forwarded headers by default; proxy examples strip/rewrite them while application uses configured origins and socket identity.

## Scope
Included: all M15 evidence/retention, limits/health, local browser and Docker operating-envelope checks and runbook. Excluded: M16/17 backup/restore implementation, real ChatGPT/Codex LLM connection (authorized local-validation exception), redesign/SSO/service packs/distributed deployment/compliance certification.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit | Evidence |
|---|---|---|---|---|---|---|
|01|[slice01](milestone_15_plan_01_slice_01.md)|Scoped evidence and reviewed retention|existing M13/14|complete|4fe08593a055c1d88c5cfac48589295416973952|evidence/qa/secretsauce-mcp/milestone15/|
|02|[slice02](milestone_15_plan_01_slice_02.md)|Live limits and truthful health|01|complete||evidence/qa/secretsauce-mcp/milestone15/|
|03|[slice03](milestone_15_plan_01_slice_03.md)|Operating envelope and deployment verification|01,02|pending||evidence/platform/secretsauce-mcp/milestone15/|

## Cross-slice concerns
Compatibility: preserve all five tools/stateless POSTs/response protection/config surfaces. Authorization: Members own actor only; Owner/Admin/Auditor authorized instance reads/exports; Owner writes limits/retention. Sensitive operations require durable audit; diagnostic sessions never upgrade. Live broker/scanner/limiter stay shared. Audit data excludes raw secret/body/header/token/proof content. Bounds contain exports/regex/background work. Docker disposable loopback only, synthetic accounts/services, independent persistent mounts/stable keys and ephemeral references. No changes to downstream transport.

## Milestone completion gate
Focused positive/negative and concurrency/failure tests per slice; final npm test and npm run build; actual HTTPS Playwright keyboard/320px/role/field coverage/task timings; actual disposable Docker smoke/restart/missing material/second writer; realistic50-user100-service retained audit/quota/bounded background workload. Root reviews source/evidence and owns milestone acceptance.

## Rollback and recovery
Revert code only after quiescing; retain stable encrypted app/audit directories and keys. Never discard admitted evidence. Interrupted retention replays only its authenticated transaction or fails closed. No new transport/session state or later-milestone backup format.

## Execution notes
Planning gate complete before production edits. Exact per-slice SHA reported externally (a commit cannot embed itself). No routine permission stop: user authorized plans/implementation/local headless and ephemeral Docker validation.

## Deferred follow-ups
Backup/restore outcomes remain pending provider M16/17; real LLM interoperability remains NOT RUN under recorded local-validation authorization.
