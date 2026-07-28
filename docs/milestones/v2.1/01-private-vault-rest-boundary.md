# Milestone 01: Private Vault REST Boundary

## Purpose and why

Replace the current private vault framing with one versioned, strictly bounded
HTTP/1.1 resource contract over separate Unix sockets while preserving existing
vault domain authorization. Provisioning and runtime work depend on mutually
authenticated, restart-aware vault communication, so this trust boundary must
be independently proven first.

## Dependencies

- `00` — Consumes approved OpenAPI, handler, caller-authentication, boot-binding,
  socket-ownership, error, and validation contracts.

## PRD traceability

- `VAULTAPI-001`–`VAULTAPI-008` — complete private vault REST contract.
- `SETUP-022`, `SETUP-025` — private status resource and Unix-socket-only vault.
- Sections 7, 8.3, 13.8, 15, 18.1, 21.7, 22, 23, and 25 — trust boundaries,
  deployment, security, tests, documentation, and settled transport decisions.
- Section 24 question 7 — server/client adapter selection.

## Scope

- Establish one canonical OpenAPI 3.1 source for status and credential resources,
  their closed schemas, explicit media types, bounds, errors, and versions.
- Implement strict HTTP/1.1 Unix-socket server and first-party client adapters
  around transport-neutral authenticated vault domain handlers.
- Separate the bodyless, queryless, parameterless status listener lifecycle from
  the authenticated credential listener lifecycle.
- Authenticate every credential request with caller-specific HMAC binding,
  canonical security encodings, timestamp/nonce replay protection, request UUID,
  exact target/representation/body binding, and fixed operation allowlists.
- Authenticate every post-caller-authentication response before parsing using
  request, caller, status, representation, body, and current boot bindings.
- Add the store-free boot handshake and invalidate prior requests, nonces,
  capabilities, and in-memory transfers on vault restart.
- Validate vault-owned, non-symlinked socket parents and read-only client mounts;
  reject replaced, writable, wrongly owned, or non-socket endpoints.
- Migrate existing data-plane, control-plane, and backup callers without
  changing their domain permissions or one-use capability requirements.

## Not in scope

- Automatic key generation, manifest transitions, adoption, retry scheduling,
  setup-only application composition, or root rotation.
- TCP, HTTPS, mTLS, remote-vault settings, certificate lifecycle, service
  discovery, redirects, cookies, browser CORS, or dormant network transports.
- New vault operations, widened caller allowlists, or a second authorization
  path.

## Required behavior and interfaces

- Both listeners use the approved versioned HTTP resource contract over distinct
  Unix sockets; the vault opens no network listener.
- Unknown methods/routes, unsupported media types/upgrades, duplicate security
  headers, ambiguous targets/framing, oversized inputs, invalid UTF-8, and
  unknown fields fail before domain or store access.
- Domain handlers receive only an authenticated caller context, validated
  operation input, and bounded request metadata, never HTTP or socket objects.
- The status resource is read-only and non-secret; credential operations require
  caller authentication plus current operation authorization/capability.
- A client treats unsigned or invalidly signed responses as generic unavailable
  or authentication failures and never as trusted vault-domain results.
- Durable journaled work after restart requires a fresh handshake and fresh
  authorization; prior-process authority cannot resume it.

## Security, authorization, invalidation, and audit

- Filesystem reachability is defense in depth, not credential-API
  authentication.
- Caller substitution, audience/path/header/body tampering, replay, stale
  timestamps, non-canonical encodings, and wrong-boot authority fail closed.
- Data, control, and backup callers retain disjoint fixed operation allowlists;
  data resolution still requires a one-use operation-bound capability.
- Logs, traces, errors, fixtures, and OpenAPI examples exclude raw credentials,
  opaque authorization values, cookies, secret-bearing headers, and bodies.
- A vault restart invalidates all in-memory or bearer authority tied to the old
  boot identifier without weakening durable domain-state recovery.

## Required tests and validation

- Positive contract tests for every status and credential resource, caller,
  media type, response signature, boot handshake, and allowed operation.
- Negative tests for caller/audience/method/target/header/body/status/boot
  tampering, canonical base64url failures, nonce replay, expiry, duplicate
  security headers, ambiguous framing, oversized data, unknown fields, and
  cross-caller operations.
- Endpoint tests for symlinked parents, wrong owner/mode, writable or replaced
  endpoints, read-only client mounts, and absent/non-socket paths.
- Process tests proving restart changes the boot identifier and rejects all
  prior requests, capabilities, nonces, transfers, and forged/replayed
  responses before parsing.
- Adapter tests invoke the same domain handlers with synthetic authenticated
  contexts and no HTTP/socket objects.
- OpenAPI generation/conformance, focused vault integration tests, production
  build, full suite, and secret-artifact scan pass.

## Acceptance criteria

- [ ] All first-party vault operations use the canonical private REST contract
      and preserve existing least-privilege behavior.
- [ ] Separate status and credential sockets enforce their distinct lifecycle,
      authentication, and schema contracts.
- [ ] Credential clients verify request-correlated response authentication and
      current boot identity before parsing any body.
- [ ] Negative protocol and caller tests prove rejection before domain/store
      access.
- [ ] No TCP/HTTPS listener or remote-vault configuration ships in v2.1.
- [ ] OpenAPI, build, full-suite, process, and secret-scan gates pass.

## Planning handoff

Resolve the approved HTTP/OpenAPI libraries, canonicalization module, nonce
cache and clock bounds, boot identifier lifecycle, response authenticator
placement, streaming verification, socket metadata checks, migration order for
existing callers, and compatibility fixtures. Likely slices are: canonical
contract plus strict adapters; caller/response authentication and boot binding;
then caller migration, deployment hardening, and conformance validation.
