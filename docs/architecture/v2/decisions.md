# Architecture Decision Records

All decisions are accepted. The numbered records answer v2 PRD Section 39 in order.

## ADR-001: OS-separated vault broker

**Decision.** Run the vault broker as a separate Node.js process under a dedicated
OS identity. It listens only on a Unix-domain socket in a root-owned runtime
directory. The data plane, control plane, and backup coordinator run as distinct
OS identities and authenticate to the broker with separate 256-bit HMAC keys read
from mode `0400` files. Socket directory permissions restrict connection, while a
nonce, timestamp, caller ID, operation, and canonical request digest authenticated
by HMAC prevents caller impersonation and replay. The broker maps each caller key
to a fixed operation allowlist.

**Consequence.** A compromised control plane can replace or delete a value but
cannot resolve or export it. A data-plane compromise can resolve only a
short-lived, subject/service/credential-bound authorized operation. Container
examples must run separate users and mount only each process's caller key.

**Rejected.** A TypeScript module boundary and one shared process do not provide
meaningful isolation. A general vault HTTP API creates unnecessary attack surface.

## ADR-002: better-sqlite3 with one persistence owner

**Decision.** Add `better-sqlite3` and its maintained type package. A dedicated
persistence worker owns exactly one connection, serializes commands, and owns all
transactions. Use WAL mode, foreign keys on, `synchronous=FULL`, a 5-second busy
timeout, and forward-only numbered SQL migrations whose checksums are recorded in
`schema_migrations`. Startup takes an exclusive application lock and refuses a
second writer. Repositories accept an explicit unit-of-work; they never start
nested transactions or retain statements past shutdown.

Backup coordination pauses new writes, drains the command queue, checkpoints WAL,
uses SQLite's online backup API to a new mode-`0600` file, verifies the copy, then
resumes. Restore uses maintenance mode and never swaps a live open database.

**Rejected.** Node 22's evolving built-in SQLite API is not a stable baseline for
the full supported Node 22 range. Async wrapper libraries obscure transaction
ownership without improving a single-writer product.

## ADR-003: externally provisioned root keys and envelope rotation

**Decision.** Provision independent 256-bit root keys for identity encryption and
the vault through Docker/Kubernetes secret files or mode-`0400` host files. Key
paths, never key values, are instance settings. SQLite stores a key ID and
AES-256-GCM envelope; it cannot decrypt itself. TOTP records use per-record random
DEKs wrapped by the identity root key. Vault records use per-record DEKs wrapped by
the active vault root key. Associated data binds product, schema, record UUID,
secret class, and key ID.

Rotation installs a new root key, makes it active for writes, rewraps DEKs in
bounded resumable batches, verifies every envelope, and retires the old key only
after a credential-less recovery-key inventory confirms no references. Root keys
are backed up by the operator outside application backups. Interactive
credential-bearing backup uses a passphrase-derived archive key and never embeds
an instance root key.

## ADR-004: opaque OAuth access tokens

**Decision.** Access and refresh tokens are 256-bit random opaque values. Persist
only domain-separated keyed hashes. Every access-token use loads the grant,
refresh-family, user status/role, user security epoch, and global epoch; it then
performs dynamic service authorization. Access tokens default to five minutes.
Refresh tokens rotate on every use; reuse revokes the family transactionally.

**Rejected.** A signed access JWT provides no useful offline-validation advantage
because mandatory grant-state and security-epoch checks require a database read,
and it exposes more metadata to clients.

## ADR-005: transactional allowlisted audit FTS

**Decision.** Application code builds a versioned canonical search document only
from allowlisted sanitized event columns. The immutable audit row and matching
contentless FTS5 row are inserted in the same unit-of-work. Retention deletes both
in the same bounded transaction. Startup reconciliation compares IDs/counts and
rebuilds only from allowlisted columns while readiness is false.

**Rejected.** Indexing serialized events risks prohibited-field ingestion; async
indexing permits successful writes to be temporarily or permanently unsearchable.

## ADR-006: bounded encrypted pre-restore snapshots

**Decision.** Before restore, maintenance mode creates a SQLite online backup and
vault-store snapshot in a private staging directory. A fresh random recovery DEK
encrypts both with chunked AES-256-GCM; the DEK is wrapped by the active instance
recovery key. The snapshot is limited to one archive, 2 GiB, and 24 hours. Creation
fails closed if limits or free-space checks fail. Successful restore verifies,
atomically swaps, reopens, and deletes the snapshot after the post-restore health
gate; unexpected commit failure rolls back from it. Startup resumes or rolls back
using a small fsynced journal.

## ADR-007: exact safe configuration ranges

**Decision.** Values outside these inclusive ranges are rejected, not clamped.
Increases affect new state only; lifetime reductions are checked against existing
state on every validation.

| Setting | Default | Allowed |
| --- | ---: | ---: |
| Admin absolute session | 12 h | 1–24 h |
| Admin inactivity | 15 min | 5–120 min |
| User absolute session | 24 h | 1–72 h |
| User inactivity | 60 min | 5–1440 min |
| Step-up cache (`five_minutes`) | 5 min | fixed |
| OAuth access token | 5 min | 1–15 min |
| Refresh inactivity | 30 d | 1–90 d |
| Refresh absolute | 90 d | 7–365 d and not below inactivity |
| Temporary password | 72 h | 1–168 h |
| Login/account or source | 10 / 15 min | 3–20 attempts / 5–60 min |
| Password verification | 10 / 15 min | 3–20 / 5–60 min |
| TOTP verification | 5 / 5 min | 3–10 / 1–15 min |
| Enrollment | 10 / h | 3–20 / 15–1440 min |
| OAuth authorize/token | 30 / min | 5–120 / 1–60 min |
| Management API per key/source | 120 / min | 10–600 / 1–60 min |
| Backup generation | 2 / h | 1–10 / 15–1440 min |
| Search/report | 30 / min | 5–120 / 1–60 min |
| Page size | 50 | 1–200 |
| Search text | 256 chars | 1–512 chars |
| Absolute search window | 400 d | 1–3650 d |
| Backup upload | 1 GiB | 1 MiB–2 GiB |
| Archive files / YAML nodes | 32 / 1,000,000 | fixed maxima |
| Job batch | 500 rows | 50–2,000 |
| Job wall time | 30 s | 5–120 s |

Existing v1 MCP body, response, scan, timeout, and concurrency bounds remain in
force and retain their own validated ranges. Unlimited audit retention is an
explicit enum value, never a magic integer. Refresh absolute lifetime must be at
least its inactivity lifetime; inactivity must be below absolute session lifetime.

## ADR-008: vendor-neutral OIDC MFA assurance

**Decision.** Each provider config specifies exact HTTPS issuer, client ID,
redirect origin, allowed signing algorithms (`RS256`/`ES256` by default), clock
skew (0–120 seconds), required `acr` values, and/or required `amr` members. Discovery
issuer must exactly match configuration. Validate signature, issuer, audience,
nonce, PKCE S256, state, `exp`, `iat`, and `auth_time`; reject missing/ambiguous
MFA evidence. `amr` uses configured combinations such as `pwd` plus `otp`; no
vendor claim is trusted unless explicitly mapped to a normalized `mfa=true`
assurance rule. Email linking is never automatic.

## ADR-009: redacted configuration version history

**Decision.** Each publish creates an immutable version row containing canonical
non-secret metadata, bindings by immutable ID, policy logic, actor snapshot,
timestamp, and SHA-256 digest. Credential values, last-four hints, API keys,
identity secrets, and opaque references never enter history. Credential history
records only status and vault-generation ID. Rollback creates a new head version;
it never resurrects deleted vault material or principal bindings that are no
longer valid. Retain 100 versions per service for 400 days, whichever removes
history first, with at least the current version retained.

## ADR-010: bounded audit and activity aggregation

**Decision.** Partition logically by UTC month in ordinary SQLite tables and index
`(occurred_at,event_id)`, service/time, actor/time, and outcome/time. Retention
deletes at most 2,000 rows or 100 ms per transaction. Activity ingestion uses
hourly buckets keyed only by service, destination, method, matched policy/default,
allow/deny, and status class. It upserts in the audit transaction, rolls hours into
daily buckets after 32 days, and deletes raw MCP audit plus FTS at the configured
400-day default. Cardinality guards map unknown/excess categories to `other`; raw
paths, query, headers, bodies, references, and secret-derived values are forbidden.
