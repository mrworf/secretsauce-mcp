# Milestone 09 Implementation Plan: Service Management

## Scope review

Milestone 09 adds durable control-plane services, destinations, administrative
ownership, immutable publication history, and responsive service editing. It
also activates the service-admin relationship seam created in Milestone 07.

The database-managed service domain remains isolated from the YAML-backed MCP
registry. No draft or published database service is routable until Milestone 13
explicitly changes runtime authority. Groups, ordinary-user assignments,
credentials, policy rules, API keys, OAuth grants, active references, and
service-specific tools/profile packs are excluded.

The implementation uses the approved persistence worker, transactional
administrative audit, central permission matrix, route registry/OpenAPI,
browser sessions, step-up, idempotency, optimistic concurrency, UUIDv7 IDs, and
responsive React shell. No ORM, alternate validator, or parallel authorization
framework is added.

## Persistent model and limits

Migration `0008` adds:

- `services`: immutable UUIDv7 and stable unique lowercase slug; bounded name,
  optional description and HTTPS documentation URL; lifecycle
  `draft|published|archived`; current mutable-draft digest, nullable published
  revision UUID/digest, monotonically increasing publication generation,
  positive aggregate version, and timestamps;
- `service_destinations`: UUIDv7, service FK, stable destination slug, canonical
  base URL, normalized allowed schemes/host matchers/ports, TLS verification,
  positive row version, timestamps, and uniqueness by `(service_id, slug)`;
- `service_admins`: unique service/admin UUID pair with timestamps and creator
  snapshot. The referenced user must currently be role `admin`; domain
  transactions recheck that invariant because SQLite cannot express it in a
  foreign-key check;
- `service_config_versions`: immutable UUIDv7, service FK, per-service sequence,
  canonical secret-free JSON, SHA-256 digest, source revision UUID for rollback
  lineage, publication generation, actor UUID/role snapshot, and publication
  time. Sequence and digest indexes support bounded history;
- `service_invalidation_events`: UUIDv7, denormalized service UUID, generation,
  bounded reason `publication|rollback|archive|delete`, creation/dispatch state,
  and attempt count. It intentionally has no live service FK so a delete event
  survives permanent service deletion.

Every service child index begins with `service_id`. Published revision IDs
reference the same service in transaction-level validation. Destination and
revision rows cascade when the live service is permanently deleted; immutable
administrative audit and the final delete invalidation remain.

Initial limits are closed constants: 1,000 services, 64 destinations per
service, 100 retained revisions per service, and 400 days of revision
retention. The current published revision is never pruned. A publish rejects at
capacity unless expired non-current revisions can be pruned in the same
transaction. Lists are capped at 200 and use signed 15-minute keyset cursors.

## Draft and publication contract

The normalized `services` plus `service_destinations` rows are the one mutable
draft. Service profile and destination writes require `If-Match` against the
service aggregate version and increment that version. The slug never changes.
Draft edits never change the published revision, publication generation, or
runtime state. Detail projections expose whether the canonical draft digest
matches the published digest.

A canonical version-1 document contains only:

- service slug, name, description, and documentation URL;
- destinations with immutable IDs and slugs, canonical base URLs, normalized
  schemes, host matcher type/value, ports, and TLS verification.

Object keys and arrays use deterministic ordering before canonical JSON and
SHA-256. The document has no admins, users, groups, credentials, policies,
secret/value/source fields, sessions, grants, API keys, references, OAuth
state, audit, deployment paths, or runtime state.

Validation is pure and used by preview, publish, import, clone, and rollback.
Publishing re-reads authorization, service state, target version, draft rows,
and admin ownership in one immediate transaction. It requires a non-archived
service, at least one active assigned admin, and at least one complete
destination. Success creates an immutable revision, updates
`published_revision_id` and digest, changes lifecycle to `published`, advances
publication generation and aggregate version, inserts invalidation, and writes
the success audit atomically. Validation failure leaves the draft unchanged and
non-routable and records only a sanitized denied validation audit.

Publishing an unchanged canonical draft is rejected as a conflict rather than
creating redundant history. Concurrent publishers cannot share a version.

## Destination validation

A reusable pure database-service validator is extracted beside the existing
YAML destination normalization. It produces the same `DestinationConfig` shape
consumed by `resolveDestinationTarget`, while accepting only closed management
documents.

Destination slugs use the service-slug grammar. Base URLs:

- use only `http` or `https`;
- are absolute, canonical, and contain no user information, query, or fragment;
- have a normalized IDNA hostname and explicit/effective port from 1–65535;
- reject backslashes, NUL, invalid escapes, and percent encodings that can
  change routing semantics;
- preserve a canonical normalized base path.

Schemes are unique and must contain the base scheme. Ports are unique and must
contain the base port. One to 32 host matchers are required. Exact and suffix
hosts normalize through IDNA; suffixes cannot be IP literals. Regexes are
bounded, compile successfully, and reject known match-all/broad forms rather
than merely warning. The base host must match at least one matcher.

`tls.verify: false` remains supported and produces a safe publication warning;
it is not silently changed. Private and loopback destinations remain valid
because homelab/internal HTTP APIs are an intended downstream use case. Runtime
authentication, policy, and destination checks still precede future credential
resolution.

## Authorization and ownership

`ServiceRelationshipRepository` implements service scope and the actor-only
portion of the existing user relationship resolver:

- superadmins see/configure all services;
- an admin sees/configures only services with a live `service_admins` row;
- assigned-admin access is re-read in every service transaction;
- an admin cannot create, clone into a new service, assign/remove admins,
  archive, or delete;
- users and system principals cannot access service configuration;
- API-role behavior remains unavailable until Milestone 16 supplies
  authentication, but route contracts preserve the matrix outcomes.

Actor-only relationship queries return the services an admin manages, enabling
assigned-service invitation entry points. Target-specific related-user queries
remain empty until Milestone 10 supplies direct/group membership; profile and
lifecycle access therefore stays fail-closed rather than inventing membership.

The central `UserManagementAuthorization` delegates service outcomes to a new
`ServiceManagementAuthorization`. It extracts only canonical route parameters,
returns not-found-equivalent scope denial for unassigned/cross-service access,
and retains the existing browser step-up delegate.

Only a superadmin creates a service. Creation is idempotent, starts as
non-routable `draft`, and contains no implicit admin assignment. Superadmins add
or remove active `admin` users with service-version concurrency. A
non-archived service must retain at least one assigned admin after its first
assignment; an archived service may remove the final admin before deletion.
Admins cannot transfer their authority.

## API and concurrency contract

Browser routes are:

- `GET /api/v2/services` and `GET /api/v2/services/{service_id}`;
- `POST /api/v2/services` for idempotent superadmin creation;
- `PATCH /api/v2/services/{service_id}` for draft profile edits;
- `GET /api/v2/services/{service_id}/admins`;
- `PUT|DELETE /api/v2/services/{service_id}/admins/{user_id}`;
- `POST /api/v2/services/{service_id}/destinations`;
- `PATCH|DELETE /api/v2/services/{service_id}/destinations/{destination_id}`;
- `POST /api/v2/services/{service_id}/validate`;
- `POST /api/v2/services/{service_id}/publish`;
- `GET /api/v2/services/{service_id}/revisions`;
- `POST /api/v2/services/{service_id}/revisions/{revision_id}/rollback`;
- `GET /api/v2/services/{service_id}/copy`;
- `POST /api/v2/services/{service_id}/import`;
- `POST /api/v2/services/{service_id}/clone`;
- `POST /api/v2/services/{service_id}/archive`;
- `DELETE /api/v2/services/{service_id}`.

All schemas are strict and bounded. Reads are no-store and mutable details carry
strong service ETags. Every mutation after create requires `If-Match`. Create,
clone, rollback, archive, and delete require `Idempotency-Key`; replay returns
only the same safe resource/result reference. Same-key/different-digest returns
`409`.

Create and clone require `create_service`; detail/history/copy require
`view_service_configuration`; draft/destination/validate/publish/import/rollback
require `configure_service`; assignment requires `assign_service_admin`;
archive requires `archive_service`; delete requires
`permanently_delete_service` and configured human step-up. Archive, rollback,
admin removal, and delete require bounded justification. Transaction-bound
proofs are consumed atomically with mutation, invalidation, idempotency, and
audit.

## History, rollback, copy, clone, archive, and delete

History returns bounded sequence, revision UUID, digest, generation, actor role,
publication time, and rollback lineage. It never returns principal IDs beyond
the authorized actor label, raw audit data, or excluded domains.

Rollback validates a retained revision, replaces the mutable service profile
and destination rows from that document, and immediately publishes a new
revision with a new UUID/sequence/generation and `source_revision_id` pointing
to the selected historical revision. History therefore remains append-only and
the current publication is never moved backward.

Copy returns the strict canonical version-1 non-secret document. Import accepts
that same typed document for the same service slug, preserves existing
destination UUIDs only when they belong to the target, allocates new UUIDs for
new entries, and rejects all unknown fields. It updates only the draft.

Clone is superadmin-only because it creates a service. It accepts a new unique
slug/name and copies the source's safe draft configuration into a new draft
with new service and destination UUIDs. It copies no admin assignments,
credentials, principals, policies, revisions, audit, invalidation, session,
grant, key, reference, OAuth, deployment, or runtime state.

Archive requires a published or draft service, sets lifecycle `archived`,
clears publication intent while retaining history, advances generation/version,
and emits invalidation. It is idempotent only through the central idempotency
record. Permanent delete requires archived state, zero service admins, current
version, explicit justification, and human step-up. Future dependency tables
must extend the same transaction's dependency inventory; M09 currently permits
only owned destinations/history. Delete emits a surviving invalidation and
denormalized audit before removing the service.

## Audit, status, and failure behavior

Create, assignment, draft edit, destination change, validation, publication,
rollback, import, clone, archive, and delete produce sanitized administrative
events. Changes contain UUIDs, safe slugs/names, lifecycle, counts, digest
prefix-free equality state, TLS verification state, and generations—not full
configuration documents, URLs, host regexes, request bodies, or excluded
material. Denied/error sensitive actions use stable failure categories.

Service list/detail status includes lifecycle, draft/published equality,
publication generation, destination count, admin count, current revision
metadata, and bounded validation issue codes/JSON pointers. It performs no
network probe and does not claim runtime activation. Health continues to expose
only sanitized persistence readiness; the Overview service card explicitly
labels database configuration as inactive until Milestone 13.

## UI contract

The Services navigation becomes permission-filtered but server authorization
remains authoritative. Desktop uses section navigation plus a wide
editor/validation pane; narrow screens use ordered labeled cards without
horizontal page overflow.

The editor provides basics, destination rows, canonical previews, explicit
TLS-disabled warnings, draft dirty state, validation summary, publish, history,
rollback, safe copy/import, clone, admin assignment, archive, and delete
according to role. Stale responses preserve non-secret edits and prompt refresh;
destructive confirmation names the exact service and consequence. Clone/copy
states that credential values and all principal bindings are excluded. No
browser storage, URL, DOM diagnostic, toast, or client log receives a secret,
opaque reference, raw request body, or excluded runtime material.

## Slice 1: schema, canonical drafts, creation, reads, and ownership

Outcome: migration `0008`, pure service/destination document validation, service
repository, superadmin create, scoped list/detail, admin assignment, signed
pagination, and production service/user relationship authorization.

Positive tests cover normalized safe documents, superadmin create/list/detail,
active-admin assignment, assigned-admin reads, pagination, and actor-only
managed-service resolution. Negative/boundary tests cover every malformed field and
destination boundary, duplicate slug, capacity, non-admin assignment, final
admin removal, user/admin creation, unassigned/cross-service access,
malformed/cross-scope/expired cursors, target-specific relationship denial
before Milestone 10, stale versions, and prohibited columns.

Commit: `Add durable service ownership`.

## Slice 2: destination editing, validation, and publication

Outcome: optimistic service/destination draft mutation, strict validation
preview, immutable publication snapshots, retention, generation invalidation,
transactional audit, and API/OpenAPI contracts.

Positive tests cover profile/destination create/update/delete, HTTP/HTTPS,
exact/suffix/regex matchers, IDNA, base paths, TLS-disabled warning, first and
changed publish, immutable history, and assigned-admin publication. Negative
tests cover incomplete/unsafe destinations, ambiguous encodings, broad regex,
base mismatch, duplicate IDs/slugs, unchanged publish, archived service,
missing admin, stale/concurrent publication, wrong-scope actor, rollback on
audit/invalidation failure, and non-routability through the YAML MCP registry.

Commit: `Publish validated service drafts`.

## Slice 3: rollback, copy, clone, archive, and deletion

Outcome: append-only rollback publication, strict safe copy/import, isolated
draft clone, guarded archive, dependency-aware permanent delete, and surviving
invalidation/audit.

Positive tests cover rollback lineage, copy/import round trip, clone with new
UUIDs, archive invalidation, and deletion cleanup/evidence. Negative tests cover
unknown/secret/principal/runtime copy fields, cross-service destination IDs,
stale/replayed history, admin clone/archive/delete, non-archived or assigned
delete, wrong-target proof, idempotency conflict, retained-current revision,
and concurrent lifecycle operations.

Commit: `Complete service revision lifecycle`.

## Slice 4: responsive Services workspace

Outcome: typed web API, permission-aware Services list/detail/editor, destination
validation/publication, history/rollback, safe transfer, ownership, archive, and
delete flows with accessible responsive behavior.

Tests cover superadmin and assigned-admin views, canonical validation feedback,
dirty/published states, stale recovery, TLS warning, excluded clone/copy
material, exact-target confirmation, narrow layout semantics, keyboard labels,
and unauthorized action absence.

Commit: `Add service management workspace`.

## Slice 5: documentation and acceptance

Outcome: service lifecycle/operator guidance, exact destination/publication/
copy semantics, endpoint/OpenAPI documentation, Milestone 09 acceptance audit,
and status completion.

Acceptance runs production build, focused migration/validation/repository/
authorization/revision/control/UI/documentation tests, generated OpenAPI
consistency, `git diff --check`, and the unchanged full suite with required
loopback and Unix-socket permission.

Commit: `Document service management lifecycle`.

## Later-milestone handoff

Milestone 10 adds service groups, ordinary-user assignments, and effective
membership on these immutable service UUIDs. Milestones 11–12 extend canonical
service publication documents with redacted credential and policy definitions.
Milestone 13 consumes published revisions and
`service_invalidation_events` to replace YAML runtime authority. Later
dashboard/backup/restore/migration milestones reuse the safe projections,
canonical document, dependency inventory, and revision lineage without
changing M09's authorization boundary.
