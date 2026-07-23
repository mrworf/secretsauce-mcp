# Milestone 10 Implementation Plan: Groups And Assignments

## Scope review

Milestone 10 adds service-scoped groups, ordinary-user membership, and the
principal-selector representation used to grant service access. It activates
the fail-closed related-user seam introduced in Milestone 07 and emits durable
assignment invalidation for Milestone 13.

The work remains control-plane only. It does not make database services
routable, start MCP OAuth, create credentials or policies, synchronize external
groups, nest groups, deactivate accounts, or add service-specific tools/profile
packs. Published service configuration remains separate from authorization
assignments: changing membership never rewrites an immutable service revision.

## Persistent model and limits

Migration `0009` adds:

- `service_groups`: immutable UUIDv7, service UUID, trimmed name, normalized
  case-folded name unique within the service, optional bounded description,
  `active|archived` lifecycle, positive version, and timestamps;
- `service_group_members`: service UUID, group UUID, ordinary-user UUID, actor
  snapshot, and timestamp, unique by `(group_id,user_id)`. The redundant
  `service_id` supports service-first indexes and is checked transactionally
  against the group;
- `service_principal_assignments`: one normalized service selector row of kind
  `all`, `group`, or `user`. Exactly one matching target is present for explicit
  selectors and neither target is present for `all`; partial unique indexes
  prevent duplicate rows and more than one `all`;
- `service_assignment_states`: one row per service with a positive optimistic
  concurrency version and non-negative authorization generation; and
- `assignment_invalidation_events`: durable, service-scoped events with an
  optional affected ordinary-user UUID, new generation, bounded reason, and
  dispatch state. It intentionally survives user removal only where its safe
  denormalized UUID is still useful and cascades with service deletion.

Domain transactions recheck user role/status, group lifecycle, service scope,
and selector shape because SQLite checks cannot safely express cross-table
invariants. Every child query and index begins with `service_id` where
applicable. User deletion cascades membership and direct assignments. Service
deletion cascades the new authorization domain and extends the explicit deletion
inventory test.

Initial limits are 200 groups per service, 1,000 retained members per group,
1,000 explicit selectors per service, 200 IDs per mutation, and 200 results per
page. These bounds cover the PRD target of 1,000 users and 500 services without
introducing a distributed store.

## Reusable selector contract

A shared pure module defines:

```text
{ kind: "all" }
{ kind: "groups", group_ids: [UUID, ...] }
{ kind: "users", user_ids: [UUID, ...], direct_assignment_confirmed: true }
{ kind: "principals", group_ids: [UUID, ...],
  user_ids: [UUID, ...], direct_assignment_confirmed: true }
```

Inputs are closed, sorted, de-duplicated, and normalized to rows. Explicit
group/user arrays must be non-empty. Omission is accepted only on service
creation/import boundaries that explicitly label the default as `all`; ordinary
assignment replacement always requires a selector. `all` cannot be combined
with explicit targets.

Direct user selectors require `direct_assignment_confirmed: true`; their API
schema and browser editor display the group-preference warning. Only active
ordinary-user UUIDs may be direct targets or group members. Group selectors
must reference active groups owned by the same service. The normalized module
is independent of service storage so Milestones 11 and 12 can reuse it for
credential and policy boundaries.

## Group lifecycle and membership

Assigned admins and superadmins may create, list, read, update, archive, and
delete groups within visible services:

- create is idempotent and starts active;
- name/description update requires the group's current ETag;
- membership replacement is an atomic set operation requiring the current group
  ETag and an idempotency key;
- duplicate input UUIDs are rejected rather than silently hidden;
- archive requires justification and idempotency, removes the group from the
  service selector in the same transaction, preserves its member rows for
  inspection, and makes membership-derived access disappear immediately;
- archived groups cannot be edited or receive membership changes; and
- permanent deletion is allowed only for an archived group, requires its ETag,
  justification, and idempotency, and cascades retained memberships.

The membership replacement response identifies safe added/removed UUIDs and
the new version. Replays return the same group reference without reapplying
changes. Concurrent writers cannot merge silently.

Each mutation re-reads the caller's live service administration, service/group
lifecycle, version, and all target users before changing rows. Cross-service
group references, non-user roles, inactive accounts, over-capacity batches, and
unassigned admins fail before any write.

## Service assignments and effective access

`GET|PUT /api/v2/services/{service_id}/assignments` reads or atomically replaces
the normalized selector. Replacement requires the assignment-state ETag and an
idempotency key. It rejects an archived service, empty explicit selection,
cross-service groups, ineligible users, direct targets without confirmation,
and stale versions.

Effective access is calculated from live state, never a cached denormalized
membership:

- `all` contributes only for an active ordinary user;
- a direct selector contributes `direct`;
- every active selected group containing the user contributes a separate
  `group` item;
- archived groups and suspended, invited, enrollment-required, deactivated,
  admin, and superadmin accounts contribute nothing.

`GET /api/v2/services/{service_id}/access` gives authorized administrators a
bounded user-oriented projection with contribution kinds and safe group
UUID/name pairs. `GET /api/v2/users/me/services` returns only the active service
UUID, slug, and name for the current ordinary user. It does not expose
destinations, administrators, selector structure, other users, or drafts.

Removing the last contribution changes only assignment state and invalidation;
the user's account status, authenticators, self-service browser session, and
unrelated service access remain intact.

## Authorization, related users, and invalidation

The existing `ServiceRelationshipRepository` is extended rather than replaced:

- actor-only queries still return services a live admin manages;
- actor-plus-target queries intersect those services with the target ordinary
  user's current effective assignments;
- superadmin user-directory behavior remains global; and
- admin directory/detail/profile/lifecycle operations use the intersection and
  return not-found-equivalent denial outside it.

The user repository gains an explicit service-ID filter for admin lists. It
does not fetch all users and filter in application memory. Cursor scope already
binds the sorted live service-ID set, so assignment changes invalidate stale
admin cursors without revealing new relationships.

Every selector replacement, effective membership addition/removal, group
archive, and group deletion increments the service authorization generation.
The same transaction inserts:

- one service-scoped invalidation event; and
- targeted user events for directly or effectively changed users, capped by the
  1,000-user installation limit.

Audit changes contain only service/group/user UUIDs, selector kinds, lifecycle,
counts, and sorted before/after membership IDs. They contain no profiles,
emails, request bodies, credentials, cookies, Authorization headers, opaque
references, or downstream responses.

## Management API and browser workspace

Browser routes are:

- `GET|POST /api/v2/services/{service_id}/groups`;
- `GET|PATCH|DELETE /api/v2/services/{service_id}/groups/{group_id}`;
- `PUT /api/v2/services/{service_id}/groups/{group_id}/members`;
- `GET|PUT /api/v2/services/{service_id}/assignments`;
- `GET /api/v2/services/{service_id}/access`; and
- `GET /api/v2/users/me/services`.

All schemas are strict and bounded. Reads are `no-store`; mutable group and
assignment resources return strong ETags. Creates, set replacement, archive,
and delete use existing idempotency storage. Service scope is checked before
group, user, or selector existence so cross-scope requests do not disclose
targets.

The `/control/groups` workspace is service-first and permission-filtered. It
supports service selection, responsive group cards/table, create/edit/archive,
membership replacement, and an access editor that recommends groups before a
visually separated direct-user exception. The effective-access view explains
`all`, direct, and every contributing group. Narrow layouts preserve group
identity, lifecycle, member count, assignment state, and actions.

The ordinary-user profile/access area shows only currently effective service
names. UI state remains in component memory and never places user lists or
assignment documents in URLs, browser storage, diagnostics, or logs.

## Implementation slices

1. Add migration `0009`, pure selector normalization/evaluation, group and
   assignment repository transactions, invalidation/audit, and positive,
   negative, boundary, concurrency, cascade, and scale tests.
2. Register strict routes/OpenAPI, wire production authorization, effective
   access and own-service views, activate admin-related user queries, and test
   every scope and discovery denial.
3. Build the responsive Groups/Access workspace and ordinary-user service-name
   view with group-first direct-assignment confirmation and component/API tests.
4. Document group guidance and runtime isolation, run focused checks, generated
   OpenAPI consistency, production build, the full regression suite, record
   acceptance, and mark the milestone complete.

Each slice includes positive and negative tests, a full-suite regression run,
failure repair, review of secret-safe audit/log output, and one concise commit.

## Review gates

- No request can resolve a target user/group before service authorization.
- `all` can never include a non-active ordinary user or administrative identity.
- Group scope is revalidated for membership and every selector consumer.
- Direct assignment cannot pass without explicit confirmation.
- Empty explicit selectors and duplicate IDs are rejected.
- Removing access cannot mutate account lifecycle or unrelated assignments.
- Archive/delete and concurrent replacement cannot leave effective access or
  invalidation generation out of sync.
- Admin-related user reads use current database relationships and remain
  not-found-equivalent across service boundaries.
- Published service documents and YAML runtime authority remain unchanged.
- New external inputs have positive and negative tests; audit/log/response
  projections contain no prohibited sensitive material.
