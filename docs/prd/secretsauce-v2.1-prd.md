# Product Requirements Document: SecretSauce v2.1

> **Browser-first secure setup, authentication, and session control**

## 1. Document status

- Product: SecretSauce (MCP)
- Version: 2.1
- Status: Proposed product contract for security, architecture, UX, data/API,
  and milestone review
- Date: 2026-07-24
- Intended audience: Product, security, architecture, UX, implementation,
  test, operations, and documentation reviewers

This document defines the v2.1 product behavior for automatic cryptographic
setup, initial enrollment, browser authentication, account suspension, and
session management. Existing implemented behavior outside this scope remains
unchanged unless this document explicitly changes it.

This document specifies externally observable behavior and security invariants.
It does not prescribe an implementation plan or authorize implementation.

## 2. Executive summary

SecretSauce has the authentication, enrollment, session, and OAuth foundations
needed for a secure multi-user control plane, but a fresh installation cannot be
completed entirely through the browser. It also lacks a complete local login
experience, visible logout, configurable account suspension after suspicious
TOTP failures, and a coherent user-facing place to inspect and revoke browser
and agent sessions.

Version 2.1 makes a supported fresh Docker Compose deployment browser-first:

1. SecretSauce generates and validates missing SecretSauce-owned application
   keys before exposing the product.
2. The browser shows a safe setup-status experience while provisioning runs.
3. An operator uses a one-time secret from container logs to enroll the first
   superadmin atomically.
4. All users use a branded login, enrollment, logout, and account-settings
   experience.
5. Users and authorized administrators can inspect and immediately revoke
   browser sessions and OAuth agent connections.

The design preserves uniform authentication failures, server-side revocable
sessions, mandatory TOTP for local accounts, and fail-closed behavior when a
configured installation loses required key material.

## 3. Context and current product

### 3.1 Behavior preserved

The following existing behavior remains authoritative:

- Local identities authenticate with email, password, and TOTP.
- Local TOTP is mandatory.
- OIDC providers own their passwords, MFA, and failed-attempt policy.
- Browser sessions are opaque, server-side, expiring, and revocable.
- OAuth grants, refresh families, access tokens, and gateway references are
  subject to immediate server-side invalidation.
- Enrollment and recovery sessions cannot authorize ordinary control, OAuth,
  or MCP operations.
- Authentication failures resist account and eligibility enumeration.
- Administrative security mutations require the existing role authorization,
  step-up, confirmation, justification, and audit controls applicable to the
  operation.

### 3.2 Behavior changed

Version 2.1 changes:

- Fresh key provisioning from operator-run commands to automatic startup
  provisioning for SecretSauce-owned application keys.
- Initial superadmin creation from CLI bootstrap to an atomic browser
  enrollment authorized by an in-memory secret printed once per process start.
- The web control plane from an assumed authenticated shell to a complete local
  and OIDC login experience with logout.
- Suspended-account reactivation from direct activation to mandatory password
  and TOTP reset enrollment.
- Session and OAuth grant management from separate technical surfaces to
  user-facing account settings and scoped administrative views.

### 3.3 Compatibility boundary

There are no deployed 2.0 installations requiring adoption or data migration.
Version 2.1 supports fresh deployments. Development databases, development key
material, sessions, grants, and bootstrap state do not receive an upgrade
compatibility guarantee.

## 4. Product principles

1. **No partially secured product surface.** SecretSauce must not expose login,
   control, OAuth, or MCP behavior until every required SecretSauce-owned key
   validates.
2. **No partial first identity.** The initial superadmin does not exist until
   profile, password, and confirmed TOTP state can commit together.
3. **Possession is not recovery authority.** Knowing an email address never
   starts a password-recovery flow. Enrollment requires a valid bootstrap secret
   or administrator-issued temporary password.
4. **Public failures reveal as little as practical.** Login and enrollment
   responses do not reveal account existence, account state, credential stage,
   or setup eligibility.
5. **Revocation is a durable state transition.** Once revocation commits, new
   requests cannot use the revoked capability.
6. **Recovery assumes compromise.** Administrative password reset, suspended
   account recovery, and host-local break glass reset both password and TOTP.
7. **Logs are not ordinary secret storage.** The initial bootstrap secret is a
   narrow, explicitly documented exception and is never copied to other logs,
   audits, APIs, or persistence.
8. **Health describes the right concern.** A live service waiting for setup or
   enrollment is not unhealthy, even though it is not operationally ready.

## 5. Goals and success measures

### 5.1 Goals

- Complete a supported fresh installation using Docker Compose, container logs,
  and the browser without an initialization CLI.
- Ensure required key generation finishes before any ordinary product interface
  can be used.
- Provide branded, accessible local and OIDC sign-in plus explicit logout.
- Provide uniform login failures and bounded authentication abuse controls.
- Allow a superadmin to enable durable account suspension after repeated
  password-valid, TOTP-invalid login attempts.
- Make browser sessions and OAuth agent connections visible and immediately
  revocable within the actor's authority.
- Preserve enough sanitized audit evidence to investigate all session and grant
  revocations even when operational records are physically removed.

### 5.2 Success measures

- A fresh official Compose deployment reaches initial enrollment without a
  setup command.
- Before operational state, automated negative tests cannot access any control,
  OAuth, or MCP capability outside the explicit setup allowlist.
- A racing initial enrollment produces exactly one complete superadmin or no
  user.
- Every login and enrollment external input has positive and negative contract
  and browser coverage.
- Every session or grant revocation rejects the next authenticated request after
  commit.
- Recreating containers in the official Compose deployment preserves generated
  keys, database state, vault state, and durable audit state.
- Public login and enrollment tests cannot distinguish nonexistent, suspended,
  deactivated, incomplete, or credential-invalid accounts from response content.

## 6. Non-goals

Version 2.1 does not provide:

- Email delivery or email-based password recovery.
- A "forgot password" link, recovery instructions, or self-service recovery
  without a valid temporary credential.
- Periodic bootstrap-secret rotation within one process lifetime.
- Passkeys, WebAuthn, recovery codes, SMS, or other new authenticator types.
- Automatic suspension based on OIDC-provider failures.
- Automatic generation of TLS keys, external OIDC client secrets, database
  credentials, downstream credentials, or backup passphrases.
- A configured-manifest clearing operation, cryptographic factory reset, or remote
  key-regeneration capability.
- Migration or compatibility for pre-release development data.
- Proof from inside a container that an arbitrary writable filesystem is
  durable.
- Multiple active application instances for one installation.

## 7. Users, actors, and trust boundaries

| Actor | Trust and authority |
| --- | --- |
| Unauthenticated browser visitor | May read liveness, readiness, sanitized setup status, login, and unified enrollment surfaces only when their state permits. |
| Initial operator | Has container-log access and may possess the current in-memory bootstrap secret. This grants only initial enrollment authority. |
| User | May manage their profile, local authenticators, browser sessions, and OAuth agent connections. |
| Admin | Retains existing service-scoped user authority and gains only the scoped agent-connection authority defined here. |
| Superadmin | May manage global security settings and all browser sessions and OAuth agent connections, subject to step-up and audit. |
| OIDC provider | Owns external authentication, MFA assurance, and failed-attempt handling for linked external identities. |
| Host-local break-glass operator | Has direct host authority to reset and reactivate a superadmin through the restricted enrollment flow. |
| Provisioning coordinator | Determines the required application-owned key set and advances setup state only after all enabled services validate. |
| SecretSauce service | Generates only its own configured application key material and reports bounded provisioning state. |

Trust boundaries include:

- Container logs to the operator.
- Unauthenticated browser to setup, login, and enrollment endpoints.
- Browser cookie to server-side session validation.
- Control plane to identity, persistence, OAuth, and vault services.
- Compose-managed durable storage to replaceable containers.
- SecretSauce to external OIDC providers.

## 8. Domain model

### 8.1 Installation state

An installation has:

- A non-secret installation identifier.
- A durable non-secret key manifest in `provisioning` or `configured` state.
- Manifest entries for the required key identities, owning components,
  formats/versions, `pending` or `verified` status, and verified key
  fingerprints.
- A configured commitment containing the canonical aggregate digest of every
  required verified manifest entry.
- An internal setup state.
- Zero or more users.

Fingerprints must be collision-resistant, domain-separated digests of canonical
key bytes computed by the owning component. The manifest and configured
commitment must not contain raw keys, credential values, tokens, or reversible
secret material.

### 8.2 Internal setup states

| State | Meaning | Permitted public surface | Exit |
| --- | --- | --- | --- |
| `provisioning` | A valid provisioning manifest exists and required application keys are being generated or validated. A blocked/error substate may retry. | Liveness, readiness, sanitized setup status | All keys validate and the manifest atomically commits to `configured` |
| `enrollment_required` | A valid configured manifest exists, but no user exists. | Health, login, unified enrollment, safe static assets | Initial superadmin commits |
| `operational` | Required keys validate and at least one user exists. | Normal role-authorized product behavior | Fatal key/configuration failure or process stop |
| `configuration_error` | Manifest/key state is ambiguous, missing, malformed, or mismatched under the startup matrix in section 18.2. | No ordinary serving; process exits nonzero | Operator restores correct configuration or completes an explicitly authorized adoption and restarts |

`provisioning` and `enrollment_required` are not unhealthy states. They are not
operationally ready.

### 8.3 Public setup states

Public status must not reveal whether users exist. It exposes only bounded values
such as:

- `preparing`
- `available`
- `not_ready`

The exact internal setup state, missing key identity, key path, user count, and
failure cause are not public.

### 8.4 Bootstrap secret

The bootstrap secret is:

- At least 128 bits of cryptographically secure randomness.
- Encoded for reliable manual copying.
- Generated after key provisioning completes when zero users exist.
- Valid only for the lifetime of the current process.
- Held only in memory.
- Printed once per process start.
- Consumed only by a successful initial-superadmin commit.

### 8.5 Provisional initial enrollment

A provisional initial enrollment:

- Is not a user.
- Has no platform role or ordinary authorization.
- Is bound to the current bootstrap process and restricted enrollment session.
- Contains only the pending information necessary to complete the initial
  ceremony.
- Expires with the existing restricted-session lifetime, 15 minutes by default.
- Is abandoned on process restart or restricted-session expiry.

### 8.6 Session and connection objects

A browser session is an opaque server-side authentication record.

An agent connection is the user-facing representation of an OAuth grant and its
refresh family. User-facing copy uses "agent connection"; technical contracts may
use "OAuth grant."

## 9. Roles and permissions

### 9.1 Authoritative session and connection matrix

| Action | Self: any role | Regular admin targeting ordinary user | Regular admin targeting admin/superadmin | Superadmin targeting another user |
| --- | ---: | ---: | ---: | ---: |
| View own browser sessions | Allow | — | — | — |
| Revoke one own browser session | Allow | — | — | — |
| Revoke all own browser sessions | Allow | — | — | — |
| View another user's browser sessions | — | Deny | Deny | Allow |
| Revoke another user's browser session(s) | — | Deny | Deny | Allow |
| View own agent connections | Allow | — | — | — |
| Revoke one/all own agent connections | Allow | — | — | — |
| View another user's agent connection | — | Allow only when it reaches at least one service and every reachable service is managed by the admin | Deny | Allow |
| Revoke another user's qualifying agent connection(s) | — | Same all-services-managed condition | Deny | Allow |
| Revoke all sessions globally | — | Deny | Deny | Allow |
| Revoke all agent connections globally | — | Deny | Deny | Allow |

An agent connection with no currently reachable service, or containing any
unmanaged service, is wholly unavailable to a regular admin. The product does
not partially display or partially revoke one grant.

### 9.2 Step-up and confirmation

- Individual self-revocation does not require step-up or justification.
- Individual administrative revocation requires step-up and audit.
- Every bulk administrative revocation requires step-up, explicit confirmation,
  justification, atomic execution, and audit.
- Existing role and service-scope rules continue to govern user password/TOTP
  reset and suspension administration.

## 10. Lifecycle and state transitions

### 10.1 Fresh installation

```text
process start
  -> provisioning
  -> enrollment_required
  -> operational
```

If fresh provisioning cannot write or validate a required key, it remains in a
blocked `provisioning` substate and retries. It does not commit the manifest to
`configured`.

If a configured manifest exists and any required key is missing, invalid, or
has a fingerprint different from its committed entry:

```text
process start -> configuration_error -> nonzero process exit
```

### 10.2 Initial enrollment

```text
bootstrap secret accepted
  -> provisional restricted enrollment
  -> profile + password + TOTP prepared
  -> TOTP confirmed
  -> atomic superadmin commit
  -> redirect to login
```

Failure, expiry, restart, or concurrency loss before the atomic commit creates no
user.

### 10.3 Suspension and recovery

```text
active
  -> suspended
  -> enrollment_required
  -> active
```

Every transition from `suspended` toward active use requires an administrative
password reset that also erases TOTP. The user receives a one-time temporary
password, chooses a new password, enrolls a new TOTP authenticator, and becomes
active only after confirmation.

### 10.4 Session and connection revocation

After revocation commits:

- Every subsequently authenticated request using the targeted browser session
  or agent connection is rejected.
- Refresh tokens and access tokens covered by the OAuth revocation are unusable.
- No cache grace period applies.
- A request fully authenticated and dispatched before commit may complete.

Repeating a revocation is an audited no-change success.

## 11. Primary workflows

### 11.1 Automatic key provisioning

1. Startup reads enabled services and configured application key locations.
2. Startup evaluates the manifest, key inventory, and explicit-adoption matrix
   in section 18.2 before permitting any key creation.
3. For a true fresh installation, the coordinator durably creates a
   `provisioning` manifest containing every required key as `pending` before the
   first key-generation attempt.
4. Each owning service reports the SecretSauce-owned keys it requires and
   computes fingerprints locally without exposing raw key values.
5. Each missing `pending` SecretSauce-owned key is created atomically by its single
   designated owning component with restrictive permissions in its configured
   durable location.
6. After a key validates, its owning component reports its fingerprint and the
   manifest entry atomically advances from `pending` to `verified`.
7. A retry validates and records any complete key file already present for a
   `pending` entry, creates only absent `pending` keys, reuses every `verified`
   key, and converges idempotently.
8. Every owning service validates its complete required key set.
9. The coordinator atomically records the canonical aggregate digest and
   advances the manifest to `configured`.
10. Browser status advances from preparing to the branded login/enrollment
   experience.

### 11.2 Initial superadmin enrollment

1. After key setup, startup generates the bootstrap secret and prints it once.
2. The operator opens the neutral **Enroll account** link.
3. The public form asks for email and **Enrollment code**.
4. SecretSauce accepts the current bootstrap secret as an enrollment code without
   revealing that initial setup is occurring.
5. A restricted provisional flow asks for name, compliant password, and TOTP
   enrollment.
6. The operator confirms a fresh TOTP value.
7. SecretSauce atomically creates the first active superadmin, local
   authenticator, bootstrap marker, and audit event.
8. SecretSauce erases the bootstrap secret and provisional sensitive material
   from memory.
9. The browser consumes the restricted session and redirects to login.
10. The new superadmin signs in with email, new password, and TOTP.

### 11.3 Existing-account enrollment and recovery

1. The user opens the same **Enroll account** link.
2. The user submits email and an administrator-issued temporary password as the
   enrollment code.
3. A valid code creates a restricted enrollment session.
4. The user chooses a compliant password.
5. The user enrolls and confirms a new TOTP authenticator when the operation is a
   reset or suspended-account recovery.
6. Successful completion activates the account, consumes the temporary
   credential and restricted session, and redirects to login without creating a
   normal browser session.

### 11.4 Login and logout

The branded login form presents email, password, and six-digit TOTP in one
submission. Configured OIDC providers appear as alternative actions.

Successful local enrollment never signs a user in automatically. Successful
login creates a new normal browser session.

Logout:

- Is visible in the persistent account menu.
- Revokes only the current browser session.
- Clears the current cookie after the revocation transaction commits.
- Is distinct from **Revoke all my web sessions**.

### 11.5 Account settings

The persistent account menu contains **Settings** and **Log out**.

Account Settings contains:

- Profile
- Password and TOTP
- Web sessions
- Agent connections

Superadmins also have a global **Sessions and connections** administration
workspace. Authorized session/connection information also appears in user detail
according to the permission matrix.

## 12. Negative and failure behavior

### 12.1 Provisioning failures

- While a valid provisioning manifest exists, a write, permission, atomicity, or
  validation failure for a still-`pending` key keeps the process live in blocked
  provisioning.
- Blocked provisioning logs an actionable, secret-free diagnostic and retries
  with bounded exponential backoff.
- The public page displays only a safe message and whether retry is pending.
- A missing or mismatched `verified` key and any missing or invalid key under a
  configured manifest are fatal. The service must not regenerate the key, clear
  the manifest, or expose a recovery UI.

### 12.2 Enrollment failures

- Wrong, expired, reused, wrong-account, wrong-mode, and malformed enrollment
  codes use a uniform public response.
- Setup state is not disclosed by the enrollment page, route, initial fields, or
  failure.
- Bootstrap-secret comparison is constant-time.
- A process restart invalidates the old bootstrap secret and abandons incomplete
  provisional initial enrollment.
- Racing completion attempts allow exactly one initial superadmin commit.
- Failure to create every required initial identity record and audit event rolls
  back the entire initial user.

### 12.3 Login failures

The public local-login failure is:

> The email, password, or verification code is incorrect.

It applies uniformly to nonexistent, suspended, deactivated, incomplete,
ineligible, password-invalid, and TOTP-invalid accounts. It does not state
"invalid password."

Rate limiting uses a uniform temporary-unavailability response and does not
identify the account, credential stage, or limit reached.

### 12.4 Enrollment completion and first login

If enrollment commits but redirecting to login fails, the credentials remain
committed and the temporary/bootstrap credential remains consumed. Reloading the
login page permits ordinary sign-in.

The first login after enrollment is an ordinary login and may fail or be rate
limited without rolling back enrollment.

### 12.5 Revocation failures

- Bulk revocation is atomic: all selected active records revoke or none do.
- The initiating browser session is included in a global or self bulk browser
  revocation and is cleared after commit.
- A stale or already absent target returns an authorized no-change result without
  disclosing an out-of-scope target.
- Audit failure follows the existing fail-closed administrative mutation
  contract.

## 13. Functional requirements

### 13.1 Setup and key provisioning

- `SETUP-001` On startup, SecretSauce must determine the complete
  SecretSauce-owned application key set required by every enabled service before
  permitting ordinary product use.
- `SETUP-002` When fresh provisioning is permitted, every missing
  SecretSauce-owned key must be created atomically by exactly one designated
  owning component. Provisioning retries must validate and reuse successfully
  created keys, generate only remaining missing keys, and converge
  idempotently. Setup must not advance until every required key validates.
- `SETUP-003` Automatically generated keys must include, when required by enabled
  features, identity/TOTP encryption keys, browser-session hashing keys, OAuth
  signing and token-hashing keys, vault root and authenticated-caller keys, and
  other SecretSauce-owned integrity keys.
- `SETUP-004` SecretSauce must not automatically generate TLS material, external
  OIDC client secrets, database credentials, downstream service credentials,
  backup passphrases, or other externally owned secrets.
- `SETUP-005` The manifest must advance atomically from `provisioning` to
  `configured` only after every enabled owning service validates its complete
  required key set and the coordinator records the canonical aggregate digest
  of every required verified entry.
- `SETUP-006` A fresh key-generation failure for a `pending` entry must leave the
  manifest in `provisioning`, keep liveness healthy, block all ordinary
  interfaces, expose sanitized status, log secret-free diagnostics, and retry
  with bounded backoff.
- `SETUP-007` If a configured manifest exists and any required key is missing,
  invalid, or fingerprint-mismatched, the affected service must exit nonzero
  without regenerating the key.
- `SETUP-008` No web, control API, login, OAuth, or MCP operation outside the
  explicit setup allowlist may execute before the required setup state permits
  it.
- `SETUP-009` Version 2.1 must not expose a configured-manifest clear, cryptographic
  reset, or regenerate-all-keys operation through web, API, MCP, or CLI.
- `SETUP-010` The official Compose deployment must place generated keys,
  database state, vault state, and durable audit state in declared persistent
  volumes.
- `SETUP-011` Runtime storage validation must verify creation/write access,
  restrictive ownership and modes, atomic replacement, sync behavior, and
  installation continuity where retained state makes continuity observable.
- `SETUP-012` SecretSauce must not claim it can prove that an arbitrary
  container-visible filesystem is durable.
- `SETUP-013` Every application-key identity must have exactly one component
  with generation authority within the permitted setup lifecycle. Other
  components may receive only the access required to use or validate that key.
  Two running components must never race to generate the same key, and automatic
  provisioning must never replace an existing key file.
- `SETUP-014` The official Compose startup order must allow every provisioning
  owner to complete before a key-dependent service declares readiness or exposes
  an ordinary listener. A fresh supported deployment must require no manual
  key-generation command.
- `SETUP-015` A true fresh installation must durably create the complete
  `provisioning` manifest with every required entry in `pending` state before the
  first key-generation attempt. Each entry must atomically record its owner-local
  fingerprint when it advances to `verified`.
- `SETUP-016` A provisioning retry may create only `pending` keys. A missing,
  malformed, or mismatched `verified` key, or a malformed existing key file for
  a `pending` entry, must cause `configuration_error` without creating or
  replacing any key. A valid existing key for a `pending` entry must be
  fingerprinted and advanced to `verified` without replacement.
- `SETUP-017` When no manifest exists, fresh provisioning is permitted only when
  no required key is present and `setup.adopt_existing_keys` is `false` or
  absent. Setting adoption to `true` without a complete key set, or finding
  some-but-not-all required keys with any adoption value, must cause
  `configuration_error`. All required keys must cause `configuration_error`
  unless the host-local `setup.adopt_existing_keys: true` startup setting is
  present.
- `SETUP-018` `setup.adopt_existing_keys` must be accepted only from deployment
  configuration available before database-managed settings. It must not be
  controllable through browser, control API, OAuth, MCP, or remotely invokable
  CLI behavior. It is honored only when no manifest exists and every required
  key is present, must never relax validation, becomes inert after a configured
  manifest exists, and produces a sanitized operator warning until removed.
- `SETUP-019` Complete pre-manifest adoption must not generate or replace keys.
  Every owning component must validate key format, ownership, mode, canonical
  fingerprint, and compatibility with all retained key-bound state before the
  coordinator atomically writes a configured manifest. Any failed or
  unavailable validation must cause `configuration_error` without modifying
  keys or manifest state.

### 13.2 Bootstrap and enrollment

- `ENROLL-001` After key setup, when zero users exist, each process start must
  generate a new bootstrap secret and print it once to container logs.
- `ENROLL-002` The bootstrap secret must have at least 128 bits of
  cryptographically secure randomness, exist only in memory, use constant-time
  comparison, and remain valid only until process exit or successful initial
  enrollment.
- `ENROLL-003` The bootstrap secret must never appear in persistence, browser/API
  responses, audits, telemetry, or any log other than its one intentional
  startup display.
- `ENROLL-004` After process restart with zero users, the previous bootstrap
  secret must be invalid and a new secret must be displayed.
- `ENROLL-005` Login must expose one neutral **Enroll account** link for initial
  and temporary-password enrollment.
- `ENROLL-006` The first enrollment step must request email and **Enrollment
  code** without disclosing whether the code is a bootstrap secret or temporary
  password.
- `ENROLL-007` Invalid enrollment attempts must not disclose user existence,
  setup state, credential type, expiry, reuse, or account eligibility.
- `ENROLL-008` Valid bootstrap-secret submission may create only a provisional,
  restricted enrollment transaction; it must not create a user.
- `ENROLL-009` The initial superadmin user, normalized unique email, name,
  password hash, encrypted confirmed TOTP authenticator, active superadmin role,
  bootstrap marker, and audit event must commit atomically.
- `ENROLL-010` Any missing field, invalid password, invalid/replayed TOTP,
  persistence failure, audit failure, expiry, restart, or concurrency loss before
  commit must result in no initial user.
- `ENROLL-011` Exactly one of multiple concurrent initial completion attempts may
  commit.
- `ENROLL-012` Successful enrollment must consume the restricted session,
  redirect to login, and must not create an authenticated browser session.
- `ENROLL-013` Initial and existing-account enrollment must reuse the same
  password/TOTP enrollment domain operations and user-facing ceremony after
  enrollment-code validation.

### 13.3 Login, logout, and failure disclosure

- `LOGIN-001` The branded local login form must collect email, password, and
  six-digit TOTP in one submission.
- `LOGIN-002` The login page must show configured OIDC providers as alternative
  authentication actions without revealing disabled or internal provider
  configuration.
- `LOGIN-003` The login page must not contain forgot-password, email-recovery,
  recovery-instruction, or remember-me behavior.
- `LOGIN-004` Local authentication failures must use the uniform message defined
  in section 12.3 and comparable verification work.
- `LOGIN-005` The browser must not learn whether a submitted password was valid
  or whether a TOTP failure counted toward suspension.
- `LOGIN-006` A successful login must issue a fresh opaque browser session and
  must not adopt an attacker-supplied or restricted-session identifier.
- `LOGIN-007` Only a validated same-origin relative post-login destination may be
  honored.
- `LOGOUT-001` Every authenticated web view must provide an accessible logout
  action.
- `LOGOUT-002` Logout must atomically revoke the current browser session and
  audit the action before clearing the cookie.

### 13.4 Rate limiting and suspension

- `ABUSE-001` Login must enforce separate bounded account, direct-source, global,
  password-verification, TOTP-verification, and expensive-work concurrency
  controls.
- `ABUSE-002` Local login defaults and configurable bounds must be:

  | Limit | Default | Allowed |
  | --- | ---: | ---: |
  | Login by account/source | 10 / 15 min | 3–20 / 5–60 min |
  | Password verification | 10 / 15 min | 3–20 / 5–60 min |
  | TOTP verification | 5 / 5 min | 3–10 / 1–15 min |
  | Enrollment credential | 10 / 60 min | 3–20 / 15–1440 min |

- `ABUSE-003` Transient rate-limit activation must not suspend an account.
- `ABUSE-004` Superadmins must be able to configure automatic suspension as
  `disabled` or a threshold from 3 through 20 qualifying failures. The default
  must be `disabled`.
- `ABUSE-005` A qualifying failure is an invalid TOTP submitted after successful
  verification of the current password during control login or local MCP OAuth
  authorization.
- `ABUSE-006` OIDC, enrollment, authenticator replacement, and step-up failures
  must not increment the automatic-suspension counter.
- `ABUSE-007` Qualifying failures must be counted durably per user across sources
  and restarts in a rolling 24-hour window.
- `ABUSE-008` Successful login, authorized recovery completion, or host-local
  break glass must clear the user's qualifying-failure counter.
- `ABUSE-009` Reaching the threshold must atomically suspend the user, clear the
  counter, increment the user's security epoch, revoke all browser and restricted
  sessions, OAuth grants/families/tokens, and gateway references, and write a
  sanitized audit event.
- `ABUSE-010` Automatic suspension must retain the uniform public authentication
  failure.
- `ABUSE-011` Lowering a threshold must not suspend a user until their next
  qualifying failure evaluates the new setting. Disabling the feature must clear
  all accumulated qualifying-failure counters.
- `ABUSE-012` Concurrent failures must not bypass the threshold or count one
  attempt more than once.
- `ABUSE-013` The final active superadmin may be automatically suspended by this
  rule, but manual suspension protections remain unchanged.
- `ABUSE-014` OIDC-provider failure counting, lockout, and suspension remain the
  provider's responsibility.

### 13.5 Reset, reactivation, and break glass

- `RECOVER-001` Administrative password reset, suspended-account reactivation,
  and host-local break glass must invalidate both the password and TOTP
  authenticator.
- `RECOVER-002` Suspended-account reactivation must move the account to
  `enrollment_required`, issue a one-time temporary password, and keep the user
  unable to authenticate normally until a new password and new TOTP are
  confirmed.
- `RECOVER-003` Direct transition from `suspended` to `active` without the reset
  ceremony must be prohibited for every suspension origin.
- `RECOVER-004` An expired temporary password must leave the account in
  `enrollment_required` until an authorized administrator issues another reset.
- `RECOVER-005` Host-local break glass targeting a superadmin must reactivate the
  account into restricted enrollment, reset password and TOTP, revoke all user
  sessions/grants/references, clear suspension counters, and preserve the user
  UUID and superadmin role.
- `RECOVER-006` Authenticated self-service password change must retain the
  existing TOTP authenticator and require its verification.
- `RECOVER-007` A system-wide forced password change must retain TOTP unless the
  separately authorized system-wide TOTP reset is also selected.

### 13.6 Browser-session security

- `SESSION-001` Browser and restricted sessions must use cryptographically random
  opaque identifiers in `Secure`, `HttpOnly`, host-scoped cookies with
  appropriate `SameSite` behavior.
- `SESSION-002` Server persistence must store only domain-separated keyed hashes
  of session and CSRF values.
- `SESSION-003` Authentication and privilege transitions must rotate session
  identifiers; a restricted-session cookie must never become a normal session.
- `SESSION-004` Browser mutations must enforce same-origin and CSRF protections.
- `SESSION-005` Sessions must enforce configured inactivity, absolute expiry,
  user/global security epochs, account state, and revocation on every request.
- `SESSION-006` Browser and restricted-session identifiers, CSRF proofs, OAuth
  authorization codes, access tokens, and refresh tokens must appear only in
  their designated delivery channels. Session identifiers may be delivered only
  through `Secure`, `HttpOnly`, host-scoped cookies. Synchronizer CSRF proofs may
  be returned only in `Cache-Control: no-store` responses that establish or
  refresh an authenticated or restricted browser session and must remain in page
  memory. OAuth authorization codes and tokens may appear only in
  protocol-defined redirects or `Cache-Control: no-store` token responses. These
  values must not appear in unrelated API responses, errors, durable browser
  storage, logs, audits, or telemetry.
- `SESSION-007` Device and network metadata must be informational only and must
  not rigidly bind a session to an IP address.
- `SESSION-008` The security contract must claim resistance to fixation, theft,
  and replay through these controls; it must not claim that session hijacking is
  impossible.

### 13.7 Session and agent-connection management

- `ACCESS-001` Account Settings must show the current user's active browser
  sessions and agent connections with the metadata defined in section 14.
- `ACCESS-002` A user must be able to revoke one or all of their browser sessions
  and one or all of their agent connections.
- `ACCESS-003` A superadmin must be able to list and revoke any individual
  browser session or agent connection, all records for one user, and all records
  globally.
- `ACCESS-004` A superadmin viewing a user must see that user's browser sessions
  and agent connections with individual and per-user bulk actions.
- `ACCESS-005` A regular admin viewing an ordinary user must not see browser
  sessions and may see or revoke an agent connection only when it reaches at
  least one service and every service currently reachable through that grant is
  managed by the admin.
- `ACCESS-006` A regular admin must not manage any session or connection owned by
  an admin or superadmin.
- `ACCESS-007` Revocation must take effect for every request authenticated after
  the revocation commit, with no cache grace period.
- `ACCESS-008` Revocation need not terminate a request fully authenticated and
  dispatched before commit.
- `ACCESS-009` Bulk revocation must be atomic. Global and self bulk browser
  revocation must include the initiating session.
- `ACCESS-010` Repeated revocation of an authorized inactive target must return
  an audited no-change success.
- `ACCESS-011` Operational session/grant records may be physically deleted after
  revocation when the immutable audit evidence required by this document
  commits atomically.

### 13.8 Health and interface gating

- `HEALTH-001` `GET /api/v2/health/live` must return HTTP 200 while a process can
  serve bounded status, including during provisioning and initial enrollment.
- `HEALTH-002` `GET /api/v2/health/ready` must return HTTP 200 only in
  `operational`; otherwise it must return HTTP 503 with bounded, sanitized state.
- `HEALTH-003` Official Compose health checks must use liveness rather than
  operational readiness.
- `HEALTH-004` `GET /api/v2/setup/status` must return only a bounded public
  state, safe message, and whether automatic retry is pending.
- `HEALTH-005` Setup status and health must never reveal key values, key names,
  configured paths, user counts, credentials, tokens, internal hostnames,
  stack traces, or raw internal errors.
- `HEALTH-006` Before ordinary use is permitted, disallowed web/control routes
  must return a uniform HTTP 503 maintenance response.
- `HEALTH-007` Before ordinary use is permitted, MCP and OAuth must return
  bounded temporary-unavailability behavior with `Retry-After` and no missing
  prerequisite disclosure.

## 14. Data handling and privacy

### 14.1 Bootstrap and enrollment data

- The raw bootstrap secret exists only in process memory and its one intentional
  startup log line.
- Provisional password and TOTP material must be held only as long as required
  for the restricted ceremony and erased where the runtime permits after commit,
  failure, expiry, or restart.
- Passwords, TOTP seeds/codes, temporary passwords, and enrollment codes are
  secret inputs and are excluded from ordinary logs, audits, analytics,
  telemetry, error reports, and browser persistence.

### 14.2 Browser-session display metadata

The UI may display:

- Current-session marker.
- Creation time.
- Last activity time.
- Expiry time.
- Authentication method.
- Sanitized derived browser/device family.
- Coarse source network.

Coarse source network means IPv4 truncated to `/24` and IPv6 truncated to `/48`.
Full raw user-agent strings and full IP addresses are not displayed. Missing
metadata appears as **Unknown** and does not invalidate the session.

User-agent and source values are untrusted, length-bounded external inputs.
Derived labels must be escaped and must not introduce markup.

### 14.3 Agent-connection display metadata

The UI may display:

- Client name and public identifier.
- Authentication method.
- Creation, last-use, and expiry times.
- Requested scopes.
- Current service names.
- Current usability/status.

No authorization code, access token, refresh token, token hash, cookie, CSRF
value, or gateway reference is displayed.

### 14.4 Retained audit evidence

Session and connection revocation audit events retain:

- Action and outcome.
- Actor UUID, role, and authentication method.
- Target user UUID.
- Opaque session or grant UUID.
- Scope.
- Timestamp.
- Revocation counts.
- Correlation identifier.
- Required justification.

They exclude raw session/cookie/CSRF/token/reference values, raw user-agent
strings, full IP addresses, request bodies, and downstream response bodies.

Audit evidence follows the existing administrative-audit retention contract even
if the operational session/grant row is deleted.

## 15. Security requirements

- Authentication, destination validation, authorization policy, and capacity
  enforcement must remain ahead of credential substitution and downstream I/O.
- Setup gating must occur before authentication handlers, OAuth issuance, MCP
  request parsing that can cause work, credential substitution, or downstream
  HTTP calls.
- Bootstrap and temporary-password verification must use rate limits and
  comparable failure work without logging raw credentials.
- The initial bootstrap secret is bearer authority only for provisional first
  enrollment and cannot authorize any other endpoint.
- Initial superadmin commit must include an immutable sanitized audit event in
  the same transaction.
- Automatic-suspension counters must be keyed by immutable user UUID after
  password verification, never by attacker-controlled email text alone.
- Session revocation checks must not depend on transport session state or
  `mcp-session-id`.
- OAuth and MCP remain stateless at the HTTP transport layer and authenticate
  every request independently.
- Session-management filters and identifiers must enforce actor and service
  scope before returning target existence.
- Every new external setup, enrollment, login, session-metadata, and
  revocation input requires positive and negative tests.

## 16. Interfaces and integrations

### 16.1 Public browser routes

The public browser experience includes:

- Branded login.
- Neutral **Enroll account** entry.
- Safe setup-status presentation while provisioning.
- Configured OIDC provider actions.

The browser must not need a setup-specific initial-superadmin URL.

### 16.2 Health contracts

The health paths and semantics in `HEALTH-001` through `HEALTH-007` are stable
product contracts. Exact internal component wiring remains an architecture
decision.

### 16.3 Container logs

The one bootstrap-secret line must:

- Be clearly labeled as a one-time initial enrollment secret.
- State that it is invalidated by successful enrollment or restart.
- Avoid surrounding configuration, environment values, or other secrets.
- Never be repeated by periodic status logging.

Documentation must warn that Docker and platform logs may be retained or
forwarded and must be access-controlled.

### 16.4 OIDC boundary

The branded login page may initiate configured OIDC flows. OIDC-provider
authentication failures do not enter local suspension accounting. OIDC flow
initiation and callback endpoints retain their own abuse limits and uniform
public failures.

## 17. UX requirements

### 17.1 Branding and accessibility

Login, enrollment, setup status, and account settings must:

- Use the existing SecretSauce brand system.
- Work at narrow and wide viewport sizes.
- Support keyboard-only completion.
- Preserve visible focus.
- Use programmatic labels and appropriate autocomplete attributes.
- Announce errors, loading, success, and redirects through accessible status
  regions.
- Permit password-manager paste and autofill.
- Avoid disabling paste into password or TOTP fields.

### 17.2 Login

- Email, password, and TOTP appear together.
- OIDC alternatives are visually distinct without implying different authority.
- The page contains no forgot-password or remember-me control.
- Authentication and rate-limit messages do not identify the failed factor.
- A validated relative destination may be resumed after login.

### 17.3 Setup status

- During provisioning, the browser displays a concise preparing message and
  safe retry status.
- A blocked fresh setup explains that setup could not complete and directs the
  operator to deployment diagnostics without exposing internal details.
- Public UI wording must not announce that zero users exist.
- Once key setup permits authentication surfaces, the ordinary branded login
  and neutral enrollment link replace setup progress.

### 17.4 Enrollment

- The initial form labels the secret or temporary password **Enrollment code**.
- Name is requested only after a valid initial bootstrap code establishes a
  restricted session.
- TOTP seed/QR is displayed only within the restricted enrollment ceremony.
- The user must confirm a fresh TOTP before activation.
- Successful completion redirects to login with:
  **Enrollment complete. Sign in with your new credentials.**

### 17.5 Settings and administrative views

- The top-bar account menu exposes **Settings** and **Log out** on every
  authenticated page.
- Account Settings groups Profile, Password and TOTP, Web sessions, and Agent
  connections.
- Destructive bulk actions identify exact scope, require confirmation, and warn
  when the current session will be revoked.
- Current session is clearly identified.
- Device/source metadata is described as informational.
- Superadmin global views and user-detail views apply the same terminology and
  revocation semantics as self-service views.

## 18. Operations and deployment

### 18.1 Supported deployment

The supported v2.1 deployment is the official single-instance Docker Compose
configuration with declared durable volumes and no initialization CLI.

The operator must still:

- Start Docker Compose.
- Read the initial enrollment secret from access-controlled container logs.
- Open the browser and complete enrollment.

### 18.2 Storage validation and limits

Inside a container, SecretSauce can validate filesystem behavior and continuity
but cannot prove durability. It must not access the Docker socket to inspect
volume configuration.

The official deployment and release tests, rather than an unsafe runtime
heuristic, establish supported persistence behavior.

Startup applies this authoritative matrix before key generation:

| Manifest | Required keys | `setup.adopt_existing_keys` | Required behavior |
| --- | --- | --- | --- |
| Absent | None present | `false` or absent | Create the complete `provisioning` manifest before generating the first key |
| Absent | None present | `true` | Enter `configuration_error`; create no key and require removal of the inapplicable adoption setting |
| Absent | Some but not all present | Any value | Enter `configuration_error`; create or replace no key |
| Absent | All present | `false` or absent | Enter `configuration_error` and direct the operator to the explicit adoption setting |
| Absent | All present | `true` | Run complete owner-local adoption validation; atomically create a configured manifest only if every validation succeeds |
| `provisioning` | All `verified` entries match; `pending` key files are valid or absent | Ignored | Validate and record present `pending` keys, then create only absent `pending` keys |
| `provisioning` | Any `verified` entry is missing/mismatched or an existing `pending` key file is malformed | Ignored | Enter `configuration_error`; create or replace no key |
| `configured` | Every required fingerprint and aggregate digest match | Ignored | Continue to `enrollment_required` or `operational` |
| `configured` | Any required key, fingerprint, or aggregate digest missing or mismatched | Ignored | Enter `configuration_error`; create or replace no key |

If all key and manifest storage is discarded, the installation is
indistinguishable from an intentional fresh installation only when no required
key remains. Retained application data does not authorize automatic key
replacement. Complete pre-manifest key adoption is the sole exception and
requires the explicit host-local setting plus successful compatibility
validation by every owning component.

### 18.3 Observability

Provisioning logs may include:

- Safe phase/category.
- Owning component.
- Success, retry, or fatal outcome.
- Sanitized error category.

They must not include raw keys, credentials, tokens, cookies, authorization
headers, downstream response bodies, or the contents of secret files.

The bootstrap-secret exception is limited to the one deliberate line defined in
this document.

## 19. Migration, rollout, and compatibility

- V2.1 rollout targets fresh installations.
- Pre-release development state may be cleared.
- No automated adoption of an older configured flag, key manifest, user
  database, or key layout is required. The only supported adoption path is a
  complete current-layout required key set with no manifest, explicitly enabled
  by `setup.adopt_existing_keys: true` and validated under `SETUP-019`.
- Release qualification must use a clean deployment and container-recreation
  persistence test.
- Codex and ChatGPT MCP/OAuth compatibility must be revalidated after setup
  gating and login changes.

## 20. Performance and limits

- Health and setup-status responses must remain lightweight and must not trigger
  key generation inline with a browser request.
- Provisioning retries must use bounded exponential backoff capped at an
  architecture-defined maximum no greater than 60 seconds.
- Setup-status polling must use a bounded interval and must not create unbounded
  server work or logs.
- Bootstrap and enrollment attempts use the enrollment limits in `ABUSE-002`.
- Authentication password/TOTP work retains bounded global and per-source
  concurrency.
- Session and grant lists retain bounded pagination; bulk revocation must use
  bounded database transactions or an equivalent atomic durable operation.

## 21. Acceptance criteria

### 21.1 Setup

1. A clean official Compose start automatically creates every configured missing
   SecretSauce-owned key with restrictive permissions.
2. TLS, OIDC client, database, downstream, and backup secrets are never invented.
3. Login, control API, OAuth, and MCP requests fail uniformly before key setup
   permits them.
4. Liveness remains 200 and readiness remains 503 during provisioning and initial
   enrollment.
5. A fresh unwritable key location remains live, exposes safe status, retries,
   and never advances the manifest to `configured`.
6. After configuration, removing or corrupting one required key causes nonzero
   startup exit without key replacement.
7. Recreating official Compose containers preserves keys, identities, vault
   state, and durable audits.
8. Restart after any individual fresh key creation validates and reuses that key,
   creates only remaining missing keys, and reaches the same complete key
   manifest.
9. Repeating or interrupting fresh provisioning cannot rotate a valid generated
   key or cause two components to generate the same key identity.
10. A clean official Compose start has no provisioning dependency cycle and
    requires no initialization CLI or manual key-generation command.
11. A true fresh start persists the complete `provisioning` manifest before
    attempting the first key creation.
12. With no manifest, startup exits nonzero without creating or replacing a key
    when adoption is `true` but no required key is present, or when only some
    required keys are present with any adoption value.
13. With no manifest and every required key present, startup exits nonzero
    without the adoption setting and identifies only the sanitized operator
    action required.
14. With no manifest, every required key present, and
    `setup.adopt_existing_keys: true`, successful owner-local compatibility
    validation creates a configured manifest without changing any key.
15. A malformed adoption setting or failed, unavailable, or incompatible
    owner-local adoption validation exits nonzero without modifying keys or
    manifest state.
16. A missing or mismatched `verified` key under a provisioning manifest and any
    mismatch under a configured manifest exit nonzero without creating,
    replacing, or recommitting a key.

### 21.2 Initial enrollment

1. With zero users, startup prints exactly one new bootstrap secret.
2. Restart invalidates the prior secret and prints one replacement.
3. The raw secret is absent from database, API, browser responses, audit,
   telemetry, and all other log lines.
4. Invalid code, invalid profile, invalid password, invalid/replayed TOTP, expiry,
   restart, audit failure, and persistence failure create no user.
5. Concurrent valid completion produces one complete superadmin.
6. Successful completion redirects to login without an authenticated session.
7. The new superadmin must prove email, password, and TOTP through ordinary login.

### 21.3 Login, limits, and suspension

1. Local and OIDC choices are available on the branded accessible login page.
2. No forgot-password, recovery-instruction, or remember-me action exists.
3. Nonexistent, suspended, deactivated, incomplete, password-invalid, and
   TOTP-invalid local accounts have the same 401 body and comparable work.
4. Rate limits enforce account, source, global, password, TOTP, enrollment, and
   concurrency boundaries without disclosing which limit fired.
5. Wrong passwords and transient rate limits never increment durable suspension.
6. Correct-password/wrong-TOTP failures from control login and local OAuth share
   one durable rolling 24-hour counter.
7. At threshold, the account and all its sessions, grants, tokens, and references
   become unusable in one atomic audited transition.
8. OIDC, enrollment, replacement, and step-up failures do not increment the
   counter.
9. Disabling automatic suspension clears counters.
10. The final superadmin can be automatically suspended and recovered through
    host-local break glass.

### 21.4 Recovery

1. Every suspended-account reactivation resets password and TOTP and routes the
   user through restricted enrollment.
2. Administrative password reset and host-local break glass also reset password
   and TOTP.
3. Authenticated self-service password change retains TOTP.
4. No reset/recovery session can authorize ordinary control, OAuth, or MCP.

### 21.5 Session security and management

1. Fixation, CSRF, stolen restricted-session, expired-session, revoked-session,
   and epoch-invalidated-session tests fail closed.
2. Browser and restricted-session identifiers, CSRF proofs, OAuth authorization
   codes, access tokens, and refresh tokens appear only in their designated
   delivery channels and are absent from unrelated responses, errors, durable
   browser storage, logs, audits, and telemetry.
3. Users can view and revoke one/all of their sessions and agent connections.
4. Superadmins can perform individual, per-user, and global actions.
5. Regular admins cannot see browser sessions and cannot see any agent
   connection containing an unmanaged service.
6. The first request authenticated after revocation commit is rejected.
7. Bulk revocation is atomic and includes the initiating session when in scope.
8. Removing operational records retains the required immutable audit evidence.

### 21.6 UX and privacy

1. Login, enrollment, setup, logout, and session management pass keyboard,
   focus, label, status-announcement, and responsive browser tests.
2. Enrollment pages do not publicly reveal whether initial setup or an existing
   account flow applies.
3. Session views show only permitted metadata, coarse networks, and sanitized
   device families.
4. Logout is available from every authenticated view.
5. Destructive bulk actions communicate scope and current-session effects.

## 22. Testing requirements

- Unit tests for setup state transitions, required-key inventory, manifest
  entry transitions, canonical owner-local fingerprints, aggregate commitment,
  validation, bootstrap generation/comparison/erasure boundaries, suspension
  counters, rolling-window behavior, and scope predicates.
- Persistence tests for atomic configured-manifest commit, initial-superadmin
  commit, counter/suspension/revocation commit, bulk revocation, audit coupling,
  and concurrency races.
- Positive and negative contract tests for every new setup, enrollment, login,
  metadata, filter, confirmation, and revocation input.
- Process tests for fresh provisioning, interruption and restart at every
  per-key and manifest transition, idempotent key reuse, no-manifest
  none/some/all key inventories with valid and invalid adoption settings,
  incompatible retained-state adoption, blocked retry, restart secret rotation,
  configured missing-key fatal exit, and multi-service key readiness.
- Browser tests for branded login, unified enrollment, no setup-state disclosure,
  TOTP confirmation, redirect-to-login, logout, account settings, administrative
  scope, bulk confirmation, accessibility, and narrow screens.
- Security tests for enumeration resistance, timing comparability, brute-force
  limits, session fixation, CSRF, session replay after revocation, restricted
  session privilege denial, open redirect, markup injection through metadata,
  log/audit secret absence, positive delivery through every designated session,
  CSRF, and OAuth channel, and absence of those values from every prohibited
  channel.
- OAuth/MCP tests from both Codex and ChatGPT after operational setup, including
  pre-operational temporary unavailability and post-revocation denial.
- Compose release tests that create a clean installation, enroll the first
  superadmin, recreate containers, and verify durable continuity.
- A self-signed HTTPS transport test remains required wherever downstream
  transport behavior changes; this PRD does not authorize weakening that
  existing invariant.

## 23. Documentation requirements

Operator documentation must cover:

- Fresh Compose startup and browser enrollment.
- The one-time complete-key adoption setting, its exact eligibility conditions,
  its inert behavior after configuration, and the requirement to remove it after
  successful adoption.
- Where the one-time bootstrap secret appears.
- The fact that Docker/platform logs may be retained or forwarded and require
  access control.
- Liveness versus operational readiness.
- Safe diagnosis of blocked provisioning.
- Fatal behavior after configured key loss and restoration of the correct key.
- Durable volume expectations and the limit of in-container persistence
  detection.
- Host-local superadmin break glass.

User documentation must cover:

- Local and OIDC login.
- Unified enrollment using an enrollment code.
- Password/TOTP reset behavior.
- Automatic TOTP-failure suspension at a conceptual level without exposing
  security-sensitive counter state on the login page.
- Settings, logout, web sessions, agent connections, metadata limitations, and
  revocation effects.

Security documentation must state:

- Session controls resist but cannot make cookie theft impossible.
- TOTP is not phishing-resistant.
- The initial bootstrap secret is intentionally printed once and must be treated
  as a temporary bearer credential.
- OAuth provider failure policy remains provider-owned.

Examples must use `example.org` hostnames. ChatGPT setup documentation must keep
OAuth issuer/resource origins distinct from the MCP Server URL containing the
MCP path.

## 24. Architecture-review questions

These questions concern mechanisms and must not change the product contract:

1. Where should the installation identifier, progressive key manifest, and
   configured aggregate commitment live so per-entry progress and final
   multi-service validation commit atomically?
2. Which component coordinates the designated per-key owners, and how does the
   official Compose startup order avoid a cycle between provisioning owners and
   key-dependent consumers?
3. How should provisional initial-enrollment state be represented without
   creating a user before final commit?
4. Which internal key inventory API lets each designated owner generate and
   validate only its keys, report canonical fingerprints and retained-state
   compatibility, and avoid exposing raw key material?
5. Which bounded retry scheduler and status propagation mechanism best serves
   blocked fresh provisioning?
6. Which user-agent parser or internal derivation produces safe bounded
   browser/device families with an acceptable maintenance and supply-chain
   profile?
7. When may revoked operational session/grant rows be physically removed while
   preserving API idempotency and immutable audit evidence?
8. Which transactional strategy provides atomic high-cardinality global
   revocation within supported scale?

## 25. Settled decisions

- Setup uses four internal states: provisioning, enrollment required,
  operational, and configuration error.
- Public setup responses do not announce that zero users exist.
- Automatic provisioning is limited to SecretSauce-owned application keys.
- Each application-key identity has one designated owning component; each key is
  created atomically, interrupted fresh provisioning reuses valid created keys,
  and the complete key set converges idempotently without a manual setup command.
- A progressive manifest exists before the first key creation, records
  owner-local canonical fingerprints, and commits to `configured` only after
  every required entry verifies.
- Without a manifest, a partial required key set is always fatal and a complete
  required key set is adopted only with the explicit host-local
  `setup.adopt_existing_keys: true` setting and complete owner-local
  compatibility validation.
- Fresh `pending`-key provisioning failures stay live and retry; a missing or
  mismatched `verified` or configured key is fatal and never regenerated.
- There is no configured-manifest clearing or cryptographic-reset capability.
- The official Compose deployment uses durable volumes, but the container does
  not claim it can prove arbitrary mount durability.
- The process-lifetime bootstrap secret is printed once, kept only in memory,
  replaced on restart, and erased after successful enrollment.
- Initial superadmin creation is atomic; provisional state is not a user.
- Initial and ordinary enrollment share one neutral link and one password/TOTP
  ceremony.
- Enrollment redirects to login and does not authenticate the user.
- Local login collects email, password, and TOTP together and uses a uniform
  failure message.
- No forgot-password, recovery-instruction, or remember-me feature exists.
- Qualifying TOTP failures after a valid password may suspend local accounts
  within a fixed rolling 24-hour window.
- Automatic suspension is default-off and configurable from 3 through 20.
- OIDC failure policy remains external-provider-owned.
- Even the final superadmin may be automatically suspended and recovered through
  host-local break glass.
- Every suspended-account reactivation and every administrative/recovery
  password reset also resets TOTP.
- Authenticated self-service password change retains TOTP.
- Browser sessions follow the explicit fixation, CSRF, rotation, expiry,
  revocation, and secret-handling controls in this document.
- Browser-session identifiers, CSRF proofs, OAuth authorization codes, access
  tokens, and refresh tokens use only their explicit designated delivery
  channels and remain absent from unrelated responses, errors, durable browser
  storage, logs, audits, and telemetry.
- Revocation is immediate for requests authenticated after commit; in-flight
  dispatched work may complete.
- Users manage their own sessions and agent connections; superadmins have global
  authority; regular admins never see browser sessions and receive only
  all-services-within-scope agent-connection authority.
- Session/grant operational records may be deleted when immutable sanitized
  audit evidence remains.
- There is no deployed-state migration requirement for v2.1 beyond the explicit
  complete current-layout pre-manifest key adoption path.

## 26. Requirement traceability

| Capability/risk | Requirements | Acceptance |
| --- | --- | --- |
| Automatic fail-closed key setup | `SETUP-001`–`SETUP-019` | 21.1 |
| Atomic initial superadmin | `ENROLL-001`–`ENROLL-013` | 21.2 |
| Branded uniform login/logout | `LOGIN-001`–`LOGIN-007`, `LOGOUT-001`–`LOGOUT-002` | 21.3, 21.6 |
| Rate limits and durable suspension | `ABUSE-001`–`ABUSE-014` | 21.3 |
| Reset/reactivation consistency | `RECOVER-001`–`RECOVER-007` | 21.4 |
| Session-hijacking resistance | `SESSION-001`–`SESSION-008` | 21.5 |
| Scoped revocation and audit | `ACCESS-001`–`ACCESS-011` | 21.5 |
| Health before setup | `HEALTH-001`–`HEALTH-007` | 21.1 |
| Secret and personal-data minimization | Sections 14–16 | 21.2, 21.5, 21.6 |
| Browser-first Compose deployment | `SETUP-010`–`SETUP-019`, sections 18–19 | 21.1 |

## 27. Review readiness

### 27.1 Security-review focus

- Bootstrap-secret exposure, verification, lifetime, and rate limits.
- Setup-route allowlisting and middleware order.
- Atomic initial identity creation and provisional-state isolation.
- Authentication timing and enumeration resistance.
- Durable suspension race safety and final-superadmin recovery.
- Session fixation, CSRF, cookie scope, rotation, replay, and revocation.
- Admin service-scope enforcement for OAuth grants.
- Secret-free setup, audit, and logging behavior.

### 27.2 Architecture-review focus

- Multi-service key ownership and atomic configured-state coordination.
- Durable setup-state and manifest representation.
- Restricted provisional enrollment without premature user creation.
- High-cardinality atomic revocation.
- Compose storage layout and continuity checks.

### 27.3 UX-review focus

- Setup-state privacy alongside useful progress.
- One neutral enrollment route for two credential types.
- Uniform errors that remain actionable without leaking factors.
- Login, enrollment, logout, Settings, and administrative session workflows.
- Accessibility, responsive behavior, and destructive-action confirmation.

### 27.4 Data/API-review focus

- Setup/health response schemas.
- New suspension settings and counter lifecycle.
- Session metadata normalization and privacy.
- Scoped list/revocation contracts, pagination, idempotency, and audit evidence.

### 27.5 Milestone-planning prerequisites

- Security, architecture, UX, and data/API reviews must approve their respective
  focus areas.
- Architecture must resolve the questions in section 24 without changing the
  settled product contract.
- Milestones must preserve a vertical, testable setup-to-enrollment path and may
  not expose partial interfaces between slices.

## 28. Final readiness declaration

**Implementation-ready: yes**

All material product decisions identified during the v2.1 ambiguity audit are
resolved in this document. Remaining questions in section 24 concern internal
mechanisms and do not change user-visible behavior, authorization, security
posture, lifecycle, failure behavior, or acceptance criteria.

Required downstream reviews:

- Security review
- Architecture review
- UX and accessibility review
- Data-model and API-contract review
- Milestone planning
