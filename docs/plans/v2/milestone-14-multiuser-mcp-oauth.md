# Milestone 14 Multi-User MCP OAuth Implementation Plan

## Outcome

Add an explicit database-backed mode to the built-in MCP authorization server.
Eligible ordinary users authenticate with local password plus TOTP or a linked
OIDC provider, authorize a public MCP client, and receive opaque access and
rotating refresh tokens. Every MCP POST reloads durable grant, family, identity,
epoch, resource, and scope state before the persisted runtime performs dynamic
service, credential, and policy authorization.

The existing static built-in OAuth mode remains compatible for YAML deployments.
Database identity mode is the only mode extended by this milestone; no
service-specific scope or tool is added.

## Configuration and compatibility boundary

- Add `auth.builtin_oauth.identity_source: static|database`, defaulting to
  `static` for compatibility.
- Static mode retains the existing configured username/password verifier,
  signed access-token form, and optional atomic refresh-state file.
- Database mode requires `persistence`, `identity`, and
  `runtime.authority: database`; prohibits the static admin username/password
  fields and `refresh_token_store_file`; and requires a stable mode-`0400`
  `token_hmac_key_file`.
- Database mode uses the accepted lifetime ranges: access tokens 1–15 minutes
  (default 5), refresh inactivity 1–90 days (default 30), and refresh absolute
  7–365 days (default 90 and never below inactivity). Reductions constrain
  existing state during validation; increases affect newly issued grants only.
- Keep `server.resource` and the authorization issuer as origins. ChatGPT and
  Codex continue to receive the full MCP server URL including `/mcp`.
- Preserve the current allowlisted, redirect-free, DNS-pinned, bounded client
  metadata retrieval and exact redirect matching.

## Durable model and secret handling

Migration `0014` will add bounded, indexed, strict tables:

- `oauth_clients`: UUID, exact client identifier, safe display name, canonical
  redirect metadata digest/document, lifecycle, first/last seen, version.
- `oauth_authorization_intents`: UUID, keyed handle hash, client/resource/scopes,
  exact redirect and PKCE S256 challenge, encrypted client state for OIDC
  handoff, provider/purpose, created/expiry/consumed state.
- `oauth_authorization_codes`: keyed code hash, grant/user/client/resource/scope
  bindings, redirect, PKCE challenge, user/global epochs, expiry, consumed time.
- `oauth_grants`: immutable user UUID, client UUID, resource, scopes,
  authentication method, issue/last-use, issued lifetime ceilings, inactivity
  and absolute expiry, epochs, revocation state/reason.
- `oauth_refresh_families`: one family per grant in this milestone, current
  sequence, active/revoked/expired state, issue/use/expiry and replay reason.
- `oauth_refresh_tokens`: domain-separated keyed hash only, family, sequence,
  active/used state, issue/use timestamps.
- `oauth_access_tokens`: domain-separated keyed hash only, grant/family, scopes,
  issue/expiry/use state.

Raw authorization codes, access tokens, refresh tokens, passwords, TOTP values,
OIDC codes, PKCE verifiers, cookies, and OAuth state are absent from logs,
audits, and error bodies. Raw bearer values exist only at issuance or request
verification. Durable opaque values use separate HMAC domains and exact
base64url canonical validation.

The schema bounds document sizes, scopes, retained token counts, and client
metadata. Hash/token uniqueness and one active refresh sequence are enforced in
transactions. Expired operational records are removed in bounded batches;
revoked grant/family metadata remains available for Milestone 15.

## Eligibility and authentication

One repository predicate defines MCP eligibility:

- active account, exact `user` role, current security/global epochs;
- at least one effective assignment to an activated published service;
- local: configured permanent password, no forced/reset state, configured TOTP;
- external: exact active provider link plus the already normalized configured
  MFA assurance.

Local authorization reuses the local authentication primitives but adds an
OAuth proof operation that does not create a browser session. It performs the
same account/source, password, TOTP, and in-flight work for nonexistent and
ineligible candidates, uses dummy Argon2id/TOTP material, and atomically consumes
the accepted TOTP step when creating the grant/code.

The authorization page always uses no-store/no-referrer/frame-denial headers.
Its public failure is one fixed sign-in failure for nonexistent, wrong
credential, admin, superadmin, inactive, temporary/forced, missing-TOTP, and
zero-service cases. Rate limiting may return the same bounded temporary failure
with `Retry-After`; it never identifies the account condition.

## Authorization endpoints and OIDC handoff

- Retain discovery, JWKS compatibility for static mode, `/oauth/authorize`, and
  `/oauth/token`.
- Database-mode `GET /oauth/authorize` validates client, redirect, resource,
  scopes, response type, and PKCE before rendering local fields and configured
  OIDC provider choices.
- Database-mode local `POST /oauth/authorize` verifies the proof, creates the
  durable grant and single-use code, then redirects with the original state.
- Add an OAuth-to-control OIDC begin handoff and extend the durable OIDC flow
  purpose with `mcp_oauth`. The handoff carries only a random, hash-stored intent
  handle. The existing provider adapter performs discovery, PKCE, nonce,
  signature, issuer, audience, time, and MFA assurance validation.
- The control callback resolves the exact linked UUID, rechecks eligibility,
  atomically creates the grant/code, consumes the intent, and redirects directly
  to the already validated client callback. Denial always returns one fixed
  no-store authorization failure without link/account/assurance detail.
- OIDC provider callbacks remain fixed to their configured control origin; no
  provider redirect URI is synthesized from request headers.

## Code, token, and refresh algorithms

Authorization-code exchange runs one persistence transaction:

1. hash and load an unconsumed unexpired code;
2. compare exact client, redirect, optional resource, scope binding, and S256
   verifier;
3. reload current eligible UUID/role/status/epochs and active grant;
4. consume the code exactly once;
5. create the refresh family, sequence-zero active hash, and short-lived access
   hash;
6. commit a sanitized audit, then return raw tokens with no-store headers.

Refresh rotation runs one serialized transaction:

1. hash and load the token regardless of active/used state;
2. if it was used, revoke the whole family and its access tokens, audit replay,
   and return uniform `invalid_grant`;
3. validate exact client/resource, requested-scope subset, grant/family
   inactivity/absolute ceilings, current configured reductions, identity
   role/status/epochs, and current MCP eligibility;
4. mark the old sequence used, insert exactly one new active hash, update
   family/grant last-use and bounded inactivity, and insert a new access hash;
5. commit before returning the new raw pair.

The single persistence owner makes racing refreshes deterministic: one rotation
wins and the loser observes a used token and revokes the family. Token issuance
checks code/access/refresh/grant capacities before mutation. Failures do not
partially rotate state.

## MCP authentication and dynamic authority

`BuiltinOAuthRuntime` exposes a narrow database access-token authenticator.
`authenticateRequest` delegates only database-mode built-in bearer validation to
it; static built-in OAuth keeps the existing signature verifier.

Every MCP POST:

1. hashes and loads the opaque access token;
2. validates access expiry plus current configured reduction;
3. validates active grant/family, exact resource, scopes, inactivity/absolute
   bounds, user/global epochs, active `user` role, and at least one current
   service assignment;
4. updates bounded last-use state;
5. returns the immutable user UUID to the already implemented persisted runtime.

No service, credential, destination, group, or policy permission is embedded in
the grant or token. Losing the final service assignment makes authorization and
all existing MCP access fail while preserving the active account and grant
metadata. Assignment removal for one service remains a runtime capability
invalidation, not an OAuth revocation.

## Revocation, rates, and audit

- User password/TOTP/email/security-epoch, role, status, deactivation/deletion,
  global security, restore, and break-glass changes make access fail immediately.
- Database triggers or the shared identity mutation unit of work mark matching
  grants/families/access tokens revoked in the same transaction; epoch checks
  remain the independent request-time fail-closed guard.
- Admin promotion revokes grants/references and fails the exact role predicate.
- Add distinct bounded authorize/token limiters keyed by direct socket source,
  keyed normalized account identifier where applicable, client hash, and global
  class. Forwarding headers never choose limiter identity.
- Audit authorize allow/deny, code exchange, refresh rotation/replay,
  validation denial category, and revocation with immutable UUIDs or safe
  client/resource metadata. Never audit raw credentials, codes, tokens, client
  state, cookies, request bodies, or downstream responses.

## Minimal delivery slices

1. Configuration, migration, HMAC domains, durable repository, eligibility
   predicate, positive/negative schema and lifetime tests.
2. Local OAuth proof, durable authorization code/grant issuance, opaque code
   exchange, uniform-failure and capacity tests.
3. Durable refresh rotation/replay and opaque access-token authenticator,
   request-time identity/epoch/resource/scope checks, restart/concurrency tests.
4. MCP server/runtime integration and dynamic final-assignment/service-policy
   integration tests with independently authenticated ChatGPT/Codex-shaped POSTs.
5. OIDC intent/handoff using the existing trust adapter, linked-account/MFA
   eligibility tests, callback replay/expiry and uniform-denial tests.
6. Revocation hooks, bounded cleanup/rates/audit, operator documentation,
   production build, OpenAPI currency, full regression, and acceptance review.

Each slice includes positive and negative unit tests, the relevant integration
tests, a full-suite regression, and one concise commit.

## Acceptance matrix

- Local positive: eligible UUID, exact client/redirect/resource/scopes, PKCE,
  persisted grant, code single use, access MCP use, refresh/restart.
- OIDC positive: exact linked UUID, configured MFA assurance, durable handoff,
  access MCP use after callback.
- Uniform negative: nonexistent; wrong password/TOTP; admin/superadmin; invited,
  enrollment-required, suspended, deactivated; forced password/TOTP; unlinked;
  insufficient MFA; zero service.
- Protocol negative: response type, client, redirect, resource, scope, PKCE,
  code replay/expiry, refresh client/resource/scope escalation, replay,
  revoked/expired/inactive grant, epoch mismatch, malformed/noncanonical tokens.
- Boundary: exact clock edges; configured lifetime reduction/increase behavior;
  code/access/refresh/grant capacities; racing exchange/refresh; final assignment
  removal; restart; role promotion; global epoch.
- Integration: representative ChatGPT and Codex authorization-code/refresh
  parameter shapes, protected-resource discovery, full MCP URL containing
  `/mcp`, and independently authenticated stateless POSTs.

