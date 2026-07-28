# SecretSauce v2.1 release matrix

This matrix is the v2.1 release-candidate checklist. `pass` requires
reproducible evidence from the named candidate. `pending` blocks release and
cannot be converted to pass by documentation or agent inference.

Automated evidence below was collected from executable candidate `3377e8c` on
2026-07-28 using Node 26.4.0 on linux/x86_64. Later project-authored review
commits change only release documentation. Any later change to source,
configuration, container definitions, generated contracts, or dependencies
creates a new executable candidate and requires the affected gates to be rerun.

| Gate | Owner | Environment/evidence | Status |
| --- | --- | --- | --- |
| Milestones 00–09 complete | Release owner | v2.1 status manifest and milestone acceptance artifacts | pass |
| Production server and web build | Maintainer | `npm run build`; server and Vite production build passed | pass |
| Full unit/integration/browser/security regression | Maintainer | `npm test`; 168 files / 1,094 tests passed | pass |
| Runtime/generated OpenAPI parity | Data/API owner | `npm run check:control-openapi`; generated artifact current | pass |
| Readiness artifact integrity | Architecture owner | `node scripts/validate-v2.1-readiness.mjs`; 14 artifacts passed | pass |
| Production dependency advisory threshold | Security owner | Production-image `npm ci --omit=dev` reported an aggregate two High advisories. An explicitly authorized `npm run audit:production` query and remediation must produce no High/Critical production advisory | pending |
| Human/API role and cross-service authorization | Security owner | 246 human/API role-capability cells plus registered route and repository contracts | pass |
| Wide/narrow accessibility and critical UX states | UX owner | Release-wide route/accessibility contracts plus owning component suites | pass |
| Artifact/privacy prohibited-data scan | Security owner | 662 tracked, staged, built, generated, and synthetic closed-scope files | pass |
| PRD scale and bounded-work budgets | Architecture owner | Deterministic SQLite/repository workloads; exact 100,000-record global access revocation and atomic 100,001-record rejection | pass |
| Setup, rotation, recovery, and invalidation integration | Security owner | Owning process, interruption, restart, fault, and persistence suites | pass |
| Codex-named OAuth/MCP protocol journey | Compatibility owner | Durable OAuth/MCP/restart/refresh/revocation fixture using origin `https://mcp.example.org` and MCP path `/mcp` | pass |
| ChatGPT-named OAuth/MCP protocol journey | Compatibility owner | Durable OAuth/MCP/restart/refresh/revocation fixture using origin `https://mcp.example.org` and MCP path `/mcp` | pass |
| Project-authored final review packet | Delivery reviewer | [Security/invariant](audits/v2.1/milestone-10-security-invariant.md), [architecture/operations](audits/v2.1/milestone-10-architecture-operations.md), [UX/accessibility](audits/v2.1/milestone-10-ux-accessibility.md), and [data/API/documentation](audits/v2.1/milestone-10-data-api-documentation.md); explicitly non-independent | pass |
| Official Compose clean setup and recreation | Operations owner | Rootless Docker 29.6.1 / Compose 5.3.1 clean candidate completed enrollment/login/session/logout/recreation HTTP contracts, vault isolation, and both actual rotations with replay/resume and populated-record proof. [Exact-candidate runbook](v2.1-release-qualification.md) still requires authenticated MCP, the complete durable/ephemeral matrix, and visual browser qualification | pending |
| Live Codex and ChatGPT deployment procedure | Operator | [Exact-candidate runbook](v2.1-release-qualification.md); run both hosted clients against `https://mcp.example.org/mcp`; a failure blocks that deployment | pending |
| Final security, architecture, UX, data/API, operations, documentation, and human approval | Named independent/human reviewers | Decision-complete exact-candidate artifacts with all remediation closed | pending |

## Release-blocking policy

A Critical/High security finding, possible credential disclosure,
authorization/cross-service failure, data-loss or rollback failure, stale
OpenAPI, failed required compatibility or container journey,
performance/accessibility/privacy failure, or full-suite failure blocks
release. A Medium finding also blocks when it violates a settled invariant or
has no safe containment. No red or pending gate is waived inside M10.

Automated named-client fixtures validate protocol compatibility, not behavior
inside hosted Codex or ChatGPT. Prior v2 container and review evidence does not
qualify the v2.1 candidate. The OAuth resource and issuer are the origin
`https://mcp.example.org`; the client MCP Server URL is
`https://mcp.example.org/mcp`.
