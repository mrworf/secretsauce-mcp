# Product Requirements Document: SecretSauce v2.1

> **Browser-first secure setup, authentication, and session control**

## 1. Document status

- Product: SecretSauce (MCP)
- Version: 2.1
- Status: Product contract and Milestone 00 implementation baseline approved;
  implementation proceeds through the dependency-ordered v2.1 milestones
- Date: 2026-07-24
- Last reviewed: 2026-07-27
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
- Host-authorized identity and vault envelope-root rotation remains available
  only as the explicit setup-only maintenance startup defined by this document.

### 3.2 Behavior changed

Version 2.1 changes:

- Fresh key provisioning from operator-run commands to automatic startup
  provisioning for SecretSauce-owned application keys.
- Fresh installations provision the fixed v2.1 superset of SecretSauce-owned
  application key identities, independent of enabled features.
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
   narrow, explicitly accepted bearer-secret delivery through the
   operator-controlled container log sink. It is never copied to other logs,
   audits, APIs, or application persistence.
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
- Enabling or disabling a v2.1 feature does not add, remove, regenerate, or
  retire a manifest key identity.
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
| Initial operator | Has infrastructure-administrator authority and access to the operator-controlled container logs. Reading the current bootstrap-secret line grants initial enrollment authority until successful enrollment or process restart. |
| User | May manage their profile, local authenticators, browser sessions, and OAuth agent connections. |
| Admin | Retains existing service-scoped user authority and gains only the scoped agent-connection authority defined here. |
| Superadmin | May manage global security settings and all browser sessions and OAuth agent connections, subject to step-up and audit. |
| OIDC provider | Owns external authentication, MFA assurance, and failed-attempt handling for linked external identities. |
| Reverse proxy | Optionally supplies client-source information under the host-local source-resolution policy. It is trusted only as configured; `always` mode deliberately treats forwarding information from every immediate peer as authoritative. |
| Host-local break-glass operator | Has direct host authority to reset and reactivate a superadmin through the restricted enrollment flow. |
| Host-local key-maintenance operator | Has infrastructure-administrator authority to restart the vault with `--rotate-root-key identity` or `--rotate-root-key vault` plus a fresh non-secret `--rotation-request-id <UUID>`. No browser, REST, control, OAuth, or MCP caller receives this authority. |
| Vault provisioning entrypoint | Sole setup coordinator, manifest writer, and generator for every SecretSauce-owned application key. It also owns the explicit setup-only envelope-root rotation transition, invokes closed key-type and store adapters, inspects retained state, and never accepts a remote provisioning or rotation trigger. |
| SecretSauce runtime service | Starts concurrently in setup-only mode, consumes only its assigned keys after provisioning, validates them before use, and projects bounded vault status to browser, OAuth, and MCP clients. It never generates or replaces application keys. Its private vault socket volume is read-only, so it may connect but cannot bind, unlink, rename, or replace a vault endpoint. |

Trust boundaries include:

- Container logs to the operator.
- Unauthenticated browser to setup, login, and enrollment endpoints.
- Browser cookie to server-side session validation.
- Control plane to identity, persistence, OAuth, and vault services.
- Privileged vault provisioning entrypoint to generated-key directories,
  retained-state inventories, and the durable setup-state volume.
- Explicit root-key maintenance entrypoint to the selected versioned root-key
  location and exclusive, bounded write access to the affected encrypted store.
- Runtime application to the vault's private read-only provisioning-status
  REST socket and authenticated credential REST socket.
- Compose-managed durable storage to replaceable containers.
- SecretSauce to external OIDC providers.

## 8. Domain model

### 8.1 Installation state

An installation has:

- A non-secret installation identifier.
- A durable non-secret key manifest in `provisioning` or `configured` state.
- Manifest entries for the required key identities, consuming components,
  vault-owned provisioning adapters, formats/versions, `pending` or `verified`
  status, and verified key fingerprints.
- A fixed, release-versioned registry containing every SecretSauce-owned
  application key identity supported by v2.1, whether or not its consuming
  feature is enabled.
- A configured commitment containing the canonical aggregate digest of every
  required verified manifest entry.
- At most one durable non-secret root-rotation journal and non-secret
  completed-request receipts keyed by canonical request UUID and retained for
  the installation lifetime.
- A retained key-bound state inventory covering application database,
  identity/authenticator, OAuth grant/token, vault ciphertext/store identity,
  durable audit-lineage, installation-marker, and any other persisted state
  whose confidentiality, integrity, or recoverability depends on a required
  application key.
- An internal setup state.
- Zero or more users.

Fingerprints must be collision-resistant, domain-separated digests of canonical
key bytes computed by the vault provisioning adapter that owns the key format.
The manifest and configured commitment must not contain raw keys, credential
values, tokens, or reversible secret material. A retained-state inventory
reports only whether recognized key-bound state is definitively absent/empty,
present, or indeterminate; it must not expose protected record contents.

The exact v2.1 logical key registry is:

| Logical identity | Purpose |
| --- | --- |
| `identity.envelope-root` | Wrap identity/TOTP data-encryption keys; may have versioned physical instances during explicit identity-root rotation |
| `identity.session-hmac` | Hash browser, enrollment, and restricted-session bearer values in their domain-separated uses |
| `control.idempotency-hmac` | Protect control-plane idempotency identities |
| `oauth.signing` | Sign built-in OAuth tokens or assertions |
| `oauth.token-hmac` | Hash built-in OAuth authorization, access, and refresh bearer values in their domain-separated uses |
| `vault.envelope-root` | Wrap vault record data-encryption keys; may have versioned physical instances during explicit vault-root rotation |
| `vault.caller.data-plane` | Authenticate data-plane vault requests and responses |
| `vault.caller.control-plane` | Authenticate control-plane vault requests and responses |
| `vault.caller.backup` | Authenticate backup-coordinator vault requests and responses |
| `vault.capability.resolve` | Authenticate one-use credential-resolution capabilities |
| `vault.capability.backup` | Authenticate one-use backup/restore capabilities |

These are logical identities, not prescribed file paths. A versioned root
transition does not add a logical identity. Adding any other automatically
generated identity requires an explicit amendment to this product contract or a
reviewed later-version migration.

### 8.2 Internal setup states

| State | Meaning | Permitted public surface | Exit |
| --- | --- | --- | --- |
| `provisioning` | Fresh-start preflight is running, a valid provisioning manifest exists and required application keys are being generated or validated, or an explicitly requested envelope-root maintenance transition is validating, rotating, rewrapping, or committing. A blocked/error substate may retry. | Liveness, readiness, sanitized setup status | Preflight rejects to `configuration_error`, or all keys/affected records validate and the manifest atomically commits to `configured` |
| `enrollment_required` | A valid configured manifest exists, but no user exists. | Health, login, unified enrollment, safe static assets | Initial superadmin commits |
| `operational` | Required keys validate and at least one user exists. | Normal role-authorized product behavior | Fatal key/configuration failure or process stop |
| `configuration_error` | Manifest/key/retained-state continuity is ambiguous, missing, malformed, or mismatched under the startup matrix in section 18.2. | Vault status-only REST socket, application liveness/readiness, sanitized setup status; no credential API or ordinary serving | Operator restores the matching state, key, and manifest set or completes an explicitly authorized adoption and restarts |

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

The vault exposes a separate private, read-only HTTP/1.1 provisioning-status
REST resource over a Unix-domain socket. Its closed response contains only:

- state: `preparing`, `ready`, or `configuration_error`;
- whether automatic retry is pending; and
- a stable sanitized error category when state is `configuration_error`.

The status request is authorized by socket filesystem permissions because the
authenticated vault caller keys may not exist yet. It accepts no request body,
query, provisioning command, path parameter, key identity, or other
caller-controlled field. The application maps this private result to the
bounded public setup states; a browser, OAuth client, or MCP client never
connects to the vault directly.

Both private socket parents are owned by the vault identity, contain no
symlinked path component, and are not writable by any application, data,
control, backup, or unrelated workload identity. The application receives the
socket volume read-only. Before connecting, every first-party client validates
the expected parent and endpoint type, owner, and mode and fails closed if the
endpoint is missing, replaced, or unsafe.

### 8.4 Bootstrap secret

The bootstrap secret is:

- At least 128 bits of cryptographically secure randomness.
- Encoded for reliable manual copying.
- Generated after key provisioning completes when zero users exist.
- Valid only for the lifetime of the current process.
- Retained by the application only in process memory and intentionally copied
  once to the operator-controlled container log sink.
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
process start
  -> configuration_error
  -> status-only vault + setup-only application
  -> operator restores matching configuration and restarts
```

The vault credential REST socket and every ordinary application interface
remain closed throughout `configuration_error`.

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

1. The vault provisioning entrypoint and application start concurrently. The
   application loads structural configuration and exposes only liveness,
   readiness, sanitized setup status, and safe static assets; it does not open
   the database writer, load application keys, or enable ordinary web, control,
   OAuth, or MCP behavior.
2. The vault provisioning entrypoint reads the fixed v2.1 key registry and
   configured key locations, determines the complete release-versioned superset
   of SecretSauce-owned key identities, and loads the closed provisioning and
   retained-state adapters for those keys. Enabled features do not change this
   set.
3. Before any write, the entrypoint evaluates the manifest, key inventory,
   retained key-bound state inventory, and explicit-adoption matrix in section
   18.2.
4. For a true fresh installation, the entrypoint durably creates the complete
   `provisioning` manifest in its dedicated setup-state volume with every
   required key as `pending` before the first key-generation attempt.
5. Each missing `pending` key is created atomically and without replacement by
   its vault-owned key-type adapter, with restrictive ownership and permissions
   for its runtime consumer.
6. After an adapter validates a key and computes its canonical fingerprint, the
   corresponding manifest entry atomically advances from `pending` to
   `verified`.
7. A retry validates and records any complete key file already present for a
   `pending` entry, creates only absent `pending` keys, reuses every `verified`
   key, and converges idempotently.
8. After every adapter validates its complete key set, the entrypoint atomically
   records the canonical aggregate digest and advances the manifest to
   `configured`.
9. The entrypoint relinquishes setup-only write access that the runtime vault
   does not need, drops to the runtime vault identity, opens the authenticated
   credential REST socket, and reports `ready` on the separate status REST
   socket.
10. The application observes vault `ready`, independently validates every key
    assigned to its runtime components against the read-only configured
    manifest, then initializes persistence, audit, jobs, and ordinary listeners
    in their established order.
11. Browser status advances from preparing to the branded login/enrollment
    experience only after application initialization succeeds. OAuth and MCP
    remain temporarily unavailable until the application is operational.

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
- On revocation or audit failure, leaves the cookie and session active, remains
  on the authenticated page, and presents a retryable failure rather than a
  success state.
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

### 11.6 Explicit envelope-root rotation

1. An infrastructure administrator restarts the vault with
   `--rotate-root-key identity` or `--rotate-root-key vault` plus a fresh
   non-secret canonical UUID in `--rotation-request-id`.
2. The vault and application remain in setup-only `provisioning`; the
   authenticated credential REST socket, database writer, and ordinary
   interfaces stay closed.
3. Before mutation, the vault validates the configured manifest, every key and
   aggregate commitment, retained-state compatibility, the selected active root
   version, and exclusive maintenance authority.
4. The vault durably records a rotation journal bound to the request UUID,
   installation, target, starting aggregate, and old/new physical versions,
   then atomically creates a new versioned root key without replacing the active
   root key.
5. The selected closed store adapter activates the new root for new writes and
   resumably rewraps affected data-encryption keys. Conditional mutations must
   change a record only when its current root reference is the expected old
   version; the contract does not require SQL.
6. The adapter verifies that no affected record still references the old root.
   Only then may the vault atomically update the manifest fingerprint, active
   version, aggregate commitment, and completed-request receipt and retire the
   old root from application use.
7. After successful commit, the entrypoint removes maintenance write authority,
   drops to the runtime identity, opens the credential REST socket, reports
   `ready`, and permits ordinary application initialization.
8. After interruption, the next vault start must detect and validate the durable
   journal and resume or finish the same transition before ordinary startup,
   even when the rotation arguments are absent. It must never interpret an
   incomplete rotation as fresh provisioning or configured-key corruption.
9. A later start with the same completed request UUID returns an operator-visible
   idempotent no-change result and must not perform a second rotation.

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
- An absent, unsupported, malformed, or concurrent root-rotation request must
  not rotate a key. A missing old or staged key, corrupt journal, failed
  conditional rewrap, nonzero old-root inventory, or manifest mismatch enters
  status-only `configuration_error`; the old root remains available until a
  verified commit, no ordinary interface opens, and diagnostics remain
  secret-free.

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
  release-versioned superset of SecretSauce-owned application key identities
  supported by v2.1 in the vault provisioning entrypoint before permitting
  ordinary product use. Enabled services and features must not change this set.
- `SETUP-002` When fresh provisioning is permitted, every missing
  SecretSauce-owned key must be created atomically and without replacement by
  exactly one closed vault-owned key-type adapter. Provisioning retries must
  validate and reuse successfully created keys, generate only remaining missing
  keys, and converge idempotently. Setup must not advance until every required
  key validates.
- `SETUP-003` Automatically generated keys must include every logical identity
  in the exact v2.1 registry in section 8.1, even when its consuming feature is
  disabled; no other logical identity is eligible for automatic generation
  without an explicit PRD amendment.
- `SETUP-004` SecretSauce must not automatically generate TLS material, external
  OIDC client secrets, database credentials, downstream service credentials,
  backup passphrases, or other externally owned secrets.
- `SETUP-005` The manifest must advance atomically from `provisioning` to
  `configured` only after every registered v2.1 vault provisioning adapter
  validates its complete key set and the entrypoint records the canonical
  aggregate digest of every required verified entry.
- `SETUP-006` A fresh key-generation failure for a `pending` entry must leave the
  manifest in `provisioning`, keep liveness healthy, block all ordinary
  interfaces, expose sanitized status, log secret-free diagnostics, and retry
  with bounded backoff.
- `SETUP-007` If a configured manifest exists and any required key is missing,
  invalid, or fingerprint-mismatched, the vault must enter
  `configuration_error` without opening its credential REST socket or
  regenerating the key. The vault status-only REST socket and setup-only
  application must remain live to expose bounded status until operator
  correction and restart.
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
  with generation authority: the vault provisioning entrypoint through the
  key's single registered adapter. Runtime vault and application components may
  receive only the access required to use or validate their assigned keys and
  must never generate or replace them. Two running components must never race to
  generate the same key, and automatic provisioning must never replace an
  existing key file. The explicit versioned envelope-root rotation in
  `SETUP-027` and `SETUP-028` is the only configured-state key-generation
  transition in v2.1.
- `SETUP-014` The official Compose deployment must start the vault provisioning
  entrypoint and application concurrently. The application must operate in
  setup-only mode until private vault status is `ready` and its assigned keys
  validate; it must not depend on configured vault readiness merely to expose
  liveness and sanitized setup status. A fresh supported deployment must require
  no manual key-generation command.
- `SETUP-015` A true fresh installation must durably create the complete
  `provisioning` manifest with every required entry in `pending` state before the
  first key-generation attempt. Each entry must atomically record its canonical
  adapter-computed fingerprint when it advances to `verified`.
- `SETUP-016` A provisioning retry may create only `pending` keys. A missing,
  malformed, or mismatched `verified` key, or a malformed existing key file for
  a `pending` entry, must cause `configuration_error` without creating or
  replacing any key. A valid existing key for a `pending` entry must be
  fingerprinted and advanced to `verified` without replacement.
- `SETUP-017` When no manifest exists, fresh provisioning is permitted only when
  no required key is present, every retained key-bound state inventory is
  definitively absent or empty, and `setup.adopt_existing_keys` is `false` or
  absent. If any retained key-bound state is present, or any required inventory
  is unavailable or indeterminate, no-manifest/no-key startup must cause
  `configuration_error` without writing a key or manifest. Setting adoption to
  `true` without a complete key set, or finding some-but-not-all required keys
  with any adoption value, must cause `configuration_error`. All required keys
  must cause `configuration_error` unless the host-local
  `setup.adopt_existing_keys: true` startup setting is present.
- `SETUP-018` `setup.adopt_existing_keys` must be accepted only from deployment
  configuration available before database-managed settings. It must not be
  controllable through browser, control API, OAuth, MCP, or remotely invokable
  CLI behavior. It is honored only when no manifest exists and every required
  key is present, must never relax validation, becomes inert after a configured
  manifest exists, and produces a sanitized operator warning until removed.
- `SETUP-019` Complete pre-manifest adoption must not generate or replace keys.
  Every registered vault provisioning adapter must validate key format,
  ownership, mode, canonical fingerprint, and compatibility with all retained
  key-bound state before the vault entrypoint atomically writes a configured
  manifest. Any failed or
  unavailable validation must cause `configuration_error` without modifying
  keys or manifest state.
- `SETUP-020` The vault provisioning entrypoint must invoke a closed
  store-specific inventory adapter for every recognized key-bound persistent
  store before fresh provisioning is authorized. Each adapter must return only
  a bounded, non-secret absent/empty, present, or indeterminate result. Inability
  to inspect or classify the configured store is indeterminate and must fail
  closed. Recovery from retained state without its matching keys or manifest
  requires restoring the matching state/key/manifest set and must never trigger
  replacement-key generation.
- `SETUP-021` The installation identifier, progressive manifest, per-entry
  fingerprints, sanitized provisioning status, configured aggregate commitment,
  root-rotation journal, and completed-request receipts must reside in a
  dedicated durable setup-state volume. The vault provisioning entrypoint is its
  sole writer. Runtime consumers may receive read-only access only to the
  non-secret configured manifest fields they need for key validation.
- `SETUP-022` The vault must expose provisioning status on a dedicated private
  HTTP/1.1 REST endpoint over a Unix-domain socket separate from the
  authenticated credential REST socket. Before caller keys exist,
  filesystem ownership and mode must restrict this status socket to the
  application runtime identity. The endpoint must be read-only, accept no body,
  query, or path parameters, use a closed bounded JSON response, expose no key
  identity/path or retained-state details, and never trigger or alter
  provisioning. The socket parent must be vault-owned, non-symlinked, and not
  group/world writable; the application must receive it through a read-only
  mount and must have no bind, unlink, rename, or replacement authority.
- `SETUP-023` The vault provisioning entrypoint may retain write access to
  generated-key directories only while provisioning or retrying a fresh
  `pending` key, or while executing the explicitly requested and journaled
  envelope-root transition in `SETUP-027` and `SETUP-028`. Before opening the
  credential REST socket after configured completion, it must irreversibly drop
  setup-only and maintenance privileges and access to application-only key
  directories. On fatal `configuration_error`, it must relinquish setup and
  maintenance write authority before remaining available in status-only mode.
- `SETUP-024` The runtime vault identity must retain only its vault root,
  authenticated-caller verification keys, and capability-verification keys.
  Each application runtime component must receive its assigned generated keys
  read-only and must independently validate their format and
  configured-manifest fingerprints before enabling key-dependent behavior.
- `SETUP-025` The official Compose vault service must have no network
  attachment during provisioning, status-only error, or runtime credential API
  phases.
  Its provisioning-status and credential REST APIs must use only their separate
  filesystem-restricted Unix-domain sockets. Merely omitting published ports is
  insufficient.
- `SETUP-026` The configured manifest must contain the fixed, release-versioned
  superset of every SecretSauce-owned application key identity supported by
  v2.1. Enabling or disabling a feature must not add, remove, generate,
  regenerate, retire, or change any manifest key identity or fingerprint.
  Disabled-feature keys remain securely stored and validated but must not be
  loaded by a component unless the feature and that component's assignment
  require them. A later release that adds an identity requires an explicitly
  reviewed upgrade/migration and must not be inferred as fresh provisioning on
  a configured v2.1 installation.
- `SETUP-027` Version 2.1 must support configured identity and vault
  envelope-root rotation only by restarting the vault with exactly
  `--rotate-root-key identity` or `--rotate-root-key vault` and a fresh
  canonical UUID supplied as `--rotation-request-id`. Both values are non-secret
  and host-local; browser, REST, control API, OAuth, MCP, database configuration,
  and remote CLI inputs must not initiate or select rotation. The vault and
  application must remain setup-only, and the credential REST socket and
  ordinary interfaces must remain absent, until the transition completes and
  maintenance privileges are dropped.
- `SETUP-028` Before root rotation writes, the vault entrypoint must validate
  the configured manifest, complete key set, aggregate, retained-state
  compatibility, selected active root, and exclusive maintenance authority,
  then durably create a single-operation journal bound to the request UUID,
  installation, target, starting aggregate, and old/new physical versions. It
  must atomically create a new versioned root without replacing the old root,
  activate it for new writes, resumably rewrap affected data-encryption keys
  through the selected closed store adapter using expected-old-version
  conditional mutations, prove zero remaining old-root references, and
  atomically commit the new fingerprint, active version, aggregate, and durable
  completed-request receipt before retiring the old root from application use.
  The old root must remain available until that commit. Startup must resume a
  valid incomplete journal before ordinary operation even without the
  arguments. Reuse of a completed request UUID must be an idempotent no-change
  result and must never rotate again; a conflicting target for an existing UUID
  must fail closed. Malformed/concurrent requests, invalid state, missing keys,
  journal corruption, failed rewrap, nonzero old-root inventory, or commit
  failure must fail closed without exposing ordinary interfaces or treating the
  transition as fresh provisioning.

### 13.2 Bootstrap and enrollment

- `ENROLL-001` After key setup, when zero users exist, each process start must
  generate a new bootstrap secret and print it once to container logs.
- `ENROLL-002` The bootstrap secret must have at least 128 bits of
  cryptographically secure randomness, be retained by the application only in
  process memory, use constant-time comparison, and remain valid only until
  process exit or successful initial enrollment.
- `ENROLL-003` The bootstrap secret must never appear in application
  persistence, browser/API responses, audits, telemetry, or any log other than
  its one intentional startup display in the operator-controlled container log
  sink. Access to the current line is trusted as infrastructure-administrator
  access in the supported deployment.
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
- `LOGOUT-003` If persistence or required audit work fails, rolls back, or
  cannot be confirmed as committed, logout must return HTTP 503 with
  `Retry-After`, must not clear or expire the browser cookie, and must not
  display, announce, or redirect through a successful-logout state.
- `LOGOUT-004` The authenticated page must remain available after a logout
  failure and present the accessible sanitized message: **Logout could not be
  completed. This session is still active. Try again.**
- `LOGOUT-005` A failed logout must emit a sanitized operator-visible
  `logout_revocation_unavailable` application event containing only timestamp,
  correlation identifier, and `persistence` or `audit` failure category. It
  must not contain a cookie, session identifier, user identifier, request body,
  forwarding-header value, or downstream response.
- `LOGOUT-006` After the dependency recovers, retrying logout with the still
  active cookie must be able to commit revocation and audit exactly once, clear
  the cookie, and complete the normal successful logout flow.

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

  Host-local environment settings must also define these application-owned
  protective limits:

  | Environment setting | Default | Allowed |
  | --- | ---: | ---: |
  | `SECRETSAUCE_LOGIN_GLOBAL_ATTEMPTS` | 100 | 20–1000 |
  | `SECRETSAUCE_LOGIN_GLOBAL_WINDOW` | `15m` | `5m`–`60m` |
  | `SECRETSAUCE_MAX_UNAUTHENTICATED_INFLIGHT` | 32 | 8–128 |
  | `SECRETSAUCE_MAX_UNAUTHENTICATED_INFLIGHT_PER_SOURCE` | 4 | 1–16 and not above the global unauthenticated limit |
  | `SECRETSAUCE_MAX_PASSWORD_VERIFICATIONS` | 2 | 1–8 |
  | `SECRETSAUCE_MAX_PASSWORD_VERIFICATIONS_PER_SOURCE` | 1 | 1–4 and not above the global password-verification limit |

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
- `ABUSE-015` The application-owned global login, unauthenticated-inflight, and
  password-verification concurrency limits in `ABUSE-002` must remain enforced
  even when a reverse proxy applies additional controls. Missing environment
  values use the documented defaults. Empty, malformed, out-of-range, or
  internally inconsistent values must stop startup with a sanitized
  configuration error that identifies the setting but not its received value.
  Count and concurrency values must use canonical nonzero ASCII decimal integer
  syntax; the window must use canonical whole-minute `[1-9][0-9]*m` syntax.
  The global attempt window combines control-plane local login and local MCP
  OAuth password-bearing authorization attempts. Unauthenticated-inflight
  limits apply before authentication work, and password-verification limits
  bound simultaneous password checks. Per-source concurrency uses the canonical
  source from `SOURCE-001`. A reached limit must use the existing uniform
  temporary-unavailability response with `Retry-After`, perform no additional
  expensive verification, and must not increment suspension counters.
  These settings are host-local, take effect on restart, and must not be
  writable through browser, control, OAuth, MCP, or remotely invokable CLI
  behavior. A reverse proxy may enforce stricter limits but must not be the only
  protection for application-owned expensive work.
- `SOURCE-001` SecretSauce must derive one canonical client source for each
  request and use it consistently for direct-source limits, concurrency
  controls, and coarse browser-session source metadata.
- `SOURCE-002` Host-local deployment configuration must expose
  `client_source.mode` as `direct`, `trusted_proxies`, or `always`. The default
  must be `direct`. This setting must not be writable through browser, control,
  OAuth, MCP, or remote CLI interfaces.
- `SOURCE-003` In `direct` mode, the immediate socket peer must be the canonical
  source and all forwarding headers must be ignored.
- `SOURCE-004` In `trusted_proxies` mode, `client_source.trusted_proxies` must
  contain at least one valid IP address or CIDR. The selected forwarding header
  may be used only when the immediate socket peer matches that set. Source
  derivation must walk the parsed client-to-server chain from the server side,
  skip configured trusted proxy hops, and select the first untrusted hop; if
  every hop is trusted, it must select the client-most supplied hop.
- `SOURCE-005` In `always` mode, the client-most address in the selected
  forwarding header must be treated as authoritative regardless of the
  immediate peer. This mode intentionally supports proxies whose identity is
  unknown or changes, but it transfers responsibility for preventing direct
  access and for overwriting or sanitizing client-supplied forwarding values to
  the operator. Startup and operator documentation must warn that otherwise a
  client can spoof source limits and displayed source metadata. Account,
  password, TOTP, global, and expensive-work concurrency controls remain
  enforced.
- `SOURCE-006` `client_source.header` must select exactly one supported format:
  `x_forwarded_for` for `X-Forwarded-For` or `forwarded` for RFC `Forwarded`.
  The default must be `x_forwarded_for`. Nonselected forwarding headers must not
  affect source derivation.
- `SOURCE-007` In `trusted_proxies` or `always` mode, an absent selected header
  must fall back to the immediate socket peer. A present selected header must
  be no larger than 4096 bytes, contain no more than 32 hops, and yield one
  unambiguous nonempty chain of IP literals. Malformed, oversized, overlong,
  hostname, obfuscated, `unknown`, or zone-identifier values must be rejected
  before authentication work.
- `SOURCE-008` Canonicalization must normalize equivalent IPv4, IPv6, and
  IPv4-mapped IPv6 representations before rate-limit keys or coarse metadata
  are derived. Optional syntactically valid ports in the selected header format
  do not form part of the canonical address.
- `SOURCE-009` Enabling `always` must emit a sanitized startup warning that
  identifies the unsafe trust mode without logging any received header value or
  address. Invalid mode, header, or trusted-proxy configuration must stop
  startup with a sanitized configuration error.

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
- `ACCESS-012` An administrative agent-connection revocation must make the
  actor's current role, the target owner's current eligibility, and the grant's
  current nonempty all-services-managed scope part of the mutation's
  authorization boundary. If any condition is false when the mutation is
  decided, the operation must change no user, grant, token, or reference state
  and must return the same non-disclosing result as any other inaccessible
  target. A prior list result, cached projection, or earlier authorization check
  must not independently authorize the mutation. The persistence mechanism that
  enforces this invariant is an architecture decision. An inactive target
  qualifies for the audited no-change success in `ACCESS-010` only while the
  current authorization conditions remain durably provable; an unknown or
  physically deleted target is inaccessible.

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
- `HEALTH-008` The application must derive its provisioning view from the
  vault's private status REST resource, map `configuration_error` to public
  `not_ready`, and add its own initialization checks before reporting
  `available` or operational readiness. Loss, timeout, or malformed output from
  the private status resource must fail closed as `not_ready`.
- `HEALTH-009` Vault `ready` means key provisioning and configured-manifest
  commitment are complete; it does not by itself mean the application is
  operational. Application readiness must remain 503 until persistence, audit,
  runtime key validation, vault credential-API handshake, jobs, and required
  listeners are usable.

### 13.9 Private vault REST API

- `VAULTAPI-001` Both private vault interfaces must use a versioned HTTP/1.1
  resource API over Unix-domain sockets in v2.1. Status and ordinary metadata
  use closed JSON schemas; secret-bearing and streaming operations may use only
  their explicitly declared bounded media types. The API must have one
  canonical OpenAPI 3.1 contract used by the vault server, all first-party
  clients, and contract tests.
- `VAULTAPI-002` The provisioning-status API and authenticated credential API
  must use separate socket paths and listener lifecycles. The status API may
  expose only its fixed read-only resource before keys exist. The credential API
  must not listen before configured manifest commit and setup-privilege drop.
  Each socket parent must be vault-owned, non-symlinked, and not writable by a
  client or unrelated workload. First-party clients must receive the socket
  volume read-only, validate the expected endpoint type/owner/mode before
  connection, and fail closed on an unsafe or replaced endpoint.
- `VAULTAPI-003` Filesystem permissions are a reachability control, not
  sufficient runtime caller authentication. Every credential-API request must
  authenticate a fixed caller identity with its caller-specific HMAC key and
  bind the signature to a stable logical vault audience, API version, caller,
  uppercase method, canonical origin-form request target, selected
  representation headers, raw body digest, request UUID, timestamp, and nonce.
  The audience must not depend on a Unix socket path or deployment hostname.
  Security-sensitive encodings must be canonical, and stale or replayed
  requests must fail before store access. Every response after successful caller
  authentication must carry a canonical HMAC authenticator bound to the logical
  audience, API version, caller, vault boot identifier, request UUID, HTTP
  status, selected response representation headers, and digest of the exact raw
  response body. A first-party client must verify this binding before parsing or
  using the body. A connection close or unsigned response before caller
  authentication is only a generic unavailable/authentication failure and must
  never be interpreted as a vault-domain result. The pre-key status API relies
  on its non-rebindable filesystem endpoint and bounded non-secret schema rather
  than a caller key.
- `VAULTAPI-004` Authenticated caller identity must map to a fixed server-side
  operation allowlist independent of socket access. Data-plane resolution must
  still require a valid one-use operation-bound capability; control, backup,
  and data callers must not acquire one another's operations. A compromised
  authorized caller is contained to its current authenticated operations and
  capabilities, regardless of Unix-socket transport.
- `VAULTAPI-005` The private HTTP servers must reject unknown methods/routes,
  unsupported media types, duplicate security headers, ambiguous or
  non-canonical request targets, conflicting length/framing metadata, oversized
  headers or bodies, unknown schema fields, invalid UTF-8 where text is
  required, and unsupported protocol upgrades before domain or store access.
  They must not use cookies, browser CORS, redirects, proxy discovery, or
  unbounded buffering. Errors, access logs, and traces must never contain raw
  credentials, opaque authorization values, request/response bodies, cookies,
  or secret-bearing headers.
- `VAULTAPI-006` HTTP parsing, request authentication, caller authorization, and
  vault domain handlers must be separate interfaces. Domain handlers must accept
  a transport-independent authenticated caller context and validated operation
  input rather than a socket or HTTP request object. Version 2.1 must ship no TCP
  listener, HTTPS listener, remote-vault setting, or dormant network transport.
- `VAULTAPI-007` A future version may bind the same versioned API and domain
  handlers to HTTPS with mutually authenticated service identities. Adding that
  transport must not weaken per-operation authorization, capability checks,
  replay/idempotency behavior, schemas, error semantics, or secret-free logging.
  HTTPS certificate lifecycle, network policy, service discovery, and remote
  availability behavior are explicitly deferred and must be reviewed before
  that transport is enabled.
- `VAULTAPI-008` Each credential-API process start must create a fresh
  unpredictable non-secret vault boot identifier returned through the
  authenticated readiness handshake. That fixed, store-free handshake request
  is the sole credential request that does not yet contain a boot identifier;
  its HMAC-authenticated response binds the request UUID and returns the current
  identifier. Every subsequent credential request and operation-bound
  capability must bind that identifier. A vault restart must therefore
  invalidate every outstanding request, nonce, capability, and in-memory
  transfer from the prior process. A durable operation may resume only from its
  validated journal after a new readiness handshake and fresh authorization; it
  must never resume by accepting prior-process authority.

## 14. Data handling and privacy

### 14.1 Bootstrap and enrollment data

- The application retains the raw bootstrap secret only in process memory. Its
  one intentional startup line may persist in the operator-controlled container
  log sink until that sink's retention policy removes it.
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
Full forwarding-header chains must not be stored as session metadata or copied
to logs, audits, analytics, or telemetry. Only the canonical source selected
under `SOURCE-001` through `SOURCE-009` may feed the coarse network derivation.

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
- Administrative agent-connection revocation must enforce current role,
  target-owner eligibility, and complete reachable-service scope at the
  mutation boundary; stale list or authorization results must not grant
  authority.
- Every new external setup, enrollment, login, client-source,
  session-metadata, and revocation input requires positive and negative tests.
- Reverse-proxy controls may supplement but must not replace the application's
  global unauthenticated and expensive password-work ceilings.
- A credential REST response must not be parsed or acted upon until its
  canonical request/response binding and vault boot identifier authenticate.

## 16. Interfaces and integrations

### 16.1 Public browser routes

The public browser experience includes:

- Branded login.
- Neutral **Enroll account** entry.
- Safe setup-status presentation while provisioning.
- Configured OIDC provider actions.

The browser must not need a setup-specific initial-superadmin URL.

### 16.2 Health contracts

The health paths and semantics in `HEALTH-001` through `HEALTH-009` are stable
product contracts. Exact internal component wiring remains an architecture
decision.

### 16.3 Container logs

The one bootstrap-secret line must:

- Be clearly labeled as a one-time initial enrollment secret.
- State that it is invalidated by successful enrollment or restart.
- Avoid surrounding configuration, environment values, or other secrets.
- Never be repeated by periodic status logging.

Documentation must warn that Docker and platform logs may be retained or
forwarded and must be access-controlled. The supported deployment treats
readers of the current bootstrap-secret line as infrastructure administrators;
that line grants initial enrollment authority until successful enrollment or
process restart.

### 16.4 OIDC boundary

The branded login page may initiate configured OIDC flows. OIDC-provider
authentication failures do not enter local suspension accounting. OIDC flow
initiation and callback endpoints retain their own abuse limits and uniform
public failures.

### 16.5 Client-source trust

The official deployment must document all three source-resolution modes and
default to `direct`. `trusted_proxies` is the recommended reverse-proxy mode
when stable proxy IP addresses or CIDRs are available. `always` is an explicit
accepted-risk compatibility mode for otherwise supported deployments whose
proxy identity cannot be known or remains unstable.

`always` does not make an untrusted forwarding header trustworthy. It records
the operator's assertion that network controls prevent direct client access and
that the proxy overwrites or sanitizes the selected header. If either assertion
is false, an attacker can choose the apparent source used by per-source limits
and coarse session metadata.

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
`docs/architecture/v2.1/provisioning.md` records the approved implementation
baseline for this lifecycle, and
`docs/architecture/v2.1/vault-rest-api.md` records the private API and
transport boundary.

The `secretsauce-vault` container entrypoint owns automatic provisioning and
then transitions into the runtime credential service; this is one deployed
service, not an additional setup service. The vault container has no network
attachment in any phase. During setup it has:

- sole write access to the dedicated setup-state volume and generated-key
  directories;
- read-only access to configured retained application database, vault, audit,
  and other recognized key-bound state required for inventory;
- a private read-only HTTP provisioning-status API over a Unix socket shared
  with the application; and
- no remotely invokable provisioning operation.

For explicit configured-state root maintenance, the same service is restarted
with `--rotate-root-key identity` or `--rotate-root-key vault` and a fresh
canonical UUID in `--rotation-request-id`. It remains in setup-only mode, keeps
both ordinary application initialization and the credential listener closed,
and grants one vault entrypoint exclusive, operation-scoped write access to the
selected versioned root location and affected encrypted store. The durable
rotation journal is the sole authority to resume an interrupted transition, and
the completed-request receipt prevents a restart with the same request UUID
from rotating again. This is not an additional service, general key-management
CLI, or REST operation.

The application container starts concurrently with read-only key and manifest
mounts. It exposes setup-only health/status surfaces until the vault reports
`ready` and application initialization completes. The authenticated credential
REST socket does not exist in `preparing` or `configuration_error`; it opens only
after a configured manifest commits and the entrypoint drops setup-only
privileges. Both vault sockets reside in vault-owned non-rebindable directories
mounted read-only into the application container. The application may connect
to the endpoints but cannot bind, unlink, rename, or replace them.
Compose process health checks use liveness, not operational readiness, so an
operator can inspect bounded setup status during retryable or fatal setup
failure without creating a restart loop. Both private vault APIs use the same
versioned REST contract and domain handlers that a future reviewed HTTPS
transport may reuse; v2.1 creates no TCP listener.

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

Automatic startup without a root-rotation argument applies this authoritative
matrix before key generation:

| Manifest | Required keys | Retained key-bound state | `setup.adopt_existing_keys` | Required behavior |
| --- | --- | --- | --- | --- |
| Absent | None present | Definitively absent/empty for every required inventory | `false` or absent | Create the complete `provisioning` manifest before generating the first key |
| Absent | None present | Any present, unavailable, or indeterminate inventory | Any value | Enter `configuration_error`; create no key or manifest and require restoration of the matching state/key/manifest set |
| Absent | None present | Definitively absent/empty for every required inventory | `true` | Enter `configuration_error`; create no key and require removal of the inapplicable adoption setting |
| Absent | Some but not all present | Any result | Any value | Enter `configuration_error`; create or replace no key |
| Absent | All present | Any result | `false` or absent | Enter `configuration_error` and direct the operator to the explicit adoption setting |
| Absent | All present | Any result | `true` | Run complete adapter-owned adoption validation, including compatibility with every present store and successful classification of every required inventory; atomically create a configured manifest only if every validation succeeds |
| `provisioning` | All `verified` entries match; `pending` key files are valid or absent | Not used to authorize replacement generation | Ignored | Validate and record present `pending` keys, then create only absent `pending` keys |
| `provisioning` | Any `verified` entry is missing/mismatched or an existing `pending` key file is malformed | Any result | Ignored | Enter `configuration_error`; create or replace no key |
| `configured` | Every required fingerprint and aggregate digest match | Not used to authorize replacement generation | Ignored | Continue to `enrollment_required` or `operational` |
| `configured` | Any required key, fingerprint, or aggregate digest missing or mismatched | Any result | Ignored | Enter `configuration_error`; create or replace no key |

Discarding all key and manifest storage is treated as an intentional fresh
installation only when no required key remains and every required retained-state
inventory is definitively absent or empty. Retained application or vault data
does not authorize automatic key replacement. An unavailable or indeterminate
inventory fails closed. Complete pre-manifest key adoption is the sole exception
and requires the explicit host-local setting plus successful compatibility
validation by every registered vault provisioning adapter.

Configured identity/vault envelope-root rotation is a separate explicit
maintenance transition governed by `SETUP-027` and `SETUP-028`; it never changes
the fixed v2.1 logical key-identity set and does not weaken any row above.

### 18.3 Observability

Provisioning logs may include:

- Safe phase/category.
- Provisioning adapter category.
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
- Reverse-proxy rate and connection limits are an outer deployment control. The
  application always enforces the environment-configured global login,
  unauthenticated-inflight, and password-verification ceilings from
  `ABUSE-002`.
- Session and grant lists retain bounded pagination; bulk revocation must use
  bounded database transactions or an equivalent atomic durable operation.

## 21. Acceptance criteria

### 21.1 Setup

1. A clean official Compose start automatically creates every missing identity
   in the exact v2.1 logical key registry with restrictive permissions.
2. TLS, OIDC client, database, downstream, and backup secrets are never invented.
3. Login, control API, OAuth, and MCP requests fail uniformly before key setup
   permits them.
4. Liveness remains 200 and readiness remains 503 during provisioning and initial
   enrollment.
5. A fresh unwritable key location remains live, exposes safe status, retries,
   and never advances the manifest to `configured`.
6. After configuration, removing or corrupting one required key enters
   status-only `configuration_error` without key replacement or an authenticated
   credential REST socket.
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
12. With no manifest, startup enters status-only `configuration_error` without
    creating or replacing a key when adoption is `true` but no required key is
    present, or when only some required keys are present with any adoption
    value.
13. With no manifest and every required key present, startup enters status-only
    `configuration_error` without the adoption setting and identifies only the
    sanitized operator action required.
14. With no manifest, every required key present, and
    `setup.adopt_existing_keys: true`, successful adapter-owned compatibility
    validation creates a configured manifest without changing any key.
15. A malformed adoption setting or failed, unavailable, or incompatible
    adapter-owned adoption validation enters status-only `configuration_error`
    without modifying keys or manifest state.
16. A missing or mismatched `verified` key under a provisioning manifest and any
    mismatch under a configured manifest enter status-only
    `configuration_error` without creating, replacing, or recommitting a key.
17. With no manifest and no required key, startup creates a provisioning
    manifest only when every required retained-state inventory is definitively
    absent or empty.
18. With no manifest and no required key, any retained application database,
    identity/authenticator, OAuth grant/token, vault ciphertext/store identity,
    durable audit-lineage, installation-marker, or other recognized key-bound
    state enters status-only `configuration_error` without creating a key or
    manifest.
19. With no manifest and no required key, an unavailable or indeterminate
    retained-state inventory fails closed without creating a key or manifest.
20. The vault and application start concurrently on a clean Compose deployment;
    the application serves bounded setup status without opening its database
    writer or enabling ordinary web, control, OAuth, or MCP behavior.
21. The private vault status REST resource is reachable only through its
    filesystem-restricted Unix socket, accepts no body, query, or path
    parameters, never initiates provisioning, and maps loss, timeout, or
    malformed output to public `not_ready`.
22. Vault `preparing` and `configuration_error` expose no authenticated
    credential REST socket. After configured completion, the entrypoint drops
    setup-only key-directory access before that socket opens.
23. After vault `ready`, every runtime consumer validates only its assigned
    read-only keys and configured-manifest entries before key-dependent behavior
    becomes available.
24. The official Compose vault container has no network attachment in
    provisioning, status-only error, and runtime phases; both private interfaces
    remain usable through their separate Unix sockets.
25. A fresh install with every optional feature disabled still generates,
    validates, and manifests the complete fixed v2.1 key superset.
26. Enabling or disabling any v2.1 feature after configuration leaves all key
    files, logical manifest identities, fingerprints, and aggregate commitment
    unchanged; only enabled consumers load their assigned existing keys.
27. A configured v2.1 installation confronted with a future or unknown required
    key identity fails as an unsupported upgrade without generating, adopting,
    or amending a key.
28. Restart with `--rotate-root-key identity` or `--rotate-root-key vault` and a
    fresh canonical `--rotation-request-id` UUID validates all state before
    writes, keeps the credential socket and ordinary interfaces absent, stages a
    new versioned root, conditionally and resumably rewraps the affected store,
    proves zero old-root references, atomically commits the manifest and
    completed-request receipt, retires the old root, drops maintenance
    authority, and only then becomes ready.
29. Interruption after every root-rotation journal, key, activation, rewrap,
    inventory, and manifest transition resumes the same operation on restart;
    the old root remains available until verified commit and no mixed state
    becomes operational.
30. No rotation occurs without both exact host-local arguments or a valid
    existing journal. Reusing a completed request UUID is an idempotent
    no-change result. An unsupported target, malformed/reused UUID with a
    conflicting target, remote attempt, concurrent request, configured-state
    mismatch, missing old or staged key, corrupt journal, failed conditional
    mutation, or nonzero old-root inventory fails closed in status-only
    `configuration_error`.

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
11. Direct mode ignores spoofed forwarding headers and uses the immediate peer
    for limits and coarse metadata.
12. Trusted-proxy mode accepts a valid selected header only from a matching
    immediate peer, derives the canonical source through the configured proxy
    chain, and rejects malformed or ambiguous chains.
13. Always mode accepts the client-most valid forwarded source without matching
    the peer, emits its startup warning, and continues to enforce non-source
    abuse controls.
14. Equivalent IPv4, IPv4-mapped IPv6, and IPv6 address forms cannot create
    distinct limiter identities for the same canonical address.
15. With the protective-limit environment variables absent, the application
    enforces the defaults in `ABUSE-002`.
16. Every empty, malformed, out-of-range, or inconsistent protective-limit
    environment value stops startup with a sanitized configuration error.
17. A test deployment with no reverse proxy still enforces global login,
    unauthenticated-inflight, and password-verification concurrency limits; a
    proxy may enforce stricter limits without disabling the application limits.

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
9. If a regular admin loses any required service scope after listing an agent
   connection but before revoking it, the revocation changes no user, grant,
   token, or reference state and returns the uniform inaccessible-target result.
10. Injected persistence and audit failures during logout return retryable HTTP
    503, retain the active cookie and session, remain on the authenticated page,
    and never show or announce successful logout.
11. After each injected failure clears, one retry revokes the session, commits
    one audit event, clears the cookie, and completes the successful logout
    flow.

### 21.6 UX and privacy

1. Login, enrollment, setup, logout, and session management pass keyboard,
   focus, label, status-announcement, and responsive browser tests.
2. Enrollment pages do not publicly reveal whether initial setup or an existing
   account flow applies.
3. Session views show only permitted metadata, coarse networks, and sanitized
   device families.
4. Logout is available from every authenticated view.
5. Destructive bulk actions communicate scope and current-session effects.
6. Logout failure announces that the session remains active, preserves the
   authenticated page and keyboard focus, and offers an operable retry.

### 21.7 Private vault REST API

1. The status and credential interfaces conform to one versioned OpenAPI
   contract over separate Unix sockets, and the v2.1 vault opens no TCP or HTTPS
   listener.
2. The pre-key status resource accepts only its fixed bodyless, queryless,
   parameterless read request and returns only the bounded status schema.
3. Valid data, control, and backup requests authenticate independently and can
   invoke only their fixed operation allowlists; switching the claimed caller,
   logical audience, method, request target, representation headers, body,
   request UUID, timestamp, or nonce invalidates authentication.
4. Missing/bad authentication, cross-caller operations, expired requests,
   replayed nonces, invalid capabilities, duplicate security headers, ambiguous
   framing/targets, unknown fields, unsupported methods/media types/upgrades,
   and oversized inputs fail before domain or vault-store access.
5. A compromised data-plane caller cannot write, delete, export, or perform an
   unbound resolution; a compromised control caller cannot resolve or export;
   and a backup caller cannot operate without its required one-use
   authorization.
6. Private HTTP errors, logs, traces, and OpenAPI examples contain no raw
   credentials, opaque authorization values, cookies, secret-bearing headers,
   or request/response bodies.
7. The same domain-handler contract passes adapter tests with a synthetic
   authenticated caller context and no Unix-socket or HTTP object, proving that
   a later reviewed HTTPS adapter will not require vault-domain redesign.
8. The official deployment gives only the vault identity write/bind authority
   over both socket parents, mounts them read-only into every client, and rejects
   symlinked, wrongly owned, writable, replaced, or non-socket endpoints before
   sending a secret-bearing request.
9. Credential clients reject forged, replayed, cross-request, wrong-caller,
   wrong-boot, status-tampered, representation-header-tampered, and
   body-tampered responses before parsing or using their bodies.
10. Restarting only the vault changes its boot identifier and invalidates every
    prior outstanding request, nonce, capability, and in-memory transfer.
    Credential-API durable journaled work requires a new handshake and fresh
    authorization to resume. The separately host-authorized, pre-listener
    root-maintenance journal follows `SETUP-028`.

## 22. Testing requirements

- Unit tests for setup state transitions, fixed release key registry,
  required-key inventory, closed
  key-type and retained-store adapter registries, manifest entry transitions,
  canonical adapter-computed fingerprints, aggregate commitment, rotation
  journal transitions, expected-old-version mutation predicates, private status
  response bounds/mapping, validation, bootstrap
  generation/comparison/erasure boundaries, suspension counters, rolling-window
  behavior, and scope predicates.
- Persistence tests for atomic configured-manifest commit, initial-superadmin
  commit, counter/suspension/revocation commit, bulk revocation, audit coupling,
  conditional administrative revocation, and concurrency races.
- Positive and negative contract tests for every new setup, enrollment, login,
  protective-limit environment, client-source configuration/header, metadata,
  filter, confirmation, and revocation input, plus every private vault REST
  route, method, media type, schema, request/response signature field, boot
  binding, bounds, and caller operation.
- Process tests for fresh provisioning, interruption and restart at every
  per-key and manifest transition, idempotent key reuse, no-manifest
  none/some/all key inventories with valid and invalid adoption settings,
  incompatible retained-state adoption, no-manifest/no-key startup while
  independently retaining application database, vault, durable audit, or other
  recognized key-bound state, unavailable/indeterminate retained-state
  inventories, partial-restore combinations, blocked retry, restart secret
  rotation, configured missing-key status-only failure, setup privilege drop,
  credential-REST-socket absence before configured completion, and
  multi-service runtime key readiness. Cover every optional-feature combination
  against the identical key set, unsupported future identities, both allowed
  root-rotation targets, interruption at every rotation transition, journal-only
  restart resume, repeated completed request UUIDs, conflicting UUID reuse,
  invalid/concurrent/remote requests, missing old or staged roots, failed
  conditional rewrap, nonzero old-root inventory, and atomic manifest/receipt
  commit.
- Compose tests for concurrent vault/application startup, setup-only application
  behavior without caller keys, private REST socket permissions, OpenAPI
  conformance, preparing, retry, ready, malformed/unavailable status, fatal
  configuration error without a restart loop, credential-listener absence
  before setup completion, application runtime initialization after vault
  readiness, and container recreation with durable setup/key/state volumes.
  Deployment tests must also prove that the vault has no network attachment
  rather than merely no published ports, that every client socket mount is
  read-only, and that no non-vault identity can bind, unlink, rename, or replace
  either socket.
- Browser tests for branded login, unified enrollment, no setup-state disclosure,
  TOTP confirmation, redirect-to-login, successful logout, injected logout
  persistence/audit failure and retry, account settings, administrative scope,
  bulk confirmation, accessibility, and narrow screens.
- Security tests for enumeration resistance, timing comparability, brute-force
  limits, session fixation, CSRF, session replay after revocation, restricted
  session privilege denial, open redirect, markup injection through metadata,
  direct-mode header spoofing, trusted and untrusted proxy peers, `always`-mode
  spoofability, malformed/oversized proxy chains, canonical address
  normalization,
  log/audit secret absence, positive delivery through every designated session,
  CSRF, and OAuth channel, and absence of those values from every prohibited
  channel.
- Private vault API security tests for caller substitution, method/target/header
  and raw-body tampering, canonical base64url enforcement, nonce replay,
  timestamp expiry, duplicate security headers, request-target ambiguity,
  conflicting `Content-Length`/`Transfer-Encoding`, unsupported upgrades,
  bounded streaming, cross-caller authorization, operation-bound capability
  enforcement, vault endpoint replacement, response authentication and
  request/boot binding, vault-only restart invalidation, and secret-free HTTP
  diagnostics.
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
- The vault-owned provisioning phase, concurrent setup-only application
  startup, private versus public status meanings, and the absence of a separate
  setup service or manual initialization command.
- Vault-owned private socket directories, read-only client mounts,
  credential-response authentication, and vault-restart invalidation of
  outstanding private work.
- The one-time complete-key adoption setting, its exact eligibility conditions,
  its inert behavior after configuration, and the requirement to remove it after
  successful adoption.
- The fixed v2.1 key superset, the fact that feature toggles never mutate it,
  and the explicit upgrade requirement for future key identities.
- The exact host-local root-rotation arguments, setup-only maintenance behavior,
  interruption/resume procedure, status and diagnostics, exclusive-write
  requirement, and restoration/escalation steps for fatal journal or state
  mismatch. Documentation must state that rotation is not remotely invokable.
- Where the one-time bootstrap secret appears.
- The fact that Docker/platform logs may be retained or forwarded and require
  access control.
- Liveness versus operational readiness.
- Safe diagnosis of blocked provisioning.
- Status-only fatal behavior after configured key loss and restoration of the
  matching state/key/manifest set before restart.
- Durable volume expectations and the limit of in-container persistence
  detection.
- Host-local superadmin break glass.
- Client-source mode and header selection, trusted-proxy IP/CIDR entries,
  canonical chain behavior, and the `always` mode's network-isolation,
  header-sanitization, spoofing, and metadata limitations.
- Protective-limit environment names, defaults, allowed ranges, startup-failure
  behavior, and the fact that reverse-proxy limits supplement rather than
  replace application enforcement.
- Diagnosis of `logout_revocation_unavailable` without exposing session or user
  identifiers.

User documentation must cover:

- Local and OIDC login.
- Unified enrollment using an enrollment code.
- Password/TOTP reset behavior.
- Automatic TOTP-failure suspension at a conceptual level without exposing
  security-sensitive counter state on the login page.
- Settings, logout, web sessions, agent connections, metadata limitations, and
  revocation effects.
- Logout failure behavior, the fact that the current session remains active,
  and how to retry after the service recovers.

Security documentation must state:

- Session controls resist but cannot make cookie theft impossible.
- TOTP is not phishing-resistant.
- The initial bootstrap secret is intentionally printed once and must be treated
  as a temporary bearer credential.
- OAuth provider failure policy remains provider-owned.
- Unix-socket filesystem permissions limit private vault API reachability but do
  not make an authorized compromised caller trustworthy; caller-specific
  authentication, operation allowlists, and capabilities remain mandatory.
- Vault-owned non-rebindable socket parents and read-only client mounts
  authenticate the local endpoint before a request is sent. Credential response
  HMAC and boot/request binding must verify before a client uses a response.
- HTTPS vault transport is not present in v2.1. Its future addition requires
  mTLS identity, certificate lifecycle, network-policy, availability, and
  transport-security review without changing the REST/domain contracts.

Examples must use `example.org` hostnames. ChatGPT setup documentation must keep
OAuth issuer/resource origins distinct from the MCP Server URL containing the
MCP path.

## 24. Architecture-review questions

These questions concern mechanisms and must not change the product contract:

1. How should provisional initial-enrollment state be represented without
   creating a user before final commit?
2. Which bounded in-process retry scheduler should the vault provisioning
   entrypoint use for blocked fresh provisioning?
3. Which user-agent parser or internal derivation produces safe bounded
   browser/device families with an acceptable maintenance and supply-chain
   profile?
4. When may revoked operational session/grant rows be physically removed while
   preserving API idempotency and immutable audit evidence?
5. Which transactional strategy provides atomic high-cardinality global
   revocation within supported scale?
6. Which shared request-boundary component should enforce `SOURCE-001` through
   `SOURCE-009` consistently for the control and OAuth/MCP listeners without
   duplicating proxy parsing or trust decisions?
7. Which maintained HTTP/OpenAPI server and Unix-socket client adapters best
   satisfy `VAULTAPI-001` through `VAULTAPI-008` without generating a second
   authorization path?
8. Which closed store-adapter transaction and journal representation should
   implement expected-old-version root rewraps and exclusive maintenance
   authority without coupling the product contract to SQL?

## 25. Settled decisions

- Setup uses four internal states: provisioning, enrollment required,
  operational, and configuration error.
- Public setup responses do not announce that zero users exist.
- Automatic provisioning is limited to SecretSauce-owned application keys.
- Every fresh v2.1 installation provisions the fixed, release-versioned superset
  of all SecretSauce-owned application key identities supported by v2.1.
  Feature enablement changes key consumption, never key or manifest identity.
  New identities require an explicitly reviewed later-version migration.
- The `secretsauce-vault` container entrypoint is the sole provisioning
  coordinator, manifest writer, and generator for every SecretSauce-owned key;
  no additional setup service or manual setup command exists.
- Each application-key identity has one closed vault-owned key-type adapter.
  Each key is created atomically without replacement, interrupted fresh
  provisioning reuses valid created keys, and the complete key set converges
  idempotently.
- A progressive manifest exists before the first key creation, records
  adapter-computed canonical fingerprints in a dedicated durable setup-state
  volume with the vault entrypoint as sole writer, and commits to `configured`
  only after every required entry verifies.
- Without a manifest, a partial required key set is always fatal and a complete
  required key set is adopted only with the explicit host-local
  `setup.adopt_existing_keys: true` setting and complete adapter-owned
  compatibility validation.
- Without a manifest and required keys, fresh provisioning is permitted only
  when every retained key-bound state inventory is definitively absent or
  empty. Any retained vault or application state, or any unavailable or
  indeterminate inventory, is fatal and requires restoration of the matching
  state/key/manifest set.
- Fresh `pending`-key provisioning failures stay live and retry; a missing or
  mismatched `verified` or configured key enters status-only
  `configuration_error` and is never regenerated.
- The application and vault start concurrently. The application remains in
  setup-only mode without its database writer or ordinary interfaces until
  private vault status is `ready`, runtime keys validate, and application
  initialization completes.
- Vault provisioning status uses a separate filesystem-restricted, read-only
  HTTP/1.1 REST resource over a Unix socket with no mutation inputs. Browser,
  OAuth, and MCP clients receive only the application's bounded projection and
  never connect to the vault.
- The authenticated vault credential REST socket opens only after the manifest
  commits to `configured` and the entrypoint drops setup-only access. Runtime
  consumers receive only their assigned keys with read-only access.
- The vault service has no network attachment in setup, status-only error, or
  runtime phases; its two private REST interfaces use Unix sockets.
- The vault uses a versioned OpenAPI-described HTTP/1.1 resource contract rather
  than custom binary framing. Unix-socket reachability and caller-specific
  authentication remain separate controls.
- Both socket parents are vault-owned, non-rebindable, and mounted read-only
  into clients. Credential responses are HMAC-authenticated and bound to the
  request, caller, and current vault boot identifier before use.
- Every vault restart changes its boot identifier and invalidates outstanding
  requests, nonces, capabilities, and in-memory transfers. Credential-API
  durable work resumes only from validated journal state with fresh
  authorization; the pre-listener root-maintenance journal is instead bound to
  its durable host request UUID under `SETUP-028`.
- HTTP parsing and authentication are adapters around transport-independent
  vault domain handlers. Version 2.1 ships no TCP/HTTPS listener; a later
  reviewed HTTPS/mTLS adapter may reuse the same API, authenticated caller
  context, authorization, capability, schema, and error contracts.
- There is no configured-manifest clearing or cryptographic-reset capability.
- Configured identity and vault envelope-root rotation is available only through
  the host-local vault restart arguments `--rotate-root-key identity` or
  `--rotate-root-key vault` plus a fresh canonical
  `--rotation-request-id <UUID>`. It is an idempotent, journaled, exclusive,
  setup-only transition that retains the old root through verified rewrap and
  aggregate/receipt commit; it is not exposed through either REST socket or any
  remote product interface.
- Administrative agent-connection revocation changes state only when current
  actor role, target-owner eligibility, and complete reachable-service scope
  authorize the mutation at its decision boundary. The persistence mechanism is
  left to architecture.
- Client-source derivation defaults to the direct socket peer, may trust an
  enumerated proxy set, and includes an explicit `always` mode for unknown or
  changing proxy identities. `always` accepts source spoofing risk if network
  isolation or proxy header sanitization is incorrect.
- Host-local environment variables configure bounded global login,
  unauthenticated-inflight, and password-verification concurrency controls.
  Missing values use safe defaults, invalid values stop startup, and a reverse
  proxy may only add stricter outer limits.
- The official Compose deployment uses durable volumes, but the container does
  not claim it can prove arbitrary mount durability.
- The process-lifetime bootstrap secret is retained by the application only in
  memory and intentionally copied once to the operator-controlled container log
  sink. Readers of the current line are trusted as infrastructure
  administrators. The secret is invalidated on restart or successful enrollment
  and erased from application memory after successful enrollment.
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
- Logout clears its cookie only after durable revocation and required audit
  commit. A persistence or audit failure leaves the session and cookie active,
  returns a retryable sanitized 503, visibly states that logout failed, and
  emits only a sanitized operator signal.
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
| Automatic fail-closed key setup and explicit root maintenance | `SETUP-001`–`SETUP-028` | 21.1 |
| Atomic initial superadmin | `ENROLL-001`–`ENROLL-013` | 21.2 |
| Branded uniform login/logout | `LOGIN-001`–`LOGIN-007`, `LOGOUT-001`–`LOGOUT-006` | 21.3, 21.5, 21.6 |
| Rate limits and durable suspension | `ABUSE-001`–`ABUSE-015` | 21.3 |
| Canonical client source and proxy trust | `SOURCE-001`–`SOURCE-009` | 21.3 |
| Reset/reactivation consistency | `RECOVER-001`–`RECOVER-007` | 21.4 |
| Session-hijacking resistance | `SESSION-001`–`SESSION-008` | 21.5 |
| Scoped revocation and audit | `ACCESS-001`–`ACCESS-012` | 21.5 |
| Health before setup | `HEALTH-001`–`HEALTH-009` | 21.1 |
| Private vault REST boundary | `VAULTAPI-001`–`VAULTAPI-008` | 21.7 |
| Secret and personal-data minimization | Sections 14–16 | 21.2, 21.5, 21.6 |
| Browser-first Compose deployment | `SETUP-010`–`SETUP-028`, sections 18–19 | 21.1 |

## 27. Review readiness

### 27.1 Security-review focus

- Bootstrap-secret exposure, verification, lifetime, and rate limits.
- Application-owned global and expensive-work protection when a reverse proxy
  is absent, bypassed, or more permissive.
- Setup-route allowlisting and middleware order.
- Atomic initial identity creation and provisional-state isolation.
- Authentication timing and enumeration resistance.
- Durable suspension race safety and final-superadmin recovery.
- Session fixation, CSRF, cookie scope, rotation, replay, and revocation.
- Admin service-scope enforcement for OAuth grants.
- Stable key-superset enforcement and journaled, setup-only envelope-root
  rotation with exclusive writer, retained old root, and fail-closed resume.
- Secret-free setup, audit, and logging behavior.

### 27.2 Architecture-review focus

- Vault-entrypoint adapter registry, single-writer manifest transitions, and
  atomic configured-state coordination.
- Fixed release key registry and closed store adapters for conditional,
  resumable identity/vault root rewrap without a new service or REST operation.
- Dedicated durable setup-state representation and runtime read-only views.
- Concurrent setup-only application composition and transition to operational
  initialization.
- Filesystem-restricted private status REST socket and irreversible
  setup-privilege drop before the credential API opens.
- Vault-owned non-rebindable socket directories, read-only client mounts,
  authenticated request-correlated responses, and vault-restart invalidation.
- OpenAPI-described REST handlers, mutual caller/vault authentication adapters,
  strict private HTTP boundary, and future HTTPS transport seam.
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
- Private vault OpenAPI resources, media types, request and response
  authentication inputs, boot handshake, error model, and Unix-socket
  client/server contract.
- Protective-limit environment parsing, defaults, ranges, and cross-field
  validation.
- New suspension settings and counter lifecycle.
- Session metadata normalization and privacy.
- Scoped list/revocation contracts, pagination, idempotency, and audit evidence.

### 27.5 Milestone-planning prerequisites

- Earlier security and architecture approvals are superseded by
  `docs/audits/secretsauce-v2.1-prd-loose-ends-review-2026-07-27.md`.
- Socket endpoint/response trust, vault-restart invalidation, and
  application-owned protective limits are now settled in this PRD.
- The `LOOSE-001` finding is closed: v2.1 uses a fixed release key superset,
  feature toggles never change manifest identities, and identity/vault
  envelope-root rotation is an explicit host-local, journaled, setup-only
  maintenance startup.
- The closure review found the UX/accessibility and data/API inputs complete
  enough to plan. Milestone 00 subsequently approved their detailed artifacts
  and validation baseline as linked in Section 28.
- Section 24 questions are resolved by
  `docs/architecture/v2.1/decisions.md`; implementing plans must preserve those
  decisions and the settled product contract.
- A downstream review may reopen a settled decision only when it demonstrates a
  concrete security, correctness, feasibility, accessibility, or interface
  conflict. The resulting product decision must be recorded in this PRD before
  readiness advances.
- Milestones must preserve a vertical, testable setup-to-enrollment path and may
  not expose partial interfaces between slices.

## 28. Final readiness declaration

**Product-behavior ready for downstream review: yes**

The socket endpoint/response trust, vault-restart invalidation, and
application-owned protective-limit decisions are resolved. The fixed v2.1 key
superset removes feature-driven key-set evolution, while explicit journaled
maintenance startup preserves the two supported envelope-root rotations without
weakening automatic no-replacement provisioning.

**Implementation-ready: yes**

Milestone 00 approved the detailed
[UX/accessibility](../architecture/v2.1/ux.md),
[data/state](../architecture/v2.1/data-model.md),
[public API](../architecture/v2.1/public-api.md),
[private vault OpenAPI](../openapi/vault-v1.yaml),
[threat-model](../architecture/v2.1/threat-model.md), and
[validation](../architecture/v2.1/validation-matrix.md) baselines. The
[acceptance review](../audits/v2.1/milestone-00-acceptance.md) is
project-authored approval; it is not independent assurance, human approval,
implementation evidence, release readiness, or deployment evidence.

**Milestone-breakdown ready: yes**

Review and planning status:

- Security review: no open PRD security blocker; implementation must prove the
  fixed registry, exclusive journaled rotation, fail-closed resume, and old-root
  retirement invariants.
- Architecture review: no open PRD architecture blocker; internal journal,
  store-adapter, and transaction choices remain milestone-plan work.
- UX and accessibility review: detailed project-authored baseline approved;
  independent accessibility review remains release evidence.
- Data-model and API-contract review: detailed project-authored baseline
  approved; implementing milestones must prove executable conformance.
- Threat model and validation review: detailed project-authored baseline
  approved with failure-injection and evidence ownership.
- Milestone planning: Milestones 01 and 02 are ready for separate detailed
  implementation plans.
