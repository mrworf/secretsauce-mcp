# SecretSauce v2.1 Data And State Contract

Status: approved implementation baseline.

## Ownership and authority

| State | Sole writer | Readers | Storage |
| --- | --- | --- | --- |
| Key manifest and rotation journal | Vault setup/maintenance entrypoint | Vault runtime and assigned application consumers | Dedicated durable setup-state volume |
| Vault ciphertext and root versions | Vault runtime or exclusive maintenance adapter | Vault only | Durable vault volume |
| Users, authenticators, ceremonies, settings, sessions, grants, counters, idempotency, audit | One application `PersistenceWorker` | Application domain repositories | Application SQLite database |
| Process bootstrap secret | Application bootstrap coordinator | One enrollment verifier and intentional startup-line emitter | Process memory only |
| Browser cookies, CSRF proof, OAuth bearer values | Issuing boundary | Exact authenticating boundary | Raw value only in its designated delivery channel; hashes server-side |

The application setup-only composition does not open SQLite. The vault never
becomes a parallel application database writer. Host setup/maintenance authority
is irreversibly dropped before the credential listener starts.

## Installation and setup state

The internal application projection is exactly:

```text
provisioning -> enrollment_required -> operational
       |                 |                |
       +-----------------+----------------+-> configuration_error
```

`configuration_error` is a fail-closed projection, not a transition that clears
state. Recovery restores a matching manifest/key/store set or resumes an
already-authorized journal and then restarts validation. Public responses map
both vault `configuration_error` and unavailable/malformed private status to
bounded `not_ready`; they never reveal whether zero users exist.

The key manifest has `provisioning` and `configured` states. Its registry is the
fixed v2.1 superset. Every entry progresses `pending -> created -> verified`;
only `pending` creation failures retry. Missing or mismatched `verified` or
configured entries are terminal. The manifest includes installation UUID,
registry version, canonical entry fingerprints, aggregate commitment, state,
and canonical format version. Atomic replacement is write, file sync, rename,
and parent-directory sync.

## Core records and invariants

### Enrollment ceremony

- UUIDv7, purpose (`initial`, `invited`, `reactivation`, `reset`), optional
  existing user UUID, slow verifier hashes, expiry, bounded attempt state,
  version, and consumed timestamp.
- Initial ceremony is application memory except for non-secret rate-limit
  state; no user exists until final commit.
- Existing-user ceremonies may persist only verifiers and non-secret state.
- Raw temporary password, bootstrap secret, proposed password, TOTP seed/code,
  and recovery material are absent from durable rows and audits.
- Consume is compare-and-set on active version and expiry. Success and all
  user/authenticator/audit mutations commit together.

### User and authenticator

- Normalized email uniqueness is decided in the final transaction.
- Local activation always has password plus confirmed TOTP.
- Suspension, deactivation, or restricted enrollment cannot carry ordinary
  browser, OAuth, MCP, or step-up authority.
- Password/TOTP reset increments the user security epoch and revokes human
  sessions, OAuth grants/tokens, and dynamic references atomically.
- Authenticated self-service password change retains TOTP but still rotates
  relevant session/epoch state per the PRD.

### Browser session

- UUIDv7, user UUID, slow hash of opaque cookie, CSRF verifier, authentication
  method, created/last-used/absolute/idle expiries, security epoch, revoked
  timestamp/reason, derived device family, coarse network, and version.
- Raw cookie, CSRF value, user agent, forwarding chain, and full IP are absent.
- Authentication reads current user eligibility, epoch, expiry, and revocation
  on every request. Commit precedes post-revocation rejection.
- Logout commits revocation and audit before clearing the cookie. Failure changes
  neither session nor cookie and returns retryable failure.

### OAuth grant and token family

- Grant UUIDv7 owns client identity, subject, scopes, reachable services,
  eligibility version, created/last-used/expiry, and revoked state.
- Authorization codes, access tokens, and refresh tokens persist only slow or
  keyed hashes and family/version metadata.
- Refresh rotation is compare-and-set; replay revokes the family.
- An agent-connection administrative mutation re-evaluates current actor role,
  target eligibility, and complete nonempty all-services-managed scope inside
  the deciding transaction. A prior list never authorizes mutation.

### Suspension counter and protective settings

- Counters key immutable user UUID and qualifying event time, never email text.
- Only correct-password/wrong-TOTP events from local control or OAuth login
  qualify. The rolling window is exactly 24 hours.
- Threshold evaluation, suspension, all invalidation, counter finalization, and
  audit are one transaction. Disabling the setting clears counters.
- Settings use versioned optimistic concurrency and the PRD bounds; invalid
  host environment configuration prevents startup before listeners.

### Revocation tombstone, idempotency, and audit

- Mutation idempotency binds actor, operation, target/scope, exact normalized
  body digest, and stored result for 30 days.
- Revocation produces an operational tombstone and immutable sanitized audit
  evidence atomically.
- Physical deletion requires elapsed authentication and idempotency windows,
  zero live dependents, and durable audit lineage. Deletion is bounded and
  ordered.
- Audit stores actor/target UUID and safe snapshot, action, outcome, scope,
  counts, justification, correlation UUID, and timestamp. It excludes all raw
  bearer, cookie, CSRF, credential, address, agent, and body values.

## Transaction boundaries

| Operation | Atomic unit and failure result |
| --- | --- |
| Initial superadmin completion | Verify active ceremony; insert user, role, password, TOTP, settings linkage, consume ceremony, and immutable audit. Any failure creates nothing. |
| Qualifying suspension | Insert qualifying attempt; evaluate window; when threshold reached suspend user, revoke sessions/grants/tokens/references, increment epoch, and audit. Any failure changes nothing. |
| Logout | Revoke exact session and insert audit. Cookie clears only after commit; failure retains active state. |
| Individual/bulk revocation | Re-authorize current scope, mutate all targets/dependents, store idempotent result, and audit. Bulk preflight over limit rejects without writes. |
| Root rotation | Vault journal/state-machine unit, separate from application writer. Old root remains usable until inventory zero and atomic manifest/receipt commit. |
| Manifest configuration | Verify complete fixed registry and atomically replace manifest state. No partial configured projection. |

## Concurrency and stale state

- Application mutations run through one `PersistenceWorker`; repositories use
  expected versions or deciding predicates in the same transaction.
- Initial enrollment races on the zero-user predicate and ceremony version, so
  exactly one complete superadmin can commit.
- Suspension and administrative revocation re-read authority at mutation time.
- Root maintenance takes exclusive adapter authority and uses expected-old-root
  conditional mutations. A cursor is progress, never proof; final inventory is
  authoritative.
- Idempotent retries with the same key and normalized body return the stored
  result. Reuse with a different body is a conflict.

## Retention, deletion, and privacy

Ceremony verifiers expire at their configured deadline and are removed by a
bounded job. Raw process bootstrap state is erased after success or shutdown.
Operational revoked rows follow ADR-2.1-04. Immutable administrative audit
follows existing configured retention and is never shortened merely because an
operational row is deleted. Coarse networks are IPv4 `/24` or IPv6 `/48`; device
labels are closed enums.

## Migration, compatibility, backup, and rollback

V2.1 is fresh-only. The sole compatibility path is complete current-layout key
adoption with explicit `setup.adopt_existing_keys: true`, full adapter-owned
validation, and no key change. No manifest plus partial keys, retained state, or
indeterminate inventory is fatal. Unknown future registry identities are an
unsupported upgrade.

Application schema changes remain append-only versioned migrations with checksum
history and fresh-database plus rollback-fixture tests. A migration failure
leaves the previous schema authoritative. Key/root rotation is not a schema
migration and cannot be rolled back after its final receipt; before final
receipt it resumes with the retained old root.

Backups exclude process secrets, raw cookies/tokens, idempotency bearer values,
and setup authority. Restore must keep manifest, roots, ciphertext, database,
installation identity, and audit lineage as a validated compatible set.

## Milestone 01 and 02 handoff

Milestone 01 may implement transport-neutral vault handlers, strict HTTP
adapters, and the canonical OpenAPI contract without choosing state ownership or
caller authority. Milestone 02 may implement the fixed registry, manifest,
retry loop, inventories, adoption, and privilege drop without choosing
transaction, compatibility, or failure semantics.
