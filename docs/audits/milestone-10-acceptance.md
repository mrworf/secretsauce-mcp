# Milestone 10 Groups And Assignments Acceptance Review

## Review conclusion

Milestone 10 is complete within its assigned boundary. SecretSauce now provides
durable service-scoped groups, atomic ordinary-user membership, reusable
principal selectors, explainable effective service access, scoped
administrative relationships, targeted invalidation events, strict browser
APIs, and a responsive groups-and-assignments workspace.

The implementation remains control-plane only. It does not make database
services routable, change YAML runtime authority, add credential or policy
behavior, deactivate users, create global or nested groups, synchronize an
external directory, or add a service-specific tool/profile pack.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Service-scoped groups | Migration `0009`, redundant service-first membership keys/indexes, transactional cross-table checks, and not-found-equivalent scope denial |
| Group lifecycle | Active create/update/membership, justification-bound archive, selector removal, archived inspection, archive-before-delete, optimistic versions, and idempotent destructive changes |
| Reusable selectors | Closed pure normalization for explicit `all`, groups, users, and mixed principals with sorted UUIDs and duplicate/empty/open-input rejection |
| Eligible principals | Live checks admit only active ordinary users and active same-service groups; privileged, inactive, malformed, and cross-service targets fail |
| Direct and broad access safeguards | Direct users require `direct_assignment_confirmed: true`; the browser visually separates and confirms exceptions and makes `all` conspicuous |
| Explainable access | Current-state query reports independent `all`, `direct`, and every matching active group contribution |
| Account continuity | Removing the final assignment mutates authorization state only; identity status, authenticators, sessions, and unrelated services are unchanged |
| Related-user scope | Admin directory and detail authorization derive from the intersection of current managed services and current effective assignments in SQL |
| Targeted invalidation | Selector, effective membership, archive, and deletion changes advance the service generation and record service/user events atomically |
| Audit safety | Same-transaction audit contains bounded UUIDs, kinds, counts, lifecycle, and justification without profiles, credentials, tokens, headers, cookies, or bodies |
| API contracts | Strict bounded no-store routes, strong ETags, CSRF, permission/scope checks, idempotency, runtime OpenAPI, and ordinary-user name-only projection |
| Browser workspace | Service-first responsive cards, CRUD/membership, selector editor, effective-access explanations, stale-edit preservation, and component-memory-only state |

## Security and architecture review

- Service scope, actor role/status, group lifecycle, target eligibility, and
  current version are re-read before mutation and before any authorization
  relationship is returned.
- Normalization is shared outside service storage so later credential and
  policy milestones can reuse the representation without bypassing validation.
- `all` is represented as a distinct row and never inferred from an empty
  explicit selection. Direct targets cannot be submitted without the matching
  confirmation field.
- Effective access is read from live assignments, active groups, membership,
  and active ordinary identities. Archive and removal therefore take effect in
  the control authorization model in the same transaction as invalidation.
- Related-user directory filtering is performed by scoped SQL rather than
  fetching unrelated identities and filtering them in application memory.
- The browser never persists membership or assignment state. It uses existing
  CSRF, idempotency, and strong-version helpers and does not log request data or
  downstream responses.
- Review confirmed that direct exceptions and `all` are visually distinct,
  empty explicit selectors cannot be saved, and destructive group actions bind
  justification to the selected group and its current version.

## Deliberate handoff

Milestones 11 and 12 reuse the principal-selector module for credential and
policy access boundaries. Milestone 13 consumes publication and assignment
invalidation state and makes persisted authorization authoritative for MCP
eligibility and references.

Until milestone 13, operators must continue to treat the existing YAML service
registry as the only MCP routing configuration.

## Validation

- production server and responsive web build
- focused selector, migration, repository, route, browser API, UI, and
  responsive-style tests
- positive and negative group lifecycle, membership, direct confirmation,
  `all`, mixed contribution, cross-service, privileged/inactive target,
  unauthorized discovery, stale version, duplicate/empty input, and cascade
  cases
- runtime-generated control OpenAPI consistency
- `git diff --check`
- full suite with required loopback and Unix-socket permission:
  **81 test files and 620 tests passed**

Accepted implementation commits: `6410ac2`, `0ce7f47`, `d6b3b01`, and
`17307c9`.
