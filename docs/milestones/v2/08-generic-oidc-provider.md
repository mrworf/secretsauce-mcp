# Milestone 08: Generic OIDC Provider

## Purpose and why

Prove that SecretSauce identity is provider-pluggable without coupling authorization to an external vendor or allowing unsafe email-based account takeover.

## Dependencies

- Milestones 04, 05, and 07.

## PRD traceability

- Sections 8.1 and 8.3: provider contract and generic OIDC.
- Sections 9.4 and 17.2: uniform failures and external-provider MCP eligibility.
- Sections 25, 34.1, and 37: abuse controls, identity acceptance, and documentation.

## Scope

- Implement one generic standards-compliant OIDC provider adapter using the approved discovery, authorization-code, PKCE, nonce, state, issuer, client, redirect, and token-validation model.
- Map verified `(issuer, subject)` identities to internal user UUIDs.
- Support invitation-time or explicit superadmin linking after verified provider authentication.
- Validate configured MFA assurance using the approved vendor-neutral claims/rules before treating login as eligible.
- Track provider ownership of trusted profile claims without overwriting local authorization or administrator-maintained data silently.
- Add provider configuration validation, safe diagnostics, login UX, logout/session integration, and rate limits.

## Not in scope

- Vendor-specific Auth0, Descope, or social-login adapters.
- Automatic just-in-time user creation or email-only linking.
- External role/group synchronization, SCIM, SAML, or provider-managed SecretSauce authorization.
- Collecting external passwords or storing duplicate local TOTP for an external identity.

## Required behavior and interfaces

- External login succeeds only for a verified linked identity with required MFA assurance and allowed local state.
- Matching email without a matching provider link never authenticates or links an account.
- Provider claims may update only explicitly provider-owned display fields under configured rules.
- Local role, state, groups, assignments, sessions, grants, and policies remain authoritative.
- Authentication failures remain uniform and omit provider-token or claim details.

## Security, authorization, invalidation, and audit

- Discovery/JWKS/client trust follows existing URL validation, SSRF, DNS pinning, redirect, size, timeout, concurrency, and cache protections.
- State, nonce, PKCE, issuer, audience/client, signature, time, and redirect bindings are mandatory.
- ID/access tokens and raw claims are excluded from logs, audits, browser storage, and errors.
- Link/unlink actions require authorized interactive workflows and invalidate affected sessions/grants.

## Tests

- Positive: discovery, verified MFA login, explicit invite link, superadmin link, safe provider-owned profile update, key rotation, and session issuance.
- Negative: email-only match, wrong issuer/audience/redirect/nonce/state/PKCE, missing or insufficient MFA, unlinked subject, suspended/deactivated target, token replay, unsafe metadata URL, oversized response, and hostile claims.
- Boundary: clock skew, claim cardinality/length, provider outage/cache expiry, and concurrent link attempts.
- Integration: representative standards-compliant provider fixture and assurance-policy variants without vendor coupling.

## Acceptance criteria

- A generic OIDC identity can authenticate only through a verified immutable provider link and approved MFA assurance.
- No external claim can grant or change SecretSauce authorization.
- Local and external providers share the same internal identity/session authorization boundary.
- Provider secrets and tokens are absent from observable output.

## Planning handoff

Specify configuration schema, discovery/client library, exact assurance rule language, state/nonce/PKCE storage, redirect routes, linking ceremony, profile-source metadata, logout behavior, cache/limiter reuse, and provider test fixture.
