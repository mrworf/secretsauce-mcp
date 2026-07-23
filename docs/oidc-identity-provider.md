# Generic OIDC Identity Provider

SecretSauce can use a standards-compliant OpenID Connect provider for
control-plane browser authentication. OIDC identities map to existing internal
user UUIDs through a verified immutable `(provider, issuer, subject)` link.
Matching email addresses never authenticate or link users, and provider claims
never grant SecretSauce roles, groups, assignments, policies, or MCP access.

OIDC is optional and does not replace the MCP endpoint's `auth` configuration.
It authenticates human users on the control listener; MCP authentication remains
an independent boundary.

## Provider registration

Register this exact callback at the provider:

```text
https://control.example.org/api/v2/auth/oidc/workforce/callback
```

Replace `workforce` with the configured provider ID. The provider ID uses
lowercase letters, digits, `_`, `.`, and `-`, starts with a letter, and is at
most 64 characters.

Configure the provider for authorization code flow, PKCE S256, and the `openid`
scope. SecretSauce obtains authorization, token, and JWKS endpoints from the
configured issuer's discovery document. Discovery and token endpoints must use
HTTPS. Redirects, special-use network destinations, unexpected content types,
oversized responses, and discovery issuer mismatches are rejected.

## Configuration

OIDC extends the same `identity` block used for local browser authentication:

```yaml
control:
  listen: 127.0.0.1:8081
  public_origin: https://control.example.org
  idempotency_hmac_key_file: /run/secretsauce-keys/idempotency.key

persistence:
  database_file: /var/lib/secretsauce/control.sqlite

identity:
  active_root_key_id: identity-2026-01
  root_key_files:
    identity-2026-01: /run/secretsauce-keys/identity-2026-01.key
  session_hmac_key_file: /run/secretsauce-keys/session-hmac.key
  step_up_mode: five_minutes
  oidc:
    providers:
      workforce:
        display_name: Workforce
        issuer: https://issuer.example.org/tenant
        client_id: secretsauce-control
        client_secret_file: /run/secretsauce-keys/oidc-workforce.secret
        redirect_origin: https://control.example.org
        scopes: [openid, profile, email]
        allowed_signing_algorithms: [RS256, ES256]
        clock_skew_seconds: 60
        max_authentication_age: 12h
        assurance:
          any_of:
            - acr: urn:example:assurance:phishing-resistant
            - amr: [pwd, otp]
        profile_claims:
          email: email
          email_verified: email_verified
          given_name: given_name
          family_name: family_name
          provider_owned_fields: [email, given_name, family_name]
    flow_ttl: 5m
    network_timeout: 5s
    max_response_body: 256kb
    max_inflight: 4
    max_inflight_per_provider: 2
    max_flow_records: 10000
    max_cache_records: 64
```

`redirect_origin` must exactly equal `control.public_origin`; it is an origin,
not the callback URL. The issuer is an exact canonical HTTPS URL and may include
a path, but not a query, fragment, user information, or ambiguous port.

Use `client_secret_file` for a confidential client and omit it for a public
client. A client-secret file must be a canonical regular file owned by the
gateway user, have mode `0400`, and be distinct from identity key files. It
contains only the client secret. Mount it read-only and never put the value in
YAML, logs, command arguments, browser storage, or an image layer.

Providers may allow `RS256`, `ES256`, or both. SecretSauce rejects algorithms
outside the configured list. `clock_skew_seconds` is bounded from 0 through 120;
`max_authentication_age` is bounded from 5 minutes through 24 hours.

## Assurance rules

`assurance.any_of` contains one to 16 alternatives. Alternatives are ORed.
Within one alternative, `acr` and `amr` are ANDed:

```yaml
assurance:
  any_of:
    - acr: urn:example:assurance:phishing-resistant
    - acr: urn:example:assurance:multi-factor
      amr: [pwd, otp]
```

This accepts either the first exact `acr`, or the second exact `acr` together
with both required `amr` members. Values are deployment-specific contracts with
the provider; configure only evidence the provider documents and actually
enforces. Missing, wrong-type, duplicate, ambiguous, or excessive assurance
claims fail authentication.

SecretSauce also requires a recent `auth_time` and a verified provider
assertion. TOTP-style provider MFA satisfies a correctly configured rule but is
not phishing-resistant. Prefer a phishing-resistant provider method and exact
assurance value where the provider supports one.

## Profile ownership

Claim names are explicitly mapped. `provider_owned_fields` controls which
display fields the provider may populate and later update:

- Provider-owned email requires both the mapped email claim and an exact boolean
  verification claim.
- A provider may update a field only while its source remains that provider.
- A local self-service or administrator edit returns that field to local
  ownership and prevents later silent overwrite.
- Invalid, conflicting, or oversized profile values are ignored without
  weakening authentication identity.

Authorization fields are always local. Provider roles, groups, entitlement
claims, or similarly named custom claims are not authorization inputs.

## Login and linking

The public control sign-in view lists only configured provider display names.
An external login succeeds only when the verified provider subject already has
an exact link to an active internal user.

There are two explicit ways to create a link:

1. An invited or enrollment-required user may choose a provider while holding
   the exact live restricted initial-enrollment session. Success removes
   temporary/local authenticator material, activates the user, invalidates the
   restricted state, and creates an ordinary browser session.
2. A superadmin may link a provider from another user's detail view. This
   requires a live browser session, justification, the current user version,
   and configured step-up. The callback remains bound to that actor, session,
   target, provider, and target version.

Superadmin linking cannot target the initiating superadmin. This keeps callback
session retention unambiguous: the administrator remains signed in as the
administrator and is never signed in as the target.

Unlinking has the same superadmin, version, justification, and step-up guards.
An active user must retain another eligible authentication method. Deactivate an
external-only user before removing their last link. Link and unlink operations
bump the target security epoch and revoke the target's browser and restricted
sessions.

Management responses show only safe link IDs, provider IDs/display names, and
timestamps. They do not return provider subjects, issuers, tokens, authorization
codes, raw claims, cookies, state, nonce, or PKCE values.

## Session and logout behavior

Successful OIDC authentication creates the same durable, secure, host-only
browser session used by local authentication. Session lifetime, inactivity,
role checks, security epochs, CSRF protection, logout, suspension, deactivation,
and role-change invalidation are provider-independent.

OIDC access and ID tokens are used only to validate the callback and are not
browser session credentials. SecretSauce does not call a provider logout
endpoint. Logging out of SecretSauce ends the local browser session; separately
end the provider session when required by the deployment's account-switching or
shared-device policy.

## Operational checks and failures

Before enabling a provider:

- verify the callback registration and exact public control origin;
- verify discovery advertises authorization code flow and PKCE S256;
- test every configured assurance alternative with both accepted and rejected
  provider sessions;
- test invitation-time linking and explicit administrative linking;
- confirm a matching email without a provider link cannot sign in;
- confirm suspension, deactivation, unlinking, and security-epoch changes
  invalidate local sessions;
- keep the SQLite database and identity keys stable across restart.

Public callback failures intentionally return the same fixed redirect and
generic result. Start troubleshooting with sanitized gateway readiness and
provider availability, then check issuer, callback registration, client
authentication, signing algorithm, clock synchronization, `auth_time`, and
assurance rules. Do not enable token, claim, cookie, or callback-query logging.

Discovery and JWKS caches are bounded and permit a single bounded refresh for
normal signing-key rotation. A flow is single-use: provider or network failure
after callback claim requires starting a new login. Changing an issuer,
provider ID, client ID, callback origin, identity root key set, or assurance
contract is a security change and should be staged with negative tests.

Generic OIDC does not provide JIT user creation, email linking, external
role/group synchronization, SCIM, SAML, social-login adapters, or a universal
provider logout. It also does not make an external identity MCP-eligible by
itself; MCP eligibility and grants remain separate local authorization state.
