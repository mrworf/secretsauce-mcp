# Milestone 14: Multi-User MCP OAuth

## Purpose and why

Connect the v2 identity system to MCP authorization while preserving uniform failures and dynamic service authorization. OAuth grants identify a user/client relationship; they must not freeze service, credential, or policy permissions into long-lived tokens.

## Dependencies

- Milestones 05, 08, 10, and 13.

## PRD traceability

- Sections 3.2, 9.4, and 17: admin separation, uniform failures, OAuth, grants, and eligibility.
- Sections 7.4, 10, and 11.1: service eligibility, invalidation, and lifetimes.
- Sections 25, 32.2, 34.1, and 34.4: limits, listener semantics, and acceptance.

## Scope

- Integrate local password+TOTP and linked generic OIDC authentication into the built-in MCP authorization flow.
- Enforce MCP eligibility: active `user` role, completed permanent local credentials or approved external MFA, and at least one effective service assignment.
- Make admins, superadmins, nonexistent, suspended/deactivated, temporary-password, forced-change, missing-TOTP, unlinked, insufficient-MFA, and zero-service users externally indistinguishable.
- Persist OAuth grants, client/resource/scope metadata, issue/use/expiry/revocation state, refresh families, and hash-only refresh-token records.
- Rotate public-client refresh tokens with replay-family revocation and enforce inactivity/absolute lifetimes.
- Bind access-token validation to current grant, account role/state/security epoch, and resource; evaluate services/credentials/policies dynamically at each MCP request.
- Preserve OAuth origin versus MCP `/mcp` URL semantics and current safe client-metadata retrieval.
- Add OAuth authorization/token rate limits and sanitized audit events.

## Not in scope

- Admin/user grant-management UX and bulk controls, added in Milestone 15.
- Service authorization encoded permanently into OAuth scopes/tokens.
- Admin/superadmin MCP access, self-registration, social login, or service-specific OAuth scopes.
- Multiple authorization-server replicas.

## Required behavior and interfaces

- Every MCP POST independently validates OAuth authentication and current grant/user state.
- OAuth access tokens are short-lived per approved architecture and cannot remain valid after required revocation/security events.
- Refresh rotation detects reuse and revokes the family without storing raw refresh tokens.
- Losing final service access prevents new authorization and all service discovery/use but does not deactivate the account.
- Admin promotion immediately removes MCP eligibility and revokes affected grants/references.

## Security, authorization, invalidation, and audit

- Login pages and token responses are non-cacheable and never disclose eligibility reasons.
- Authorization codes bind client, redirect, PKCE, resource, user, and expiry and are single-use.
- Raw codes/tokens/passwords/TOTP/cookies are absent from database (where hash suffices), logs, audits, and errors.
- Password, TOTP, email, role/status, restore, and global security events revoke the required OAuth state.

## Tests

- Positive: eligible local and OIDC authorization-code flows, PKCE, grant persistence, access-token MCP use, refresh rotation, restart behavior, and dynamic service authorization.
- Negative: every ineligible category with uniform response/work, wrong client/redirect/resource/scope/PKCE, code replay, refresh replay/escalation, expired/inactive/revoked grant, account epoch mismatch, and admin/superadmin MCP use.
- Boundary: code/token/grant capacities, clock edges, lifetime reduction/increase rules, concurrent refresh, and removal of final service assignment.
- Integration: ChatGPT- and Codex-representative clients complete OAuth and independently authenticated MCP POSTs against the persisted runtime.

## Acceptance criteria

- Only eligible ordinary users can obtain and use MCP OAuth grants.
- Grants map to immutable user UUIDs but service/credential/policy authority remains dynamic.
- Refresh state is durable and hash-only with replay-family revocation.
- All ineligible account conditions are externally indistinguishable from nonexistent accounts.

## Planning handoff

Specify authorization endpoints/forms, local versus OIDC handoff, grant/token schemas, approved token form, state/security-epoch checks, refresh transaction and replay algorithm, limiter keys, uniform response contract, client fixtures, and event-to-revocation mapping.
