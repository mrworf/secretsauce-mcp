# Milestone 03 Implementation Plan: Vault Broker

## Scope review

Milestone 03 establishes the downstream-credential isolation boundary only. It
does not add credential database rows, management routes, runtime authorization,
backup archives, restore orchestration, or key-rotation UX. The v2 PRD and
approved ADR-001 supersede the original v1 statement that a built-in vault was a
non-goal.

The implementation is a separate Node.js executable with no TCP listener. It owns
the vault root keys and encrypted store, while data, control, and backup callers
connect over a private Unix-domain socket using independent caller keys. No
production code path may replace this boundary with a direct in-process secret
read.

## Fixed contracts and limits

The broker configuration is a closed, versioned YAML document containing only
absolute socket/store paths, an active root-key ID, root-key file mappings, caller
key files, and separately provisioned resolve/backup capability-verification key
files. All key files contain one canonical 32-byte base64url key, are regular
non-linked files with mode `0400`, and are read before the socket is created.
Store and runtime directories must be owned by the current process identity (or
root for a pre-provisioned runtime directory), must not be links, and must reject
group/world-writable ancestry. The store uses mode `0700`, record files `0600`,
and a group-shareable socket only when explicitly configured as `0660`; otherwise
the socket is `0600`.

The fixed request frame authenticates its original bytes:

```text
magic(4) | version(1) | flags(1) | caller(1) | operation(1)
total_length(4) | request_uuid(16) | timestamp_ms(8) | nonce(16)
payload_length(4) | closed UTF-8 JSON payload | HMAC-SHA-256(32)
```

The complete frame is at most 1 MiB. Unknown versions/flags/callers/operations,
length disagreement, stale timestamps, duplicate nonces, non-canonical UTF-8 or
JSON, unknown fields, and invalid MACs fail before store access. Requests have a
five-second deadline. The broker accepts at most 32 connections and eight active
cryptographic operations. Authenticated responses use the same caller key and
bind caller, operation, and request UUID.

Caller operations are fixed:

- data plane: `readiness`, `resolve_for_request`;
- control plane: `readiness`, `create`, `replace`, `delete`, `metadata`;
- backup coordinator: `readiness`, `export_encrypted`, `import_encrypted`.

The control caller has no resolve/export operation; the data caller has no
write/metadata/export operation; and the backup caller has no ordinary
read/write/resolve operation.

Secrets are canonical base64 inside authenticated request frames, limited to
1–65,536 bytes. Service, destination, subject, and credential identities are
UUIDv7; locators and capability IDs are random UUIDv4 values. Metadata contains
only configured status, generation, byte-size class, optional printable-ASCII
last-four captured by the broker, and timestamps.

Runtime resolution additionally requires a separately signed, 15-second,
single-use capability binding caller, subject, current grant/security epochs,
service, destination, credential, locator/generation, method, canonical path
digest, request ID, and operation digest. The data-plane caller key cannot mint
that capability. Backup export/import requires a separately signed,
operation-digest-bound, five-minute, single-use authorization minted only after
the persistence owner consumes the future stepped-up authorization record. This
milestone exposes the issuer/verifier seam but no route that can mint either
capability.

## Record and backup formats

Each locator maps to one binary, versioned record. A random per-record 256-bit DEK
encrypts the binding plus value with AES-256-GCM. The active root key wraps the DEK
with a distinct fresh nonce. Associated data binds the product marker, format
version, locator/record UUID, generation, root-key ID, timestamps, and size class.
The database never receives the root key, DEK, ciphertext, locator contents, or
value.

Record commits write a new mode-`0600` file, fsync it, atomically rename it, and
fsync the records directory. Replace retains the locator and increments
generation; delete unlinks and directory-fsyncs. Startup removes only validated
orphan temporary names, validates every bounded record, and enters sanitized
`locked`/`degraded` readiness on wrong-key/corruption rather than serving partial
operations.

Credential-bearing export uses Argon2id with a random 16-byte salt, 64 MiB memory,
three iterations, and parallelism one. A versioned manifest-bound header and
64-KiB chunks use unique AES-256-GCM nonces. The broker streams already encrypted
bytes; no caller receives a plaintext export. Import bounds parameters, total
bytes (1 GiB), record count (100,000), chunk order, manifest/count/digests, and
entry sizes. It decrypts and re-envelopes into a private staging directory, then
atomically swaps the complete records directory only after final authentication.
A wrong passphrase and tampered archive return the same stable authentication
failure and leave the active store unchanged. Passphrases and plaintext archive
chunks are never persisted and mutable buffers are zeroed in `finally` paths.

## Slice 1: keys, configuration, frames, and capability tokens

Outcome: closed vault configuration; atomic non-printing key-generation/status
CLI; fixed binary frame encoder/decoder; exact caller/operation matrix; bounded
nonce replay cache; separately signed resolve and backup capability tokens.

Positive tests cover exact valid key modes/content, minimum/maximum frames,
round-trip raw-byte authentication, caller matrices, capability bindings, and CLI
atomic output. Negative tests cover unknown fields, relative/colliding paths,
links/unsafe modes, malformed/non-canonical keys, every malformed frame field,
bad MAC/stale/replayed nonce, wrong capability kind/binding/expiry/signature, and
absence of key/token values from output.

Commit: `Define vault protocol and capabilities`.

## Slice 2: encrypted atomic record store

Outcome: versioned AES-256-GCM envelope records with random DEKs, safe metadata,
cross-credential binding, generation checks, atomic create/replace/delete, startup
inventory, sticky lock/degradation, and lifecycle cleanup.

Positive tests cover create, masked metadata, internal resolve, replace, delete,
restart persistence, multiple root keys, exact secret limits, concurrent writes,
and restrictive permissions. Negative tests cover locator/binding/generation
mismatch, limit-minus/plus-one, ciphertext/header/tag corruption, missing/wrong
keys, linked/unsafe files, duplicate create, and injected failure before rename
proving the previous record remains authoritative. Database/store serialization
assertions contain no plaintext.

Commit: `Add encrypted vault record store`.

## Slice 3: isolated broker and typed clients

Outcome: a separately executable Unix-socket broker with bounded framing,
connection/crypto/deadline controls, authenticated signed responses, sanitized
readiness, idempotent shutdown, and role-specific clients. The data client exposes
plaintext only to a callback and zeroes its buffer afterward.

Positive tests start the real broker process and exercise control create/replace/
metadata/delete plus authorized data resolve and restart. Negative integration
tests manually attempt every cross-caller escalation, forged/stale/replayed
frames and capabilities, cross-locator resolution, malformed streaming state,
unavailable/locked broker, excess connection/work capacity, and timeout. Captured
stdout/stderr and stable errors are checked for secret, key, token, frame, path,
and ciphertext absence; socket permissions and separate caller-key possession are
verified.

Commit: `Run isolated vault broker`.

## Slice 4: encrypted streaming export and import

Outcome: the approved Argon2id and chunked AES-256-GCM archive payload protocol,
backup-only streaming client, staged authenticated import, atomic store swap, and
uniform passphrase failure.

Positive tests cover multi-record/multi-chunk export, import into a broker with a
different root key, exact chunk/record/archive limits, restart, and one-use
authorization. Negative tests cover control/data export attempts, backup ordinary
read attempts, wrong passphrase, KDF parameter abuse, header/manifest/chunk/tag/
order/count tampering, truncated streams, replay, oversized streams, and injected
pre-swap interruption with the old store intact. No plaintext archive or
passphrase may appear in files, logs, errors, or process arguments.

Commit: `Stream encrypted vault backups`.

## Slice 5: lifecycle and deployment acceptance

Outcome: startup scripts and Docker/deployment examples can run the broker under
its own identity with only its socket/store/root/caller-verifier mounts; callers
receive only their own key and operation client. Control readiness gains a
sanitized vault seam without making a later credential route or changing the
current data-plane runtime authority.

Acceptance starts broker and callers as separate processes, proves the operation
matrix and clean restart, validates restrictive paths, verifies unavailable/
locked readiness, runs the production build, and runs the unchanged full suite.
Documentation uses only `example.org` stand-ins and never includes key material.

Commit: `Complete vault broker foundation`.

## Later-milestone handoff

Milestone 11 may use only the control client and must transactionally compensate
database/vault failures without ever reading stored values. Milestone 13 mints
resolve capabilities only after authentication, current authorization,
destination validation, policy, and capacity. Milestones 21–22 consume durable
stepped-up backup authorizations before minting backup capabilities and own
archive/restore orchestration. Key rotation, recovery snapshots, and reference
invalidation remain in their assigned later milestones.
