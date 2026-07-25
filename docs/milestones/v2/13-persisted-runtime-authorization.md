# Milestone 13: Persisted Runtime Authorization

## Purpose and why

Make the v2 database/vault configuration the live authority for MCP without weakening the existing request safety pipeline. This is the controlled cutover from YAML-backed services to published, versioned configuration and multi-user authorization.

## Dependencies

- Milestones 09–12.

## PRD traceability

- Sections 3.1, 13–18: gateway ordering, assignments, services, credentials, policy, eligibility boundary, and references.
- Sections 22, 28.1, and 38: concurrency, source-of-truth transition, and compatibility.
- Sections 31, 32, and 34.2–34.4: secrecy, topology/health, authorization, and invalidation.

## Scope

- Add immutable published runtime snapshots for services, destinations, credential metadata/locators, assignments, and policies.
- Change the MCP registry/runtime to read only activated database snapshots after v2 activation, while the future migration CLI remains the sole v1 YAML reader.
- Resolve authenticated user UUID/service groups and enforce service access before credential access and policy evaluation.
- Resolve vault credentials only after authentication, service/credential authorization, canonical destination validation, policy approval, capacity admission, and reference validation.
- Bind `gref`/`sec` references to user UUID, service, destination/credential, and published configuration identity.
- Consume service, destination, credential, assignment, policy, and account invalidation events with the precise PRD scope.
- Preserve the existing generic MCP tools, stateless per-POST authentication, destination protections, response scanning/tokenization, and bounded in-memory references.
- Make readiness fail safely when database, schema, vault, or required activation state is unavailable.

## Not in scope

- Multi-user OAuth login/grant issuance, added in Milestone 14; tests may use authenticated user contexts directly.
- Persistent gateway references or multiple active runtime replicas.
- Hot mutation of an in-flight snapshot.
- V1 migration orchestration.

## Required behavior and interfaces

- Draft or invalid configuration never reaches the runtime.
- One request evaluates one consistent published snapshot; later publication affects the next request.
- A user must have current service access and access to every requested credential.
- Unconfigured/disabled/archived credentials fail before vault resolution or downstream I/O.
- Policy changes take effect on the next request; targeted configuration changes invalidate affected capabilities exactly as the PRD specifies.
- After activation, startup cannot treat YAML and database as simultaneous configuration authorities.

## Security, authorization, invalidation, and audit

- Preserve and test the exact privileged pipeline ordering, including capacity before secret work/downstream I/O.
- Vault resolution is runtime-only and receives an already authorized scoped operation.
- Account security/status events invalidate all user references; service/credential/assignment events invalidate only affected references; policy is dynamically reevaluated.
- Runtime audits use immutable IDs/safe names and never contain credential/reference values or downstream bodies.

## Tests

- Positive: published service discovery, group/direct/`all` service access, credential authorization, multi-credential policy allow, authorized vault substitution, and next-request snapshot activation.
- Negative: draft config, unauthorized service/credential, cross-user/service reference, unconfigured credential, unsafe destination/path, policy denial, capacity denial, stale snapshot reference, vault failure, and database/vault readiness failure.
- Boundary: simultaneous publish/request, multiple groups/credentials, restart reference expiry, snapshot size limits, and targeted invalidation scope.
- Integration: real downstream HTTP and self-signed HTTPS regression prove ordering, TLS metadata, substitution, response protection, and no I/O on every preflight denial.

## Acceptance criteria

- Published database configuration is the sole runtime authority after explicit v2 activation.
- All service, credential, destination, policy, and capacity checks occur before secret resolution and downstream I/O.
- Existing ChatGPT/Codex-facing MCP tool contracts remain compatible.
- Reference binding and invalidation follow current user/configuration state without relying on transport sessions.

## Planning handoff

Specify snapshot construction/versioning, activation transaction, runtime reload/watch mechanism, event delivery/reconciliation, registry/evaluator adapters, vault-resolution capability, YAML deactivation guard, precise invalidation table, readiness dependencies, and compatibility test matrix.
