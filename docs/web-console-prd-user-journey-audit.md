# PRD User Journey Audit: SecretSauce Web Console

> Source PRD: [web-console-prd.md](web-console-prd.md)  
> Generated: 2026-10-09T17:16:58-07:00 (America/Los_Angeles)  
> Review mode: Initial audit  
> Compared against: None — first journey audit  
> Evaluation scope: PRD and normative companions only; preimplementation definition review. Passed [coverage](web-console-prd-coverage.md) is an input, not implementation proof.

## Executive verdict

PASS for journey specification: 47 actor-specific journeys map all 53 PRD IDs, all ten normative companion IDs, and seven unnumbered capability families. No new Blocker, Major or Minor specification gap was found. All journeys are specification-complete at this definition boundary; implementation is Not applicable to this future console stage and runtime reachability is Indeterminate. This is neither implementation acceptance nor a delivery-planning handoff.

## Audit method and status definitions

Read the complete PRD, SECRES-01–04, STATE-01–06, D-001–D-012 and accepted security/state resolutions, and the passed coverage artifact. The earlier F-PRD-001–004 remain closed; this audit does not reopen their resolved domain semantics. Reviewed ingress, state, role, alternate/failure and recovery paths independently. This is explicitly a PRD-only review: no source-code absence, exact API route, database, cryptography or UI layout choice is called a specification gap.

**Shared invariants (apply to every journey/action):** Current server-enforced role and ownership checks apply; sensitive actions also require durable audit and the stated recent authentication. Secret values never appear in feedback/history/logs/export; non-secret form work survives validation failures. Actions are isolated to one organization/instance. Meaningful transitions commit before success is shown. All external inputs require positive and negative validation; direct unauthorized calls must fail even if hidden by UI. Navigation/errors/focus and essential narrow-screen recovery must satisfy UX-04. Dependencies, current permissions and coherent active revisions are checked at apply/admission, not inferred from a prior screen.

**Assessment key:** Complete describes specified behavior, not existing code. All inventory entries below are Required by PRD, with implementation Unverified; exact layout is delegated to Product UX. A capability is not labeled Reachable without runtime evidence. Backend names below are specified responsibilities, never invented URL routes. Matrix tests are required future tests and are Unverified. Shared role variants retain separate journey IDs, current permissions and matrix rows; their action chains are cross-referenced instead of copied.

## Actors and starting contexts

| Actor | Begins At | Authentication State | Prerequisites / Provisioning | Intended Capabilities | Available Entry Points |
|---|---|---|---|---|---|
| Owner | Invitation received | Unauthenticated/pending | Owner-issued Owner invitation; bound identity/role | Enroll password/TOTP | EP-03; J-OWNER-ENROLL |
| Owner | Enrolled console user | Password+TOTP; current role | Completed enrollment and non-disabled identity | Own security plus role-permitted operations | EP-04, EP-11; J-OWNER-ACCOUNT; other role journeys below |
| Owner | Audit unavailable | Existing or diagnostic-only session | Reliable verification/replay state for new diagnostic login | Permitted read-only diagnosis and local logout | EP-21; J-OWNER-DIAG |
| Administrator | Invitation received | Unauthenticated/pending | Owner-issued Administrator invitation; bound identity/role | Enroll password/TOTP | EP-03; J-ADMIN-ENROLL |
| Administrator | Enrolled console user | Password+TOTP; current role | Completed enrollment and non-disabled identity | Own security plus role-permitted operations | EP-04, EP-11; J-ADMIN-ACCOUNT; other role journeys below |
| Administrator | Audit unavailable | Existing or diagnostic-only session | Reliable verification/replay state for new diagnostic login | Permitted read-only diagnosis and local logout | EP-21; J-ADMIN-DIAG |
| Auditor | Invitation received | Unauthenticated/pending | Owner-issued Auditor invitation; bound identity/role | Enroll password/TOTP | EP-03; J-AUDITOR-ENROLL |
| Auditor | Enrolled console user | Password+TOTP; current role | Completed enrollment and non-disabled identity | Own security plus role-permitted operations | EP-04, EP-11; J-AUDITOR-ACCOUNT; other role journeys below |
| Auditor | Audit unavailable | Existing or diagnostic-only session | Reliable verification/replay state for new diagnostic login | Permitted read-only diagnosis and local logout | EP-21; J-AUDITOR-DIAG |
| Member | Invitation received | Unauthenticated/pending | Owner-issued Member invitation; bound identity/role | Enroll password/TOTP | EP-03; J-MEMBER-ENROLL |
| Member | Enrolled console user | Password+TOTP; current role | Completed enrollment and non-disabled identity | Own security plus role-permitted operations | EP-04, EP-11; J-MEMBER-ACCOUNT; other role journeys below |
| Member | Audit unavailable | Existing or diagnostic-only session | Reliable verification/replay state for new diagnostic login | Permitted read-only diagnosis and local logout | EP-21; J-MEMBER-DIAG |
| Owner | First setup | Restricted bootstrap proof | Host-local authority | First Owner enrollment | EP-02; J-OWNER-01 |
| Owner | Installed archive | Restricted recovery continuation | Archived Owner nominated by validated restore | Fresh enrollment then reviewed reactivation | EP-19; J-OWNER-RESUME |
| Host operator | Deploy/repair | Host administrator; not implicitly a console role | Infrastructure and protected local action | Deploy, issue proofs, repair storage | EP-01, EP-20 |
| Host operator | Clean-host disaster recovery | Host restore proof plus archive material | Replacement infrastructure and independent archive/key | Validate and install recovery state | EP-01; J-HOST-RESTORE |
| External MCP identity | Registered issuer/subject | External OAuth token; no console login | Owner registration plus explicit service grant | Use permitted generic tools | EP-14, EP-15 |
| Legacy bearer identity | Advanced legacy mode enabled | Shared bearer; no console login | Owner configuration and explicit service grant | Use permitted tools with shared attribution | EP-14, EP-15 |
| MCP client | Connected or restarted | Principal-bound per-POST authorization | Local/external/legacy acquisition path; active service | Discover/inspect/reference/request/explain; reacquire handles | EP-13–15 |
| Scheduled/runtime automation | Due job or inbound work | Configured system authority/current principal | Owner configuration, audit and capacity readiness | Backups, retention, evidence, limits and health | EP-17, EP-23 |
| Unauthenticated visitor | Public console/health | Unauthenticated | Network reachability only | Bounded health/login; no claim or self-registration | EP-22 |


External SMTP servers, downstream APIs and external issuers are dependencies, not console roles. Their failure outcomes are mapped in the invoking journey. The same human may also be host operator, but host authority never substitutes silently for console Owner authorization.

## Required entry points

| Entry Point | Actor | Capability / Journey | Required or Evidenced Surface | Discoverability | Status | Evidence / Gap |
|---|---|---|---|---|---|---|
| EP-01 | Host operator | J-HOST-01, J-HOST-RESTORE | Protected host-local setup/restore action | Operator deployment/recovery documentation | Required by PRD; implementation Unverified | BACKUP-03, BACKUP-04, BACKUP-06, CAP-ACCEPT-01, IDENT-01, OPS-05, SECRES-02, STATE-05, STATE-06; no gap |
| EP-02 | Owner | J-OWNER-01 | Restricted initial setup | Host proof and setup URL | Required by PRD; implementation Unverified | BACKUP-02, IDENT-01, IDENT-02, SEC-01, SECRES-01, SECRES-02; no gap |
| EP-03 | Administrator, Auditor, Member, Owner | J-OWNER-ENROLL, J-ADMIN-ENROLL, J-AUDITOR-ENROLL, J-MEMBER-ENROLL | Bound invitation enrollment link | Owner invitation via SMTP/trusted manual channel | Required by PRD; implementation Unverified | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03; no gap |
| EP-04 | Administrator, Auditor, Member, Owner | J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT | Login, own security/session and reset surfaces | Login and own-account controls; reset established channel | Required by PRD; implementation Unverified | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04; no gap |
| EP-05 | Owner | J-OWNER-PEOPLE, J-OWNER-RECOVERY | People & Access | Primary navigation; Owner user/invitation/recovery controls | Required by PRD; implementation Unverified | AUTHZ-02, AUTHZ-03, IDENT-03, IDENT-05, IDENT-06, SEC-03, SECRES-01, SECRES-03, STATE-01, STATE-02; no gap |
| EP-06 | Administrator, Auditor, Owner | J-OWNER-CONFIG, J-ADMIN-CONFIG, J-AUDITOR-CONFIG | Services and service details | Landing list/search/filter → Add service or Overview/Configuration/Access/Activity | Required by PRD; implementation Unverified | AUTHZ-02, AUTHZ-04, BASE-02, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, CONFIG-01, CONFIG-03, OPS-06, POLICY-04, STATE-01, STATE-02, UX-01, UX-02, UX-03, UX-04; no gap |
| EP-07 | Administrator, Owner | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL | Service Authentication and credentials | Service Configuration → authentication/credential controls | Required by PRD; implementation Unverified | BASE-03, CONFIG-02, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03; no gap |
| EP-08 | Administrator, Owner | J-OWNER-ACCESS, J-ADMIN-ACCESS | Service Access and lifecycle actions | Service Access/Overview; People & Access grants | Required by PRD; implementation Unverified | AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03; no gap |
| EP-09 | Administrator, Owner | J-OWNER-POLICY, J-ADMIN-POLICY | Policy editor and safe tester | Service Configuration → policy; advanced controls | Required by PRD; implementation Unverified | CAP-CFG-05, POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02; no gap |
| EP-10 | Administrator, Owner | J-OWNER-HISTORY, J-ADMIN-HISTORY | Guided import, configuration export and history | Configuration/import and history actions; exact layout delegated to Product UX | Required by PRD; implementation Unverified | BASE-03, CONFIG-04, MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, STATE-03; no gap |
| EP-11 | Administrator, Auditor, Member, Owner | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY | Activity and evidence export | Primary Activity or service Activity; permitted filters/detail | Required by PRD; implementation Unverified | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04; no gap |
| EP-12 | Owner | J-OWNER-SETTINGS | Settings authentication/SMTP/limits/retention | Primary Settings; advanced details discoverable/searchable | Required by PRD; implementation Unverified | CAP-CFG-06, IDENT-04, MCP-02, OPS-02, OPS-03, OPS-04, STATE-01, STATE-02, UX-02; no gap |
| EP-13 | Administrator, Member, Owner | J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT | Client setup, OAuth consent and own connected clients | ChatGPT/Codex instructions; People & Access/own-client controls | Required by PRD; implementation Unverified | AUTHZ-01, IDENT-06, MCP-01, MCP-03, SECRES-01; no gap |
| EP-14 | External MCP identity, Legacy bearer identity | J-EXTERNAL-01, J-LEGACY-01 | External issuer/legacy MCP connection | Owner advanced settings and documented MCP client connection | Required by PRD; implementation Unverified | AUTHZ-01, AUTHZ-02, BACKUP-05, MCP-02, MCP-04; no gap |
| EP-15 | MCP client | J-MCP-01, J-MCP-RESTART | Authenticated MCP endpoint and five generic tools | Client setup URL including /mcp; tool discovery | Required by PRD; implementation Unverified | AUTHZ-01, AUTHZ-02, BASE-01, CAP-CFG-03, CAP-CFG-05, MCP-04, MIGRATE-04, POLICY-01, SEC-02, STATE-02; no gap |
| EP-16 | Owner | J-OWNER-BACKUP | Settings Backups | Settings → backup/schedule/progress/download | Required by PRD; implementation Unverified | BACKUP-01, BACKUP-02, OPS-04, SEC-01, STATE-04; no gap |
| EP-17 | Scheduled/runtime automation | J-SYSTEM-BACKUP | Backup/retention scheduled triggers | Owner schedule and visible job/retention status | Required by PRD; implementation Unverified | AUDIT-01, AUDIT-03, BACKUP-01, BACKUP-02, OPS-03, OPS-04, STATE-04; no gap |
| EP-18 | Owner | J-OWNER-RESTORE | Settings restore upload and preview | Settings Backups → restore → review/confirm | Required by PRD; implementation Unverified | BACKUP-03, BACKUP-04, BACKUP-06, IDENT-06, SECRES-02, STATE-05, STATE-06; no gap |
| EP-19 | Owner | J-OWNER-RESUME | Restricted recovery enrollment and review | Bound continuation → enrollment → reviewed management surfaces | Required by PRD; implementation Unverified | AUTHZ-03, BACKUP-05, BACKUP-06, SECRES-02, STATE-06; no gap |
| EP-20 | Host operator | J-HOST-RECOVERY | Host repair and break-glass recovery | Protected documented host actions; diagnostic notice handoff | Required by PRD; implementation Unverified | AUDIT-04, IDENT-05, OPS-03, SECRES-02, SECRES-04, STATE-06; no gap |
| EP-21 | Administrator, Auditor, Member, Owner | J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG | Role-scoped diagnostic views/login | Existing navigation or restricted password/TOTP diagnosis during outage | Required by PRD; implementation Unverified | AUDIT-04, IDENT-06, OPS-03, SECRES-04; no gap |
| EP-22 | Unauthenticated visitor | J-PUBLIC-01 | Public health/login entry | Documented health/console URL; no privileged setup discovery | Required by PRD; implementation Unverified | IDENT-01, IDENT-03, OPS-03, SECRES-01; no gap |
| EP-23 | Scheduled/runtime automation | J-SYSTEM-ADMISSION | Admission, completion and health triggers | Ordinary requests/jobs and visible Activity/Settings status | Required by PRD; implementation Unverified | AUDIT-01, AUDIT-03, AUDIT-04, OPS-01, OPS-02, OPS-03, OPS-04, SEC-03, STATE-02; no gap |


## Capability reachability

| Capability | Actor | Journey | PRD Evidence | Spec Coverage | Implementation Evidence | Reachability | Primary Gap |
|---|---|---|---|---|---|---|---|
| Deploy and authorize initial setup | Host operator | J-HOST-01 | IDENT-01, OPS-05, SECRES-02, CAP-ACCEPT-01 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Establish first Owner | Owner | J-OWNER-01 | IDENT-01, IDENT-02, SEC-01, BACKUP-02, SECRES-01, SECRES-02 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Accept role-bound invitation | Owner | J-OWNER-ENROLL | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Authenticate and manage own security | Owner | J-OWNER-ACCOUNT | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Accept role-bound invitation | Administrator | J-ADMIN-ENROLL | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Authenticate and manage own security | Administrator | J-ADMIN-ACCOUNT | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Accept role-bound invitation | Auditor | J-AUDITOR-ENROLL | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Authenticate and manage own security | Auditor | J-AUDITOR-ACCOUNT | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Accept role-bound invitation | Member | J-MEMBER-ENROLL | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Authenticate and manage own security | Member | J-MEMBER-ACCOUNT | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Invite, grant roles, transfer ownership and disable users | Owner | J-OWNER-PEOPLE | AUTHZ-02, AUTHZ-03, IDENT-03, IDENT-06, SEC-03, STATE-01, STATE-02 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Authorize verified account recovery | Owner | J-OWNER-RECOVERY | IDENT-05, IDENT-06, AUTHZ-03, SECRES-01, SECRES-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Configure and apply service and scanner settings | Owner | J-OWNER-CONFIG | BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Create, rotate and delete managed credentials | Owner | J-OWNER-CREDENTIAL | CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Assign service access and control service lifecycle | Owner | J-OWNER-ACCESS | AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Inspect, edit and safely test policy | Owner | J-OWNER-POLICY | POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Import, export and restore permitted configuration | Owner | J-OWNER-HISTORY | MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Configure and apply service and scanner settings | Administrator | J-ADMIN-CONFIG | BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Create, rotate and delete managed credentials | Administrator | J-ADMIN-CREDENTIAL | CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Assign service access and control service lifecycle | Administrator | J-ADMIN-ACCESS | AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Inspect, edit and safely test policy | Administrator | J-ADMIN-POLICY | POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Import, export and restore permitted configuration | Administrator | J-ADMIN-HISTORY | MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Investigate permitted activity and export evidence | Owner | J-OWNER-ACTIVITY | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Investigate permitted activity and export evidence | Administrator | J-ADMIN-ACTIVITY | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Investigate permitted activity and export evidence | Auditor | J-AUDITOR-ACTIVITY | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Investigate permitted activity | Member | J-MEMBER-ACTIVITY | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Configure authentication, SMTP, limits and retention | Owner | J-OWNER-SETTINGS | IDENT-04, MCP-02, OPS-02, OPS-03, OPS-04, CAP-CFG-06, UX-02, STATE-01, STATE-02 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Connect and revoke ChatGPT or Codex | Owner | J-OWNER-CLIENT | AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Connect and revoke ChatGPT or Codex | Administrator | J-ADMIN-CLIENT | AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Connect and revoke ChatGPT or Codex | Member | J-MEMBER-CLIENT | AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Use registered external OAuth access | External MCP identity | J-EXTERNAL-01 | MCP-02, AUTHZ-01, AUTHZ-02, MCP-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Use explicitly enabled shared bearer MCP access | Legacy bearer identity | J-LEGACY-01 | MCP-02, AUTHZ-01, MCP-04, BACKUP-05 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Discover, obtain references, request and explain denial | MCP client | J-MCP-01 | BASE-01, AUTHZ-01, AUTHZ-02, POLICY-01, SEC-02, MCP-04, STATE-02, CAP-CFG-03, CAP-CFG-05 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Resume after normal restart | MCP client | J-MCP-RESTART | MCP-04, MIGRATE-04, BASE-01 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Create, download and schedule encrypted backups | Owner | J-OWNER-BACKUP | BACKUP-01, BACKUP-02, OPS-04, STATE-04, SEC-01 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Run scheduled backup and retention | Scheduled/runtime automation | J-SYSTEM-BACKUP | BACKUP-01, BACKUP-02, AUDIT-01, AUDIT-03, OPS-03, OPS-04, STATE-04 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Preview and replace functioning instance | Owner | J-OWNER-RESTORE | BACKUP-03, BACKUP-04, BACKUP-06, IDENT-06, SECRES-02, STATE-05, STATE-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Restore to clean replacement host | Host operator | J-HOST-RESTORE | BACKUP-03, BACKUP-04, BACKUP-06, OPS-05, SECRES-02, STATE-05, STATE-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Enroll recovery Owner and reactivate reviewed access | Owner | J-OWNER-RESUME | BACKUP-05, BACKUP-06, AUTHZ-03, SECRES-02, STATE-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Recover locked-out Owners and repair audit storage | Host operator | J-HOST-RECOVERY | IDENT-05, AUDIT-04, OPS-03, SECRES-02, SECRES-04, STATE-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Use read-only diagnosis during audit outage | Owner | J-OWNER-DIAG | AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Use read-only diagnosis during audit outage | Administrator | J-ADMIN-DIAG | AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Use read-only diagnosis during audit outage | Auditor | J-AUDITOR-DIAG | AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Use read-only diagnosis during audit outage | Member | J-MEMBER-DIAG | AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Observe bounded health and locate authorized entry | Unauthenticated visitor | J-PUBLIC-01 | OPS-03, IDENT-01, IDENT-03, SECRES-01 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Enforce limits and maintain durable evidence | Scheduled/runtime automation | J-SYSTEM-ADMISSION | AUDIT-01, AUDIT-03, AUDIT-04, OPS-01, OPS-02, OPS-03, OPS-04, SEC-03, STATE-02 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |
| Inspect non-secret configuration | Auditor | J-AUDITOR-CONFIG | AUTHZ-02, AUTHZ-04, UX-01, UX-02, UX-04, OPS-06 | Complete | Not applicable — future console definition | Indeterminate — no implemented path validation | None found |


## User journeys

Each step below has an ACT mapping. Common role journeys reference the corresponding full flow, with their own role/precondition binding; this does not confer another role’s authority. Every journey inherits the shared invariants and assessment above.

### J-HOST-01 — Host operator: Deploy and authorize initial setup

- **Promise/evidence:** IDENT-01, OPS-05, SECRES-02, CAP-ACCEPT-01.
- **Begins / entry:** Host administrative access; uninitialized single instance; persistent state/audit/backup mounts and stable encryption material available; EP-01.
- **Permissions / preconditions:** Host-local authority; no public claim endpoint.
- **Happy path:** 1. Configure Docker mounts, HTTPS reachability and trusted reverse proxy (Setup availability; missing input diagnostics) → 2. Issue protected bootstrap proof (Proof through protected host action, absent from general logs).
- **Alternate paths:** Keep console private while exposing required MCP/OAuth endpoints; issue a replacement proof after expiry.
- **Failure paths:** Missing storage/key, spoofed forwarded headers, public claim, expired or reused proof must not initialize the instance.
- **State transitions:** Uninitialized → host proof → setup-authorized; expiry/replacement → old proof invalid.
- **Recovery:** Repair mounts/proxy/key inputs or reissue proof; continue J-OWNER-01.
- **Exit / reversal:** Abandon setup with no normal access; no reversal of host deployment is promised by console.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-01 — Owner: Establish first Owner

- **Promise/evidence:** IDENT-01, IDENT-02, SEC-01, BACKUP-02, SECRES-01, SECRES-02.
- **Begins / entry:** Uninitialized instance and valid host proof from J-HOST-01; EP-02.
- **Permissions / preconditions:** Bound setup proof; confirmed password/TOTP; durable audit.
- **Happy path:** 1. Enter instance name/origin and Owner password (Inline errors; non-secret entries retained) → 2. Enroll authenticator and save fresh recovery material (Fresh QR/recovery values shown only in authorized step) → 3. Complete setup (Services entry and independently stored backup recovery material).
- **Alternate paths:** Expired proof can be reissued by host operator without granting public access.
- **Failure paths:** Invalid password/TOTP, concurrent proof reuse, missing audit or abandoned enrollment cannot establish normal access.
- **State transitions:** Uninitialized → verified enrollment → active; failed/abandoned enrollment → still restricted.
- **Recovery:** Correct input; use new host proof after expiry; repair audit before completion.
- **Exit / reversal:** Leave incomplete setup restricted; later logout or protected host recovery, not public re-claim.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-ENROLL — Owner: Accept role-bound invitation

- **Promise/evidence:** IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03.
- **Begins / entry:** Pending invitation with predetermined Owner role; delivery by SMTP or trusted manual channel; EP-03.
- **Permissions / preconditions:** Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA.
- **Happy path:** 1. Open invitation (Enrollment instructions; no activation from preview) → 2. Choose password and enroll authenticator (Inline errors; fresh QR and recovery codes) → 3. Deliberately finish enrollment (Role-permitted console entry).
- **Alternate paths:** Owner may revoke or reissue invitation; reissue invalidates previous proof.
- **Failure paths:** Expired/cancelled/replayed/cross-instance proof, wrong identity, weak password, invalid TOTP or audit outage leaves account inactive.
- **State transitions:** Pending → confirmed enrollment → active; reissue/cancel → old proof invalid; failed/abandoned → pending.
- **Recovery:** Correct non-secret input; request fresh invitation from Owner; no self-registration fallback.
- **Exit / reversal:** Close before completion without activating; after activation use own logout/recovery; Owner can disable.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-ACCOUNT — Owner: Authenticate and manage own security

- **Promise/evidence:** IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04.
- **Begins / entry:** Enrolled Owner; existing password and TOTP or authorized recovery route; EP-04.
- **Permissions / preconditions:** Own identity; password plus valid factor/code for replacement; current session alone insufficient.
- **Happy path:** 1. Log in with password and TOTP (Console or bounded failure message) → 2. Change own password or replace MFA (Fresh enrollment feedback; security notice if available) → 3. Revoke other sessions or log out locally (Session list updated or login entry).
- **Alternate paths:** Password reset retains MFA; recovery-code path consumes one code; 30-minute idle/12-hour expiry requires login. During audit outage use J-OWNER-DIAG.
- **Failure paths:** Wrong password/TOTP, reused code, session-only factor replacement, expired session or throttled attempts reject; no account deletion from throttling.
- **State transitions:** Logged out → valid two factors → active; replacement/recovery → old sessions invalid; expiry/logout → logged out.
- **Recovery:** Retry within limits, reset through established contact channel, or ask Owner for verified recovery; locked-out Owners use host recovery.
- **Exit / reversal:** Logout is independent of revoking other sessions; closing a form abandons an uncommitted replacement, not an already completed security action.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-ENROLL — Administrator: Accept role-bound invitation

- **Promise/evidence and entry:** IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03; EP-03.
- **Begins / permissions:** Pending invitation with predetermined Administrator role; delivery by SMTP or trusted manual channel. Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ENROLL with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Administrator enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-ACCOUNT — Administrator: Authenticate and manage own security

- **Promise/evidence and entry:** IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04; EP-04.
- **Begins / permissions:** Enrolled Administrator; existing password and TOTP or authorized recovery route. Own identity; password plus valid factor/code for replacement; current session alone insufficient.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACCOUNT with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Administrator normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-AUDITOR-ENROLL — Auditor: Accept role-bound invitation

- **Promise/evidence and entry:** IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03; EP-03.
- **Begins / permissions:** Pending invitation with predetermined Auditor role; delivery by SMTP or trusted manual channel. Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ENROLL with this actor and permissions. Auditor is evidence/configuration read-only and cannot execute MCP; activity inspection has no execution entitlement.
- **Acceptance:** Auditor enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-AUDITOR-ACCOUNT — Auditor: Authenticate and manage own security

- **Promise/evidence and entry:** IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04; EP-04.
- **Begins / permissions:** Enrolled Auditor; existing password and TOTP or authorized recovery route. Own identity; password plus valid factor/code for replacement; current session alone insufficient.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACCOUNT with this actor and permissions. Auditor is evidence/configuration read-only and cannot execute MCP; activity inspection has no execution entitlement.
- **Acceptance:** Auditor normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-MEMBER-ENROLL — Member: Accept role-bound invitation

- **Promise/evidence and entry:** IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03; EP-03.
- **Begins / permissions:** Pending invitation with predetermined Member role; delivery by SMTP or trusted manual channel. Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ENROLL with this actor and permissions. Member has no instance evidence/export or administration rights.
- **Acceptance:** Member enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-MEMBER-ACCOUNT — Member: Authenticate and manage own security

- **Promise/evidence and entry:** IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04; EP-04.
- **Begins / permissions:** Enrolled Member; existing password and TOTP or authorized recovery route. Own identity; password plus valid factor/code for replacement; current session alone insufficient.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACCOUNT with this actor and permissions. Member has no instance evidence/export or administration rights.
- **Acceptance:** Member normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-PEOPLE — Owner: Invite, grant roles, transfer ownership and disable users

- **Promise/evidence:** AUTHZ-02, AUTHZ-03, IDENT-03, IDENT-06, SEC-03, STATE-01, STATE-02.
- **Begins / entry:** Active Owner and target invited/active user; replacement Owner enrolled for transfer; EP-05.
- **Permissions / preconditions:** Current Owner; recent authentication for ownership change; audit; final active Owner protected.
- **Happy path:** 1. Invite a user with fixed role (Pending/delivery status and manual link option) → 2. Change role or transfer ownership (Immediate current-role feedback) → 3. Disable user or revoke their sessions/MCP grants (Success before later request admission; history retained).
- **Alternate paths:** Revoke/reissue pending invitations independently; a second Owner is recommended, not required.
- **Failure paths:** Last-Owner disable/demotion/deletion, unenrolled ownership replacement, forbidden role or failed audit cannot mutate; SMTP failure does not activate invitation.
- **State transitions:** Pending → revoke/reissue → cancelled/new proof; active → disable → ineligible; role change → current permissions immediately.
- **Recovery:** Correct target/role; enroll replacement before ownership transfer; retry delivery or share manually; fix audit first.
- **Exit / reversal:** Cancel before explicit immediate action; completed grants/removals require another current-authorized action and never history rollback.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-RECOVERY — Owner: Authorize verified account recovery

- **Promise/evidence:** IDENT-05, IDENT-06, AUTHZ-03, SECRES-01, SECRES-03.
- **Begins / entry:** Target cannot use normal MFA/recovery; active assisting Owner; EP-05.
- **Permissions / preconditions:** Recent Owner password/TOTP plus trusted-channel identity verification; recheck issuer at activation.
- **Happy path:** 1. Verify person and authorize recovery (Immediate restriction and single-use 30-minute enrollment link) → 2. Deliver link manually or through SMTP (Safe delivery failure or pending status) → 3. Review completion (Completion/security notice).
- **Alternate paths:** Normal established-channel password reset remains separate and cannot remove MFA. All Owners locked out use J-HOST-RECOVERY.
- **Failure paths:** Unverified person, stale/disabled issuer, expired/replayed proof, audit outage or incomplete enrollment cannot grant access.
- **State transitions:** Authorized recovery → sessions/grants invalid and account restricted; deliberate valid enrollment → active.
- **Recovery:** Reverify/reissue after expiry; repair audit first; unavailable Owner routes to host-local recovery.
- **Exit / reversal:** Abandoned recovery leaves restricted account; cancelling/reissuing invalidates proof and cannot silently restore old sessions.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-CONFIG — Owner: Configure and apply service and scanner settings

- **Promise/evidence:** BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02.
- **Begins / entry:** Active Owner; service creation or editable existing service; EP-06.
- **Permissions / preconditions:** Current per-setting configuration permission; audit; no implicit MCP grant; Owner instance settings allowed only when explicitly included.
- **Happy path:** 1. Find service or start Add service (Overview/Configuration/Access/Activity or five-step wizard) → 2. Edit details, destinations, placement and scanning (Effective summaries; exact/suffix/regex, TLS inheritance, multiple/no-auth placement and both catalogs retained) → 3. Review differences and exceptions (Affected services, exceptions and reconnect impact visible) → 4. Apply explicitly (Applied success; initial explicit grants may activate atomically).
- **Alternate paths:** Edit via guided forms or advanced editor without field loss; active service keeps previous revision while draft exists; explicitly acknowledged relaxed TLS/scanning remain supported.
- **Failure paths:** Invalid URL/regex/catalog/placement, missing credential, stale dependency/role/base, unacknowledged exception, failed activation or audit rejects without partial activation.
- **State transitions:** Draft → review → applied; conflict → unapplied draft with comparison; activation failure → prior coherent active configuration.
- **Recovery:** Keep non-secret fields, correct inline errors, compare/reload stale changes and review again; secret inputs are not exposed as recovery data.
- **Exit / reversal:** Leave draft unapplied; no active change until apply. Reverse permitted applied configuration with J-OWNER-HISTORY; immediate credentials/grants are separate.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-CREDENTIAL — Owner: Create, rotate and delete managed credentials

- **Promise/evidence:** CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03.
- **Begins / entry:** Service authentication editor and required write-only value; EP-07.
- **Permissions / preconditions:** Current configuration role; healthy audit; deletion dependencies resolved.
- **Happy path:** 1. Create or replace a credential value (Only label/placement/availability/version/time displayed) → 2. Confirm rotation (Rotation result without saved-value reveal) → 3. Delete unreferenced credential (Deleted or explicit dependency error).
- **Alternate paths:** Placement metadata is draft/apply; explicit no-downstream-auth service needs no credential; migration uses intentionally supplied inputs only.
- **Failure paths:** Invalid values, arbitrary host-source read, dependency race, referenced delete or audit outage reject; no logs/diffs/export disclose values.
- **State transitions:** Creation/rotation/deletion immediately changes managed value state; rollback cannot restore deleted or prior values.
- **Recovery:** Correct input; remove/update dependencies through reviewed configuration before deletion; acquire new gateway references after rotation.
- **Exit / reversal:** Cancel before explicit value action; after action another authorized replacement is required, never reveal or history undo.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-ACCESS — Owner: Assign service access and control service lifecycle

- **Promise/evidence:** AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03.
- **Begins / entry:** Existing eligible local/external identity and service; EP-08.
- **Permissions / preconditions:** Current configuration role; target eligible; durable audit; Administrator cannot create users/change role.
- **Happy path:** 1. Grant or remove service assignment (Current access list and action result) → 2. Disable or archive service (Status and preserved audit/history) → 3. Restore archived service and review enablement (Review then activation result).
- **Alternate paths:** Initial new grants may accompany first service activation only with fresh explicit review; already-dispatched work may finish under admitted protection.
- **Failure paths:** Auditor execution, missing identity, last-moment revocation, stale wizard, disabled service dispatch or audit outage cannot grant/execute.
- **State transitions:** Grant/remove immediate; disable/archive immediate; unarchive never directly Active; old history cannot restore access.
- **Recovery:** Correct identity eligibility via Owner where needed; refresh access list after conflict; explicitly review current service to re-enable.
- **Exit / reversal:** Cancel before immediate action; deliberate new grant/re-enable reverses removal only under current checks; no remote-side-effect rollback.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-POLICY — Owner: Inspect, edit and safely test policy

- **Promise/evidence:** POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05.
- **Begins / entry:** Editable service policy and candidate identity/destination/method/path; EP-09.
- **Permissions / preconditions:** Current configuration role; policy tester uses permitted configuration and identity metadata.
- **Happy path:** 1. Edit path/method/host rules (Effective order and default mode visible) → 2. Run safe policy preview (Eligibility, canonical target, matching rule and reason) → 3. Review and apply policy (Applied or field/conflict error).
- **Alternate paths:** Highest priority wins; deny wins opposite-effect tie; same-effect tie stable; no match uses default mode. Advanced regex remains exact on editor switch.
- **Failure paths:** Malformed regex/path encoding, unauthorized identity/context or stale apply rejects; preview never tests credentials by making real HTTP calls.
- **State transitions:** Draft → preview result → review → applied; preview alone never changes active state.
- **Recovery:** Correct highlighted field, inspect canonical path, adjust intended rule then retest/review.
- **Exit / reversal:** Abandon draft/preview; roll back applied permitted policy only via fresh history draft.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-HISTORY — Owner: Import, export and restore permitted configuration

- **Promise/evidence:** MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03.
- **Begins / entry:** Legacy YAML/catalogs or existing applied history; authenticated actor; EP-10.
- **Permissions / preconditions:** Current permissions for every imported/history setting; deliberate credential sources; no email-only identity grant.
- **Happy path:** 1. Import files or choose earlier revision (Unknown fields, missing credentials/identities and impact listed) → 2. Resolve credentials and explicit identities (Missing values keep service inactive) → 3. Review/apply or export sanitized configuration (No routine restart; reconnect notice when identity/endpoint changes).
- **Alternate paths:** Latest 50 applied revisions retained; switching editors preserves imported regex/catalog fields; secret-bearing recovery uses encrypted backup, not export.
- **Failure paths:** Malformed/unknown fields, arbitrary host source, forbidden setting, missing/deleted secret or obsolete grant/lifecycle snapshot rejected; audit outage blocks mutations/export.
- **State transitions:** Import/history → fresh draft → applied; no live grant/identity/lifecycle/secret rollback; old YAML/env cannot override managed authority.
- **Recovery:** Resolve each explicit error; resupply intended secret; map identity with appropriate authority; retry fresh review after conflict.
- **Exit / reversal:** Cancel import or leave draft unapplied; prior configuration remains active on failure; export does not mutate configuration.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-CONFIG — Administrator: Configure and apply service and scanner settings

- **Promise/evidence and entry:** BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02; EP-06.
- **Begins / permissions:** Active Administrator; service creation or editable existing service. Current per-setting configuration permission; audit; no implicit MCP grant; Owner-only settings excluded.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-CONFIG with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** All existing configuration fields round-trip; invalid input, stale apply and mixed-owner-setting negatives; keyboard/narrow screens; first simple service within 15 minutes.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-CREDENTIAL — Administrator: Create, rotate and delete managed credentials

- **Promise/evidence and entry:** CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03; EP-07.
- **Begins / permissions:** Service authentication editor and required write-only value. Current configuration role; healthy audit; deletion dependencies resolved.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-CREDENTIAL with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Write-only creation/rotation and dependency-safe deletion; canary leaks, arbitrary host reads and old-reference use fail.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-ACCESS — Administrator: Assign service access and control service lifecycle

- **Promise/evidence and entry:** AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03; EP-08.
- **Begins / permissions:** Existing eligible local/external identity and service. Current configuration role; target eligible; durable audit; Administrator cannot create users/change role.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACCESS with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Grant/remove/disable/archive/unarchive success; Auditor/unassigned admin and queued stale requests denied; completed request cannot revive references.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-POLICY — Administrator: Inspect, edit and safely test policy

- **Promise/evidence and entry:** POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05; EP-09.
- **Begins / permissions:** Editable service policy and candidate identity/destination/method/path. Current configuration role; policy tester uses permitted configuration and identity metadata.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-POLICY with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Preview/runtime agreement including ties/defaults/canonical path; malformed inputs and zero substitution/I/O checks; self-signed TLS test in runtime regression.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-HISTORY — Administrator: Import, export and restore permitted configuration

- **Promise/evidence and entry:** MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03; EP-10.
- **Begins / permissions:** Legacy YAML/catalogs or existing applied history; authenticated actor. Current permissions for every imported/history setting; deliberate credential sources; no email-only identity grant.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-HISTORY with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** All legacy fields and catalogs preserved; missing/unknown inputs fail; history cannot restore secrets/access or Owner-only settings; no stale-env override.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-ACTIVITY — Owner: Investigate permitted activity and export evidence

- **Promise/evidence:** AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04.
- **Begins / entry:** Authenticated Owner; recorded events or denial identifier; EP-11.
- **Permissions / preconditions:** Current evidence-read/export role; never raw secrets; export requires durable audit.
- **Happy path:** 1. Filter and inspect activity (Event detail and attributable revision; empty-state feedback) → 2. Investigate denial or uncertain request (Safe next step and provenance) → 3. Export selected evidence/report (Download with access/config/exception/version/backup evidence).
- **Alternate paths:** Event filters may yield no matches; own client denial lookup also uses explain_denial; existing scoped viewing survives audit outage.
- **Failure paths:** Unauthorized target/event, expired denial or missing record yields bounded feedback; forged labels/paths cannot inject sensitive data; Member cannot export instance evidence.
- **State transitions:** Filter → scoped list → detail → return; export creates artifact without editing events; audit outage → view-only.
- **Recovery:** Adjust filter/request ID, check retention and permissions; uncertain remote effect requires investigation, not automatic retry.
- **Exit / reversal:** Clear filters or leave detail; exports do not delete records; retention is separate Owner setting.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-ACTIVITY — Administrator: Investigate permitted activity and export evidence

- **Promise/evidence and entry:** AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04; EP-11.
- **Begins / permissions:** Authenticated Administrator; recorded events or denial identifier. Current evidence-read/export role; never raw secrets; export requires durable audit.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACTIVITY with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Administrator scoped list/detail; forbidden actor/service data, secret canaries and raw body exposure denied; denial diagnosis within two minutes.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-AUDITOR-ACTIVITY — Auditor: Investigate permitted activity and export evidence

- **Promise/evidence and entry:** AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04; EP-11.
- **Begins / permissions:** Authenticated Auditor; recorded events or denial identifier. Current evidence-read/export role; never raw secrets; export requires durable audit.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACTIVITY with this actor and permissions. Auditor is evidence/configuration read-only and cannot execute MCP; activity inspection has no execution entitlement.
- **Acceptance:** Auditor scoped list/detail; forbidden actor/service data, secret canaries and raw body exposure denied; denial diagnosis within two minutes.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-MEMBER-ACTIVITY — Member: Investigate permitted activity

- **Promise/evidence:** AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04.
- **Begins / entry:** Authenticated Member; recorded events or denial identifier; EP-11.
- **Permissions / preconditions:** Own permitted activity only; no instance export.
- **Happy path:** 1. Filter and inspect activity (Event detail and attributable revision; empty-state feedback) → 2. Investigate denial or uncertain request (Safe next step and provenance) → 3. Return to activity (Own scoped results).
- **Alternate paths:** Event filters may yield no matches; own client denial lookup also uses explain_denial; existing scoped viewing survives audit outage.
- **Failure paths:** Unauthorized target/event, expired denial or missing record yields bounded feedback; forged labels/paths cannot inject sensitive data; Member cannot export instance evidence.
- **State transitions:** Filter → scoped list → detail → return; export creates artifact without editing events; audit outage → view-only.
- **Recovery:** Adjust filter/request ID, check retention and permissions; uncertain remote effect requires investigation, not automatic retry.
- **Exit / reversal:** Clear filters or leave detail; exports do not delete records; retention is separate Owner setting.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-SETTINGS — Owner: Configure authentication, SMTP, limits and retention

- **Promise/evidence:** IDENT-04, MCP-02, OPS-02, OPS-03, OPS-04, CAP-CFG-06, UX-02, STATE-01, STATE-02.
- **Begins / entry:** Active Owner; known SMTP/authorization values and current usage; EP-12.
- **Permissions / preconditions:** Current Owner; recent authentication for authentication/recovery-material changes; audit.
- **Happy path:** 1. Edit advanced instance settings (Units/defaults/current use and capacity effect) → 2. Review and apply settings (Applied; reconnect warnings or errors) → 3. Test SMTP and inspect status (Test success/failure; optional manual workflow remains).
- **Alternate paths:** Built-in OAuth is normal; external issuer/subject registration or legacy mode explicitly selected; no browser SSO. Capacity below use blocks new allocations without eviction.
- **Failure paths:** Invalid setting combinations, SMTP error, stale apply, non-Owner attempt or audit failure reject relevant operation; mail outage alone does not block gateway.
- **State transitions:** Draft → reviewed apply → active; email success/failure changes status only; retention shortening explicit, never hidden disk-pressure deletion.
- **Recovery:** Correct field and retry test; use trusted manual invitations; restore valid limit; operator repairs underlying storage.
- **Exit / reversal:** Abandon unapplied settings or explicitly apply new values; no hidden override from old environment/YAML.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-CLIENT — Owner: Connect and revoke ChatGPT or Codex

- **Promise/evidence:** AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01.
- **Begins / entry:** Enrolled Owner; network-reachable MCP URL; explicit eligible service assignment; EP-13.
- **Permissions / preconditions:** Local password/MFA plus per-user OAuth consent; client/redirect/PKCE/scopes validated; audit.
- **Happy path:** 1. Use the client-specific setup instructions (Reachability and exact URL instructions) → 2. Authenticate and consent (Authorized client; service access still separately checked) → 3. Inspect or revoke connected client (Client list updated; later calls denied).
- **Alternate paths:** ChatGPT and Codex are distinct validated client paths; deny consent or close flow yields no grant; refresh rotation preserves authorized access until revocation.
- **Failure paths:** Unreachable private endpoint, invalid client/redirect/scopes, missing MFA, forbidden metadata destination, refresh replay or audit outage cannot issue access.
- **State transitions:** Unconnected → consent → connected; refusal → unconnected; refresh → replacement grant state; revoke → denied.
- **Recovery:** Correct URL/reachability, obtain explicit assignment, retry valid authorization; reconnect after restore/auth identity change.
- **Exit / reversal:** Decline consent before grant; revoke client after grant; console logout and OAuth revocation are distinct.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-CLIENT — Administrator: Connect and revoke ChatGPT or Codex

- **Promise/evidence and entry:** AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01; EP-13.
- **Begins / permissions:** Enrolled Administrator; network-reachable MCP URL; explicit eligible service assignment. Local password/MFA plus per-user OAuth consent; client/redirect/PKCE/scopes validated; audit.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-CLIENT with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Real ChatGPT/Codex for assigned Administrator; unassigned admin, invalid PKCE/redirect, replay and revoked access negatives.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-MEMBER-CLIENT — Member: Connect and revoke ChatGPT or Codex

- **Promise/evidence and entry:** AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01; EP-13.
- **Begins / permissions:** Enrolled Member; network-reachable MCP URL; explicit eligible service assignment. Local password/MFA plus per-user OAuth consent; client/redirect/PKCE/scopes validated; audit.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-CLIENT with this actor and permissions. Member has no instance evidence/export or administration rights.
- **Acceptance:** Real ChatGPT/Codex for assigned Member; unassigned admin, invalid PKCE/redirect, replay and revoked access negatives.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-EXTERNAL-01 — External MCP identity: Use registered external OAuth access

- **Promise/evidence:** MCP-02, AUTHZ-01, AUTHZ-02, MCP-04.
- **Begins / entry:** Valid external issuer credential and explicit registered issuer/subject/service assignment; EP-14.
- **Permissions / preconditions:** Configured external issuer/audience/scope checks; eligible registered identity; no browser-console rights.
- **Happy path:** 1. Acquire external authorization through issuer (External provider result; outside console account enrollment) → 2. Call authenticated MCP endpoint (Same five generic tools) → 3. Respond to revocation (Reauthorize or request Owner registration review).
- **Alternate paths:** Owner can disable/reactivate mode; administrative status cannot be inferred from external identity.
- **Failure paths:** Wrong issuer/subject/audience/scope, unregistered identity, revoked service assignment or disabled mode rejected; no automatic email matching.
- **State transitions:** Unregistered → explicit registration and grant → eligible; removal/restore → ineligible.
- **Recovery:** Operator/Owner corrects registration or issuer settings; caller obtains valid external token.
- **Exit / reversal:** Remove service assignment or disable mode; external provider token lifecycle remains external responsibility.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-LEGACY-01 — Legacy bearer identity: Use explicitly enabled shared bearer MCP access

- **Promise/evidence:** MCP-02, AUTHZ-01, MCP-04, BACKUP-05.
- **Begins / entry:** Owner configured advanced legacy mode and eligible identity/service access; EP-14.
- **Permissions / preconditions:** Valid bearer on each POST; configured shared attribution; no console account permission.
- **Happy path:** 1. Invoke MCP using configured legacy credential (Shared-attribution notice and normal tool response) → 2. Respond to rotation/revocation or restore (Requires explicit Owner reactivation/new credential).
- **Alternate paths:** Preserved compatibility mode is optional; built-in per-user OAuth remains normal.
- **Failure paths:** Invalid bearer, disabled mode, missing assignment, audit failure or console attempt denied.
- **State transitions:** Explicit enabled mode → eligible; restore/disable → revoked; no automatic post-restore enable.
- **Recovery:** Owner reviews advanced mode and issues new access through authorized setup; callers reconnect.
- **Exit / reversal:** Owner disables mode/removes assignment; no browser logout for this transport identity.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-MCP-01 — MCP client: Discover, obtain references, request and explain denial

- **Promise/evidence:** BASE-01, AUTHZ-01, AUTHZ-02, POLICY-01, SEC-02, MCP-04, STATE-02, CAP-CFG-03, CAP-CFG-05.
- **Begins / entry:** Authorized local/external/legacy principal from corresponding client journey; selected service; EP-15.
- **Permissions / preconditions:** Authenticate every POST; tool scope, current eligibility, active service, reference binding, canonical destination/policy, audit before substitution.
- **Happy path:** 1. Discover services and describe policy (Accessible services, destinations and effective policy) → 2. Obtain service references (Opaque placement references without credential reveal) → 3. Submit service request (Protected structured/Base64/binary result or safe error) → 4. Explain denied request (Bound safe reason and next action).
- **Alternate paths:** Explicit no-downstream-auth service still authenticates MCP; allowed private destinations differ from restricted OAuth metadata; header enforcement default-off preserved.
- **Failure paths:** Invalid arguments, cookies/path encoding/destination, another subject reference, revoked assignment, policy denial, timeout/size/scanner/capacity or audit failure rejects safely; rejected preflight sends no downstream request.
- **State transitions:** Eligible → issuance → queued → current recheck → dispatch → protected result; deny → record; revoked/expired reference never revives after completion.
- **Recovery:** Inspect safe denial, correct allowed input or reacquire valid reference; already-dispatched uncertain effects require investigation before deliberate retry.
- **Exit / reversal:** Finish request or abandon before admission; timeout/cancel does not promise remote undo; administrative revocation blocks future admission.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-MCP-RESTART — MCP client: Resume after normal restart

- **Promise/evidence:** MCP-04, MIGRATE-04, BASE-01.
- **Begins / entry:** Previously connected client; normal application restart with durable mounts/key material; EP-15.
- **Permissions / preconditions:** Per-POST authentication; valid retained refresh authorization; references ephemeral.
- **Happy path:** 1. Reconnect or refresh after restart (Normal OAuth continuation when grant valid) → 2. Reacquire references and continue (Usable requests under current configuration).
- **Alternate paths:** Full restore is different: all grants invalid and requires fresh connection after reviewed activation.
- **Failure paths:** Missing signing/storage state, replayed refresh, stale reference or revoked identity fails rather than inventing transport session continuity.
- **State transitions:** Restart preserves durable authority, loses ephemeral handles; reacquisition restores only currently allowed execution.
- **Recovery:** Repair startup material; reacquire references or perform full OAuth authorization when required.
- **Exit / reversal:** Client may remain disconnected; no mcp-session-id is created/trusted.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-BACKUP — Owner: Create, download and schedule encrypted backups

- **Promise/evidence:** BACKUP-01, BACKUP-02, OPS-04, STATE-04, SEC-01.
- **Begins / entry:** Healthy initialized instance; backup mount and independently stored recovery material; EP-16.
- **Permissions / preconditions:** Current Owner; audit; recent authentication for download/recovery-material changes; one backup/restore job.
- **Happy path:** 1. Start backup or configure daily schedule (Progress and included/excluded scope) → 2. Inspect completed backup and download (Recovery/completion times, size, version and audit extent) → 3. Copy archive off-host using operator process (Documentation of independent recovery material requirement).
- **Alternate paths:** Daily schedule and 30-day retention defaults; concurrent edits fall wholly before/after snapshot; no remote storage integration.
- **Failure paths:** Audit outage, overlapping job, missing storage/material, full disk or incomplete archive reports failure; last valid backup preserved.
- **State transitions:** Idle → running → success/failed; partial archive never succeeds; configuration is not reverted by backup.
- **Recovery:** Correct mount/capacity through host operator, retry after current job; retain independently stored archive/key.
- **Exit / reversal:** Leave progress and inspect status later; no promised mid-job cancellation. Download does not change source instance; expiry is configured retention.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-SYSTEM-BACKUP — Scheduled/runtime automation: Run scheduled backup and retention

- **Promise/evidence:** BACKUP-01, BACKUP-02, AUDIT-01, AUDIT-03, OPS-03, OPS-04, STATE-04.
- **Begins / entry:** Owner-configured daily schedule/retention; mounted storage; EP-17.
- **Permissions / preconditions:** Configured system job authority; durable audit; single job; preserve configured retention.
- **Happy path:** 1. Trigger scheduled backup (Backup status; optional failure email) → 2. Apply retention to eligible archives/audit evidence (Retention outcome visible; no silent emergency shortening).
- **Alternate paths:** Email failure leaves failure visible in console; operator copies successful archive off-host. No autonomous unbounded retry policy is promised.
- **Failure paths:** Audit/storage/capacity failure or another job blocks operation safely; incomplete archives cannot replace last valid backup; email does not certify backup success.
- **State transitions:** Scheduled → running → completed/failed; overdue/failed remains visible; retention action requires healthy evidence recording.
- **Recovery:** Owner/operator repairs cause and starts manual retry or waits for next scheduled execution; in-product status remains source of outcome.
- **Exit / reversal:** Owner changes schedule/retention explicitly; no automated rollback of application configuration.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-RESTORE — Owner: Preview and replace functioning instance

- **Promise/evidence:** BACKUP-03, BACKUP-04, BACKUP-06, IDENT-06, SECRES-02, STATE-05, STATE-06.
- **Begins / entry:** Functioning instance; archive and recovery material; current Owner may differ from archived Owner; EP-18.
- **Permissions / preconditions:** Recent current Owner password/TOTP; verified archive recovery material; nominate valid archived Owner; audit.
- **Happy path:** 1. Upload archive and preview restore (Scope, archive time, lost access, initiator and nominated Owner) → 2. Confirm replacement (Progress; sensitive admission paused) → 3. Complete installation (Recovery enrollment entry; provenance retained).
- **Alternate paths:** Initiator absent from archive can nominate archived Owner; prior local audit tail remains; imported overlap is not new activity.
- **Failure paths:** Wrong key/corruption/unsafe archive/version/no Owner/capacity/pre-backup/drain failure aborts before replacement; crash/failure restores prior coherent state or stays maintenance with host recovery.
- **State transitions:** Active → preview → maintenance → installed recovery; install failure → prior coherent state plus fresh login, never revived sessions; rollback failure → maintenance.
- **Recovery:** Fix preview inputs and retry; host repairs failed rollback using protected local source; completed installation enrollment failures use J-OWNER-RESUME.
- **Exit / reversal:** Cancel at preview without replacement; after installation no automatic reactivation of old state; no selective merge or downstream data restore.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-HOST-RESTORE — Host operator: Restore to clean replacement host

- **Promise/evidence:** BACKUP-03, BACKUP-04, BACKUP-06, OPS-05, SECRES-02, STATE-05, STATE-06.
- **Begins / entry:** Clean replacement infrastructure; independently stored archive and recovery material; EP-01.
- **Permissions / preconditions:** Protected newly issued restore proof plus archive material; no old password/session authority.
- **Happy path:** 1. Issue restore proof and supply archive/key (Owner nomination and deployment prerequisites) → 2. Install verified archive (Restricted continuation for nominated archived Owner; audit gap identified).
- **Alternate paths:** Expired host proof replaced explicitly; all older authentication state stays invalid.
- **Failure paths:** Archive/key without host proof, proof without key, malformed archive or partial installation cannot expose normal accounts/services.
- **State transitions:** Uninitialized → authorized preview → installed recovery; failure → uninitialized/restricted retryable state.
- **Recovery:** Correct prerequisites, reissue proof or retry intact archive; do not copy partially installed state into active use.
- **Exit / reversal:** Abandon preview restricted; once installed continue J-OWNER-RESUME; replacing state again requires authorized full restore.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-RESUME — Owner: Enroll recovery Owner and reactivate reviewed access

- **Promise/evidence:** BACKUP-05, BACKUP-06, AUTHZ-03, SECRES-02, STATE-06.
- **Begins / entry:** Complete restored installation; nominated archived Owner; restricted continuation; EP-19.
- **Permissions / preconditions:** Single-use bound continuation; fresh password/TOTP; durable audit before ordinary management.
- **Happy path:** 1. Set fresh recovery Owner password and MFA (Management review only; fresh recovery codes) → 2. Review restored users and authorize reenrollment (Pending/active identities and still-disabled services) → 3. Review service credentials/policy and explicitly enable (Clients must reconnect; old tokens/links/references remain invalid).
- **Alternate paths:** Fresh Owner management may resume while every service remains Disabled; users can remain pending indefinitely without access.
- **Failure paths:** Old password-only enrollment, old factor/link/grant, wrong/expired continuation, missing credential or audit outage blocks activation.
- **State transitions:** Restricted → fresh Owner+audit → management only → independently reviewed users/services; archived assignments alone never grant.
- **Recovery:** Lost/expired continuation uses host recovery; replace stale credentials and correct policy; reconnect clients only after activation.
- **Exit / reversal:** Leave services Disabled/users pending; no rollback to old authentication state; later explicit disable/revoke is available.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-HOST-RECOVERY — Host operator: Recover locked-out Owners and repair audit storage

- **Promise/evidence:** IDENT-05, AUDIT-04, OPS-03, SECRES-02, SECRES-04, STATE-06.
- **Begins / entry:** Host administrative access; all Owners locked out, lost restore continuation, or audit degraded; EP-20.
- **Permissions / preconditions:** Protected host authority; durable audit must be repaired before recovery mutation; no web filesystem or password-only fallback.
- **Happy path:** 1. Diagnose and repair storage/process conditions (Bounded health and known/unknown outage interval) → 2. Record recovery and resume admission safely (Fresh normal authentication required for diagnostic users) → 3. Authorize selected Owner reenrollment if needed (Fresh password/MFA path; no ordinary access before completion).
- **Alternate paths:** Repair without identity change when users can already authenticate; uncertain durable starts remain investigable after restart.
- **Failure paths:** Unsafe replay/throttle state blocks new diagnostic login; unavailable audit blocks recovery; host proof expiry leaves restricted recoverable state.
- **State transitions:** Outage → repair+durable record → normal admission; locked Owner → host proof → fresh enrollment, never direct unaudited privilege.
- **Recovery:** Continue host storage repair; reissue expired capability; investigate uncertain side effects manually.
- **Exit / reversal:** Remain degraded safely if repair fails; no UI override or fake audit continuity; local logout remains available.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-OWNER-DIAG — Owner: Use read-only diagnosis during audit outage

- **Promise/evidence:** AUDIT-04, OPS-03, SECRES-04, IDENT-06.
- **Begins / entry:** Existing Owner session or password/TOTP with reliable replay/throttle state; audit unavailable; EP-21.
- **Permissions / preconditions:** Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity.
- **Happy path:** 1. Read permitted status/activity (Degraded cause and operator repair instruction) → 2. Attempt normal sensitive work or wait for repair (Explicit unavailable reason) → 3. Log out or reauthenticate after repair (Normal role scope only after valid new authentication).
- **Alternate paths:** If authentication safety state is unreliable, new login fails closed and host diagnostics remain available.
- **Failure paths:** Forbidden evidence or every mutation/export/backup/recovery/grant attempt is denied; no silent session upgrade.
- **State transitions:** Healthy → outage → scoped diagnosis; repair → still restricted until fresh normal login; logout → local session cleared.
- **Recovery:** Host operator repairs storage; user retries normal authentication afterward; no unaudited web repair bypass.
- **Exit / reversal:** Local logout or expiry always possible; leaving diagnosis does not restore audit service.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-ADMIN-DIAG — Administrator: Use read-only diagnosis during audit outage

- **Promise/evidence and entry:** AUDIT-04, OPS-03, SECRES-04, IDENT-06; EP-21.
- **Begins / permissions:** Existing Administrator session or password/TOTP with reliable replay/throttle state; audit unavailable. Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-DIAG with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Administrator appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-AUDITOR-DIAG — Auditor: Use read-only diagnosis during audit outage

- **Promise/evidence and entry:** AUDIT-04, OPS-03, SECRES-04, IDENT-06; EP-21.
- **Begins / permissions:** Existing Auditor session or password/TOTP with reliable replay/throttle state; audit unavailable. Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-DIAG with this actor and permissions. Auditor is evidence/configuration read-only and cannot execute MCP; activity inspection has no execution entitlement.
- **Acceptance:** Auditor appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-MEMBER-DIAG — Member: Use read-only diagnosis during audit outage

- **Promise/evidence and entry:** AUDIT-04, OPS-03, SECRES-04, IDENT-06; EP-21.
- **Begins / permissions:** Existing Member session or password/TOTP with reliable replay/throttle state; audit unavailable. Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-DIAG with this actor and permissions. Member has no instance evidence/export or administration rights.
- **Acceptance:** Member appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-PUBLIC-01 — Unauthenticated visitor: Observe bounded health and locate authorized entry

- **Promise/evidence:** OPS-03, IDENT-01, IDENT-03, SECRES-01.
- **Begins / entry:** No authenticated console identity or host proof; EP-22.
- **Permissions / preconditions:** Public bounded healthy/degraded status only; no discoverable bootstrap authority.
- **Happy path:** 1. Open public health or login entry (Healthy/degraded or login; authorized links route to bound flow).
- **Alternate paths:** Invitation/reset link GET may show safe enrollment instructions but never consume proof or enroll.
- **Failure paths:** Attempts to claim instance, enumerate users, read configuration or mutate through public endpoints denied.
- **State transitions:** Unauthenticated remains unauthenticated until complete authorized login/enrollment.
- **Recovery:** Use valid invitation or contact Owner/operator through existing trusted channel.
- **Exit / reversal:** Close page; no account or grant to revoke.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-SYSTEM-ADMISSION — Scheduled/runtime automation: Enforce limits and maintain durable evidence

- **Promise/evidence:** AUDIT-01, AUDIT-03, AUDIT-04, OPS-01, OPS-02, OPS-03, OPS-04, SEC-03, STATE-02.
- **Begins / entry:** Configured single instance with concurrent management/MCP/backup events; EP-23.
- **Permissions / preconditions:** Current active limits and permissions; mandatory durable admission and sanitized append.
- **Happy path:** 1. Admit or reject bounded operation (Bounded result/limit reason) → 2. Record completion or uncertain outcome (Activity and degraded status with request/revision) → 3. Expose health and usage (Actionable cause; optional security/failure notifications).
- **Alternate paths:** 50 users/100 services is tested envelope, not hard cap; lower capacity waits for usage to fall without eviction; already-dispatched work may finish.
- **Failure paths:** Storage loss, capacity exceeded, rejected scanner/input or audit failure does not leak raw bodies/secrets or execute rejected work; bounded buffering only.
- **State transitions:** Requested → recorded start → completed; completion loss → uncertain+closed gate; repair recorded → gate may resume.
- **Recovery:** Operator repairs cause, Owner corrects limits, user investigates uncertain remote effect; no automatic effect retry.
- **Exit / reversal:** No individual audit editing; retention follows explicit audited policy; admitted remote work is not undone by later denial.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

### J-AUDITOR-CONFIG — Auditor: Inspect non-secret configuration

- **Promise/evidence:** AUTHZ-02, AUTHZ-04, UX-01, UX-02, UX-04, OPS-06.
- **Begins / entry:** Enrolled Auditor; current configuration available; EP-06.
- **Permissions / preconditions:** Authenticated Auditor read-only scope; no credential values, editing, assignments or execution.
- **Happy path:** 1. Search services and open permitted configuration (Readable current configuration and exception summaries) → 2. Inspect evidence and return (Attributable revision or role-scoped report).
- **Alternate paths:** Advanced values remain readable; no edit permission is inferred from visibility; Activity export uses J-AUDITOR-ACTIVITY.
- **Failure paths:** Attempted direct mutation, secret reveal, backup download or MCP execution denied even if URL known.
- **State transitions:** Service list → read-only detail → evidence → list; no active/draft state changed.
- **Recovery:** Adjust search or ask Owner for intended access; report observed exceptions using existing organizational process.
- **Exit / reversal:** Leave detail or logout; nothing to undo.

**Assessment:** Complete specification; implementation Not applicable at this stage; reachability Indeterminate; no gap.

## Action-to-surface mapping

The Journey column binds each shared action to the actor and permissions of that specific journey. A shared action never merges permissions. Alternate/failure/exit rows explicitly trace the non-happy paths; happy-step numbering matches the journey. Implementation is Unverified for every backend row.

| Action ID | Journey / Path / Step | Actor Action | UI or Entry Point | Backend/API | Permission Check | State Change | Feedback / Next State | Evidence / Gap |
|---|---|---|---|---|---|---|---|---|
| ACT-001 | J-HOST-01 / 1 | Configure Docker mounts, HTTPS reachability and trusted reverse proxy | EP-01 | Specified: Validate startup necessities and expose bounded health | Each linked journey’s current role/ownership/preconditions; shared audit gate | Uninitialized host → restricted setup | Setup availability; missing input diagnostics | J-HOST-01; no gap |
| ACT-002 | J-HOST-01 / 2 | Issue protected bootstrap proof | EP-01 | Specified: Bind one-time 30-minute proof to instance/setup | Each linked journey’s current role/ownership/preconditions; shared audit gate | No authority → restricted setup capability | Proof through protected host action, absent from general logs | J-HOST-01; no gap |
| ACT-003 | J-OWNER-01 / 1 | Enter instance name/origin and Owner password | EP-02 | Specified: Validate trusted origin and password rules | Each linked journey’s current role/ownership/preconditions; shared audit gate | Setup incomplete → validated setup values | Inline errors; non-secret entries retained | J-OWNER-01; no gap |
| ACT-004 | J-OWNER-01 / 2 | Enroll authenticator and save fresh recovery material | EP-02 | Specified: Confirm TOTP; persist protected factor/password/recovery verifiers | Each linked journey’s current role/ownership/preconditions; shared audit gate | Unenrolled → first enrolled Owner | Fresh QR/recovery values shown only in authorized step | J-OWNER-01; no gap |
| ACT-005 | J-OWNER-01 / 3 | Complete setup | EP-02 | Specified: Consume proof once and durably record activation | Each linked journey’s current role/ownership/preconditions; shared audit gate | Restricted setup → active Owner | Services entry and independently stored backup recovery material | J-OWNER-01; no gap |
| ACT-006 | J-OWNER-ENROLL, J-ADMIN-ENROLL, J-AUDITOR-ENROLL, J-MEMBER-ENROLL / 1 | Open invitation | EP-03 | Specified: Capture proof safely without consuming it | Each linked journey’s current role/ownership/preconditions; shared audit gate | Pending → pending | Enrollment instructions; no activation from preview | J-OWNER-ENROLL; no gap |
| ACT-007 | J-OWNER-ENROLL, J-ADMIN-ENROLL, J-AUDITOR-ENROLL, J-MEMBER-ENROLL / 2 | Choose password and enroll authenticator | EP-03 | Specified: Validate password/TOTP and proof; store only protected factors/verifiers | Each linked journey’s current role/ownership/preconditions; shared audit gate | Pending → enrollment prepared | Inline errors; fresh QR and recovery codes | J-OWNER-ENROLL; no gap |
| ACT-008 | J-OWNER-ENROLL, J-ADMIN-ENROLL, J-AUDITOR-ENROLL, J-MEMBER-ENROLL / 3 | Deliberately finish enrollment | EP-03 | Specified: Consume proof once and durably activate bound identity/role | Each linked journey’s current role/ownership/preconditions; shared audit gate | Pending → active Owner | Role-permitted console entry | J-OWNER-ENROLL; no gap |
| ACT-009 | J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT / 1 | Log in with password and TOTP | EP-04 | Specified: Verify credentials, replay/throttle state and audit availability | Each linked journey’s current role/ownership/preconditions; shared audit gate | Logged out → role-scoped session | Console or bounded failure message | J-OWNER-ACCOUNT; no gap |
| ACT-010 | J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT / 2 | Change own password or replace MFA | EP-04 | Specified: Verify existing password and factor/code; commit new verifiers/factor | Each linked journey’s current role/ownership/preconditions; shared audit gate | Old credentials/factor → replaced; existing sessions invalidated on password change/recovery | Fresh enrollment feedback; security notice if available | J-OWNER-ACCOUNT; no gap |
| ACT-011 | J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT / 3 | Revoke other sessions or log out locally | EP-04 | Specified: Revoke own remote sessions with audit; clear current session locally | Each linked journey’s current role/ownership/preconditions; shared audit gate | Authenticated → other sessions revoked or logged out | Session list updated or login entry | J-OWNER-ACCOUNT; no gap |
| ACT-012 | J-OWNER-PEOPLE / 1 | Invite a user with fixed role | EP-05 | Specified: Create bound invitation and deliver via configured channel | Each linked journey’s current role/ownership/preconditions; shared audit gate | No user → pending invitation | Pending/delivery status and manual link option | J-OWNER-PEOPLE; no gap |
| ACT-013 | J-OWNER-PEOPLE / 2 | Change role or transfer ownership | EP-05 | Specified: Recheck Owner authority and continuity | Each linked journey’s current role/ownership/preconditions; shared audit gate | Existing role → selected fixed role | Immediate current-role feedback | J-OWNER-PEOPLE; no gap |
| ACT-014 | J-OWNER-PEOPLE / 3 | Disable user or revoke their sessions/MCP grants | EP-05 | Specified: Invalidate current eligibility and selected access immediately | Each linked journey’s current role/ownership/preconditions; shared audit gate | Active → disabled or grants revoked | Success before later request admission; history retained | J-OWNER-PEOPLE; no gap |
| ACT-015 | J-OWNER-RECOVERY / 1 | Verify person and authorize recovery | EP-05 | Specified: Record channel category without identity documents; revoke target sessions/grants | Each linked journey’s current role/ownership/preconditions; shared audit gate | Active/locked-out → restricted recovery | Immediate restriction and single-use 30-minute enrollment link | J-OWNER-RECOVERY; no gap |
| ACT-016 | J-OWNER-RECOVERY / 2 | Deliver link manually or through SMTP | EP-05 | Specified: Deliver only bound proof; expose delivery result | Each linked journey’s current role/ownership/preconditions; shared audit gate | Restricted → awaiting enrollment | Safe delivery failure or pending status | J-OWNER-RECOVERY; no gap |
| ACT-017 | J-OWNER-RECOVERY / 3 | Review completion | EP-05 | Specified: Verify issuer and consume proof once; target enrolls fresh factor | Each linked journey’s current role/ownership/preconditions; shared audit gate | Restricted → freshly enrolled active account | Completion/security notice | J-OWNER-RECOVERY; no gap |
| ACT-018 | J-OWNER-CONFIG, J-ADMIN-CONFIG / 1 | Find service or start Add service | EP-06 | Specified: Search/filter and load permitted metadata or new draft | Each linked journey’s current role/ownership/preconditions; shared audit gate | Existing active config unchanged; new service Draft | Overview/Configuration/Access/Activity or five-step wizard | J-OWNER-CONFIG; no gap |
| ACT-019 | J-OWNER-CONFIG, J-ADMIN-CONFIG / 2 | Edit details, destinations, placement and scanning | EP-06 | Specified: Validate common/advanced fields in same draft | Each linked journey’s current role/ownership/preconditions; shared audit gate | Unsaved → saved unapplied draft | Effective summaries; exact/suffix/regex, TLS inheritance, multiple/no-auth placement and both catalogs retained | J-OWNER-CONFIG; no gap |
| ACT-020 | J-OWNER-CONFIG, J-ADMIN-CONFIG / 3 | Review differences and exceptions | EP-06 | Specified: Prepare sanitized scoped changes; check dependencies and proposed initial grants | Each linked journey’s current role/ownership/preconditions; shared audit gate | Draft → reviewed candidate | Affected services, exceptions and reconnect impact visible | J-OWNER-CONFIG; no gap |
| ACT-021 | J-OWNER-CONFIG, J-ADMIN-CONFIG / 4 | Apply explicitly | EP-06 | Specified: Recheck role/base/dependencies; activate atomically | Each linked journey’s current role/ownership/preconditions; shared audit gate | Old active revision → coherent new revision | Applied success; initial explicit grants may activate atomically | J-OWNER-CONFIG; no gap |
| ACT-022 | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL / 1 | Create or replace a credential value | EP-07 | Specified: Validate deliberately supplied canonical value and encrypt it | Each linked journey’s current role/ownership/preconditions; shared audit gate | Absent → available or version N → N+1 | Only label/placement/availability/version/time displayed | J-OWNER-CREDENTIAL; no gap |
| ACT-023 | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL / 2 | Confirm rotation | EP-07 | Specified: Commit explicit immediate value action and invalidate affected references | Each linked journey’s current role/ownership/preconditions; shared audit gate | Old affected references → revoked | Rotation result without saved-value reveal | J-OWNER-CREDENTIAL; no gap |
| ACT-024 | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL / 3 | Delete unreferenced credential | EP-07 | Specified: Check current dependencies then remove value | Each linked journey’s current role/ownership/preconditions; shared audit gate | Available unreferenced → deleted | Deleted or explicit dependency error | J-OWNER-CREDENTIAL; no gap |
| ACT-025 | J-OWNER-ACCESS, J-ADMIN-ACCESS / 1 | Grant or remove service assignment | EP-08 | Specified: Check current target eligibility and immediately update assignment | Each linked journey’s current role/ownership/preconditions; shared audit gate | Unassigned ↔ assigned; removal blocks later dispatch | Current access list and action result | J-OWNER-ACCESS; no gap |
| ACT-026 | J-OWNER-ACCESS, J-ADMIN-ACCESS / 2 | Disable or archive service | EP-08 | Specified: Immediately block admission and revoke affected references | Each linked journey’s current role/ownership/preconditions; shared audit gate | Active → Disabled/Archived | Status and preserved audit/history | J-OWNER-ACCESS; no gap |
| ACT-027 | J-OWNER-ACCESS, J-ADMIN-ACCESS / 3 | Restore archived service and review enablement | EP-08 | Specified: Unarchive to Disabled; validate current configuration/dependencies before explicit enable | Each linked journey’s current role/ownership/preconditions; shared audit gate | Archived → Disabled → reviewed Active | Review then activation result | J-OWNER-ACCESS; no gap |
| ACT-028 | J-OWNER-POLICY, J-ADMIN-POLICY / 1 | Edit path/method/host rules | EP-09 | Specified: Use exact/prefix/regex editor with stable priority semantics | Each linked journey’s current role/ownership/preconditions; shared audit gate | Policy draft updated; active policy unchanged | Effective order and default mode visible | J-OWNER-POLICY; no gap |
| ACT-029 | J-OWNER-POLICY, J-ADMIN-POLICY / 2 | Run safe policy preview | EP-09 | Specified: Canonicalize target and evaluate access/rules/protection without substitution or I/O | Each linked journey’s current role/ownership/preconditions; shared audit gate | No runtime execution or references created | Eligibility, canonical target, matching rule and reason | J-OWNER-POLICY; no gap |
| ACT-030 | J-OWNER-POLICY, J-ADMIN-POLICY / 3 | Review and apply policy | EP-09 | Specified: Use scoped draft activation with exception acknowledgement | Each linked journey’s current role/ownership/preconditions; shared audit gate | Reviewed draft → active policy | Applied or field/conflict error | J-OWNER-POLICY; no gap |
| ACT-031 | J-OWNER-HISTORY, J-ADMIN-HISTORY / 1 | Import files or choose earlier revision | EP-10 | Specified: Parse supported fields or project permitted sanitized history into fresh draft | Each linked journey’s current role/ownership/preconditions; shared audit gate | Legacy/history → unapplied scoped draft | Unknown fields, missing credentials/identities and impact listed | J-OWNER-HISTORY; no gap |
| ACT-032 | J-OWNER-HISTORY, J-ADMIN-HISTORY / 2 | Resolve credentials and explicit identities | EP-10 | Specified: Write-only credential resolution and current-authorized mapping | Each linked journey’s current role/ownership/preconditions; shared audit gate | Unresolved draft → valid candidate | Missing values keep service inactive | J-OWNER-HISTORY; no gap |
| ACT-033 | J-OWNER-HISTORY, J-ADMIN-HISTORY / 3 | Review/apply or export sanitized configuration | EP-10 | Specified: Apply scoped validated changes or create non-secret export | Each linked journey’s current role/ownership/preconditions; shared audit gate | Managed active source or secret-free artifact | No routine restart; reconnect notice when identity/endpoint changes | J-OWNER-HISTORY; no gap |
| ACT-034 | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY / 1 | Filter and inspect activity | EP-11 | Specified: Apply server-enforced actor/service/time/action/result/request filters | Each linked journey’s current role/ownership/preconditions; shared audit gate | Read-only result set | Event detail and attributable revision; empty-state feedback | J-OWNER-ACTIVITY; no gap |
| ACT-035 | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY / 2 | Investigate denial or uncertain request | EP-11 | Specified: Return owned/permitted safe denial reason or durable-start uncertainty | Each linked journey’s current role/ownership/preconditions; shared audit gate | No remote action retried | Safe next step and provenance | J-OWNER-ACTIVITY; no gap |
| ACT-036 | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY / 3 | Export selected evidence/report | EP-11 | Specified: Authorize/sanitize export and record event | Each linked journey’s current role/ownership/preconditions; shared audit gate | Export artifact; source events unchanged | Download with access/config/exception/version/backup evidence | J-OWNER-ACTIVITY; no gap |
| ACT-037 | J-MEMBER-ACTIVITY / 1 | Filter and inspect activity | EP-11 | Specified: Apply server-enforced actor/service/time/action/result/request filters | Each linked journey’s current role/ownership/preconditions; shared audit gate | Read-only result set | Event detail and attributable revision; empty-state feedback | J-MEMBER-ACTIVITY; no gap |
| ACT-038 | J-MEMBER-ACTIVITY / 2 | Investigate denial or uncertain request | EP-11 | Specified: Return owned/permitted safe denial reason or durable-start uncertainty | Each linked journey’s current role/ownership/preconditions; shared audit gate | No remote action retried | Safe next step and provenance | J-MEMBER-ACTIVITY; no gap |
| ACT-039 | J-MEMBER-ACTIVITY / 3 | Return to activity | EP-11 | Specified: Retain own scope | Each linked journey’s current role/ownership/preconditions; shared audit gate | No mutation | Own scoped results | J-MEMBER-ACTIVITY; no gap |
| ACT-040 | J-OWNER-SETTINGS / 1 | Edit advanced instance settings | EP-12 | Specified: Validate SMTP, auth/client/scope/lifetime and every existing capacity setting into draft | Each linked journey’s current role/ownership/preconditions; shared audit gate | Active settings unchanged; candidate draft | Units/defaults/current use and capacity effect | J-OWNER-SETTINGS; no gap |
| ACT-041 | J-OWNER-SETTINGS / 2 | Review and apply settings | EP-12 | Specified: Check scope/base/constraints and retention deletion impact | Each linked journey’s current role/ownership/preconditions; shared audit gate | Prior settings → coherent active settings | Applied; reconnect warnings or errors | J-OWNER-SETTINGS; no gap |
| ACT-042 | J-OWNER-SETTINGS / 3 | Test SMTP and inspect status | EP-12 | Specified: Attempt bounded test delivery and report sanitized result | Each linked journey’s current role/ownership/preconditions; shared audit gate | Delivery attempted; no invitation activation | Test success/failure; optional manual workflow remains | J-OWNER-SETTINGS; no gap |
| ACT-043 | J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT / 1 | Use the client-specific setup instructions | EP-13 | Specified: Provide separate origin and full /mcp URL without secrets | Each linked journey’s current role/ownership/preconditions; shared audit gate | Client unconnected → authorization request | Reachability and exact URL instructions | J-OWNER-CLIENT; no gap |
| ACT-044 | J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT / 2 | Authenticate and consent | EP-13 | Specified: Validate MFA, allowed client/scopes/PKCE and secure metadata retrieval | Each linked journey’s current role/ownership/preconditions; shared audit gate | No grant → bound OAuth grant | Authorized client; service access still separately checked | J-OWNER-CLIENT; no gap |
| ACT-045 | J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT / 3 | Inspect or revoke connected client | EP-13 | Specified: Recheck current identity and durably revoke grant | Each linked journey’s current role/ownership/preconditions; shared audit gate | Granted → revoked | Client list updated; later calls denied | J-OWNER-CLIENT; no gap |
| ACT-046 | J-EXTERNAL-01 / 1 | Acquire external authorization through issuer | EP-14 | Specified: Use existing external issuer contract | Each linked journey’s current role/ownership/preconditions; shared audit gate | No token → external token | External provider result; outside console account enrollment | J-EXTERNAL-01; no gap |
| ACT-047 | J-EXTERNAL-01 / 2 | Call authenticated MCP endpoint | EP-14 | Specified: Validate each POST and explicit subject registration/assignment | Each linked journey’s current role/ownership/preconditions; shared audit gate | Eligible → tool admission or denial | Same five generic tools | J-EXTERNAL-01; no gap |
| ACT-048 | J-EXTERNAL-01 / 3 | Respond to revocation | EP-14 | Specified: Reevaluate current service/identity authority each request | Each linked journey’s current role/ownership/preconditions; shared audit gate | Removed assignment → denied | Reauthorize or request Owner registration review | J-EXTERNAL-01; no gap |
| ACT-049 | J-LEGACY-01 / 1 | Invoke MCP using configured legacy credential | EP-14 | Specified: Validate mode, credential and eligible assignment | Each linked journey’s current role/ownership/preconditions; shared audit gate | Authenticated shared identity → tool admission | Shared-attribution notice and normal tool response | J-LEGACY-01; no gap |
| ACT-050 | J-LEGACY-01 / 2 | Respond to rotation/revocation or restore | EP-14 | Specified: Reject old credential/reference at subsequent admission | Each linked journey’s current role/ownership/preconditions; shared audit gate | Old authority → denied | Requires explicit Owner reactivation/new credential | J-LEGACY-01; no gap |
| ACT-051 | J-MCP-01 / 1 | Discover services and describe policy | EP-15 | Specified: list_services / describe_service_policy return permitted metadata | Each linked journey’s current role/ownership/preconditions; shared audit gate | Read-only discovery | Accessible services, destinations and effective policy | J-MCP-01; no gap |
| ACT-052 | J-MCP-01 / 2 | Obtain service references | EP-15 | Specified: get_gateway_service_references issues ephemeral subject/service-bound handles | Each linked journey’s current role/ownership/preconditions; shared audit gate | No references → current bound references | Opaque placement references without credential reveal | J-MCP-01; no gap |
| ACT-053 | J-MCP-01 / 3 | Submit service request | EP-15 | Specified: service_request validates then records start, substitutes, sends and protects response | Each linked journey’s current role/ownership/preconditions; shared audit gate | Admitted coherent revision → completion or uncertainty | Protected structured/Base64/binary result or safe error | J-MCP-01; no gap |
| ACT-054 | J-MCP-01 / 4 | Explain denied request | EP-15 | Specified: explain_denial checks ownership and expiry | Each linked journey’s current role/ownership/preconditions; shared audit gate | Denial unchanged; no downstream retry | Bound safe reason and next action | J-MCP-01; no gap |
| ACT-055 | J-MCP-RESTART / 1 | Reconnect or refresh after restart | EP-15 | Specified: Reload managed config/signing/hash-only refresh state; validate token | Each linked journey’s current role/ownership/preconditions; shared audit gate | Transport lost → authenticated request | Normal OAuth continuation when grant valid | J-MCP-RESTART; no gap |
| ACT-056 | J-MCP-RESTART / 2 | Reacquire references and continue | EP-15 | Specified: Reject stale ephemeral references; issue current bound references | Each linked journey’s current role/ownership/preconditions; shared audit gate | Old handles unavailable → new handles | Usable requests under current configuration | J-MCP-RESTART; no gap |
| ACT-057 | J-OWNER-BACKUP / 1 | Start backup or configure daily schedule | EP-16 | Specified: Validate mount/capacity and capture one consistent recovery point | Each linked journey’s current role/ownership/preconditions; shared audit gate | Idle → running job or saved schedule | Progress and included/excluded scope | J-OWNER-BACKUP; no gap |
| ACT-058 | J-OWNER-BACKUP / 2 | Inspect completed backup and download | EP-16 | Specified: Publish only complete integrity-checked encrypted archive; authorize download | Each linked journey’s current role/ownership/preconditions; shared audit gate | Running → succeeded/failed; success → encrypted file | Recovery/completion times, size, version and audit extent | J-OWNER-BACKUP; no gap |
| ACT-059 | J-OWNER-BACKUP / 3 | Copy archive off-host using operator process | EP-16 | Specified: Product supplies encrypted artifact; transfer outside console | Each linked journey’s current role/ownership/preconditions; shared audit gate | Off-host copy is operator-managed | Documentation of independent recovery material requirement | J-OWNER-BACKUP; no gap |
| ACT-060 | J-SYSTEM-BACKUP / 1 | Trigger scheduled backup | EP-17 | Specified: Create same consistent encrypted recovery point as manual path | Each linked journey’s current role/ownership/preconditions; shared audit gate | Due → running → success/failure | Backup status; optional failure email | J-SYSTEM-BACKUP; no gap |
| ACT-061 | J-SYSTEM-BACKUP / 2 | Apply retention to eligible archives/audit evidence | EP-17 | Specified: Use explicit effective retention and record deletion | Each linked journey’s current role/ownership/preconditions; shared audit gate | Expired retained data → removed with evidence | Retention outcome visible; no silent emergency shortening | J-SYSTEM-BACKUP; no gap |
| ACT-062 | J-OWNER-RESTORE / 1 | Upload archive and preview restore | EP-18 | Specified: Validate key/integrity/format/entries/storage and recoverable Owner | Each linked journey’s current role/ownership/preconditions; shared audit gate | Active instance unchanged; preview authorized | Scope, archive time, lost access, initiator and nominated Owner | J-OWNER-RESTORE; no gap |
| ACT-063 | J-OWNER-RESTORE / 2 | Confirm replacement | EP-18 | Specified: Bind continuation; enter maintenance, drain finite work, validate pre-backup/local rollback source | Each linked journey’s current role/ownership/preconditions; shared audit gate | Active → maintenance | Progress; sensitive admission paused | J-OWNER-RESTORE; no gap |
| ACT-064 | J-OWNER-RESTORE / 3 | Complete installation | EP-18 | Specified: Atomically install recovered state and retain independent audit sequence | Each linked journey’s current role/ownership/preconditions; shared audit gate | Maintenance → restricted restored instance | Recovery enrollment entry; provenance retained | J-OWNER-RESTORE; no gap |
| ACT-065 | J-HOST-RESTORE / 1 | Issue restore proof and supply archive/key | EP-01 | Specified: Authorize restricted clean-host restore and validate full archive | Each linked journey’s current role/ownership/preconditions; shared audit gate | Uninitialized → validated restore preview | Owner nomination and deployment prerequisites | J-HOST-RESTORE; no gap |
| ACT-066 | J-HOST-RESTORE / 2 | Install verified archive | EP-01 | Specified: Stage/install atomically under maintenance restrictions | Each linked journey’s current role/ownership/preconditions; shared audit gate | Uninitialized/restricted → installed recovery | Restricted continuation for nominated archived Owner; audit gap identified | J-HOST-RESTORE; no gap |
| ACT-067 | J-OWNER-RESUME / 1 | Set fresh recovery Owner password and MFA | EP-19 | Specified: Validate continuation and complete restricted fresh enrollment | Each linked journey’s current role/ownership/preconditions; shared audit gate | Installed recovery → enrolled recovery Owner | Management review only; fresh recovery codes | J-OWNER-RESUME; no gap |
| ACT-068 | J-OWNER-RESUME / 2 | Review restored users and authorize reenrollment | EP-19 | Specified: Issue fresh bound enrollment only after explicit review | Each linked journey’s current role/ownership/preconditions; shared audit gate | Restored pending user → enrollment authorized → active after fresh MFA | Pending/active identities and still-disabled services | J-OWNER-RESUME; no gap |
| ACT-069 | J-OWNER-RESUME / 3 | Review service credentials/policy and explicitly enable | EP-19 | Specified: Validate current dependencies and identity grants; explicitly reactivate external/legacy modes when wanted | Each linked journey’s current role/ownership/preconditions; shared audit gate | Disabled service → reviewed Active | Clients must reconnect; old tokens/links/references remain invalid | J-OWNER-RESUME; no gap |
| ACT-070 | J-HOST-RECOVERY / 1 | Diagnose and repair storage/process conditions | EP-20 | Specified: Restore mount/permissions/capacity; verify durable audit append | Each linked journey’s current role/ownership/preconditions; shared audit gate | Audit unavailable → verified writable | Bounded health and known/unknown outage interval | J-HOST-RECOVERY; no gap |
| ACT-071 | J-HOST-RECOVERY / 2 | Record recovery and resume admission safely | EP-20 | Specified: Commit outage/recovery record before sensitive work; never retry remote effects | Each linked journey’s current role/ownership/preconditions; shared audit gate | Degraded → healthy gate | Fresh normal authentication required for diagnostic users | J-HOST-RECOVERY; no gap |
| ACT-072 | J-HOST-RECOVERY / 3 | Authorize selected Owner reenrollment if needed | EP-20 | Specified: Issue protected bound host recovery capability and record break-glass event | Each linked journey’s current role/ownership/preconditions; shared audit gate | Owner locked/recovery interrupted → restricted enrollment | Fresh password/MFA path; no ordinary access before completion | J-HOST-RECOVERY; no gap |
| ACT-073 | J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG / 1 | Read permitted status/activity | EP-21 | Specified: Enforce role on non-secret reads; bounded best-effort diagnostic-login evidence | Each linked journey’s current role/ownership/preconditions; shared audit gate | Existing/restricted session → read-only | Degraded cause and operator repair instruction | J-OWNER-DIAG; no gap |
| ACT-074 | J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG / 2 | Attempt normal sensitive work or wait for repair | EP-21 | Specified: Reject before mutation/issuance/dispatch until verified audit resumes | Each linked journey’s current role/ownership/preconditions; shared audit gate | No sensitive state change | Explicit unavailable reason | J-OWNER-DIAG; no gap |
| ACT-075 | J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG / 3 | Log out or reauthenticate after repair | EP-21 | Specified: Clear local session; require fresh normal login for restricted session | Each linked journey’s current role/ownership/preconditions; shared audit gate | Diagnostic → logged out → freshly authenticated | Normal role scope only after valid new authentication | J-OWNER-DIAG; no gap |
| ACT-076 | J-PUBLIC-01 / 1 | Open public health or login entry | EP-22 | Specified: Return bounded non-secret availability and authentication entry | Each linked journey’s current role/ownership/preconditions; shared audit gate | No privileged state created | Healthy/degraded or login; authorized links route to bound flow | J-PUBLIC-01; no gap |
| ACT-077 | J-SYSTEM-ADMISSION / 1 | Admit or reject bounded operation | EP-23 | Specified: Recheck current policy/access/limits and durably record start before sensitive effect | Each linked journey’s current role/ownership/preconditions; shared audit gate | Requested → admitted or safely denied | Bounded result/limit reason | J-SYSTEM-ADMISSION; no gap |
| ACT-078 | J-SYSTEM-ADMISSION / 2 | Record completion or uncertain outcome | EP-23 | Specified: Append sanitized result; fail-close future work if append unavailable | Each linked journey’s current role/ownership/preconditions; shared audit gate | Started → completed or uncertain | Activity and degraded status with request/revision | J-SYSTEM-ADMISSION; no gap |
| ACT-079 | J-SYSTEM-ADMISSION / 3 | Expose health and usage | EP-23 | Specified: Report role-appropriate storage/scanner/mail/backup/capacity state | Each linked journey’s current role/ownership/preconditions; shared audit gate | Read-only status | Actionable cause; optional security/failure notifications | J-SYSTEM-ADMISSION; no gap |
| ACT-080 | J-AUDITOR-CONFIG / 1 | Search services and open permitted configuration | EP-06 | Specified: Read sanitized details, effective destinations/policy/scanning and access | Each linked journey’s current role/ownership/preconditions; shared audit gate | No mutation | Readable current configuration and exception summaries | J-AUDITOR-CONFIG; no gap |
| ACT-081 | J-AUDITOR-CONFIG / 2 | Inspect evidence and return | EP-06 | Specified: Link current configuration to authorized activity/report | Each linked journey’s current role/ownership/preconditions; shared audit gate | No mutation | Attributable revision or role-scoped report | J-AUDITOR-CONFIG; no gap |
| ACT-082 | Every journey (with its own permissions and stated path) / alternate | Choose documented alternate path | Invoking journey entry point | Specified: validate alternative under same current-authority and audit contract | Each linked journey’s current role/ownership/preconditions; shared audit gate | Only the alternate transition explicitly specified in the invoking journey | Journey alternate outcome; no extra privilege | Each journey and normative references; no gap |
| ACT-083 | Every journey (with its own permissions and stated path) / failure | Correct rejected input or repair prerequisite and retry | Invoking journey entry point | Specified: reject invalid operation before sensitive effect; expose safe error/recovery; restore-specific rollback only as defined | Each linked journey’s current role/ownership/preconditions; shared audit gate | No invalid sensitive transition; restore rollback follows STATE-05 | Safe reason and recovery action specified in the invoking journey | Each journey and normative references; no gap |
| ACT-084 | Every journey (with its own permissions and stated path) / exit | Abandon pending action or use authorized reversal | Invoking journey entry point | Specified: no unconfirmed mutation; completed actions reverse only through the stated authorized lifecycle | Each linked journey’s current role/ownership/preconditions; shared audit gate | Unconfirmed action has no effect; completed state changes only through stated reversal | Journey terminal/reversal state | Each journey and normative references; no gap |


## Lifecycle completeness

| Lifecycle Area | Actor | Required Flow | Entry Point | Success / Terminal State | Failure / Recovery | Status | Evidence / Gap |
|---|---|---|---|---|---|---|---|
| Deployment/bootstrap | Host operator; Owner | J-HOST-01; J-OWNER-01 | EP-01–02 | First enrolled Owner | Expired proof/startup failure → protected reissue/repair | Complete | IDENT-01; SECRES-02 |
| Onboarding/role assignment | All four local roles; Owner | J-*-ENROLL; J-OWNER-PEOPLE | EP-03, EP-05 | Predetermined role after MFA | Invalid link → reissue; delivery failure → manual channel | Complete | IDENT-02–04 |
| Login/expiry/logout | All four local roles | J-*-ACCOUNT | EP-04 | Session or logged out | Invalid factors/throttle → safe retry/recovery | Complete | IDENT-05–06; SECRES-03/04 |
| Recovery/offboarding | Owner/host and target identity | J-OWNER-RECOVERY; J-HOST-RECOVERY; J-OWNER-PEOPLE | EP-05, EP-20 | Restricted reenrollment or disabled user | Last Owner protected; audit repair precedes mutation | Complete | AUTHZ-03; IDENT-05 |
| Configuration/retry/undo | Owner; Administrator | J-*-CONFIG/POLICY/HISTORY | EP-06, EP-09–10 | Applied coherent revision | Inline correction/stale compare; history creates new permitted draft | Complete | CONFIG-03–04; STATE-01–03 |
| Credential deletion | Owner; Administrator | J-*-CREDENTIAL | EP-07 | Dependency-free deletion; no historic value revival | Referenced delete fails; resolve dependencies first | Complete | CONFIG-02; STATE-03 |
| Service archive/restore | Owner; Administrator | J-*-ACCESS | EP-08 | Archived → Disabled → reviewed Active | Invalid dependency prevents enable; explicit grant required | Complete | CONFIG-05 |
| Integration consent/revocation | Eligible roles; external/legacy identity; MCP client | J-*-CLIENT; J-EXTERNAL-01; J-LEGACY-01; J-MCP-* | EP-13–15 | Granted/revoked; request complete/denied | Correct URL, scope, identity, reference or client setup | Complete | MCP-01–04; BASE-01 |
| Evidence export/retention | Evidence roles; automation | J-*-ACTIVITY; J-SYSTEM-BACKUP | EP-11, EP-17 | Sanitized evidence or audited expiry | Audit outage stops exports/deletion; scoped viewing survives | Complete | AUDIT-01–04; OPS-04/06 |
| Backup/restore | Owner; host; automation | J-OWNER-BACKUP/RESTORE/RESUME; J-HOST-RESTORE | EP-16–19 | Consistent archive; restricted recovered state then review | Validation rejection; install rollback/host repair; reenrollment | Complete | BACKUP-01–06; STATE-04–06 |
| Outage diagnosis | Every role; host | J-*-DIAG; J-HOST-RECOVERY | EP-20–23 | Durable repair then fresh normal authentication | No web bypass; failed safety state leaves host diagnosis | Complete | AUDIT-04; SECRES-04 |
| Tenant/account purge | Not a promised role/capability | N/A: single organization; disable/archive are intended exits | N/A: no tenant UI | N/A: no tenant lifecycle promised | No invented permanent-user/tenant purge workflow | N/A: explicitly excluded or unpromised | D-001; AUTHZ-03; CONFIG-05 |
| Background cancellation | Owner/operator | Job status and safe bounded completion, not arbitrary cancel | EP-16–18 | Completed/failed job; preview can be abandoned | Restore crash recovers coherent state; no claim of remote undo | Complete at stated scope | BACKUP-02–04; STATE-04–05 |


## Interface and reachability mismatches

### Unreachable capabilities

None found at specification level. Runtime reachability is Indeterminate for all journeys because this is future-product definition, not runtime verification.

### Backend capabilities without user-facing interfaces

None found at specification level. Management capabilities have console ingress; MCP tools have authenticated documented client ingress; scheduled jobs have configured triggers/status; host repair intentionally uses protected operator ingress. Exact visual control positions and management API routes remain UX/architecture design work.

### Interfaces without supporting backend behavior

None found at specification level. Services, People & Access, Activity and Settings each map to specified responsibilities, authorization, state and outcomes. No speculative dashboard or orphan navigation is added.

### Orphaned behavior

Not evaluated in implementation: source/runtime inspection is out of scope. No normative unowned behavior found. Dependencies such as SMTP and downstream responses belong to their invoking journeys.

## Coverage matrix

Each row represents one actor-specific behavior bundle; the Capability cell enumerates every requirement family it covers. Related sequential operations remain grouped when they have one permission/entry/lifecycle contract; materially different Owner, Administrator, Auditor, Member, external, legacy, host and system paths are separate. This is the audit’s initial eight-surface matrix, not a copy of the upstream coverage artifact.

| Capability | User Role | UI or Entry Point | Backend/API | Data/State | Authorization | Error States | Tests |
|---|---|---|---|---|---|---|---|
| J-HOST-01 — Deploy and authorize initial setup; IDENT-01, OPS-05, SECRES-02, CAP-ACCEPT-01 | Specified: Host operator | Specified: EP-01 | Specified: action chain in J-HOST-01 and linked ACT rows. Unverified: implementation. | Specified: Uninitialized → host proof → setup-authorized. Full transitions: J-HOST-01 | Specified: Host-local authority; no public claim endpoint | Specified: J-HOST-01 failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Protected bootstrap succeeds; public claim, reused proof and untrusted forwarded header fail. Unverified: execution. |
| J-OWNER-01 — Establish first Owner; IDENT-01, IDENT-02, SEC-01, BACKUP-02, SECRES-01, SECRES-02 | Specified: Owner | Specified: EP-02 | Specified: action chain in J-OWNER-01 and linked ACT rows. Unverified: implementation. | Specified: Uninitialized → verified enrollment → active. Full transitions: J-OWNER-01 | Specified: Bound setup proof; confirmed password/TOTP; durable audit | Specified: J-OWNER-01 failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: First Owner success; MFA bypass, replay and audit failure fail closed. Unverified: execution. |
| J-OWNER-ENROLL — Accept role-bound invitation; IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Specified: Owner | Specified: EP-03 | Specified: action chain in J-OWNER-ENROLL and linked ACT rows. Unverified: implementation. | Specified: Pending → confirmed enrollment → active. Full transitions: J-OWNER-ENROLL | Specified: Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA | Specified: J-OWNER-ENROLL failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Owner enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives. Unverified: execution. |
| J-OWNER-ACCOUNT — Authenticate and manage own security; IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Specified: Owner | Specified: EP-04 | Specified: action chain in J-OWNER-ACCOUNT and linked ACT rows. Unverified: implementation. | Specified: Logged out → valid two factors → active. Full transitions: J-OWNER-ACCOUNT | Specified: Own identity; password plus valid factor/code for replacement; current session alone insufficient | Specified: J-OWNER-ACCOUNT failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Owner normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail. Unverified: execution. |
| J-ADMIN-ENROLL — Accept role-bound invitation; IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Specified: Administrator | Specified: EP-03 | Specified: action chain in J-ADMIN-ENROLL and linked ACT rows. Unverified: implementation. | Specified: Pending → confirmed enrollment → active. Full transitions: J-ADMIN-ENROLL | Specified: Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA | Specified: J-ADMIN-ENROLL failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Administrator enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives. Unverified: execution. |
| J-ADMIN-ACCOUNT — Authenticate and manage own security; IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Specified: Administrator | Specified: EP-04 | Specified: action chain in J-ADMIN-ACCOUNT and linked ACT rows. Unverified: implementation. | Specified: Logged out → valid two factors → active. Full transitions: J-ADMIN-ACCOUNT | Specified: Own identity; password plus valid factor/code for replacement; current session alone insufficient | Specified: J-ADMIN-ACCOUNT failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Administrator normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail. Unverified: execution. |
| J-AUDITOR-ENROLL — Accept role-bound invitation; IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Specified: Auditor | Specified: EP-03 | Specified: action chain in J-AUDITOR-ENROLL and linked ACT rows. Unverified: implementation. | Specified: Pending → confirmed enrollment → active. Full transitions: J-AUDITOR-ENROLL | Specified: Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA | Specified: J-AUDITOR-ENROLL failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Auditor enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives. Unverified: execution. |
| J-AUDITOR-ACCOUNT — Authenticate and manage own security; IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Specified: Auditor | Specified: EP-04 | Specified: action chain in J-AUDITOR-ACCOUNT and linked ACT rows. Unverified: implementation. | Specified: Logged out → valid two factors → active. Full transitions: J-AUDITOR-ACCOUNT | Specified: Own identity; password plus valid factor/code for replacement; current session alone insufficient | Specified: J-AUDITOR-ACCOUNT failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Auditor normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail. Unverified: execution. |
| J-MEMBER-ENROLL — Accept role-bound invitation; IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Specified: Member | Specified: EP-03 | Specified: action chain in J-MEMBER-ENROLL and linked ACT rows. Unverified: implementation. | Specified: Pending → confirmed enrollment → active. Full transitions: J-MEMBER-ENROLL | Specified: Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA | Specified: J-MEMBER-ENROLL failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Member enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives. Unverified: execution. |
| J-MEMBER-ACCOUNT — Authenticate and manage own security; IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Specified: Member | Specified: EP-04 | Specified: action chain in J-MEMBER-ACCOUNT and linked ACT rows. Unverified: implementation. | Specified: Logged out → valid two factors → active. Full transitions: J-MEMBER-ACCOUNT | Specified: Own identity; password plus valid factor/code for replacement; current session alone insufficient | Specified: J-MEMBER-ACCOUNT failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Member normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail. Unverified: execution. |
| J-OWNER-PEOPLE — Invite, grant roles, transfer ownership and disable users; AUTHZ-02, AUTHZ-03, IDENT-03, IDENT-06, SEC-03, STATE-01, STATE-02 | Specified: Owner | Specified: EP-05 | Specified: action chain in J-OWNER-PEOPLE and linked ACT rows. Unverified: implementation. | Specified: Pending → revoke/reissue → cancelled/new proof. Full transitions: J-OWNER-PEOPLE | Specified: Current Owner; recent authentication for ownership change; audit; final active Owner protected | Specified: J-OWNER-PEOPLE failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Every fixed-role permission cell; one-minute disable target; last Owner and demotion/admission races rejected. Unverified: execution. |
| J-OWNER-RECOVERY — Authorize verified account recovery; IDENT-05, IDENT-06, AUTHZ-03, SECRES-01, SECRES-03 | Specified: Owner | Specified: EP-05 | Specified: action chain in J-OWNER-RECOVERY and linked ACT rows. Unverified: implementation. | Specified: Authorized recovery → sessions/grants invalid and account restricted. Full transitions: J-OWNER-RECOVERY | Specified: Recent Owner password/TOTP plus trusted-channel identity verification; recheck issuer at activation | Specified: J-OWNER-RECOVERY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Verified manual/SMTP recovery success; invalid issuer, concurrent consumption and password-reset-only MFA removal fail. Unverified: execution. |
| J-OWNER-CONFIG — Configure and apply service and scanner settings; BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02 | Specified: Owner | Specified: EP-06 | Specified: action chain in J-OWNER-CONFIG and linked ACT rows. Unverified: implementation. | Specified: Draft → review → applied. Full transitions: J-OWNER-CONFIG | Specified: Current per-setting configuration permission; audit; no implicit MCP grant; Owner instance settings allowed only when explicitly included | Specified: J-OWNER-CONFIG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All existing configuration fields round-trip; invalid input, stale apply and mixed-owner-setting negatives; keyboard/narrow screens; first simple service within 15 minutes. Unverified: execution. |
| J-OWNER-CREDENTIAL — Create, rotate and delete managed credentials; CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03 | Specified: Owner | Specified: EP-07 | Specified: action chain in J-OWNER-CREDENTIAL and linked ACT rows. Unverified: implementation. | Specified: Creation/rotation/deletion immediately changes managed value state. Full transitions: J-OWNER-CREDENTIAL | Specified: Current configuration role; healthy audit; deletion dependencies resolved | Specified: J-OWNER-CREDENTIAL failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Write-only creation/rotation and dependency-safe deletion; canary leaks, arbitrary host reads and old-reference use fail. Unverified: execution. |
| J-OWNER-ACCESS — Assign service access and control service lifecycle; AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03 | Specified: Owner | Specified: EP-08 | Specified: action chain in J-OWNER-ACCESS and linked ACT rows. Unverified: implementation. | Specified: Grant/remove immediate. Full transitions: J-OWNER-ACCESS | Specified: Current configuration role; target eligible; durable audit; Administrator cannot create users/change role | Specified: J-OWNER-ACCESS failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Grant/remove/disable/archive/unarchive success; Auditor/unassigned admin and queued stale requests denied; completed request cannot revive references. Unverified: execution. |
| J-OWNER-POLICY — Inspect, edit and safely test policy; POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05 | Specified: Owner | Specified: EP-09 | Specified: action chain in J-OWNER-POLICY and linked ACT rows. Unverified: implementation. | Specified: Draft → preview result → review → applied. Full transitions: J-OWNER-POLICY | Specified: Current configuration role; policy tester uses permitted configuration and identity metadata | Specified: J-OWNER-POLICY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Preview/runtime agreement including ties/defaults/canonical path; malformed inputs and zero substitution/I/O checks; self-signed TLS test in runtime regression. Unverified: execution. |
| J-OWNER-HISTORY — Import, export and restore permitted configuration; MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03 | Specified: Owner | Specified: EP-10 | Specified: action chain in J-OWNER-HISTORY and linked ACT rows. Unverified: implementation. | Specified: Import/history → fresh draft → applied. Full transitions: J-OWNER-HISTORY | Specified: Current permissions for every imported/history setting; deliberate credential sources; no email-only identity grant | Specified: J-OWNER-HISTORY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All legacy fields and catalogs preserved; missing/unknown inputs fail; history cannot restore secrets/access or Owner-only settings; no stale-env override. Unverified: execution. |
| J-ADMIN-CONFIG — Configure and apply service and scanner settings; BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02 | Specified: Administrator | Specified: EP-06 | Specified: action chain in J-ADMIN-CONFIG and linked ACT rows. Unverified: implementation. | Specified: Draft → review → applied. Full transitions: J-ADMIN-CONFIG | Specified: Current per-setting configuration permission; audit; no implicit MCP grant; Owner-only settings excluded | Specified: J-ADMIN-CONFIG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All existing configuration fields round-trip; invalid input, stale apply and mixed-owner-setting negatives; keyboard/narrow screens; first simple service within 15 minutes. Unverified: execution. |
| J-ADMIN-CREDENTIAL — Create, rotate and delete managed credentials; CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03 | Specified: Administrator | Specified: EP-07 | Specified: action chain in J-ADMIN-CREDENTIAL and linked ACT rows. Unverified: implementation. | Specified: Creation/rotation/deletion immediately changes managed value state. Full transitions: J-ADMIN-CREDENTIAL | Specified: Current configuration role; healthy audit; deletion dependencies resolved | Specified: J-ADMIN-CREDENTIAL failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Write-only creation/rotation and dependency-safe deletion; canary leaks, arbitrary host reads and old-reference use fail. Unverified: execution. |
| J-ADMIN-ACCESS — Assign service access and control service lifecycle; AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03 | Specified: Administrator | Specified: EP-08 | Specified: action chain in J-ADMIN-ACCESS and linked ACT rows. Unverified: implementation. | Specified: Grant/remove immediate. Full transitions: J-ADMIN-ACCESS | Specified: Current configuration role; target eligible; durable audit; Administrator cannot create users/change role | Specified: J-ADMIN-ACCESS failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Grant/remove/disable/archive/unarchive success; Auditor/unassigned admin and queued stale requests denied; completed request cannot revive references. Unverified: execution. |
| J-ADMIN-POLICY — Inspect, edit and safely test policy; POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05 | Specified: Administrator | Specified: EP-09 | Specified: action chain in J-ADMIN-POLICY and linked ACT rows. Unverified: implementation. | Specified: Draft → preview result → review → applied. Full transitions: J-ADMIN-POLICY | Specified: Current configuration role; policy tester uses permitted configuration and identity metadata | Specified: J-ADMIN-POLICY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Preview/runtime agreement including ties/defaults/canonical path; malformed inputs and zero substitution/I/O checks; self-signed TLS test in runtime regression. Unverified: execution. |
| J-ADMIN-HISTORY — Import, export and restore permitted configuration; MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03 | Specified: Administrator | Specified: EP-10 | Specified: action chain in J-ADMIN-HISTORY and linked ACT rows. Unverified: implementation. | Specified: Import/history → fresh draft → applied. Full transitions: J-ADMIN-HISTORY | Specified: Current permissions for every imported/history setting; deliberate credential sources; no email-only identity grant | Specified: J-ADMIN-HISTORY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All legacy fields and catalogs preserved; missing/unknown inputs fail; history cannot restore secrets/access or Owner-only settings; no stale-env override. Unverified: execution. |
| J-OWNER-ACTIVITY — Investigate permitted activity and export evidence; AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Specified: Owner | Specified: EP-11 | Specified: action chain in J-OWNER-ACTIVITY and linked ACT rows. Unverified: implementation. | Specified: Filter → scoped list → detail → return. Full transitions: J-OWNER-ACTIVITY | Specified: Current evidence-read/export role; never raw secrets; export requires durable audit | Specified: J-OWNER-ACTIVITY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Owner scoped list/detail; forbidden actor/service data, secret canaries and raw body exposure denied; denial diagnosis within two minutes. Unverified: execution. |
| J-ADMIN-ACTIVITY — Investigate permitted activity and export evidence; AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Specified: Administrator | Specified: EP-11 | Specified: action chain in J-ADMIN-ACTIVITY and linked ACT rows. Unverified: implementation. | Specified: Filter → scoped list → detail → return. Full transitions: J-ADMIN-ACTIVITY | Specified: Current evidence-read/export role; never raw secrets; export requires durable audit | Specified: J-ADMIN-ACTIVITY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Administrator scoped list/detail; forbidden actor/service data, secret canaries and raw body exposure denied; denial diagnosis within two minutes. Unverified: execution. |
| J-AUDITOR-ACTIVITY — Investigate permitted activity and export evidence; AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Specified: Auditor | Specified: EP-11 | Specified: action chain in J-AUDITOR-ACTIVITY and linked ACT rows. Unverified: implementation. | Specified: Filter → scoped list → detail → return. Full transitions: J-AUDITOR-ACTIVITY | Specified: Current evidence-read/export role; never raw secrets; export requires durable audit | Specified: J-AUDITOR-ACTIVITY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Auditor scoped list/detail; forbidden actor/service data, secret canaries and raw body exposure denied; denial diagnosis within two minutes. Unverified: execution. |
| J-MEMBER-ACTIVITY — Investigate permitted activity; AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Specified: Member | Specified: EP-11 | Specified: action chain in J-MEMBER-ACTIVITY and linked ACT rows. Unverified: implementation. | Specified: Filter → scoped list → detail → return. Full transitions: J-MEMBER-ACTIVITY | Specified: Own permitted activity only; no instance export | Specified: J-MEMBER-ACTIVITY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Member scoped list/detail; forbidden actor/service data, secret canaries and raw body exposure denied; denial diagnosis within two minutes. Unverified: execution. |
| J-OWNER-SETTINGS — Configure authentication, SMTP, limits and retention; IDENT-04, MCP-02, OPS-02, OPS-03, OPS-04, CAP-CFG-06, UX-02, STATE-01, STATE-02 | Specified: Owner | Specified: EP-12 | Specified: action chain in J-OWNER-SETTINGS and linked ACT rows. Unverified: implementation. | Specified: Draft → reviewed apply → active. Full transitions: J-OWNER-SETTINGS | Specified: Current Owner; recent authentication for authentication/recovery-material changes; audit | Specified: J-OWNER-SETTINGS failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Every runtime setting exposed; invalid combinations, role bypass, spoofed SMTP inputs and lowered-capacity non-eviction tests. Unverified: execution. |
| J-OWNER-CLIENT — Connect and revoke ChatGPT or Codex; AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Specified: Owner | Specified: EP-13 | Specified: action chain in J-OWNER-CLIENT and linked ACT rows. Unverified: implementation. | Specified: Unconnected → consent → connected. Full transitions: J-OWNER-CLIENT | Specified: Local password/MFA plus per-user OAuth consent; client/redirect/PKCE/scopes validated; audit | Specified: J-OWNER-CLIENT failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Real ChatGPT/Codex for assigned Owner; unassigned admin, invalid PKCE/redirect, replay and revoked access negatives. Unverified: execution. |
| J-ADMIN-CLIENT — Connect and revoke ChatGPT or Codex; AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Specified: Administrator | Specified: EP-13 | Specified: action chain in J-ADMIN-CLIENT and linked ACT rows. Unverified: implementation. | Specified: Unconnected → consent → connected. Full transitions: J-ADMIN-CLIENT | Specified: Local password/MFA plus per-user OAuth consent; client/redirect/PKCE/scopes validated; audit | Specified: J-ADMIN-CLIENT failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Real ChatGPT/Codex for assigned Administrator; unassigned admin, invalid PKCE/redirect, replay and revoked access negatives. Unverified: execution. |
| J-MEMBER-CLIENT — Connect and revoke ChatGPT or Codex; AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Specified: Member | Specified: EP-13 | Specified: action chain in J-MEMBER-CLIENT and linked ACT rows. Unverified: implementation. | Specified: Unconnected → consent → connected. Full transitions: J-MEMBER-CLIENT | Specified: Local password/MFA plus per-user OAuth consent; client/redirect/PKCE/scopes validated; audit | Specified: J-MEMBER-CLIENT failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Real ChatGPT/Codex for assigned Member; unassigned admin, invalid PKCE/redirect, replay and revoked access negatives. Unverified: execution. |
| J-EXTERNAL-01 — Use registered external OAuth access; MCP-02, AUTHZ-01, AUTHZ-02, MCP-04 | Specified: External MCP identity | Specified: EP-14 | Specified: action chain in J-EXTERNAL-01 and linked ACT rows. Unverified: implementation. | Specified: Unregistered → explicit registration and grant → eligible. Full transitions: J-EXTERNAL-01 | Specified: Configured external issuer/audience/scope checks; eligible registered identity; no browser-console rights | Specified: J-EXTERNAL-01 failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Registered valid identity success; wrong issuer/scope/subject and console-access attempts fail. Unverified: execution. |
| J-LEGACY-01 — Use explicitly enabled shared bearer MCP access; MCP-02, AUTHZ-01, MCP-04, BACKUP-05 | Specified: Legacy bearer identity | Specified: EP-14 | Specified: action chain in J-LEGACY-01 and linked ACT rows. Unverified: implementation. | Specified: Explicit enabled mode → eligible. Full transitions: J-LEGACY-01 | Specified: Valid bearer on each POST; configured shared attribution; no console account permission | Specified: J-LEGACY-01 failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Legacy request retains contract; invalid/old bearer and shared-identity console escalation fail. Unverified: execution. |
| J-MCP-01 — Discover, obtain references, request and explain denial; BASE-01, AUTHZ-01, AUTHZ-02, POLICY-01, SEC-02, MCP-04, STATE-02, CAP-CFG-03, CAP-CFG-05 | Specified: MCP client | Specified: EP-15 | Specified: action chain in J-MCP-01 and linked ACT rows. Unverified: implementation. | Specified: Eligible → issuance → queued → current recheck → dispatch → protected result. Full transitions: J-MCP-01 | Specified: Authenticate every POST; tool scope, current eligibility, active service, reference binding, canonical destination/policy, audit before substitution | Specified: J-MCP-01 failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All five tools positive/negative; no precheck I/O; self-signed TLS, tolerant JSON ranges, duplicate keys, Base64/binary and header-enforcement regressions. Unverified: execution. |
| J-MCP-RESTART — Resume after normal restart; MCP-04, MIGRATE-04, BASE-01 | Specified: MCP client | Specified: EP-15 | Specified: action chain in J-MCP-RESTART and linked ACT rows. Unverified: implementation. | Specified: Restart preserves durable authority, loses ephemeral handles. Full transitions: J-MCP-RESTART | Specified: Per-POST authentication; valid retained refresh authorization; references ephemeral | Specified: J-MCP-RESTART failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Normal restart persists approved config/refresh; stale handle and transport session spoof fail; restored grant cannot resume. Unverified: execution. |
| J-OWNER-BACKUP — Create, download and schedule encrypted backups; BACKUP-01, BACKUP-02, OPS-04, STATE-04, SEC-01 | Specified: Owner | Specified: EP-16 | Specified: action chain in J-OWNER-BACKUP and linked ACT rows. Unverified: implementation. | Specified: Idle → running → success/failed. Full transitions: J-OWNER-BACKUP | Specified: Current Owner; audit; recent authentication for download/recovery-material changes; one backup/restore job | Specified: J-OWNER-BACKUP failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Manual/encrypted download success; overlapping job, incomplete archive, snapshot rotation race and secret leakage fail. Unverified: execution. |
| J-SYSTEM-BACKUP — Run scheduled backup and retention; BACKUP-01, BACKUP-02, AUDIT-01, AUDIT-03, OPS-03, OPS-04, STATE-04 | Specified: Scheduled/runtime automation | Specified: EP-17 | Specified: action chain in J-SYSTEM-BACKUP and linked ACT rows. Unverified: implementation. | Specified: Scheduled → running → completed/failed. Full transitions: J-SYSTEM-BACKUP | Specified: Configured system job authority; durable audit; single job; preserve configured retention | Specified: J-SYSTEM-BACKUP failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Daily trigger and retention boundaries; no audit bypass, overlapping job or secret-bearing email; failed job observable. Unverified: execution. |
| J-OWNER-RESTORE — Preview and replace functioning instance; BACKUP-03, BACKUP-04, BACKUP-06, IDENT-06, SECRES-02, STATE-05, STATE-06 | Specified: Owner | Specified: EP-18 | Specified: action chain in J-OWNER-RESTORE and linked ACT rows. Unverified: implementation. | Specified: Active → preview → maintenance → installed recovery. Full transitions: J-OWNER-RESTORE | Specified: Recent current Owner password/TOTP; verified archive recovery material; nominate valid archived Owner; audit | Specified: J-OWNER-RESTORE failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: In-place restore with different archived Owner; fault every installation step, preserve audit tail and old-store coherence; four-hour recovery exercise. Unverified: execution. |
| J-HOST-RESTORE — Restore to clean replacement host; BACKUP-03, BACKUP-04, BACKUP-06, OPS-05, SECRES-02, STATE-05, STATE-06 | Specified: Host operator | Specified: EP-01 | Specified: action chain in J-HOST-RESTORE and linked ACT rows. Unverified: implementation. | Specified: Uninitialized → authorized preview → installed recovery. Full transitions: J-HOST-RESTORE | Specified: Protected newly issued restore proof plus archive material; no old password/session authority | Specified: J-HOST-RESTORE failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Clean-host recovery without lost instance storage; archive-only takeover and partial-state activation fail; gap in evidence labeled. Unverified: execution. |
| J-OWNER-RESUME — Enroll recovery Owner and reactivate reviewed access; BACKUP-05, BACKUP-06, AUTHZ-03, SECRES-02, STATE-06 | Specified: Owner | Specified: EP-19 | Specified: action chain in J-OWNER-RESUME and linked ACT rows. Unverified: implementation. | Specified: Restricted → fresh Owner+audit → management only → independently reviewed users/services. Full transitions: J-OWNER-RESUME | Specified: Single-use bound continuation; fresh password/TOTP; durable audit before ordinary management | Specified: J-OWNER-RESUME failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Fresh Owner then user/service enable; every old authentication artifact denied; no silent restored grant, uncertain history or service activation. Unverified: execution. |
| J-HOST-RECOVERY — Recover locked-out Owners and repair audit storage; IDENT-05, AUDIT-04, OPS-03, SECRES-02, SECRES-04, STATE-06 | Specified: Host operator | Specified: EP-20 | Specified: action chain in J-HOST-RECOVERY and linked ACT rows. Unverified: implementation. | Specified: Outage → repair+durable record → normal admission. Full transitions: J-HOST-RECOVERY | Specified: Protected host authority; durable audit must be repaired before recovery mutation; no web filesystem or password-only fallback | Specified: J-HOST-RECOVERY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Disk-full/permission/process faults, safe diagnostic login and recovery; every sensitive route/job fails closed and no auto-upgrade/retry. Unverified: execution. |
| J-OWNER-DIAG — Use read-only diagnosis during audit outage; AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Specified: Owner | Specified: EP-21 | Specified: action chain in J-OWNER-DIAG and linked ACT rows. Unverified: implementation. | Specified: Healthy → outage → scoped diagnosis. Full transitions: J-OWNER-DIAG | Specified: Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity | Specified: J-OWNER-DIAG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Owner appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works. Unverified: execution. |
| J-ADMIN-DIAG — Use read-only diagnosis during audit outage; AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Specified: Administrator | Specified: EP-21 | Specified: action chain in J-ADMIN-DIAG and linked ACT rows. Unverified: implementation. | Specified: Healthy → outage → scoped diagnosis. Full transitions: J-ADMIN-DIAG | Specified: Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity | Specified: J-ADMIN-DIAG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Administrator appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works. Unverified: execution. |
| J-AUDITOR-DIAG — Use read-only diagnosis during audit outage; AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Specified: Auditor | Specified: EP-21 | Specified: action chain in J-AUDITOR-DIAG and linked ACT rows. Unverified: implementation. | Specified: Healthy → outage → scoped diagnosis. Full transitions: J-AUDITOR-DIAG | Specified: Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity | Specified: J-AUDITOR-DIAG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Auditor appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works. Unverified: execution. |
| J-MEMBER-DIAG — Use read-only diagnosis during audit outage; AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Specified: Member | Specified: EP-21 | Specified: action chain in J-MEMBER-DIAG and linked ACT rows. Unverified: implementation. | Specified: Healthy → outage → scoped diagnosis. Full transitions: J-MEMBER-DIAG | Specified: Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity | Specified: J-MEMBER-DIAG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Member appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works. Unverified: execution. |
| J-PUBLIC-01 — Observe bounded health and locate authorized entry; OPS-03, IDENT-01, IDENT-03, SECRES-01 | Specified: Unauthenticated visitor | Specified: EP-22 | Specified: action chain in J-PUBLIC-01 and linked ACT rows. Unverified: implementation. | Specified: Unauthenticated remains unauthenticated until complete authorized login/enrollment.. Full transitions: J-PUBLIC-01 | Specified: Public bounded healthy/degraded status only; no discoverable bootstrap authority | Specified: J-PUBLIC-01 failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Public health useful without configuration disclosure; account enumeration, public takeover and mutating link preview fail. Unverified: execution. |
| J-SYSTEM-ADMISSION — Enforce limits and maintain durable evidence; AUDIT-01, AUDIT-03, AUDIT-04, OPS-01, OPS-02, OPS-03, OPS-04, SEC-03, STATE-02 | Specified: Scheduled/runtime automation | Specified: EP-23 | Specified: action chain in J-SYSTEM-ADMISSION and linked ACT rows. Unverified: implementation. | Specified: Requested → recorded start → completed. Full transitions: J-SYSTEM-ADMISSION | Specified: Current active limits and permissions; mandatory durable admission and sanitized append | Specified: J-SYSTEM-ADMISSION failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Capacity/role/admission races; positive/negative every new external input; durable start survives crash and completion failure without false success. Unverified: execution. |
| J-AUDITOR-CONFIG — Inspect non-secret configuration; AUTHZ-02, AUTHZ-04, UX-01, UX-02, UX-04, OPS-06 | Specified: Auditor | Specified: EP-06 | Specified: action chain in J-AUDITOR-CONFIG and linked ACT rows. Unverified: implementation. | Specified: Service list → read-only detail → evidence → list. Full transitions: J-AUDITOR-CONFIG | Specified: Authenticated Auditor read-only scope; no credential values, editing, assignments or execution | Specified: J-AUDITOR-CONFIG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All non-secret read surfaces accessible; direct API edits, secret reveal and execution fail. Unverified: execution. |


## Gap register

None found. Zero Blocker, Major and Minor specification gaps; no implementation-gap claims. Deferred exact route/layout/mechanism choices are not missing product behavior.

## Remediation verification

Not applicable as a prior journey audit comparison: this is the initial journey audit. The orchestrator’s earlier PRD findings F-PRD-001–004 are closed, not journey gaps: SECRES-01 provides bound-link exceptions, SECRES-02/STATE-05–06 restore authority/recovery, SECRES-04 audit-outage boundaries, and STATE-01–03 immediate versus draft/rollback semantics. The affected journeys verify those requirements without reopening accepted decisions.

## Unmapped or uncertain PRD statements

None. The following index accounts for every numbered requirement and the seven derived unnumbered families. Configuration-table entries map to CAP-CFG-01–06 and their related numbered requirements. CAP-ACCEPT-01 covers PRD section 5 documentation/usability obligations; all journeys carry required positive/negative tests. Product principles, deployment/exclusions, SOC 2 operating responsibility and review boundaries constrain these journeys rather than create additional features.

| Requirement / capability family | Journey references |
|---|---|
| AUDIT-01 | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY, J-SYSTEM-BACKUP, J-SYSTEM-ADMISSION |
| AUDIT-02 | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY |
| AUDIT-03 | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY, J-SYSTEM-BACKUP, J-SYSTEM-ADMISSION |
| AUDIT-04 | J-HOST-RECOVERY, J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG, J-SYSTEM-ADMISSION |
| AUTHZ-01 | J-OWNER-ACCESS, J-ADMIN-ACCESS, J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT, J-EXTERNAL-01, J-LEGACY-01, J-MCP-01 |
| AUTHZ-02 | J-OWNER-PEOPLE, J-OWNER-ACCESS, J-ADMIN-ACCESS, J-EXTERNAL-01, J-MCP-01, J-AUDITOR-CONFIG |
| AUTHZ-03 | J-OWNER-PEOPLE, J-OWNER-RECOVERY, J-OWNER-RESUME |
| AUTHZ-04 | J-OWNER-CONFIG, J-ADMIN-CONFIG, J-AUDITOR-CONFIG |
| BACKUP-01 | J-OWNER-BACKUP, J-SYSTEM-BACKUP |
| BACKUP-02 | J-OWNER-01, J-OWNER-BACKUP, J-SYSTEM-BACKUP |
| BACKUP-03 | J-OWNER-RESTORE, J-HOST-RESTORE |
| BACKUP-04 | J-OWNER-RESTORE, J-HOST-RESTORE |
| BACKUP-05 | J-LEGACY-01, J-OWNER-RESUME |
| BACKUP-06 | J-OWNER-RESTORE, J-HOST-RESTORE, J-OWNER-RESUME |
| BASE-01 | J-MCP-01, J-MCP-RESTART |
| BASE-02 | J-OWNER-CONFIG, J-ADMIN-CONFIG |
| BASE-03 | J-OWNER-CREDENTIAL, J-OWNER-HISTORY, J-ADMIN-CREDENTIAL, J-ADMIN-HISTORY |
| CAP-ACCEPT-01 | J-HOST-01 |
| CAP-CFG-01 | J-OWNER-CONFIG, J-ADMIN-CONFIG |
| CAP-CFG-02 | J-OWNER-CONFIG, J-ADMIN-CONFIG |
| CAP-CFG-03 | J-OWNER-CONFIG, J-ADMIN-CONFIG, J-MCP-01 |
| CAP-CFG-04 | J-OWNER-CONFIG, J-ADMIN-CONFIG |
| CAP-CFG-05 | J-OWNER-CONFIG, J-OWNER-POLICY, J-ADMIN-CONFIG, J-ADMIN-POLICY, J-MCP-01 |
| CAP-CFG-06 | J-OWNER-SETTINGS |
| CONFIG-01 | J-OWNER-CONFIG, J-ADMIN-CONFIG |
| CONFIG-02 | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL |
| CONFIG-03 | J-OWNER-CONFIG, J-ADMIN-CONFIG |
| CONFIG-04 | J-OWNER-HISTORY, J-ADMIN-HISTORY |
| CONFIG-05 | J-OWNER-ACCESS, J-ADMIN-ACCESS |
| IDENT-01 | J-HOST-01, J-OWNER-01, J-PUBLIC-01 |
| IDENT-02 | J-OWNER-01, J-OWNER-ENROLL, J-OWNER-ACCOUNT, J-ADMIN-ENROLL, J-ADMIN-ACCOUNT, J-AUDITOR-ENROLL, J-AUDITOR-ACCOUNT, J-MEMBER-ENROLL, J-MEMBER-ACCOUNT |
| IDENT-03 | J-OWNER-ENROLL, J-ADMIN-ENROLL, J-AUDITOR-ENROLL, J-MEMBER-ENROLL, J-OWNER-PEOPLE, J-PUBLIC-01 |
| IDENT-04 | J-OWNER-SETTINGS |
| IDENT-05 | J-OWNER-ENROLL, J-OWNER-ACCOUNT, J-ADMIN-ENROLL, J-ADMIN-ACCOUNT, J-AUDITOR-ENROLL, J-AUDITOR-ACCOUNT, J-MEMBER-ENROLL, J-MEMBER-ACCOUNT, J-OWNER-RECOVERY, J-HOST-RECOVERY |
| IDENT-06 | J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT, J-OWNER-PEOPLE, J-OWNER-RECOVERY, J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT, J-OWNER-RESTORE, J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG |
| MCP-01 | J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT |
| MCP-02 | J-OWNER-SETTINGS, J-EXTERNAL-01, J-LEGACY-01 |
| MCP-03 | J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT |
| MCP-04 | J-EXTERNAL-01, J-LEGACY-01, J-MCP-01, J-MCP-RESTART |
| MIGRATE-01 | J-OWNER-HISTORY, J-ADMIN-HISTORY |
| MIGRATE-02 | J-OWNER-HISTORY, J-ADMIN-HISTORY |
| MIGRATE-03 | J-OWNER-HISTORY, J-ADMIN-HISTORY |
| MIGRATE-04 | J-OWNER-HISTORY, J-ADMIN-HISTORY, J-MCP-RESTART |
| OPS-01 | J-SYSTEM-ADMISSION |
| OPS-02 | J-OWNER-SETTINGS, J-SYSTEM-ADMISSION |
| OPS-03 | J-OWNER-SETTINGS, J-SYSTEM-BACKUP, J-HOST-RECOVERY, J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG, J-PUBLIC-01, J-SYSTEM-ADMISSION |
| OPS-04 | J-OWNER-SETTINGS, J-OWNER-BACKUP, J-SYSTEM-BACKUP, J-SYSTEM-ADMISSION |
| OPS-05 | J-HOST-01, J-HOST-RESTORE |
| OPS-06 | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY, J-AUDITOR-CONFIG |
| POLICY-01 | J-OWNER-POLICY, J-ADMIN-POLICY, J-MCP-01 |
| POLICY-02 | J-OWNER-POLICY, J-ADMIN-POLICY |
| POLICY-03 | J-OWNER-POLICY, J-ADMIN-POLICY |
| POLICY-04 | J-OWNER-CONFIG, J-OWNER-POLICY, J-ADMIN-CONFIG, J-ADMIN-POLICY |
| SEC-01 | J-OWNER-01, J-OWNER-ENROLL, J-OWNER-ACCOUNT, J-ADMIN-ENROLL, J-ADMIN-ACCOUNT, J-AUDITOR-ENROLL, J-AUDITOR-ACCOUNT, J-MEMBER-ENROLL, J-MEMBER-ACCOUNT, J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL, J-OWNER-BACKUP |
| SEC-02 | J-OWNER-POLICY, J-ADMIN-POLICY, J-MCP-01 |
| SEC-03 | J-OWNER-PEOPLE, J-OWNER-CREDENTIAL, J-OWNER-ACCESS, J-ADMIN-CREDENTIAL, J-ADMIN-ACCESS, J-SYSTEM-ADMISSION |
| SECRES-01 | J-OWNER-01, J-OWNER-ENROLL, J-ADMIN-ENROLL, J-AUDITOR-ENROLL, J-MEMBER-ENROLL, J-OWNER-RECOVERY, J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT, J-PUBLIC-01 |
| SECRES-02 | J-HOST-01, J-OWNER-01, J-OWNER-RESTORE, J-HOST-RESTORE, J-OWNER-RESUME, J-HOST-RECOVERY |
| SECRES-03 | J-OWNER-ENROLL, J-OWNER-ACCOUNT, J-ADMIN-ENROLL, J-ADMIN-ACCOUNT, J-AUDITOR-ENROLL, J-AUDITOR-ACCOUNT, J-MEMBER-ENROLL, J-MEMBER-ACCOUNT, J-OWNER-RECOVERY |
| SECRES-04 | J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT, J-HOST-RECOVERY, J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG |
| STATE-01 | J-OWNER-PEOPLE, J-OWNER-CONFIG, J-OWNER-CREDENTIAL, J-OWNER-ACCESS, J-ADMIN-CONFIG, J-ADMIN-CREDENTIAL, J-ADMIN-ACCESS, J-OWNER-SETTINGS |
| STATE-02 | J-OWNER-PEOPLE, J-OWNER-CONFIG, J-OWNER-CREDENTIAL, J-OWNER-ACCESS, J-ADMIN-CONFIG, J-ADMIN-CREDENTIAL, J-ADMIN-ACCESS, J-OWNER-SETTINGS, J-MCP-01, J-SYSTEM-ADMISSION |
| STATE-03 | J-OWNER-CREDENTIAL, J-OWNER-ACCESS, J-OWNER-HISTORY, J-ADMIN-CREDENTIAL, J-ADMIN-ACCESS, J-ADMIN-HISTORY |
| STATE-04 | J-OWNER-BACKUP, J-SYSTEM-BACKUP |
| STATE-05 | J-OWNER-RESTORE, J-HOST-RESTORE |
| STATE-06 | J-OWNER-RESTORE, J-HOST-RESTORE, J-OWNER-RESUME, J-HOST-RECOVERY |
| UX-01 | J-OWNER-CONFIG, J-ADMIN-CONFIG, J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY, J-AUDITOR-CONFIG |
| UX-02 | J-OWNER-CONFIG, J-ADMIN-CONFIG, J-OWNER-SETTINGS, J-AUDITOR-CONFIG |
| UX-03 | J-OWNER-CONFIG, J-ADMIN-CONFIG, J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY |
| UX-04 | J-OWNER-CONFIG, J-ADMIN-CONFIG, J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY, J-AUDITOR-CONFIG |


**Unnumbered acceptance details:** First service ≤15 minutes (CONFIG journeys), denial investigation ≤2 minutes (ACTIVITY), user disable ≤1 minute (PEOPLE); validate 50 users/100 services (SYSTEM-ADMISSION), 24-hour targeted data loss and four-hour restore once prerequisites exist (backup/host restore), real ChatGPT/Codex authorization, full preserved gateway regressions, keyboard/assistive input and essential narrow-screen monitoring/recovery. Required guides cover deployment/proxy, enrollment/roles, service setup, clients, migration, audit, rotation, off-host copies, restore and limitations; example hosts are example.org. SECRES-T01–07 and STATE acceptance scenarios bind the corresponding numbered companion rows above.

## Assumptions and open questions

No open product question. Settled D-001–D-012 remain authoritative: self-hosted single organization, four fixed roles, authenticator MFA, write-only managed credentials, audit fail-closed, whole-instance backup/restore and explicit reactivation. No multi-tenant/SAML/OIDC/SCIM/billing/general vault/custom-role/specific-integration functionality is inferred. Scope is sufficient for Product UX to design exact discovery/control locations and the domain reviewers to choose technical mechanisms.

An account security surface is a necessary entry for the PRD’s own-password/MFA/session capabilities; its placement is UX work. Logout is explicitly supported by SECRES-04 and is traced separately from grant revocation. Ordinary user deletion, arbitrary job cancellation, contact-address changes and support ticketing are not promised; disable/archive, safe abandonment and host/Owner recovery provide the stated terminal paths without expanding v1.

## Coverage summary

- Distinct actors: 10; actor-context rows: 21.
- Unique requirement/capability families: 70 (53 PRD IDs, ten normative companion IDs, seven derived unnumbered families).
- Actor-specific journeys: 47; Complete: 47; Partial/Missing/Contradictory: 0.
- Reachability: 47 Indeterminate; no Reachable claim. Implementation assessment: 47 Not applicable at preimplementation stage.
- Entry points: 23; action mappings: 84; coverage rows: 47, exactly eight populated columns each.
- Unique gaps: 0 Blocker, 0 Major, 0 Minor; implementation gaps asserted: 0; unmapped requirements: 0.
- No implementation tests run. No product authority or code changed.

### Validated source revisions

| Input | Exact revision |
|---|---|
| docs/web-console-prd.md | sha256:cb8d09474431d3bdd082466beac07163051bd2cb00639433f8a87bf85b46c3d8 |
| product/security/web-console-security-contract.md | sha256:95e342c77316f1697540fa8da29c6dd6333d6b6d3356b326c4dde921bca4540d |
| product/architecture/web-console-state-contract.md | sha256:54956edc26dbcebcb48ecca0697a4695012d61488fa2297e56b6c04c9cbaa858 |
| docs/web-console-prd-coverage.md | sha256:1cb9db8350470b5ddca5bc63e3005fb13df4900535b93db6541dc1f636b3598c |


Decision provenance: D-001–D-012, RES-PRD-SEC-01 and RES-PRD-ARCH-01; referenced by stable ID rather than a hash of the mutable workflow ledger.
