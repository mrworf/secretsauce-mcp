# Milestone 10: Groups And Assignments

## Purpose and why

Establish service-scoped group membership and principal selectors as the normal authorization model. Service scoping prevents an administrator of one service from changing membership that grants access to another.

## Dependencies

- Milestones 07 and 09.

## PRD traceability

- Sections 3.3 and 13: group preference, scope, selectors, and service access.
- Sections 7.4 and 17.1–17.2: zero-service users and MCP eligibility.
- Sections 22, 30, 33, and 34.2: mutation behavior, permissions, UX, and authorization acceptance.

## Scope

- Add service-scoped group records, lifecycle, membership, optimistic concurrency, and assigned-admin management.
- Add a reusable principal-selector model supporting `all`, one or more groups, or one or more individual ordinary-user UUIDs.
- Apply selectors to services and expose extension points for credentials and policies in Milestones 11–12.
- Add direct-user assignment with a visible group-preference warning and explicit confirmation.
- Add service membership/effective-access APIs and editors for admins, superadmins, and a user's own service-name view.
- Calculate whether an ordinary user is related to an admin and activate the scoped user-administration hooks from Milestone 07.
- Emit assignment-change events for targeted reference invalidation in Milestone 13.

## Not in scope

- Cross-service/global groups.
- Group nesting, dynamic groups, external group synchronization, or group precedence.
- Credential/policy authorization behavior beyond the shared selector representation.
- Automatic account deactivation when access is removed.

## Required behavior and interfaces

- A group belongs to exactly one service; cross-service membership or selector references are invalid.
- Service `all` includes every active ordinary user, never admins, superadmins, anonymous identities, suspended/deactivated users, or API keys.
- Empty explicit group/user selectors are invalid; omitted selectors normalize to `all` only through an explicit API/editor contract.
- Removing the final service assignment leaves the user active and self-service capable but MCP-ineligible.
- Effective access identifies direct, group, and `all` contributions without treating groups as ordered.

## Security, authorization, invalidation, and audit

- Assigned admins can manage only groups and ordinary-user membership for assigned services.
- Direct-user assignment and `all` changes are conspicuous, confirmed, and audited.
- Assignment removal takes effect immediately in authorization read models and emits scoped invalidation, not whole-account deactivation.
- Audit records capture safe before/after membership IDs and service context without unrelated user data.

## Tests

- Positive: group CRUD/membership, direct assignment, `all`, effective-access explanation, admin-related user calculation, and own service-name view.
- Negative: cross-service group/selector, admin/superadmin membership, empty selector, unassigned-admin mutation, direct assignment without confirmation, stale version, and unauthorized user discovery.
- Boundary: multiple group memberships, duplicate memberships, final assignment removal, archived group, maximum groups/members, and concurrent membership writes.
- Integration: service/admin/profile scope updates atomically and produce targeted invalidation events.

## Acceptance criteria

- Groups are service-scoped and are the recommended assignment path in UX and documentation.
- Service authorization can be explained as direct, group-derived, or `all`.
- Removing all service access never changes account status.
- Admin user-management scope is correctly derived from current assigned services.

## Planning handoff

Specify selector storage/normalization, effective-access query strategy, group archive semantics, direct-assignment confirmation field, membership batching/idempotency, admin relationship query, invalidation event payload, and scale tests for the PRD targets.
