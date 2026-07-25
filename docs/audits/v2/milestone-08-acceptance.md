# Milestone 08 Generic OIDC Provider Acceptance Review

## Review conclusion

Milestone 08 is complete within its assigned boundary. SecretSauce now supports
vendor-neutral OIDC discovery, authorization code with PKCE, exact token and
assurance validation, immutable provider-subject mapping, provider-independent
browser sessions, invitation-time linking, and guarded superadmin link/unlink.

OIDC remains control-plane authentication. No vendor adapter, JIT creation,
email linking, external authorization synchronization, SAML, SCIM, or MCP grant
was added.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Closed provider configuration | One-to-eight exact providers, canonical issuer/origin, restricted secret file, bounded scopes/algorithms/time/flow/network/cache settings |
| Network trust | Redirect rejection, special-use address rejection, DNS pinning with hostname verification, bounded JSON responses, concurrency and cache limits |
| Verified flow | Durable keyed state hash, encrypted nonce/PKCE, exact provider/redirect/purpose binding, atomic claim/consume, bounded expiry/capacity |
| Assertion validation | Signature and configured algorithm, issuer, audience/`azp`, nonce, `exp`/`iat`/`auth_time`, bounded subject/profile claims, exact assurance alternatives |
| Exact identity mapping | Login lookup uses provider ID, issuer, and subject only; unlinked and email-only matches share uniform failure |
| Internal session boundary | OIDC issues the existing durable browser-session shape with local role, state, lifetime, and security epochs |
| Profile ownership | Only mapped and configured fields are provider-owned; verified email required; local edits reclaim ownership; authorization is untouched |
| Restricted linking | Exact live initial-enrollment session, user, version, provider, and epochs bind the callback; activation and session replacement are atomic |
| Administrative linking | Superadmin permission, live actor session, distinct target, justification, `If-Match`, step-up, and callback target/version binding |
| Unlink safety | Same guards, alternative-method requirement for active users, target epoch bump, session revocation, invalidation, and safe audit |
| Browser UX and API | Public provider sign-in, restricted enrollment option, superadmin management panel, no-store routes, generated OpenAPI contracts |
| Secret-safe observability | Fixed callback redirect/failure, safe provider/link projections, no token, code, state, nonce, verifier, raw claim, subject, or cookie output |

## Security review

- Provider discovery and downstream token/JWKS I/O occur only after closed
  configuration and destination validation. Redirects and special-use
  destinations fail before trust or token processing.
- Callback state is single-use and the durable row contains only a keyed state
  hash plus encrypted nonce/verifier material. Token and claim validation
  precedes identity lookup or mutation.
- Link initiation is authorized and exact-target/version-bound before provider
  state is created. Transaction-bound step-up proof consumption and flow
  insertion commit or roll back together.
- Link callbacks revalidate the live restricted or superadmin browser session
  and current target version. Link uniqueness, profile changes, authenticator
  cleanup, epoch changes, session revocation, invalidation, session issuance,
  and success audit are transactional.
- External claims cannot change role, state, groups, assignments, policy, or
  MCP eligibility. Email is profile data, never an identity join key.
- Management and browser projections exclude immutable subjects and token
  material. Public failures remain deliberately uniform.

## Deliberate handoff

Milestone 10 supplies service eligibility. Milestone 14 reuses the normalized
verified assertion and internal UUID boundary for multi-user MCP authorization.
Milestone 15 attaches OAuth grant/reference consumers to durable invalidation.
Later settings and dashboard milestones may expose safe provider status without
exposing deployment secrets or provider subjects.

## Validation

- production server and responsive web build
- focused configuration, discovery/JWKS, assurance, JWT, flow, login, linking,
  control contract, session, UI, and documentation tests
- positive and negative provider/link/assurance cases, replay/race boundaries,
  profile ownership, and secret-absence assertions
- generated control OpenAPI consistency
- `git diff --check`
- full suite with required loopback and Unix-socket permission:
  **74 test files and 591 tests passed**

Accepted implementation commit: `8b4225c`.
