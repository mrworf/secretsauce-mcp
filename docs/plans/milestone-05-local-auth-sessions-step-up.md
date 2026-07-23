# Milestone 05 Implementation Plan: Local Authentication, Sessions, And Step-Up

## Scope review

Milestone 05 adds authentication for already active, fully configured local
identities. It does not add invitation, temporary-password, account activation,
recovery, reset, or self-service replacement workflows; those ceremonies belong
to Milestone 06. Tests may provision an active authenticator through an internal
fixture API, but no administrative route may bypass enrollment.

The existing single-admin built-in MCP OAuth implementation remains independent
until the v2 OAuth replacement in Milestone 14. Identity browser cookies are
accepted only by the control listener and never make an account MCP-eligible.

## Fixed password and key contracts

Passwords are NFKC-normalized once, measured as Unicode code points after
normalization, encoded as UTF-8 without truncation, and bounded to 1,024 code
points/4,096 bytes. The configurable minimum defaults to 12 and is limited to
8–128. New passwords are rejected when their normalized form appears in the
versioned bundled common/compromised SHA-256 blocklist, an optional bounded
operator SHA-256 blocklist, or the context set derived from normalized email,
names, domain, and product name. Composition rules and routine expiry are absent.

Argon2id uses a random 16-byte salt, 64 MiB memory, three iterations, parallelism
one, and a 32-byte result. Stored encodings are parsed and bounded before
verification; malformed or parameter-expanded database values fail closed.
Nonexistent, ineligible, and incomplete accounts verify against a valid
application-owned dummy encoding so public failure paths perform one comparable
Argon2 operation.

An optional closed `identity` configuration enables v2 local browser auth. It
contains an active identity-root-key ID and mode-`0400` key-file map, a separate
mode-`0400` 32-byte session-HMAC key file, password policy/blocklist paths,
bounded session settings, step-up mode, and bounded login/password/TOTP attempt
and concurrency settings. Identity root keys and the session key are distinct.
Missing, linked, malformed, unsafe-mode, or colliding key files fail startup
without echoing paths or values.

## TOTP and encrypted authenticator contract

TOTP uses RFC 6238 with unique random 20-byte seeds, HMAC-SHA-1 for broad
authenticator compatibility, six digits, 30-second steps, and a fixed
previous/current/next-step window. Enrollment primitives return an `otpauth` URI
and seed only to the initiating restricted ceremony; this milestone has no route
that exposes them. Confirmation is required before a seed becomes usable.

Each seed is encrypted by a random 256-bit DEK with AES-256-GCM. The active
identity root key wraps the DEK with a distinct nonce. Associated data binds the
product marker, envelope version, user/authenticator UUID, secret class, root-key
ID, and generation. SQLite stores only the envelope and key ID; it cannot decrypt
itself. Mutable plaintext buffers are zeroed on completion.

Accepted TOTP steps have a unique `(user_id,time_step)` record across login,
confirmation, and step-up purposes. Candidate verification does not consume a
step; the accepted step is inserted in the same immediate transaction as the
successful login, confirmation, or step-up state change, so concurrent replay
has one winner.

## Session and rate-limit contracts

Web session and CSRF values are independent random 32-byte base64url values.
Only domain-separated HMAC-SHA-256 hashes are stored. The cookie is
`__Host-secretsauce_session`, `Secure`, `HttpOnly`, `SameSite=Strict`, and
`Path=/`; logout clears it with identical attributes. Login, logout, and
authentication/secret-entry responses are `no-store`.

Admin/superadmin sessions default to 12 hours absolute and 15 minutes idle,
bounded to 1–24 hours and 5–120 minutes. User sessions default to 24 hours
absolute and 60 minutes idle, bounded to 1–72 hours and 5–1,440 minutes. Issued
durations are stored. Validation uses the smaller of the issued and current
duration, so reductions affect existing sessions and increases do not extend
them. Every use validates active status, fully configured local authenticators,
user/global epochs, revocation, absolute expiry, and idle expiry before refreshing
last activity.

Login, password work, and TOTP work use separate bounded windows keyed by HMAC of
the normalized account identity and by the direct socket source
(`request.ip`, with Fastify proxy trust disabled). Limits are checked before
expensive work. Password and TOTP concurrency have independent global/source
bounds. Rate-limited, nonexistent, and ineligible paths use uniform public
outcomes and never reveal whether an account exists.

## Step-up contracts

`five_minutes` verifies the current session user's password and a fresh TOTP
step, then stores a five-minute elevation time on that session. Every sensitive
request revalidates the session and elevation age.

`always` verifies password plus a fresh TOTP step for one canonical operation and
returns one random proof value. Its stored hash binds the browser session/user,
HTTP method, registered route ID, canonical target UUIDs, expected version,
idempotency-key hash when present, normalized body digest, mode, and expiry.
The protected request supplies the proof in a bounded `x-step-up-proof` header.
The control registry parses and canonicalizes the request before proof
validation, then passes only an opaque proof handle and operation digest to the
handler. The domain repository consumes that row in the same transaction as the
protected mutation and audit. A handler for an `always` route cannot report
success without transactional proof consumption.

Proofs expire after five minutes and are never reusable, including inside the
same TOTP interval. Wrong route, method, target, body digest, version,
idempotency key, session, user, epoch, or proof value fails uniformly. API keys
never receive or satisfy human step-up.

## Slice 1: keys, password policy, and TOTP primitives

Outcome: closed identity configuration and safe key loading; bundled/operator/
context blocklists; exact Argon2id hashing and bounded verification; RFC 6238
seed, URI, code, skew, confirmation, envelope, and buffer-lifecycle primitives.

Positive tests cover min/max Unicode passwords, stable normalization, exact
Argon2 parameters, blocklist loading, envelope restart/rewrap metadata, standard
RFC vectors, each allowed TOTP window edge, and confirmation. Negative tests
cover below/above limits, common/context/operator-blocked passwords, malformed
hashes/keys/blocklists/envelopes/URIs, key mismatch, wrong/skewed codes, unknown
fields, unsafe files, and absence of every secret from output/errors.

Commit: `Add local authenticator primitives`.

## Slice 2: atomic authentication repository and abuse controls

Outcome: migration `0004` adds designated password-verifier, encrypted-TOTP,
accepted-step, session, and step-up-proof tables plus activity fields/indexes.
Internal provisioning seams support later enrollment without an activation
route. Login candidate evaluation performs comparable password/TOTP work, and
one transaction consumes the TOTP step, updates safe activity, creates a hashed
session/CSRF record, and audits success. Failures and limits produce sanitized
deny audits without identity leakage.

Positive tests cover valid active local login, durable verifier/envelope restart,
activity update, separate account/source limits, and concurrency release.
Negative tests cover nonexistent/wrong-password/ineligible/incomplete parity,
malformed/oversized input, replay and concurrent replay, each rate/concurrency
cap before work, audit failure rollback, and database unavailability.

Commit: `Authenticate active local identities`.

## Slice 3: revocable browser sessions and HTTP flow

Outcome: a concrete control authenticator validates hashed cookies and CSRF
proofs on every request; public login, current-session/CSRF bootstrap, and logout
routes use closed secret-aware contracts and safe cookies. Startup wires the
identity service only when the complete identity configuration is present.

Positive tests cover real login/cookie/CSRF flow for both lifetime classes, idle
refresh, logout, process restart with stable keys, and concurrent requests.
Negative tests cover cookie/CSRF alteration, wrong listener, revoked/expired/
idle-expired sessions, shortened settings, increased settings not extending old
state, status/role/user/global epoch changes, Host/Origin/CSRF failures, and no
password/TOTP/cookie values in logs, audit, errors, URLs, or cacheable responses.

Commit: `Serve revocable browser sessions`.

## Slice 4: transaction-bound step-up modes

Outcome: password+TOTP step-up route and service, five-minute session elevation,
always-mode operation digest/proof issuance, control-contract proof handle, and
atomic proof-consumption API. A fixture protected mutation proves the full
authorize/validate/consume/mutate/audit transaction.

Positive tests cover five-minute reuse within its fixed window and fresh
always-mode proof consumption for an exact single and batch transaction.
Negative tests cover wrong/replayed/same-step/skewed TOTP, expired/stolen proof,
changed method/route/target/body/version/idempotency key, session/epoch mismatch,
failed mutation rollback behavior, missing consumption, API-key attempts, and
separate limit/concurrency exhaustion.

Commit: `Enforce transaction-bound browser step-up`.

## Slice 5: lifecycle, documentation, and acceptance

Outcome: identity auth readiness and idempotent shutdown are sanitized; operator
documentation covers key mounts, password/TOTP limits, session reduction
semantics, cookie/origin boundaries, TOTP phishing limitations, and the M06
enrollment handoff. No document uses a real deployment hostname or secret.

Acceptance runs focused crypto/repository/control integration tests, the
production build, generated OpenAPI consistency check, non-cache/cookie/log
inspection, `git diff --check`, and the unchanged full suite.

Commit: `Complete local authentication foundation`.

## Later-milestone handoff

Milestone 06 owns temporary credentials and the restricted user-facing
password/TOTP enrollment, recovery, replacement, and break-glass workflows. It
must activate the M04 bootstrap identity only after permanent-password policy and
TOTP confirmation commit together. Milestone 07 owns administrative lifecycle
routes and must use the epoch/session invalidation and transactional proof
handles. Milestone 14 replaces legacy MCP auth with durable multi-user OAuth and
must never accept control cookies or administrative identities.
