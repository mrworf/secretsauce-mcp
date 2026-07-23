# Service Management

SecretSauce exposes durable service administration on the control listener under
`/api/v2/services`. The responsive browser workspace is served at
`/control/services`.

Database-managed services are control-plane records only in Milestone 09. They
do not alter the YAML-backed MCP registry or become routable merely because they
are published. Milestone 13 owns that activation boundary.

## Authority and visibility

- A superadmin can create, clone, assign or remove administrators, archive, and
  permanently delete services.
- An admin can see and configure only services with a current
  `service_admins` assignment.
- Assigned admins can edit profiles and destinations, validate, publish,
  inspect history, roll back, copy, and import. They cannot transfer their
  administrative authority.
- Ordinary users, API roles, and system principals cannot administer service
  configuration.

Authorization is re-read from persistence in each domain transaction. An
unassigned or cross-service request returns a not-found-equivalent result rather
than disclosing whether the target exists. Browser navigation is role-filtered,
but server authorization remains authoritative.

## Lifecycle

Every service has an immutable UUIDv7 identifier, stable unique lowercase slug,
and one mutable draft:

1. `draft` is incomplete or unpublished and never routable.
2. `published` points to one immutable validated revision. Further edits change
   only the draft and expose an unpublished-changes state.
3. `archived` clears publication intent, advances the publication generation,
   and prevents further draft edits or publication.

Publishing requires at least one active assigned administrator and one complete
destination. It rejects an archived service, an unchanged already-published
draft, and stale aggregate versions. Success atomically appends the canonical
revision, advances the aggregate version and publication generation, emits an
invalidation event, and records sanitized audit evidence.

Publication does not probe the network and is not a downstream health check.
The UI and API intentionally describe database configuration as inactive until
runtime activation is implemented.

## Destination rules

A service has at most 64 destinations. Each destination contains a stable slug,
canonical absolute base URL, one or two allowed schemes, one to 32 host
matchers, one to 32 allowed ports, and an explicit TLS verification choice.

Validation rejects:

- schemes other than HTTP or HTTPS;
- user information, query strings, fragments, backslashes, NUL, malformed
  escapes, and percent encodings that can change routing semantics;
- a base scheme, hostname, or effective port outside its corresponding allow
  list;
- invalid IDNA hosts, IP suffix matchers, broad or unanchored regular
  expressions, and unsupported non-linear regular-expression constructs;
- duplicate or out-of-bound fields and incomplete destinations.

Private and loopback destinations remain valid for homelab deployments.
`tls_verify: false` remains explicit and produces a publication warning; the
control plane does not silently change it. Runtime authorization, destination
validation, and policy must still precede future credential resolution and
downstream I/O.

## Concurrency and request contracts

Use the generated contract at `/api/v2/openapi.json` for exact closed schemas.
Service reads are `no-store`. Mutable resources return a strong `ETag`; send
that value in `If-Match` for profile, destination, ownership, publication,
import, rollback, archive, and deletion operations. A stale write returns
`stale_version` and never overwrites a newer draft.

Creation, clone, rollback, archive, and deletion require an
`Idempotency-Key`. A successful replay returns only the same safe resource or
result reference. Reusing a key with different inputs returns
`idempotency_conflict`.

The principal routes are:

- `GET|POST /api/v2/services`
- `GET|PATCH|DELETE /api/v2/services/{service_id}`
- `GET /api/v2/services/{service_id}/admins`
- `PUT|DELETE /api/v2/services/{service_id}/admins/{user_id}`
- destination create, update, and delete routes below the service
- `POST /validate` and `POST /publish`
- `GET /revisions` and `POST /revisions/{revision_id}/rollback`
- `GET /copy`, `POST /import`, and `POST /clone`
- `POST /archive`

Administrator removal, rollback, archive, and permanent deletion require a
bounded explicit justification.

## Immutable history and rollback

A publication creates one canonical JSON revision with its digest, sequence,
publication generation, actor role, and timestamp. History is capped at 100
retained revisions and 400 days. Expired non-current revisions may be pruned
inside publication, but the current published revision is never pruned.

Rollback does not move the publication pointer backward. It verifies and
restores a retained canonical document, replaces the mutable profile and
destinations, and immediately appends a new published revision whose
`source_revision_id` identifies the selected history entry. The history remains
append-only.

History projections never return actor principal IDs, stored documents, or raw
audit records.

## Safe copy, import, and clone

The version-1 transfer document contains only:

- service slug, name, optional description, and optional documentation URL;
- destination UUID, slug, canonical base URL, allowed schemes, host matchers,
  ports, and TLS verification.

It excludes credentials, credential values or sources, principals,
administrator assignments, groups, policies, revisions, audit data, sessions,
grants, API keys, opaque references, OAuth state, deployment paths, and runtime
state.

Copy returns that canonical document. Import accepts the same strict document
for the same stable service slug and updates only the draft. Existing
destination UUIDs are preserved only when already owned by the target service;
cross-service IDs are rejected and new entries receive gateway-owned UUIDs.

Clone is superadmin-only. It creates a new isolated draft with a new service UUID
and new destination UUIDs, while copying only the safe profile and destination
configuration. It copies no ownership or history. The browser does not place
copy/import text in local storage, session storage, URLs, diagnostics, or logs.

## Archive and permanent deletion

Archive accepts a draft or published service, clears current publication
intent, advances generation and version, and emits an invalidation while
retaining history. It is idempotent only through its idempotency record.

Permanent deletion requires all of the following:

- an interactive superadmin browser session;
- an archived service with zero assigned administrators;
- the current aggregate version;
- an explicit justification and idempotency key;
- fresh password and TOTP verification for an operation-bound one-time proof.

The proof is bound to the exact delete method, route, service UUID, version,
idempotency key, and body digest, then consumed in the same transaction as the
mutation and audit. A route-level one-time requirement overrides a configured
five-minute default for this exact operation.

Deletion cascades the live service, destination, and revision rows. Its
denormalized administrative audit event and final invalidation event survive.
Future service-owned dependency tables must extend the deletion inventory
before deletion can remain enabled.

## Operating and troubleshooting

- `stale_version`: refresh the current service version, review the change, and
  reapply retained non-secret edits. Do not blindly overwrite it.
- `service_conflict` during publication: validate the current draft and check
  active ownership, destinations, unchanged publication, and retained-history
  capacity.
- `service_conflict` during administrator removal: a non-archived service must
  retain at least one administrator after its first assignment.
- `service_conflict` during deletion: archive the service and remove every
  administrator first.
- `step_up_required`: perform fresh password and TOTP verification for the exact
  deletion request. A proof cannot be reused or moved to another target.
- `not_found`: the service, destination, revision, administrator, or caller
  scope is absent; the response intentionally does not distinguish them.

Service audit events contain safe UUIDs, slugs, lifecycle states, counts,
generations, and bounded changes. They do not contain configuration documents,
URLs, host regular expressions, request bodies, credentials, cookies,
Authorization headers, opaque references, or downstream response bodies.
