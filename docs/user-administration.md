# User Administration

SecretSauce exposes local user and profile administration on the control
listener under `/api/v2`. The browser UI is served at `/control/users` and each
signed-in human can edit their own profile at `/control/profile`.

This administration surface is separate from MCP authentication. Browser
session cookies are accepted only by the control listener and never authorize
`/mcp`.

## Roles and visibility

- A user can read and edit only their own profile.
- A superadmin can list and manage users, admins, and superadmins, subject to
  lifecycle and last-active-superadmin protections.
- An admin can invite ordinary users and can view or manage only related
  ordinary users. Service relationships are introduced in Milestones 09–10, so
  the current production relationship resolver fails closed and returns no
  admin-visible directory records.
- API roles do not acquire human superadmin authority and cannot satisfy browser
  step-up.

The user directory is an authorized projection. It contains profile, role,
status, authenticator-state labels, version, and timestamps; it never contains
password hashes, TOTP envelopes, session values, step-up proofs, provider
subjects, or invalidation payloads. Search is bounded and pagination cursors are
signed, expire after 15 minutes, and are bound to the viewer, role, relationship
scope, and filters.

## Profile and lifecycle operations

The API supports:

- `GET` and `PATCH /api/v2/auth/self/profile`
- `GET /api/v2/users` and `GET /api/v2/users/{user_id}`
- `POST /api/v2/users` for local invitation
- `PATCH /api/v2/users/{user_id}/profile`
- password and TOTP reset actions
- suspension, reactivation, deactivation, and enrollment restoration
- role changes
- permanent deletion of an eligible deactivated user or admin

Use the generated contract at `/api/v2/openapi.json` for exact schemas. Mutable
resource requests require the current strong `ETag` in `If-Match`. Invitation,
password reset, TOTP reset, and enrollment restoration additionally require an
`Idempotency-Key`. Retrying a successful one-time operation never displays its
temporary password again.

Sensitive actions require a bounded justification and the configured browser
step-up. In `five_minutes` mode, complete step-up before retrying the action. In
`always` mode, the proof is bound to the exact method, route, target, version,
idempotency key, and body digest, then consumed in the same transaction as the
mutation and audit event. Fetch a fresh rotating CSRF proof from
`GET /api/v2/auth/session` for each browser mutation.

## State effects

Invitation creates a local `invited` identity and displays a generated temporary
password once. Successful temporary authentication advances the identity to
`enrollment_required`; activation still requires a permanent password and
confirmed TOTP.

Suspension retains password and TOTP material but prevents normal login.
Reactivation of a suspended account returns it to `active`. Deactivation erases
password, TOTP, temporary, and pending enrollment material; revokes sessions;
increments the security epoch; and records durable invalidation. Restoring a
deactivated account generates a new one-time temporary password and requires
the complete initial enrollment ceremony.

Changing an email address increments the target security epoch and revokes its
sessions and durable references. Name-only profile edits do not invalidate
authentication. Removing a future service membership does not change account
status; only an explicit lifecycle action or configured automation may do so.

Every sensitive success, denial, and contract/domain failure writes a sanitized
administrative audit event with safe actor and target snapshots. Request bodies,
credentials, cookies, opaque values, and downstream response bodies are never
recorded. Auditing is required for the operation; an audit persistence failure
does not permit the sensitive mutation to proceed.

## Permanent deletion

Permanent deletion is limited to an interactive superadmin and only a
`deactivated` user or admin. A superadmin identity can never be permanently
deleted. Deletion removes the identity, profile, provider links,
authenticator/session/enrollment rows, invalidation rows, and bootstrap marker;
it creates no tombstone.

The deletion audit is committed as a self-contained event before the live
identity relation disappears and remains queryable afterward. Before adding a
new user-owned operational table, configure `ON DELETE CASCADE` or extend the
deletion dependency inventory and its integration test. Operators should export
or retain audit evidence according to policy before deleting an account.

## Concurrency and recovery

Role changes, suspension, and deactivation re-read actor, target, version,
status, role, and relationship inputs inside an immediate database transaction.
The last active superadmin check and mutation occur under the same write lock, so
concurrent paths cannot remove the final active superadmin.

A stale `If-Match` returns `stale_version`; refresh the user record and reassess
the operation. Do not blindly replay a destructive request with a new version.
For host-local recovery when no active superadmin can sign in, use the
argument-free break-glass command documented in
[Local Browser Authentication](local-authentication.md).
