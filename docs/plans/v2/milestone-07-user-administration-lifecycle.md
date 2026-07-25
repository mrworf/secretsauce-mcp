# Milestone 07 Implementation Plan: User Administration And Lifecycle

## Scope review

Milestone 07 publishes browser user administration, local invitation, profile,
role/status, reset, reactivation, and deletion workflows over the identity and
credential primitives from Milestones 04–06. It also replaces the Users and
Profile shell placeholders with responsive, accessible management views.

Service relationships do not exist until Milestones 09–10. Admin relationship
queries therefore use an injected `UserRelationshipResolver` whose production
default returns no relationships. Admin list/detail/mutation requests fail
closed without leaking targets; the endpoint and authorization contracts remain
ready for Milestone 10 to supply relationships. No service assignment, API-key
authentication, OIDC behavior, or automatic inactivity workflow is added here.

## Authorization and projection contract

A table-driven `UserAdministrationPolicy` evaluates the immutable actor UUID,
current actor role, target UUID/role/status, requested action, and related-service
UUIDs. It returns one of: allow, self-only, relation-required, step-up-required,
last-superadmin-check, or deny. The database transaction re-reads actor, target,
role, status, version, and relationship decision inputs before mutation.

Browser outcomes are:

- all roles may read and edit their own profile through `/auth/self/profile`;
- a superadmin may list/read all users, create ordinary users or admins, edit any profile,
  reset authenticators, change `user`/`admin` roles, and affect superadmins
  subject to hard rules;
- an admin may eventually list/read/edit related ordinary users other than self
  and perform the matrix-authorized ordinary-user lifecycle/reset actions with
  step-up, but is unavailable until the relationship resolver has evidence;
- an ordinary user has no other-user administrative visibility;
- no browser caller permanently deletes a superadmin.

List/detail projections contain UUID, email, given/family name, role, status,
authenticator-state labels, version, and timestamps only when the viewer may see
the full record. No password hash, TOTP envelope, temporary hash, cookie,
accepted step, provider subject, or invalidation payload is projected.

## List, cursor, and relationship contract

`GET /api/v2/users` accepts closed `limit` (1–200, default 50), `cursor`, bounded
1–512 character `q`, optional role, and optional status. Results sort by
`normalized_email,id`. Search matches the authorized projection's normalized
email and normalized given/family name with escaped SQL `LIKE`; it never widens
authorization.

Cursors are canonical JSON plus HMAC-SHA-256 using a distinct domain over the
stable control idempotency key. They bind route, actor UUID/role, relationship
scope fingerprint, filters, last normalized email/UUID, issue time, and a
15-minute expiry. They are base64url, bounded to 2 KiB, compared with constant
time, and rejected on malformed, expired, cross-actor, cross-role, cross-scope,
or filter-changing use.

`UserRelationshipResolver` returns sorted service UUIDs shared by the actor's
managed services and the target's effective membership. Empty or unavailable
resolution denies admin visibility. Audit receives the complete affected
service UUID set for allowed global profile edits. Until Milestone 10, production
resolution is always empty.

## API and concurrency contract

Browser routes are:

- `GET /api/v2/auth/self/profile` and `PATCH /api/v2/auth/self/profile`;
- `GET /api/v2/users` and `GET /api/v2/users/:user_id`;
- `POST /api/v2/users` for local invitation;
- `PATCH /api/v2/users/:user_id/profile`;
- `POST /api/v2/users/:user_id/password-reset` and `/totp-reset`;
- `POST /api/v2/users/:user_id/suspend`, `/reactivate`,
  `/deactivate`, and `/restore-enrollment`;
- `PATCH /api/v2/users/:user_id/role`;
- `DELETE /api/v2/users/:user_id`.

Reads and list responses are no-store. Mutable reads return strong ETags.
PATCH/status/reset/deletion routes require `If-Match`; invitation, reset, and
deactivated-account restoration require `Idempotency-Key`. Request bodies are
closed and bounded. Justification is required for reset, suspend, reactivation,
deactivation, role change, and deletion.

Idempotent one-time-secret operations store only the durable result UUID/status,
never the temporary value. The first committed response displays the generated
temporary password. A same-key replay performs no mutation and returns current
safe resource metadata with `one_time_value_displayed: false`; it never
reconstructs or repeats the secret. Same-key/different-digest remains
`409 idempotency_conflict`.

Step-up follows the central matrix. In `five_minutes` mode, the transaction
rechecks the browser session and target. In `always` mode, the exact-operation
proof is consumed in the same immediate transaction as user mutation,
invalidation, idempotency record, and administrative audit.

## Lifecycle transaction contract

Migration `0006` rebuilds the Milestone 06 invalidation-event table with the
additional bounded reasons `profile_email_change`, `suspension`, `reactivation`,
`deactivation`, `role_change`, and `enrollment_restore`, preserving existing rows
and indexes. It adds no user tombstone or parallel profile table.

Invitation generates a random temporary password before the transaction, then
atomically creates the UUID-backed local identity, temporary Argon2id encoding,
`invited` status, `temporary/not_configured` authenticator state, and audit.
Accepting the temporary password transactionally advances `invited` to
`enrollment_required` before creating the restricted session. Activation remains
the Milestone 06 permanent-password plus confirmed-TOTP transaction.

Profile updates compare individual normalized fields. Name-only changes increment
resource version and audit but do not change security epoch. Email changes
increment the epoch, revoke browser/restricted sessions, record durable
invalidation, and preserve all current authenticators. Duplicate normalized
email fails atomically.

Suspension retains password/TOTP material, increments the epoch, revokes sessions,
and blocks authentication. Reactivation from `suspended` returns to `active`
without changing authenticators. Deactivation deletes password, TOTP, temporary
and pending enrollment material; sets authenticator state to
`disabled/disabled`; increments the epoch; revokes state; and records durable
invalidation.

Restoring a deactivated local identity generates a new one-time temporary
password, changes status to `enrollment_required`, sets
`temporary/not_configured`, and requires the full initial enrollment ceremony.
UUID, role, profile, and provider links remain. It never accepts an
operator-selected password or returns a TOTP seed.

Role changes are available only to an interactive superadmin. They support
`user`/`admin` changes and explicit promotion/demotion involving an existing
superadmin; invitation never creates a superadmin. Future `system` API authority
remains limited to `user`/`admin`.
Every path that would remove the final active superadmin—role change, suspension,
deactivation, or a concurrent combination—counts and updates in the same
immediate transaction. Permanent deletion requires `deactivated`, permits only
`user` or `admin`, and explicitly removes the singleton bootstrap marker when it
points at the target before deleting the user.

Current user-owned operational tables all use `ON DELETE CASCADE` except the
bootstrap marker, which is explicitly removed. Deletion tests inventory external
identities, authenticator state/password/TOTP, accepted steps, browser sessions,
step-up proofs, temporary/restricted/pending enrollment, invalidation events,
and the bootstrap marker. Future user-owned tables must use cascade or extend
this inventory before deletion is enabled. Administrative audit has no live user
foreign key and retains denormalized actor/target labels, role/status before/after
changes, justification, affected service UUIDs, and invalidation counts.

## UI contract

The Users view has bounded search/filter controls, a responsive table/card
projection, explicit state/role labels, invitation action for authorized roles,
detail edit forms, and confirmation dialogs for destructive lifecycle actions.
The Profile view lets every signed-in human edit only their own email and names
and links to the Milestone 06 security actions.

The UI never places passwords/TOTP/temporary values in URLs, persistent browser
storage, analytics, or error text. A one-time temporary password appears in a
dedicated live-region result with a copy affordance and an explicit
"cannot be shown again" warning. Narrow layouts retain 44px targets, labelled
fields, keyboard order, focus transfer, and no horizontal page overflow.
Server authorization is authoritative even when actions are hidden.

## Slice 1: policy, authorized reads, cursors, and self profile

Outcome: table-driven user policy, fail-closed relationship hook, scoped list and
detail projections, signed pagination/search, self profile endpoints, correct
email-only invalidation, and transactional audit.

Positive tests cover all human self profiles, superadmin list/detail, search,
filters, pagination, name-only edit, and email edit. Negative/boundary tests
cover user/admin cross-account access, unavailable relationships, hidden roles,
duplicate normalized email, malformed/cross-scope/expired cursors, limits,
stale versions, changed actor role/session/epoch, and secret-column absence.

Commit: `Add authorized user profiles`.

## Slice 2: invitations, resets, and lifecycle

Outcome: atomic local invitations, invited-to-enrollment handoff, guarded
password/TOTP reset routes, suspension/reactivation, deactivation, enrollment
restoration, role changes, and durable invalidation.

Positive tests cover user/admin/superadmin invitation authority, one-time
temporary responses, reset preservation/erasure semantics, each legal state
transition, all role changes, and immutable UUID/profile preservation. Negative
tests cover missing justification/step-up, admin self/unrelated/admin targets,
API-role placeholders, illegal state/role changes, stale/idempotency conflicts,
wrong-target proof, rollback, and secret absence.

Commit: `Add guarded user lifecycle administration`.

## Slice 3: permanent deletion and user/profile UX

Outcome: deactivated ordinary/admin deletion with complete operational cleanup
and retained audit evidence, plus functional responsive Users/Profile views.

Positive tests inventory every current user-owned row before/after deletion,
verify historical audit readability, exercise UI list/detail/invite/profile/
lifecycle states, and test narrow/wide keyboard behavior. Negative tests cover
active/suspended/enrollment-required deletion, every superadmin deletion,
last-superadmin races, stale/concurrent deletion, unauthorized UI/API access,
and prohibited material in rendered output/logs/audit.

Commit: `Complete user administration lifecycle`.

## Slice 4: documentation and acceptance

Outcome: role/lifecycle operator guidance, endpoint/OpenAPI documentation,
Milestone 07 acceptance audit, and status update.

Acceptance runs production build, focused identity/policy/cursor/control/UI/
deletion/documentation tests, generated OpenAPI consistency, `git diff --check`,
and the unchanged full suite with required listener permission.

Commit: `Document user administration lifecycle`.

## Later-milestone handoff

Milestones 09–10 supply service and relationship persistence to activate the
admin-scoped hook without changing endpoint schemas. Milestones 13–15 attach
runtime references and OAuth grant consumers to durable invalidation. Milestone
16 adds API-key authentication to the already table-driven policy; it must keep
superadmin hard denials and cannot claim human step-up.
