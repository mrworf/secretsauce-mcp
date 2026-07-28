# Milestone 04: Envelope-Root Rotation

## Purpose and why

Deliver the two explicitly supported configured-state envelope-root rotations as
host-authorized, journaled maintenance transitions. Rotation is separated from
fresh provisioning because it temporarily acquires exclusive write authority
over retained encrypted state and needs its own interruption, idempotency, and
recovery contract.

## Dependencies

- `01` — Consumes the private status interface and the rule that the credential
  listener remains absent through setup-only maintenance.
- `02` — Consumes configured manifest validation, closed key/store adapters,
  setup-state ownership, versioned root representation, and privilege drop.

## PRD traceability

- `SETUP-027`–`SETUP-028` — complete host-local rotation and journal contract.
- Sections 7, 8.1–8.2, 10.1, 11.6, 12.1, 13.1, 15, 18.1–18.2, 21.1.28–30,
  22, 23, and 25 — authority, lifecycle, failure, operations, acceptance,
  validation, documentation, and settled decisions.
- Section 24 question 8 — store-adapter transactions and journal representation.

## Scope

- Accept exactly `identity` or `vault` plus a canonical non-secret request UUID
  from host-local vault startup arguments.
- Validate the configured manifest, complete key set, aggregate commitment,
  retained-state compatibility, active root, target store, and exclusive
  maintenance authority before writes.
- Persist one durable operation journal bound to installation, request UUID,
  target, starting aggregate, and old/new physical root versions.
- Atomically stage a new versioned root without replacing the old root, activate
  it for new writes, and resumably rewrap affected data-encryption keys through
  the target's closed store adapter using expected-old-version conditions.
- Prove zero remaining old-root references, then atomically commit the new
  fingerprint, active version, aggregate commitment, and lifetime request
  receipt before retiring the old root from application use.
- Resume a valid incomplete journal before ordinary startup even without
  repeated arguments.
- Return an idempotent no-change result for a completed request UUID and fail
  closed for conflicting or ambiguous reuse.
- Document supported invocation, interruption/resume, diagnostics, exclusive
  write requirements, and restoration/escalation.

## Not in scope

- Rotation of session HMAC, OAuth signing/token HMAC, vault caller/capability
  keys, TLS material, database credentials, or externally owned secrets.
- Browser, REST, control, OAuth, MCP, database setting, or remotely invokable
  CLI authority to initiate or select rotation.
- Parallel maintenance writers, online rotation while ordinary interfaces are
  live, manifest key-identity changes, or a general key-management CLI.

## Required behavior and interfaces

- Both target and request UUID are required for a new rotation; only a valid
  existing journal may authorize argument-free resume.
- The application remains setup-only and the credential socket remains absent
  until verified commit and privilege drop.
- The old root remains available throughout staging, activation, rewrap, zero-
  reference proof, and commit.
- Conditional rewraps are restart-safe and cannot rewrite records already moved
  or records referencing an unexpected version.
- Reusing a completed request UUID never rotates again. Conflicting target,
  malformed UUID, concurrency, missing/staged keys, corrupt journal, failed
  rewrap, nonzero old-root inventory, or commit failure enters bounded
  configuration error.
- Rotation changes a physical root version and configured fingerprint, never the
  fixed logical registry.

## Security, authorization, invalidation, and audit

- Rotation authority exists only in the host-local pre-listener startup
  boundary and is unavailable to every remote product interface.
- One maintenance entrypoint has exclusive, operation-scoped write authority to
  the selected root location and affected store; unrelated stores and keys
  remain inaccessible.
- Journal and receipt data are non-secret, canonical, integrity-protected by
  setup-state ownership, and retained for installation lifetime.
- No raw roots, data-encryption keys, ciphertext contents, credentials, tokens,
  or protected records appear in logs, statuses, errors, journals, receipts, or
  audits.
- Maintenance authority is removed before the credential listener and ordinary
  application initialization become available.

## Required tests and validation

- Positive tests cover both targets, new requests, completed-request replay,
  journal-only restart resume, and successful return to operational state.
- Interruption tests stop after every journal, key, activation, rewrap,
  inventory, manifest, and receipt transition and prove deterministic resume.
- Negative tests cover missing arguments, unsupported targets, non-canonical or
  conflicting UUIDs, concurrent requests, remote attempts, mismatched manifest/
  keys/aggregate, missing old or staged root, journal corruption, failed
  conditional mutation, nonzero old-root references, and commit failure.
- Persistence/process tests prove exclusive ownership, conditional mutation,
  old-root retention until commit, atomic manifest/receipt update, and
  irreversible privilege loss.
- Secret scans cover logs, status, journal, receipt, errors, backups, and test
  artifacts.
- Focused rotation tests, production build, full suite, OpenAPI conformance, and
  container process tests pass.

## Acceptance criteria

- [ ] Identity and vault root rotations each complete through one journaled,
      idempotent, host-local maintenance transition.
- [ ] Every interruption resumes the same operation without mixed operational
      state or premature old-root retirement.
- [ ] Completed UUID replay is a no-change result and every invalid/conflicting
      state fails closed before ordinary interfaces open.
- [ ] No remote interface can initiate, select, or authorize rotation.
- [ ] The logical key registry remains unchanged and runtime authority is
      reduced before readiness.
- [ ] Required process, build, full-suite, OpenAPI, and secret-scan gates pass.

## Planning handoff

Resolve journal schema and checksums, versioned root naming, exclusive writer
enforcement, identity and vault store-adapter transactions, rewrap batching,
zero-reference inventory, atomic manifest/receipt commit, crash injection, and
operator recovery evidence. Likely slices are: journal and host-startup state
machine; identity-root store adapter; then vault-root adapter plus complete
interruption and operations qualification.
