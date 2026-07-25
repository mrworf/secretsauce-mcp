# Milestone 14 Acceptance Review

## Outcome

Accepted. Database-backed built-in OAuth now authenticates eligible ordinary
users through local password plus TOTP or an explicitly linked OIDC assertion,
persists user/client grants and hash-only opaque token state, and authenticates
every stateless MCP request against current durable identity, epoch, resource,
scope, grant, refresh-family, and service-eligibility state.

Static built-in OAuth remains the default compatibility mode. Database mode is
an explicit configuration choice requiring persistence, identity, activated
database runtime authority, and a stable mode-`0400` token HMAC key.

## Acceptance evidence

- Local proof verification performs the existing bounded password/TOTP work
  without creating a browser session. Grant creation atomically consumes the
  accepted TOTP step.
- Admin, superadmin, inactive/incomplete, stale-epoch, missing-account, and
  zero-service candidates cannot create or use a grant through the shared
  eligibility predicate.
- OIDC authorization uses the existing discovery, PKCE, nonce, signature,
  issuer, audience, time, and MFA-assurance adapter. The handoff stores a keyed
  intent handle and encrypted client state, resolves an exact linked UUID, and
  consumes both OIDC flow and OAuth intent once.
- Authorization codes bind the immutable user UUID, exact client, redirect,
  resource, scopes, PKCE challenge, epochs, and expiry. Code exchange is
  transactional and single-use.
- Access and refresh values are canonical 32-byte base64url opaque values.
  Durable records contain only domain-separated HMACs. Refresh rotation is
  serialized; replay revokes the family and every family access token.
- Access validation reloads current account role/status, local authenticator
  state where applicable, global and user security epochs, effective activated
  service access, grant/family status and lifetime, exact resource, and scopes.
  Removing the final assignment denies the next request without embedding
  service authority in the grant.
- User/global security triggers revoke grants, families, active refresh values,
  and access values in the same persistence transaction. Bounded maintenance
  removes expired operational code, intent, access, and obsolete refresh
  records while retaining grant/family metadata for Milestone 15.
- Authorization pages, callbacks, token responses, and errors use no-store
  controls. Raw passwords, TOTP values, OIDC codes/state, authorization codes,
  access/refresh tokens, cookies, request bodies, and downstream responses are
  absent from persistence audits and logs.
- Operator guidance distinguishes static and database identity sources,
  stable keys, OAuth origin values, and the ChatGPT/Codex MCP Server URL
  `https://mcp.example.org/mcp`.

## Verification

- Focused positive, negative, boundary, replay, restart, concurrency, OIDC,
  migration, and HTTP integration tests pass.
- Production server and web builds pass.
- `npm run check:control-openapi` reports the committed artifact current.
- Full regression with listener/socket permission: **91 test files, 693 tests
  passed**.

## Implementation commits

- `115091e` — database OAuth configuration, migration, hashing, and eligibility
  foundation
- `e77c71e` — local proof, durable grants, and authorization-code exchange
- `20bdddf` — durable refresh rotation and access-token validation
- `2911628` — database OAuth HTTP and stateless authentication integration
- `524f34c` — linked OIDC authorization handoff
- `9542715` — bounded cleanup, capacity recovery, and operator guidance

## Deferred boundary

Personal/admin grant listing and revocation UX is intentionally deferred to
Milestone 15. No service-specific OAuth scopes, tools, profiles, or multi-replica
coordination were added.
