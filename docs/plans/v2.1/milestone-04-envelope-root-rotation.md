# Milestone 04: Envelope-Root Rotation

## Outcome

The host-local vault startup boundary can rotate exactly the configured
identity or vault envelope root under a fresh canonical request UUID. Rotation
stays setup-only, durably resumes every interrupted phase, conditionally
rewraps only the selected store, commits one checksum-protected receipt with
the updated manifest, and never exposes maintenance authority remotely.

## Governing contracts

- PRD `SETUP-027`–`SETUP-028` and Acceptance 21.1.28–30.
- Milestone
  [`04-envelope-root-rotation.md`](../../milestones/v2.1/04-envelope-root-rotation.md).
- Architecture ADR-2.1-08 plus
  [`provisioning.md`](../../architecture/v2.1/provisioning.md),
  [`data-model.md`](../../architecture/v2.1/data-model.md), and
  [`validation-matrix.md`](../../architecture/v2.1/validation-matrix.md).
- Milestones 01–03 private status, fixed manifest, setup-authority, and
  browser-first gating contracts.

## Current-state findings

- The provisioning manifest is canonical, checksum-protected, atomically
  replaced, and bound to an installation UUID, but it has no rotation journal,
  completed-request receipts, or physical-root version metadata.
- Runtime configuration deliberately uses stable logical root IDs and stable
  configured key paths. Rotation must preserve those logical identities and
  paths while staging and retaining separately named physical versions.
- `VaultRecordStore` already authenticates a per-record wrapped DEK and commits
  record replacement through file sync, rename, and directory sync, but has no
  expected-old-physical-version rewrap or root-reference inventory surface.
- Identity TOTP envelopes already support decrypt-and-rewrap with generation
  advancement. The maintenance adapter must additionally own the SQLite writer
  lock, cover every identity-root envelope table, and compare the exact stored
  envelope/root/generation before mutation.
- The production vault entrypoint parses no maintenance arguments. It always
  provisions before privilege drop and credential-listener startup, which is
  the correct host-only composition boundary to extend.

## Decisions

- Keep the eleven logical manifest identities unchanged. A root entry gains an
  optional active physical version after its first rotation; legacy configured
  manifests remain valid until rotation commits.
- Stage a canonical symmetric root beside the configured root with a filename
  derived only from the canonical request UUID. Retain the prior physical root
  under a bounded archived name through completed commit. Never overwrite or
  delete it during this milestone.
- Store one `rotation-journal.json` in setup state. Its canonical,
  checksum-protected closed schema binds installation, request, target,
  starting aggregate, logical key ID, configured path, old/new physical
  versions, phase, cursor, and bounded counts. Replacement uses the manifest's
  write–sync–rename–directory-sync pattern.
- Store bounded lifetime completed receipts in the manifest so the receipt,
  active physical version, root fingerprint, and aggregate share one atomic
  checksum-protected commit. A receipt UUID cannot be reused for another
  target.
- Resume is journal-authorized. Arguments may match a live journal or be
  absent; any other argument/journal combination fails closed. A completed
  receipt plus matching arguments is a no-change success.
- Each `RootRewrapAdapter` has preflight, inventory, stage/activate,
  conditional batch rewrap, verify-zero, and close methods. It receives root
  bytes in memory and never emits them.
- The vault adapter rewrites only authenticated record DEK wrapping while
  preserving ciphertext, binding, locator, generation, timestamps, size class,
  and last-four metadata. Atomic per-record replacement compares an exact
  source digest before rename.
- The identity adapter holds the existing application writer lock plus an
  exclusive SQLite transaction for each bounded batch. It covers confirmed and
  pending TOTP envelopes and other identity-root envelopes discovered in the
  schema; conditional updates compare the complete current representation.
- Crash injection is an internal test seam only. Status and logs expose phase
  classes and counts, never paths, identifiers, roots, DEKs, ciphertext, or
  stored envelopes.

## Slice plan

### Slice 1: Journal, receipt, physical-root, and CLI state machine

**Contract:** accept only exact host arguments or a valid resumable journal,
stage a non-replacing physical root, and durably advance one operation without
opening credentials.

**Included:** canonical UUID/target parser, closed journal and receipt schemas,
checksums and atomic I/O, manifest rotation metadata, stable physical naming,
completed replay/conflict handling, phase transition invariants, corruption
and interruption tests.

**Excluded:** retained-store mutation and production startup integration.

**Evidence:** positive identity/vault request parsing and journal resume;
negative missing/partial/unknown/noncanonical/conflicting/concurrent inputs;
no-replace staging; old-root retention; canonical corruption rejection.

### Slice 2: Vault-record conditional root adapter

**Contract:** resumably move authenticated vault-record DEK wrapping from the
expected old physical root to the staged root without changing protected record
semantics.

**Included:** closed inventory, bounded cursor batches, exact-source
conditional replacement, zero-reference verification, interruption at every
record boundary, mixed/unexpected-root rejection, old/new read evidence.

**Excluded:** identity SQLite state and entrypoint orchestration.

**Evidence:** empty and populated stores, already-rewrapped replay, concurrent
source change, tamper, missing key, failed sync/rename, nonzero inventory, and
post-retirement new-root-only reads.

### Slice 3: Identity-store conditional root adapter

**Contract:** acquire exclusive application-writer authority and conditionally
rewrap every identity-root envelope under the staged physical root.

**Included:** closed schema/table allowlist, confirmed and pending TOTP plus
other identity-root envelope inventory, bounded transactions, exact stored
representation compare, generation advancement, zero-reference verification,
writer-lock exclusion.

**Excluded:** remote controls and unrelated application keys.

**Evidence:** each allowed table, empty/mixed/already-moved states, application
writer conflict, stale-row race, corrupt envelope, transaction failure,
restart, and successful new-root-only decryption.

### Slice 4: Production maintenance composition and qualification

**Contract:** run either adapter through every journal phase before privilege
drop and credential readiness, then resume or return an idempotent result on
later starts.

**Included:** vault main argument parsing, configured-state preflight,
adapter selection, activation/rewrap/inventory/manifest-receipt commit,
argument-free resume, bounded diagnostics, operator documentation, real
process and privilege-drop tests.

**Evidence:** both targets, completed replay, every phase interruption,
credential-socket absence until commit/drop, malformed/concurrent/corrupt and
commit failures, unchanged registry, production build, full suite, OpenAPI,
readiness, and release scan.

## Cross-slice constraints

- No HTTP, browser, control, OAuth, MCP, database setting, or remote CLI route
  can initiate or select rotation.
- The old root remains available until the manifest/receipt commit verifies
  zero old-root references. No failure path regenerates, retires, or logs it.
- Journal, receipt, status, logs, errors, tests, docs, and release artifacts
  contain no raw root, DEK, ciphertext, credential, token, or protected
  envelope.
- New arguments, journal fields, manifest fields, filenames, cursors, store
  rows, and phase transitions receive positive and negative tests.
- Each completed slice is independently testable and receives one concise
  commit. The full suite runs at milestone closure.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | this commit | 10/10 focused manifest/rotation tests; server build; exact canonical host grammar; checksum-protected mode-0600 journal with atomic create/replace and crash preservation; journal-only resume; post-commit crash replay; non-replacing physical-key staging; atomic physical-version/fingerprint/aggregate/receipt commit | Root activation and archived-root switching remain in Slice 4 so no partial production maintenance path is exposed. |
| 2 | pending | | | |
| 3 | pending | | | |
| 4 | pending | | | |
