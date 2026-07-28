# Milestone 03: Browser-First Setup And Compose Gating

## Outcome

A clean official Compose start launches the vault and application concurrently.
Before vault provisioning is ready, the application owns no SQLite writer,
ordinary runtime, jobs, credential client, OAuth, MCP, login, or control
handler. It serves only bounded liveness, readiness, setup status, and branded
setup assets. After local prerequisites validate, it transitions through the
enrollment boundary or to the existing operational composition without exposing
partially initialized behavior.

## Governing contracts

- PRD `SETUP-008`, `SETUP-010`–`SETUP-012`, `SETUP-014`,
  `SETUP-021`–`SETUP-025`, `HEALTH-001`–`HEALTH-009`, and Acceptance 21.1.
- Milestone
  [`03-browser-first-setup-and-compose.md`](../../milestones/v2.1/03-browser-first-setup-and-compose.md).
- Architecture
  [`public-api.md`](../../architecture/v2.1/public-api.md),
  [`provisioning.md`](../../architecture/v2.1/provisioning.md),
  [`ux.md`](../../architecture/v2.1/ux.md), and
  [`validation-matrix.md`](../../architecture/v2.1/validation-matrix.md).
- Milestones 01–02 private status, runtime-key validation, endpoint ownership,
  and credential-handshake contracts.

## Current-state findings

- `startSecretSauceApplication` constructs `GatewayRuntime` first. Its
  constructor opens the persistence worker, attaches durable audit, creates
  OAuth/runtime capabilities, and starts maintenance before vault status is
  checked. A distinct setup-only composition root is therefore required.
- The control and gateway listeners currently expose their ordinary route trees
  directly. Setup gating must run before control authentication hooks and before
  gateway metadata, OAuth, MCP parsing, authentication, vault, or downstream
  dispatch.
- The existing control health route is an operational dependency projection,
  not the approved v2.1 live/ready/setup contract. Existing `/health` behavior
  remains a compatibility surface after operational transition.
- Compose waits for vault readiness before starting the application and uses
  readiness-oriented health. This prevents concurrent browser-observable setup
  and must be replaced with liveness health and no dependency cycle.
- The existing branded SPA and static-asset loader can host a dedicated setup
  route, but it needs a closed client schema, bounded polling, meaningful-change
  announcements, and focus-preserving transition behavior.

## Decisions

- Add a lifecycle coordinator used by the production application entrypoint.
  It begins with two minimal setup-only listeners on the configured control and
  gateway addresses. It does not instantiate `GatewayRuntime`,
  `PersistenceWorker`, identity services, OAuth, jobs, or vault credential
  clients.
- A closed setup-state projector polls the private status socket with one
  in-flight request, a bounded timeout, and capped backoff. It maps all internal
  outcomes to only `preparing`, `enrollment`, `available`, or `not_ready`, one
  safe message, and `retry_pending`.
- Setup-only listeners allow exact live/ready/setup GETs and branded setup
  assets. Every other control/browser route returns one maintenance 503. Every
  other gateway/OAuth/MCP route returns bounded temporary unavailability with
  `Retry-After`, before reading a body or authenticating.
- On private `ready`, the coordinator closes the minimal listeners, validates
  assigned keys/manifest, and constructs the existing operational application.
  Any local prerequisite failure closes the partial candidate and returns to
  bounded `not_ready`; it does not leave a partial listener or writer.
- The operational servers receive the same lifecycle gate ahead of ordinary
  work. Zero users project `enrollment`; a nonempty usable identity baseline
  projects `available` during handoff and then `operational`. Milestone 05 will
  add the enrollment mutation exception without weakening the gate.
- Official Compose starts both services without `depends_on`, uses liveness
  health, preserves named setup/key/database/vault/audit state, keeps the vault
  networkless, and mounts vault socket/key/manifest views read-only into the
  application.

## Slice plan

### Slice 1: Setup-only composition and fail-early route gate

**Contract:** start bounded application status without constructing ordinary
runtime state, and reject every non-setup request before expensive or privileged
work.

**Included:** closed setup state/domain projector, private-status polling
client with timeout/backoff, minimal control/gateway setup listeners,
live/ready/setup schemas, maintenance responses and `Retry-After`, lifecycle
transition seam, writer/job/listener negative instrumentation.

**Excluded:** final Compose storage layout and browser presentation.

**Evidence:** preparing/retry/fatal/absent/timeout/malformed mapping; exact route
input rejection; no `GatewayRuntime`, persistence writer, jobs, authentication,
OAuth, MCP body parsing, credential client, or downstream call before handoff;
partial operational initialization closes and returns bounded failure.

### Slice 2: Operational handoff and Compose/storage boundary

**Contract:** transition only after every local prerequisite passes, and make
the official deployment concurrent, persistent, least-privilege, and
liveness-driven.

**Included:** assigned-key/manifest validation, persistence/audit/vault
handshake aggregation, zero-user enrollment projection, operational gate,
Compose dependency removal, liveness health, named durable volumes,
read-only application mounts, socket non-rebind evidence, recreation fixtures,
operator/configuration documentation.

**Excluded:** root rotation and enrollment mutation implementation.

**Evidence:** enrollment/available/operational transitions; failed dependency
never exposes ordinary work; concurrent Compose graph without cycles; vault has
no network; setup/key/database/vault/audit continuity; application cannot
write generated keys, manifest, or socket endpoints; no Docker-socket access.

### Slice 3: Accessible browser setup experience and integrated qualification

**Contract:** present the bounded setup states through a responsive,
focus-preserving branded experience that advances without disclosure.

**Included:** setup SPA route/client schema, bounded polling and retry behavior,
meaningful live announcements, no-script refresh, not-ready operator message,
enrollment action, available redirect, responsive/reduced-motion/focus styles,
process/browser integration and documentation closure.

**Evidence:** browser component and real-browser checks for preparing/retry,
not-ready, enrollment, and available transitions; keyboard/focus/live-region
behavior; 320/768/1280 layouts; no sensitive/private details; focused setup and
Compose suites, container smoke when available, build, full suite, OpenAPI,
readiness validation, and release scan.

## Cross-slice constraints

- Status and diagnostics contain no user count, key identity/path, store path,
  socket path, internal host, raw failure, stack, credential, token, body, or
  reversible material.
- Every new environment, HTTP, polling, and status input has positive and
  negative tests with exact bounds.
- Setup gating precedes body reads, authentication, authorization, OAuth/MCP
  work, credential substitution, downstream I/O, and database ownership.
- No remote setup/provisioning control, Docker-socket inspection, setup service,
  service-specific tool, or manual initialization command is introduced.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | `10c2c8e` | 17/17 setup/private-status/process tests; server build; strict status states, timeout/owner inputs, capped one-in-flight polling, exact live/ready/status routes, maintenance-first ordinary-route rejection, and dependency-free setup composition | Production lifecycle handoff remains Slice 2 so this slice introduces no partially gated entrypoint. |
| 2 | completed | `24714ac` | 64/64 focused setup, handoff, gateway/control gate, Compose, container, and real vault-process tests; production build; current OpenAPI; 625-file release scan; zero-user enrollment and existing-user operational transitions; failed handoff rollback; concurrent liveness-driven Compose with named durable state and read-only application mounts | Docker runtime was unavailable, so static Compose contracts and real local process/socket continuity provide slice evidence; the full container recreation journey remains a Milestone 10 release gate. |
| 3 | completed | `f2aa730` | 35/35 focused setup status, lifecycle, web asset, public contract, and component tests; 158-file/1018-test full suite; production build; raw OpenAPI health/setup contract; strict 2 KiB browser status client; capped focus-preserving polling; preparing, not-ready, enrollment, available, no-script, responsive, dark, and reduced-motion presentation | The in-app browser backend exposed no available browser, so viewport screenshots and manual screen-reader review could not be recorded. Those human/browser release checks remain explicit Milestone 10 evidence rather than being claimed here. |
