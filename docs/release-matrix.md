# SecretSauce V2 release matrix

This matrix is the release-candidate checklist. `pass` requires reproducible
evidence from the exact candidate commit; `pending` blocks release. The final
Milestone 24 acceptance review records the commands, results, commit, and any
non-blocking residual risk.

Evidence below was collected from source/review baseline `8a2b06d` on
2026-07-24 UTC. The subsequent evidence-only commit changes this matrix and
milestone status, not executable product code.

| Gate | Owner | Environment/evidence | Status |
| --- | --- | --- | --- |
| Production server and web build | Maintainer | Node 26, `npm run build`; server and Vite production build passed | pass |
| Full unit/integration/browser/security regression | Maintainer | `npm test -- --reporter=dot --silent`; 146 files / 972 tests passed with loopback/private sockets | pass |
| Runtime/generated OpenAPI parity | API owner | `npm run check:control-openapi`; generated artifact current | pass |
| Production dependency advisory threshold | Security owner | `npm run audit:production`; no High/Critical advisory; contained Moderate recorded in security review | pass |
| Human/API role and cross-service authorization | Security owner | 246 human/API role-capability cells plus route/repository contracts | pass |
| Wide/narrow accessibility and critical UX states | UX owner | Six release-wide route/accessibility contracts plus owning component suites | pass |
| Artifact/privacy prohibited-data scan | Security owner | 562 tracked, staged, built, generated, and synthetic closed-scope files | pass |
| PRD scale and bounded-work budgets | Architecture owner | Deterministic SQLite/repository workloads at every PRD target | pass |
| Image build, unprivileged start, health, MCP, restart | Operations owner | `npm run smoke:container` exits 127: no Docker-compatible engine is installed; CI gate exists | **pending** |
| Database/vault/key/audit/recovery persistence | Operations owner | Compose/static contracts, real broker processes, combined listeners, and restart journeys | pass |
| Codex-named OAuth/MCP protocol journey | Compatibility owner | Independent durable OAuth/MCP/restart/refresh/revocation fixture | pass |
| ChatGPT-named OAuth/MCP protocol journey | Compatibility owner | Independent durable OAuth/MCP/restart/refresh/revocation fixture | pass |
| Live Codex/ChatGPT deployment procedure | Operator | Exact external-client checklist and deployment-blocking rule documented | pass |
| Backup, restore, and V1 migration journey | Operations owner | Real broker/recovery integration fixtures and terminal-safe documentation | pass |
| Degraded component and invalidation journey | Security owner | Restart/fault/revocation/invalidation integration fixtures | pass |
| Installation/administration/recovery/safe-use docs | Documentation owner | Link, example, runtime, safety, and OpenAPI consistency contracts | pass |
| UX/accessibility review | UX owner | `docs/audits/milestone-24-ux-accessibility.md` | pass |
| Security/invariant review | Security owner | `docs/audits/milestone-24-security-invariant.md` | pass |
| Architecture/operations review | Architecture owner | `docs/audits/milestone-24-architecture-operations.md` | pass |
| Milestones 00–23 complete, release remediation closed | Release owner | `docs/milestones/status.yaml` and final acceptance audit | pass |

## Release-blocking policy

A Critical/High security finding, possible credential disclosure,
authorization/cross-service failure, data-loss or rollback failure, stale
OpenAPI, failed required compatibility or container journey, performance-budget
failure, or full-suite failure blocks release. A Medium finding also blocks when
it violates a settled invariant or has no safe containment. No red gate is
waived inside this milestone.

Automated client fixtures validate protocol compatibility, not behavior inside
hosted Codex or ChatGPT user interfaces. A failed live procedure blocks the
affected deployment even when the synthetic gate passes.
