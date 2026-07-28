# Milestone 02: Fail-Closed Key Provisioning

## Purpose and why

Deliver the vault-owned, no-replacement key lifecycle that can distinguish a
true fresh installation from retained, adopted, interrupted, or inconsistent
state. Browser-first startup cannot be safe until one privileged coordinator
can converge the fixed v2.1 key registry and prove configured continuity without
inventing recovery keys.

## Dependencies

- `00` — Consumes approved manifest, adapter, inventory, transaction,
  privilege-drop, and failure-injection contracts.
- `01` — Consumes the bounded private status resource, authenticated credential
  listener, boot handshake, and hardened Unix-socket boundary.

## PRD traceability

- `SETUP-001`–`SETUP-007`, `SETUP-009`, `SETUP-013`,
  `SETUP-015`–`SETUP-024`, and `SETUP-026` — registry, manifest, adoption,
  inventory, status, authority, validation, and privilege transitions.
- Sections 8.1–8.3, 10.1, 11.1, 12.1, 14.1, 15, 18.2–18.3, 20, 21.1, 22, 23,
  and 25 — lifecycle, failures, privacy, storage matrix, limits, acceptance,
  validation, and documentation.
- Section 24 question 2 — bounded retry scheduler.

## Scope

- Define the exhaustive fixed v2.1 logical key registry and closed key-type and
  retained-store adapter registries.
- Make the vault entrypoint the sole setup-state writer and sole generator for
  all SecretSauce-owned application keys.
- Persist the installation identifier, complete progressive manifest,
  adapter-computed domain-separated fingerprints, configured aggregate
  commitment, retry state, and bounded status in the dedicated setup-state
  volume.
- Implement full preflight and the authoritative no-manifest/key/inventory/
  adoption matrix before any key or manifest write.
- Create the complete `provisioning` manifest before the first no-replace atomic
  key creation; validate/reuse valid pending keys and generate only absent
  pending keys.
- Support complete current-layout pre-manifest adoption only through the exact
  host-local setting and complete adapter-owned compatibility validation.
- Use bounded retry/backoff only for eligible fresh pending-key failures and
  enter status-only `configuration_error` for every fatal continuity or
  validation mismatch.
- Validate configured fingerprints and aggregate commitment, distribute only
  assigned read-only keys, drop setup privileges irreversibly, and only then
  open the credential listener.
- Keep feature enablement independent of registry membership and reject unknown
  future identities as unsupported upgrades.

## Not in scope

- Public/browser setup UX, application database initialization, control/OAuth/
  MCP gating, first-user enrollment, or official Compose release qualification.
- Configured envelope-root rotation, manifest clearing, factory reset,
  regenerate-all, or remotely triggered provisioning/adoption.
- TLS keys, OIDC client secrets, database credentials, downstream credentials,
  backup passphrases, or any identity outside the fixed v2.1 registry.
- A general adapter plugin system.

## Required behavior and interfaces

- Fresh provisioning occurs only when no manifest or required key exists and
  every recognized retained-state inventory is definitively absent or empty.
- The complete manifest precedes the first key write; each entry advances from
  `pending` to `verified` atomically and configured commit records the canonical
  aggregate only after all entries validate.
- Existing valid pending keys are fingerprinted and reused. Partial key sets,
  malformed pending keys, missing/mismatched verified keys, configured
  mismatches, retained/indeterminate state, and invalid adoption fail closed
  without prohibited key or manifest writes.
- The fixed registry is identical for all optional-feature combinations.
  Disabled-feature consumers do not load unused keys.
- `configuration_error` retains only the status listener. Retryable fresh
  failures remain live with bounded retry status. Neither state exposes the
  credential listener prematurely.
- Runtime consumers independently validate assigned key format and manifest
  fingerprint before key-dependent behavior.

## Security, authorization, invalidation, and audit

- Setup/adoption inputs are host-local and unavailable to browser, control,
  OAuth, MCP, or remote CLI callers.
- Complete validation and retained-state classification precede writes; an
  unavailable or indeterminate inventory is never treated as empty.
- Key creation is atomic without replacement, directories and files use
  restrictive ownership/modes, and no second component has generation authority.
- Fatal setup drops write authority before serving status-only error. Runtime
  vault authority cannot regain setup access after the credential listener
  opens.
- Manifests, statuses, diagnostics, logs, and audits contain no raw or
  reversible key material, credentials, tokens, or protected store contents.

## Required tests and validation

- Unit tests cover registry exhaustiveness, adapter ownership, fingerprints,
  aggregate commitment, manifest transitions, status bounds, and retry limits.
- Matrix/process tests cover no-manifest none/some/all keys, every retained-state
  classification, valid/invalid adoption, each per-key interruption, restart,
  malformed pending keys, verified/configured mismatches, unsupported future
  identities, and every optional-feature combination.
- Negative tests prove no write before complete preflight, no replacement or
  duplicate generator, no remote setup trigger, no credential listener before
  privilege drop, and no secret-bearing diagnostics.
- Storage tests cover restrictive modes, no-replace atomic creation, atomic
  replacement for setup state, sync behavior, and observable installation
  continuity.
- Process tests prove privilege loss is irreversible and configured startup
  validates rather than regenerates.
- Focused provisioning/vault tests, production build, full suite, OpenAPI
  conformance, and secret-artifact scan pass.

## Acceptance criteria

- [x] A true fresh start converges to the exact fixed v2.1 configured manifest
      after any permitted interruption without rotating a valid key.
- [x] Every retained, partial, malformed, missing, mismatched, indeterminate, or
      unsupported state follows the PRD matrix without prohibited writes.
- [x] Complete explicit adoption validates all keys and present stores without
      modifying keys; every invalid adoption fails closed.
- [x] Setup authority is singular and absent after configured transition or
      fatal error.
- [x] The credential listener exists only after configured commit and proven
      privilege drop.
- [x] Required process, build, full-suite, OpenAPI, and secret-scan gates pass.

## Planning handoff

Resolve manifest serialization/versioning, filesystem atomicity and sync
primitives, closed registry construction, store inventory adapters, retry
scheduler, status categories, privilege-transition mechanism, and crash
fixtures. Likely slices are: registries and durable manifest state; full
preflight/adoption/retry lifecycle; then privilege transition, runtime
validation, and process/deployment evidence.
