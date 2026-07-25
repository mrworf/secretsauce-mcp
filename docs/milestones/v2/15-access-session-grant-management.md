# Milestone 15: Access, Session, And Grant Management

## Purpose and why

Make active access visible and revocable without conflating OAuth grants with dynamically computed service, credential, policy, or gateway-reference authority.

## Dependencies

- Milestone 14.

## PRD traceability

- Sections 7.2, 17.3–17.5, and 18: role views, grant semantics, invalidation, and reference status.
- Sections 21.4, 24.3, and 30: navigation, status, and permissions.
- Sections 31 and 34.4: privacy and invalidation acceptance.

## Scope

- Add personal views/actions for a user to list and revoke their own web sessions and OAuth grants and see only currently reachable service names.
- Add superadmin global grant/session views and revocation by grant/family, user, client, and all grants.
- Add admin service-scoped computed views for related ordinary users, grants, capabilities, credentials, and policies without unrelated detail.
- Add explicit actions for service/credential/policy/assignment-scoped capability invalidation.
- Add safe active/expired/invalid `gref`/`sec` counts by permitted scope without displaying bearer values.
- Present OAuth revocation and dynamic-access invalidation as distinct controls and results.
- Add bounded filtering/pagination and administrative/personal audit events.

## Not in scope

- Allowing an admin to revoke an entire multi-service OAuth grant because one assigned service is involved.
- Displaying full references, tokens, credential values, or unrelated service relationships.
- Activity trends and operational dashboards, added in Milestone 20.
- API-key visibility, added in Milestone 16.

## Required behavior and interfaces

- Grant records map to user UUID and current safe profile label.
- User views include only own clients/grants, issue/use/expiry, and currently reachable service names.
- Admin grant views are computed from current service relationships and expose only the relationship relevant to assigned services.
- Scoped configuration/access actions invalidate capabilities and dynamic authorization but are never reported as OAuth grant revocation.
- Revocation is idempotent and takes effect on the next validation/request.

## Security, authorization, invalidation, and audit

- Queries enforce row-level viewer scope before pagination/search, not by filtering a global result in the browser.
- Reference metadata is aggregate-only and cannot identify/reconstruct bearer values.
- Bulk revocation requires exact target confirmation, justification where specified, and browser authorization.
- Audit records identify revocation versus capability invalidation and contain only safe counts/IDs.

## Tests

- Positive: own session/grant list/revoke, superadmin per-grant/user/client/all revoke, admin scoped view, scoped capability invalidation, and aggregate reference counts.
- Negative: other-user view/revoke, unrelated-admin access, admin whole-grant revoke, cross-service leakage, full token/reference fields, stale relationship, and unauthorized bulk operation.
- Boundary: multi-service grant, user losing/gaining service access, repeated revoke, large paginated result, expiry transition, and simultaneous use/revoke.
- Integration: revoked sessions/grants fail immediately; scoped invalidation leaves unrelated grants/services usable.

## Acceptance criteria

- Every viewer sees only the access metadata allowed by the PRD.
- OAuth grants and dynamic service capabilities are clearly distinguished in API and UX.
- Authorized revocation/invalidation takes effect immediately and is audited accurately.
- No bearer value or unauthorized relationship is exposed.

## Planning handoff

Specify scoped query projections, endpoints and filters, revocation transaction APIs, reference aggregate source, UX terminology, confirmation/idempotency rules, audit actions, and multi-service regression fixtures.
