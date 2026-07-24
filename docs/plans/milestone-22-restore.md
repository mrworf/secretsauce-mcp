# Milestone 22 Restore Plan

## Outcome and trust boundary

Milestone 22 adds an interactive-superadmin-only, previewed replacement of the
portable configuration domains produced by Milestone 21. Restore preserves the
target instance's identities, authenticators, provider links, security/system
settings, and deployment configuration. It replaces services/destinations,
credential definitions, and policy/rule definitions; removes every group and
principal/service/credential/rule binding; disables and unassigns every restored
rule; revokes all API keys, browser sessions, OAuth grants/tokens, and runtime
references; and creates durable remediation tasks before any restored service
can return to MCP.

Archive bytes and passphrases are accepted only from browser request bodies.
API keys cannot stage, preview, inspect, or commit restore. Validation and
preview never mutate live configuration or the vault. Commit uses an exclusive
maintenance gate, an encrypted local recovery snapshot, one database
replacement transaction, exact vault replacement, a post-commit health gate,
and automatic rollback on any failure after vault mutation.

## Intake, parsing, and staging

Add a complete restore deployment set:

- `SECRETSAUCE_RESTORE_DIRECTORY`: absolute private directory, owned by the
  process, mode `0700`, no links;
- `SECRETSAUCE_RESTORE_RECOVERY_KEY_FILE`: stable canonical 32-byte base64url
  key, regular mode-`0400` file with safe ownership.

Both or neither must be configured. Restore routes return a generic unavailable
response when absent; ordinary service and backup behavior remains available.
The directory is single-process writable and holds no plaintext credential
values.

`POST /api/v2/restores/stages` is browser-session-only, superadmin-only, CSRF
protected, and accepts `application/gzip` through an explicit bounded binary
request contract. Fastify limits the body to 256 MiB before allocation growth.
After authorization the handler writes one mode-`0600` file through exclusive
create, fsync, and atomic rename while computing SHA-256. Stages use random
UUIDv7 IDs, expire after one hour, are bound to the initiating superadmin, and
are capped at one active upload per actor, four globally, and 512 MiB total
staged bytes. Cleanup never follows links and deletes only database-referenced
stage basenames.

The existing strict ustar parser remains the only outer archive decoder. A new
restore decoder requires exact entry order/names/modes and manifest
schema/type/product compatibility, verifies every declared byte length and
SHA-256, and then parses YAML with aliases disabled, the core schema only, known
tags only, bounded scalar count/length, maximum nesting depth 32, and the
Milestone 21 byte/object limits. Strict schemas reject unknown fields, duplicate
UUIDs/slugs/names, unsafe URLs/hosts/paths, noncanonical arrays, unsupported
versions, and bad service/destination/credential/policy/rule cross-references.
No object is constructed from `secrets.enc`.

## Durable preview and exact plan binding

Migration 0022 adds:

- `restore_stages`: actor, archive UUID/type/schema, safe filename, size/hash,
  expiry, state, and sanitized failure/result fields;
- `restore_previews`: one-hour UUID, stage/hash binding, secret disposition,
  canonical plan digest, counts, exclusions/revocations, confirmation phrase,
  and consumed/outcome fields;
- `restore_remediations`: service/optional credential/policy target, fixed task
  kind, open/completed/dismissed state, version, and audit-safe timestamps;
- singleton `restore_state`: inactive/maintenance/recovery/health-gate phase,
  operation UUID, version, and timestamps, but no local path or key material.

`POST /api/v2/restores/{stage_id}/preview` accepts an optional passphrase in a
strict JSON body. The archive is re-read and rehashed. For encrypted archives,
the broker's backup caller gains a validation-only operation that authenticates
and fully bounds/decrypts the payload without publishing records or plaintext.
A missing or uniformly invalid passphrase produces a valid `configuration_only`
plan and marks every secret-bearing credential unavailable. A valid passphrase
produces `encrypted_secrets` and records only selected credential UUIDs/counts.
Passphrase buffers are zeroed after the attempt.

The preview compares the validated portable objects with current portable
objects and reports creates/replacements/removals, preserved target domains,
cleared groups/bindings, disabled rules, missing/unavailable secrets, revoked
sessions/grants/API keys/references, and remediation counts. It verifies at
least one active target superadmin. A domain-separated SHA-256 digest binds the
stage checksum, validated canonical documents, secret disposition and exact
secret credential IDs, preview counts, actor, and expiry. Preview rows store the
digest and safe summary, never archive documents, passphrases, ciphertext, or
paths.

## Maintenance, recovery, and crash resumption

A shared `RestoreMaintenanceGate` provides ordinary request leases and one
exclusive restore lease. Control/data-plane requests obtain a lease after
authentication and before domain work; restore status/preview/commit handlers
are the only explicit exemptions. Entering maintenance rejects new ordinary
requests, waits a bounded 30 seconds for in-flight work to drain, marks durable
maintenance state, and prevents maintenance jobs from starting. Failure to
drain aborts before snapshot or mutation.

Before mutation, `RestoreRecoveryManager`:

1. verifies the stable recovery key and private directory;
2. rejects another unexpired recovery archive and checks free space plus the
   2 GiB inclusive bound;
3. creates a SQLite online backup;
4. asks the backup-only broker for a full encrypted vault recovery export;
5. generates a fresh 32-byte recovery DEK, encrypts the SQLite backup with
   chunked AES-256-GCM, uses the same DEK as the vault-export passphrase, wraps
   the DEK with the stable recovery key and operation-bound associated data;
6. writes mode-`0600` encrypted artifacts and one small fsynced journal through
   temp files and atomic rename, then removes the plaintext SQLite copy and
   zeroes the DEK.

Only one recovery set exists, expires after 24 hours, and is deleted after the
post-restore health gate. Journal phases are `snapshot_ready`, `vault_applied`,
`database_committed`, `health_passed`, and `rolled_back`. Startup examines the
journal before listeners: pre-mutation snapshots are safely discarded;
post-mutation phases restore the vault, atomically restore/reopen SQLite, verify
both, mark rollback, and then permit startup. Unknown, malformed, expired,
oversized, or unauthenticated journals fail readiness without destructive work.

## Vault replacement and database transaction

Backup capabilities add restore-plan UUID, actor UUID, archive SHA-256, plan
digest, operation, and five-minute expiry. They remain canonical, one-use, and
are issued only after exact human step-up is consumed. The broker adds:

- validation-only encrypted payload authentication;
- full recovery export/import, usable only by the recovery operation;
- exact restore replacement from `secrets.enc`;
- exact empty replacement for configuration-only restore.

Restore replacement requires the credential UUID/locator/generation set from
the plan and rejects missing, extra, duplicate, stale, or differently bound
records. Configuration-only replacement clears the active vault store. Neither
operation exposes a record value or metadata beyond safe counts.

After the vault replacement succeeds, one exclusive SQLite transaction:

- re-verifies preview/stage/actor/expiry/digest, active-superadmin count, and
  singleton restore state;
- deletes all portable service domains (cascading groups, service admins,
  selectors, drafts/publications, and related invalidation state);
- inserts validated services/destinations/credential definitions/policies/rules
  with source UUIDs, all rules disabled, no assignment rows, no publication
  snapshots, and credentials configured only when the exact secret was imported;
- normalizes every restored service to `draft`, so no restored service is
  discoverable or callable;
- revokes every API key, browser session, OAuth grant/token/family, increments
  global security and runtime generations, clears active runtime snapshots and
  invalidates all gateway/response references;
- creates fixed remediation tasks for service administration/access,
  credential values, policy assignment/enabling, validation/publication, and
  optional archive-passphrase loss;
- consumes the preview, marks the stage committed, advances restore state, and
  inserts one sanitized administrative success audit atomically.

If the transaction fails, the live database rolls back and the coordinator
restores the vault recovery snapshot. If the transaction commits but the
database/schema/vault/identity/audit health gate fails, both database and vault
are restored from recovery. Only a successful health gate deletes recovery
artifacts and exits maintenance. All failure audits contain stable phase/code,
archive UUID/hash, counts, and actor/operation IDs, never bodies, passphrases,
vault identifiers, ciphertext, keys, or local paths.

## Control API and browser workflow

Add capability `restore` only for human superadmins with exact step-up; every
API-key role and other human role denies. Add browser-only no-store routes:

- `POST /api/v2/restores/stages` — bounded gzip intake;
- `POST /api/v2/restores/{stage_id}/preview` — optional body passphrase;
- `GET /api/v2/restores/{stage_id}` — actor-bound stage/preview/result status;
- `POST /api/v2/restores/{stage_id}/commit` — exact preview, current archive
  SHA-256, 10–1,024 character justification, optional passphrase matching the
  preview disposition, exact `RESTORE <archive UUID>` confirmation, CSRF, and
  `always` operation-bound step-up.

Commit rehashes and revalidates the staged archive and recomputes the canonical
plan before consuming the preview or entering maintenance. Any mismatch fails
before vault or database mutation. Successful commit revokes the initiating
session with all other sessions, so the response directs the browser to sign in
again.

The Backup and restore workspace becomes a five-step upload, validate, preview,
confirm, result flow. It renders only server-derived state, shows replaces/
preserves/clears/revokes/remediates separately, makes missing-secret fallback
explicit, and requires a typed archive-specific phrase. Upload/passphrase/
password/TOTP inputs clear after every attempt; non-secret stage/preview/
justification state survives recoverable failures. Navigation can resume an
actor-owned unexpired stage by its opaque ID, but archive bytes and secrets are
never stored in browser persistence. Responsive and accessibility tests cover
keyboard/focus, progress/status announcements, error recovery, and post-success
logout.

## Minimal delivery slices

1. Migration 0022, strict stage/preview/remediation/state repositories,
   expiry/claim/digest invariants, positive/negative schema fixtures.
2. Strict bounded restore archive/YAML decoder and canonical cross-reference
   plan builder, including malformed/bomb/complexity/checksum fixtures.
3. Private bounded stage store, binary request-body route contract, upload and
   actor-bound status/cleanup APIs, filesystem/link/size/concurrency tests.
4. Validation-only and exact restore/recovery vault protocol/capabilities,
   empty replacement, passphrase/selection/tamper tests, and real broker process.
5. Preview coordinator and API with active-superadmin guard, exact plan digest,
   missing/wrong/correct passphrase behavior, comparison/count fixtures.
6. Exclusive maintenance gate across control/data/jobs with bounded drain,
   exemptions, concurrency, and fail-before-work tests.
7. Encrypted SQLite/vault recovery manager, 2 GiB/24-hour/single-snapshot
   bounds, fsynced journal, fault injection, startup resumption and rollback.
8. Atomic portable-domain replacement, revocations/generation invalidation,
   draft/unassigned/disabled semantics, persistent remediation tasks, and
   before/after database assertions.
9. Commit coordinator and strict exact-step-up route with vault-first rollback,
   health gate, sanitized audit, mismatch/failure injection, and logout tests.
10. Responsive resumable restore workspace with secure input clearing,
    server-derived preview/result, high-friction confirmation, and accessibility
    tests.
11. Operator/recovery/archive documentation, deployment mounts, production
    builds, OpenAPI currency, full acceptance review, and milestone status.

Each completed slice receives positive and negative unit tests, the full
regression suite, and one concise commit. Durable findings are added to
`AGENTS.md`.

## Acceptance matrix

- Intake/validation: exact supported archive passes; traversal/link/device/
  extension/duplicate/truncated/bomb, oversized body/file/object/scalar/depth,
  unknown schema/field, checksum, UUID and cross-reference failures leave live
  state unchanged.
- Preview binding: correct creates/replacements/removals/preserved/cleared/
  revoked/remediation counts, active-superadmin guard, actor/expiry/hash/digest
  isolation, and preview/commit mismatch rejection.
- Secrets: correct passphrase validates/imports exactly selected records; wrong
  or missing passphrase yields deliberate configuration-only restore; tampering,
  stale/extra records, unavailable vault, and interrupted import expose no
  partial artifact or value.
- Replacement: only portable domains change; identities/authenticators/settings/
  deployment/audit survive; groups/bindings disappear; rules are disabled and
  unassigned; credentials without exact secrets are unconfigured; services are
  drafts and unavailable.
- Revocation/remediation: all API keys/sessions/OAuth grants and runtime
  references fail immediately; global/runtime generations advance; exact durable
  tasks identify required administration, credentials, policies, and publication.
- Recovery: maintenance drains/rejects concurrency, snapshot bounds/free-space/
  key/journal authentication fail closed, every injected phase rolls back both
  stores, startup resumes deterministically, and successful health gate removes
  the recovery set.
- Delivery/UX/audit: browser superadmin plus exact step-up only, direct bounded
  upload, no API-key route, typed confirmation/justification, secrets cleared,
  resumable safe state, post-success logout, and no archive/passphrase/plaintext/
  ciphertext/path/key material in logs, audit, errors, OpenAPI examples, or
  persistent state.
