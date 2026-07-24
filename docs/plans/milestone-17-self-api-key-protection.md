# Milestone 17 Self-API-Key Protection Plan

## Outcome

Prevent an active `ssk_v1` management API key from becoming recursive
management authority through the gateway. General credential value writes
reject active SecretSauce keys. The only exception is a dedicated,
browser-only superadmin workflow with an exact-operation step-up proof, an
explicit fixed risk acknowledgement, and a durable approval bound to one
credential and one vault generation.

At runtime, requests whose canonical destination origin is one of this
deployment's configured SecretSauce public origins are inspected before
credential substitution or downstream I/O. Raw active keys are denied.
Approved credentials remain usable only through normal scoped `gref`
authorization, destination validation, policy evaluation, capacity controls,
live approval validation, and vault resolution.

This is exact structural defense. It does not claim to detect encoded,
fragmented, encrypted, or otherwise transformed keys, and database/vault
administrator tampering remains inside the accepted trusted-storage boundary.

## Candidate recognition and bounded verification

- Reuse the canonical Milestone 16 grammar:
  `ssk_v1_<16-character identifier>_<43-character secret>`.
- A bounded scanner visits string leaves only. It recognizes fixed-length
  canonical candidates at non-base64url token boundaries, including a bare
  value and a value inside an ordinary header prefix such as `Bearer `.
  It never decodes or transforms material.
- General writes inspect the submitted value before the vault coordinator is
  called. Runtime inspection visits header values, recursively visits query
  values and JSON-like body string leaves, and scans a top-level string body.
  Keys, numbers, booleans, null, binary blobs, encoded strings, and
  serialization artifacts are not interpreted as candidates.
- Deduplicate candidates by safe identifier and cap one request at 16
  recognizable candidates. The existing request/body bounds remain in force.
- Resolve a candidate by identifier, perform the existing Argon2id verifier
  through a shared four-worker pool, then re-read status and exact expiry.
  Unknown identifiers take the existing dummy-verifier path.
- Add a bounded process-local limiter for self-key checks: per direct source
  and authenticated principal on control writes, per MCP subject and global
  at runtime, with capped entries and fixed windows. Saturation fails closed
  before a vault write or downstream call.
- Candidate buffers are copied only for verification and zeroed on every
  path. Raw values, verifier hashes, headers, query values, bodies,
  `Authorization`, and downstream responses never enter logs, audit data, or
  errors.
- An inactive, expired, revoked, malformed, or noncanonical value is not
  management authority and follows the ordinary credential/request path.

## Durable approval identity and invalidation

Migration 0017 adds `credential_self_api_key_approvals`:

- `credential_id` primary key and foreign key to `service_credentials`;
- matching `service_id`;
- approved `api_key_id` foreign key to `api_keys`;
- exact positive `vault_generation`;
- approving superadmin UUID;
- safe key nickname and last-four snapshots;
- approval timestamp and justification digest;
- checks for UUIDs, bounded snapshots/digest, and positive generation;
- indexes on API key and service.

The approval identity is `(service_id, credential_id, vault_generation,
api_key_id)`. It is never inferred later merely because vault plaintext
matches a key. General value replacement or deletion removes any approval in
the same metadata-finalization transaction. Archive and credential deletion
cascade it. A dedicated replacement atomically replaces the row only after
the vault write has produced the exact generation and the key is revalidated
as active.

Rotation creates a new API-key UUID and revokes the old UUID, so the prior
approval immediately becomes unusable. Revocation or exact-boundary expiry
also makes it unusable without changing credential metadata. Renaming a key
does not invalidate approval; audit and approval views retain safe snapshots.
Last-four collisions have no authority effect because the UUID and verifier
identity are authoritative.

If the key changes state between initial verification and finalization, the
coordinator does not create approval and compensates the just-written vault
generation where possible; otherwise it marks the existing reconciliation
state and fails closed. It never exposes an active unapproved generation as a
configured runtime credential.

## Dedicated approval transaction

Add:

`PUT /api/v2/services/{service_id}/credentials/{credential_id}/self-api-key`

The route accepts only an interactive browser session with the new
`approve_self_api_key` capability, granted solely to `superadmin`. Static API
key augmentation therefore cannot add API-key authentication. The route uses
`If-Match`, required idempotency, `stepUp: "always"`, no-store, and secret
field redaction for `/value`.

The strict body contains:

- `value`, bounded by the existing 65,536-byte credential limit;
- optional `capture_last_four`;
- a bounded justification;
- the exact acknowledgement
  `I ACCEPT RECURSIVE SECRETSAUCE MANAGEMENT AUTHORITY`.

The transaction-bound step-up operation includes route, service UUID,
credential UUID, expected version, idempotency key, and canonical body digest.
The digest binds the secret without persisting or auditing it. The domain
service requires an active superadmin again in the final transaction, verifies
one exact active management key, writes the vault value, binds approval to the
resulting generation, consumes the proof in the audited commit, and returns
credential metadata plus safe approval metadata only.

Approval creation, verification/rate denial, compensation/reconciliation, and
success use distinct sanitized administrative audit actions. Generic
`credentials.value.replace` remains available under its existing permission
matrix but calls the same guard and rejects an active management key for
browser and API-key principals alike.

## Runtime self-target and inspection order

Build a canonical origin set once from configured SecretSauce-owned public
URLs:

- `control.publicOrigin`, when configured;
- the origin of `server.resource`, when configured;
- the built-in OAuth issuer origin, when configured.

Values are parsed by `URL`, reduced to lowercase scheme/host with normalized
default port through `.origin`, and must already pass configuration trust
validation. A request is self-targeting only when the fully validated
downstream target URL has an origin exactly in that set. Paths, aliases,
redirect destinations, DNS equivalence, and unconfigured reverse-proxy names
do not expand the set. Redirect handling remains governed by the existing
downstream transport.

Persisted-runtime order is:

1. authenticate and load the assigned service snapshot;
2. canonicalize and validate destination/path;
3. enforce request bounds, reference placement, and caller-owned headers;
4. preflight and revalidate all references;
5. evaluate service and credential policy;
6. acquire request capacity;
7. for a self target, structurally scan raw request values and verify
   recognizable candidates;
8. consume preflighted references;
9. for every referenced self-key credential, validate the durable approval,
   exact snapshot vault generation, and current active/non-expired API-key row
   in one fresh database read;
10. resolve approved secrets, substitute, build the request, and perform I/O.

Raw active candidates fail at step 7 with `self_api_key_denied`. An approved
credential missing any exact binding or live-state condition fails at step 9
with the same public error class. Neither path resolves a vault secret or
contacts downstream. Cross-service references and policy denials continue to
fail earlier through the ordinary gateway mechanisms.

Immutable runtime snapshots carry only safe approval identity
(`apiKeyId`, approved vault generation, nickname/last-four snapshots).
Live status is deliberately not trusted from the snapshot. The runtime
authority exposes one bounded batch validation method that joins approval,
credential generation, and active API-key state immediately before resolution.

YAML-authority mode has no durable approval system. It still blocks raw active
keys for configured self origins when the persistence-backed detector is
available, and otherwise fails closed for recognizable self-key candidates.
Approved self-use is supported only by database runtime and `gref`.

## Audit, warning, and UX contracts

Runtime denials append `self_api_key_blocked`; approved uses append
`self_api_key_approved_use`. Fields are limited to request ID, subject UUID,
service/destination UUIDs, method, canonical host/path, location categories
(`header`, `query`, `body`, or `credential`), safe API-key UUID when known,
nickname/last-four snapshots, credential UUID when applicable, outcome, and
timestamp. Logger warnings use the same safe shape. Candidate text and the
containing field value are prohibited.

Add a superadmin-only risk panel to the credential detail page. It explains
recursive management authority, requires the exact acknowledgement and
justification, invokes current transaction-bound step-up, and shows only safe
approval identity/status afterward. Admins and ordinary API-key callers do not
receive the control. The general replacement form reports a fixed active-key
rejection without echoing any submitted material.

## Minimal delivery slices

1. Migration 0017, canonical scanner, bounded active-candidate verifier,
   live-state repository seam, and positive/negative/boundary tests.
2. Vault-generation-bound approval coordinator, generic-write rejection,
   compensation/reconciliation behavior, revocation/rotation/last-four
   collision tests, and administrative audits.
3. Superadmin-only exact-step-up route, strict OpenAPI contracts, API-key
   hard denial, idempotency/concurrency tests, and safe response tests.
4. Canonical self-origin matching, structural request inspection, live
   approval validation in the persisted runtime, sanitized audit/warning
   events, and no-downstream-call integration tests.
5. Responsive credential risk-approval UX, step-up retry flow, approval
   metadata, accessibility, and raw-value non-retention tests.
6. Operator/security documentation, production build, OpenAPI currency,
   self-host integration, full regression, acceptance review, and status
   update.

Every slice receives positive and negative tests, the full regression suite,
and one concise commit.

## Acceptance matrix

- General storage: browser admin/superadmin and service/all/system key
  callers; create/replace; active, expired, revoked, malformed, noncanonical,
  1-byte and 65,536-byte bounds.
- Approval: active service/all/system keys; exact acknowledgement;
  superadmin/browser/current proof; missing, stale, replayed, wrong-route,
  wrong-target, and wrong-body proof; idempotency and concurrent replacement.
- Identity: vault generation replacement/deletion, key rename, last-four
  collision, rotation, revocation, exact expiry boundary, credential archive,
  and stale snapshots.
- Runtime raw values: bare and prefixed header values, nested query/body
  strings, top-level string body, unsupported binary/encoded/fragmented
  limitations, duplicate candidates, 16-candidate cap, verifier saturation,
  and rate limits.
- Runtime authorization: approved `gref`, missing approval, generation
  mismatch, inactive key, cross-service reference, assignment denial,
  destination denial, policy denial, capacity denial, and runtime-vault
  unavailability.
- Self target: uppercase hosts, explicit/default ports, path differences,
  control/MCP/built-in origins, near-match hosts, aliases, and unconfigured
  origins.
- Exposure: no raw key, verifier, request value, authorization data, vault
  secret, or downstream response in persistence, audit, logs, errors,
  OpenAPI examples, metadata reloads, or UI state after submission.
- Integration: a local SecretSauce target observes zero requests for raw or
  unapproved attempts; a valid approved reference reaches it only after the
  complete persisted authorization and policy pipeline.
