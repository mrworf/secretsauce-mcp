# PRD: SecretSauce Web Console — Initial Release

**Status:** Product requirements for review; application implementation and specialist reviews are not complete.

**Date:** 2026-10-09. **Product:** `secretsauce-mcp`. **Product owner:** Repository maintainer.

**Authority:** This document records the agreed web-console expansion. It preserves `docs/prd.md` as the original gateway MVP specification and distinguishes existing behavior from future requirements. It does not claim the console is implemented or that the product establishes SOC 2 compliance.

## 1. Product definition and scope

**Purpose:** Make SecretSauce practical for a small organization to configure, operate, and audit through a modern web interface, while preserving its existing gateway capabilities.

**Deployment:** One organization per Docker deployment. Administrators manage the host, persistent storage, and any reverse proxy. Public exposure is optional; remote browser and MCP access must use HTTPS.

This replaces the original multi-tenant SaaS direction. Tenant provisioning, subscriptions, billing, and cross-tenant administration are excluded. Backup and restore cover the entire instance.

**Primary users:** Technical owners and administrators who configure agent access to HTTP APIs; members who use those services through ChatGPT or Codex; auditors who inspect access and activity.

**Product principles**

- Routine administration happens in the UI. Docker configuration supplies only startup essentials.
- Simple forms handle common tasks; advanced controls preserve existing functionality.
- Permissions and effective policy must be understandable before a change takes effect.
- Credentials remain write-only in normal administration.
- Changes must be recoverable, attributable, and explicit.
- Security exceptions remain available where supported today, with clear consequences.
- No service-specific integrations or tool packs are added.

**SOC 2 objective:** Provide controls and evidence supporting an operator's SOC 2 program, especially security, confidentiality, and recovery. SOC 2 examines an organization's controls and their operation; software features alone do not establish compliance. The operator remains responsible for infrastructure security, personnel processes, access reviews, incident response, and independent examination. [AICPA SOC resources](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services)

**Excluded from this release:** Multi-tenancy, SAML, browser OIDC login, SCIM, custom roles, groups, approval chains, billing, automatic downstream credential rotation, remote backup-storage integrations, active-active gateways, and a general-purpose secrets vault.

## 2. Existing product and configuration coverage

The current implementation is an MCP-controlled HTTP gateway. Agents discover services, obtain opaque credential references, and make requests. The gateway checks authentication, service access, destination, reference ownership, and request policy before substituting credentials.

It also protects detected secrets in downstream responses and provides denial explanations. Response scanning is best-effort protection; it cannot guarantee that an approved endpoint will never return a reversible transformation of a credential.

The implementation currently has:

- Five generic tools: `list_services`, `describe_service_policy`, `get_gateway_service_references`, `service_request`, and `explain_denial`.
- YAML configuration for the gateway, Secretlint rules, and sensitive-name rules.
- Credentials supplied through environment variables or files.
- External OAuth, built-in single-admin OAuth, and development bearer authentication.
- Explicit subject lists for service access.
- Instance-local references, denial records, and capacity controls.
- Optional durable audit output that currently permits operations to continue after an audit-write failure.
- No configuration console or multi-user administrative role model.

The current supported topology is one gateway instance. Stateless MCP HTTP does not make its application state shared or horizontally scalable.

The baseline is the [configuration reference](config-reference.md), [configuration types](../src/types.ts), and [policy implementation](../src/policy.ts), inspected at revision `07bf1c84ca2f9a0f0dd8dd8749f97bcee87b62dd`. Where the older [MVP PRD](prd.md) differs from current behavior, the verified implementation is the preservation baseline.

**Configuration coverage contract**

| Existing capability | Required console treatment |
|---|---|
| Service identifiers, names, descriptions, documentation links | Service details; identifiers remain stable after creation |
| Multiple destinations, base URLs, schemes, ports | Guided destination editor |
| Exact, suffix, and regex host matching | Exact matching by default; advanced matcher controls |
| Service and destination TLS verification | Visible inheritance and per-destination overrides |
| Multiple credentials and explicit unauthenticated downstream services | Credential editor and explicit “No downstream authentication” option |
| Credential placement, names, prefixes, suffixes, optional header enforcement | Guided placement editor with exact advanced controls |
| Subject-based service access | Explicit service assignments to users or registered MCP identities |
| Default allow/deny, rule priority, methods, host/path regexes, reasons | Policy editor and deterministic policy preview |
| Secretlint catalog, extend/replace, rule options, custom patterns, exclusions | Response-protection settings with advanced editor |
| Sensitive-name catalog, extend/replace, allow patterns | Separate response-protection settings |
| Per-rule scanning exceptions and binary-response controls | Advanced policy controls with effective-setting summaries |
| Reference lifetimes and all existing capacity, size, timeout, and scanner controls | Owner-managed limits, retaining existing defaults |
| OAuth settings, client restrictions, scopes, principal selection, token lifetimes | Owner-managed MCP authentication settings |
| Audit retention, diagnostics, health | Activity view and operational settings |

**BASE-01 — Preserve runtime contracts.** Preserve the five tools, supported request and response formats, reference binding, cookie restrictions, Base64 handling, binary behavior, tolerant JSON protection, and validation-before-substitution ordering.

**BASE-02 — Intentional changes.** Replace routine file-based configuration with UI-managed configuration; expand built-in authentication to multiple users; add administrative RBAC; make durable audit recording mandatory for sensitive work.

**BASE-03 — Credential migration.** Existing environment/file credentials can be migrated into encrypted managed storage. Continued environment-based credential provisioning is not required. Import must never grant web users arbitrary access to host files or environment variables.

## 3. Functional requirements and user experience

### Roles and access

There are four fixed human roles. A person has one role. Multiple Owners are supported.

| Capability | Owner | Administrator | Auditor | Member |
|---|:---:|:---:|:---:|:---:|
| Manage own password, MFA, and sessions | Yes | Yes | Yes | Yes |
| View all non-secret configuration | Yes | Yes | Yes | No |
| Configure services, credentials, policies, and scanning | Yes | Yes | No | No |
| Assign existing eligible identities to services | Yes | Yes | No | No |
| Invite, disable, recover users, or change roles | Yes | No | No | No |
| Manage instance authentication, SMTP, limits, and retention | Yes | No | No | No |
| Search/export instance audit evidence | Yes | Yes | Yes | No |
| Create/download backups or restore | Yes | No | No | No |
| Use MCP services | If assigned | If assigned | No | If assigned |
| View own service activity and denial explanations | Yes | Yes | No execution activity | Yes |

**AUTHZ-01 — Explicit execution access.** Administrative status does not automatically authorize downstream calls. Execution requires an eligible role, an explicit service assignment, valid MCP authorization, and an allowed request policy.

**AUTHZ-02 — Server enforcement.** Every management and MCP operation checks current permissions. Hiding controls in the UI is insufficient. Removing access or disabling an identity blocks subsequent requests, including requests using previously issued references.

**AUTHZ-03 — Owner continuity.** The final active Owner cannot be disabled, deleted, or demoted. Ownership transfer requires an already-enrolled replacement. The UI recommends a second Owner without requiring one.

**AUTHZ-04 — Administrative trust.** Owners and Administrators are trusted to configure credential destinations and policies. Write-only credential fields do not prevent a malicious administrator from configuring a credential-exfiltrating endpoint. The UI and security documentation must explain this boundary.

### Enrollment, authentication, and recovery

**IDENT-01 — Initial setup.** An uninitialized instance requires a one-time operator bootstrap proof before creating its first Owner. The first person who discovers the web URL must not be able to claim the instance. Setup collects instance name, access URL, Owner credentials, MFA enrollment, and backup recovery material.

**IDENT-02 — Browser login.** All human users authenticate with a password and authenticator-app TOTP. MFA enrollment must finish before management access or built-in MCP authorization is granted.

Passwords support password managers and paste, use a minimum of 15 characters, allow at least 64 characters, and reject common compromised values. No arbitrary composition rules or periodic password expiry are required.

**IDENT-03 — Invitations.** Owners issue expiring, single-use invitations containing a predetermined role. Invitations expire after 72 hours and can be revoked or reissued. Users choose their own password and enroll MFA. Public self-registration is excluded.

**IDENT-04 — Optional SMTP.** Owners configure SMTP, sender identity, encrypted SMTP credentials, and a test message through the UI. Email supports invitations, password resets, security notifications, and backup/audit failure alerts. Without SMTP, Owners share one-time links through an existing trusted channel.

Failed delivery must be visible and must not falsely mark an invitation as accepted. Email delivery failure must not disable gateway operation.

**IDENT-05 — Recovery.** Users receive single-use recovery codes, shown once and stored as hashes. Password reset does not remove MFA. Replacing MFA requires a valid existing factor, a recovery code with password verification, or an Owner-authorized recovery process.

Owner-assisted recovery revokes sessions and MCP grants and requires fresh enrollment. Recovery links expire after 30 minutes. If every Owner is locked out, a documented host-local recovery procedure requires host administrative access and records the recovery before normal operation resumes.

**IDENT-06 — Sessions.** Browser sessions expire after 30 minutes idle or 12 hours overall. Users can revoke their other sessions; Owners can revoke a user's sessions and MCP grants. Password changes and recovery invalidate existing sessions.

High-risk actions require authentication within the preceding five minutes: ownership changes, account recovery, changing authentication settings, backup download, restore, and changing backup recovery material.

TOTP replay protection, bounded login attempts, recovery safeguards, and secure factor replacement follow established authentication guidance. TOTP is not described as phishing-resistant. [NIST authentication guidance](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)

### Services, credentials, and policy

**CONFIG-01 — Service setup.** “Add service” follows five steps: Details → Destination → Authentication → Access & policy → Review. Common setup requires neither YAML nor regex knowledge.

**CONFIG-02 — Managed credentials.** Owners and Administrators can create, replace, and delete credentials in the UI. Saved values are never revealed or copied back. The UI shows label, placement, availability, version, and last-change metadata.

Rotation invalidates affected references. Referenced credentials cannot be deleted without resolving their dependencies. Configuration rollback must not silently restore an older credential value.

**CONFIG-03 — Configuration lifecycle.** Changes are saved as drafts and become effective only through **Review & apply**. The review shows a sanitized difference, affected services, security exceptions, and any expected client disruption.

Apply is atomic: validation or activation failure leaves the previous active configuration intact. Concurrent stale edits are rejected with a comparison and reload path.

**CONFIG-04 — History and rollback.** Retain the latest 50 applied configuration revisions. Owners and Administrators can restore an earlier permitted configuration as a new draft. Rollback must validate against current identities and available credentials; it cannot recover deleted secrets or bypass current permissions.

**CONFIG-05 — Service lifecycle.** Services are Draft, Active, Disabled, or Archived. Draft, Disabled, and Archived services cannot execute requests. Disabling revokes their references. Archiving retains history and audit attribution; restoring an archived service returns it to Disabled for review.

**POLICY-01 — Preserve evaluation semantics.** The highest-priority matching rule wins; deny wins an equal-priority allow/deny tie. Equal-priority, same-effect ordering remains stable. If nothing matches, the service's default mode applies.

The UI must show effective evaluation order. Rule dragging must not silently change semantics.

**POLICY-02 — Simple and advanced editing.** Offer explicit “exact path,” “path prefix,” and “regex” matching. Guided forms must generate unambiguous matching behavior. Imported regexes remain editable without lossy conversion.

Advanced editors operate on the same draft as the forms. Switching editors must not discard supported fields.

**POLICY-03 — Safe preview.** A policy tester accepts identity, service, destination, method, and path/URL. It reports access eligibility, canonical target, matching rule, effective response protection, and allow/deny reason. It must not substitute credentials or contact downstream services.

**POLICY-04 — Security exceptions.** Disabling TLS verification, using cleartext downstream HTTP, default-allow policies, broad destinations, and reduced scanning require an explicit acknowledgement when applied. The active service page visibly lists these exceptions.

Existing relaxed TLS and scanning controls remain available. Browser authentication transport protections are separate and cannot be disabled through a downstream TLS setting.

### MCP clients and compatibility

**MCP-01 — Built-in authorization.** The normal connection flow uses local user accounts, MFA, and per-user OAuth consent. Users can inspect and revoke their connected clients. Retain PKCE, client restrictions, scopes, refresh rotation, replay detection, and secure client-metadata retrieval.

MCP OAuth is distinct from browser SSO; excluding SAML and OIDC login does not remove MCP authorization. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

**MCP-02 — Existing authentication modes.** Preserve external OAuth validation and legacy bearer mode in advanced Owner settings. External identities require explicit issuer/subject registration and service assignments. These modes do not grant console access.

Legacy shared bearer mode must be labeled as having shared attribution. The normal multi-user configuration uses built-in OAuth.

**MCP-03 — Client setup.** Provide separate ChatGPT and Codex instructions and copyable, secret-free connection details. Show the OAuth origin separately from the complete MCP Server URL, for example:

- Origin: `https://mcp.example.org`
- MCP Server URL: `https://mcp.example.org/mcp`

The console must explain that remote clients require network reachability. It does not automatically publish a private instance.

**MCP-04 — Continuity.** Every MCP POST authenticates independently; no transport session ID is issued or trusted. Normal restarts preserve managed configuration, credentials, signing material, and durable refresh state. Gateway references remain ephemeral and clients must reacquire them after restart.

### Navigation and interaction design

The primary navigation is:

| Area | Main tasks |
|---|---|
| **Services** | Find services; configure destinations, credentials, policies, and access |
| **People & Access** | Manage users, roles, service assignments, and connected clients |
| **Activity** | Investigate requests, denials, configuration changes, and security events |
| **Settings** | Authentication, response protection, limits, SMTP, backups, and health |

**UX-01 — Service-centered design.** Start on Services, with search, status filters, and a clear Add service action. Service details contain Overview, Configuration, Access, and Activity. Avoid a separate dashboard dominated by decorative charts.

**UX-02 — Progressive disclosure.** Show useful defaults and plain-language summaries first. Advanced controls remain discoverable and searchable. Explain the effect of a control where it is edited.

Use Vault's guided policy editing as inspiration for combining structured editing with advanced capability, and 1Password's fixed roles as inspiration for understandable administration. These are design references, not feature-parity targets. [Vault policy editor](https://developer.hashicorp.com/vault/docs/ui/visual-policy-editor), [1Password built-in roles](https://support.1password.com/groups/)

**UX-03 — Predictable feedback.** Clearly distinguish Draft, Applied, Disabled, Degraded, and Failed. Preserve non-secret form work after validation errors. Place errors beside the affected field and provide a plain-language recovery action.

**UX-04 — Accessibility.** Target WCAG 2.2 AA: keyboard access, visible focus, labeled controls, accessible errors and dialogs, sufficient contrast, and status indicators that do not rely on color. Desktop is primary; essential monitoring and recovery work on narrow screens. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## 4. Security, audit, recovery, and operations

### Audit and security controls

**AUDIT-01 — Required evidence.** Record authentication outcomes, MFA/recovery events, invitations, role and access changes, client grants/revocations, configuration changes, credential replacement, gateway requests/denials, security exceptions, limit failures, backups, restores, and audit-health transitions.

Events include timestamp, actor or system identity, action, target, result, request/operation identifier, and applicable configuration revision. Configuration changes include sanitized differences.

**AUDIT-02 — Search and export.** Authorized users can filter by time, actor, service, action, result, and request ID, inspect an event, and export the filtered set. Members see only their own permitted activity. Exports enforce the same access and sanitization rules as the UI.

**AUDIT-03 — Confidentiality and integrity.** Never include raw credentials, token values, authorization headers, cookies, recovery links, MFA seeds, or request/response bodies in audit records. Sanitize caller-controlled labels, reasons, and paths.

Audit records are append-only through product interfaces and tamper-evident. No role can edit individual events. Retention-based deletion and evidence exports are themselves audited. Protection against a hostile host administrator requires independently protected external copies. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

**AUDIT-04 — Audit outage behavior.** If durable audit recording becomes unavailable, block configuration changes, credential/reference issuance, and new downstream calls. Preserve read-only diagnostics and access needed to repair storage.

Do not execute a downstream action without first durably recording its authorization and start. If recording its completion fails, stop admitting further sensitive work and expose the operation as having an uncertain recorded outcome. Do not claim downstream side effects were rolled back.

Resume only after durable recording is verified and the outage/recovery is recorded.

**SEC-01 — Data protection.** Encrypt managed credentials, MFA secrets, and sensitive system material at rest. Store passwords and recovery codes as non-reversible verifiers. Protect browser sessions against theft, forgery, and cross-site request attacks. Never place secrets in URLs, analytics, or browser persistent storage.

**SEC-02 — Outbound boundaries.** Preserve destination validation, canonical-path policy evaluation, and authorization before credential substitution. Private downstream services remain supported. OAuth client-metadata retrieval retains its separate restrictions against private/special-use addresses, redirects, and unbounded retrieval.

**SEC-03 — Security-sensitive administration.** Changes to destinations, authentication, security exceptions, and credentials must be attributable. Account disabling and revocation apply before the next request is admitted; already-dispatched downstream work may finish and remains auditable.

### Backup and restore

**BACKUP-01 — Scope.** Provide manual and scheduled encrypted whole-instance backups.

| Included | Excluded |
|---|---|
| Services, destinations, policies, scanner settings, and revisions | Live gateway/response-secret references |
| Managed downstream credentials and encrypted system secrets | Browser sessions, OAuth grants, refresh tokens, and authorization codes |
| Users, roles, assignments, and password verifiers | MFA seeds and recovery codes |
| Instance settings and retained audit evidence | Pending invitations and recovery links |
| Version, integrity, and dependency manifest | Downstream systems' data, Docker images, and reverse-proxy configuration |

**BACKUP-02 — Operation.** Owners can back up immediately, download an encrypted archive, configure a daily schedule, and view progress, size, completion time, and failures. Scheduled backups go to a mounted backup directory. Default retention is 30 days.

Owners receive recovery material during setup and must store it independently. An archive must be recoverable on a clean replacement host using that material, without depending on the lost instance's storage.

Backup encryption is mandatory. Incomplete backups must never appear successful or replace the last valid backup. Only one backup or restore job runs at a time.

The operator is responsible for copying archives off-host. The UI states this clearly. Portainer provides useful inspiration for visible backup scope, manual actions, scheduling, and retention. [Portainer backup settings](https://docs.portainer.io/admin/settings/general)

**BACKUP-03 — Restore preview.** Before replacement, validate decryption, integrity, version compatibility, available storage, and required deployment inputs. Show archive time, included objects, and the effect on existing configuration and access.

Reject wrong keys, corrupt archives, unsafe archive entries, and unsupported versions before modifying the instance.

**BACKUP-04 — Full replacement.** Restore is a maintenance operation, with sensitive activity paused and an automatic pre-restore backup when replacing a functioning instance. Restoration either succeeds completely or returns to the previous usable state.

Selective object merge, per-user restore, and downstream data restore are excluded.

**BACKUP-05 — Safe resumption.** A restored instance starts in recovery mode:

- An authenticated recovery Owner establishes fresh MFA.
- All sessions, grants, bearer credentials, and opaque references are invalidated.
- Other users require Owner review and fresh enrollment before activation.
- Services remain disabled until an Owner reviews restored permissions and potentially stale credentials.
- External OAuth and legacy bearer access require explicit reactivation.
- Clients reconnect after the instance is resumed.

Restored MFA and old recovery links must never become valid again.

**BACKUP-06 — Evidence continuity.** In-place restore must preserve audit evidence created after the selected backup, including the restore operation. Imported audit history is labeled with its original instance and backup provenance. A clean-host restore must identify any unavoidable evidence gap after the backup timestamp.

### Limits, health, and operator responsibilities

**OPS-01 — Supported scale.** Validate the initial release with 50 users and 100 configured services. This is a tested operating envelope, not a subscription tier or an arbitrary hard cap.

**OPS-02 — Limits.** Owners manage all existing request, response, concurrency, reference, denial, authentication, and scanning limits through the UI. Show current consumption, effective values, units, and what happens at capacity.

Retain current runtime defaults, including 32 concurrent downstream requests globally, 4 per subject, 8 per service, 1 MiB request bodies, 5 MiB response bodies, and 30-second downstream timeout.

Lowering a capacity below current usage blocks new allocations until usage falls; it must not silently evict active state. Invalid combinations cannot be applied.

**OPS-03 — Health.** Display gateway, storage, audit, scanner, SMTP, and backup status. Show actionable notices for missing encryption material, audit degradation, backup failure, and exhausted capacity. Health output exposed without login must not disclose sensitive configuration.

**OPS-04 — Retention and recovery targets.**

| Item | Initial default or target |
|---|---|
| Audit retention | 365 days |
| Scheduled backups | Daily |
| Backup retention | 30 days |
| Maximum targeted data loss | 24 hours with successful backups |
| Restore target | 4 hours once replacement infrastructure and recovery material are available |
| Browser session | 30-minute idle; 12-hour maximum |

Retention settings are Owner-managed. Shortening retention requires showing the deletion impact. Storage exhaustion must not silently override retention policy.

**OPS-05 — Deployment boundary.** Support one active application instance, persistent application/audit storage, a backup mount, and stable encryption material. No Kubernetes or external identity provider is required.

A reverse proxy can expose MCP and OAuth endpoints while keeping the administrative UI private. Trust in forwarded headers must be explicitly restricted to configured proxies. Setup must not require public exposure of the console.

**OPS-06 — SOC 2 operating evidence.** Provide exportable access inventories, configuration/security-exception reports, audit history, software version, and backup/restore results. Documentation assigns responsibility for off-host backups, restore exercises, patching, access reviews, incident response, and host security.

Do not build a compliance workflow engine or label an instance “SOC 2 compliant” based on a settings checklist.

## 5. Migration, acceptance, and review readiness

**MIGRATE-01 — Guided import.** Import the existing gateway YAML and both scanner catalogs into a draft. Preserve supported behavior, identifiers, priorities, matching semantics, and exceptions. Unknown or unsupported fields must produce an explicit error rather than be silently dropped.

Existing subjects must be mapped explicitly to local users or registered external identities. A matching email string alone must not grant access.

**MIGRATE-02 — Credential resolution.** Show which imported credentials need values. Resolve only deliberately supplied migration sources; otherwise request values through write-only fields. Missing credentials keep affected services inactive.

**MIGRATE-03 — Source of truth.** After migration, managed configuration is authoritative. Old YAML and environment settings must not silently override console changes. Provide a sanitized configuration export; secret-bearing recovery uses encrypted backups.

**MIGRATE-04 — Compatibility.** Preserve MCP tool contracts and existing gateway behaviors. Changes to endpoint identity or authentication must warn that clients need reconnection. Configuration activation must not require routine container editing or restarting.

**Acceptance coverage**

| Domain | Required positive and negative evidence |
|---|---|
| Setup and identity | Owner bootstrap, invitation, MFA, SMTP/manual delivery, recovery; reject bootstrap takeover, replay, expired links, and MFA bypass |
| RBAC | Exercise every permission-matrix cell through UI and management interfaces; reject direct unauthorized requests and last-Owner removal |
| Configuration | Configure every existing capability; preserve advanced values through form/editor/import round trips; reject stale edits and invalid partial application |
| Credentials | Create and rotate without subsequent reveal; revoke affected references; verify secrets do not enter histories, errors, exports, or logs |
| Policy | Preview and runtime agree on canonical targets, priority, ties, defaults, and exceptions; rejected requests make no downstream call |
| Gateway preservation | Existing positive/negative regression coverage remains; include actual self-signed HTTPS, tolerant JSON, binary, Base64, and header-enforcement cases |
| Client compatibility | Real ChatGPT and Codex connection, consent, request, revocation, restart, and reconnection exercises |
| Audit | Search, export, retention, tamper detection, sanitization, disk-full/write-failure behavior, and safe recovery |
| Backup/restore | Scheduled/manual backup and clean-host recovery; reject corrupt/wrong-key archives; verify interrupted restore safety and old-access invalidation |
| Limits and health | Capacity enforcement, noisy-user containment, lowered limits, bounded inputs, and actionable degraded states |
| UX | Keyboard and accessibility checks; task-based testing of service setup, policy investigation, user removal, and restore |

All new external inputs require positive and negative tests. This includes imports, SMTP configuration, regex editors, enrollment links, backup archives, and management requests.

**Usability targets:** After deployment and with downstream credentials available, a representative administrator should configure a first straightforward service within 15 minutes, identify why a request was denied within 2 minutes, and disable a user within 1 minute.

**Documentation required:** Docker/reverse-proxy setup, first-run enrollment, role definitions, service configuration, ChatGPT/Codex connection, migration, audit operations, credential rotation, backup/off-host retention, full recovery, and security limitations. Examples use `example.org` stand-ins.

**Downstream review boundaries**

- **Security:** Administrative credential trust, recovery/bootstrap, authorization, browser security, outbound requests, audit failures, and backup cryptography.
- **Architecture:** Durable storage, atomic configuration activation, key lifecycle, single-instance operation, audit integrity, and crash-safe restore.
- **UX:** Guided service setup, advanced policy editing, effective permissions, secret-safe changes, and recovery usability.
- **Data/API:** Stable identities, concurrency behavior, migration compatibility, backup versioning, and retention.
- **Delivery:** Create implementation slices only after these reviews resolve findings.

**Readiness:** Product scope and consequential behavior are defined for review. Technical mechanisms remain architecture decisions. This PRD does not authorize implementation or establish SOC 2 compliance.
