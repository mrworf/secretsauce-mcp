# SecretSauce v2.1 Implementation Decisions

Status: approved implementation baseline for Milestones 01–10.

These decisions answer PRD Section 24 without changing its settled product
behavior. The PRD and the approved provisioning and vault REST records remain
authoritative if this summary is ambiguous.

## ADR-2.1-01: provisional enrollment is a ceremony, not a user

Represent initial and recovery enrollment with an application-owned,
server-side ceremony record containing an opaque UUID, purpose, subject UUID
when one already exists, slow hashes of bearer inputs, expiry, attempt state,
and a monotonic version. The process-lifetime initial record is memory-only and
has no subject UUID; existing-user ceremony verifiers may be durable. Password
and TOTP material remain transient and are passed to one transaction that
creates the user, authenticator, recovery metadata, and audit event. No partial
user, role, session, or OAuth authority exists before that commit.

Alternative rejected: an inactive provisional user would leak identity state
into uniqueness, authorization, retention, and recovery behavior.

## ADR-2.1-02: bounded provisioning retry loop

The sole vault entrypoint owns a monotonic-clock retry loop with one outstanding
timer, exponential delays of 1, 2, 4, 8, 16, and 30 seconds, a 30-second cap,
and cryptographic jitter in the range 0.75–1.25. A successful verified
transition resets the delay. Shutdown cancels the timer and awaits current work.
Each attempt re-reads and validates durable state; memory never authorizes a
transition. Retryable fresh `pending` failures remain `preparing` with
`retry_pending: true`; continuity failures become terminal
`configuration_error`. No remote request can schedule or accelerate a retry.

Alternative rejected: a general job queue adds a second authority and durable
state not needed by the single entrypoint.

## ADR-2.1-03: conservative internal device-family derivation

Do not add a user-agent parser dependency in v2.1. Normalize at most 512 UTF-8
bytes into one of the closed browser families `Chrome`, `Firefox`, `Safari`,
`Edge`, `Other`, and device families `Mobile`, `Tablet`, `Desktop`, `Other`
using ordered, anchored token checks. Store and display only those labels, never
the raw user agent. Invalid, ambiguous, or truncated input becomes `Other`.
Tests own a fixed corpus and markup/control-character cases.

Alternative rejected: a large frequently changing parser database expands the
supply chain for display-only coarse metadata.

## ADR-2.1-04: audited tombstone and idempotency window

Revocation commits immutable sanitized audit evidence and an operational
tombstone in the same application transaction. A revoked session or grant may
be physically removed only after its maximum authentication lifetime and the
30-day mutation-idempotency window have both elapsed, no active token or
reference remains, and the audit lineage is present. A bounded retention job
deletes eligible rows in UUID order. Authorized repeats during the window
return the stored no-change outcome; unknown or out-of-scope targets retain the
uniform inaccessible result.

Alternative rejected: immediate deletion cannot prove scoped repeat semantics
or distinguish an authorized inactive target without disclosing existence.

## ADR-2.1-05: bounded transactional global revocation

Use the existing single `PersistenceWorker` and one SQLite `IMMEDIATE`
transaction for the supported single-instance scale. Select targets from a
stable high-water UUID, apply set-based status/epoch changes, delete or revoke
dependent tokens and references, and insert one summary audit event plus
bounded target evidence. Reject requests whose preflight count exceeds the
documented global limit rather than partially committing. The initial supported
limit is 100,000 sessions plus grants; performance fixtures test the boundary.

Alternative rejected: asynchronous partial batches violate the product's
atomic bulk-revocation contract.

## ADR-2.1-06: one canonical client-source boundary

A shared `ClientSourceResolver` runs immediately after connection metadata is
available and before authentication, rate-limit identity selection, session
metadata, OAuth, MCP parsing that can cause work, or application routing. Each
listener supplies only the immediate peer and bounded raw forwarding field.
The resolver owns direct, trusted-proxy, and always modes, canonical IP
normalization, proxy-chain parsing, trust matching, safe diagnostics, and the
one startup warning for always mode. Downstream handlers receive one immutable
canonical source context and never parse forwarding headers.

Alternative rejected: listener-specific parsing can create different limiter
and audit identities for one request.

## ADR-2.1-07: Fastify adapter with strict raw HTTP guards

Retain Fastify as the maintained routing/runtime-schema adapter and Node's
Unix-socket HTTP client, but put a small shared raw-message guard before route
dispatch. It rejects ambiguous framing, duplicate security headers,
non-origin-form targets, upgrades, and bounds that generic routing would
otherwise normalize. Zod validators generated from or checked against the
canonical private OpenAPI document validate closed bodies and response
envelopes. Authentication and fixed caller allowlists produce a
transport-neutral domain context; neither Fastify nor socket objects cross that
boundary.

Alternative rejected: a second HTTP framework adds maintenance cost, while
generated server ownership risks creating a parallel authorization path.

## ADR-2.1-08: closed store adapters and durable root journal

Each rotatable store implements a closed `RootRewrapAdapter` with preflight,
inventory, stage, conditional rewrap, verify, and commit methods. Conditional
mutations require the expected old physical root version. The setup-state
volume holds one canonical-JSON, checksum-protected journal bound to
installation UUID, request UUID, target, starting aggregate, old/new versions,
phase, cursor, and counts. Journal replacement and the final
manifest/completed-receipt replacement use write–sync–rename–directory-sync.
Only the bounded maintenance composition opens affected-store write authority;
it never opens the application writer concurrently. Resume derives its next
step from validated durable state, not a caller argument.

Alternative rejected: SQL in the product contract would prevent the identity
and vault stores from retaining closed ownership and would encourage a second
ordinary application writer.

## Dependency and cryptography selections

- Runtime: Node.js 22 or later, Fastify 5, Zod 4, React 19, SQLite through
  `better-sqlite3`, and Vitest, matching the repository lockfile.
- UUIDs: canonical UUIDv7 for durable application records; canonical UUID for
  host rotation request IDs as specified by the PRD.
- Passwords and bootstrap/temporary secrets: the existing Argon2id policy and
  constant-work verification boundary.
- TOTP: the existing HMAC-based local authenticator contract; SHA-1 compatibility
  is restricted to TOTP and does not become a general signature choice.
- Private vault request/response authentication: HMAC-SHA-256, 32-byte
  caller-specific keys, exact canonical base64url, SHA-256 body digests, and
  timing-safe comparison.
- Fingerprints and aggregate commitments: adapter-defined canonical public
  encoding hashed with SHA-256; no raw key enters the manifest.
- Nonces and bearer values: Node cryptographic randomness with at least 128 bits
  of entropy. Raw values are never persisted where a verifier/hash suffices.
- Root wrapping and archive cryptography retain the reviewed v2 algorithms and
  domain separation; this milestone does not introduce a new primitive.

No new production dependency is approved by this record. Any substitution must
preserve these contracts and receive dependency and security review in the
implementing milestone.

## Approval and change control

This record is the project-authored implementation decision baseline. Its
cross-artifact approval is recorded in
[`docs/audits/v2.1/milestone-00-acceptance.md`](../../audits/v2.1/milestone-00-acceptance.md).
It is not independent assurance, human approval, or release evidence.
