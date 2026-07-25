# Milestone 13 Persisted Runtime Authorization Acceptance Review

## Review conclusion

Milestone 13 is complete. Activated, immutable database snapshots are now the
sole MCP authority in database mode. The runtime resolves current UUID/group
access and policy state before issuing least-privilege, single-use vault
capabilities, while retaining the generic stateless MCP surface and the shared
destination, substitution, TLS, response-protection, and audit pipeline.

The cutover is deliberately one-way and single-replica. Multi-user OAuth grant
issuance remains Milestone 14; milestone tests authenticate UUID user contexts
directly.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Immutable authority | Migration `0013`, canonical bounded snapshots, atomic active pointers, publication generations, explicit one-use activation |
| Sole source | Closed `runtime.authority` choice rejects mixed YAML/database services; database mode has no YAML fallback |
| Discovery authorization | Active ordinary UUID identity, direct/group/`all` service selectors, credential-selector intersection |
| Privileged ordering | Authentication, current authority, canonical destination/path, caller headers/cookies/body, reference placement/binding, all policies, and capacity precede vault resolution and downstream I/O |
| Vault isolation | Gateway mounts data-plane and resolve-capability keys only; resolve capability binds subject, epochs, immutable IDs, method, path, request, operation, locator, and generation |
| Reference safety | `gref_` and `sec_` bind subject, service, destination, publication, authorization, security, and global generations; credential references add credential generation |
| Invalidation | Durable ordered event consumption, precise subject/service/credential eviction, policy-only reevaluation, snapshot reconciliation before the next read |
| Response safety | Persisted selected safeguards are conservatively conjoined and applied by the existing exact/pattern and binary response pipeline |
| Readiness and audit | Database/schema/activation/vault fail closed; policy/capacity and successful requests use sanitized audits without credential/reference values or bodies |

## Security and architecture review

- Draft, archived, disabled, unconfigured, unauthorized, or stale objects fail
  before vault access.
- Reference inspection is non-refreshing until capacity admission. JSON
  property-name and syntax placements are rejected before secret work.
- Canonical path policy and downstream routing use the same pathname and retain
  the route-changing percent-encoding rejection.
- Multiple credentials require every credential assignment and policy to allow;
  each secret is resolved separately and every callback buffer is zeroized.
- The data-plane runtime exposes no backup-capability issuer and mounts neither
  backup authority nor vault root material.
- Runtime response references receive the same publication/destination binding
  as configured references and cannot cross users, services, destinations,
  publications, restarts, or security epochs.
- Response scanning remains best-effort exact/pattern defense and is not
  represented as a universal non-exfiltration guarantee.

## Validation

- production server and responsive browser builds
- activation positive/negative, rollback, immutable publication, and sanitized
  CLI boundary tests
- direct, group, and `all` discovery plus inactive, privileged, and non-UUID
  identity denials
- reference cross-subject/service/destination/publication/restart and targeted
  invalidation tests
- next-read assignment, credential, and policy reconciliation
- unsafe destination/path/header/cookie/body/reference-placement, policy,
  capacity, and vault-failure preflight tests with zero vault/downstream calls
- real downstream HTTP, multi-credential substitution, buffer zeroization,
  persisted response safeguards, and the shared self-signed HTTPS regression
- OpenAPI currency check
- full regression suite: 90 files and 680 tests passed

Accepted implementation commits: `a26bff4`, `59f2588`, `ab86199`, `1c512ef`,
`b0d4aaf`, `c6e55ec`, and `7fa41fd`.
