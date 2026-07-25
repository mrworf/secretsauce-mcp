# Milestone 07: User Administration And Lifecycle

## Purpose and why

Deliver the role-scoped user administration needed to operate a multi-user installation while enforcing separation between ordinary users, admins, superadmins, and system API principals.

## Dependencies

- Milestones 04–06.

## PRD traceability

- Sections 7 and 10.2–10.3: roles, states, profiles, and resets.
- Sections 12 and 30: suspension rules and authoritative permission matrix.
- Sections 21–22 and 33: user UX and mutation behavior.
- Sections 34.1/34.4: lifecycle and invalidation acceptance.

## Scope

- Add user list/detail/invitation and profile APIs/UX with viewer-scoped fields and bounded search/pagination.
- Let superadmins create and manage ordinary users/admins and manage any profile, including their own.
- Let admins view/edit related ordinary users but not themselves through administrative flows or any admin/superadmin.
- Add manual suspension, reactivation, explicit deactivation, reactivation of deactivated local users, and permanent deletion of eligible deactivated users.
- Require justification and browser step-up where the PRD matrix requires it.
- Enforce last-active-superadmin protections across suspend, deactivate, delete, demote, and concurrent operations.
- Preserve active status when the final service membership is removed and expose zero-service state to later dashboards.
- Remove all user-specific operational rows on permanent deletion while retaining self-contained immutable audits and no tombstone.
- Add ordinary-user personal profile/security entry points without other-user visibility.

## Not in scope

- Service assignments and the calculation of which users are related to an admin; Milestones 09–10 provide those relationships. Until then, admin-scoped user mutations remain unavailable.
- Automatic inactivity suspension/deactivation.
- Generic OIDC details.
- API-key authority; Milestone 16 adds static API-role behavior.

## Required behavior and interfaces

- Authorization uses immutable user UUID, current actor role, target role, target state, and service relationship where applicable.
- Deactivation removes password/TOTP material and revokes sessions, grants, and references; reactivation generates a new temporary password and requires TOTP enrollment.
- Suspension retains authenticators but blocks normal authentication.
- Permanent deletion is an event, not a stored state, and leaves no identity/profile/provider/authenticator rows.
- Profile changes that affect multiple service contexts identify those contexts in the audit event.

## Security, authorization, invalidation, and audit

- Implement table-driven browser authorization for every user-management cell in PRD Section 30.
- Admins cannot mutate themselves administratively or view/manage admin/superadmin records beyond permitted labels.
- Email changes increment the target security epoch and revoke all target sessions/grants/references.
- Every success, denial, and failed sensitive action records safe actor/target snapshots and justification.

## Tests

- Positive: superadmin and related-admin profile workflows, invite, suspend/reactivate, deactivate/reactivate, role change, self-profile, and deletion with retained audit evidence.
- Negative: admin self-management, unrelated-user access, admin/superadmin target, last-superadmin loss, invalid transition, missing justification/step-up, deletion while active, and stale/concurrent mutation.
- Boundary: final service removal leaves active account; duplicate normalized email; pagination/search limits; concurrent last-superadmin changes.
- Integration: permanent deletion removes all operational identity relations without breaking audit queries; invalidations occur atomically.

## Acceptance criteria

- Browser user administration exactly matches the PRD matrix.
- Only explicit actions or configured automation change account status; service removal never deactivates.
- The last active superadmin cannot be lost by any tested race or path.
- Permanent deletion leaves no tombstone but preserves intelligible immutable audit evidence.

## Planning handoff

Define endpoint authorization queries, user list projections, relationship hooks supplied by Milestone 10, deletion dependency inventory, invalidation ordering, step-up transaction binding, audit before/after field allowlists, and concurrency tests.
