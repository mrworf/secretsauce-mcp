# Product Requirements Document: SecretSauce v2

> **Give agents access, not secrets — with a managed identity and control plane**

## 1. Document status

- Product: SecretSauce (MCP)
- Version: 2
- Status: Proposed product baseline for architecture review
- Date: 2026-07-22
- Replaces: The configuration and administration model in `docs/prd.md`; the existing MCP safety model remains the behavioral baseline unless this document explicitly changes it
- Intended audience: Product, architecture, security, UX, implementation, test, and operations reviewers

This PRD defines product behavior and security requirements. It does not prescribe an implementation plan or authorize implementation.

All product decisions discussed before this document are resolved here. A later architecture review may recommend different internal mechanisms, but it must preserve the externally observable behavior and security invariants unless the PRD is revised explicitly.

## 2. Executive summary

SecretSauce v2 evolves the existing YAML-configured, single-administrator MCP credential gateway into a small, self-hosted identity, authorization, credential, and administration product.

Version 2 adds:

- A complete multi-user identity lifecycle with immutable UUIDs.
- Mandatory MFA for local accounts.
- A provider boundary for local authentication and generic external OIDC.
- Platform roles and service-scoped groups.
- Subject- and group-aware service, credential, and policy authorization.
- A responsive web control plane on a separate listener.
- A management API with system-owned API keys that have immutable static API roles/resource scopes.
- An operation-restricted credential vault.
- Searchable control-plane and MCP audits.
- Status, security, grant, reference, and activity views.
- Credential-less automated backups and optional passphrase-encrypted interactive backups.
- Destructive, validated restore.
- One-time migration from the v1 YAML configuration.

Version 2 remains intended for homelab and small-team deployments. It is not an enterprise identity provider, multi-tenant SaaS, or distributed secrets platform.

## 3. Product principles

### 3.1 Preserve the gateway safety model

For every MCP request, SecretSauce must authenticate the request, authorize the service and credentials, validate the destination, evaluate policy, and enforce capacity before credential substitution or downstream I/O.

MCP HTTP remains stateless:

- Every MCP POST is authenticated independently.
- SecretSauce does not issue or trust `mcp-session-id`.
- Durable references are bound to the authenticated user and configured resources, not transport state.

### 3.2 Separate human administration from agent operation

Administrative and super-administrative accounts cannot authorize an MCP client. Only an active account with the `user` platform role can use MCP.

An administrator who needs MCP access must use a separate ordinary-user account.

### 3.3 Prefer group authorization

Groups are the normal authorization mechanism. Direct user assignment is supported for exceptions but is discouraged visibly in the UX.

### 3.4 Never reveal stored downstream credentials

The web control plane can submit, replace, and delete credential values but cannot retrieve them.

The control plane displays only non-secret metadata, including an optional last-four hint captured at write time. Only the gateway substitution and response-protection engine can resolve a credential for authorized runtime use.

### 3.5 Make consequential actions explainable and auditable

Authorization decisions, administrative mutations, security events, backups, restores, and break-glass actions must be attributable and explainable without storing raw credentials, bearer values, cookies, opaque references, request bodies, or downstream response bodies.

### 3.6 Keep the deployment proportionate

The product remains single-instance. SQLite, a small TypeScript management API, a responsive SPA, and an operation-restricted local vault broker are appropriate. Distributed databases, queues, Kubernetes-specific control planes, and enterprise policy languages are not.

## 4. Goals

1. Allow multiple local or externally authenticated users to use MCP safely.
2. Give administrators a usable control plane that replaces routine YAML editing.
3. Enforce least privilege at service, credential, policy, group, and user boundaries.
4. Prevent administrative accounts from being used as daily-driver MCP identities.
5. Keep downstream credentials unreadable through the control plane.
6. Make policy outcomes deterministic and explainable.
7. Provide safe programmatic administration without creating API-key superadmins.
8. Support operational backup, restore, migration, audit, and security monitoring.
9. Preserve ChatGPT and Codex compatibility.
10. Preserve the current generic HTTP gateway model without adding service-specific tools.

## 5. Non-goals

Version 2 does not provide:

- Multi-tenancy.
- Multiple active replicas or a distributed capability store.
- Enterprise IAM features such as SCIM, SAML, identity proofing, delegated organizational administration, or a general-purpose directory.
- A hosted SaaS control plane.
- Service-specific MCP tools or profile packs.
- Automatic email delivery, SMTP integration, or password-reset email.
- Self-registration.
- Social login.
- A general-purpose secrets-vault API.
- Retrieval of stored downstream credential values through the UX or management API.
- Backup of users, authenticators, OAuth state, API keys, sessions, or active gateway references.
- Service-scoped backup archives in the initial v2 release.
- Password composition rules or routine password expiration.
- A guarantee that response scanning prevents every possible transformed or encoded secret disclosure.
- Restoration of live web sessions, OAuth grants, API keys, `gref` references, or `sec` references.
- Automatic conversion of v1 access-list entries into v2 users.

## 6. Logical architecture

### 6.1 Components

SecretSauce v2 has four explicit logical boundaries:

1. **MCP data plane**
   - MCP endpoint and metadata.
   - OAuth authorization-server endpoints used by MCP clients.
   - Authentication of every MCP POST.
   - Service, credential, destination, and policy authorization.
   - Gateway-reference issuance and validation.
   - Credential substitution and downstream HTTP.
   - Response scanning and tokenization.

2. **Control plane**
   - Responsive web UX.
   - Browser-session API.
   - API-key-authenticated management API.
   - User, service, credential, policy, group, grant, audit, backup, restore, and security workflows.
   - Separate listener and public origin from the MCP data plane.

3. **Identity subsystem**
   - Local users, password hashes, encrypted TOTP seeds, external identity links, roles, account state, sessions, OAuth grants, security epochs, and authentication rate limits.
   - Local provider and generic OIDC provider adapter.

4. **Vault broker**
   - Encrypted downstream credential storage.
   - Write-only credential operations for the control plane.
   - Secret resolution for the authorized data plane.
   - Passphrase-protected secret export and import for interactive backup and restore.
   - No public network listener.

### 6.2 Trust boundaries

A separate web port is a routing and exposure boundary, not sufficient secret isolation by itself.

The vault broker must authenticate its callers and provide operation-specific capabilities:

- The control plane may create, replace, delete, and inspect masked metadata.
- The data plane may resolve a credential only for an already authorized runtime operation.
- The backup subsystem may request passphrase-encrypted export/import only after interactive superadmin authorization.
- No control-plane operation returns a plaintext stored credential.

If components share a deployment unit, the architecture review must still establish a meaningful process or operating-system boundary for vault permissions. A TypeScript module boundary alone does not satisfy this requirement.

### 6.3 Persistence

The expected persistence model is:

- SQLite for users, authorization data, configuration, API-key verifiers, OAuth grants, web sessions, audits, activity aggregates, schema state, and jobs.
- A separate encrypted vault store for downstream credential values.
- Authenticated encryption for TOTP seeds and other reversible identity secrets.
- Database transactions for mutations and their control-plane audit records.
- Schema-versioned, forward-only migrations with startup validation.
- Single-instance write ownership.

The architecture review may select specific libraries, but it must retain transactional correctness, bounded queries, safe concurrency, and a supported backup mechanism.

## 7. Identity model

### 7.1 User record

Every user has:

- Immutable UUIDv7 internal ID.
- First name.
- Last name.
- Normalized, unique email address used for login and display.
- Platform role: `superadmin`, `admin`, or `user`.
- Identity-provider type.
- Provider subject identifier.
- Account status.
- Password/TOTP state for local identities.
- Password-policy version.
- Authentication/security epoch.
- Creation and modification timestamps.
- Last successful login timestamp.
- Last qualifying activity timestamp.

Email is mutable profile data, not identity. References, audits, assignments, grants, and ownership use the immutable UUID.

### 7.2 Platform roles

Platform roles are mutually exclusive.

#### Superadmin

A superadmin can:

- Manage all existing users, including admins and other superadmins.
- Manage their own profile and authenticators.
- Create, archive, and delete services.
- Assign administrators to services.
- Manage all services, credentials, policies, groups, assignments, grants, settings, backups, restores, API keys, and audits.
- Perform interactive-only high-risk operations after step-up.

A superadmin cannot use MCP.

#### Admin

An admin can:

- Manage assigned services from an initial draft through published configuration.
- Manage destinations, credentials, policies, groups, and ordinary-user assignments for assigned services.
- Invite ordinary users to assigned services.
- Remove ordinary users from assigned services.
- Manage first name, last name, and email for ordinary users assigned to at least one service the admin manages.
- View service-scoped status, activity, effective access, references, and audits.
- Create and revoke `service` API-role keys for assigned services.

An admin cannot:

- Create, archive, or delete a service record.
- Assign or remove service administrators.
- Manage their own profile through an administrative workflow.
- Manage any admin or superadmin profile.
- Change platform roles.
- Access unassigned services.
- Perform global backup or restore.
- Perform global security actions.
- Approve a SecretSauce API key for use as a downstream credential.
- Use MCP.

If an ordinary user belongs to services managed by different admins, an allowed profile edit is global. The mutation must identify all affected service contexts in the audit event and invalidate the user's sessions and grants when required.

#### User

A user can:

- Complete enrollment.
- Sign into the self-service web area.
- View and revoke their own web sessions and OAuth grants.
- View only the service names associated with their own OAuth access.
- Change their password.
- Replace their TOTP registration.
- Use MCP when all eligibility conditions are satisfied.

A user cannot administer other identities or configuration.

### 7.3 Account states

Supported states are:

- `invited`
- `enrollment_required`
- `active`
- `suspended`
- `deactivated`

Transitions:

```text
invited -> enrollment_required -> active
                               -> suspended
                               -> deactivated -> deleted
suspended -> active
suspended -> deactivated
deactivated -> enrollment_required
```

In the diagram, `deleted` is a permanent removal event rather than a persisted account state.

Rules:

- `invited` and `enrollment_required` users cannot use MCP.
- `suspended` users retain password and TOTP material but cannot authenticate normally.
- `deactivated` users lose password hashes, TOTP seeds, sessions, OAuth grants, and gateway references. System-owned API keys are unaffected by account lifecycle.
- Reactivating a deactivated local user creates a new temporary password and requires new TOTP enrollment.
- Permanently deleting a deactivated user removes the user record, profile, provider links, authenticators, sessions, grants, assignments, memberships, and other user-specific operational records.
- Permanent deletion retains no user tombstone. Self-contained, immutable audit events remain as historical proof and must not depend on a live user-table foreign key.
- Only an interactively authenticated superadmin or a valid `system` API-role key can permanently delete a deactivated ordinary user or admin. No API key can delete a superadmin.
- The last active superadmin cannot be suspended, deactivated, deleted, demoted, or automatically expired.

### 7.4 Users without service access

Removing a user's final direct or group-derived service assignment does not deactivate the account.

An active ordinary user with no service assignment:

- Remains active.
- Retains web self-service access.
- Cannot begin MCP OAuth authorization because MCP eligibility requires an effective service assignment.
- Cannot discover or invoke a service through an existing OAuth grant because service authorization is evaluated dynamically.
- Appears in the status/security dashboard as an active user without service access.

Removing an assignment invalidates capabilities for that service but does not revoke unrelated web sessions, OAuth grants, or capabilities.

Deactivation is always an explicit authorized action or the result of configured suspension/inactivity automation.

## 8. Authentication providers

### 8.1 Provider contract

Authentication must be implemented behind a provider contract that yields:

- A stable provider identifier.
- A stable provider subject.
- Verified authentication outcome.
- Verified MFA assurance.
- Trusted profile claims when configured.
- Authentication time and relevant assurance metadata.

The identity subsystem maps `(provider, provider_subject)` to one internal user UUID.

### 8.2 Local provider

The local provider owns:

- Email/password authentication.
- Password hashing.
- Temporary passwords.
- Mandatory TOTP enrollment and verification.
- Restricted enrollment and recovery sessions.
- Authentication attempt limits.

### 8.3 Generic OIDC provider

Version 2 must support a generic OIDC provider adapter suitable for standards-compliant providers such as Auth0 or Descope.

For an external identity:

- The external provider owns passwords and MFA.
- SecretSauce does not collect or store the external password or a duplicate local TOTP seed.
- The configured OIDC assurance requirements must prove MFA before SecretSauce treats authentication as eligible.
- Local roles, service groups, assignments, policies, sessions, and grants remain authoritative in SecretSauce.
- External identities are linked by issuer and provider subject, never automatically by email alone.
- Linking requires an invitation or explicit superadmin action and a verified provider identity.

Provider-owned profile fields must identify their source. External login must not silently overwrite administrator-maintained local authorization data.

## 9. Local password and TOTP requirements

### 9.1 Password policy

The default local password minimum is 12 Unicode characters.

Superadmins can configure the minimum from 8 through 128. SecretSauce must accept at least 128 characters and must not silently truncate passwords.

SecretSauce must:

- Use an approved memory-hard password hashing scheme, expected to be Argon2id.
- Store only password hashes, never reversible passwords.
- Check new passwords against an offline common, compromised, and context-specific blocklist.
- Permit paste and password-manager use.
- Apply stable Unicode normalization consistently.
- Avoid uppercase, lowercase, digit, symbol, or other composition requirements.
- Avoid routine password expiration.
- Force a password change after compromise, administrative reset, global security action, or noncompliance discovered after a policy-version change.

When the minimum or blocklist policy becomes stricter, SecretSauce cannot inspect existing hashes proactively. At the next successful password verification, it evaluates the submitted password against the current policy and routes a noncompliant user into the restricted password-change flow.

### 9.2 Temporary passwords

Temporary passwords:

- Are cryptographically random.
- Meet the current password length policy.
- Are displayed once.
- Are stored only as password hashes.
- Expire after 72 hours by default.
- Cannot authorize MCP.
- Can be used only to enter a restricted enrollment/password-change flow.

Version 2 does not email temporary passwords. Administrators deliver them through a separate trusted channel.

### 9.3 TOTP

TOTP is mandatory for every local account, including superadmins.

TOTP must:

- Follow RFC 6238-compatible enrollment.
- Use a unique cryptographically random seed per account.
- Encrypt seeds at rest.
- Never expose seeds to administrators.
- Display a seed/QR code only during the user's enrollment or replacement ceremony.
- Require a valid confirmation code before activation.
- Use a narrow documented clock-skew window.
- Reject reuse of an already accepted time-step value.
- Apply separate rate limits.

TOTP is not phishing-resistant. The product documentation must state this limitation and leave room for a future passkey/WebAuthn authenticator without making it a v2 requirement.

### 9.4 Login enumeration resistance

Authentication failures for nonexistent, ineligible, suspended, admin, temporary-password, missing-TOTP, and invalid-credential cases must use uniform external responses and comparable verification work.

For MCP OAuth authorization, an admin, superadmin, suspended/deactivated user, temporary-password user, or user without completed TOTP behaves as if no eligible MCP account exists.

No failure response may disclose which eligibility condition failed.

## 10. Enrollment, recovery, and security events

### 10.1 New local user enrollment

1. An authorized admin or superadmin creates/invites the user and assigns at least one service.
2. SecretSauce generates a temporary password and displays it once.
3. The user signs into the web self-service enrollment flow.
4. The user selects a compliant permanent password.
5. The user registers and confirms TOTP.
6. SecretSauce activates the account and invalidates the temporary credential.
7. MCP OAuth becomes eligible.

### 10.2 Administrative password reset

An authorized admin may reset an ordinary user assigned to an administered service. A superadmin may reset any existing account, including their own.

Reset:

- Requires justification.
- Generates a temporary password shown once.
- Forces password change at next login.
- Invalidates web sessions, OAuth grants, and gateway references. System-owned API keys are unaffected.
- Does not erase TOTP unless TOTP reset is also selected.

### 10.3 Administrative TOTP reset

Reset:

- Requires justification.
- Erases the current TOTP seed.
- Forces re-enrollment through a restricted login flow.
- Invalidates web sessions, OAuth grants, and gateway references.

### 10.4 Self-service password and TOTP changes

All active users may:

- Change their password after verifying the current password and TOTP.
- Replace TOTP after verifying the current password and current TOTP, then confirming the new TOTP.

Successful password, TOTP, or email change increments the security epoch and logs the user out of all web sessions, OAuth grants, and MCP access, including the current session after the operation completes.

### 10.5 System-wide password change

A superadmin can require all local users, including every superadmin, to change passwords at next login.

The action:

- Requires explicit confirmation, justification, and step-up.
- Increments the global password-policy/security epoch.
- Invalidates all web sessions, OAuth grants, and gateway references. System-owned API keys are unaffected.
- Preserves existing password hashes only for entry into the restricted password-change flow.

### 10.6 System-wide TOTP reset

A superadmin can erase all local TOTP seeds, including their own.

The action:

- Requires explicit confirmation, justification, and step-up.
- Invalidates all sessions, OAuth grants, and references.
- Places every local account into restricted TOTP enrollment.
- Logs out the initiating superadmin after the transaction commits.

### 10.7 Break-glass CLI

A local CLI command can reset any existing account, including a superadmin.

It must:

- Require direct host access.
- Generate a temporary password shown once.
- Erase TOTP.
- Increment the account security epoch.
- Invalidate all sessions, grants, and references.
- Preserve role and immutable user UUID.
- Record a sanitized break-glass audit event, including the local operating-system actor when available.
- Never accept or print a user-selected raw password through command-line arguments.

## 11. Sessions and step-up authentication

### 11.1 Default lifetimes

Defaults:

- Admin/superadmin web session: 12-hour absolute lifetime, 15-minute inactivity.
- User self-service web session: 24-hour absolute lifetime, 1-hour inactivity.
- OAuth access token: 5 minutes.
- OAuth refresh grant: 30-day inactivity and 90-day absolute lifetime.

Superadmins can configure each lifetime independently within hard, documented safety bounds.

Reducing a lifetime applies to existing state during subsequent validation. Increasing a lifetime applies only to newly issued sessions or grants.

### 11.2 Web session form

Web sessions must be opaque, random, server-side, revocable records represented in the browser by Secure, HttpOnly, appropriately scoped cookies.

They must not be authorization-bearing self-contained browser JWTs that prevent immediate revocation.

### 11.3 Step-up modes

A superadmin selects one global mode:

- `five_minutes`: successful password+TOTP step-up authorizes sensitive actions for five minutes.
- `always`: each sensitive transaction requires a new password+TOTP challenge.

In `always` mode:

- Step-up produces a single-use nonce bound to the exact transaction.
- A batch mutation is one transaction.
- An accepted TOTP value cannot be reused, even for another transaction during the same TOTP interval.

Sensitive transactions include:

- Password or TOTP administrative reset.
- Role or account-status change.
- Security-setting change.
- API-key creation or revocation.
- Secret-bearing backup.
- Restore.
- Vault-key operation.
- Approval of a SecretSauce API key as a downstream credential.
- Permanent deletion.
- System-wide password or TOTP event.

Step-up applies to human browser sessions. API keys cannot perform step-up; an API-key request is allowed or denied solely by key validity, its immutable API role/resource scope, the static API-role permission matrix, target eligibility, and applicable rate limits. An operation explicitly allowed to an API role does not acquire a human step-up requirement merely because the corresponding browser operation is sensitive.

## 12. Suspension and inactivity controls

Superadmin-configurable options:

- Automatic inactivity suspension after a specified number of days.
- Automatic deactivation after a specified number of days continuously suspended.

Both options default to disabled.

Qualifying activity is a successful interactive login, authenticated MCP request, or authenticated management API operation. Background refresh alone is not activity.

Rules:

- Manual suspension and reactivation require justification.
- Admins can suspend/reactivate ordinary users assigned to an administered service.
- Superadmins can suspend/reactivate any account except that protections for the last active superadmin apply.
- Suspended users can be deactivated.
- Automatic jobs must not suspend or deactivate the last active superadmin.
- Every automated state transition is audited with the configured rule as actor/context.

## 13. Service-scoped groups and assignments

### 13.1 Group scope

Groups belong to exactly one service.

This prevents an admin who controls one service from changing membership that grants access to another service.

Groups have:

- Immutable UUID.
- Service UUID.
- Name and description.
- Active/archived state.
- Optimistic-concurrency version.

### 13.2 Assignment selectors

Services, credentials, and policies support:

- `all`
- One or more service-scoped groups.
- One or more individual ordinary-user UUIDs.

At the service boundary, `all` means every active ordinary user in the installation.

At credential and policy boundaries, `all` means every active ordinary user already authorized to the parent service.

`all` never includes anonymous users, admins, or superadmins.

Direct user assignment must display a warning recommending a group unless the administrator confirms the exception.

### 13.3 Service assignment

An active ordinary user must have a direct or group-derived service assignment to:

- Discover the service.
- Obtain a service or credential reference.
- Invoke the service.
- See the service name on their own grant/access view.

### 13.4 Credential assignment

Credential assignment is an additional boundary. A user with service access cannot request or use a credential unless that credential's selector applies.

If a request uses multiple configured credential references, assignment must succeed for every credential.

## 14. Service lifecycle and editor

### 14.1 Creation and ownership

Only a superadmin can create a service record.

A new service begins as a non-routable draft. The superadmin assigns one or more admins. An assigned admin may configure the service from scratch and publish it after validation.

Only a superadmin can:

- Archive or permanently delete a service.
- Assign/remove service administrators.
- Transfer administrative responsibility.

### 14.2 Service editor

The editor supports:

- Name, stable slug, description, and documentation URL.
- Destinations, allowed schemes, hosts, ports, and TLS behavior.
- Credential metadata and assignment.
- Service policy operating mode and rules.
- Group and user assignments.
- Draft validation.
- Publish.
- Clone.
- Copy/paste of non-secret configuration.
- Archive/delete subject to permissions.
- Version history and rollback where retained data permits.

Every published mutation uses optimistic concurrency. A stale version returns a conflict with enough safe metadata to refresh or compare; it never silently overwrites.

### 14.3 Runtime invalidation

- Service disable/archive invalidates its active gateway references.
- Destination change invalidates references bound to changed destinations.
- Credential replacement/delete invalidates references for that credential.
- Assignment removal takes effect immediately.
- Policy changes are evaluated immediately on the next request.

## 15. Credential model, vault, and editor

### 15.1 Credential metadata

A credential contains:

- Immutable UUID.
- Parent service UUID.
- Name and description.
- Usage kind and placement metadata.
- Optional prefix/suffix placement hints.
- Optional enforced-header ownership configuration.
- Assignment selector.
- Policy rules and operating mode where configured.
- Status: `configured`, `unconfigured`, `disabled`, or `archived`.
- Last-four hint captured during the most recent write.
- Rotation/update timestamp.
- Optimistic-concurrency version.
- Vault locator that is not itself a credential.

### 15.2 Write-only UX

The control plane may:

- Submit a new credential value.
- Replace an existing value.
- Delete a value.
- Show status, last four, and update time.

It may not:

- Read a stored value.
- Reveal a stored value through export, logs, audit, error details, previews, clone, or API response.

### 15.3 Clone/copy semantics

Credential cloning copies:

- Metadata.
- Usage configuration.
- Assignments.
- Policies.

It never copies the secret value. The clone begins `unconfigured`.

Policy sets/rules can be copied between credentials or services. Copies receive new immutable IDs and do not remain implicitly linked unless a future shared-template feature is designed explicitly.

### 15.4 Missing secret behavior

An `unconfigured` credential cannot issue usable gateway references and cannot be substituted.

The request must fail before downstream I/O. SecretSauce must never use syntactically plausible dummy credentials.

## 16. Policy model

### 16.1 Policy boundaries

Policy is evaluated at:

- The service.
- Every configured credential used by the request.

No credential-level allow can override a service-level deny. The final request is allowed only when the service boundary and every used credential boundary allow it.

### 16.2 Rule fields

A rule contains:

- Immutable UUID.
- Name and description/reason.
- Effect: `allow` or `deny`.
- Integer priority.
- Method selectors.
- Canonical host selectors.
- Canonical path selectors.
- Principal selector: `all`, groups, or user UUIDs.
- Response-scanning/binary safeguards where supported.
- Enabled/disabled state.
- Optimistic-concurrency version.

An empty explicit group/user selector is invalid. An omitted selector is normalized deliberately to `all` only when the editor/API makes that effect clear.

### 16.3 Deterministic evaluation

For each policy boundary:

1. Determine the authenticated ordinary user and current service-group memberships.
2. Retain rules whose principal selector applies.
3. Retain rules matching normalized method, canonical destination host, and the same canonical path representation sent downstream.
4. Find the highest numeric priority among matching rules.
5. Ignore all lower-priority matches.
6. If any rule at the selected priority is `deny`, the boundary denies.
7. Otherwise, the boundary allows.
8. If no rule matches, apply that boundary's operating mode.

The operating mode is `allow` or `deny` and defaults to `deny`.

Multiple group memberships add applicable rules; groups have no implicit precedence.

### 16.4 Policy explanation

The live evaluator must produce structured explanation data without exposing secret values.

The UX helper accepts:

- Service.
- User.
- Destination.
- Method.
- Path or allowed URL.
- Selected credential(s).

It shows:

- User and applicable service groups.
- Service and credential assignments.
- Canonical request target.
- Applicable and inapplicable policies with reasons.
- Matching priorities.
- Deny tie-breaks.
- Default-mode fallbacks.
- Each boundary result.
- Final outcome.
- Quick links to service, credential, group, user, and policy editors.

The simulator must call the same domain evaluator as runtime enforcement. A second independently implemented policy algorithm is prohibited.

## 17. OAuth and MCP eligibility

### 17.1 Local MCP OAuth login

Local OAuth authorization for MCP requires:

- Active `user` role.
- Permanent password.
- Valid TOTP.
- At least one effective service assignment.
- No suspension, deactivation, forced-password-change, or forced-TOTP-enrollment state.

Ineligible users receive the same public failure as nonexistent accounts.

### 17.2 External-provider MCP login

External-provider login requires:

- Successful generic OIDC authentication.
- Configured MFA assurance.
- Linked active internal `user` account.
- At least one effective service assignment.
- No local suspension or deactivation.

### 17.3 OAuth grant model

An OAuth grant represents:

- Internal user UUID.
- OAuth client identifier/name.
- MCP resource/audience.
- OAuth scopes.
- Issue, use, expiry, and revocation state.
- Refresh-token family and rotation state.

It does not permanently encode services, credentials, or policies. Those are evaluated dynamically.

Refresh tokens for public clients must rotate with replay-family revocation or use an equally strong sender-constrained mechanism.

### 17.4 Grant visibility

Superadmins see all active and historical grant metadata.

Admins see:

- Grants whose user currently has access to an assigned service.
- Only the service-scoped computed relationship relevant to the admin.
- No unrelated service, credential, or policy detail.

Users see only:

- Their own clients/grants.
- Issue, last-use, and expiry metadata.
- The names of services currently reachable.
- A revoke action.

Every grant view maps to the immutable user UUID and current profile label.

### 17.5 Revocation and access invalidation

Superadmins can revoke OAuth grants by:

- Grant/token family.
- User.
- Client.
- All grants.

An admin cannot revoke an entire multi-service OAuth grant merely because it touches one assigned service. The admin can invalidate service-scoped capabilities and remove service access.

Service-, credential-, policy-, or assignment-scoped actions:

- Invalidate affected `gref`/`sec` capabilities.
- Take effect in dynamic authorization immediately.
- Do not mislabel that action as OAuth grant revocation.

The UX may present these related controls together under “Access and sessions,” but it must distinguish their semantics.

## 18. Gateway references and status

### 18.1 Reference rules

`gref` and `sec` references remain:

- Cryptographically random.
- Stored/recoverable only as required by the existing capability design.
- Bound to authenticated user UUID, service, and relevant destination/credential.
- Ephemeral across restart unless a future design explicitly changes that contract.
- Invalidated by relevant user, service, credential, assignment, or global security events.

### 18.2 Status counts

Status views can show:

- Active `gref` count per service and credential.
- Active `sec` count per service.
- Expiring/expired counts.
- Invalid-reference warning counts.

They must never show:

- Full references.
- Reference prefixes sufficient to reconstruct/identify the bearer value.
- Credential values.
- Detected response secrets.

## 19. API-key model

### 19.1 System ownership

Management API keys are system principals, not owned by a user account.

Creation records the human creator for audit only. Disabling or deleting the creator does not revoke the key.

API roles are statically defined product roles. They are not aliases for `user`, `admin`, or `superadmin`, and they are not linked to an account role. Changing a human account role has no effect on any API key.

The API roles are:

- `service`
- `all_services`
- `system`

An API-role contract can change only through an explicit management-API product/schema change with release notes, migration consideration, and security regression coverage.

### 19.2 Key fields

An API key contains:

- Immutable UUID.
- Required human-readable nickname.
- Recognizable non-secret key identifier/prefix.
- Random secret shown once.
- Slow verification hash.
- Last four characters.
- Immutable API role.
- Immutable service UUID resource scope when the API role is `service`.
- Immutable expiration, except it may be shortened.
- Status: active, expired, or revoked.
- Creation, last-use, expiration, and revocation timestamps.
- Creation actor audit reference.

The raw key is never stored after creation and cannot be recovered.

### 19.3 API roles and resource scopes

API roles are mutually exclusive. The `service` role requires exactly one immutable service UUID; the other roles have no service target.

`all_services` applies to current and future services and requires a prominent creation warning.

`system` does not implicitly include service authority.

### 19.4 Creation and visibility

An admin can create only `service` keys scoped to assigned services.

All admins assigned to that service can see key metadata and revoke the key.

Only a superadmin can create or see `all_services` or `system` key metadata.

“See” means nickname, UUID, last four, API role/resource scope, status, expiry, last use, and audited activity. It never means the raw key or verifier hash.

### 19.5 Authority

A `service` key may manage its one service, destinations, credentials, policies, service groups, and service membership. It can invite an ordinary user directly into the scoped service, view ordinary users related to that service, and reset passwords or TOTP for those related ordinary users. It cannot edit a user's profile or change account status.

An `all_services` key has the same service-management authority across current and future services and may create or archive services. It can invite and view ordinary users and reset their passwords or TOTP. It cannot edit a user's profile or change account status.

A `system` key may manage permitted global settings and completely manage ordinary-user and admin accounts without step-up, including profile edits, password/TOTP reset, suspension, reactivation, deactivation, permanent deletion of a deactivated account, and `user`/`admin` role changes. It cannot view or affect a superadmin.

Removing a user's final service membership never deactivates the account. Account-status changes require the `system` API role.

An API-authorized password reset returns the new temporary password exactly once in a non-cacheable response and never logs or audits it. A TOTP reset returns no TOTP seed; the user completes enrollment interactively.

The static endpoint permission matrix in Section 30 is authoritative.

### 19.6 Hard-denied API-key operations

No API key can:

- View, edit, suspend, deactivate, delete, or assign a superadmin.
- Grant the superadmin role.
- Create, rotate, extend, revoke, or delete API keys.
- Change API-key authentication rules or bypasses.
- Approve a SecretSauce API key as a downstream credential.
- Export downstream credential values.
- Restore a backup.
- Trigger global password or TOTP reset.
- Satisfy password+TOTP step-up.
- Perform a vault-key operation.

The `service` and `all_services` API roles additionally cannot edit user profiles, suspend, reactivate, deactivate, permanently delete, or change the platform role of a user.

### 19.7 Expiration and rotation

Expiration supports integer-day lifetimes or explicit non-expiring status.

API role, service resource scope, and expiration are immutable. Expiration may be shortened, but never extended. A non-expiring key cannot be converted into an expiring key as a substitute for rotation; it can only be revoked.

Rotation creates a replacement key and revokes the old key.

### 19.8 Auditing

Every use records:

- Actor type `api_key`.
- Immutable key UUID.
- Nickname snapshot at event time.
- Last four.
- API role and resource scope.
- Authentication and authorization outcome.
- Target and action.
- Safe request metadata.

Historical events retain the nickname snapshot even if the current nickname changes.

## 20. Protection against self-use of SecretSauce API keys

### 20.1 Credential creation

General management API endpoints must reject attempts to save an active SecretSauce API key as a downstream credential.

The only allowed workflow is:

1. An interactive superadmin browser session opens the dedicated approval workflow.
2. The superadmin completes current step-up requirements.
3. The UX presents the recursion and privilege risk.
4. The superadmin explicitly accepts the risk.
5. The credential is marked with a durable self-use approval record.

API-key authentication cannot call this endpoint.

### 20.2 Runtime protection

When an MCP request targets SecretSauce itself:

- Raw active SecretSauce API keys in structurally inspected header, query, or body values must be rejected before downstream I/O.
- The attempt must create a sanitized security warning and audit event.
- An approved vault credential used through its `gref` may be substituted only after all normal authorization and policy checks.

Keys must use a recognizable format so candidates can be located and verified without logging them.

The documentation must state that arbitrary encoding, fragmentation, or transformation cannot be detected universally. The control is exact/structural defense, not a universal non-exfiltration claim.

## 21. Web control plane

### 21.1 Deployment

The web UX and its API use a dedicated listener and configurable port, allowing a separate reverse proxy and public origin from the MCP endpoint.

The recommended stack is:

- React.
- TypeScript.
- Vite.
- Fastify management API.
- OpenAPI contract.

The architecture review may change libraries only with a proportionate justification.

### 21.2 Browser security

The control plane must use:

- Secure, HttpOnly cookies.
- Appropriate SameSite policy.
- CSRF protection on cookie-authenticated mutations.
- Strict CSP.
- Frame-ancestor denial.
- Referrer restrictions.
- MIME sniffing protection.
- No credential-bearing URLs.
- Origin/Host validation.
- No permissive cross-origin management API by default.
- Cache prevention for authentication and secret-entry pages.

### 21.3 Responsive product UX

The UX must:

- Use SecretSauce product branding.
- Make productive use of wide browser layouts.
- Collapse cleanly to narrow screens.
- Keep destructive controls visually distinct.
- Provide accessible keyboard/focus behavior and semantic labels.
- Avoid displaying raw secrets or references in tables, URLs, DOM diagnostics, notifications, or client logs.

### 21.4 Primary navigation

Expected sections:

- Overview/status.
- Services.
- Credentials.
- Policies.
- Users.
- Service groups.
- Access and sessions.
- API keys.
- Activity.
- MCP audit.
- Administrative audit.
- Security.
- Backup/restore.
- Migration/status where applicable.
- Personal profile/security for all roles.
- OpenAPI documentation.

## 22. Editors and mutation behavior

Service, credential, and policy editors support:

- Create where role permits.
- Edit.
- Clone.
- Copy/paste of safe structured configuration.
- Bulk policy copy.
- Archive/delete where role permits.
- Validation before save/publish.
- Optimistic concurrency.

Secret values, API keys, TOTP seeds, password material, OAuth bearer values, and active references are excluded from copy/paste and clone payloads.

Mutation APIs must:

- Validate positive and negative cases.
- Use stable object UUIDs.
- Accept an expected version/ETag.
- Return `409` on stale writes.
- Be idempotent where retries could duplicate destructive work.
- Commit the mutation and administrative audit record atomically.

## 23. Audit systems

### 23.1 Separate audit domains

SecretSauce retains distinct:

- MCP/runtime audit events.
- Control-plane administrative/security audit events.

They may share infrastructure but must remain distinguishable by schema, permissions, retention, and UX.

### 23.2 Control-plane audit content

Each event contains:

- Immutable event ID.
- Timestamp.
- Actor type and immutable actor ID.
- Actor role/authentication method.
- Action and result.
- Target type and UUID.
- Service UUID where applicable.
- Required justification where applicable.
- Sanitized field-level before/after changes.
- Request correlation ID.
- Safe source/client metadata.
- Failure category without raw secrets.

Successful mutations and their audit events commit in one transaction. If the control-plane audit cannot be persisted, the mutation fails closed.

Denied and failed sensitive actions are also audited.

Audit actor and target identity fields are denormalized event-time snapshots. They must remain intelligible after permanent user deletion and must not require a live foreign key to the user table. Permanent deletion does not rewrite or remove immutable audit events.

### 23.3 Prohibited audit content

Neither audit contains:

- Passwords or password hashes.
- Temporary passwords.
- TOTP values or seeds.
- Raw API keys or verifier hashes.
- Credential values.
- Full `gref` or `sec` references.
- Authorization headers.
- Cookies.
- Raw request bodies.
- Downstream response bodies.

### 23.4 Search

The UX supports full-field search over a sanitized canonical representation of all event fields except timestamp.

Time filtering is separate and supports inclusive:

- Last 24 hours.
- Last 7 days.
- Last 30 days.
- Last 90 days.
- Last year.
- Absolute start datetime.
- Absolute end datetime.

Both absolute endpoints are inclusive. Timezone presentation must be explicit while storage remains UTC.

SQLite FTS is the expected small-deployment mechanism.

### 23.5 Audit visibility

- Superadmins see all audit domains.
- Admins see administrative and MCP events scoped to assigned services and relevant ordinary users.
- Users see only their own security/session/grant events, not the administrative audit explorer.

### 23.6 Retention

Default retention is 400 days. Superadmins can configure longer or unlimited retention, with disk-capacity warnings.

Deletion/retention jobs are themselves audited and must not mutate historical event content before expiry.

## 24. Activity and operational status

### 24.1 Activity dimensions

Endpoint activity is aggregated by:

- Service.
- Destination.
- Method.
- Matched policy rule or default outcome.
- Allow/deny.
- Downstream status class.

Raw query strings, request bodies, headers, and downstream response bodies are not activity dimensions.

Generic raw paths can contain identifiers and high-cardinality data. The initial endpoint view therefore uses matched policy rules as endpoint categories. Unmatched traffic appears under the boundary default.

### 24.2 Reports

The UX shows:

- Most active services.
- Most active policy-defined endpoints.
- Allow/deny trends.
- Downstream status trends.
- Active-user counts without exposing users outside admin scope.
- Credential-use counts without exposing values.
- API-key activity.

### 24.3 Status page

The status page includes:

- Service state.
- Configured/unconfigured/disabled credential counts.
- Active `gref` and `sec` counts per service.
- Active OAuth grant counts.
- Active API-key counts by permitted API role/resource scope.
- Database health.
- Vault health/lock state.
- Audit persistence health.
- Schema migration state.
- Background security-job state.
- Disk/retention warnings where available.
- Expiring API keys.
- Suspended/deactivated account counts according to viewer scope.
- Unresolved post-migration or post-restore tasks.

No full references, credentials, API keys, TOTP data, OAuth tokens, or downstream bodies appear.

### 24.4 Security dashboard

The security dashboard highlights:

- Repeated login/TOTP/API failures.
- Rate-limit activation.
- Break-glass use.
- Self-API-key protections.
- Global password/TOTP events.
- User suspension/deactivation.
- Stale, never-used, and unexpectedly active API keys.
- Non-expiring API keys.
- Missing credentials.
- Vault/audit degradation.
- Pending enrollment.
- Active ordinary users without service access.
- Last-superadmin protection events.

## 25. Rate limits and abuse controls

Separate configurable, bounded controls are required for:

- Login by account and direct source.
- Password verification.
- TOTP verification.
- Enrollment.
- OAuth authorization/token operations.
- Management API per API key and source.
- Backup generation.
- Search/report queries.
- MCP body parsing and downstream concurrency.

Forwarding headers do not select the trusted rate-limit identity unless a separately validated proxy-trust design is configured.

Rate-limit logs and responses must not reveal account existence or raw credentials.

## 26. Backup

### 26.1 Archive format

Backups use a `.tar.gz` archive with YAML for structured product data.

Expected contents:

```text
manifest.yaml
services.yaml
credentials.yaml
policies.yaml
secrets.enc          # optional
```

The portable configuration domain contains only:

- Services, including destinations and TLS behavior.
- Credential definitions and placement metadata.
- Policies and request-matching/response-protection behavior.
- Optional passphrase-encrypted downstream credential values.

The manifest contains:

- Format and schema version.
- Product version.
- Creation time.
- Backup type.
- Included/excluded domains.
- Object counts.
- Content checksums.
- Secret-encryption metadata without the passphrase or derived key.

### 26.2 Always-excluded domains

Every backup excludes:

- Users and profiles.
- Roles.
- Service groups.
- Admin-service assignments.
- User-service assignments.
- Group memberships.
- Every service, credential, and policy principal binding, including `all`.
- Password hashes and temporary passwords.
- TOTP seeds.
- External identity links.
- Web sessions.
- OAuth authorization codes, grants, refresh tokens, and access tokens.
- API keys and verifier hashes.
- Active `gref` and `sec` references.
- Audit history.
- Activity aggregates.
- System, password, TOTP, session, rate-limit, inactivity, retention, and security settings.
- Listener addresses and ports.
- Public origins and reverse-proxy configuration.
- Filesystem paths.
- OIDC configuration and client secrets.
- Vault configuration, key locations, and encryption-key material.
- Branding and other instance-specific settings.

The UX/API must warn about these exclusions before backup and in the manifest.

Audit history and activity are available through separate, permission-checked exports. They are not part of a restorable configuration archive.

The archive captures portable configuration for interacting with downstream services; it is not an installation clone.

### 26.3 Interactive backup

An interactively authenticated, stepped-up superadmin can create:

- A credential-less backup.
- A backup with downstream credential values encrypted by a user-provided passphrase.

Secret-bearing backup:

- Uses a memory-hard passphrase KDF.
- Uses authenticated encryption.
- Never writes the passphrase to persistent state, logs, audit, command history, or archive metadata.
- Keeps credentials in a distinct encrypted payload.

### 26.4 API-key backup

Only a `system` API-role key can create a complete programmatic backup.

Programmatic backup:

- Is always credential-less.
- Rejects any request to include secrets.
- Excludes audit history and activity.
- Omits secret-derived last-four credential hints.
- Is rate-limited and audited.
- Records archive ID, key identity metadata, object counts, and archive checksum.
- Streams directly or uses a short-lived, single-use download authorization.

`service` and `all_services` API-role keys cannot create a complete backup. Service-scoped export is outside initial v2 scope.

## 27. Restore

### 27.1 Authorization

Restore requires:

- Interactive superadmin browser session.
- Current superadmin password and TOTP through configured step-up.
- Explicit destructive confirmation.
- Required justification.
- A prominent warning that backed-up configuration domains will be replaced.

API keys cannot restore.

### 27.2 Validation

Before commit, SecretSauce must:

- Safely unpack without path traversal, symlink, device, or archive-bomb behavior.
- Bound archive size, file count, YAML complexity, and object counts.
- Validate manifest checksums and supported schema versions.
- Validate every object and cross-reference.
- Produce a preview of creates, replacements, exclusions, missing secrets, and cleared assignments.
- Verify that the current installation retains at least one active superadmin.

### 27.3 Replacement semantics

Restore:

1. Preserves the target installation's users, roles, superadmins, and local authenticators.
2. Preserves all target instance and deployment settings.
3. Replaces only services/destinations, credential definitions, and policy definitions.
4. Removes service groups and every service-user, service-admin, group-membership, credential-principal, and policy-principal binding associated with the replaced configuration.
5. Restores policy matching/effect/priority/response behavior as disabled and unassigned, even when the source binding was `all`.
6. Revokes all target API keys.
7. Revokes all web sessions and OAuth grants.
8. Invalidates all active gateway references.
9. Marks credentials `unconfigured` when values are absent or unavailable.
10. Keeps restored services unavailable through MCP until administrators recreate groups/bindings, assign service administrators/users, bind and enable policies, and supply required credentials.
11. Produces a persistent remediation checklist.

The initiating superadmin is logged out after successful restore.

### 27.4 Missing passphrase

If `secrets.enc` exists but no valid passphrase is provided:

- Non-secret configuration still restores.
- No credential value is imported.
- Every affected credential becomes `unconfigured`.
- The preview and post-restore checklist identify all affected credential records.

### 27.5 Atomicity and recovery

Restore runs in maintenance mode and stages all data before transactional replacement.

A validation or staging failure leaves active configuration unchanged.

The implementation must provide a bounded local pre-restore recovery mechanism sufficient to roll back an unexpected commit failure without exposing credential values.

## 28. Migration from v1 YAML

### 28.1 Migration form

Migration is a one-time local CLI workflow with:

- Dry run.
- Validation report.
- Explicit commit.
- Transactional rollback on failure.
- Sanitized diagnostics.

After successful migration, the database is the sole source of truth. SecretSauce does not support simultaneous YAML/database configuration authority.

### 28.2 Identity behavior

Migration does not import users.

It discards:

- The v1 built-in administrator username and password hash.
- Every `access.users` value.
- OAuth grants/refresh state.
- Any inferred user, group, or admin assignment.

The migration report states how many ACL entries were discarded without exposing unnecessary identity data.

Before commit, the operator creates a new v2 bootstrap superadmin through a secure interactive flow.

### 28.3 Configuration behavior

Migration:

- Assigns new internal UUIDs.
- Preserves stable service slugs where valid and unique.
- Imports service metadata, destinations, TLS settings, credential metadata, and policies.
- Creates no service admins, groups, group memberships, or ordinary users.
- Leaves services inaccessible through MCP until v2 assignments are created.
- Invalidates all v1 references and OAuth state.

### 28.4 Credential behavior

The CLI can explicitly resolve v1 environment/file credential sources and write their clean values into the vault.

Rules:

- Resolution is opt-in.
- Values never appear in reports, logs, shell arguments, or audit.
- Missing/unreadable sources create `unconfigured` credentials.
- Migration cannot preserve external file/environment sources as a second ongoing authority unless a future credential-provider feature is designed explicitly.

## 29. Management API and OpenAPI

### 29.1 Contract

The management API uses:

- Versioned paths.
- JSON request/response schemas.
- OpenAPI documentation generated from or validated against runtime schemas.
- Stable structured error codes.
- Pagination and hard query bounds.
- ETags/versions for mutable resources.
- Idempotency keys for retry-sensitive operations.

### 29.2 Authentication methods

Endpoints explicitly allow one or more of:

- Browser session.
- API key.
- Local CLI/host authority.

No endpoint infers that API-key authentication can satisfy human step-up.

### 29.3 Secret inputs

Credential, password, TOTP, temporary-password, passphrase, and API-key inputs:

- Never appear in URLs.
- Are accepted only over protected channels.
- Are excluded from logs, traces, errors, analytics, and audit.
- Use response cache prevention.
- Have strict size limits.

## 30. Administrative permissions matrix

API roles in this matrix are static product contracts and are independent of account roles.

| Capability | User | Admin | Superadmin | `service` API role | `all_services` API role | `system` API role |
| --- | --- | --- | --- | --- | --- | --- |
| Use MCP | Yes, if eligible | No | No | No | No | No |
| Manage own password/TOTP | Yes | Yes | Yes | No account | No account | No account |
| View own grants | Yes | Yes | Yes | No account | No account | No account |
| View service configuration | No; service names only in own access view | Assigned services | All services | Scoped service | All services | No |
| Configure service/destinations | No | Assigned services | All services | Scoped service | All services | No |
| Manage credentials/policies | No | Assigned services | All services | Scoped service | All services | No |
| Create service | No | No | Yes | No | Yes | No |
| Archive service | No | No | Yes | No | Yes | No |
| Permanently delete service | No | No | Yes with step-up | No | No | No |
| Assign service admin | No | No | Yes | No | No | No |
| Manage service groups | No | Assigned services | All services | Scoped service | All services | No |
| Add/remove service membership | No | Assigned services | All services | Scoped service | All services | No |
| Invite ordinary user | No | Into assigned service | Into any service | Into scoped service | Yes | Yes, without service assignment |
| View ordinary users | Self | Users related to assigned services | All | Users related to scoped service | All ordinary users | All ordinary users |
| Edit ordinary-user profile | Self where permitted | Related users, not self | All | No | No | Yes |
| Reset ordinary-user password | No | Related users with step-up | All with step-up | Related users | All ordinary users | All ordinary users |
| Reset ordinary-user TOTP | No | Related users with step-up | All with step-up | Related users | All ordinary users | All ordinary users |
| Suspend/reactivate ordinary user | No | Related users with step-up | All with step-up | No | No | Yes |
| Deactivate ordinary user | No | Related users with step-up | All with step-up | No | No | Yes |
| Permanently delete deactivated ordinary user | No | No | Yes with step-up | No | No | Yes |
| Create/manage admin accounts | No | No | Yes | No | No | Yes |
| Change `user`/`admin` account role | No | No | Yes with step-up | No | No | Yes |
| View or affect a superadmin | No | No | Yes, subject to last-superadmin protections | Never | Never | Never |
| Manage global settings | No | No | Yes | No | No | Permitted settings |
| Trigger system-wide password/TOTP event | No | No | Yes with step-up | No | No | No |
| Create/revoke API keys | No | Assigned-service keys with step-up | All keys with step-up | No | No | No |
| Credential-bearing backup | No | No | Yes with step-up | No | No | No |
| Credential-less complete backup | No | No | Yes | No | No | Yes |
| Restore | No | No | Yes with step-up | No | No | No |
| Self-API-key credential approval | No | No | Yes with step-up | No | No | No |
| Vault-key operation | No | No | Yes with step-up | No | No | No |

Endpoint-level authorization is authoritative if a summary-cell description could be read broadly.

## 31. Logging, privacy, and redaction invariants

SecretSauce must never log by default:

- Raw credentials.
- Passwords or hashes.
- TOTP values or seeds.
- API-key values or verifier hashes.
- Authorization headers.
- Cookies.
- Full gateway references.
- Downstream response bodies.
- Raw authenticated request bodies.

Diagnostic context uses immutable IDs, safe names, counts, outcome codes, and redacted suffixes.

Profile data is visible only according to role/service scope. Search indexes contain only already-authorized sanitized audit fields.

## 32. Availability and deployment model

### 32.1 Single instance

Version 2 supports exactly one active application instance per database, vault, configuration, and MCP endpoint.

Sticky sessions do not make multiple replicas supported.

### 32.2 Listeners

At minimum:

- MCP/OAuth data-plane listener.
- Web/control-plane listener.
- Private vault-broker channel.

The public OAuth issuer/resource values remain origins where required, while ChatGPT's configured MCP Server URL includes the MCP path, such as `https://mcp.example.org/mcp`.

### 32.3 Health

Readiness must account for:

- Database access/schema.
- Vault availability.
- Audit persistence.
- Required signing/encryption keys.
- Background security jobs.
- Configuration activation state.

Health output is sanitized and never reveals paths, credentials, keys, tokens, internal errors, or user data.

## 33. UX-specific acceptance requirements

1. Wide service/policy editors use available horizontal space without producing unreadably long text lines.
2. Tables preserve essential identity/status/actions on narrow screens.
3. Every destructive operation identifies its exact target.
4. Restore and global-security actions require typed or equivalent high-friction confirmation in addition to step-up.
5. Credential fields never repopulate with stored values.
6. Copy/clone previews explicitly state that secrets are excluded.
7. Direct user assignment displays a group-preference warning.
8. API-key creation displays the raw key exactly once and requires confirmation that it has been saved.
9. Non-expiring and all-services keys display durable warnings.
10. Policy simulation links to every contributing object the viewer is authorized to inspect.
11. Audit search makes active time filters visible and states that endpoints are inclusive.
12. Post-migration and post-restore remediation remains visible until resolved or explicitly dismissed with audit.

## 34. Security acceptance criteria

### 34.1 Identity

- Duplicate normalized email is rejected.
- Immutable UUID references survive email/name changes.
- Admin/superadmin MCP OAuth attempts are indistinguishable from nonexistent accounts.
- Temporary-password and missing-TOTP users cannot obtain MCP grants.
- TOTP replay and rate-limit negative cases are tested.
- The last active superadmin cannot be lost through manual, automatic, API, migration, or restore paths.
- Removing a user's final service assignment leaves the account active but makes MCP ineligible.
- Permanent deletion removes the user record and related operational state without a tombstone while immutable, self-contained audit events remain readable.

### 34.2 Authorization

- Service access is required before credential or policy evaluation can lead to use.
- Credential access is required for every configured credential in a request.
- Group and direct-user selectors have positive and negative coverage.
- Highest-priority selection and deny-on-equal-priority are deterministic.
- Service denial cannot be overridden by credential allowance.
- The simulator and runtime produce identical outcomes for the same snapshot.

### 34.3 Secret handling

- Control-plane read APIs cannot retrieve vault values.
- Credential clones contain no secret.
- Unconfigured credentials fail before downstream I/O.
- Vault caller permissions have integration tests.
- Logs, audits, errors, browser output, backup manifests, and OpenAPI examples contain no real secret values.
- Self-API-key storage and runtime invocation protections have positive and negative tests.

### 34.4 Sessions and invalidation

- Password, TOTP, email, role, status, restore, and global-security events revoke required state immediately.
- Shortened session settings affect existing sessions.
- Admin promotion revokes MCP eligibility and grants.
- Service/credential/assignment changes invalidate affected references.

### 34.5 API keys

- Raw keys are shown once and stored only as verifiers.
- API role/resource scope and expiry cannot be expanded.
- Service admins cannot see keys outside assigned services.
- No key can affect a superadmin or call an interactive-only endpoint.
- `service` and `all_services` keys cannot edit profiles or change account status.
- `system` keys can completely manage ordinary-user and admin accounts without step-up.
- Account-role changes do not alter any API role.
- Only system keys can create credential-less complete backups.
- API-key audit records contain nickname/suffix but no raw value.

### 34.6 Backup/restore/migration

- Archives reject traversal, excessive size/count, unsupported schemas, malformed YAML, and bad checksums.
- Secret-bearing archives cannot be decrypted with a wrong/missing passphrase.
- Missing passphrase still permits non-secret restore with `unconfigured` credentials.
- Archives contain only portable service, credential, and policy configuration plus optional encrypted credential values.
- Restore preserves target identities and instance settings, removes groups/bindings, imports policies disabled/unassigned, and revokes keys/sessions/grants.
- Migration imports no users or v1 ACL values.
- Failed validation/restore/migration leaves active state unchanged.

## 35. Performance and scale targets

Version 2 is sized for a small installation, not enterprise scale.

Initial design targets:

- Up to 1,000 users.
- Up to 500 services.
- Up to 5,000 credentials.
- Up to 20,000 policy rules.
- Up to 10,000 active OAuth grant/token records.
- Existing bounded runtime reference limits remain configurable.
- Audit search over the retained local data set returns the first page within two seconds under normal single-instance load.
- Ordinary control-plane reads return within one second under normal load, excluding backup, restore, migration, and intentionally expensive reports.

The architecture review must validate or revise these targets before implementation planning, without turning the product into a distributed system.

## 36. Testing requirements

Every new external input and state transition requires positive and negative tests.

Required layers:

- Pure unit tests for policy, role, lifecycle, time-range, and scope algorithms.
- Table-driven contract tests for every account-role and static API-role matrix cell, including cross-service and superadmin denials.
- Repository/integration tests for transactions, optimistic concurrency, audit coupling, and retention.
- Vault permission and cryptographic-envelope integration tests.
- OAuth/browser-session/API-key authentication tests.
- Real HTTP tests for MCP and control-plane listener separation.
- Self-signed HTTPS transport regression coverage where downstream transport changes.
- Browser end-to-end tests for enrollment, TOTP, admin restrictions, credential write-only behavior, policy explanation, backup warning, and restore confirmation.
- Migration fixtures representing valid, partial, malformed, and secret-source configurations.
- Backup compatibility fixtures per supported archive schema version.
- Restore tests proving all principal bindings are excluded, policies return disabled/unassigned, and target instance settings remain unchanged.
- Permanent-deletion tests proving operational identity rows are removed while denormalized audit evidence remains readable.
- Security regression tests asserting prohibited values do not appear in logs, audits, API output, backups, or rendered pages.

The canonical full suite and build must pass for every implementation slice.

## 37. Documentation requirements

Version 2 documentation must include:

- Role and permission model.
- Local enrollment and recovery.
- Generic OIDC setup and assurance requirements.
- Password guidance aligned to NIST SP 800-63B-4.
- TOTP phishing-resistance limitation.
- Session and step-up behavior.
- Group and direct-assignment guidance.
- Exact policy algorithm with examples.
- Static API-role/resource-scope matrix and hard-denial model.
- Vault threat model and control-plane write-only limitation.
- Backup contents/exclusions and restore consequences.
- Migration dry run and discarded v1 identity behavior.
- Audit content and retention.
- Single-instance deployment limitation.
- Separate web/MCP reverse-proxy examples using `example.org`.
- ChatGPT Server URL containing `/mcp` versus OAuth origin values.
- OpenAPI reference.

## 38. Rollout and compatibility requirements

1. V1 configuration remains readable only by the migration tool after v2 database initialization.
2. Migration never rewrites the original YAML or source credential files.
3. All v1 OAuth grants and references become invalid.
4. Existing service slugs remain stable when valid and unique.
5. MCP tool names and the stateless HTTP model remain compatible unless a separately approved MCP contract change is required.
6. ChatGPT and Codex must both complete OAuth and use the resulting MCP service.
7. A v2 installation cannot start privileged service operation until database schema and vault readiness succeed.

## 39. Architecture-review questions

The subsequent architecture review must validate mechanisms, not reopen settled product behavior. It should answer:

1. What process/OS boundary gives the vault broker meaningful read/write capability separation?
2. Which SQLite access/migration library best fits Node 22 and the single-instance contract?
3. How are encrypted TOTP and vault master keys provisioned, rotated, and backed up without making the database self-decrypting?
4. Should same-process OAuth access tokens be opaque or short-lived signed tokens with mandatory grant-state validation?
5. How are audit FTS indexes populated transactionally without indexing prohibited fields?
6. How are pre-restore recovery snapshots encrypted and bounded?
7. What exact safe ranges apply to configurable session and rate-limit settings?
8. Which generic OIDC assurance claims/configuration are required to prove MFA without vendor-specific coupling?
9. How are configuration snapshots/version history retained without preserving deleted secrets?
10. How are high-volume MCP audit and activity aggregation bounded under the 400-day default?

## 40. Settled decisions

The following are not open questions for the architecture review:

- Default password minimum is 12.
- Password composition rules and routine maximum age are not supported.
- Local TOTP is mandatory.
- Groups are service-scoped.
- Direct user assignment is supported but discouraged.
- Policy uses highest priority with deny winning equal-priority ties.
- Service and every used credential policy boundary must allow.
- OAuth grants remain distinct from dynamic service/credential/policy authorization.
- SQLite and single-instance operation are the v2 product scale.
- Web/control plane uses a separate listener.
- Stored credential values are write-only to the control plane.
- Credential clones exclude secret values.
- API keys are system-owned and have immutable static API roles/resource scopes independent of account roles.
- API keys cannot manage other API keys or superadmins.
- Only the `system` API role can edit profiles or suspend, reactivate, deactivate, or permanently delete users/admins; it does so without step-up.
- Removing a user's final service assignment never deactivates the account.
- Only system API keys can produce a complete programmatic backup, and it is credential-less.
- API keys cannot restore.
- Backups contain only portable service, credential, and policy configuration plus optional encrypted credential values; all identity, authorization bindings, instance settings, audit, and runtime state are excluded.
- Restore preserves target identities and instance settings but removes groups/authorization bindings and restores policy logic disabled/unassigned.
- Permanent user deletion retains no user tombstone; immutable denormalized audit events remain.
- Migration imports no v1 users or ACL identities.
- Missing restored/migrated credentials are `unconfigured`, never dummy values.
- Endpoint activity is based on policy-defined categories rather than raw paths.
- TOTP `always` step-up uses a fresh single-use challenge for every sensitive transaction.

## 41. Traceability to the requested v2 capabilities

| Requested capabilities | Covered in |
| --- | --- |
| User UUID/profile/password/TOTP and provider extensibility | Sections 7–10 |
| Groups, subject assignment, RBAC, admin restrictions | Sections 7, 13, 30 |
| Separate responsive branded web UX | Sections 6, 21–22, 33 |
| V1 migration | Section 28 |
| Write-only credential vault and tokenization access | Sections 6, 15 |
| Administrative and MCP account separation | Sections 7, 9, 17 |
| Profile management and invalidation | Sections 7, 10 |
| Separate searchable UX/MCP audits and time ranges | Section 23 |
| Service creation/assignment/editor behavior | Sections 14, 22 |
| Status, active references/secrets, activity | Sections 18, 24 |
| User invitation/removal/deactivation | Sections 7, 10, 13 |
| Temporary password and mandatory TOTP enrollment | Sections 9–10 |
| Password/TOTP reset, deletion, break glass | Sections 7, 10 |
| Policy priority, group behavior, simulator/editor | Sections 16, 22 |
| Service/credential/policy assignment and clone/copy | Sections 13–16, 22 |
| System-owned static-role API keys | Sections 19–20, 30 |
| API-key self-use protection | Section 20 |
| Backup/restore and credential-less API backup | Sections 26–27 |
| OAuth grant visibility and invalidation | Section 17 |
| Security options, inactivity, suspension | Sections 9–12 |
| Global password/TOTP events and logout | Section 10 |
| Self-service password/TOTP replacement | Section 10 |

## 42. Standards references

- NIST SP 800-63B-4, Authentication and Authenticator Management: <https://pages.nist.gov/800-63-4/sp800-63b.html>
- RFC 6238, TOTP: Time-Based One-Time Password Algorithm: <https://datatracker.ietf.org/doc/html/rfc6238>
- RFC 7009, OAuth 2.0 Token Revocation: <https://datatracker.ietf.org/doc/html/rfc7009>
- RFC 9700, Best Current Practice for OAuth 2.0 Security: <https://datatracker.ietf.org/doc/html/rfc9700>
- RFC 9562, Universally Unique IDentifiers: <https://datatracker.ietf.org/doc/html/rfc9562>

## 43. Definition of ready for implementation planning

This PRD is ready for implementation planning when:

1. Product review confirms the settled behaviors.
2. Security review validates the trust boundaries and identifies required threat-model tests.
3. Architecture review answers Section 39 and produces a dependency-ordered design.
4. UX review provides the navigation, core workflow wireframes, and responsive/accessibility approach.
5. The data model and API contracts are reviewed for migration, deletion, audit, and optimistic-concurrency correctness.
6. A minimal-slice implementation plan identifies positive and negative tests, full-suite gates, and one reviewable commit per slice.
