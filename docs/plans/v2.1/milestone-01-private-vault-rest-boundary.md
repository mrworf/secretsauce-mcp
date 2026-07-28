# Milestone 01: Private Vault REST Boundary

## Outcome

Every first-party vault caller uses one versioned, strictly bounded HTTP/1.1
resource contract over filesystem-restricted Unix sockets. Provisioning status
has a separate read-only lifecycle. Credential requests and responses are
caller-authenticated, boot-bound, replay-resistant, and dispatched through the
existing least-privilege domain operations without TCP, HTTPS, or a parallel
authorization path.

## Governing contracts

- PRD: `VAULTAPI-001`–`VAULTAPI-008`, `SETUP-022`, `SETUP-025`, and
  Acceptance 21.7 in
  [`docs/prd/secretsauce-v2.1-prd.md`](../../prd/secretsauce-v2.1-prd.md).
- Milestone:
  [`docs/milestones/v2.1/01-private-vault-rest-boundary.md`](../../milestones/v2.1/01-private-vault-rest-boundary.md).
- Architecture:
  [`vault-rest-api.md`](../../architecture/v2.1/vault-rest-api.md),
  [`decisions.md`](../../architecture/v2.1/decisions.md), and
  [`validation-matrix.md`](../../architecture/v2.1/validation-matrix.md).
- Canonical private contract:
  [`docs/openapi/vault-v1.yaml`](../../openapi/vault-v1.yaml).
- Repository instructions: [`AGENTS.md`](../../../AGENTS.md).

## Current-state findings

- `src/vault/broker.ts`, `client.ts`, and `protocol.ts` implement a mature
  authenticated binary frame over one Unix socket. The encrypted record store,
  capability authority, backup/archive state machines, caller allowlists,
  process lifecycle, and role-specific client interfaces already pass focused
  tests and should be reused.
- `src/vault/contracts.ts` owns strict Zod schemas and canonical base64url
  validation. `BoundedReplayCache` provides bounded nonce/capability replay
  storage. `src/vault/config.ts` validates paths and reads caller keys.
- Fastify 5 is already a production dependency. Node's strict HTTP parser and
  raw request metadata can reject ambiguous framing and duplicate security
  fields before domain dispatch. No second HTTP dependency is needed.
- The existing configuration and Compose example expose one
  `SECRETSAUCE_VAULT_SOCKET`; this milestone must separate status and credential
  socket paths while preserving role-specific key possession.
- Permission-correct baseline: build succeeded; 969/973 tests passed. Three
  release-document tests failed from stale reorganization paths and were
  repaired in prerequisite commit `21eeb52` (focused 7/7 pass). The remaining
  password-concurrency test was a resource-contention timeout and passed focused
  in 2.1 seconds without changes.

## Decisions

- Keep the existing public `ControlVaultClient`, `DataVaultClient`, and
  `BackupVaultClient` method interfaces so downstream callers migrate without
  acquiring new authority.
- Extract the broker's current dispatch into a `VaultDomainHandler` that accepts
  only `AuthenticatedVaultCaller`, a closed operation union, and bounded request
  metadata. It owns capabilities, store use, transfer state, and boot reset; it
  has no HTTP, socket, or Fastify types.
- Use a shared Fastify factory for two server instances listening on distinct
  Unix paths. The status instance registers only `GET /v1/status`. The
  credential instance registers readiness, credential, resolution, and transfer
  resources and starts only when explicitly requested by the composition root.
- Preserve the current 64 KiB credential/chunk and 10,000-selection bounds in
  the canonical OpenAPI; the readiness draft's larger maxima were conservative
  ceilings, not required product behavior. The 1 GiB archive and 100,000-record
  archive limits remain.
- Use fixed lowercase header names internally. Reject duplicates by scanning
  `rawHeaders` before reading a body. The canonical request MAC binds the
  constant logical audience `secretsauce-vault`, API version `v1`, caller,
  uppercase method, exact canonical origin-form target, normalized selected
  representation headers, SHA-256 of exact body bytes, canonical request UUID,
  decimal millisecond timestamp, and canonical 16-byte base64url nonce.
- Credential timestamps accept ±30 seconds. Nonces remain in a bounded
  per-process replay cache. A fresh random UUIDv4 boot identifier is created for
  every credential-server construction.
- The store-free `POST /v1/readiness` is the sole request without an inbound
  boot ID. Its authenticated response returns the current boot ID. All later
  requests and capabilities bind that ID. Milestone 01 adds the field to
  capability contracts; issuers learn it from the readiness handle.
- Authenticate every response after request authentication with an
  `X-Vault-Response-MAC` over logical audience/version, caller, boot ID, request
  UUID, status, selected representation headers, and exact response-body
  digest. Clients verify the MAC and boot before parsing success or error bodies.
- Client endpoint checks walk every parent component without following
  symlinks, require the endpoint to be a socket owned by the expected effective
  identity, reject group/world-writable or client-writable metadata, and compare
  metadata immediately before connect. Deployment tests prove read-only mounts;
  code does not infer mount flags from mode bits.
- A status server may project the current store readiness as `ready` for this
  milestone. Provisioning state/retry/error ownership arrives in Milestone 02;
  no mutation is exposed now.

## Scope

### Included

- Transport-neutral domain handler and typed operation union.
- Canonical request/response authentication and boot lifecycle.
- Strict status and credential HTTP/Fastify adapters over separate Unix sockets.
- Role-specific clients migrated to the REST resources, including bounded
  secret and archive media.
- Configuration, readiness, process, Compose, endpoint validation, OpenAPI
  conformance, documentation, and compatibility tests.

### Excluded and deferred

- Key generation, manifest/adoption/retry logic, setup-only application
  composition, root rotation, and public setup projection.
- TCP/HTTPS/mTLS, remote settings, redirects, CORS, cookies, proxy discovery, or
  certificate lifecycle.
- New vault domain operations, caller roles, widened allowlists, store format
  changes, or archive cryptography changes.
- Independent assurance and release qualification.

## Slice plan

### Slice 1: Transport-neutral authenticated vault domain

**Slice contract**

- Outcome: existing vault operations execute through one HTTP-independent typed
  handler with current caller/capability boundaries and boot-aware authority.
- Included: operation union, boot-aware request metadata/caller context, domain
  dispatch, transfer lifecycle, capability enforcement, unit tests.
- Excluded: HTTP parsing, sockets, and first-party REST clients.
- Independently testable because: synthetic caller contexts can exercise every
  allowed operation and denial without a network or transport object.

**Expected changes**

- Code/modules: new domain handler/context types; broker dispatch extraction;
  capability boot binding.
- Data/schema/migrations: none.
- API/CLI/UI: no external listener change yet.
- Documentation/operations: plan execution record.

**Evidence**

- Positive: readiness, control CRUD/metadata, data resolve, all backup/restore
  transfer paths for allowed synthetic callers.
- Negative/boundary: every cross-caller operation; missing/wrong boot; forged,
  stale, replayed, or mismatched capability; transfer sequence/size/capacity;
  handler input has no HTTP/socket fields.
- Focused commands:
  `npx vitest run test/vault-domain.test.ts test/vault-capabilities.test.ts
  test/vault-archive.test.ts`.
- Required broad gate: `npm run build:server`.

**Acceptance mapping**

- `VAULTAPI-004`, `VAULTAPI-006`, and the domain half of `VAULTAPI-008` ->
  domain and capability tests. Capability token boot fields move with the
  readiness handshake in Slice 2 so no transitional issuer can mint authority
  without learning the server boot.
- Acceptance 21.7.5, 21.7.7, 21.7.10 -> caller matrix, synthetic adapter, restart
  authority tests.

### Slice 2: Strict authenticated REST adapters and clients

**Slice contract**

- Outcome: separate status/credential Fastify servers and all role-specific
  clients conform to the versioned resources with mutual authentication before
  parsing or domain/store use.
- Included: canonicalization, raw-header/target/framing guards, body/media
  bounds, request/response HMACs, boot handshake, resource mapping, typed client
  migration, transfer streaming.
- Excluded: deployment config and Compose hardening.
- Independently testable because: real Unix-socket integration exercises every
  client operation plus raw adversarial HTTP requests.

**Expected changes**

- Code/modules: protocol canonicalization, REST server adapter, client exchange,
  broker composition, error mapping.
- Data/schema/migrations: none.
- API/CLI/UI: `/v1/status`, `/v1/readiness`, credential, resolution, and transfer
  resources from the canonical OpenAPI.
- Documentation/operations: OpenAPI bound corrections and conformance mapping.

**Evidence**

- Positive: every route, caller, media type, readiness/boot response, response
  signature, CRUD/resolve/transfer operation, exact lower/upper body bounds.
- Negative: method/target/header/body/status/caller/audience/boot tampering;
  noncanonical UUID/base64url/decimal; nonce replay/staleness; duplicate security
  headers; conflicting framing; upgrade; unknown field/route/media; oversized,
  invalid UTF-8, incomplete, and cross-caller inputs. Tests assert the domain
  spy/store was untouched and clients did not parse unauthenticated bodies.
- Focused commands:
  `npx vitest run test/vault-http-protocol.test.ts test/vault-broker.test.ts`.
- Required broad gate: `npm run build:server`.

**Acceptance mapping**

- `VAULTAPI-001`–`VAULTAPI-006`, `VAULTAPI-008`, Acceptance 21.7.1–7 and
  21.7.9–10 -> HTTP protocol, broker, client, and conformance tests.

### Slice 3: Endpoint, process, and deployment migration

**Slice contract**

- Outcome: configuration and official deployment use distinct protected socket
  lifecycles; every first-party caller is migrated; restart invalidation and
  no-network topology are proven.
- Included: config/environment/example changes, endpoint metadata validation,
  process/health/readiness migration, Compose mounts/topology, OpenAPI/readiness
  validators, documentation, regression tests.
- Excluded: setup provisioning and public setup-only composition.
- Independently testable because: child-process and deployment tests prove
  ownership, lifecycle, restart, caller migration, and topology end to end.

**Expected changes**

- Code/modules: vault config/main/readiness/health and endpoint validator.
- Data/schema/migrations: config version remains `1`; `status_socket` and
  `credential_socket` replace the old single `socket` key with fail-closed
  validation.
- API/CLI/UI: environment separates
  `SECRETSAUCE_VAULT_STATUS_SOCKET` and
  `SECRETSAUCE_VAULT_CREDENTIAL_SOCKET`.
- Documentation/operations: example config/Compose and private API notes.

**Evidence**

- Positive: both protected sockets, all first-party callers, process restart
  with a changed boot ID, fresh handshake, persistence continuity, read-only
  client mounts, status/credential lifecycle.
- Negative: symlinked parent, wrong owner/mode, writable/replaced/absent/
  non-socket endpoint, prior boot request/nonce/capability/transfer/response,
  config partials and path collisions. No TCP/HTTPS listener/config exists.
- Focused commands:
  `npx vitest run test/vault-process-integration.test.ts
  test/v1-migration-process-integration.test.ts
  test/credential-management.test.ts test/vault-deployment.test.ts`;
  `node scripts/validate-v2.1-readiness.mjs`.
- Required broad gate: `npm run build`, `npm run check:control-openapi`,
  `npm run scan:release-artifacts`, and permission-correct `npm test`.

**Acceptance mapping**

- `SETUP-022`, `SETUP-025`, `VAULTAPI-002`, `VAULTAPI-007`–`008`,
  Acceptance 21.7.1–2 and 21.7.8–10 -> process/deployment/endpoint/restart
  evidence.
- All Milestone 01 acceptance criteria -> cumulative gate and acceptance audit.

## Cross-slice concerns

- Compatibility and migration: internal config changes fail closed; record,
  archive, and downstream client method contracts remain compatible.
- Authorization and security: authentication and fixed allowlists precede
  domain/store access. Existing data capabilities are still issued only after
  authentication, destination/policy validation, and capacity in their owning
  runtime path.
- Invalidation and lifecycle: server boot construction resets nonce, capability,
  and transfer authority. Store data remains durable and is not tied to process
  boot.
- Audit and observability: vault emits only bounded categories; never raw
  headers, bodies, bearer/capability values, keys, endpoint paths, or responses.
- Performance and scale: 32 connections, 8 active cryptographic operations,
  5-second deadlines, 64 KiB secret/chunk, 1 GiB archive, 10,000 selection, and
  100,000 archive-record limits remain explicit.
- Environment: Unix-socket tests require sandbox network/listener permission.

## Milestone completion gate

- Re-read `VAULTAPI-001`–`VAULTAPI-008` and Acceptance 21.7 against named tests.
- Run focused domain, protocol, broker, process, endpoint, and deployment suites.
- `node scripts/validate-v2.1-readiness.mjs`
- `npm run build`
- `npm run check:control-openapi`
- `npm run scan:release-artifacts`
- Permission-correct `npm test`
- Inspect the cumulative diff for binary-frame remnants, TCP/HTTPS/remote
  transport, new authority, prohibited diagnostics, and unrelated churn.

The pre-existing password-concurrency timeout is an environment/resource defect
only if its focused test continues to pass unchanged. It does not waive the
required final full-suite gate.

## Rollback and recovery

Each slice is revertible. Before the final deployment migration, reverting the
adapter/client slice restores the single binary socket without changing
encrypted records. After config migration, revert code, examples, config, and
caller environment together. No database or vault-store data migration occurs.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | `efcb969` | 15/15 focused domain/capability/archive tests; 21/21 legacy broker/process/credential regressions; server build | Boot fields for capability tokens moved with the Slice 2 handshake; the handler already rejected wrong-boot contexts. |
| 2 | completed | | 12/12 HTTP protocol/broker tests; 12/12 capability/domain/protocol tests; 6/6 standalone process and migration tests; 8/8 credential-management tests; server build | Existing typed client method contracts were retained. Deployment configuration and endpoint mount validation remain in Slice 3. |
| 3 | pending | | | |

## Deferred follow-ups

- Milestone 02 owns provisioning status values, retry state, and credential
  listener suppression before configured commit.
- Milestone 03 owns public setup projection and Compose application gating.
- Milestone 04 owns host-authorized root-maintenance journal behavior.
