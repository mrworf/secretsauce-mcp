# Milestone 02 Acceptance: Fail-Closed Key Provisioning

Date: 2026-07-27

## Decision

Accepted. Implementation commit `7ead067` completes the milestone contract.
The vault entrypoint is the sole generator and setup-state writer for the fixed
eleven-key v2.1 registry. It exposes status before provisioning, commits a
canonical checksum-protected manifest, releases setup authority, independently
revalidates assigned runtime keys, and only then opens credentials.

## Contract evidence

- Fresh, interrupted, adopted, retained, partial, malformed, missing,
  mismatched, future, and indeterminate states are covered by the registry,
  manifest, provisioning, retry, configuration, and process suites.
- Key creation is no-replace and adapter-owned. Symmetric keys use canonical
  32-byte base64url encoding; the OAuth signing key is canonical RSA-2048
  PKCS#8. Fingerprints and the aggregate are domain-separated digests and never
  contain raw key material.
- The setup manifest exists before the first key write and is replaced through
  write, file sync, rename, and directory sync. Retained-state inventory uses a
  bounded existence read and treats inspection failure as indeterminate.
- The status-only server rejects methods, queries, and bodies outside exact
  `GET /v1/status`. Fatal continuity failures retain no credential listener.
  A failed privilege release closes both endpoints.
- A disposable mapped-root user namespace executed the compiled production
  drop from UID/GID 0 to UID/GID 1001 with supplementary GID 1002. The runtime
  check also proved that UID 0 could not be regained.
- Vault and application consumers validate assigned key ownership, mode,
  format, and configured manifest fingerprint before key-dependent behavior.
  Post-drop tampering remains status-only.
- The Compose contract gives the vault no network, starts its entrypoint as
  root, persists generated keys and setup state, drops the vault to UID/GID
  1001, and gives the UID/GID 1000 application only read-only volumes plus the
  shared group.

## Validation evidence

- Focused lifecycle, protocol, deployment, migration, and vault suite:
  48 tests passed.
- Full server/web suite with four file workers: 153 files and 996 tests passed.
- `npm run build`: passed as part of the full-suite pretest and later gates.
- `npm run check:control-openapi`: current.
- `node scripts/validate-v2.1-readiness.mjs`: 14 artifacts validated.
- `npm run scan:release-artifacts`: 615 closed-scope files passed.
- `git diff --check`: passed before the implementation commit.

## Deviations and residual ownership

- Two unconstrained-worker full-suite runs completed 994 of 996 tests but
  oversubscribed this host and timed out unrelated Argon2-heavy authentication
  tests at their unchanged five-second limit. Both tests passed in isolation;
  the entire unchanged suite and all original timeouts passed with four file
  workers.
- Docker is unavailable on this host, so container smoke was not repeated.
  Compose/Dockerfile contract tests passed. Official integrated Compose
  qualification remains assigned to Milestone 10.
- Public application setup-only projection, concurrent browser setup gating,
  and database initialization remain Milestone 03. Envelope-root rotation
  remains Milestone 04.
