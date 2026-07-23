# Milestone 09: Service Management

## Purpose and why

Replace routine service YAML editing with durable, audited service administration while keeping incomplete configuration away from the live gateway. Services are the ownership and authorization boundary for administrators, groups, credentials, and policies.

## Dependencies

- Milestones 01, 02, and 07.

## PRD traceability

- Sections 7.2 and 14: role authority and service lifecycle/editor.
- Sections 21–22 and 30: control-plane UX and permissions.
- Sections 24.3, 32.3, and 33: status, health, and UX acceptance.

## Scope

- Add persistent service identity, stable unique slug, profile fields, lifecycle state, draft/published revisions, destinations, allowed schemes/hosts/ports, and TLS behavior.
- Let only superadmins create service records, assign/remove service administrators, archive, or permanently delete services.
- Let assigned admins configure a new service from draft through validated publication.
- Add service/destination APIs and responsive editors with validation, optimistic concurrency, version history, rollback, safe clone, and safe copy/paste.
- Define publication validation that rejects incomplete or unsafe destinations and leaves failed drafts non-routable.
- Add sanitized service health/read models and administrative audit events.
- Expose invalidation events for later runtime integration without changing the current YAML-backed MCP runtime yet.

## Not in scope

- Groups or ordinary-user service assignments.
- Credential values/records and policy rules.
- Cutting the data plane over to database configuration; Milestone 13 owns activation.
- Service-specific tools or profile packs.

## Required behavior and interfaces

- New services are non-routable drafts with immutable UUID and stable slug.
- Publication is explicit and uses one validated immutable/revisioned snapshot.
- Admin access is based on persistent service-admin assignment; assigned admins cannot transfer that authority.
- Clone/copy excludes credentials, principals, live references, OAuth state, and other secret/runtime material.
- Archive disables publication intent; permanent deletion is high-friction and only allowed when dependency rules are satisfied.

## Security, authorization, invalidation, and audit

- Enforce the service-related browser rows in PRD Section 30, including cross-service denials.
- Reuse canonical destination validation; reject routing-changing percent encodings and unsafe schemes/hosts/ports before publication.
- Stale writes return `409` and never overwrite newer edits.
- Audit create, assignment, validation, publish, rollback, clone, archive, delete, and denials with sanitized diffs.

## Tests

- Positive: superadmin create/assign, assigned-admin draft editing and publish, version history/rollback, clone, and safe copy/paste.
- Negative: admin create/archive/delete/assign-admin, unassigned-admin access, unsafe/incomplete destination, stale version, duplicate slug, secret-bearing clone input, and publish validation failure.
- Boundary: destination/host/port limits, maximum service fields/revisions, concurrent publish, and deleting the final assigned admin where policy forbids it.
- Integration: transaction/audit coupling and non-routability of drafts/failed publications.

## Acceptance criteria

- Superadmins control service existence and administrative ownership; assigned admins control configuration only.
- A complete service can be drafted, validated, published, cloned, rolled back, and archived through the control plane.
- No database-managed service affects MCP routing before Milestone 13.
- Copy/clone and all API/UX output remain secret-free.

## Planning handoff

Specify tables/revision storage, destination schema reuse, publication validator, admin-assignment authorization queries, clone/copy document format, rollback semantics, dependency-aware deletion, and the activation event contract consumed by Milestone 13.
