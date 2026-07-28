# Milestone 04 Acceptance: Envelope-Root Rotation

Date: 2026-07-28

## Decision

Accepted. Implementation commits `bbfa6e4`, `d6126a7`, `d5c5c5b`, and
`d6ac0f0` complete the milestone contract. The host-local vault entrypoint now
rotates exactly the configured identity or vault envelope root through one
durable, idempotent, setup-only transition. No remote product surface can
initiate or select maintenance.

## Contract evidence

- The entrypoint accepts only the exact target/request argument grammar with a
  canonical UUID. A checksum-protected mode-0600 journal binds installation,
  request, target, starting aggregate, logical key, old/new physical versions,
  fingerprints, phase, cursor, and bounded counts. Conflicting, malformed,
  corrupt, and ambiguous states fail closed.
- A new symmetric root is created without replacement beside the stable
  configured path. The old configured root remains available throughout
  rewrap. The final physical switch uses recoverable no-replace links and
  survives every link/unlink boundary; the old physical root remains retained
  under its versioned retired name.
- The manifest keeps all eleven logical identities unchanged. One atomic,
  checksum-protected replacement updates the selected fingerprint, physical
  version, aggregate, and lifetime request receipt. Exact completed replay is
  no-change, including recovery from a crash between manifest commit and
  journal removal.
- Vault records are cryptographically classified under the expected old or new
  physical root. Bounded cursor batches replace only authenticated DEK wrapping
  after an exact-source comparison. Header, locator, binding, generation,
  timestamps, size class, last-four metadata, value nonce, and value ciphertext
  remain unchanged. Already-moved records replay safely.
- Identity maintenance acquires the production application-writer lock and
  recognizes only the exact confirmed-TOTP, pending-TOTP, and OIDC-flow
  schemas. Complete-row conditional mutations run in bounded SQLite
  transactions. TOTP generations and applicable row versions advance, and a
  failed multi-row batch rolls back completely.
- Startup detects and resumes a valid journal before ordinary provisioning,
  privilege drop, or credential readiness. The credential socket remains
  absent through preflight, staging, activation, rewrap, zero-reference proof,
  root switch, and manifest commit. Malformed maintenance remains live only on
  the bounded status socket in `configuration_error`.
- `setup.identity_rotation` binds the stable identity logical key ID to one
  exact database file beneath the retained database inventory. Ordinary
  Compose keeps that inventory read-only; the runbook permits a temporary
  read-write replacement of only that mount during explicit identity
  maintenance.
- Journals, receipts, statuses, errors, logs, documentation, and tests contain
  no raw root, DEK, credential, protected envelope, ciphertext body, token, or
  opaque authorization value.

## Validation evidence

- Focused root state, manifest, vault adapter, identity adapter, and coordinator
  suite: 28 tests passed.
- Vault process/lifecycle suite: 9 tests passed, including credential-socket
  absence until commit and privilege drop.
- Full server/web suite with four file workers: 162 files and 1044 tests
  passed.
- `npm run build`: passed.
- `npm run check:control-openapi`: current.
- `node scripts/validate-v2.1-readiness.mjs`: 14 artifacts validated.
- Final staged `npm run scan:release-artifacts`: 635 closed-scope files passed.
- `git diff --check`: passed.

## Deviations and residual ownership

- Docker is unavailable on this host. Static Compose contracts, the documented
  temporary identity-database mount override, and real local process,
  application-writer-lock, Unix-socket, privilege-ordering, restart, and
  continuity tests passed. A clean Compose identity/vault rotation and
  container recreation remain explicit Milestone 10 release evidence.
- Retired physical roots are intentionally retained. Automated destruction or
  retention policy is outside this milestone; operators are instructed not to
  remove them without a later reviewed policy.
