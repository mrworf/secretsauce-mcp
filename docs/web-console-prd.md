# PRD: SecretSauce Web Console — Initial Release

**Status:** Product requirements for review; application implementation and specialist reviews are not complete.

**Date:** 2026-10-09. **Product:** `secretsauce-mcp`. **Product owner:** Repository maintainer.

**Authority:** This document records the agreed web-console expansion. It preserves `docs/prd.md` as the original gateway MVP specification and distinguishes existing behavior from future requirements. It does not claim the console is implemented or that the product establishes SOC 2 compliance.

The [security resolution contract](../product/security/web-console-security-contract.md) (SECRES-01–07) and [state and recovery contract](../product/architecture/web-console-state-contract.md) (STATE-01–08) are normative companion requirements for the bounded mechanics summarized below. They preserve this PRD's product intent; their acceptance scenarios supplement the acceptance table. They do not replace the full downstream reviews.

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
| Invite, disable/reactivate users, or review restored users | Yes | No | No | No |
| Edit local account contact and roles under SECRES-06 | Yes, with continuity checks | Non-Owner targets and non-Owner resulting roles only; own contact allowed, own role excluded | No | No |
| Initiate other-user password or Authenticator resets under SECRES-05 | Yes | Non-Owner targets only | No | No |
| Manage instance authentication, SMTP, limits, and retention | Yes | No | No | No |
| Search/export instance audit evidence | Yes | Yes | Yes | No |
| Create/download backups or restore | Yes | No | No | No |
| Use MCP services | If assigned | If assigned | No | If assigned |
| View own service activity and denial explanations | Yes | Yes | No execution activity | Yes |

**AUTHZ-01 — Explicit execution access.** Administrative status does not automatically authorize downstream calls. Execution requires an eligible role, an explicit service assignment, valid MCP authorization, and an allowed request policy.

**AUTHZ-02 — Server enforcement.** Every management and MCP operation checks current permissions. Hiding controls in the UI is insufficient. Removing access or disabling an identity blocks subsequent requests, including requests using previously issued references. Admission immediately before credential substitution and dispatch rechecks current eligibility, service state, reference validity, coherent active configuration, and audit readiness. Queued work cannot rely on an earlier authorization; already-dispatched work may finish under its admitted revision and response protection, without reviving revoked references (STATE-02).

Assisted resets recheck the current initiator and target permissions at issuance, sensitive proof processing and completion. Bind proofs to issuer and target authorization generations; issuer revocation/demotion/recovery, target promotion beyond the issuer’s authority, or changed generations invalidate outstanding authority. An expired issuer browser session alone does not invalidate an otherwise eligible issuer. Drafts/history and uncertain completion cannot restore revoked authority (SECRES-05).

**AUTHZ-03 — Owner continuity.** The final active Owner cannot be disabled, deleted, or demoted. Ownership transfer requires an already-enrolled replacement. The UI recommends a second Owner without requiring one. During restore, the nominated recovery Owner is protected from removal until enrollment succeeds; this restricted recovery identity does not confer ordinary access before fresh enrollment (SECRES-02).

An assisted MFA reset must atomically leave another active, enrolled Owner able to administer the instance, including under concurrent resets or role changes. Invited, recovering, disabled or diagnostic-only users do not satisfy continuity. A final eligible Owner uses the existing host-local recovery route; password-only completion retains enrolled MFA and Owner eligibility (SECRES-05).

**AUTHZ-04 — Administrative trust.** Owners and Administrators are trusted to configure credential destinations and policies. Write-only credential fields do not prevent a malicious administrator from configuring a credential-exfiltrating endpoint. The UI and security documentation must explain this boundary.

### Enrollment, authentication, and recovery

**IDENT-01 — Initial setup.** An uninitialized instance requires a one-time operator bootstrap proof before creating its first Owner. The first person who discovers the web URL must not be able to claim the instance. Setup collects instance name, access URL, Owner credentials, MFA enrollment, and backup recovery material. Bootstrap proof is issued through a protected host-local action, expires after 30 minutes, is bound to this instance and operation, and never appears in general application logs. Successful password/MFA enrollment and durable recording precede normal access (SECRES-02).

**IDENT-02 — Browser login.** All human users authenticate with a password and authenticator-app TOTP. MFA enrollment must finish before management access or built-in MCP authorization is granted.

Passwords support password managers and paste, use a minimum of 15 characters, allow at least 64 characters, and reject common compromised values. No arbitrary composition rules or periodic password expiry are required.

**IDENT-02A — Account details and metadata.** People & Access shows the immutable user ID, contact, role, lifecycle, creation date and **Last console sign-in** within existing non-secret visibility. Creation means durable identity creation (invitation issuance or bootstrap Owner creation). Last console sign-in means successful full password-and-factor console session admission; permitted recovery-code second-factor login qualifies. Use server time and show the timezone. Preserve creation across edits, reissue, enrollment and recovery. Failed or partial login, restricted diagnostics, reauthentication, session refresh, MCP/OAuth traffic, built-in OAuth login and reset/enrollment completion do not count. Newly tracked accounts without a qualifying sign-in show Never; missing legacy dates show Unknown, never an invented upgrade date. External mappings show Not applicable for local console sign-in. Metadata is read-only, grants no authority and follows STATE-07 durability, concurrency and recovery semantics.

**IDENT-02B — Account property and role editing.** Owners may edit another local account's contact and role, including another Owner, subject to continuity. Administrators may edit other Administrators, Auditors and Members and change roles only among those three; they cannot target or grant Owner or change their own role. Owners and Administrators may edit their own contact. Existing Owner self-demotion/transfer requires an enrolled replacement. Editable properties are existing contact and role, not new profile fields. Invitation, disable/reactivation, restored-user review and other-user session/grant administration remain Owner-only (SECRES-06).

Contact/role changes are explicit immediate actions requiring current active/enrolled authority, recent password/TOTP authentication, target/change confirmation, current revision checks and durable audit admission. Contact edits also require confirming verification through the previously established trusted channel, with only its category recorded, and enforce existing contact format/uniqueness. They preserve password, MFA, identity and lifecycle; editing pending/disabled accounts cannot activate them or rebind old proofs. Successful changes advance target authorization generation and revoke target sessions, MCP grants, subject references and outstanding target/issuer-bound proofs. Self-contact change ends the current session and requires ordinary login with the new contact. Notify old and new contacts when SMTP is available without recovery capabilities; delivery failure is separately reported and does not undo the change. Preserve atomic final-enrolled-Owner protection and existing durable revocation-intent/uncertain-write safeguards (SECRES-06).

**IDENT-03 — Invitations.** Owners issue expiring, single-use invitations containing a predetermined role. Invitations expire after 72 hours and can be revoked or reissued. Users choose their own password and enroll MFA. Public self-registration is excluded. Invitation/recovery proofs are bound to the target identity, purpose, and instance security generation; reissue revokes the old proof. Opening or previewing a link neither consumes it nor changes account state. Deliberate completion permits only its bound enrollment/reset action, never direct ordinary access (SECRES-01).

**IDENT-04 — Optional SMTP.** Owners configure SMTP, sender identity, encrypted SMTP credentials, and a test message through the UI. Email supports invitations, password resets, security notifications, and backup/audit failure alerts. Without SMTP, Owners share invitation links through an existing trusted channel. Owners and Administrators may deliver their permitted reset links through SMTP or a verified existing trusted channel under SECRES-05; this does not grant Administrators SMTP configuration or invitation authority. Account contact editing is separately authorized by SECRES-06, never by a reset request.

Owners choose **TLS (encrypted)** or **None (unencrypted)**. TLS is the existing implicit-TLS mode and the default for new and legacy configurations missing a mode; unknown explicit modes fail validation. Custom ports remain supported and never infer encryption. TLS validates the server identity and never silently falls back to None. No STARTTLS or opportunistic downgrade is required. SMTP authentication is independent and may be configured with either mode; transport selection never deletes credentials or disables authentication (STATE-08, SECRES-07).

None is an explicit supported risk choice. Explain that messages, invitation/reset links and SMTP credentials can be read or altered on that connection. Enabling None, switching to it, or changing its endpoint/authentication destination requires current Owner recent password/TOTP authentication and explicit acknowledgment bound to the endpoint, mode and applicable configuration/credential version. Unchanged acknowledged settings need no repeated dialog for each delivery. Test messages obey the same authority, selected mode and acknowledgment. Prefill current non-secret settings, never saved passwords; blank unchanged input retains the current encrypted value under existing version checks. Persist the exact selected mode through reviewed configuration, history and backups. Queued delivery rechecks current enabled revision/mode/credential dependencies; bounded already-dispatched work cannot rewrite settings. Failures remain sanitized. Restored None needs fresh current-Owner review before unencrypted dispatch; archived acknowledgment is not authority.

SMTP credential deletion is an explicit write-only action independent of configuration Apply. SMTP credential creation and replacement retain their existing draft/review/apply workflow, bound to the current configuration revision and credential version. Only a recently authenticated Owner can confirm deletion of the current credential version. Enabled SMTP that depends on the value blocks deletion: disable SMTP through its settings review/apply first, then use Delete SMTP credential. Disabling SMTP retains its saved settings and encrypted credential; deletion preserves non-secret settings and never silently enables anonymous delivery. Manual link delivery remains available under the authorized recovery/invitation flow.

Failed delivery must be visible and must not falsely mark an invitation as accepted. Email delivery failure must not disable gateway operation.

**IDENT-05 — Recovery.** Users receive single-use recovery codes, shown once and stored as hashes. Password reset and Authenticator MFA reset are separate actions. Self-service factor replacement retains existing password-plus-current-factor or password-plus-recovery-code verification. Assisted resets follow SECRES-05: Owners may target other Owners, Administrators, Auditors and Members; Administrators may target other Administrators, Auditors and Members, never Owners. Account detail visibility and bounded Administrator contact/role editing follow SECRES-06; these separate permissions do not alter the reset target rules.

Both assisted actions require a current active, enrolled initiator, password/TOTP reauthentication within five minutes, verified-person confirmation through a previously established trusted channel, explicit target/operation confirmation and durable audit. Record only the channel category. The initiator cannot choose a new contact, set the target’s password or see fresh target factor material. Self through the assisted route, disabled/deleted users, unaccepted invitations, unreviewed restored users and external/legacy-only identities are excluded. Eligible users already restricted by assisted MFA reset may receive a replacement factor-reset proof.

Password-reset issuance creates a 30-minute purpose-bound proof without changing enrollment, password, MFA, recovery codes or sessions. Completion requires that proof, the target’s current TOTP or an unused recovery code, and a valid new password. Atomically replace only the password verifier, consume the proof and any used code, advance target authorization generation and revoke all target sessions, MCP grants and subject-bound references. Preserve the existing TOTP and other recovery codes; require ordinary login afterward. Public requests remain non-enumerating and use the established contact channel.

Authenticator-reset issuance immediately invalidates the old factor and recovery codes, revokes sessions/MCP grants/references, advances target authorization generation and restricts the account with `enrolled: false`. Its 30-minute proof permits only fresh TOTP and recovery-code enrollment, never password replacement or ordinary access. The verified recovery ceremony does not require the lost factor or forgotten password. Completion confirms the fresh factor/codes, consumes the proof, advances generation again and restores enrollment only for an otherwise eligible account, retaining its password and requiring normal login. If both password and MFA are lost, complete MFA recovery first, then issue a fresh password-reset proof.

Proofs remain verifier-only, unpredictable, single-use and purpose/target/instance/issuer-generation-bound under SECRES-01/03/05. Reissue revokes the previous proof; concurrent consumption succeeds once. Expired, cancelled or abandoned MFA recovery stays restricted until authorized reissue or host recovery; SMTP failure never rolls back a committed reset or grants access. If every Owner is locked out, documented host-local recovery requires host administrative access and durable recording. All issuance and recovery security mutations wait for durable audit availability.

**IDENT-06 — Sessions.** Browser sessions expire after 30 minutes idle or 12 hours overall. Users can revoke their other sessions; Owners can revoke a user's sessions and MCP grants. Password changes and successful password-reset completion invalidate existing sessions; assisted MFA-reset issuance revokes access immediately, while password-reset issuance alone does not (SECRES-05).

High-risk actions require authentication within the preceding five minutes: account contact/role changes, enabling or changing unencrypted SMTP under SECRES-07, ownership changes, both assisted reset actions, deleting SMTP credentials, changing authentication settings, backup download, restore, and changing backup recovery material.

TOTP replay protection, bounded login attempts, recovery safeguards, and secure factor replacement follow established authentication guidance. TOTP is not described as phishing-resistant. [NIST authentication guidance](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)

### Services, credentials, and policy

**CONFIG-01 — Service setup.** “Add service” follows five steps: Details → Destination → Authentication → Access & policy → Review. Common setup requires neither YAML nor regex knowledge. Guided step headings are directly navigable without losing safe work. Existing services use focused configuration sections; one service-wide Guided/Advanced switch edits the same full draft without lossy conversion. The approved UX-DESIGN-004 and canonical UX4 define the grouped service view, dialogs, contextual navigation and visual acceptance; retain every supported capability and exact imported value.

**CONFIG-02 — Managed credentials.** Owners and Administrators can create, replace, and delete credentials in the UI. Saved values are never revealed or copied back. The UI shows label, placement, availability, version, and last-change metadata.

Service credential keys and their optional write-only values are distinct. Set, Replace, Clear and unreferenced key deletion are explicit immediate actions; placement metadata follows draft/apply. Set/Replace use a value-entry dialog with Save and Cancel rather than an inline replacement field; opening or cancelling does not fetch an existing value or mutate state. Unrelated wizard navigation neither submits nor requires a replacement value.

Delete on an in-use key clears only its value and retains its exact key. Before confirmation, explain that outcome and whether the dependency affects current execution or only a pending configuration. In-use includes applied and saved proposed references, including Disabled/Archived configurations; browser-only unsaved work, history and exported archives are not durable dependencies. Only an unreferenced key can be deleted. Bind the confirmed outcome to current target, key incarnation/value generation, configuration revision and dependencies; a changed dependency or replacement requires fresh confirmation, never silently switches Clear and key Delete. Already-cleared referenced values report a truthful no-op. Current Owner/Administrator authorization and durable audit remain mandatory (STATE-09, SECRES-08).

Show the last successful Set/Replace/Clear actor and server time with availability/version metadata, subject to existing identity visibility. Preserve stable former-account attribution; absent trustworthy legacy data is Unknown. Restored attribution is historical and source-qualified, never assigned to the restoring Owner or rebound by matching email. Failed, uncertain and no-op actions do not fabricate a successful changer. Never expose a saved value or its fingerprint. Configuration rollback cannot restore cleared or replaced values.

**CONFIG-03 — Configuration lifecycle.** Service details, destinations, credential placement, policies/scanning, and editable instance settings are saved as drafts and become effective through **Review & apply**. The review shows a sanitized difference, affected services, security exceptions, and expected client disruption. Identity/role changes, access grants/removals, revocations, service credential-value operations, SMTP credential deletion, and service disable/archive are explicit immediate actions and do not wait for draft application; current permissions and mandatory audit still apply (STATE-01).

Service review groups settings by section and makes the proposed change easy to compare with the current applied configuration. Provide separate **New settings** and **Changes** tabs, in that order, with New settings selected by default and containing the complete sanitized proposed configuration. Where feasible, additions use green, removals red and changed values yellow, always with non-color labels. Before opening approval, show the reviewed security exceptions as visible bullets instead of a generic administrator/secret-detection disclaimer; the count is the actual reviewed set, not a fixed three. **Approve changes** opens a confirmation dialog explaining that Continue applies the reviewed changes as the active configuration; Cancel applies nothing. When security exceptions exist, list each with its own acknowledgment and enable Continue only after all are acknowledged. Identify exception scope in understandable terms, preserving the actual service-default and destination-override TLS semantics. These presentation changes preserve exact reviewed scope, current permissions, dependency checks, audit admission and atomic activation.

Service Set/Replace/Clear are immediate under STATE-09 and SECRES-08. Clear preserves lifecycle, assignments, placement and unapplied work; it does not activate a draft or remove authentication. A missing applied credential blocks new reference issuance and dispatch, including queued work. A draft-only missing dependency blocks that draft’s activation without interrupting valid current execution. Deliberate Set restores only otherwise eligible Active execution; it never enables Disabled/Archived services, bypasses restored-service review or revives revoked references. Preserve admitted in-flight response protection and generation fences. Clear removes all current stored value copies, including normalized projections; uncertain admitted mutation remains fenced across restart until reconciled, and old intent replay cannot clear a later replacement. Unsupported older readers fail closed.

SMTP remains separately scoped: creation/replacement follows draft/review/apply, and its independent deletion remains blocked while enabled delivery depends on the value. The service Clear exception does not apply to SMTP. SMTP deletion rechecks current authorization, recent authentication, audit readiness, configuration revision, credential version and dependencies. Success removes live and pending copies of the value, advances revisions and invalidates reviews; preserved non-secret drafts require fresh review. Stale confirmations, drafts, browser submissions and history cannot resurrect deleted values. Delivery queued before a change must recheck current admission; already-dispatched mail may finish under its admitted revision without rewriting credentials. Audit failure blocks mutation; uncertain persistence never reports success or permits new use of an unresolved credential. A later creation/replacement requires fresh value entry into a current draft and ordinary review/apply; reloading an old draft cannot silently rebase its pending secret across deletion or replacement.

Apply includes only the reviewed changes and rechecks current actor permissions for each setting, the base revision, and affected identity, grant, lifecycle, and credential dependencies. It is atomic: validation or activation failure leaves the previous active configuration intact. Stale edits or dependencies are rejected with a sanitized comparison/reload path. Initial service review may apply explicitly reviewed new grants atomically with first activation; an old draft cannot recreate removed access. Requests observe one coherent active revision (STATE-01/02).

**CONFIG-04 — History and rollback.** Retain the latest 50 applied configuration revisions. Owners and Administrators can restore an earlier permitted configuration as a new draft, limited to their current permissions. Sanitized history excludes secret values and live identity, assignment, lifecycle, session, and grant state. Rollback validates current dependencies; it cannot recover deleted/replaced secrets, restore revoked access, or enable disabled services. Intentional older policy/destination settings still require ordinary review and exception acknowledgement (STATE-03).

Service value clearing cannot be undone by draft discard or configuration history. Only explicit whole-instance restore may recover a value from an older encrypted archive, with restored services Disabled and fresh review under STATE-09/SECRES-08; this is not retroactive archive erasure.

SMTP credential values are excluded from configuration history, and rollback cannot restore a deleted SMTP value. This does not promise retroactive removal from encrypted backup archives; explicit whole-instance restore retains its existing restricted review and reactivation requirements.

**CONFIG-05 — Service lifecycle.** Services are Draft, Active, Disabled, or Archived. Draft, Disabled, and Archived services cannot execute requests. Disabling or archiving immediately blocks new execution and revokes references. Archiving retains history and audit attribution; restoring an archived service returns it to Disabled. Activation/re-enabling requires explicit review of current configuration and dependencies; history alone cannot enable a service. An Active service with an unapplied edit continues using its previously applied configuration (STATE-01). Effective readiness is separate: Active with a required applied value missing cannot execute, while a draft-only missing value does not interrupt valid current execution (STATE-09).

The service-row **Delete** action uses the existing **Archived** lifecycle. Confirmation identifies the service and explains that new execution stops, references are revoked, configuration/history and audit attribution remain, and restoration returns to Disabled. Do not claim permanent erasure. Cancel changes nothing. Keep Delete, Enable and Disable actions on the row, distinct from its navigable settings link; enabling still explicitly reviews current configuration and dependencies. Active lifecycle and pending draft state are independently visible.

**POLICY-01 — Preserve evaluation semantics.** The highest-priority matching rule wins; deny wins an equal-priority allow/deny tie. Equal-priority, same-effect ordering remains stable. If nothing matches, the service's default mode applies.

The UI must show effective evaluation order. Rule dragging must not silently change semantics.

**POLICY-02 — Simple and advanced editing.** Offer explicit “exact path,” “path prefix,” and “regex” matching. Guided forms must generate unambiguous matching behavior. Imported regexes remain editable without lossy conversion.

Advanced editors operate on the same draft as the forms. Switching editors must not discard supported fields. Guided service editing has no standalone Secret detection section; shared controls remain in Settings and rule-specific controls remain in the policy editor. Highlight every policy rule with a rule-specific secret-detection or binary-scanning override, not only overrides that reduce protection. The indicator does not itself classify a security exception or change acknowledgment requirements.

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

**UX-02 — Progressive disclosure.** Show useful defaults, plain-language labels and concise help. For authorized Settings editors, show current non-secret values in populated forms; read-only viewers receive the same grouping as labeled values. Advanced controls remain discoverable and searchable. Explain the effect of a control where it is edited.

Group Settings into focused sections instead of one long scrolling page containing all settings. Provide user-friendly configuration controls that hide technical configuration detail, while preserving every supported capability and existing value. Raw JSON must not be the routine way to view or edit settings. The approved UX-DESIGN-003 direction and canonical UX artifacts define the section navigation, editing states and visual acceptance requirements; populated forms preserve the reviewed activation contract in CONFIG-03.

Use Vault's guided policy editing as inspiration for combining structured editing with advanced capability, and 1Password's fixed roles as inspiration for understandable administration. These are design references, not feature-parity targets. [Vault policy editor](https://developer.hashicorp.com/vault/docs/ui/visual-policy-editor), [1Password built-in roles](https://support.1password.com/groups/)

**UX-03 — Predictable feedback.** Clearly distinguish Draft, Applied, Disabled, Degraded, and Failed. Preserve non-secret form work after validation errors. Place errors beside the affected field and provide a plain-language recovery action.

**UX-04 — Accessibility.** Target WCAG 2.2 AA: keyboard access, visible focus, labeled controls, accessible errors and dialogs, sufficient contrast, and status indicators that do not rely on color. Desktop is primary; essential monitoring and recovery work on narrow screens. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## 4. Security, audit, recovery, and operations

### Audit and security controls

**AUDIT-01 — Required evidence.** Record authentication outcomes, MFA/recovery events, invitations, role and access changes, client grants/revocations, configuration changes, credential replacement, gateway requests/denials, security exceptions, limit failures, backups, restores, and audit-health transitions.

Events include timestamp, actor or system identity, action, target, result, request/operation identifier, and applicable configuration revision. Service credential Set/Replace/Clear and key deletion record secret-free intent and attributable outcome; last-successful-change metadata follows STATE-09/SECRES-08 and never substitutes for audit evidence. Configuration changes include sanitized differences.

Assisted reset evidence distinguishes initiator, target, purpose, verification-channel category and issuance/reissue/restriction/completion/delivery outcomes without secret proof, password or factor data. Audit outage blocks issuance and completion; notification failure cannot undo a committed security transition (SECRES-05).

**AUDIT-02 — Search and export.** Authorized users can filter by time, actor, service, action, result, and request ID, inspect an event, and export the filtered set. Members see only their own permitted activity. Exports enforce the same access and sanitization rules as the UI.

**AUDIT-03 — Confidentiality and integrity.** Never include raw credentials, token values, authorization headers, cookies, recovery links, MFA seeds, or request/response bodies in audit records. Sanitize caller-controlled labels, reasons, and paths.

Audit records are append-only through product interfaces and tamper-evident. No role can edit individual events. Retention-based deletion and evidence exports are themselves audited. Protection against a hostile host administrator requires independently protected external copies. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

**AUDIT-04 — Audit outage behavior.** If durable audit recording becomes unavailable, block all ordinary sensitive operations, including drafts/apply, identity/access/credential changes, enrollment/recovery, OAuth grants/token issuance or refresh, gateway reference issuance, downstream calls, evidence exports, backups/downloads, and restore, including scheduled work. No role bypasses this gate. Preserve existing role-scoped read-only access. New password/TOTP login may establish only a restricted diagnostic session if verification, throttling, and replay protection remain reliable; otherwise it fails closed (SECRES-04).

Restricted diagnostic login is the explicit best-effort audit exception. Record available evidence and any unknown interval after repair without fabricating history. Repair is host-level storage/process repair, not an unaudited web configuration or account-recovery action. Local logout and expiry remain possible. Restricted diagnostic sessions require fresh normal authentication after repair; they never silently gain write authority.

Do not execute a downstream action without first durably recording its authorization and start. If recording its completion fails, stop admitting further sensitive work and expose the operation as having an uncertain recorded outcome. Do not claim downstream side effects were rolled back.

Resume only after durable recording is verified and the outage/recovery is recorded.

**SEC-01 — Data protection.** Encrypt managed credentials, MFA secrets, and sensitive system material at rest. Store passwords and recovery codes as non-reversible verifiers. Protect browser sessions against theft, forgery, and cross-site request attacks. Ordinary management secrets and reusable credentials must never appear in management URLs, logs, analytics, or browser persistent application storage. Fresh MFA seeds may appear only in the authorized non-cacheable enrollment step.

Purpose-bound enrollment/recovery capability links and required single-use OAuth authorization-code redirects are narrow URL exceptions under SECRES-01, with trusted origins, no referrer/cache/telemetry leakage, and no direct ordinary access. Preserve approved downstream query credential substitution after all gateway checks; substituted outbound URLs must never appear in console previews, diagnostics, audit, or exports. This preserves existing gateway behavior and does not weaken the write-only credential or best-effort response-protection boundary.

Explicit None SMTP accepts loss of confidentiality/integrity on that SMTP connection only (SECRES-07); it does not relax browser HTTPS, at-rest encryption, mandatory audit or recovery-proof controls. Do not claim secure email transport or regulatory compliance for this option.

**SEC-02 — Outbound boundaries.** Preserve destination validation, canonical-path policy evaluation, and authorization before credential substitution. Private downstream services remain supported. OAuth client-metadata retrieval retains its separate restrictions against private/special-use addresses, redirects, and unbounded retrieval.

**SEC-03 — Security-sensitive administration.** Changes to destinations, authentication, security exceptions, and credentials must be attributable. Account disabling and revocation apply before the next request is admitted; already-dispatched downstream work may finish and remains auditable. Immediate actions bypass draft delay only, never current authorization, dependency checks, required recent authentication, or durable-audit admission.

### Backup and restore

**BACKUP-01 — Scope.** Provide manual and scheduled encrypted whole-instance backups.

| Included | Excluded |
|---|---|
| Services, destinations, policies, scanner settings, and revisions | Live gateway/response-secret references |
| Managed downstream credentials and encrypted system secrets | Browser sessions, OAuth grants, refresh tokens, and authorization codes |
| Users, roles, assignments, password verifiers, and account metadata | MFA seeds and recovery codes |
| Instance settings and retained audit evidence | Pending invitations and recovery links |
| Version, integrity, and dependency manifest | Downstream systems' data, Docker images, and reverse-proxy configuration |

Service credential snapshots preserve coherent missing-value state, generations and available actor metadata. After completed Clear, no owned normalized/runtime projection may retain the old value; reject contradictory copies/generations. Earlier encrypted archives may still contain earlier values. Restoring them preserves source-qualified historical attribution, keeps missing values missing, and leaves services Disabled until review; restore is not a new credential change by the recovering Owner (STATE-09, SECRES-08).

**BACKUP-02 — Operation.** Owners can back up immediately, download an encrypted archive, configure a daily schedule, and view progress, size, completion time, and failures. Scheduled backups go to a mounted backup directory. Default retention is 30 days.

Owners receive recovery material during setup and must store it independently. An archive must be recoverable on a clean replacement host using that material, without depending on the lost instance's storage.

Backup encryption is mandatory. Each completed archive represents one consistent recovery point across included state and an identified audit boundary, with recovery-point/completion time and format/software compatibility. Concurrent changes must appear wholly before or after that point. Incomplete backups must never appear successful or replace the last valid backup. Only one backup or restore job runs at a time (STATE-04).

The operator is responsible for copying archives off-host. The UI states this clearly. Portainer provides useful inspiration for visible backup scope, manual actions, scheduling, and retention. [Portainer backup settings](https://docs.portainer.io/admin/settings/general)

**BACKUP-03 — Restore preview.** Before replacement, validate decryption, integrity, version compatibility, available storage, and required deployment inputs. Show archive time, included objects, and the effect on existing configuration and access.

Reject wrong keys, corrupt archives, unsafe archive entries, unsupported versions, or archives without a recoverable Owner before modifying the instance. Clean-host restore requires a protected host-local restore proof plus archive recovery material. In-place restore requires recent current-Owner password/TOTP authentication plus archive recovery material. Preview nominates an Owner from the verified archive and distinguishes that identity from the actual initiator (SECRES-02).

**BACKUP-04 — Full replacement.** Restore is a maintenance operation: stop new admissions and drain dispatched work within existing deadlines. Before replacing a functioning instance, validate the automatic encrypted pre-restore backup and retain a protected local installation rollback source; this temporary, non-downloadable source is distinct from the export backup that excludes MFA/live authentication state. Installation is atomic and crash-recoverable (STATE-05).

Failed installation returns to the previous coherent usable state with preserved failure evidence and fresh login, without reviving invalidated sessions/references. If automatic rollback cannot complete, remain in maintenance with the prior store and a host recovery path. A clean-host failure stays restricted/uninitialized. After complete installation, enrollment difficulty uses recovery rather than automatically reactivating old state.

Selective object merge, per-user restore, and downstream data restore are excluded.

**BACKUP-05 — Safe resumption.** A restored instance starts in recovery mode:

- The nominated archived Owner uses a purpose-bound restricted continuation to set a fresh password and MFA; an old password or archive alone cannot authorize enrollment. Expired/lost continuations leave the instance restricted with a protected host recovery path (SECRES-02).
- All sessions, grants, bearer credentials, and opaque references are invalidated.
- Fresh recovery-Owner enrollment and durable audit readiness unlock management review only. Other users require explicit Owner review and a fresh bound enrollment authorization before activation; restored assignments confer no access by themselves.
- Services remain disabled until an Owner reviews restored permissions and potentially stale credentials.
- External OAuth and legacy bearer access require explicit reactivation.
- Clients reconnect after the instance is resumed.

Restored MFA and old recovery links must never become valid again. Account metadata remains historical snapshot information: preserve creation, label restored last sign-in as history until a new qualifying local console sign-in, and leave missing legacy dates Unknown. Restore and recovery enrollment do not fabricate sign-ins or grant authority from dates. Failed installation rollback preserves prior coherent local metadata. Preserve SMTP mode; missing legacy mode means TLS, while explicit None requires fresh current-Owner review and acknowledgment before delivery (STATE-07/08).

**BACKUP-06 — Evidence continuity.** In-place restore preserves its local audit sequence independently of snapshot replacement, including post-backup activity, installation, enrollment, and resume. Imported history retains original instance/backup provenance and overlapping copies must not appear as new activity. A clean-host restore identifies the unavailable interval after archived evidence and before the new installation's first event. Never fabricate continuity; audit failure blocks activation (STATE-06).

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

Existing subjects must be mapped explicitly to local users or registered external identities. A matching email string alone must not grant access. Show unresolved subjects with affected service/field context and a reachable correction path in the imported draft; preserve unrelated safe edits. Selecting an account as a proposed service assignment does not by itself map a legacy subject. Explain each remaining blocker and how to proceed; correction does not activate the service or bypass fresh review/current eligibility checks.

**MIGRATE-02 — Credential resolution.** Show which imported credentials need values. Resolve only deliberately supplied migration sources; otherwise request values through write-only fields. Missing credentials block activation of the affected draft; missing values required by applied configuration block its execution under STATE-09. A draft-only missing dependency does not stop otherwise valid current execution.

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

**Readiness boundary:** This PRD defines settled product intent and incorporates the bounded Security and Architecture contracts for F-PRD-001–004. Technical mechanisms remain architecture decisions. Coverage, journeys, UX, and full Architecture/Security review are required before delivery planning. Current PRD validation and downstream review status are recorded in [definition workflow state](../workflow/definition/state.yaml); a current validated definition package, when issued, establishes the delivery-planning handoff. The PRD alone neither authorizes implementation nor establishes SOC 2 compliance.
