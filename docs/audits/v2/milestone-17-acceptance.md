# Milestone 17 Self-API-Key Protection Acceptance Review

## Outcome

Accepted. Active SecretSauce management API keys are rejected by ordinary
credential writes before vault I/O. The sole supported exception is a
browser-only superadmin operation with an exact fixed acknowledgement,
justification, exact-operation password/TOTP step-up, idempotency, optimistic
concurrency, and a durable approval bound to one credential generation and API
key UUID.

Self-targeting runtime requests retain the complete ordinary authorization
pipeline. Raw active keys are denied before vault or downstream work. A
referenced active key is substituted only after its exact approval and current
active/nonexpired state are revalidated. YAML authority cannot approve
recursive use and fails closed for recognizable candidates when verification
is unavailable.

## Accepted controls

- Migration 0017 adds all-or-none pending approval intent fields and a
  constrained approval table with service, credential, vault generation,
  API-key UUID, approver UUID, safe snapshots, time, and justification digest.
- A bounded structural scanner visits string leaves only, enforces canonical
  token boundaries, caps candidates/depth/nodes, ignores object keys and
  binary values, and never transforms candidate material.
- Active-candidate verification reuses the bounded Argon2id worker pool,
  dummy-verifier path, live repository recheck, per-principal/direct-source
  limits, and a shared runtime-global source limit.
- General create/replace paths reject active keys before the vault call.
  Dedicated approval rechecks active state around vault finalization,
  compensates failed writes where possible, and never exposes raw values.
- Approval is invalidated by ordinary replacement/deletion, generation
  changes, key rotation/revocation/expiry, credential archive, or deletion.
  UUID identity makes nickname changes and last-four collisions
  non-authoritative.
- `PUT .../{credential_id}/self-api-key` is browser-session only,
  superadmin-only, `stepUp: always`, no-store, `If-Match`, idempotent, strict,
  and redacts `/value`. API-key authentication is hard denied.
- Canonical self origins come only from configured control, MCP resource, and
  built-in issuer origins. Exact URL origins prevent near-match hosts, aliases,
  paths, and default-port spellings from widening trust.
- Raw header, query, and body active keys are blocked before reference
  consumption, vault resolution, or downstream I/O. Credential values are
  inspected before substitution and require a fresh exact approval/live-key
  read.
- Runtime warnings and audit events contain only safe UUIDs, canonical
  routing fields, location categories, and safe nickname/last-four snapshots.
  They exclude candidates, enclosing request values, vault secrets,
  Authorization data, proofs, verifiers, and downstream bodies.
- The responsive UI hides recursive approval from admins, explains the risk,
  enforces the exact acknowledgement, performs bound step-up, clears all
  submitted secret/authenticator fields, and displays safe approval metadata.
- The documented boundary explicitly excludes encoded, fragmented,
  encrypted, transformed, and binary representations and does not claim
  universal non-exfiltration.

## Verification

- Focused positive, negative, boundary, live-state, generation, revocation,
  YAML fail-closed, zero-downstream, route, exact-step-up, browser-role, and
  raw-value non-retention tests pass.
- Production server and web builds pass.
- The generated control OpenAPI artifact is current.
- Full regression with listener/socket permission and bounded concurrency:
  **97 test files, 742 tests passed** before the final documentation check.

## Implementation commits

- `ebeb081` — decision-complete milestone plan
- `a9df1f5` — scanner, bounded verifier, migration, and repository primitives
- `121b0da` — guarded writes and generation-bound approval coordinator
- `8c565e3` — browser-only exact-step-up approval route
- `2b61cab` — persisted/YAML runtime enforcement and safe audit events
- `f3f793e` — responsive superadmin approval workspace
- `9c324e9` — shared runtime-global verification limit

## Deferred boundary

Security settings and automation policy are Milestone 18. Audit search and
retention management are Milestone 19. Backup/restore behavior remains
Milestones 21 and 22.
