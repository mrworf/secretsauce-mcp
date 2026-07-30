# Milestone 10: Release Qualification And Documentation

## Outcome

Qualify one exact v2.1 candidate with reproducible product-wide gates and
decision-complete review artifacts. Automated protocol fixtures remain
evidence of protocol compatibility only; official Compose, hosted-client, and
independent review results must name the environment and candidate and cannot
be inferred from prior releases.

## Current-state findings and decisions

- Milestones 00–09 are complete with individual acceptance artifacts.
- Executable candidate `bfac16c` passes the production build, 169-file/
  1,097-test suite, current generated OpenAPI, 14-artifact readiness validator,
  663-file release scan, zero-advisory production audit, clean native install,
  forced native source build, and rootless Docker container smoke. The prior
  candidate's clean Compose enrollment/login/logout/recreation HTTP journey,
  vault isolation, and both actual envelope-root rotations remain useful but
  are not relabeled as exact-candidate evidence.
- Exact-candidate integration fixes are recorded in `a38edc1` and `3377e8c`;
  qualification evidence is recorded in `b0c0085` and `3dadb36`.
- The authorized 2026-07-30 production audit reports two High findings through
  `react-router-dom`/`react-router` and two Medium findings through
  `@modelcontextprotocol/sdk`/`@hono/node-server`.
- `@modelcontextprotocol/sdk` 1.30.0 widens its Hono dependency to include the
  fixed 2.x adapter; an exact 2.0.12 override is required because npm otherwise
  selects the path-traversal-affected 1.x branch. The initially evaluated
  2.0.5 is also excluded by a newer WebSocket-handshake resource-leak advisory
  affecting 2.0.0–2.0.9.
- No published React Router version is advisory-free: 7.18.x retains the new
  unstable-RSC finding, the initially evaluated 7.11.0 reintroduces older High
  findings, and the advisory's patched 8.3.0 is not available from npm. The
  control application uses only a fixed, flat, parameter-free route table, so
  the dependency will be removed in favor of a bounded local router while
  retaining existing navigation, history, role-filtering, focus, deep-route,
  and error behavior.
- `better-sqlite3` 13.0.2 moves to N-API, removes the deprecated
  `prebuild-install` dependency, bundles prebuilds, retains source compilation
  fallback, and requires Node >=22, matching this repository. Because it is a
  major native dependency change, it receives its own persistence/container
  slice.
- Browser end-to-end testing is explicitly deferred until after M10 by the
  product owner. Automated browser component, contract, accessibility, and
  security suites remain required inside M10.

## Slice plan

1. **Candidate-wide automated qualification:** add v2.1 release-document
   contracts and candidate matrix, run focused authorization, compatibility,
   scale, accessibility, documentation, setup, rotation, recovery, and
   persistence suites, then run production build, full suite, OpenAPI,
   dependency advisory, readiness, and release-artifact gates. Remediate only
   integration/release gaps discovered by those gates and commit exact
   executable evidence.
2. **Official container and Compose journey:** provide a reproducible
   exact-candidate official-Compose qualification command covering clean
   setup-only gating, browser enrollment handoff, operational health/MCP,
   container recreation, durable stores, process-lifetime authority
   invalidation, vault network isolation, and both root-rotation process
   suites. Execute it on a Docker-capable amd64 environment and record image,
   engine, filesystem, fixtures, and results.
3. **Final reviews and release decision:** complete v2.1 UX/accessibility,
   security/invariant, architecture/operations, data/API, and documentation
   reviews; run the live Codex and ChatGPT checklist against the documented
   origin and `/mcp` URL; close every blocker; update the matrix, milestone
   acceptance, status, and exact candidate commit without overstating
   independence.

## 2026-07-30 resumption slice plan

4. **Production advisory remediation:** pin `@modelcontextprotocol/sdk` 1.30.0,
   force its fixed `@hono/node-server` 2.0.12 branch, replace the fixed control
   route table's React Router usage with bounded local navigation, prove the
   production audit has no remaining finding, and run MCP protocol plus
   positive/negative control-web routing and build coverage. Do not adopt the
   unpublished React Router 8.3.0 or change application routing behavior.
5. **Native installer modernization:** upgrade `better-sqlite3` to 13.0.2,
   prove the installed production graph contains neither `prebuild-install`
   nor its deprecated install hook, and run persistence, migration, process,
   full-suite, clean-install, and container gates. Preserve the Docker native
   compilation fallback.
6. **Exact-candidate requalification:** after the dependency slice commits,
   update the release matrix and its durable contracts to the resulting
   executable commit, then rerun the full suite, OpenAPI, readiness, advisory,
   and artifact gates. The first cumulative run is allowed to stop only on the
   expected stale candidate/count contract; any product failure returns to its
   owning slice.

## Release-blocking policy

Critical/High security findings, possible credential disclosure,
authorization/scope failures, data loss or rollback failures, stale generated
contracts, failed required client/container/Compose journeys, failed
performance/accessibility/privacy gates, or any full-suite failure block
release. Medium findings also block when they violate a settled invariant or
lack safe containment. Missing runtime or human evidence is pending, not pass.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | `1c98931` | 22-file/120-test focused integration suite; 4-file/28-test Compose/docs suite; build; 168 files/1,087 tests; current OpenAPI; 14 readiness artifacts; 657-file release scan; official config positive/negative validation | Production advisory lookup remains pending because registry disclosure was not authorized. Official Compose config was remediated after the legacy bearer/YAML example was found mounted. M10 review later returned the missing 100,000-record access cap to M09 for release remediation. |
| 2 | blocked | `10caaba` | Exact-candidate runbook specifies clean setup/enrollment/activation/MCP, recreation, durable/ephemeral state, vault isolation, rotation/fault matrix, and sanitized record; host audit: Node 26.4.0, x86_64; Docker 29.6.1 client present, daemon inactive and admin-gated; no Compose client, Podman, or nerdctl | Must execute on a usable Docker/Compose environment; prior v2 image evidence is not reusable. |
| 3 | blocked | `2f32206` | Project-authored security/invariant, architecture/operations, UX/accessibility, and data/API/documentation reviews cover executable candidate `b780201` and keep external gates explicit | An authorized production advisory query, hosted-client target, and named independent/human reviewers are required; agent-authored evidence cannot substitute for them. |
| 4 | completed | `c580fa7` | Production graph: MCP SDK 1.30.0/Hono 2.0.12 and no React Router; zero production advisories at Moderate threshold; production build; 8-file/37-test control-web suite; 6-file/62-test routing, accessibility, MCP surface, server, and release-compatibility suite | React Router 7.11.0 was rejected after it reintroduced older High findings. Browser E2E is deferred until after M10. |
| 5 | completed | `bfac16c` | `better-sqlite3` 13.0.2 only; no `prebuild-install` lock or installed node; clean production install; bundled N-API binary smoke; forced source compilation and SQLite query; 11-file/81-test persistence, migration, application, and rotation suite; rootless Docker 29.6.1 build and release smoke | Full suite reached 1,096/1,097 passing; the sole failure was the deliberately stale exact-candidate/count release-document contract assigned to slice 6. |
| 6 | completed | qualification documentation commit | Candidate `bfac16c`; production build; 169 files/1,097 tests; current OpenAPI; 14 readiness artifacts; 663-file release scan; zero production advisories through Moderate | Browser E2E remains deferred until after M10. Exact-candidate full Compose/live hosted-client and independent/human evidence remain external blockers. |
