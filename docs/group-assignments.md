# Groups And Service Assignments

SecretSauce uses service-scoped groups as the normal way to grant ordinary
users access to a service. A group belongs to exactly one service and cannot be
selected by another service. There are no global groups, nested groups, dynamic
membership rules, or external directory synchronization.

Database-managed assignments are control-plane state until persisted runtime
authorization is delivered. They do not make a database service routable by
the current YAML-backed MCP gateway.

## Roles and scope

- A `superadmin` can manage groups and assignments for every visible service.
- An `admin` can manage them only for services where that admin has a current
  service-administrator assignment.
- An ordinary `user` cannot inspect group membership or selector structure.
  The Profile page shows only the UUID, slug, and name projection of services
  the current user can access.

Cross-service and unassigned-admin requests return a not-found-equivalent
response. Authorization is re-read for every request and mutation.

## Principal selectors

Each service has one normalized selector:

- `all` includes every active ordinary user;
- one or more active service groups includes their active ordinary-user
  members; or
- one or more ordinary-user UUIDs creates direct-user exceptions.

Groups and direct-user exceptions can be combined. Explicit selectors cannot
be empty. `all` is an explicit choice and cannot be combined with other
principals. It never includes admins, superadmins, API keys, anonymous
identities, or invited, enrollment-required, suspended, or deactivated users.

Prefer groups. The browser keeps direct-user exceptions in a separate warning
panel and will not save them until the administrator explicitly confirms the
exception. The `all` option is similarly conspicuous because it is broader than
named assignments.

Effective access is calculated from current state and reports every
contribution independently:

- `Included through all users`;
- `Direct-user exception`; and
- `Member of <group name>` for each selected active group containing the user.

Groups have no order or precedence.

## Group lifecycle and concurrency

Groups start `active`. Their profile and complete membership set can be
replaced by an authorized administrator. Every mutable group and service
selector has a strong version; stale changes fail rather than merging.
Set-replacement, creation, archive, deletion, and assignment replacement are
idempotent.

Archiving a group requires justification, immediately removes it from the
service selector, and preserves its membership for inspection. Archived groups
cannot be edited. Permanent deletion is available only after archive and also
requires justification.

Membership accepts only active ordinary-user UUIDs. Duplicate UUIDs,
cross-service groups, privileged identities, inactive users, malformed input,
and bounded-limit violations are rejected before changes are written.

## Revocation and account state

Assignment and effective-membership changes increment the service
authorization generation and write durable service-scoped invalidation events.
Affected users receive targeted invalidation entries. The persisted runtime
milestone consumes these events; the control plane does not deactivate an
account or rewrite immutable service publications.

Removing a user's final service contribution leaves that identity active. The
user can continue to authenticate and use self-service account functions, but
has no assigned service and will be MCP-ineligible once persisted runtime
authorization becomes authoritative.

## Audit and browser handling

Group and assignment mutations write administrative audit events in the same
transaction. Records contain service, group, and user UUIDs, selector kinds,
counts, lifecycle, sorted membership changes, and required justifications.
They do not contain user profiles, credentials, cookies, Authorization headers,
opaque references, request bodies, or downstream responses.

The browser obtains only the related active users allowed by the existing user
directory scope. Group, membership, selector, and effective-access state stays
in component memory; it is not written to local storage, session storage, URLs,
or diagnostics.

## Management endpoints

The authenticated browser API provides:

- `GET|POST /api/v2/services/{service_id}/groups`
- `GET|PATCH|DELETE /api/v2/services/{service_id}/groups/{group_id}`
- `GET|PUT /api/v2/services/{service_id}/groups/{group_id}/members`
- `POST /api/v2/services/{service_id}/groups/{group_id}/archive`
- `GET|PUT /api/v2/services/{service_id}/assignments`
- `GET /api/v2/services/{service_id}/access`
- `GET /api/v2/users/me/services`

All request shapes are closed and bounded, reads are `no-store`, and mutations
apply CSRF, version, idempotency, scope, and audit controls declared by the
central control-plane route registry.
