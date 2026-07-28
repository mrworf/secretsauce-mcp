# Milestone 03 Acceptance: Browser-First Setup And Compose Gating

Date: 2026-07-28

## Decision

Accepted. Implementation commits `10c2c8e`, `24714ac`, and `f2aa730`
complete the milestone contract. The production application now begins with a
dependency-free setup composition, projects only bounded public state, and
opens durable application state only after private vault readiness. The
official Compose topology starts concurrently, uses liveness health, and
preserves declared state in named volumes.

## Contract evidence

- Setup-only control and gateway listeners start without `GatewayRuntime`,
  `PersistenceWorker`, authentication, OAuth, MCP handling, vault credential
  clients, or ordinary jobs. Exact live, ready, setup status, setup page, and
  hashed asset reads are the only pre-handoff surfaces.
- Gate hooks run before control security hooks and before gateway health,
  metadata, OAuth, MCP body reads, authentication, credential use, or
  downstream behavior. Ordinary responses are uniform bounded 503s with
  `Retry-After`; request credentials and bodies are not reflected.
- The private status client validates endpoint ownership and a closed bounded
  response under a 100–5000 millisecond timeout. Polling coalesces work and
  caps backoff. Missing, timed-out, malformed, retrying, ready, and fatal
  states project without paths, key names, user counts, or raw errors.
- Handoff closes setup listeners before opening SQLite, checks persistence,
  schema, administrative audit, runtime and control vault handshakes, and
  assigned runtime keys, then starts the combined single-writer application.
  Zero users select the gated enrollment boundary; existing users select
  operational. Failure closes partial state and restores bounded setup-only
  service.
- Public `GET /api/v2/health/live`, `/api/v2/health/ready`, and
  `/api/v2/setup/status` use the approved raw closed representations. Unknown
  query, method, body, and browser asset variants are rejected.
- Compose has no vault dependency cycle. Vault and application health checks
  use liveness, the vault remains networkless, application key/manifest/socket
  mounts are read-only, and generated, setup, socket, vault, database, audit,
  and OAuth state have declared volumes. Image-owned mode-0700 UID-1000
  directories initialize fresh writable application volumes.
- The setup page provides one heading, landmarks, skip navigation, named
  controls, meaningful polite announcements, a safe operator-attention state,
  manual retry, fixed enrollment action, fixed available redirect, no-script
  refresh, 44-pixel targets, 320-pixel minimum layout, dark mode, visible
  focus, and reduced-motion behavior. Automatic updates preserve focus.

## Validation evidence

- Focused setup status, lifecycle, web asset, contract, and component suite:
  35 tests passed.
- Full server/web suite with four file workers: 158 files and 1018 tests
  passed.
- `npm run build`: passed in focused, OpenAPI, scan, and full-suite gates.
- `npm run check:control-openapi`: current.
- `node scripts/validate-v2.1-readiness.mjs`: 14 artifacts validated.
- `npm run scan:release-artifacts`: 626 closed-scope files passed.
- `git diff --check`: passed before each slice commit.

## Deviations and residual ownership

- Docker is unavailable on this host. Static Compose/Dockerfile contracts and
  real local process, Unix-socket, restart, and lifecycle tests passed; the
  clean Compose and container-recreation journey remains an explicit
  Milestone 10 release gate.
- The in-app browser backend reported no available browser. Component tests
  cover semantics, keyboard focus, live updates, strict status handling, and
  responsive/reduced-motion source contracts, but viewport screenshots,
  automated browser accessibility scanning, 200% zoom, and manual
  screen-reader review were not claimed. They remain explicit Milestone 10
  release evidence.
- The fixed enrollment action reaches `/control/enroll`; the neutral ceremony
  and its narrowly permitted mutations are Milestone 05. Ordinary login,
  session, and logout presentation remains Milestone 06.
