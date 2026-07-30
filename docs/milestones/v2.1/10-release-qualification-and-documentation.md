# Milestone 10: Release Qualification And Documentation

## Purpose and why

Qualify v2.1 as one coherent fresh-deployment product after every bounded
capability milestone is complete. This milestone closes product-wide security,
accessibility, compatibility, operations, persistence, performance, and
documentation evidence that cannot be established by isolated subsystem tests.

## Dependencies

- `03` — Consumes browser-first Compose setup, gating, health, and persistence.
- `04` — Consumes both supported root-maintenance transitions.
- `05` — Consumes atomic initial browser enrollment.
- `07` — Consumes source trust, capacity limits, and automatic suspension.
- `08` — Consumes complete reset/reactivation and break-glass lifecycle.
- `09` — Consumes self and administrative session/connection management.

## PRD traceability

- Sections 1–7 and 14–20 — product authority, goals/non-goals, actors, privacy,
  security, interfaces, UX, deployment, compatibility, and limits.
- Sections 21–23 — complete acceptance, test, and documentation requirements.
- Sections 25–28 — settled decisions, traceability, review focus, and readiness.
- All requirement families: `SETUP`, `ENROLL`, `LOGIN`, `LOGOUT`, `ABUSE`,
  `SOURCE`, `RECOVER`, `SESSION`, `ACCESS`, `HEALTH`, and `VAULTAPI`.

## Scope

- Execute the complete PRD acceptance matrix across clean setup, interruption,
  adoption, configured-key loss, both root rotations, initial enrollment,
  login/OIDC/logout, abuse/suspension/recovery, and session/connection
  management.
- Run fresh official Compose and container-recreation journeys proving durable
  keys, setup state, database, vault, and audit storage; no initialization CLI;
  setup-only observability; socket isolation; and no vault network attachment.
- Revalidate ChatGPT and Codex OAuth/MCP compatibility, including setup gating,
  login changes, restart, revocation, and bounded temporary unavailability.
- Complete product-wide responsive, keyboard, focus, label, status-announcement,
  paste/autofill, destructive-action, current-session, and privacy review.
- Exercise scale, concurrency, retry/backoff, polling, pagination, global
  revocation, timing comparability, storage error, and degraded-dependency
  limits.
- Finalize operator, user, security, deployment, source-trust, root-rotation,
  recovery, session/connection, and troubleshooting documentation.
- Verify generated OpenAPI, runtime schemas, examples, Compose, health checks,
  and documented commands agree.
- Perform final security, architecture, UX/accessibility, data/API, operations,
  and documentation reviews with remediation closure.

## Not in scope

- New product capabilities, migration of pre-release development state,
  multiple active instances, service-specific tools/profile packs, remote vault
  transport, automatic TLS/external credential generation, or other PRD
  non-goals.
- Waiving failed build, test, security, persistence, compatibility,
  accessibility, or release gates.
- Treating documentation completion or agent review as independent security,
  human approval, implementation completion, or release.

## Product-owner qualification boundary

On 2026-07-30 the product owner made the following evidence explicitly
post-M10:

- browser end-to-end and assistive-technology execution;
- validation against an externally reachable HTTPS deployment;
- hosted Codex and ChatGPT execution; and
- independent/human review and approval.

These items remain pending release or deployment evidence and must not be
reported as passing. They do not block M10 implementation completion. M10 uses
the automated browser/accessibility suites, named-client OAuth/MCP protocol
fixtures, local HTTP/Compose evidence, rootless container smoke, and
project-authored review packet as its bounded implementation evidence.

## Required behavior and interfaces

- One clean official Compose start reaches initial enrollment and operational
  use through container logs plus browser only.
- Every pre-operational and degraded state exposes only its bounded liveness,
  readiness, setup, maintenance, OAuth, and MCP behavior.
- Container recreation preserves all declared durable state and does not reuse
  bootstrap, session, OAuth, vault-boot, or other process-lifetime authority.
- All browser and API workflows match the approved schemas, role matrix, errors,
  idempotency, revocation timing, and secret-delivery channels.
- Automated ChatGPT- and Codex-named protocol fixtures use the documented OAuth
  origins and MCP Server URL including `/mcp`; hosted execution remains
  post-M10 evidence.
- Documentation uses `example.org`, states accepted bootstrap-log and `always`
  proxy risks plainly, and never claims arbitrary filesystem durability or
  impossible session hijacking.

## Security, authorization, invalidation, and audit

- Perform a final table-driven role/scope and route authorization audit across
  browser, control, OAuth, MCP, private vault status, and credential APIs.
- Exercise every targeted/global invalidation path across restart, dependency
  failure, record cleanup, and concurrent requests.
- Scan source, generated artifacts, images, logs, audits, API examples, browser
  storage, backups, status, errors, and test output for prohibited secret,
  bearer, personal, reference, or private-host data.
- Confirm secure defaults for cookies, headers, origins, CSRF, proxy trust,
  filesystem ownership/modes, rate/concurrency limits, socket mounts, network
  isolation, and single-instance locking.
- Verify final audits retain required sanitized evidence without operational
  secret values or raw forwarding/session metadata.

## Required tests and validation

- Run every locally executable positive, negative, boundary, concurrency,
  interruption, process, Compose, automated-browser, accessibility, security,
  privacy, performance, and compatibility case required by PRD Sections
  21–22. Preserve the post-M10 evidence boundary above.
- Run the canonical production build, full unit/integration/browser/security
  suite, OpenAPI generation/check, release artifact scan, container smoke, clean
  Compose start, container recreation, and both root-rotation process suites.
- Verify every new external setup, enrollment, login, environment, source,
  private REST, metadata, filter, confirmation, and revocation input has
  positive and negative coverage.
- Exercise self-signed HTTPS transport wherever downstream HTTP behavior changed;
  v2.1 private vault tests remain Unix-socket only.
- Validate all documentation links, commands, examples, status semantics,
  source-trust modes, recovery procedures, OAuth origins, and MCP `/mcp` URLs.
- Record the exact local qualification environment, versions, fixtures,
  results, residual risks, and pending external evidence without overstating
  assurance.

## Acceptance criteria

- [x] Every earlier milestone is implemented with its acceptance evidence and
      no unresolved release-blocking remediation.
- [x] Local exact-candidate container smoke and automated setup, enrollment,
      login, OAuth/MCP, restart, revocation, and durable-state evidence pass;
      unavailable externally reachable HTTPS execution remains post-M10.
- [x] All PRD requirement families and acceptance subsections have passing
      positive and negative evidence.
- [x] ChatGPT- and Codex-named OAuth/MCP, restart, revocation, degraded-state,
      and setup-gating protocol fixtures pass using the documented public URL
      shapes; hosted-client execution remains post-M10.
- [x] Production build, full suites, OpenAPI, artifact scan, container smoke,
      performance, accessibility, privacy, and secret-scan gates pass.
- [x] Project-authored security, architecture, UX/accessibility, data/API,
      operations, and documentation reviews record no implementation blocker;
      independent/human approval remains post-M10 and release blocking.

## Planning handoff

Define the release matrix, clean/recreation fixtures, container runtime and
filesystem capabilities, browser/accessibility tools, performance workloads and
budgets, timing-comparability method, ChatGPT/Codex procedures, root-rotation
fault matrix, artifact scanners, documentation ownership, review independence,
and release-blocking severity policy. Keep remediation in the owning milestone
when behavior is incomplete; use this milestone only for integration/release
gaps and final evidence.
