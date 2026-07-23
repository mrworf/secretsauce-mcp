# Milestone 04 Implementation Plan: Identity Bootstrap

## Scope review

Milestone 04 establishes durable identity records and their provider boundary. It
does not add password hashing, TOTP secrets or verification, sessions, enrollment
ceremonies, user-management routes, OIDC network behavior, service assignments, or
MCP eligibility.

The milestone-specific requirement to create one pending local superadmin takes
precedence over the validation matrix's shorthand about an active TOTP account.
Bootstrap therefore creates an `enrollment_required` identity with empty
authenticator state. Milestones 05 and 06 own authentication and activation.

## Fixed contracts and limits

User IDs, provider-link IDs, and audit event IDs are canonical lowercase UUIDv7
values. User roles are exactly `superadmin`, `admin`, or `user`. Account states
and transitions are:

- `invited` to `enrollment_required`;
- `enrollment_required` to `active`;
- `active` to `suspended` or `deactivated`;
- `suspended` to `active` or `deactivated`;
- `deactivated` to `enrollment_required`.

Role changes may select any other role, but a transaction may not demote,
suspend, deactivate, or delete the last active superadmin. The predicate is a
reusable domain operation and counts only `role = superadmin` plus
`status = active`.

Email input is NFKC-normalized and trimmed. The local part is case-folded; the
domain is converted with Node's IDNA `domainToASCII`, case-folded, and checked as
DNS labels. The canonical email is unique, at most 254 UTF-8 bytes, and contains
one local part of at most 64 UTF-8 bytes. Display email remains mutable and
separate. Names are NFKC-normalized, trimmed, reject controls, and are bounded to
128 Unicode code points and 512 UTF-8 bytes. Empty given or family names are
allowed so the model does not force culturally invalid naming assumptions.

Provider IDs are lowercase safe identifiers of 1–64 bytes. Issuers are canonical
HTTPS origins of at most 2,048 bytes, without credentials, path, query, or
fragment. Subjects are exact, nonblank UTF-8 strings of at most 255 bytes and
reject controls. Provider links are unique on `(provider_id, issuer, subject)`;
the lookup API accepts only this tuple and has no email parameter or fallback.
The provider-adapter result contains only provider ID, issuer, subject,
authentication time, verified-MFA evidence, and allowlisted profile claims.

The `users` aggregate stores security epoch, password-policy version, version,
and timestamps. A one-to-one local-authenticator-state row stores only bounded
state enums and contains no hash, TOTP seed, token, or plaintext column in this
milestone. A singleton bootstrap marker and the no-users predicate are committed
with the user, authenticator state, and administrative audit event.

## Slice 1: identity schema and validated contracts

Outcome: migration `0003` adds users, local authenticator state, provider links,
indexes, foreign keys, lifecycle checks, and a singleton bootstrap marker.
Validation modules define normalized profiles, exact provider identities,
provider-adapter types, lifecycle transitions, read models, and explicit
`mcpEligible: false`.

Positive tests cover schema upgrade, canonical UUIDv7 rows, Unicode/IDNA email
normalization, maximum field lengths, valid provider values, and all valid
transitions. Negative tests cover malformed UUIDs, duplicate normalized email and
provider tuples, byte/code-point limit overflow, controls, malformed domains and
issuers, unknown fields, secret-bearing authenticator columns, and every invalid
transition.

Commit: `Define durable identity contracts`.

## Slice 2: transactional identity repository

Outcome: persistence commands create and read users, update mutable profiles
without changing identity, link and resolve exact provider subjects, change roles
and states with optimistic versions, and apply the reusable active-superadmin
predicate inside the same immediate transaction as mutation and audit.

Positive tests cover stable IDs through profile changes, exact provider lookup,
valid role/state changes, security-epoch retention, safe read models, and
denormalized audit snapshots. Negative tests cover duplicates, email-only
matching, stale versions, invalid transitions, cross-user provider links,
last-active-superadmin loss, and rollback when audit insertion fails.

Commit: `Add transactional identity repository`.

## Slice 3: one-time host bootstrap

Outcome: a local-only CLI reads configuration and profile fields interactively,
requires a real terminal by default, never accepts profile or future
authentication material through process arguments, and submits one audited
bootstrap command. The command succeeds only when both the users table and
singleton marker are empty, creates one `enrollment_required` local superadmin,
and returns only its UUID, role, state, and enrollment-pending status.

Positive tests cover a fresh interactive bootstrap, Unicode profile input,
restrictive database permissions, sanitized self-contained audit, and persistence
across restart. Negative tests cover non-terminal invocation, missing persistence,
malformed/cancelled input, second invocation, concurrent attempts, pre-existing
users, unavailable persistence, and absence of profile/credential/token material
from arguments, logs, errors, and output.

Commit: `Bootstrap initial superadmin locally`.

## Slice 4: milestone acceptance and handoff

Outcome: focused acceptance proves exact UUID/provider relationships, all
transition and last-superadmin boundaries, restart lockout, and the absence of
any authentication or MCP authorization integration. Operator documentation
describes the pending-enrollment outcome and future M05–M06 handoff without
including real hostnames or sensitive examples.

Run focused identity and bootstrap tests, production build, generated OpenAPI
check, and the unchanged full suite.

Commit: `Complete identity bootstrap foundation`.

## Later-milestone handoff

Milestone 05 may add verifier/session state only through designated
authenticator/session tables and must preserve the provider and last-superadmin
contracts. Milestone 06 activates the pending bootstrap identity only after the
complete password and TOTP ceremony. Milestone 07 exposes general lifecycle
administration through the control plane. Milestone 08 implements networked OIDC
verification behind the provider adapter and may link only exact issuer/subject
tuples.
