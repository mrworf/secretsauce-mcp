# Milestone 04: Identity Bootstrap

## Purpose and why

Introduce the durable internal identities and provider boundary on which every v2 authorization decision depends. A secure bootstrap path is required because migration deliberately imports no v1 users and the system must never operate without an active superadmin.

## Dependencies

- Milestones 00–03.

## PRD traceability

- Sections 7.1–7.3: user records, roles, and account states.
- Section 8.1: authentication-provider contract.
- Sections 28.2 and 34.1: migration identity behavior and identity acceptance.
- Section 40: settled identity decisions.

## Scope

- Add user, provider-link, local-authenticator-state, and security-epoch persistence using immutable UUIDv7 user IDs.
- Enforce normalized unique email while treating email and names as mutable profile data rather than identity.
- Implement mutually exclusive `superadmin`, `admin`, and `user` roles and the defined account-state transition model.
- Define the provider adapter contract and internal mapping from `(provider, provider_subject)` to user UUID.
- Implement a one-time, host-local, interactive first-superadmin bootstrap that prepares enrollment without putting secrets in command arguments or logs.
- Add last-active-superadmin invariant checks as reusable domain operations.
- Add minimal read models needed by later authentication and authorization milestones.

## Not in scope

- Password verification, TOTP ceremonies, browser sessions, or MCP OAuth.
- General user invitations, profile administration, suspension, or deletion workflows.
- External OIDC.
- Service/group assignment.

## Required behavior and interfaces

- UUIDs, provider subjects, and normalized email uniqueness are enforced transactionally.
- Bootstrap is available only when no user exists and creates exactly one pending local superadmin identity.
- Re-running or racing bootstrap cannot create a second initial superadmin.
- Role/state transition functions reject impossible transitions and any loss of the last active superadmin.
- Provider-link lookup never falls back to email matching.

## Security, authorization, invalidation, and audit

- Bootstrap requires direct host authority and creates a sanitized break-glass/bootstrap audit event.
- Provider subjects and UUIDs are used for references; profile mutations cannot change identity.
- Password/TOTP columns hold state only at this milestone and cannot contain plaintext material.
- No account is MCP-eligible yet.

## Tests

- Positive: UUIDv7 creation, stable identity after profile changes, provider-subject lookup, initial bootstrap, and valid role/state transitions.
- Negative: duplicate normalized email, duplicate provider link, email-only provider match, second/racing bootstrap, malformed profile/provider fields, invalid state transition, and last-superadmin loss.
- Boundary: Unicode email/name normalization and maximum field lengths.
- Integration: restart retains identity and bootstrap lockout; audit event is self-contained and sanitized.

## Acceptance criteria

- Exactly one secure initial-superadmin identity can be bootstrapped on a fresh instance.
- Internal relationships use UUIDs/provider subjects, never mutable email.
- Last-active-superadmin protection is a reusable transactional invariant.
- No user can authenticate or use MCP from this milestone alone.

## Planning handoff

Specify tables/indexes, normalization library and rules, UUID generation, bootstrap terminal UX, state-machine API, provider-adapter types, audit snapshots, and how tests control races and time.
