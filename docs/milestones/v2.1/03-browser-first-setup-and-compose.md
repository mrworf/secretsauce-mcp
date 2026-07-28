# Milestone 03: Browser-First Setup And Compose Gating

## Purpose and why

Make a clean official Compose deployment safely observable and operable from
container start through browser enrollment without an initialization command.
This milestone joins the proven vault provisioning lifecycle to an explicit
setup-only application composition and blocks every ordinary interface until
the whole application, not just the vault, is operational.

## Dependencies

- `01` — Consumes separate private status and credential REST sockets plus
  authenticated readiness.
- `02` — Consumes the fixed configured manifest, bounded provisioning state,
  assigned-key validation, and irreversible setup privilege transition.

## PRD traceability

- `SETUP-008`, `SETUP-010`–`SETUP-012`, `SETUP-014`, and
  `SETUP-021`–`SETUP-025` — interface gating, storage, concurrent startup,
  volumes, sockets, privileges, and no-network vault.
- `HEALTH-001`–`HEALTH-009` — public liveness, readiness, setup status, and
  pre-operational behavior.
- Sections 5.2, 8.2–8.3, 10.1, 11.1, 12.1, 16.1–16.3, 17.3, 18–20, 21.1,
  21.6, 22, 23, and 25 — browser-first workflow, UX, deployment, operations,
  acceptance, tests, and documentation.

## Scope

- Add explicit setup-only and operational application composition-root phases.
- Start vault and application concurrently; serve bounded health, setup status,
  and safe assets without opening the database writer, jobs, credential
  clients, login/control, OAuth, or MCP behavior.
- Map private `preparing`, `ready`, and `configuration_error` plus timeout,
  absence, and malformed responses into the bounded public setup contract.
- Gate all routes and expensive work before authentication, OAuth issuance, MCP
  work, credential substitution, or downstream I/O.
- Transition to operational only after configured manifest validation,
  assigned-key validation, persistence, audit, vault credential handshake, jobs,
  and required listeners are usable.
- Update the official single-instance Compose topology with declared durable
  setup, key, database, vault, and audit volumes; separate read-only client
  socket/key/manifest mounts; and a vault service with no network attachment.
- Use liveness for Compose health while preserving operational readiness
  semantics.
- Implement the accessible bounded setup-status browser experience and polling.
- Validate storage behavior and continuity without claiming arbitrary
  filesystem durability or accessing the Docker socket.

## Not in scope

- Bootstrap-secret issuance or enrollment completion, ordinary login/logout, or
  account settings.
- Root rotation, remote setup controls, an additional setup service, or a manual
  initialization CLI.
- Multiple active application instances, generic deployment autodiscovery, or
  proving arbitrary mount durability from inside a container.

## Required behavior and interfaces

- Liveness returns 200 whenever bounded status can be served. Readiness is 200
  only in `operational`; otherwise it is bounded 503.
- Public setup status exposes only `preparing`, `available`, or `not_ready`, a
  safe message, and retry-pending state; it never reveals user existence, key
  identities/paths, internal hosts, or raw failures.
- Disallowed web/control routes return uniform maintenance 503. OAuth and MCP
  use bounded temporary-unavailability behavior with `Retry-After`.
- Private vault `ready` is necessary but insufficient for application
  readiness; every application-local dependency must pass.
- The setup-only process does not take the SQLite application-writer lock or
  start ordinary jobs/listeners.
- Compose recreation preserves declared durable state; the vault has no network
  attachment, and non-vault identities cannot bind, unlink, rename, or replace
  its sockets.
- Setup polling and retry status remain lightweight and bounded.

## Security, authorization, invalidation, and audit

- Setup gating executes before any handler capable of authentication work,
  OAuth issuance, MCP parsing with side effects, vault credential use, or
  downstream I/O.
- Status surfaces, application events, and browser content contain no secrets,
  key names, paths, user counts, stack traces, internal hosts, or raw errors.
- Socket parents remain vault-owned and non-rebindable; all application mounts
  are read-only and endpoint metadata is validated before connection.
- Generated keys and manifest views are read-only and least-privilege per
  runtime consumer.
- The one intentional bootstrap log exception remains absent until Milestone 05.

## Required tests and validation

- Positive process/browser tests cover preparing, retry, available,
  enrollment-permitted, and operational transitions.
- Negative tests cover absent/timeout/malformed private status, fatal
  configuration error, premature database writer/jobs/listeners, every
  disallowed control/OAuth/MCP route, and public information disclosure.
- Compose tests prove concurrent startup without a dependency cycle, liveness
  health, no vault network attachment, durable volumes, read-only client mounts,
  socket ownership/non-rebindability, container recreation, and no restart loop
  during retry or fatal setup.
- Browser/accessibility tests cover responsive setup content, bounded polling,
  keyboard/focus/status behavior, and transition to ordinary branded surfaces.
- Storage tests cover write access, restrictive modes, atomic replacement, sync
  behavior, continuity signals, and the absence of Docker-socket inspection.
- Container smoke, focused setup integration, production build, full suite,
  OpenAPI conformance, and artifact scan pass.

## Acceptance criteria

- [ ] A clean official Compose start reaches the browser enrollment boundary
      without any setup or key-generation command.
- [ ] No ordinary control, login, OAuth, MCP, vault-credential, or downstream
      operation executes before operational prerequisites permit it.
- [ ] Liveness/readiness/setup status remain bounded and correct through retry,
      enrollment-required, fatal error, and operational states.
- [ ] Compose recreation preserves all declared durable state and the vault has
      no network attachment in every phase.
- [ ] Setup-only application startup cannot acquire the database writer or
      expose partially initialized interfaces.
- [ ] Required browser, Compose, smoke, build, full-suite, OpenAPI, and artifact
      gates pass.

## Planning handoff

Resolve composition-root boundaries, readiness dependency aggregation, route
gating placement, bounded status client timeouts/polling, Compose users/groups
and mount layout, capability checks for no-network/read-only guarantees,
container-recreation fixtures, and setup-page state transitions. Likely slices
are: setup-only composition and health gating; Compose/storage/socket topology;
then browser status UX and full integration qualification.
