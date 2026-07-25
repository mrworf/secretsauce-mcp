# Milestone 08 Implementation Plan: Generic OIDC Provider

## Scope review

Milestone 08 adds one vendor-neutral OpenID Connect authorization-code adapter
for control-plane authentication and verified account linking. It reuses the
internal UUID, browser-session, security-epoch, audit, origin, and identity
lifecycle boundaries delivered by Milestones 04–07.

OIDC configuration remains deployment configuration in this milestone. External
providers own their passwords and MFA; SecretSauce stores neither. Local roles,
states, groups, assignments, policies, sessions, and later MCP eligibility
remain authoritative. No vendor adapter, JIT user creation, email linking,
external role/group sync, SAML, SCIM, or multi-user MCP grant is added.

## Configuration contract

`identity.oidc.providers` is a closed record of one to eight providers keyed by
the existing lowercase provider-ID grammar. Each provider has:

- exact canonical HTTPS `issuer`, allowing a non-root path but no query,
  fragment, userinfo, or non-default port ambiguity;
- bounded `client_id` and optional restricted `client_secret_file`;
- `redirect_origin`, which must exactly equal `control.public_origin`; the fixed
  callback is `/api/v2/auth/oidc/{provider_id}/callback`;
- scopes containing `openid`, with bounded unique values;
- allowed signing algorithms drawn only from `RS256` and `ES256`;
- clock skew from 0–120 seconds and maximum authentication age from 5 minutes
  through 24 hours;
- one to 16 MFA `any_of` clauses. A clause may contain an exact `acr` value,
  a non-empty set of required `amr` members, or both. Fields within one clause
  are ANDed; clauses are ORed. Missing, ambiguous, wrong-type, or overlong
  evidence fails;
- optional profile claim names and `provider_owned_fields` drawn from `email`,
  `given_name`, and `family_name`. Provider-owned email requires an exact
  configured boolean verification claim.

Provider secret files use the same canonical regular-file, ownership, and
permission checks as identity keys, are distinct from all identity key files,
and are never copied into diagnostics. Configuration errors identify only the
bounded configuration path and rule.

Identity limits add bounded OIDC begin attempts/window, callback inflight
capacity, durable flow capacity, discovery/JWKS cache records, and network
timeout/body maxima. Defaults are conservative and share direct-source abuse
keys; forwarding headers remain untrusted.

## Discovery and network trust

Discovery uses the exact configured issuer plus
`/.well-known/openid-configuration`. The returned issuer must exactly match.
Authorization, token, and JWKS endpoints must be canonical HTTPS URLs without
userinfo or fragments.

All server-side discovery, token, and JWKS requests use one injected
`OidcNetwork` boundary that:

- rejects redirects and every literal or DNS result in special-use address
  ranges;
- validates all DNS answers, pins one validated result to the HTTPS socket, and
  preserves hostname certificate/SNI validation;
- bounds response bytes, time, global/provider concurrency, cache count, and
  cache lifetime;
- accepts only JSON object responses with the expected content type;
- never returns response bodies in errors or diagnostics.

Discovery must advertise authorization code and PKCE S256. Token authentication
uses `client_secret_basic` only when a secret file is configured and `none`
otherwise. Client secrets never enter form bodies. JWKS accepts only bounded
public signing keys compatible with the configured algorithms. An unknown key
or signature failure forces one bounded JWKS refresh, allowing normal key
rotation without indefinite retry.

## Flow, token, and assertion contract

Migration `0007` adds:

- durable OIDC flow rows containing provider, purpose (`login`,
  `restricted_link`, or `superadmin_link`), keyed state hash, encrypted nonce and
  PKCE verifier, target/actor/session bindings where applicable, redirect URI,
  expiry, and one-way claimed/consumed timestamps;
- profile-source columns for email, given name, and family name, defaulting to
  `local`; provider ownership is represented by `oidc:{provider_id}`;
- provider-link authentication timestamps and claim-update metadata;
- the bounded invalidation reason `provider_link_change`.

The active identity root key envelope-encrypts flow nonce and PKCE verifier with
flow/provider/purpose associated data. Raw state, nonce, and verifier never
enter SQLite. State is 32 random bytes and stored only as a domain-separated
keyed hash. PKCE uses a 32-byte verifier and S256. Flow rows expire after five
minutes, are bounded/pruned, and a callback atomically claims one row before any
token endpoint call; replay or concurrent callbacks lose. A provider outage
after claim requires a fresh begin operation.

Callback validation requires exact state/provider/redirect/purpose binding,
successful code exchange, `id_token`, configured algorithm, signature, exact
issuer, client audience and `azp` rules, nonce, `exp`, `iat`, required
`auth_time`, configured skew/age, and bounded string/cardinality claims. Access
tokens and raw claims remain memory-only and are discarded after validation.
The normalized provider assertion contains only provider ID, exact issuer,
stable subject, authentication time, verified MFA plus allowlisted evidence, and
allowlisted profile values.

Every public callback failure returns the same no-store authentication result
and redirect. It never identifies state, link, account, MFA, claim, provider
token, or eligibility failure. Denied/error audits use generic target labels and
stable failure classes only.

## Login and internal session boundary

Routes are:

- `GET /api/v2/auth/oidc/providers` for public, non-secret provider labels;
- `POST /api/v2/auth/oidc/{provider_id}/begin`;
- `GET /api/v2/auth/oidc/{provider_id}/callback`.

A login callback maps only exact `(provider_id, issuer, subject)` to an existing
link. Email is ignored for identity lookup. The linked internal user must be
`active` with a human role. A successful external login inserts the same durable
browser-session shape used by local login, bound to current user/global security
epochs and role lifetimes, updates bounded login/authentication timestamps, and
audits in one immediate transaction. The callback sets the existing secure,
HTTP-only, host-only, strict-same-site browser cookie and redirects only to the
fixed local `/control` path.

Logout and all session validation are provider-independent. External users do
not need local password/TOTP material for browser eligibility, and SecretSauce
does not synthesize it. Milestone 14 consumes the same normalized assertion and
internal UUID boundary for MCP authorization after service eligibility exists.

## Linking, unlinking, and profile ownership

Invitation-time linking begins from an authenticated
`__Host-secretsauce_enrollment` restricted session:

- `POST /api/v2/auth/enrollment/oidc/{provider_id}/begin`.

The callback must still match that exact live restricted session, user,
security/global epochs, and provider. Success links the verified subject,
removes temporary/local authenticator material, marks authenticator states
disabled, activates the invited/enrollment-required user, revokes restricted
state, increments the security epoch, records invalidation, and issues an
ordinary browser session atomically.

Explicit administrative linking begins at:

- `POST /api/v2/users/{user_id}/oidc-links/{provider_id}/begin`.

It is browser-superadmin-only, requires justification, `If-Match`, and configured
step-up. The callback remains bound to the initiating browser session, actor,
target version, and current actor/target roles/states. It links the verified
subject but retains the superadmin's session; it never signs the administrator
in as the target.

Unlinking uses:

- `DELETE /api/v2/users/{user_id}/oidc-links/{link_id}`.

It has the same superadmin, justification, concurrency, and step-up guards.
An active target must retain at least one eligible authentication method; an
external-only last link requires deactivation first. Link and unlink increment
the target security epoch, revoke target sessions/references, record durable
invalidation, and audit safe actor/target/provider snapshots. Exact provider
subjects and tokens are never returned by management projections.

Provider claims may update only configured provider-owned fields. A link may
claim ownership only of the configured allowlist. Later verified logins may
update a field only while its source still equals that provider. Any self or
administrator local edit changes that field's source to `local`, preventing
silent future overwrite. Provider claims never mutate role, state, assignments,
groups, policy, authenticators, epochs except through the explicit link
transaction, or any authorization field.

## UI and diagnostics

The unauthenticated control view lists configured provider display labels and
starts a same-origin OIDC login without storing state, nonce, verifier, tokens,
or claims in JavaScript storage. Restricted enrollment offers configured OIDC
linking. The superadmin user detail offers explicit link/unlink controls with
the existing confirmation, justification, version, and step-up behavior.

Callback pages and errors are no-store and contain a fixed success/failure
message only. Logs expose provider ID, stable outcome class, request ID, and
duration class; they exclude URLs containing authorization responses, codes,
state, tokens, raw claims, subjects, email, cookies, and downstream bodies.
Readiness reports only `ready` or `unavailable` for the configured OIDC seam.

## Slice 1: configuration, assurance, and pinned discovery/JWKS

Outcome: closed provider configuration and diagnostics, standards-valid issuer
normalization, pure MFA/claim normalization, pinned bounded OIDC network client,
discovery cache, and rotating JWKS validation.

Tests include positive RS256/ES256 fixtures and assurance variants, plus unknown
configuration fields, unsafe URLs/DNS, redirects, wrong discovery issuer,
missing S256/code support, oversized/slow responses, hostile keys/claims,
algorithm mismatch, cache expiry/capacity, and key rotation.

Commit: `Add generic OIDC trust configuration`.

## Slice 2: durable single-use flow and verified adapter

Outcome: migration `0007`, hash/envelope-only flow storage, begin/callback
protocol, token exchange, exact JWT validation, normalized assertions, uniform
failures, rate/concurrency limits, and secret-free diagnostics.

Tests include a representative provider fixture, exact boundaries, wrong
state/nonce/PKCE/issuer/audience/azp/time/redirect, missing MFA, replay,
concurrent callbacks, outage after claim, expiry/pruning/capacity, and database,
log, audit, URL, and response secret absence.

Commit: `Implement verified OIDC authentication flows`.

## Slice 3: linked external login and browser session

Outcome: exact immutable provider-link lookup, active-human eligibility,
provider-independent durable browser session issuance, safe owned-profile
updates, logout integration, and public login UX.

Tests cover successful linked login, email-only/unlinked subject, inactive and
non-human targets, duplicate provider/email, claim ownership and local reclaim,
session epoch/lifetime/restart/logout behavior, key rotation, and uniform
observable failure.

Commit: `Add linked OIDC browser login`.

## Slice 4: restricted and superadmin link lifecycle

Outcome: invitation-time restricted linking, target-bound explicit
superadmin link/unlink, authentication-method lockout prevention, invalidation,
audit, OpenAPI routes, and responsive management/enrollment UX.

Tests cover both link ceremonies, unlink with an alternative method, exact
actor/session/target/version/proof binding, subject uniqueness races,
last-method denial, stale/replayed flows, local authorization immutability,
session/reference invalidation, and prohibited material in UI/log/audit.

Commit: `Add guarded OIDC identity linking`.

## Slice 5: documentation and acceptance

Outcome: generic provider setup/assurance/operator guidance, security
limitations, complete endpoint/OpenAPI documentation, Milestone 08 acceptance
audit, and status update.

Acceptance runs production build, focused config/network/assurance/JWT/flow/
link/session/control/UI/documentation tests, generated OpenAPI consistency,
`git diff --check`, and the unchanged full suite with required listener and
Unix-socket permission.

Commit: `Document generic OIDC provider`.

## Later-milestone handoff

Milestone 10 supplies service eligibility. Milestone 14 reuses verified OIDC
assertions and internal UUID mapping inside multi-user MCP authorization.
Milestone 15 attaches durable OAuth grant consumers to link/security
invalidation. Milestones 18–20 may expose provider settings, status, and
security reporting without weakening deployment-secret or token boundaries.
