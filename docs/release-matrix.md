# SecretSauce V2 release matrix

This matrix is the release-candidate checklist. `pass` requires reproducible
evidence from the exact candidate commit; `pending` blocks release. The final
Milestone 24 acceptance review records the commands, results, commit, and any
non-blocking residual risk.

| Gate | Owner | Environment/evidence | Status |
| --- | --- | --- | --- |
| Production server and web build | Maintainer | Node 22, `npm run build` | pending |
| Full unit/integration/browser/security regression | Maintainer | Node 22, `npm test` with loopback/private sockets | pending |
| Runtime/generated OpenAPI parity | API owner | `npm run check:control-openapi` | pending |
| Human/API role and cross-service authorization | Security owner | Table-driven route and repository contracts | pending |
| Wide/narrow accessibility and critical UX states | UX owner | Testing Library/jsdom plus CSS/source contracts | pending |
| Artifact/privacy prohibited-data scan | Security owner | Tracked, built, generated, and synthetic output corpus | pending |
| PRD scale and bounded-work budgets | Architecture owner | Deterministic SQLite/repository workloads | pending |
| Image build, unprivileged start, health, MCP, restart | Operations owner | Local Docker amd64 smoke and CI | pending |
| Database/vault/key/audit/recovery persistence | Operations owner | Compose/static contracts and restart journeys | pending |
| Codex-named OAuth/MCP protocol journey | Compatibility owner | Synthetic local end-to-end fixture | pending |
| ChatGPT-named OAuth/MCP protocol journey | Compatibility owner | Synthetic local end-to-end fixture | pending |
| Live Codex/ChatGPT deployment procedure | Operator | Documented external-client checklist | pending |
| Backup, restore, and V1 migration journey | Operations owner | Real broker/recovery integration fixtures | pending |
| Degraded component and invalidation journey | Security owner | Restart/fault/revocation integration fixtures | pending |
| Installation/administration/recovery/safe-use docs | Documentation owner | Link/example/runtime consistency tests | pending |
| UX/accessibility review | UX owner | Final review artifact | pending |
| Security/invariant review | Security owner | Final review artifact | pending |
| Architecture/operations review | Architecture owner | Final review artifact | pending |
| Milestones 00–23 complete, no release remediation | Release owner | `docs/milestones/status.yaml` and final audit | pass |

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
