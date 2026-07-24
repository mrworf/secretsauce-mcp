# Milestone 24 Acceptance Review

## Candidate And Scope

- **Implementation/review baseline:** `acf8b67`
- **Review time:** 2026-07-24 UTC
- **Milestones reviewed:** 00 through 24
- **Decision rule:** no Critical/High security finding, possible credential
  disclosure regression, authorization failure, data-loss/rollback failure,
  stale OpenAPI, failed required journey, image/start/readiness failure, scale
  regression, or full-suite failure may be waived.

## Commands And Evidence

- Production build: `npm run build`
- Full regression: `npm test`
- OpenAPI parity: `npm run check:control-openapi`
- Production advisory gate: `npm run audit:production`
- Artifact/privacy scan: `node scripts/scan-release-artifacts.mjs`
- Authorization: `npm test -- --run
  test/release-authorization-audit.test.ts`
- UX/accessibility: `npm test -- --run
  web/src/release-accessibility.test.tsx web/src/styles.test.ts`
- Scale: `npm test -- --run test/release-scale.test.ts`
- Client compatibility: `npm test -- --run
  test/release-compatibility.test.ts`
- Recovery journeys: focused backup, restore, V1 migration, vault process,
  degraded health, invalidation, and combined application suites
- Container: `npm run smoke:container` — passed on rootless Docker 29.6.2,
  linux/amd64, using image
  `sha256:9873a2a682c626eec2b8c347b94a818ea3b9de0987bffa7d19f2b27b97bf2845`

## Review Artifacts

- [UX and accessibility](milestone-24-ux-accessibility.md)
- [Security and invariants](milestone-24-security-invariant.md)
- [Architecture and operations](milestone-24-architecture-operations.md)
- [Release matrix](../release-matrix.md)

## Findings And Disposition

The final review found and remediated:

1. a High production `fast-uri` advisory (`755fb7c`);
2. incompatible separate gateway/control ownership of the exclusive SQLite
   writer (`82d69ea`);
3. missing control-to-runtime aggregate/invalidation wiring and missing
   production advisory CI enforcement (`3ca2158`);
4. missing native-module compilation prerequisites in both image build stages
   and a rootless-host audit-size assumption in the smoke harness (`acf8b67`).

The full suite passed after each remediation; the final run passed 146 files
and 973 tests. No open Critical/High source finding remains. The accepted
Medium response-transformation limitation and the contained unused
Windows/Hono Moderate advisory are recorded in the security review.

## Acceptance Status

| Area | Result | Evidence |
| --- | --- | --- |
| Milestones 00–23 | pass | `docs/milestones/status.yaml` |
| Product/navigation/recovery tasks | pass | recovery APIs/UI and route-completeness suites |
| UX/accessibility | pass | final UX artifact and release accessibility suite |
| Authorization/privacy | pass | 246-cell/route audit and closed artifact scan |
| Scale/bounded work | pass | deterministic release workloads |
| Combined application/persistence | pass | real dual-listener/shared-writer and failure-cleanup tests |
| Codex/ChatGPT protocol fixtures | pass | independent OAuth/MCP/restart/refresh/revocation journey |
| Backup/restore/migration/degraded paths | pass | repository, HTTP, CLI, broker-process, restart/fault suites |
| Documentation/proxies/API | pass | link/example/runtime contract suites |
| Production container execution | pass | real amd64 build, non-root/read-only start, health/MCP, restart, and durable-audit smoke |
| Live hosted-client deployment | deployment-specific | exact blocking checklist exists; no deployment was supplied |

## Limitations And Residual Risk

- The local smoke used rootless Docker with `overlay2`; CI repeats the same
  repository command on its rootful amd64 runner before multi-architecture
  publication.
- Synthetic named clients do not execute inside hosted Codex or ChatGPT.
- A single application process is the supported fault/compromise domain; the
  vault remains separate, but data/control are logical rather than OS-isolated.
- Approved downstream transformation can evade exact/pattern response
  recognition.

## Verdict

**Milestone 24 acceptance criteria are satisfied for executable candidate
`acf8b67`.** Build, full regression, OpenAPI, authorization, privacy, scale,
compatibility, recovery, documentation, and real amd64 container gates pass.
The live-client checklist additionally blocks any deployment on which either
hosted client fails. No gate was waived.
