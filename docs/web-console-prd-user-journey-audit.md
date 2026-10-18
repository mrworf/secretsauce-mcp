# PRD User Journey Audit: SecretSauce Web Console

> Source PRD: [web-console-prd.md](web-console-prd.md)<br>
> Generated: 2026-10-18T14:49:45+00:00 (UTC)<br>
> Review mode: Remediation re-audit — targeted service-feedback and approved UX-DESIGN-004<br>
> Compared against: this artifact generated 2026-10-12T23:48:31+00:00 (UTC)<br>
> Evaluation scope: PRD and normative companions only; definition-only revalidation; existing implementation was not re-audited. Passed [coverage](web-console-prd-coverage.md) is an input, not implementation proof.

## Executive verdict

PASS for journey specification: 66 actor-specific journeys map all 55 PRD IDs, all seventeen normative companion IDs, and seven unnumbered capability families. No new Blocker, Major or Minor specification gap was found. All journeys are specification-complete at this definition boundary; implementation is Not verified in this definition-only review and runtime reachability is Indeterminate. This is neither implementation acceptance nor a delivery-planning handoff.

## Audit method and status definitions

Targeted third-feedback review preserves unaffected inventories and checks service lifecycle/draft/readiness, focused configuration and policy editing, import identity recovery, service credential clearing/attribution and recovery consistency against the PRD, SECRES-08, STATE-09, approved UX4, REC-RUN-008 and refreshed 141-row coverage. Prior passes remain the basis for unchanged identity, SMTP and operational journeys. The earlier F-PRD-001–004 remain closed; this audit does not reopen their resolved domain semantics. Reviewed ingress, state, role, alternate/failure and recovery paths independently. This is explicitly a PRD-only review: no source-code absence, exact API route, database, cryptography or UI layout choice is called a specification gap.

**Navigation and configuration feedback:** PO-FB-006 and existing UX authority require active primary/secondary navigation indication with non-color and programmatic state, distinct from keyboard focus; back/forward/deep-link/refresh must identify the current permitted area. Both reset purposes and legacy YAML import must be discoverable to eligible actors. UX-DESIGN-003 is approved, including general visual fidelity to the mockups. Canonical UX4 preserves the six destinations and their responsive navigation; Secret detection replaces the Response protection label while old-term search remains supported.

**Shared invariants (apply to every journey/action):** Current server-enforced role and ownership checks apply; sensitive actions also require durable audit and the stated recent authentication. Secret values never appear in feedback/history/logs/export; non-secret form work survives validation failures. Actions are isolated to one organization/instance. Meaningful transitions commit before success is shown. All external inputs require positive and negative validation; direct unauthorized calls must fail even if hidden by UI. Navigation/errors/focus and essential narrow-screen recovery must satisfy UX-04. Dependencies, current permissions and coherent active revisions are checked at apply/admission, not inferred from a prior screen.

**Assessment key:** Complete describes specified behavior, not existing code. All inventory entries below are Required by PRD, with implementation Unverified; exact layout follows approved Product UX. A capability is not labeled Reachable without runtime evidence. Backend names below are specified responsibilities, never invented URL routes. Matrix tests are required future tests and are Unverified. Shared role variants retain separate journey IDs, current permissions and matrix rows; their action chains are cross-referenced instead of copied.

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
| Owner | Assisted reset link | Password-reset target retains enrolled factor; MFA-reset target is restricted | Authorized issuer under SECRES-05; purpose/generation-bound proof | Complete only bound reset, then ordinary login | EP-24; J-OWNER-PASSWORD-COMPLETE; J-OWNER-MFA-COMPLETE |
| Administrator | Assisted reset link | Password-reset target retains enrolled factor; MFA-reset target is restricted | Authorized issuer under SECRES-05; purpose/generation-bound proof | Complete only bound reset, then ordinary login | EP-24; J-ADMIN-PASSWORD-COMPLETE; J-ADMIN-MFA-COMPLETE |
| Auditor | Assisted reset link | Password-reset target retains enrolled factor; MFA-reset target is restricted | Authorized issuer under SECRES-05; purpose/generation-bound proof | Complete only bound reset, then ordinary login | EP-24; J-AUDITOR-PASSWORD-COMPLETE; J-AUDITOR-MFA-COMPLETE |
| Member | Assisted reset link | Password-reset target retains enrolled factor; MFA-reset target is restricted | Authorized issuer under SECRES-05; purpose/generation-bound proof | Complete only bound reset, then ordinary login | EP-24; J-MEMBER-PASSWORD-COMPLETE; J-MEMBER-MFA-COMPLETE |


External SMTP servers, downstream APIs and external issuers are dependencies, not console roles. Their failure outcomes are mapped in the invoking journey. The same human may also be host operator, but host authority never substitutes silently for console Owner authorization.

## Required entry points

| Entry Point | Actor | Capability / Journey | Required or Evidenced Surface | Discoverability | Status | Evidence / Gap |
|---|---|---|---|---|---|---|
| EP-01 | Host operator | J-HOST-01, J-HOST-RESTORE | Protected host-local setup/restore action | Operator deployment/recovery documentation | Required by PRD; implementation Unverified | BACKUP-03, BACKUP-04, BACKUP-06, CAP-ACCEPT-01, IDENT-01, OPS-05, SECRES-02, STATE-05, STATE-06; no gap |
| EP-02 | Owner | J-OWNER-01 | Restricted initial setup | Host proof and setup URL | Required by PRD; implementation Unverified | BACKUP-02, IDENT-01, IDENT-02, SEC-01, SECRES-01, SECRES-02; no gap |
| EP-03 | Administrator, Auditor, Member, Owner | J-OWNER-ENROLL, J-ADMIN-ENROLL, J-AUDITOR-ENROLL, J-MEMBER-ENROLL | Bound invitation enrollment link | Owner invitation via SMTP/trusted manual channel | Required by PRD; implementation Unverified | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03; no gap |
| EP-04 | Administrator, Auditor, Member, Owner | J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT | Login, own security/session and reset surfaces | Login and own-account controls; reset established channel | Required by PRD; implementation Unverified | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04; no gap |
| EP-05 | Owner, Administrator, Auditor within current read scope | J-OWNER-PEOPLE, J-OWNER-RECOVERY, J-ADMIN-RECOVERY, J-OWNER-PASSWORD-RESET, J-ADMIN-PASSWORD-RESET | People & Access | Primary navigation; one-row account list, role-scoped full detail and bounded SECRES-06 edits; resets remain SECRES-05 | Required by PRD; implementation Unverified | AUTHZ-02, AUTHZ-03, IDENT-03, IDENT-05, IDENT-06, SEC-03, SECRES-01, SECRES-03, SECRES-05, STATE-01, STATE-02; no gap |
| EP-06 | Administrator, Auditor, Owner | J-OWNER-CONFIG, J-ADMIN-CONFIG, J-AUDITOR-CONFIG | Services and service details | Landing list/search/filter → Add service or Overview/Configuration/Access/Activity | Required by PRD; implementation Unverified | AUTHZ-02, AUTHZ-04, BASE-02, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, CONFIG-01, CONFIG-03, OPS-06, POLICY-04, STATE-01, STATE-02, UX-01, UX-02, UX-03, UX-04; no gap |
| EP-07 | Administrator, Owner | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL | Service Authentication and credentials | Service Configuration → authentication/credential controls | Required by PRD; implementation Unverified | BASE-03, CONFIG-02, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03; no gap |
| EP-08 | Administrator, Owner | J-OWNER-ACCESS, J-ADMIN-ACCESS | Service Access and lifecycle actions | Service Access/Overview; People & Access grants | Required by PRD; implementation Unverified | AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03; no gap |
| EP-09 | Administrator, Owner | J-OWNER-POLICY, J-ADMIN-POLICY | Policy editor and safe tester | Service Configuration → policy; advanced controls | Required by PRD; implementation Unverified | CAP-CFG-05, POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02; no gap |
| EP-10 | Administrator, Owner | J-OWNER-HISTORY, J-ADMIN-HISTORY | Guided import, configuration export and history | Services → Import configuration and Configuration tools; guided legacy YAML and both catalogs; retained UX-IA02/04 ingress | Required by PRD; implementation Unverified | BASE-03, CONFIG-04, MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, STATE-03; no gap |
| EP-11 | Administrator, Auditor, Member, Owner | J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY | Activity and evidence export | Primary Activity or service Activity; permitted filters/detail | Required by PRD; implementation Unverified | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04; no gap |
| EP-12 | Owner; Administrator within scanning scope; Auditor read-only | J-OWNER-SETTINGS, J-ADMIN-CONFIG, J-AUDITOR-CONFIG, J-OWNER-SMTP-DELETE | Settings and role-permitted configuration | Primary Settings; focused sections and discoverable advanced controls; approved UX-DESIGN-003 populated-form navigation | Required by PRD; implementation Unverified | CAP-CFG-06, IDENT-04, MCP-02, OPS-02, OPS-03, OPS-04, STATE-01, STATE-02, UX-02; no gap |
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
| EP-24 | Owner, Administrator, Auditor, Member as reset targets | J-*-PASSWORD-COMPLETE; J-*-MFA-COMPLETE | Separate restricted reset completion surfaces | Established contact or trusted manual channel; capture/remove fragment on load and hashchange | Required by PRD; implementation Unverified | IDENT-05; SECRES-01/05; no new gap |
| EP-25 | Owner, Administrator, Auditor within current visibility | J-*-PEOPLE-VIEW; J-OWNER/ADMIN-ACCOUNT-EDIT | Full account detail and bounded account-change confirmation | Real account link from one-row People list; back retains context | Required by PRD and approved UX; implementation Unverified | IDENT-02A/B; UX-IA07; SECRES-06 |

## Capability reachability

| Capability | Actor | Journey | PRD Evidence | Spec Coverage | Implementation Evidence | Reachability | Primary Gap |
|---|---|---|---|---|---|---|---|
| Deploy and authorize initial setup | Host operator | J-HOST-01 | IDENT-01, OPS-05, SECRES-02, CAP-ACCEPT-01 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Establish first Owner | Owner | J-OWNER-01 | IDENT-01, IDENT-02, SEC-01, BACKUP-02, SECRES-01, SECRES-02 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Accept role-bound invitation | Owner | J-OWNER-ENROLL | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Authenticate and manage own security | Owner | J-OWNER-ACCOUNT | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Accept role-bound invitation | Administrator | J-ADMIN-ENROLL | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Authenticate and manage own security | Administrator | J-ADMIN-ACCOUNT | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Accept role-bound invitation | Auditor | J-AUDITOR-ENROLL | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Authenticate and manage own security | Auditor | J-AUDITOR-ACCOUNT | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Accept role-bound invitation | Member | J-MEMBER-ENROLL | IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Authenticate and manage own security | Member | J-MEMBER-ACCOUNT | IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Invite, grant roles, transfer ownership and disable users | Owner | J-OWNER-PEOPLE | AUTHZ-02, AUTHZ-03, IDENT-03, IDENT-06, SEC-03, STATE-01, STATE-02 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Authorize verified account recovery | Owner | J-OWNER-RECOVERY | IDENT-05, IDENT-06, AUTHZ-03, SECRES-01, SECRES-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Configure and apply service and scanner settings | Owner | J-OWNER-CONFIG | BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Set, replace and delete unreferenced managed credentials | Owner | J-OWNER-CREDENTIAL | CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Assign service access and control service lifecycle | Owner | J-OWNER-ACCESS | AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Inspect, edit and safely test policy | Owner | J-OWNER-POLICY | POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Import, export and restore permitted configuration | Owner | J-OWNER-HISTORY | MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Configure and apply service and scanner settings | Administrator | J-ADMIN-CONFIG | BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Set, replace and delete unreferenced managed credentials | Administrator | J-ADMIN-CREDENTIAL | CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Assign service access and control service lifecycle | Administrator | J-ADMIN-ACCESS | AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Inspect, edit and safely test policy | Administrator | J-ADMIN-POLICY | POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Import, export and restore permitted configuration | Administrator | J-ADMIN-HISTORY | MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Investigate permitted activity and export evidence | Owner | J-OWNER-ACTIVITY | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Investigate permitted activity and export evidence | Administrator | J-ADMIN-ACTIVITY | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Investigate permitted activity and export evidence | Auditor | J-AUDITOR-ACTIVITY | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Investigate permitted activity | Member | J-MEMBER-ACTIVITY | AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Configure authentication, SMTP, limits and retention | Owner | J-OWNER-SETTINGS | IDENT-04, MCP-02, OPS-02, OPS-03, OPS-04, CAP-CFG-06, UX-02, STATE-01, STATE-02 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Connect and revoke ChatGPT or Codex | Owner | J-OWNER-CLIENT | AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Connect and revoke ChatGPT or Codex | Administrator | J-ADMIN-CLIENT | AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Connect and revoke ChatGPT or Codex | Member | J-MEMBER-CLIENT | AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Use registered external OAuth access | External MCP identity | J-EXTERNAL-01 | MCP-02, AUTHZ-01, AUTHZ-02, MCP-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Use explicitly enabled shared bearer MCP access | Legacy bearer identity | J-LEGACY-01 | MCP-02, AUTHZ-01, MCP-04, BACKUP-05 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Discover, obtain references, request and explain denial | MCP client | J-MCP-01 | BASE-01, AUTHZ-01, AUTHZ-02, POLICY-01, SEC-02, MCP-04, STATE-02, CAP-CFG-03, CAP-CFG-05 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Resume after normal restart | MCP client | J-MCP-RESTART | MCP-04, MIGRATE-04, BASE-01 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Create, download and schedule encrypted backups | Owner | J-OWNER-BACKUP | BACKUP-01, BACKUP-02, OPS-04, STATE-04, SEC-01 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Run scheduled backup and retention | Scheduled/runtime automation | J-SYSTEM-BACKUP | BACKUP-01, BACKUP-02, AUDIT-01, AUDIT-03, OPS-03, OPS-04, STATE-04 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Preview and replace functioning instance | Owner | J-OWNER-RESTORE | BACKUP-03, BACKUP-04, BACKUP-06, IDENT-06, SECRES-02, STATE-05, STATE-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Restore to clean replacement host | Host operator | J-HOST-RESTORE | BACKUP-03, BACKUP-04, BACKUP-06, OPS-05, SECRES-02, STATE-05, STATE-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Enroll recovery Owner and reactivate reviewed access | Owner | J-OWNER-RESUME | BACKUP-05, BACKUP-06, AUTHZ-03, SECRES-02, STATE-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Recover locked-out Owners and repair audit storage | Host operator | J-HOST-RECOVERY | IDENT-05, AUDIT-04, OPS-03, SECRES-02, SECRES-04, STATE-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Use read-only diagnosis during audit outage | Owner | J-OWNER-DIAG | AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Use read-only diagnosis during audit outage | Administrator | J-ADMIN-DIAG | AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Use read-only diagnosis during audit outage | Auditor | J-AUDITOR-DIAG | AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Use read-only diagnosis during audit outage | Member | J-MEMBER-DIAG | AUDIT-04, OPS-03, SECRES-04, IDENT-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Observe bounded health and locate authorized entry | Unauthenticated visitor | J-PUBLIC-01 | OPS-03, IDENT-01, IDENT-03, SECRES-01 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Enforce limits and maintain durable evidence | Scheduled/runtime automation | J-SYSTEM-ADMISSION | AUDIT-01, AUDIT-03, AUDIT-04, OPS-01, OPS-02, OPS-03, OPS-04, SEC-03, STATE-02 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Inspect non-secret configuration | Auditor | J-AUDITOR-CONFIG | AUTHZ-02, AUTHZ-04, UX-01, UX-02, UX-04, OPS-06 | Complete | Not verified — outside targeted definition review | Indeterminate — no implemented path validation | None found |
| Initiate separate password reset | Owner | J-OWNER-PASSWORD-RESET | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Initiate separate MFA reset | Administrator | J-ADMIN-RECOVERY | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Initiate separate password reset | Administrator | J-ADMIN-PASSWORD-RESET | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Complete assisted password reset | Owner | J-OWNER-PASSWORD-COMPLETE | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Complete assisted Authenticator enrollment | Owner | J-OWNER-MFA-COMPLETE | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Complete assisted password reset | Administrator | J-ADMIN-PASSWORD-COMPLETE | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Complete assisted Authenticator enrollment | Administrator | J-ADMIN-MFA-COMPLETE | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Complete assisted password reset | Auditor | J-AUDITOR-PASSWORD-COMPLETE | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Complete assisted Authenticator enrollment | Auditor | J-AUDITOR-MFA-COMPLETE | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Complete assisted password reset | Member | J-MEMBER-PASSWORD-COMPLETE | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Complete assisted Authenticator enrollment | Member | J-MEMBER-MFA-COMPLETE | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Delete SMTP credential independently | Owner | J-OWNER-SMTP-DELETE | IDENT-04, IDENT-06, CONFIG-03, CONFIG-04, AUDIT-01, AUDIT-04, STATE-01, STATE-02, STATE-03 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Inspect People list and account details | Owner | J-OWNER-PEOPLE-VIEW | IDENT-02A, SECRES-06, STATE-07, UX-02, UX-04 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Inspect People list and account details | Administrator | J-ADMIN-PEOPLE-VIEW | IDENT-02A, SECRES-06, STATE-07, UX-02, UX-04 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Inspect People list and account details | Auditor | J-AUDITOR-PEOPLE-VIEW | IDENT-02A, SECRES-06, STATE-07, UX-02, UX-04 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Edit account contact and permitted role | Owner | J-OWNER-ACCOUNT-EDIT | IDENT-02B, AUTHZ-02, AUTHZ-03, IDENT-06, SECRES-06 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Edit account contact and permitted role | Administrator | J-ADMIN-ACCOUNT-EDIT | IDENT-02B, AUTHZ-02, AUTHZ-03, IDENT-06, SECRES-06 | Complete | Not verified — outside targeted definition review | Indeterminate | None found |
| Clear an in-use service credential value | Owner | J-OWNER-CREDENTIAL-CLEAR | CONFIG-02/03/04/05; STATE-09; SECRES-08; UX-IN14 | Complete | Not verified — definition-only review | Indeterminate | None found |
| Clear an in-use service credential value | Administrator | J-ADMIN-CREDENTIAL-CLEAR | CONFIG-02/03/04/05; STATE-09; SECRES-08; UX-IN14 | Complete | Not verified — definition-only review | Indeterminate | None found |

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**Metadata addition (all four ACCOUNT variants):** Full password-and-factor console admission durably advances Last console sign-in with server time, including recovery-code second factor; older concurrent completion cannot regress it. Failed/partial login, OAuth/MCP, reauthentication, restricted diagnostic login, refresh and enrollment/reset completion do not update it. STATE-07 governs unknown/never and historical restore data; this metadata confers no authority. ACT-103 maps admission.

### J-ADMIN-ENROLL — Administrator: Accept role-bound invitation

- **Promise/evidence and entry:** IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03; EP-03.
- **Begins / permissions:** Pending invitation with predetermined Administrator role; delivery by SMTP or trusted manual channel. Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ENROLL with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Administrator enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-ADMIN-ACCOUNT — Administrator: Authenticate and manage own security

- **Promise/evidence and entry:** IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04; EP-04.
- **Begins / permissions:** Enrolled Administrator; existing password and TOTP or authorized recovery route. Own identity; password plus valid factor/code for replacement; current session alone insufficient.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACCOUNT with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Administrator normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-AUDITOR-ENROLL — Auditor: Accept role-bound invitation

- **Promise/evidence and entry:** IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03; EP-03.
- **Begins / permissions:** Pending invitation with predetermined Auditor role; delivery by SMTP or trusted manual channel. Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ENROLL with this actor and permissions. Auditor is evidence/configuration read-only and cannot execute MCP; activity inspection has no execution entitlement.
- **Acceptance:** Auditor enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-AUDITOR-ACCOUNT — Auditor: Authenticate and manage own security

- **Promise/evidence and entry:** IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04; EP-04.
- **Begins / permissions:** Enrolled Auditor; existing password and TOTP or authorized recovery route. Own identity; password plus valid factor/code for replacement; current session alone insufficient.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACCOUNT with this actor and permissions. Auditor is evidence/configuration read-only and cannot execute MCP; activity inspection has no execution entitlement.
- **Acceptance:** Auditor normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-MEMBER-ENROLL — Member: Accept role-bound invitation

- **Promise/evidence and entry:** IDENT-02, IDENT-03, IDENT-05, SEC-01, SECRES-01, SECRES-03; EP-03.
- **Begins / permissions:** Pending invitation with predetermined Member role; delivery by SMTP or trusted manual channel. Single-use 72-hour identity/purpose/instance-bound proof; no ordinary account access before MFA.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ENROLL with this actor and permissions. Member has no instance evidence/export or administration rights.
- **Acceptance:** Member enrollment and manual/SMTP delivery; link preview, wrong role/proof and MFA bypass negatives.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-MEMBER-ACCOUNT — Member: Authenticate and manage own security

- **Promise/evidence and entry:** IDENT-02, IDENT-05, IDENT-06, SEC-01, SECRES-03, SECRES-04; EP-04.
- **Begins / permissions:** Enrolled Member; existing password and TOTP or authorized recovery route. Own identity; password plus valid factor/code for replacement; current session alone insufficient.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACCOUNT with this actor and permissions. Member has no instance evidence/export or administration rights.
- **Acceptance:** Member normal login, own update/logout; replay, other-user mutation, expired session and session-only MFA replacement fail.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-OWNER-PEOPLE — Owner: Invite, grant roles, transfer ownership and disable users

- **Promise/evidence:** AUTHZ-02, AUTHZ-03, IDENT-03, IDENT-06, SEC-03, STATE-01, STATE-02.
- **Begins / entry:** Active Owner and target invited/active user; replacement Owner enrolled for transfer; EP-05.
- **Permissions / preconditions:** Current Owner; recent password/TOTP for role/contact changes; audit; final active enrolled Owner protected.
- **Happy path:** 1. Invite a user with fixed role (Pending/delivery status and manual link option) → 2. Change role or transfer ownership (Immediate current-role feedback) → 3. Disable user or revoke their sessions/MCP grants (Success before later request admission; history retained).
- **Alternate paths:** Revoke/reissue pending invitations independently; a second Owner is recommended, not required.
- **Failure paths:** Last-Owner disable/demotion/deletion, unenrolled ownership replacement, forbidden role or failed audit cannot mutate; SMTP failure does not activate invitation.
- **State transitions:** Pending → revoke/reissue → cancelled/new proof; active → disable → ineligible; role change → current permissions immediately.
- **Recovery:** Correct target/role; enroll replacement before ownership transfer; retry delivery or share manually; fix audit first.
- **Exit / reversal:** Cancel before explicit immediate action; completed grants/removals require another current-authorized action and never history rollback.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**Account change boundary:** Role changes use the full IDENT-02B/SECRES-06 immediate confirmation, recent password/TOTP, revision, generation/revocation and continuity contract in J-OWNER-ACCOUNT-EDIT. One-row People list leads to full detail under J-OWNER-PEOPLE-VIEW. Invitation/lifecycle/session administration remains Owner-only.

### J-OWNER-RECOVERY — Owner: Initiate separate MFA reset

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Eligible other user needs MFA recovery; EP-05.
- **Permissions / preconditions:** Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Owner, Administrator, Auditor or Member; atomically retain another active enrolled Owner.
- **Happy path:** Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status.
- **Alternate paths:** Reissue to otherwise eligible MFA-restricted user; both-lost target completes MFA first, then receives fresh password proof.
- **Failure paths:** Reject self, disabled/deleted/invited/unreviewed-restored or external/legacy targets, stale reauthentication, audit outage, wrong-purpose/expired/replayed proof, issuer revocation/demotion/recovery or changed generations; SMTP failure does not reverse committed security state; uncertain persistence cannot report success or restore authority; concurrent final-Owner restriction rejects and points to existing host recovery; invited/recovering/diagnostic users do not satisfy continuity.
- **State transitions:** Enrolled → issuance revokes factor/codes/sessions/MCP grants/references and advances generation → restricted enrolled:false; completion is separately mapped by target role.
- **Recovery:** Correct eligibility or reauthenticate; reissue revokes prior proof; natural issuer browser expiry alone does not invalidate eligible issuer; repair audit before retry; consult durable outcome after uncertainty.
- **Exit / reversal:** Cancel confirmation without mutation; expiry/cancellation/abandonment after issuance leaves target restricted; use authorized reissue or host recovery, never restore old factors.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**Approved form and visual acceptance (also J-ADMIN-CONFIG):** Five-step service setup retains every destination/authentication/policy option. Required fields use a visible asterisk, Required legend and programmatic required state; concise associated help explains non-obvious inputs. Repeated rows and wizard step labels remain in flow when errors/help/long values appear; adding and removing items cannot overlap. UX-IA08 plain labels and Secret detection explanation preserve exact advanced values. UX-V05/UX-C42 require matching-state/viewport screenshot comparison to the approved concepts, including Add service destinations; functional passing tests alone are insufficient. ACT-110 traces this validation/recovery path.

**UX4 completion (also Administrator):** Existing service sections are Details, Destinations, Authentication, Access & policy, Secret detection and Review changes; one populated section at a time, one global Guided/Advanced switch, exact literals retained. Creation retains five directly linked steps. Overview shows current grouped values or “No configuration is in use. This service cannot run yet.” Lifecycle, pending changes and missing-value readiness are independent. Direct links, browser Back/Forward and mode/section changes preserve safe edits and context; unchanged navigation does not create dirtiness. Actual unsaved departures offer Stay/Save for later/Discard. Invalid final review links each incomplete section. Adding a destination/credential announces and focuses it without jumping to the top. Service-default TLS is always visible and scoped; destination advanced view exposes inherit/on/off, exact/suffix/regex and schemes/ports with a return path. Placement help uses placeholders only. Service ID remains MCP-visible/copyable; exact imported IDs persist. Shared Secret detection navigation is explicitly instance-wide and guarded. ACT-111–113 trace these changes; UX-V05/UX-C42/UX-C43–53 visual and keyboard evidence remains required.

### J-OWNER-CREDENTIAL — Owner: Set, replace and delete unreferenced managed credentials

- **Promise/evidence:** CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03.
- **Begins / entry:** Service Authentication section and explicit Set/Replace value dialog; EP-07.
- **Permissions / preconditions:** Current configuration role; healthy audit; current key incarnation/value generation and durable dependencies checked.
- **Happy path:** 1. Open Set/Replace dialog, enter a new value and Save (No existing value fetched) → 2. Inspect durable immediate result and last successful actor/time (Affected references revoked, placement draft unchanged) → 3. Confirm deletion of an unreferenced key (Key removed, or changed dependencies require fresh confirmation). Referenced Delete follows J-OWNER-CREDENTIAL-CLEAR.
- **Alternate paths:** Placement metadata is draft/apply; explicit no-downstream-auth service needs no credential; migration uses intentionally supplied inputs only.
- **Failure paths:** Invalid values, arbitrary host-source read, dependency race, stale confirmation or audit outage reject; no logs/diffs/export disclose values.
- **State transitions:** Creation/rotation/deletion immediately changes managed value state; rollback cannot restore deleted or prior values.
- **Recovery:** Correct input without echoed secret; refresh and reconfirm changed dependencies. Referenced Delete clears value under J-OWNER-CREDENTIAL-CLEAR; actual key removal requires removal of applied and saved proposed references. Acquire fresh references after Set/Replace.
- **Exit / reversal:** Cancel clears temporary dialog input without mutation; unrelated Continue neither requires nor submits a value. After successful action another authorized Set/Replace is required, never reveal, draft discard or history undo. Unknown completion requires durable-status reconciliation before retry.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-OWNER-ACCESS — Owner: Assign service access and control service lifecycle

- **Promise/evidence:** AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03.
- **Begins / entry:** Existing eligible local/external identity and service; EP-08.
- **Permissions / preconditions:** Current configuration role; target eligible; durable audit; Administrator cannot invite users; bounded role/contact edits use SECRES-06.
- **Happy path:** 1. Grant or remove service assignment (Current access list and action result) → 2. Disable or archive service (Status and preserved audit/history) → 3. Restore archived service and review enablement (Review then activation result).
- **Alternate paths:** Initial new grants may accompany first service activation only with fresh explicit review; already-dispatched work may finish under admitted protection.
- **Failure paths:** Auditor execution, missing identity, last-moment revocation, stale wizard, disabled service dispatch or audit outage cannot grant/execute.
- **State transitions:** Grant/remove immediate; disable/archive immediate; unarchive never directly Active; old history cannot restore access.
- **Recovery:** Correct identity eligibility via Owner where needed; refresh access list after conflict; explicitly review current service to re-enable.
- **Exit / reversal:** Cancel before immediate action; deliberate new grant/re-enable reverses removal only under current checks; no remote-side-effect rollback.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**UX4 lifecycle and assignment completion (also Administrator):** EP-06 row has a real settings link/full-row hit area excluding sibling Enable/Disable/Delete buttons. Confirmation states Delete archives, stops new execution and revokes references while retaining history/configuration/audit; cancel does nothing. Archived filtering exposes restore to Disabled, then explicit current-dependency review before enable. Active plus draft and Active plus Value missing are separate truthful states, not reachability checks. Access explains MCP eligibility and policy; existing assignment changes are immediate confirmed actions, while proposed initial grants await reviewed activation. Read-only viewers cannot mutate. ACT-114/115 map status, cancel and return paths.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**UX4 editing completion (also Administrator):** Add rule opens the same focused dialog as Edit from distinct rows. Save keeps changes only in the draft; Cancel leaves it unchanged. Contextual Delete removes a draft rule, not the live policy. Select common methods while preserving supported custom/imported methods and literal patterns/options/IDs. Default Allow/Deny applies only without a match and does not restrict opposite-effect rules. Explain reason, priority/ties and disabled reorder directions; keyboard reorder cannot silently change numeric priorities. Tester is a separate non-stacked dialog; closing restores origin focus/scroll, preserves edits and never dirties an unchanged draft. Local errors keep safe input; linked review errors return to the exact rule. ACT-116–118 cover these paths.

### J-OWNER-HISTORY — Owner: Import, export and restore permitted configuration

- **Promise/evidence:** MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03.
- **Begins / entry:** Legacy YAML/catalogs or existing applied history; authenticated actor; EP-10.
- **Permissions / preconditions:** Current permissions for every imported/history setting; deliberate credential sources; no email-only identity grant.
- **Happy path:** 1. Import files or choose earlier revision (Unknown fields, missing credentials/identities and impact listed) → 2. Resolve credentials and explicit identities (Missing values keep service inactive) → 3. Review/apply or export sanitized configuration (No routine restart; reconnect notice when identity/endpoint changes).
- **Alternate paths:** Latest 50 applied revisions retained; guided/form/advanced editor round trips preserve identifiers, priorities, match semantics, exceptions and both catalogs; secret-bearing recovery uses encrypted backup, not export.
- **Failure paths:** Malformed/unknown fields, arbitrary host source, forbidden setting, missing/deleted secret or obsolete grant/lifecycle snapshot rejected; audit outage blocks mutations/export.
- **State transitions:** Import/history → fresh draft → applied; no live grant/identity/lifecycle/secret rollback; old YAML/env cannot override managed authority.
- **Recovery:** Resolve each explicit error; resupply intended secret; map identity with appropriate authority; retry fresh review after conflict.
- **Exit / reversal:** Cancel import or leave draft unapplied; prior configuration remains active on failure; export does not mutate configuration.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**UX4 import recovery completion (also Administrator):** An unresolved-identity notice lists each legacy subject and affected service/field with a Resolve identities route from the imported draft and Review. Mapping is distinct from picking a proposed service assignee. Choose an eligible existing local/external identity or deliberately remove the legacy assignment; neither creates an implicit grant or activates a service. Missing eligible identities route to the permitted identity-management action or an Owner request while retaining the draft. Returning preserves unrelated safe edits; resolve remaining blockers then perform fresh review/current-eligibility checks. Stale mappings, lost authority or missing credentials keep activation blocked with a specific next action. ACT-119 maps correction and cancellation without forced blind re-import.

### J-ADMIN-CONFIG — Administrator: Configure and apply service and scanner settings

- **Promise/evidence and entry:** BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02; EP-06.
- **Begins / permissions:** Active Administrator; service creation or editable existing service. Current per-setting configuration permission; audit; no implicit MCP grant; Owner-only settings excluded.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-CONFIG with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** All existing configuration fields round-trip; invalid input, stale apply and mixed-owner-setting negatives; keyboard/narrow screens; first simple service within 15 minutes.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-ADMIN-CREDENTIAL — Administrator: Set, replace and delete unreferenced managed credentials

- **Promise/evidence and entry:** CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03; EP-07.
- **Begins / permissions:** Service Authentication section and explicit Set/Replace value dialog. Current configuration role; healthy audit; current key incarnation/value generation and durable dependencies checked.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-CREDENTIAL with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Write-only creation/rotation and dependency-safe deletion; canary leaks, arbitrary host reads and old-reference use fail.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-ADMIN-ACCESS — Administrator: Assign service access and control service lifecycle

- **Promise/evidence and entry:** AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03; EP-08.
- **Begins / permissions:** Existing eligible local/external identity and service. Current configuration role; target eligible; durable audit; Administrator cannot invite users; bounded role/contact edits use SECRES-06.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACCESS with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Grant/remove/disable/archive/unarchive success; Auditor/unassigned admin and queued stale requests denied; completed request cannot revive references.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-ADMIN-POLICY — Administrator: Inspect, edit and safely test policy

- **Promise/evidence and entry:** POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05; EP-09.
- **Begins / permissions:** Editable service policy and candidate identity/destination/method/path. Current configuration role; policy tester uses permitted configuration and identity metadata.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-POLICY with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Preview/runtime agreement including ties/defaults/canonical path; malformed inputs and zero substitution/I/O checks; self-signed TLS test in runtime regression.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-ADMIN-HISTORY — Administrator: Import, export and restore permitted configuration

- **Promise/evidence and entry:** MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03; EP-10.
- **Begins / permissions:** Legacy YAML/catalogs or existing applied history; authenticated actor. Current permissions for every imported/history setting; deliberate credential sources; no email-only identity grant.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-HISTORY with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** All legacy fields and catalogs preserved; missing/unknown inputs fail; history cannot restore secrets/access or Owner-only settings; no stale-env override.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-ADMIN-ACTIVITY — Administrator: Investigate permitted activity and export evidence

- **Promise/evidence and entry:** AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04; EP-11.
- **Begins / permissions:** Authenticated Administrator; recorded events or denial identifier. Current evidence-read/export role; never raw secrets; export requires durable audit.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACTIVITY with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Administrator scoped list/detail; forbidden actor/service data, secret canaries and raw body exposure denied; denial diagnosis within two minutes.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-AUDITOR-ACTIVITY — Auditor: Investigate permitted activity and export evidence

- **Promise/evidence and entry:** AUDIT-01, AUDIT-02, AUDIT-03, OPS-06, UX-01, UX-03, UX-04; EP-11.
- **Begins / permissions:** Authenticated Auditor; recorded events or denial identifier. Current evidence-read/export role; never raw secrets; export requires durable audit.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-ACTIVITY with this actor and permissions. Auditor is evidence/configuration read-only and cannot execute MCP; activity inspection has no execution entitlement.
- **Acceptance:** Auditor scoped list/detail; forbidden actor/service data, secret canaries and raw body exposure denied; denial diagnosis within two minutes.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-OWNER-SETTINGS — Owner: Configure authentication, SMTP, limits and retention

- **Promise/evidence:** IDENT-04, MCP-02, OPS-02, OPS-03, OPS-04, CAP-CFG-06, UX-02, STATE-01, STATE-02.
- **Begins / entry:** Active Owner; known SMTP/authorization values and current usage; EP-12.
- **Permissions / preconditions:** Current Owner; recent authentication for authentication/recovery-material changes; audit.
- **Settings interaction:** Focused groups replace the all-settings scrolling form; user-friendly controls and plain-language summaries replace routine JSON, while all supported values remain editable and survive round trips. UX-IA05 supplies six focused destinations, a desktop rail and narrow select; UX-IN10 supplies populated forms and full-scope review. Owner edits instance authentication/SMTP/limits/retention; Administrator edits only response protection within existing configuration permission; Auditor sees non-secret read-only configuration; Member gains no Settings access.
- **Deletion boundary:** J-OWNER-SMTP-DELETE is separate from Save/Review/Apply; disabling SMTP retains credentials and deleting never silently changes authentication mode.
- **Happy path:** 1. Edit advanced instance settings (Units/defaults/current use and capacity effect) → 2. Review and apply settings (Applied; reconnect warnings or errors) → 3. Test SMTP and inspect status (Test success/failure; optional manual workflow remains).
- **Alternate paths:** Built-in OAuth is normal; external issuer/subject registration or legacy mode explicitly selected; no browser SSO. Capacity below use blocks new allocations without eviction.
- **Failure paths:** Invalid setting combinations, SMTP error, stale apply, non-Owner attempt or audit failure reject relevant operation; mail outage alone does not block gateway.
- **State transitions:** Draft → reviewed apply → active; email success/failure changes status only; retention shortening explicit, never hidden disk-pressure deletion.
- **Recovery:** Correct field and retry test; use trusted manual invitations; restore valid limit; operator repairs underlying storage.
- **Exit / reversal:** Abandon unapplied settings or explicitly apply new values; no hidden override from old environment/YAML.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**Populated-form lifecycle (UX-IA05, UX-IN10):** Enter directly into loaded current non-secret values labeled In use, or saved changes labeled Saved for later · Not in use yet. Loading/unavailable/unconfigured are distinct; never display undefined or sample defaults as current. Browser edits become Unsaved changes. Review changes validates and durably saves authorized work then opens Review all changes with every changed section; Apply N changes activates exactly that reviewed set atomically. Save for later explicitly says it is not in use. No-op submission is disabled. Navigate/search with unsaved input using Stay, Save for later and continue, or Discard unsaved edits and continue; that discard cannot remove other saved sections. Saved-change discard separately confirms its scope. Errors retain authorized non-secret work, reveal affected section and focus its field. Stale authority/revision requires compare/reload and fresh review; unknown save/apply outcome requires state lookup before retry. Return to edit retains section/context. Successful apply refreshes current values/revision; no routine duplicate read-only/edit pages. ACT-105–107.

**SMTP transport and test:** TLS (encrypted) is implicit TLS and default for new/legacy missing mode; None (unencrypted) is explicitly supported with independent optional SMTP authentication. Reject unknown mode; port cannot infer mode; TLS failure never falls back. None warning states messages, reset/invitation links and credentials can be read/altered. Enabling/changing None endpoint or authentication destination requires recent Owner password/TOTP and version-bound acknowledgment in review. Unchanged acknowledged settings need no repeated delivery dialog. Blank unchanged password retains encrypted value with version fencing; never prefill it. Test uses applied settings, so apply pending changes first, with equivalent None authority/acknowledgment. Queued delivery rechecks enabled/revision/mode/credential; bounded in-flight mail cannot rewrite settings. Restored None requires new current-Owner review before dispatch. Sanitized connection failure leaves current configuration and manual recovery routes intact; disable and deletion remain distinct. ACT-104/108; SECRES-07/STATE-08.

**Diagnostics and backups:** Schedule/retention and diagnostic level use the same save/review/apply states. Standard (info) and Detailed (debug) show current revision consistently; do not render a contradictory static applied value. Health status retains independent refresh/last-checked time. Applied retention may have separately pending/failed cleanup; do not call activation failed when cleanup alone fails. ACT-109. Administrator can use the same pattern only for permitted secret detection; Auditor sees grouped current read-only values and no review action.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-ADMIN-CLIENT — Administrator: Connect and revoke ChatGPT or Codex

- **Promise/evidence and entry:** AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01; EP-13.
- **Begins / permissions:** Enrolled Administrator; network-reachable MCP URL; explicit eligible service assignment. Local password/MFA plus per-user OAuth consent; client/redirect/PKCE/scopes validated; audit.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-CLIENT with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Real ChatGPT/Codex for assigned Administrator; unassigned admin, invalid PKCE/redirect, replay and revoked access negatives.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-MEMBER-CLIENT — Member: Connect and revoke ChatGPT or Codex

- **Promise/evidence and entry:** AUTHZ-01, MCP-01, MCP-03, IDENT-06, SECRES-01; EP-13.
- **Begins / permissions:** Enrolled Member; network-reachable MCP URL; explicit eligible service assignment. Local password/MFA plus per-user OAuth consent; client/redirect/PKCE/scopes validated; audit.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-CLIENT with this actor and permissions. Member has no instance evidence/export or administration rights.
- **Acceptance:** Real ChatGPT/Codex for assigned Member; unassigned admin, invalid PKCE/redirect, replay and revoked access negatives.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**STATE-09 admission extension:** A missing applied credential blocks reference issuance and queued dispatch before substitution; draft-only absence does not interrupt the valid active revision. Clear revokes old references, but already-dispatched work retains admitted secret protection and cannot mint usable revoked references on late completion. Failure and restart reconciliation fence uncertain credential use. A deliberate Set requires fresh references and all other current eligibility checks; it does not enable a Disabled/Archived service. ACT-121/122 supplement ACT-052/053.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**Schedule path:** Schedule and retention are populated forms using J-OWNER-SETTINGS and ACT-105–109: save for later remains inactive across navigation/reload, full review includes other pending Settings sections, apply refreshes actual running values. Create/download/restore remain separate job actions. Backup includes available STATE-07 metadata and STATE-08 mode at the declared recovery point, never live acknowledgments or excluded authentication authority.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**Restored metadata/mail:** Preserve creation and label archived Last console sign-in as snapshot history until a qualifying local console sign-in; missing legacy values stay Unknown. Enrollment is not a sign-in. Preserve explicit None as proposed SMTP mode but prevent unencrypted dispatch until fresh current-Owner review/acknowledgment. Failed install rollback retains prior coherent local metadata; no archive date or acknowledgment grants access. STATE-07/08; ACT-108.

**STATE-09 recovery completion:** Retain snapshot missing/present value state and source-qualified historical actor attribution; never credit the restoring Owner or remap by email. Missing remains missing and all restored services stay Disabled until review. A Set cannot bypass that review or revive old references. Earlier encrypted archives may contain old values; completed current Clear is not retroactive erasure. Inconsistent owned projections/generations reject validation. ACT-122 maps backup/restore acceptance alongside J-OWNER-BACKUP, J-HOST-RESTORE and J-SYSTEM-BACKUP.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-ADMIN-DIAG — Administrator: Use read-only diagnosis during audit outage

- **Promise/evidence and entry:** AUDIT-04, OPS-03, SECRES-04, IDENT-06; EP-21.
- **Begins / permissions:** Existing Administrator session or password/TOTP with reliable replay/throttle state; audit unavailable. Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-DIAG with this actor and permissions. Administrative authority does not imply service execution.
- **Acceptance:** Administrator appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-AUDITOR-DIAG — Auditor: Use read-only diagnosis during audit outage

- **Promise/evidence and entry:** AUDIT-04, OPS-03, SECRES-04, IDENT-06; EP-21.
- **Begins / permissions:** Existing Auditor session or password/TOTP with reliable replay/throttle state; audit unavailable. Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-DIAG with this actor and permissions. Auditor is evidence/configuration read-only and cannot execute MCP; activity inspection has no execution entitlement.
- **Acceptance:** Auditor appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

### J-MEMBER-DIAG — Member: Use read-only diagnosis during audit outage

- **Promise/evidence and entry:** AUDIT-04, OPS-03, SECRES-04, IDENT-06; EP-21.
- **Begins / permissions:** Existing Member session or password/TOTP with reliable replay/throttle state; audit unavailable. Existing role-scoped reads only; new login restricted diagnostic authority; Member sees only own permitted activity.
- **Paths, state, recovery, exit and actions:** Follow J-OWNER-DIAG with this actor and permissions. Member has no instance evidence/export or administration rights.
- **Acceptance:** Member appropriate diagnostic reads; unreliable login, other-role data, exports and mutation bypass fail; logout works.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

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

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no gap.

**UX4 read path:** EP-06 exposes the same grouped sections, lifecycle/draft/readiness labels, current Overview and authorized credential actor metadata as read-only values. No Set/Replace/Clear, policy mutation or lifecycle controls are granted. Value absence never causes a stored value to be exposed. Members remain outside configuration visibility. ACT-120 covers read-only status/attribution and denial of direct mutation.

### J-OWNER-PASSWORD-RESET — Owner: Initiate separate password reset

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Eligible other user needs password recovery; EP-05.
- **Permissions / preconditions:** Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Owner, Administrator, Auditor or Member; target has enrolled factor.
- **Happy path:** Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status.
- **Alternate paths:** Normal public request remains non-enumerating; retained unused recovery code may substitute for current TOTP at completion.
- **Failure paths:** Reject self, disabled/deleted/invited/unreviewed-restored or external/legacy targets, stale reauthentication, audit outage, wrong-purpose/expired/replayed proof, issuer revocation/demotion/recovery or changed generations; SMTP failure does not reverse committed security state; uncertain persistence cannot report success or restore authority; proof issuance never locks out target.
- **State transitions:** Enrolled → proof issued, enrollment/password/factor/codes/sessions unchanged; successful target completion changes password only and revokes prior access.
- **Recovery:** Correct eligibility or reauthenticate; reissue revokes prior proof; natural issuer browser expiry alone does not invalidate eligible issuer; repair audit before retry; consult durable outcome after uncertainty.
- **Exit / reversal:** Cancel confirmation without mutation; expiry/cancellation leaves original password and factor intact; completion cannot be reversed through drafts/history.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-ADMIN-RECOVERY — Administrator: Initiate separate MFA reset

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Eligible other user needs MFA recovery; EP-05.
- **Permissions / preconditions:** Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Administrator, Auditor or Member; never an Owner; atomically retain another active enrolled Owner.
- **Happy path:** Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status.
- **Alternate paths:** Reissue to otherwise eligible MFA-restricted user; both-lost target completes MFA first, then receives fresh password proof.
- **Failure paths:** Reject self, disabled/deleted/invited/unreviewed-restored or external/legacy targets, stale reauthentication, audit outage, wrong-purpose/expired/replayed proof, issuer revocation/demotion/recovery or changed generations; SMTP failure does not reverse committed security state; uncertain persistence cannot report success or restore authority; concurrent final-Owner restriction rejects and points to existing host recovery; invited/recovering/diagnostic users do not satisfy continuity.
- **State transitions:** Enrolled → issuance revokes factor/codes/sessions/MCP grants/references and advances generation → restricted enrolled:false; completion is separately mapped by target role.
- **Recovery:** Correct eligibility or reauthenticate; reissue revokes prior proof; natural issuer browser expiry alone does not invalidate eligible issuer; repair audit before retry; consult durable outcome after uncertainty.
- **Exit / reversal:** Cancel confirmation without mutation; expiry/cancellation/abandonment after issuance leaves target restricted; use authorized reissue or host recovery, never restore old factors.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-ADMIN-PASSWORD-RESET — Administrator: Initiate separate password reset

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Eligible other user needs password recovery; EP-05.
- **Permissions / preconditions:** Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Administrator, Auditor or Member; never an Owner; target has enrolled factor.
- **Happy path:** Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status.
- **Alternate paths:** Normal public request remains non-enumerating; retained unused recovery code may substitute for current TOTP at completion.
- **Failure paths:** Reject self, disabled/deleted/invited/unreviewed-restored or external/legacy targets, stale reauthentication, audit outage, wrong-purpose/expired/replayed proof, issuer revocation/demotion/recovery or changed generations; SMTP failure does not reverse committed security state; uncertain persistence cannot report success or restore authority; proof issuance never locks out target.
- **State transitions:** Enrolled → proof issued, enrollment/password/factor/codes/sessions unchanged; successful target completion changes password only and revokes prior access.
- **Recovery:** Correct eligibility or reauthenticate; reissue revokes prior proof; natural issuer browser expiry alone does not invalidate eligible issuer; repair audit before retry; consult durable outcome after uncertainty.
- **Exit / reversal:** Cancel confirmation without mutation; expiry/cancellation leaves original password and factor intact; completion cannot be reversed through drafts/history.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-OWNER-PASSWORD-COMPLETE — Owner: Complete assisted password reset

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Enrolled target receives purpose-bound reset link; EP-24.
- **Permissions / preconditions:** Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer.
- **Happy path:** Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login.
- **Alternate paths:** Unused recovery code replaces current TOTP; other codes and existing TOTP remain valid.
- **Failure paths:** Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access.
- **State transitions:** Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained.
- **Recovery:** Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open.
- **Exit / reversal:** Abandonment changes no credentials; completion does not auto-login and cannot restore old authority.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-OWNER-MFA-COMPLETE — Owner: Complete assisted Authenticator enrollment

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Restricted enrolled:false target receives purpose-bound reset link; EP-24.
- **Permissions / preconditions:** Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer.
- **Happy path:** Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login.
- **Alternate paths:** No lost factor or forgotten password required for this ceremony; both-lost user next obtains a fresh password proof.
- **Failure paths:** Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access.
- **State transitions:** Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged.
- **Recovery:** Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open.
- **Exit / reversal:** Abandonment stays restricted until reissue/host recovery; no ordinary access from link and no restoration of old factors.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-ADMIN-PASSWORD-COMPLETE — Administrator: Complete assisted password reset

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Enrolled target receives purpose-bound reset link; EP-24.
- **Permissions / preconditions:** Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer.
- **Happy path:** Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login.
- **Alternate paths:** Unused recovery code replaces current TOTP; other codes and existing TOTP remain valid.
- **Failure paths:** Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access.
- **State transitions:** Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained.
- **Recovery:** Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open.
- **Exit / reversal:** Abandonment changes no credentials; completion does not auto-login and cannot restore old authority.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-ADMIN-MFA-COMPLETE — Administrator: Complete assisted Authenticator enrollment

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Restricted enrolled:false target receives purpose-bound reset link; EP-24.
- **Permissions / preconditions:** Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer.
- **Happy path:** Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login.
- **Alternate paths:** No lost factor or forgotten password required for this ceremony; both-lost user next obtains a fresh password proof.
- **Failure paths:** Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access.
- **State transitions:** Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged.
- **Recovery:** Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open.
- **Exit / reversal:** Abandonment stays restricted until reissue/host recovery; no ordinary access from link and no restoration of old factors.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-AUDITOR-PASSWORD-COMPLETE — Auditor: Complete assisted password reset

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Enrolled target receives purpose-bound reset link; EP-24.
- **Permissions / preconditions:** Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer.
- **Happy path:** Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login.
- **Alternate paths:** Unused recovery code replaces current TOTP; other codes and existing TOTP remain valid.
- **Failure paths:** Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access.
- **State transitions:** Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained.
- **Recovery:** Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open.
- **Exit / reversal:** Abandonment changes no credentials; completion does not auto-login and cannot restore old authority.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-AUDITOR-MFA-COMPLETE — Auditor: Complete assisted Authenticator enrollment

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Restricted enrolled:false target receives purpose-bound reset link; EP-24.
- **Permissions / preconditions:** Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer.
- **Happy path:** Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login.
- **Alternate paths:** No lost factor or forgotten password required for this ceremony; both-lost user next obtains a fresh password proof.
- **Failure paths:** Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access.
- **State transitions:** Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged.
- **Recovery:** Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open.
- **Exit / reversal:** Abandonment stays restricted until reissue/host recovery; no ordinary access from link and no restoration of old factors.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-MEMBER-PASSWORD-COMPLETE — Member: Complete assisted password reset

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Enrolled target receives purpose-bound reset link; EP-24.
- **Permissions / preconditions:** Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer.
- **Happy path:** Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login.
- **Alternate paths:** Unused recovery code replaces current TOTP; other codes and existing TOTP remain valid.
- **Failure paths:** Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access.
- **State transitions:** Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained.
- **Recovery:** Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open.
- **Exit / reversal:** Abandonment changes no credentials; completion does not auto-login and cannot restore old authority.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-MEMBER-MFA-COMPLETE — Member: Complete assisted Authenticator enrollment

- **Promise/evidence:** IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05.
- **Begins / entry:** Restricted enrolled:false target receives purpose-bound reset link; EP-24.
- **Permissions / preconditions:** Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer.
- **Happy path:** Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login.
- **Alternate paths:** No lost factor or forgotten password required for this ceremony; both-lost user next obtains a fresh password proof.
- **Failure paths:** Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access.
- **State transitions:** Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged.
- **Recovery:** Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open.
- **Exit / reversal:** Abandonment stays restricted until reissue/host recovery; no ordinary access from link and no restoration of old factors.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-OWNER-SMTP-DELETE — Owner: Delete SMTP credential independently

- **Promise/evidence:** IDENT-04, IDENT-06, CONFIG-03, CONFIG-04, AUDIT-01, AUDIT-04, STATE-01, STATE-02, STATE-03.
- **Begins / entry:** Current SMTP settings and credential metadata visible; EP-12.
- **Permissions / preconditions:** Current Owner, recent authentication, durable audit, current SMTP revision and credential version, no enabled dependency.
- **Happy path:** Choose Delete SMTP credential → if enabled dependency blocks, disable SMTP through ordinary review/apply → separately confirm current-version deletion → show absent credential with non-secret settings retained.
- **Alternate paths:** Already absent returns explicit absent result; SMTP creation/replacement remains encrypted write-only draft/review/apply; explicit valid unauthenticated SMTP remains possible without hidden fallback.
- **Failure paths:** Reject stale version/revision, concurrent replacement, role change, expired recent authentication, enabled dependency and audit admission failure; uncertain persistence fences new credential use and reports uncertainty.
- **State transitions:** Enabled → applied Disabled retains secret → explicit deletion removes live and pending copies, advances credential version/state revision and invalidates reviews; non-secret drafts survive for reload.
- **Recovery:** Reload sanitized metadata and non-secret edits; fresh value entry and new review/apply required to create or replace; history/blank fields/stale submissions cannot resurrect value; durable recovery selects coherent prior state or completed deletion.
- **Exit / reversal:** Cancel before deletion changes nothing; deletion cannot recall dispatched mail or destroy retained encrypted archives; pending sends recheck admission and late completion cannot restore secret.

**Assessment:** Complete specification; implementation Not verified in this review; reachability Indeterminate; no new specification gap.

### J-OWNER-PEOPLE-VIEW — Owner: Inspect People list and account details

- **Promise/evidence:** IDENT-02A, SECRES-06, STATE-07, UX-IA07, UX-02/04.
- **Begins / entry:** Authenticated Owner with current non-secret account visibility; EP-05 list and EP-25 detail.
- **Permissions / preconditions:** Existing scoped reads; no secrets or permission inferred from viewing. Auditor remains read-only; Member has no global People entry.
- **Happy path:** Open People & Access → scan one row per human account → activate real account link → inspect contact, role, lifecycle, immutable ID, Created and Last console sign-in with timezone → return to preserved list/filter context.
- **Alternate paths:** Keyboard activation and narrow layout preserve account identity/action order; Never means tracked but no qualifying sign-in, Unknown means absent legacy history, external mapping sign-in is Not applicable. Restored timestamp visibly identifies snapshot provenance. Editable controls appear only where separately permitted.
- **Failure paths:** Loading/error is not an empty successful list; forbidden/stale target or permission loss exposes no restricted detail. Metadata writes, secret projection and invented dates are rejected.
- **State transitions:** List → selected detail → list, with no identity/configuration mutation. Server read-only timestamp state remains intact.
- **Recovery:** Retry authorized read or return to permitted list; expired session requires ordinary login; unavailable legacy data stays honestly Unknown.
- **Exit / reversal:** Back or account link returns to preserved list; logout remains reachable. Nothing to undo.
- **Assessment:** Complete specification; implementation Not verified; reachability Indeterminate; no gap. ACT-099/100; required screenshot comparison UX-C42 includes desktop and narrow People.

### J-ADMIN-PEOPLE-VIEW — Administrator: Inspect People list and account details

- **Promise/evidence:** IDENT-02A, SECRES-06, STATE-07, UX-IA07, UX-02/04.
- **Begins / entry:** Authenticated Administrator with current non-secret account visibility; EP-05 list and EP-25 detail.
- **Permissions / preconditions:** Existing scoped reads; no secrets or permission inferred from viewing. Auditor remains read-only; Member has no global People entry.
- **Happy path:** Open People & Access → scan one row per human account → activate real account link → inspect contact, role, lifecycle, immutable ID, Created and Last console sign-in with timezone → return to preserved list/filter context.
- **Alternate paths:** Keyboard activation and narrow layout preserve account identity/action order; Never means tracked but no qualifying sign-in, Unknown means absent legacy history, external mapping sign-in is Not applicable. Restored timestamp visibly identifies snapshot provenance. Editable controls appear only where separately permitted.
- **Failure paths:** Loading/error is not an empty successful list; forbidden/stale target or permission loss exposes no restricted detail. Metadata writes, secret projection and invented dates are rejected.
- **State transitions:** List → selected detail → list, with no identity/configuration mutation. Server read-only timestamp state remains intact.
- **Recovery:** Retry authorized read or return to permitted list; expired session requires ordinary login; unavailable legacy data stays honestly Unknown.
- **Exit / reversal:** Back or account link returns to preserved list; logout remains reachable. Nothing to undo.
- **Assessment:** Complete specification; implementation Not verified; reachability Indeterminate; no gap. ACT-099/100; required screenshot comparison UX-C42 includes desktop and narrow People.

### J-AUDITOR-PEOPLE-VIEW — Auditor: Inspect People list and account details

- **Promise/evidence:** IDENT-02A, SECRES-06, STATE-07, UX-IA07, UX-02/04.
- **Begins / entry:** Authenticated Auditor with current non-secret account visibility; EP-05 list and EP-25 detail.
- **Permissions / preconditions:** Existing scoped reads; no secrets or permission inferred from viewing. Auditor remains read-only; Member has no global People entry.
- **Happy path:** Open People & Access → scan one row per human account → activate real account link → inspect contact, role, lifecycle, immutable ID, Created and Last console sign-in with timezone → return to preserved list/filter context.
- **Alternate paths:** Keyboard activation and narrow layout preserve account identity/action order; Never means tracked but no qualifying sign-in, Unknown means absent legacy history, external mapping sign-in is Not applicable. Restored timestamp visibly identifies snapshot provenance. Editable controls appear only where separately permitted.
- **Failure paths:** Loading/error is not an empty successful list; forbidden/stale target or permission loss exposes no restricted detail. Metadata writes, secret projection and invented dates are rejected.
- **State transitions:** List → selected detail → list, with no identity/configuration mutation. Server read-only timestamp state remains intact.
- **Recovery:** Retry authorized read or return to permitted list; expired session requires ordinary login; unavailable legacy data stays honestly Unknown.
- **Exit / reversal:** Back or account link returns to preserved list; logout remains reachable. Nothing to undo.
- **Assessment:** Complete specification; implementation Not verified; reachability Indeterminate; no gap. ACT-099/100; required screenshot comparison UX-C42 includes desktop and narrow People.

### J-OWNER-ACCOUNT-EDIT — Owner: Edit account contact and permitted role

- **Promise/evidence:** IDENT-02B, AUTHZ-02/03, IDENT-06, SECRES-06, UX-IN12.
- **Begins / entry:** Active enrolled Owner opens current local account detail EP-25 from EP-05.
- **Permissions / preconditions:** Owner may edit other local accounts including Owners, and own contact; self-demotion/transfer requires an enrolled replacement and continuity. Recent password/TOTP within five minutes, current actor/target/revision, explicit target/change confirmation and durable audit. Contact edits additionally confirm verification through previously established trusted channel; only category is recorded.
- **Happy path:** Edit existing contact/role → Review account changes → review immediate sign-out/revocation effects → reauthenticate/verify when required → confirm → show committed updated detail and separate notification outcome.
- **Alternate paths:** Permitted pending/disabled target fields can change without enrollment/activation. Self-contact success ends current session; normal login uses new contact with unchanged password/MFA. Owner reissues invalidated invitation or authorized recovery proof separately when necessary.
- **Failure paths:** Invalid/duplicate contact, forged metadata/lifecycle fields, forbidden Owner/self-role target, stale revision/authority, audit failure or concurrent final-enrolled-Owner loss rejects. Uncertain persistence never claims success or revives old grants. Old/new-contact notification failure cannot undo committed edit.
- **State transitions:** Confirmed immediate edit → target generation advances and sessions/MCP grants/references and target/issuer proofs invalidate; password/MFA/identity/lifecycle unchanged. Self-contact → logged out. Cancel/denial → no change; uncertainty → outcome lookup.
- **Recovery:** Preserve safe non-secret input; correct validation or reload current detail and re-review. Repair audit before retry. Resolve uncertain durable outcome before repeating mutation. SMTP unavailable leaves existing trusted manual processes available, not automatic enrollment.
- **Exit / reversal:** Cancel review without change; committed edit is not undone by configuration history. A subsequent edit requires current full authority and checks. Invitation/disable/reactivation/restored-user review and other-user sessions remain Owner-only.
- **Assessment:** Complete specification; implementation Not verified; reachability Indeterminate; no gap. ACT-101/102; SECRES-T12–14.

### J-ADMIN-ACCOUNT-EDIT — Administrator: Edit account contact and permitted role

- **Promise/evidence:** IDENT-02B, AUTHZ-02/03, IDENT-06, SECRES-06, UX-IN12.
- **Begins / entry:** Active enrolled Administrator opens current local account detail EP-25 from EP-05.
- **Permissions / preconditions:** Administrator may edit other Administrator/Auditor/Member contacts and roles only among those three, plus own contact; cannot target/grant Owner or edit own role. Recent password/TOTP within five minutes, current actor/target/revision, explicit target/change confirmation and durable audit. Contact edits additionally confirm verification through previously established trusted channel; only category is recorded.
- **Happy path:** Edit existing contact/role → Review account changes → review immediate sign-out/revocation effects → reauthenticate/verify when required → confirm → show committed updated detail and separate notification outcome.
- **Alternate paths:** Permitted pending/disabled target fields can change without enrollment/activation. Self-contact success ends current session; normal login uses new contact with unchanged password/MFA. Owner reissues invalidated invitation or authorized recovery proof separately when necessary.
- **Failure paths:** Invalid/duplicate contact, forged metadata/lifecycle fields, forbidden Owner/self-role target, stale revision/authority, audit failure or concurrent final-enrolled-Owner loss rejects. Uncertain persistence never claims success or revives old grants. Old/new-contact notification failure cannot undo committed edit.
- **State transitions:** Confirmed immediate edit → target generation advances and sessions/MCP grants/references and target/issuer proofs invalidate; password/MFA/identity/lifecycle unchanged. Self-contact → logged out. Cancel/denial → no change; uncertainty → outcome lookup.
- **Recovery:** Preserve safe non-secret input; correct validation or reload current detail and re-review. Repair audit before retry. Resolve uncertain durable outcome before repeating mutation. SMTP unavailable leaves existing trusted manual processes available, not automatic enrollment.
- **Exit / reversal:** Cancel review without change; committed edit is not undone by configuration history. A subsequent edit requires current full authority and checks. Invitation/disable/reactivation/restored-user review and other-user sessions remain Owner-only.
- **Assessment:** Complete specification; implementation Not verified; reachability Indeterminate; no gap. ACT-101/102; SECRES-T12–14.

### J-OWNER-CREDENTIAL-CLEAR — Owner: Clear an in-use service credential value

- **Promise/evidence:** CONFIG-02/03/04/05, AUTHZ-02, AUDIT-01/04, STATE-09, SECRES-08, UX-IN14.
- **Begins / entry:** Active enrolled Owner at EP-07; credential referenced by applied or saved proposed service configuration, including Disabled/Archived retained configurations.
- **Permissions / preconditions:** Current service-credential mutation authority and durable audit; exact key incarnation/value generation, configuration revision and dependencies bind the confirmation. No SMTP exception is implied.
- **Happy path:** Delete resolves dependencies → named dialog explains “clears only the value; key remains” and applied-versus-draft impact → confirm Clear value → durable result shows Missing and last successful actor/time, keeping configuration, assignments, lifecycle and safe draft work.
- **Alternate paths:** Saved-draft-only use retains key and blocks that draft’s activation, but leaves valid current execution unaffected. Already-cleared referenced key reports no-op without attribution change. Unreferenced key deletion uses J-OWNER-CREDENTIAL. Disabled/Archived remain so.
- **Failure paths:** Audit admission denial changes nothing; stale incarnation/value/dependency or revoked role rejects without switching to key deletion. Admitted write/completion uncertainty fences affected use across restart until durable state is reconciled; no success or automatic retry claim. Old intent replay cannot clear a later replacement.
- **State transitions:** Available/referenced → confirmed Clear → retained key/Missing plus generation revocation; applied dependency → new references/queued dispatch blocked; draft-only dependency → proposed activation blocked. Already Missing → no-op. Uncertain → fenced → reconciled known outcome.
- **Recovery:** Resolve durable outcome, then deliberate Set with current checks restores only otherwise eligible Active execution; other missing dependencies still block. Acquire fresh references. Set never enables Disabled/Archived/restored services or applies unrelated drafts.
- **Exit / reversal:** Cancel leaves state unchanged. Draft discard/history cannot restore value. Already-dispatched work may finish under admitted protection but cannot mint revoked references or repopulate stored values. Explicit whole-instance archive restore is separate and retains Disabled/review requirements.
- **Assessment:** Complete specification; implementation Not verified; reachability Indeterminate; no gap. ACT-121/122; required tests SECRES-T17–21 and STATE-09 acceptance.

### J-ADMIN-CREDENTIAL-CLEAR — Administrator: Clear an in-use service credential value

- **Promise/evidence and entry:** CONFIG-02/03/04/05, AUTHZ-02, AUDIT-01/04, STATE-09, SECRES-08, UX-IN14; EP-07.
- **Begins / permissions:** Active enrolled Administrator with current service-credential authority; no SMTP or whole-instance restore authority.
- **Happy, alternate and failure paths:** Follow J-OWNER-CREDENTIAL-CLEAR with this actor, including current dependency confirmation, no-op, stale rejection and uncertain-outcome fencing.
- **State transitions and recovery:** Same retained-key Missing and explicit Set semantics; never grant execution from administrative role, never bypass service lifecycle/recovery review. Host/Owner handles archive recovery if required.
- **Exit / reversal:** Cancel is non-mutating; discard/history cannot restore; the Administrator cannot perform an Owner-only whole-instance restore.
- **Assessment:** Complete specification; implementation Not verified; reachability Indeterminate; no gap. ACT-121/122; direct unauthorized role and restore attempts must fail.

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
| ACT-013 | J-OWNER-PEOPLE / 2 | Change role or transfer ownership | EP-05 | Specified: Recheck current authority/revision/continuity and apply SECRES-06 generation revocation | Each linked journey’s current role/ownership/preconditions; shared audit gate | Existing role → selected fixed role and target-generation revocation | Immediate current-role feedback; uncertainty lookup | J-OWNER-PEOPLE; no gap |
| ACT-014 | J-OWNER-PEOPLE / 3 | Disable user or revoke their sessions/MCP grants | EP-05 | Specified: Invalidate current eligibility and selected access immediately | Each linked journey’s current role/ownership/preconditions; shared audit gate | Active → disabled or grants revoked | Success before later request admission; history retained | J-OWNER-PEOPLE; no gap |
| ACT-015 | J-OWNER-RECOVERY / 1 | Verify person and authorize recovery | EP-05 | Specified: Record channel category; apply separate MFA restriction under SECRES-05; revoke target sessions/grants/references, factor and codes | Each linked journey’s current role/ownership/preconditions; shared audit gate | Active/locked-out → restricted recovery | Immediate restriction and single-use 30-minute enrollment link | J-OWNER-RECOVERY; no gap |
| ACT-016 | J-OWNER-RECOVERY / 2 | Deliver link manually or through SMTP | EP-05 | Specified: Deliver only bound proof; expose delivery result | Each linked journey’s current role/ownership/preconditions; shared audit gate | Restricted → awaiting enrollment | Safe delivery failure or pending status | J-OWNER-RECOVERY; no gap |
| ACT-017 | J-OWNER-RECOVERY / 3 | Review completion | EP-05 | Specified: Recheck current issuer/target generations and authority; consume proof once; target confirms fresh factor/codes; retain password | Each linked journey’s current role/ownership/preconditions; shared audit gate | Restricted → freshly enrolled eligible account; ordinary login required | Completion/security notice | J-OWNER-RECOVERY; no gap |
| ACT-018 | J-OWNER-CONFIG, J-ADMIN-CONFIG / 1 | Find service or start Add service | EP-06 | Specified: Search/filter and load permitted metadata or new draft | Each linked journey’s current role/ownership/preconditions; shared audit gate | Existing active config unchanged; new service Draft | Overview/Configuration/Access/Activity or five-step wizard | J-OWNER-CONFIG; no gap |
| ACT-019 | J-OWNER-CONFIG, J-ADMIN-CONFIG / 2 | Edit details, destinations, placement and scanning | EP-06 | Specified: Validate common/advanced fields in same draft | Each linked journey’s current role/ownership/preconditions; shared audit gate | Unsaved → saved unapplied draft | Effective summaries; exact/suffix/regex, TLS inheritance, multiple/no-auth placement and both catalogs retained | J-OWNER-CONFIG; no gap |
| ACT-020 | J-OWNER-CONFIG, J-ADMIN-CONFIG / 3 | Review differences and exceptions | EP-06 | Specified: Prepare sanitized scoped changes; check dependencies and proposed initial grants | Each linked journey’s current role/ownership/preconditions; shared audit gate | Draft → reviewed candidate | Affected services, exceptions and reconnect impact visible | J-OWNER-CONFIG; no gap |
| ACT-021 | J-OWNER-CONFIG, J-ADMIN-CONFIG / 4 | Apply explicitly | EP-06 | Specified: Recheck role/base/dependencies; activate atomically | Each linked journey’s current role/ownership/preconditions; shared audit gate | Old active revision → coherent new revision | Applied success; initial explicit grants may activate atomically | J-OWNER-CONFIG; no gap |
| ACT-022 | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL / 1 | Create or replace a credential value | EP-07 | Specified: Validate deliberately supplied canonical value and encrypt it | Each linked journey’s current role/ownership/preconditions; shared audit gate | Absent → available or version N → N+1 | Only label/placement/availability/version/last successful actor/time displayed | J-OWNER-CREDENTIAL; no gap |
| ACT-023 | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL / 2 | Confirm rotation | EP-07 | Specified: Commit explicit immediate value action and invalidate affected references | Each linked journey’s current role/ownership/preconditions; shared audit gate | Old affected references → revoked | Rotation result without saved-value reveal | J-OWNER-CREDENTIAL; no gap |
| ACT-024 | J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL / 3 | Delete unreferenced credential | EP-07 | Specified: Check current durable dependencies and confirmation incarnation/generation, then remove unreferenced key/value | Each linked journey’s current role/ownership/preconditions; shared audit gate | Available unreferenced → deleted | Deleted, or stale dependency requires fresh confirmation | J-OWNER-CREDENTIAL; no gap |
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
| ACT-085 | J-OWNER-PASSWORD-RESET / issuance or completion, alternates, failure and exit | Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status | EP-05 | Specified: enforce Initiate separate password reset contract; every rejection retains or restricts state as mapped | Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Owner, Administrator, Auditor or Member; target has enrolled factor | Enrolled → proof issued, enrollment/password/factor/codes/sessions unchanged; successful target completion changes password only and revokes prior access | Sanitized success or correction/reissue path; uncertainty never success; Cancel confirmation without mutation; expiry/cancellation leaves original password and factor intact; completion cannot be reversed through drafts/history | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-086 | J-ADMIN-RECOVERY / issuance or completion, alternates, failure and exit | Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status | EP-05 | Specified: enforce Initiate separate MFA reset contract; every rejection retains or restricts state as mapped | Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Administrator, Auditor or Member; never an Owner; atomically retain another active enrolled Owner | Enrolled → issuance revokes factor/codes/sessions/MCP grants/references and advances generation → restricted enrolled:false; completion is separately mapped by target role | Sanitized success or correction/reissue path; uncertainty never success; Cancel confirmation without mutation; expiry/cancellation/abandonment after issuance leaves target restricted; use authorized reissue or host recovery, never restore old factors | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-087 | J-ADMIN-PASSWORD-RESET / issuance or completion, alternates, failure and exit | Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status | EP-05 | Specified: enforce Initiate separate password reset contract; every rejection retains or restricts state as mapped | Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Administrator, Auditor or Member; never an Owner; target has enrolled factor | Enrolled → proof issued, enrollment/password/factor/codes/sessions unchanged; successful target completion changes password only and revokes prior access | Sanitized success or correction/reissue path; uncertainty never success; Cancel confirmation without mutation; expiry/cancellation leaves original password and factor intact; completion cannot be reversed through drafts/history | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-088 | J-OWNER-PASSWORD-COMPLETE / issuance or completion, alternates, failure and exit | Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login | EP-24 | Specified: enforce Complete assisted password reset contract; every rejection retains or restricts state as mapped | Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer | Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained | Sanitized success or correction/reissue path; uncertainty never success; Abandonment changes no credentials; completion does not auto-login and cannot restore old authority | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-089 | J-OWNER-MFA-COMPLETE / issuance or completion, alternates, failure and exit | Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login | EP-24 | Specified: enforce Complete assisted Authenticator enrollment contract; every rejection retains or restricts state as mapped | Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer | Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged | Sanitized success or correction/reissue path; uncertainty never success; Abandonment stays restricted until reissue/host recovery; no ordinary access from link and no restoration of old factors | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-090 | J-ADMIN-PASSWORD-COMPLETE / issuance or completion, alternates, failure and exit | Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login | EP-24 | Specified: enforce Complete assisted password reset contract; every rejection retains or restricts state as mapped | Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer | Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained | Sanitized success or correction/reissue path; uncertainty never success; Abandonment changes no credentials; completion does not auto-login and cannot restore old authority | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-091 | J-ADMIN-MFA-COMPLETE / issuance or completion, alternates, failure and exit | Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login | EP-24 | Specified: enforce Complete assisted Authenticator enrollment contract; every rejection retains or restricts state as mapped | Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer | Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged | Sanitized success or correction/reissue path; uncertainty never success; Abandonment stays restricted until reissue/host recovery; no ordinary access from link and no restoration of old factors | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-092 | J-AUDITOR-PASSWORD-COMPLETE / issuance or completion, alternates, failure and exit | Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login | EP-24 | Specified: enforce Complete assisted password reset contract; every rejection retains or restricts state as mapped | Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer | Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained | Sanitized success or correction/reissue path; uncertainty never success; Abandonment changes no credentials; completion does not auto-login and cannot restore old authority | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-093 | J-AUDITOR-MFA-COMPLETE / issuance or completion, alternates, failure and exit | Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login | EP-24 | Specified: enforce Complete assisted Authenticator enrollment contract; every rejection retains or restricts state as mapped | Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer | Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged | Sanitized success or correction/reissue path; uncertainty never success; Abandonment stays restricted until reissue/host recovery; no ordinary access from link and no restoration of old factors | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-094 | J-MEMBER-PASSWORD-COMPLETE / issuance or completion, alternates, failure and exit | Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login | EP-24 | Specified: enforce Complete assisted password reset contract; every rejection retains or restricts state as mapped | Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer | Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained | Sanitized success or correction/reissue path; uncertainty never success; Abandonment changes no credentials; completion does not auto-login and cannot restore old authority | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-095 | J-MEMBER-MFA-COMPLETE / issuance or completion, alternates, failure and exit | Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login | EP-24 | Specified: enforce Complete assisted Authenticator enrollment contract; every rejection retains or restricts state as mapped | Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer | Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged | Sanitized success or correction/reissue path; uncertainty never success; Abandonment stays restricted until reissue/host recovery; no ordinary access from link and no restoration of old factors | IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05; implementation Unverified |
| ACT-096 | J-OWNER-SMTP-DELETE / issuance or completion, alternates, failure and exit | Choose Delete SMTP credential → if enabled dependency blocks, disable SMTP through ordinary review/apply → separately confirm current-version deletion → show absent credential with non-secret settings retained | EP-12 | Specified: enforce Delete SMTP credential independently contract; every rejection retains or restricts state as mapped | Current Owner, recent authentication, durable audit, current SMTP revision and credential version, no enabled dependency | Enabled → applied Disabled retains secret → explicit deletion removes live and pending copies, advances credential version/state revision and invalidates reviews; non-secret drafts survive for reload | Sanitized success or correction/reissue path; uncertainty never success; Cancel before deletion changes nothing; deletion cannot recall dispatched mail or destroy retained encrypted archives; pending sends recheck admission and late completion cannot restore secret | IDENT-04, IDENT-06, CONFIG-03, CONFIG-04, AUDIT-01, AUDIT-04, STATE-01, STATE-02, STATE-03; implementation Unverified |
| ACT-097 | J-*-ACCOUNT, J-*-CONFIG, J-OWNER-SETTINGS / navigation | Navigate by control, deep link, back/forward or refresh | Existing primary/secondary navigation | Specified: resolve current permitted surface; no authority from selected state | Current role for destination and UX-IN10 unsaved guard | Current area changes; configuration does not apply from navigation | Active area indicated accessibly and independently of focus | PO-FB-006; UX-04; implementation Unverified |
| ACT-098 | J-OWNER-SETTINGS, J-ADMIN-CONFIG, J-AUDITOR-CONFIG / focused settings | Find and edit permitted settings or inspect read-only values | EP-12 or existing response-protection configuration ingress | Specified: friendly controls preserve complete configuration through scoped draft review/apply | Owner instance settings; Administrator response protection only; Auditor read only | Scoped draft changes only; active state unchanged until Apply | Focused populated forms/read-only groups, full-scope review, retained advanced values and inline errors | UX-02/03; UX-DESIGN-003 approved; implementation Unverified |
| ACT-099 | J-*-PEOPLE-VIEW / list | Open People and select account | EP-05 → EP-25 | Specified: Return current scoped non-secret account projection; implementation Unverified | Owner/Administrator/Auditor read scope | List → detail; no mutation | One row/account, real keyboard link, preserved return context | IDENT-02A; UX-IA07; no spec gap |
| ACT-100 | J-*-PEOPLE-VIEW / metadata | Read Created and Last console sign-in | EP-25 | Specified: Project server metadata and restored provenance; implementation Unverified | Same authorized account read; writes denied | No mutation; preserve known/Never/Unknown/Not applicable | Timezone, legacy explanation and historical source; unavailable read has retry | STATE-07; UX-IN12; no spec gap |
| ACT-101 | J-OWNER/ADMIN-ACCOUNT-EDIT / review | Edit contact/role and review change | EP-25 | Specified: Validate existing fields and current target revision; implementation Unverified | SECRES-06 actor/target/resulting-role matrix | Local edit → explicit immediate-action review | Target/effect, required verification and recent authentication; cancel unchanged | IDENT-02B; SECRES-06; no spec gap |
| ACT-102 | J-OWNER/ADMIN-ACCOUNT-EDIT / commit/failure | Confirm or cancel account change | EP-25 confirmation | Specified: Recheck revision/audit/continuity; commit generation-bound revocation; notify contacts; implementation Unverified | Current enrolled actor, five-minute password/TOTP, contact trusted-channel verification | Commit fields+generation; revoke authority; self-contact logs out; uncertainty fenced | Current detail or normal login; separate notice failure; stale reload or outcome lookup | SECRES-T12–14; UX-IN12; no spec gap |
| ACT-103 | J-*-ACCOUNT / successful admission | Finish password and factor login | EP-04 | Specified: Durably record full console sign-in without timestamp regression; implementation Unverified | Current eligibility and audit; exclude diagnostic/recovery/OAuth events | Session admission + latest server timestamp | Ordinary session; failure no fabricated date | IDENT-02A; STATE-07; no spec gap |
| ACT-104 | J-OWNER-SETTINGS / SMTP | Choose TLS or None and authentication independently | EP-12 Email | Specified: Validate exact mode, endpoint and credential dependencies; implementation Unverified | Owner; None current recent-authenticated version-bound acknowledgment | Unsaved → saved/reviewed → applied selected mode | Inline None risk, blank write-only retained password; unknown mode rejection | IDENT-04; SECRES-07; STATE-08; no spec gap |
| ACT-105 | J-OWNER-SETTINGS, J-ADMIN-CONFIG / entry/save | Read current values; edit; Save for later | EP-12 selected section | Specified: Load current or labeled saved state; durably save permitted draft; implementation Unverified | Current per-section write role; audit for save | In use → Unsaved → Saved for later, not active | No undefined/default fiction; no-op disabled; failure keeps safe input | CONFIG-03; UX-IN10; no spec gap |
| ACT-106 | J-OWNER-SETTINGS, J-ADMIN-CONFIG / review/apply | Review changes, return to edit or Apply N changes | EP-12 full review | Specified: Save authorized pending work then exact full-settings review and atomic activation; implementation Unverified | Every included section current permissions, revision/dependency, audit and exception checks | Saved → reviewed → coherent applied revision; stale stays unapplied | Every changed section/current/proposed shown; refreshed in-use values or safe compare/reload | STATE-01/02; UX-IA05; UX-IN10; no spec gap |
| ACT-107 | J-OWNER-SETTINGS, J-ADMIN-CONFIG / navigation/failure | Navigate/search or discard safe edits | EP-12 section/search/field error | Specified: Preserve authorized state; save or discard only explicit scope; implementation Unverified | Per-section current authority; audit for durable mutation | Stay, save-only continuation, or discard current unsaved input | Saved other sections retained; cross-section error focus; unknown outcome lookup | UX-IA05; UX-IN10; no spec gap |
| ACT-108 | J-OWNER-SETTINGS, J-OWNER-RESUME / mail | Test applied email or review restored None | EP-12 Email | Specified: Same-mode test and current queued-admission recheck; no TLS fallback; implementation Unverified | Owner, audit, equivalent None acknowledgment; restore fresh authority | Delivery outcome only; archived mode cannot authorize dispatch | Sanitized success/failure; apply pending settings first; manual fallback | SECRES-07; STATE-08; UX-IN13; no spec gap |
| ACT-109 | J-OWNER-SETTINGS, J-OWNER-BACKUP / operations | Review/apply schedule, retention or diagnostics; refresh health | EP-12 Backups or Health | Specified: Activate same reviewed scope, refresh current revision; report cleanup separately; implementation Unverified | Owner writes; scoped health reads; audit | Applied schedule/info-debug revision; separate job/cleanup status | In use matches form; health last-checked; cleanup failure not activation rollback | BACKUP-02; OPS-03/04; UX-IN10; no spec gap |
| ACT-110 | J-OWNER/ADMIN-CONFIG, J-*-PEOPLE-VIEW, J-OWNER-SETTINGS / error/reflow | Complete labeled fields, add repeated rows and correct errors | EP-06, EP-12, EP-25 | Specified: Validate same preserved inputs; retain safe work and field-linked errors; implementation Unverified | Existing operation-specific permissions; no authority from visual state | Local form/error/review state only until authorized commit | Required legend/semantics, associated help, no overlap; matching-state/viewport fidelity evidence required | UX-IN11; UX-V05; UX-C42; no spec gap |
| ACT-111 | J-OWNER/ADMIN-CONFIG / mode/section/step | Switch Guided/Advanced or jump step | EP-06 global switch and real section/step links | Preserve same exact draft; validate when saving/reviewing | Current per-section role; no permission from route | Only view/location changes until explicit save | Safe fields and selected context preserved; incomplete review links correction | CONFIG-01/03; UX-IA09; UX-IN15 |
| ACT-112 | J-OWNER/ADMIN-CONFIG / navigation/recovery | Back/Forward, leave, return or cancel guard | EP-06 browser navigation and Stay/Save for later/Discard | Track real safe work and truthful save outcome; do not treat tester visit as edit | Current read/write scope; save requires audit | Unchanged remains clean; chosen save retains draft, not active changes | Return context restored; unknown save requires state check | UX-IN15; CONFIG-03 |
| ACT-113 | J-OWNER/ADMIN-CONFIG / destination/authentication | Add item or inspect focused advanced settings | EP-06 repeatable destinations/credentials and advanced return | Preserve exact IDs, literals, inheritance/overrides and supported placement | Current configuration role; metadata only | Draft edits only; adding item focuses it | Announce new item; contextual help, placeholder-only prefix/suffix, scoped TLS | UX-IN15; CONFIG-01; BASE-01 |
| ACT-114 | J-OWNER/ADMIN-ACCESS / lifecycle | Open row or confirm/cancel Disable/Delete/Enable | EP-06 row link and sibling actions; EP-08 | Current lifecycle/dependency check; Delete archives/revokes; restore Disabled | Current configuration role and audit; enable requires review | Active → Disabled/Archived; restore → Disabled; Cancel unchanged | Retained history and stop-new-request effect stated; blocked enable links correction | CONFIG-05; UX-IA09 |
| ACT-115 | J-OWNER/ADMIN-ACCESS / assignment | Inspect or change who can use service | EP-08 Access; proposed initial assignment in wizard | Current eligible identity assignment, immediate existing changes or reviewed initial grant | Current grant authority; no implicit admin execution | Confirmed add/remove or proposed unapplied grant | Clear current/proposed distinction; rule policy still applies | AUTHZ-01/02; UX-IA10 |
| ACT-116 | J-OWNER/ADMIN-POLICY / add/edit/cancel | Open Add/Edit, select methods and keep/cancel | EP-09 same focused rule dialog | Validate/preserve exact IDs, custom methods, patterns and typed options | Current configuration role; durable save requires audit | Local draft changed on keep; Cancel unchanged | Field errors; common methods selectable; unsupported literals never dropped | POLICY-01/02; UX-IN16 |
| ACT-117 | J-OWNER/ADMIN-POLICY / remove/reorder | Remove or reorder rule | EP-09 contextual row controls with keyboard equivalent | Draft-only change; retain numeric priority and tie semantics | Current configuration role; recheck at save/apply | Draft changes only; current policy unchanged | Explain unavailable move direction and pending removal | POLICY-01/02; UX-IN16 |
| ACT-118 | J-OWNER/ADMIN-POLICY / preview/close | Test policy then close | EP-09 tester dialog; no stacked dialogs | Evaluate selected permitted config without secret substitution/downstream call | Current preview/read scope and identity visibility | No grant, dispatch or dirty-state mutation | Winning rule/default, eligibility, target and reason; return origin focus/scroll | POLICY-03; UX-IN16 |
| ACT-119 | J-OWNER/ADMIN-HISTORY / mapping/recovery | Resolve imported legacy subject | EP-10 imported draft and Review → Resolve identities | Map exact legacy subject to eligible identity or deliberately remove assignment; revalidate | Current import/configuration and eligible-identity scope; Owner registration if needed | Unresolved proposed mapping → resolved draft; no activation | Subject/service/field and remaining blockers visible; preserve unrelated edits; cancel retains draft | MIGRATE-01/02; UX-IA10 |
| ACT-120 | J-AUDITOR-CONFIG and J-OWNER/ADMIN-CONFIG / read | Inspect status and last successful changer | EP-06 grouped Overview/Configuration; EP-07 metadata | Return permitted safe availability/version/actor/time; preserve source-qualified history | Current non-secret config and identity visibility; Member/direct mutation denied | Read only; no invented attribution | Lifecycle + draft + readiness; Unknown/former account/history honest; never value/fingerprint | CONFIG-02/05; STATE-09; UX-IA09 |
| ACT-121 | J-OWNER/ADMIN-CREDENTIAL-CLEAR / confirm/recover | Confirm Clear or cancel; reconcile uncertain status; Set later | EP-07 dependency-bound confirmation and Set dialog | Audit intent then coherent clear/generation revoke; status reconciliation before reuse | Current enrolled Owner/Admin, exact incarnation/version/revision/dependencies and audit | Referenced Available → Missing; no-op unchanged; uncertainty fenced; Set current generation only | Truthful impact, success/no-op/unknown; key/lifecycle retained; no secret echo | STATE-09; SECRES-08; UX-IN14 |
| ACT-122 | J-OWNER/ADMIN-CREDENTIAL; J-OWNER-BACKUP/RESUME; J-HOST-RESTORE; J-SYSTEM-BACKUP / durability | Observe restart/recovery and backup provenance | EP-07 metadata; EP-16–19 recovery status | Retain coherent absence/generations/actor; reject mixed projections; fence old readers/replay | Existing Owner/host restore authority; no Admin restore; shared audit | Restored services Disabled; historical actor retained; missing stays missing | No retroactive archive erasure claim; unknown legacy actor; new local mutation distinguished | BACKUP-01/05; STATE-09; SECRES-08 |

## Lifecycle completeness

| Lifecycle Area | Actor | Required Flow | Entry Point | Success / Terminal State | Failure / Recovery | Status | Evidence / Gap |
|---|---|---|---|---|---|---|---|
| Deployment/bootstrap | Host operator; Owner | J-HOST-01; J-OWNER-01 | EP-01–02 | First enrolled Owner | Expired proof/startup failure → protected reissue/repair | Complete | IDENT-01; SECRES-02 |
| Onboarding/role assignment | All four local roles; Owner | J-*-ENROLL; J-OWNER-PEOPLE | EP-03, EP-05 | Predetermined role after MFA | Invalid link → reissue; delivery failure → manual channel | Complete | IDENT-02–04 |
| Login/expiry/logout | All four local roles | J-*-ACCOUNT | EP-04 | Session or logged out | Invalid factors/throttle → safe retry/recovery | Complete | IDENT-05–06; SECRES-03/04 |
| Recovery/offboarding | Owner/host and target identity | J-OWNER-RECOVERY; J-HOST-RECOVERY; J-OWNER-PEOPLE | EP-05, EP-20 | Restricted reenrollment or disabled user | Last Owner protected; audit repair precedes mutation | Complete | AUTHZ-03; IDENT-05 |
| Configuration/retry/undo | Owner; Administrator | J-*-CONFIG/POLICY/HISTORY | EP-06, EP-09–10 | Applied coherent revision | Inline correction/stale compare; history creates new permitted draft | Complete | CONFIG-03–04; STATE-01–03 |
| Credential deletion | Owner; Administrator | J-*-CREDENTIAL | EP-07 | Dependency-free deletion; no historic value revival | Referenced Delete clears value and retains key; changed dependencies require fresh confirmation | Complete | CONFIG-02; STATE-03/09; SECRES-08 |
| Service archive/restore | Owner; Administrator | J-*-ACCESS | EP-08 | Archived → Disabled → reviewed Active | Invalid dependency prevents enable; explicit grant required | Complete | CONFIG-05 |
| Integration consent/revocation | Eligible roles; external/legacy identity; MCP client | J-*-CLIENT; J-EXTERNAL-01; J-LEGACY-01; J-MCP-* | EP-13–15 | Granted/revoked; request complete/denied | Correct URL, scope, identity, reference or client setup | Complete | MCP-01–04; BASE-01 |
| Evidence export/retention | Evidence roles; automation | J-*-ACTIVITY; J-SYSTEM-BACKUP | EP-11, EP-17 | Sanitized evidence or audited expiry | Audit outage stops exports/deletion; scoped viewing survives | Complete | AUDIT-01–04; OPS-04/06 |
| Backup/restore | Owner; host; automation | J-OWNER-BACKUP/RESTORE/RESUME; J-HOST-RESTORE | EP-16–19 | Consistent archive; restricted recovered state then review | Validation rejection; install rollback/host repair; reenrollment | Complete | BACKUP-01–06; STATE-04–06 |
| Outage diagnosis | Every role; host | J-*-DIAG; J-HOST-RECOVERY | EP-20–23 | Durable repair then fresh normal authentication | No web bypass; failed safety state leaves host diagnosis | Complete | AUDIT-04; SECRES-04 |
| Tenant/account purge | Not a promised role/capability | N/A: single organization; disable/archive are intended exits | N/A: no tenant UI | N/A: no tenant lifecycle promised | No invented permanent-user/tenant purge workflow | N/A: explicitly excluded or unpromised | D-001; AUTHZ-03; CONFIG-05 |
| Background cancellation | Owner/operator | Job status and safe bounded completion, not arbitrary cancel | EP-16–18 | Completed/failed job; preview can be abandoned | Restore crash recovers coherent state; no claim of remote undo | Complete at stated scope | BACKUP-02–04; STATE-04–05 |
| Separate assisted reset | Owner/Administrator initiator; four human target roles | J-*-RECOVERY; J-*-PASSWORD-RESET; J-*-PASSWORD-COMPLETE; J-*-MFA-COMPLETE | EP-05, EP-24 | Password issuance retains access; MFA issuance restricts; target completion requires normal login | Hierarchy, generation, final enrolled Owner and audit checks; reissue/host recovery; no implicit access | Complete at specified outcome | SECRES-05; IDENT-05/06 |
| SMTP credential deletion | Owner only | J-OWNER-SMTP-DELETE | EP-12 | Current and pending values deleted independently of Apply | Enabled dependency blocks; disable/apply then delete; uncertainty fences; reload current revision | Complete | IDENT-04; STATE-01/02/03 amendment |


## Interface and reachability mismatches

### Unreachable capabilities

None found at specification level. Runtime reachability is Indeterminate for all journeys because this is definition-only revalidation, not runtime verification.

### Backend capabilities without user-facing interfaces

None found at specification level. Management capabilities have console ingress; MCP tools have authenticated documented client ingress; scheduled jobs have configured triggers/status; host repair intentionally uses protected operator ingress. Approved UX supplies visual control placement; exact management API routes remain architecture implementation choices.

### Interfaces without supporting backend behavior

None found at specification level. Services, People & Access, Activity and Settings each map to specified responsibilities, authorization, state and outcomes. No speculative dashboard or orphan navigation is added.

### Orphaned behavior

Not evaluated in implementation: source/runtime inspection is out of scope. No normative unowned behavior found. Dependencies such as SMTP and downstream responses belong to their invoking journeys.

## Coverage matrix

Each row represents one actor-specific behavior bundle; the Capability cell enumerates every requirement family it covers. Related sequential operations remain grouped when they have one permission/entry/lifecycle contract; materially different Owner, Administrator, Auditor, Member, external, legacy, host and system paths are separate. This is the audit’s current eight-surface matrix, not a copy of the upstream coverage artifact.

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
| J-OWNER-PEOPLE — Invite, grant roles, transfer ownership and disable users; AUTHZ-02, AUTHZ-03, IDENT-03, IDENT-06, SEC-03, STATE-01, STATE-02 | Specified: Owner | Specified: EP-05 | Specified: action chain in J-OWNER-PEOPLE and linked ACT rows. Unverified: implementation. | Specified: Pending → revoke/reissue → cancelled/new proof. Full transitions: J-OWNER-PEOPLE | Specified: Current Owner; recent password/TOTP for role/contact changes; audit; final active enrolled Owner protected | Specified: J-OWNER-PEOPLE failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Every fixed-role permission cell; one-minute disable target; last Owner and demotion/admission races rejected. Unverified: execution. |
| J-OWNER-RECOVERY — Initiate separate MFA reset; IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, SECRES-01, SECRES-03, SECRES-05 | Specified: Owner | Specified: EP-05 | Specified: action chain in J-OWNER-RECOVERY and linked ACT rows. Unverified: implementation. | Specified: Authorized recovery → sessions/grants invalid and account restricted. Full transitions: J-OWNER-RECOVERY | Specified: Current enrolled Owner; recent password/TOTP; verified trusted channel; eligible other target; current issuer/target generations; final enrolled Owner continuity and audit admission | Specified: J-OWNER-RECOVERY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: SECRES-T08/10/11: manual/SMTP recovery; target/issuer hierarchy and generation, final Owner concurrency, expired/cancelled/replayed proof, uncertain state and audit denial; password reset remains separate. Unverified: execution. |
| J-OWNER-CONFIG — Configure and apply service and scanner settings; BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02 | Specified: Owner | Specified: EP-06 | Specified: action chain in J-OWNER-CONFIG and linked ACT rows. Unverified: implementation. | Specified: Draft → review → applied. Full transitions: J-OWNER-CONFIG | Specified: Current per-setting configuration permission; audit; no implicit MCP grant; Owner instance settings allowed only when explicitly included | Specified: J-OWNER-CONFIG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All existing configuration fields round-trip; invalid input, stale apply and mixed-owner-setting negatives; keyboard/narrow screens; first simple service within 15 minutes. Unverified: execution. |
| J-OWNER-CREDENTIAL — Set, replace and delete unreferenced managed credentials; CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03 | Specified: Owner | Specified: EP-07 | Specified: action chain in J-OWNER-CREDENTIAL and linked ACT rows. Unverified: implementation. | Specified: Creation/rotation/deletion immediately changes managed value state. Full transitions: J-OWNER-CREDENTIAL | Specified: Current configuration role; healthy audit; current key incarnation/value generation and durable dependencies checked | Specified: J-OWNER-CREDENTIAL failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Write-only creation/rotation and dependency-safe deletion; canary leaks, arbitrary host reads and old-reference use fail. Unverified: execution. |
| J-OWNER-ACCESS — Assign service access and control service lifecycle; AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03 | Specified: Owner | Specified: EP-08 | Specified: action chain in J-OWNER-ACCESS and linked ACT rows. Unverified: implementation. | Specified: Grant/remove immediate. Full transitions: J-OWNER-ACCESS | Specified: Current configuration role; target eligible; durable audit; Administrator cannot invite users; bounded role/contact edits use SECRES-06 | Specified: J-OWNER-ACCESS failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Grant/remove/disable/archive/unarchive success; Auditor/unassigned admin and queued stale requests denied; completed request cannot revive references. Unverified: execution. |
| J-OWNER-POLICY — Inspect, edit and safely test policy; POLICY-01, POLICY-02, POLICY-03, POLICY-04, SEC-02, CAP-CFG-05 | Specified: Owner | Specified: EP-09 | Specified: action chain in J-OWNER-POLICY and linked ACT rows. Unverified: implementation. | Specified: Draft → preview result → review → applied. Full transitions: J-OWNER-POLICY | Specified: Current configuration role; policy tester uses permitted configuration and identity metadata | Specified: J-OWNER-POLICY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Preview/runtime agreement including ties/defaults/canonical path; malformed inputs and zero substitution/I/O checks; self-signed TLS test in runtime regression. Unverified: execution. |
| J-OWNER-HISTORY — Import, export and restore permitted configuration; MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, CONFIG-04, BASE-03, STATE-03 | Specified: Owner | Specified: EP-10 | Specified: action chain in J-OWNER-HISTORY and linked ACT rows. Unverified: implementation. | Specified: Import/history → fresh draft → applied. Full transitions: J-OWNER-HISTORY | Specified: Current permissions for every imported/history setting; deliberate credential sources; no email-only identity grant | Specified: J-OWNER-HISTORY failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All legacy fields and catalogs preserved; missing/unknown inputs fail; history cannot restore secrets/access or Owner-only settings; no stale-env override. Unverified: execution. |
| J-ADMIN-CONFIG — Configure and apply service and scanner settings; BASE-02, CONFIG-01, CONFIG-03, UX-01, UX-02, UX-03, UX-04, POLICY-04, CAP-CFG-01, CAP-CFG-02, CAP-CFG-03, CAP-CFG-04, CAP-CFG-05, AUTHZ-04, STATE-01, STATE-02 | Specified: Administrator | Specified: EP-06 | Specified: action chain in J-ADMIN-CONFIG and linked ACT rows. Unverified: implementation. | Specified: Draft → review → applied. Full transitions: J-ADMIN-CONFIG | Specified: Current per-setting configuration permission; audit; no implicit MCP grant; Owner-only settings excluded | Specified: J-ADMIN-CONFIG failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: All existing configuration fields round-trip; invalid input, stale apply and mixed-owner-setting negatives; keyboard/narrow screens; first simple service within 15 minutes. Unverified: execution. |
| J-ADMIN-CREDENTIAL — Set, replace and delete unreferenced managed credentials; CONFIG-02, BASE-03, SEC-01, SEC-03, STATE-01, STATE-02, STATE-03 | Specified: Administrator | Specified: EP-07 | Specified: action chain in J-ADMIN-CREDENTIAL and linked ACT rows. Unverified: implementation. | Specified: Creation/rotation/deletion immediately changes managed value state. Full transitions: J-ADMIN-CREDENTIAL | Specified: Current configuration role; healthy audit; current key incarnation/value generation and durable dependencies checked | Specified: J-ADMIN-CREDENTIAL failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Write-only creation/rotation and dependency-safe deletion; canary leaks, arbitrary host reads and old-reference use fail. Unverified: execution. |
| J-ADMIN-ACCESS — Assign service access and control service lifecycle; AUTHZ-01, AUTHZ-02, CONFIG-05, SEC-03, STATE-01, STATE-02, STATE-03 | Specified: Administrator | Specified: EP-08 | Specified: action chain in J-ADMIN-ACCESS and linked ACT rows. Unverified: implementation. | Specified: Grant/remove immediate. Full transitions: J-ADMIN-ACCESS | Specified: Current configuration role; target eligible; durable audit; Administrator cannot invite users; bounded role/contact edits use SECRES-06 | Specified: J-ADMIN-ACCESS failure/recovery paths; safe rejection, current-role/audit and stated dependency checks. | Specified: Grant/remove/disable/archive/unarchive success; Auditor/unassigned admin and queued stale requests denied; completed request cannot revive references. Unverified: execution. |
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
| J-OWNER-PASSWORD-RESET — Initiate separate password reset; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Owner | Specified: EP-05 | Specified: Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status; Unverified: implementation | Specified: Enrolled → proof issued, enrollment/password/factor/codes/sessions unchanged; successful target completion changes password only and revokes prior access | Specified: Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Owner, Administrator, Auditor or Member; target has enrolled factor | Specified: Reject self, disabled/deleted/invited/unreviewed-restored or external/legacy targets, stale reauthentication, audit outage, wrong-purpose/expired/replayed proof, issuer revocation/demotion/recovery or changed generations; SMTP failure does not reverse committed security state; uncertain persistence cannot report success or restore authority; proof issuance never locks out target; Correct eligibility or reauthenticate; reissue revokes prior proof; natural issuer browser expiry alone does not invalidate eligible issuer; repair audit before retry; consult durable outcome after uncertainty | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-ADMIN-RECOVERY — Initiate separate MFA reset; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Administrator | Specified: EP-05 | Specified: Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status; Unverified: implementation | Specified: Enrolled → issuance revokes factor/codes/sessions/MCP grants/references and advances generation → restricted enrolled:false; completion is separately mapped by target role | Specified: Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Administrator, Auditor or Member; never an Owner; atomically retain another active enrolled Owner | Specified: Reject self, disabled/deleted/invited/unreviewed-restored or external/legacy targets, stale reauthentication, audit outage, wrong-purpose/expired/replayed proof, issuer revocation/demotion/recovery or changed generations; SMTP failure does not reverse committed security state; uncertain persistence cannot report success or restore authority; concurrent final-Owner restriction rejects and points to existing host recovery; invited/recovering/diagnostic users do not satisfy continuity; Correct eligibility or reauthenticate; reissue revokes prior proof; natural issuer browser expiry alone does not invalidate eligible issuer; repair audit before retry; consult durable outcome after uncertainty | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-ADMIN-PASSWORD-RESET — Initiate separate password reset; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Administrator | Specified: EP-05 | Specified: Select eligible target and reset purpose → verify person and reauthenticate → confirm → show one-time 30-minute proof for established SMTP/manual channel → inspect sanitized reset/delivery status; Unverified: implementation | Specified: Enrolled → proof issued, enrollment/password/factor/codes/sessions unchanged; successful target completion changes password only and revokes prior access | Specified: Active enrolled initiator; password/TOTP within five minutes; verified person through established trusted channel; named operation/target confirmation; durable audit; live issuer/target role and generation checks; target another Administrator, Auditor or Member; never an Owner; target has enrolled factor | Specified: Reject self, disabled/deleted/invited/unreviewed-restored or external/legacy targets, stale reauthentication, audit outage, wrong-purpose/expired/replayed proof, issuer revocation/demotion/recovery or changed generations; SMTP failure does not reverse committed security state; uncertain persistence cannot report success or restore authority; proof issuance never locks out target; Correct eligibility or reauthenticate; reissue revokes prior proof; natural issuer browser expiry alone does not invalidate eligible issuer; repair audit before retry; consult durable outcome after uncertainty | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-OWNER-PASSWORD-COMPLETE — Complete assisted password reset; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Owner | Specified: EP-24 | Specified: Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login; Unverified: implementation | Specified: Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained | Specified: Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer | Specified: Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access; Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-OWNER-MFA-COMPLETE — Complete assisted Authenticator enrollment; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Owner | Specified: EP-24 | Specified: Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login; Unverified: implementation | Specified: Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged | Specified: Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer | Specified: Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access; Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-ADMIN-PASSWORD-COMPLETE — Complete assisted password reset; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Administrator | Specified: EP-24 | Specified: Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login; Unverified: implementation | Specified: Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained | Specified: Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer | Specified: Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access; Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-ADMIN-MFA-COMPLETE — Complete assisted Authenticator enrollment; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Administrator | Specified: EP-24 | Specified: Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login; Unverified: implementation | Specified: Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged | Specified: Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer | Specified: Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access; Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-AUDITOR-PASSWORD-COMPLETE — Complete assisted password reset; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Auditor | Specified: EP-24 | Specified: Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login; Unverified: implementation | Specified: Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained | Specified: Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer | Specified: Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access; Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-AUDITOR-MFA-COMPLETE — Complete assisted Authenticator enrollment; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Auditor | Specified: EP-24 | Specified: Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login; Unverified: implementation | Specified: Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged | Specified: Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer | Specified: Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access; Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-MEMBER-PASSWORD-COMPLETE — Complete assisted password reset; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Member | Specified: EP-24 | Specified: Open link without mutation → provide new password and retained factor/code → atomically consume proof and used code → ordinary login; Unverified: implementation | Specified: Enrolled → password verifier replaced, proof/code consumed, generation advanced, all sessions/grants/references revoked; factor and remaining codes retained | Specified: Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; current TOTP or one unused recovery code plus valid new password; audit admission; Owner target requires Owner issuer | Specified: Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access; Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-MEMBER-MFA-COMPLETE — Complete assisted Authenticator enrollment; IDENT-04, IDENT-05, IDENT-06, AUTHZ-02, AUTHZ-03, AUDIT-01, AUDIT-04, SECRES-01, SECRES-03, SECRES-05 | Specified: Member | Specified: EP-24 | Specified: Open link without mutation → enroll and confirm fresh TOTP/recovery codes → consume proof atomically → ordinary password/MFA login; Unverified: implementation | Specified: Restricted → confirmed factor/codes, generation advanced, enrolled → logged out eligible account; password unchanged | Specified: Bound 30-minute proof; current instance/target/issuer generations and live issuer eligibility; otherwise eligible restricted identity; audit admission; Owner target requires Owner issuer | Specified: Reject purpose/target/instance mismatch, expired/replayed proof, issuer demotion/revocation/generation change, target lifecycle/generation change or promotion beyond issuer authority; concurrent completion succeeds once; audit/persistence uncertainty never grants access; Retain non-secret work after errors; never persist secret form values; authorized reissue consults current state and durable outcome; issuer browser need not remain open | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-OWNER-SMTP-DELETE — Delete SMTP credential independently; IDENT-04, IDENT-06, CONFIG-03, CONFIG-04, AUDIT-01, AUDIT-04, STATE-01, STATE-02, STATE-03 | Specified: Owner | Specified: EP-12 | Specified: Choose Delete SMTP credential → if enabled dependency blocks, disable SMTP through ordinary review/apply → separately confirm current-version deletion → show absent credential with non-secret settings retained; Unverified: implementation | Specified: Enabled → applied Disabled retains secret → explicit deletion removes live and pending copies, advances credential version/state revision and invalidates reviews; non-secret drafts survive for reload | Specified: Current Owner, recent authentication, durable audit, current SMTP revision and credential version, no enabled dependency | Specified: Reject stale version/revision, concurrent replacement, role change, expired recent authentication, enabled dependency and audit admission failure; uncertain persistence fences new credential use and reports uncertainty; Reload sanitized metadata and non-secret edits; fresh value entry and new review/apply required to create or replace; history/blank fields/stale submissions cannot resurrect value; durable recovery selects coherent prior state or completed deletion | Specified: positive completion plus each denial/recovery/abandonment path; SECRES-T08–11 or STATE SMTP cases as applicable. Unverified: execution |
| J-OWNER-PEOPLE-VIEW — Inspect People list and account details; IDENT-02A, SECRES-06, STATE-07, UX-02, UX-04 | Specified: Owner | Specified: EP-05/25 | Specified: J-OWNER-PEOPLE-VIEW and ACT-099–102; implementation Unverified | Specified: List/detail without mutation; known/Never/Unknown/Not applicable/historical | Specified: Read-only scoped account metadata | Specified: full failure/recovery/exit paths in J-OWNER-PEOPLE-VIEW | Specified: Metadata states, forbidden reads/writes, keyboard and responsive screenshot comparison; execution Unverified |
| J-ADMIN-PEOPLE-VIEW — Inspect People list and account details; IDENT-02A, SECRES-06, STATE-07, UX-02, UX-04 | Specified: Administrator | Specified: EP-05/25 | Specified: J-ADMIN-PEOPLE-VIEW and ACT-099–102; implementation Unverified | Specified: List/detail without mutation; known/Never/Unknown/Not applicable/historical | Specified: Read-only scoped account metadata | Specified: full failure/recovery/exit paths in J-ADMIN-PEOPLE-VIEW | Specified: Metadata states, forbidden reads/writes, keyboard and responsive screenshot comparison; execution Unverified |
| J-AUDITOR-PEOPLE-VIEW — Inspect People list and account details; IDENT-02A, SECRES-06, STATE-07, UX-02, UX-04 | Specified: Auditor | Specified: EP-05/25 | Specified: J-AUDITOR-PEOPLE-VIEW and ACT-099–102; implementation Unverified | Specified: List/detail without mutation; known/Never/Unknown/Not applicable/historical | Specified: Read-only scoped account metadata | Specified: full failure/recovery/exit paths in J-AUDITOR-PEOPLE-VIEW | Specified: Metadata states, forbidden reads/writes, keyboard and responsive screenshot comparison; execution Unverified |
| J-OWNER-ACCOUNT-EDIT — Edit account contact and permitted role; IDENT-02B, AUTHZ-02, AUTHZ-03, IDENT-06, SECRES-06 | Specified: Owner | Specified: EP-05/25 | Specified: J-OWNER-ACCOUNT-EDIT and ACT-099–102; implementation Unverified | Specified: Immediate contact/role update; generation revocation; self-contact logout | Specified: Owner may edit other local accounts including Owners, and own contact; self-demotion/transfer requires an enrolled replacement and continuity | Specified: full failure/recovery/exit paths in J-OWNER-ACCOUNT-EDIT | Specified: Role matrix, verified contact, stale/concurrent/uncertain writes, no activation, no notification rollback; execution Unverified |
| J-ADMIN-ACCOUNT-EDIT — Edit account contact and permitted role; IDENT-02B, AUTHZ-02, AUTHZ-03, IDENT-06, SECRES-06 | Specified: Administrator | Specified: EP-05/25 | Specified: J-ADMIN-ACCOUNT-EDIT and ACT-099–102; implementation Unverified | Specified: Immediate contact/role update; generation revocation; self-contact logout | Specified: Administrator may edit other Administrator/Auditor/Member contacts and roles only among those three, plus own contact; cannot target/grant Owner or edit own role | Specified: full failure/recovery/exit paths in J-ADMIN-ACCOUNT-EDIT | Specified: Role matrix, verified contact, stale/concurrent/uncertain writes, no activation, no notification rollback; execution Unverified |
| J-OWNER-CREDENTIAL-CLEAR — Clear in-use value; CONFIG-02/03/04/05; STATE-09; SECRES-08 | Specified: Owner | Specified: EP-07 Delete → Clear value confirmation | Specified: dependency-bound immediate clear and status reconciliation; ACT-121. Unverified: implementation | Specified: retained key Missing, generation fences, attribution; lifecycle unchanged | Specified: current enrolled service-credential role, audit and bound target/dependencies | Specified: stale/no-op/audit denial/unknown outcome; reconcile then deliberate Set | Specified: SECRES-T17–21, STATE-09 applied/draft-only, queued/late, restart, restore and leak negatives. Unverified: execution |
| J-ADMIN-CREDENTIAL-CLEAR — Clear in-use value; CONFIG-02/03/04/05; STATE-09; SECRES-08 | Specified: Administrator | Specified: EP-07 Delete → Clear value confirmation | Specified: dependency-bound immediate clear and status reconciliation; ACT-121. Unverified: implementation | Specified: retained key Missing, generation fences, attribution; lifecycle unchanged | Specified: current enrolled service-credential role, audit and bound target/dependencies | Specified: stale/no-op/audit denial/unknown outcome; reconcile then deliberate Set | Specified: SECRES-T17–21, STATE-09 applied/draft-only, queued/late, restart, restore and leak negatives. Unverified: execution |

## Gap register

None found. Zero Blocker, Major and Minor specification gaps; no implementation-gap claims. Deferred exact route/layout/mechanism choices are not missing product behavior.

## Remediation verification

The prior audit recorded no journey gaps: zero prior gap IDs require a new disposition. REC-001–007 are reconciliation findings, not invented journey-gap IDs. Targeted mappings below preserve their source identity and distinguish specified behavior from runtime evidence. The orchestrator’s earlier PRD findings F-PRD-001–004 are closed, not journey gaps: SECRES-01 provides bound-link exceptions, SECRES-02/STATE-05–06 restore authority/recovery, SECRES-04 audit-outage boundaries, and STATE-01–03 immediate versus draft/rollback semantics. The affected journeys verify those requirements without reopening accepted decisions.

### Second-feedback verification and visual contract

All 27 feedback items PO-FB-015–041 remain traceable through the confirmed package and REC-RUN-004/005. SECRES-06/07 and STATE-07/08 resolve role, metadata and SMTP semantics; UX-DESIGN-003 and canonical UX3 resolve composition, terminology, populated forms and save/apply clarity. No prior journey-gap ID is dropped or reclassified. Existing implementation reports (including reproduced service-step overlap and inconsistent value displays) remain delivery evidence, not disproved by specification PASS. This review does not claim those defects fixed.

| Feedback scope | Journey/action coverage | Required acceptance and safe failure/recovery |
|---|---|---|
| Plain language, Response protection, width | J-*-CONFIG; J-OWNER-SETTINGS; ACT-098/110 | Secret detection explains returned service data; old-term search; useful desktop width without stretched prose; responsive no-overflow |
| Service overlap, required inputs, hints | J-OWNER/ADMIN-CONFIG; ACT-110 | Add/remove repeated rows, long values, errors and help at desktop, 390px and 320 CSS px/enlarged text; programmatic required and linked error focus |
| People list/detail, editing and metadata | Five new actor journeys; ACT-099–103 | One row/account with real link; correct role restrictions; known/Never/Unknown/Not applicable/restored history; safe back/cancel and self-contact logout |
| SMTP completeness and prefilled current values | J-OWNER-SETTINGS/SMTP-DELETE/RESUME; ACT-104/108 | TLS/None plus authentication independent; no saved password reveal; applied test, acknowledgment, stale/revocation/audit and recovery fences |
| Backup save confusion; diagnostics mismatch | J-OWNER-SETTINGS/BACKUP; ACT-105–109 | Save-only survives reload inactive; full-scope atomic apply updates visible current state; cleanup separately reported; no fabricated undefined/stale applied summary |
| Match approved mockups | All changed screen journeys; UX-V05/UX-C42 | Actual/reference screenshots with matching state, role, data and viewport; record composition/width/density/type/spacing/control/color/rail differences and fix material drift or obtain explicit scoped acceptance |

Matching reference evidence includes populated Email, None warning, saved backup/full review/applied result, People list/detail, Add service destinations, diagnostics, narrow Email/People. Test validation-error, unavailable/loading, read-only and responsive layouts as well as the demonstrated success states. The approved manifest hashes preserve reference identity; do not edit references to hide drift. Functional equivalence alone is insufficient, while accessibility/capability/security remain mandatory. Runtime screenshot capture and conformance assessment are later implementation obligations and were not performed in this definition review.

### Third-feedback verification and approved UX4

REC-RUN-008 resolves the 83 feedback items PO-FB-042–124; UX-DESIGN-004 confirms the proposal and general appearance. This audit retains the earlier zero-gap disposition and all stable journey/entry/action IDs; new clear-value journeys reflect a materially distinct state transition. No observation is treated as evidence of a runtime fix.

| Changed scope | Journey/action mapping | Acceptance boundary |
|---|---|---|
| Service list, lifecycle and current Overview | J-*-CONFIG/ACCESS; ACT-114/120 | Active/draft/readiness independent; Delete truthfully archives; row link and sibling controls keyboard/narrow usable; stale/unauthorized actions rejected |
| Focused sections, global mode, guidance, destination options and history | J-*-CONFIG; ACT-111–113 | Exact imported capabilities and IDs survive modes/steps; browser navigation preserves safe work; add-item focus, explicit TLS scope, no redundant nested disclosures |
| Value dialogs, Clear and attribution | J-*-CREDENTIAL/CREDENTIAL-CLEAR; ACT-121/122 | Cancel/no-op/stale/audit/unknown paths, applied versus proposed dependencies, restart and queued/in-flight fences, actor provenance and secret-free surfaces |
| Rule editing and tester | J-*-POLICY; ACT-116–118 | Same add/edit dialog; custom methods retained; correct priority/defaults; draft-only removal; close tester without dirty-state mutation |
| Imported identities and access | J-*-HISTORY/ACCESS; ACT-115/119 | Named actionable unresolved subjects; mapping distinct from assignment; safe edits retained; current eligibility/review still required |
| Visual appearance | All changed services journeys; UX-V05/C42 and UX4 checklist | Match approved role/data/state/viewport references; desktop and narrow, keyboard/dialog focus/return, long values/errors/loading/read-only. No runtime visual acceptance claimed here |

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
| SECRES-05 | J-OWNER-RECOVERY, J-ADMIN-RECOVERY, J-OWNER-PASSWORD-RESET, J-ADMIN-PASSWORD-RESET, all four role-specific PASSWORD-COMPLETE and MFA-COMPLETE journeys |
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
| IDENT-02A | J-OWNER/ADMIN/AUDITOR-PEOPLE-VIEW; J-*-ACCOUNT; J-OWNER-BACKUP/RESUME |
| IDENT-02B | J-OWNER-ACCOUNT-EDIT; J-ADMIN-ACCOUNT-EDIT; J-OWNER-PEOPLE |
| SECRES-06 | J-OWNER/ADMIN-ACCOUNT-EDIT; J-OWNER/ADMIN/AUDITOR-PEOPLE-VIEW |
| SECRES-07 | J-OWNER-SETTINGS; J-OWNER-SMTP-DELETE; J-OWNER-RESUME |
| STATE-07 | J-*-ACCOUNT; J-OWNER/ADMIN/AUDITOR-PEOPLE-VIEW; J-OWNER-BACKUP/RESTORE/RESUME; J-HOST-RESTORE |
| STATE-08 | J-OWNER-SETTINGS; J-OWNER-BACKUP/RESUME; J-HOST-RESTORE |
| STATE-09 | J-OWNER/ADMIN-CREDENTIAL-CLEAR; J-OWNER/ADMIN-CREDENTIAL; J-MCP-01; J-OWNER-BACKUP/RESUME; J-HOST-RESTORE |
| SECRES-08 | J-OWNER/ADMIN-CREDENTIAL-CLEAR; J-OWNER/ADMIN-CREDENTIAL; J-AUDITOR-CONFIG; J-MCP-01; J-OWNER-RESUME |

**Unnumbered acceptance details:** First service ≤15 minutes (CONFIG journeys), denial investigation ≤2 minutes (ACTIVITY), user disable ≤1 minute (PEOPLE); validate 50 users/100 services (SYSTEM-ADMISSION), 24-hour targeted data loss and four-hour restore once prerequisites exist (backup/host restore), real ChatGPT/Codex authorization, full preserved gateway regressions, keyboard/assistive input and essential narrow-screen monitoring/recovery. Required guides cover deployment/proxy, enrollment/roles, service setup, clients, migration, audit, rotation, off-host copies, restore and limitations; example hosts are example.org. SECRES-T01–07 and STATE acceptance scenarios bind the corresponding numbered companion rows above.

## Assumptions and open questions

UX-DESIGN-004 is approved and canonical UX4 governs changed service journeys while preserving prior Settings and People authority. No additional product question is raised by this bounded audit. Settled D-001–D-012 remain authoritative: self-hosted single organization, four fixed roles, authenticator MFA, write-only managed credentials, audit fail-closed, whole-instance backup/restore and explicit reactivation. No multi-tenant/SAML/OIDC/SCIM/billing/general vault/custom-role/specific-integration functionality is inferred. Scope is sufficient for Product UX to design exact discovery/control locations and the domain reviewers to choose technical mechanisms.

An account security surface is a necessary entry for the PRD’s own-password/MFA/session capabilities; its placement is UX work. Logout is explicitly supported by SECRES-04 and is traced separately from grant revocation. Ordinary user deletion, arbitrary job cancellation and support ticketing are not promised; contact changes are now explicitly bounded by IDENT-02B/SECRES-06; disable/archive, safe abandonment and host/Owner recovery provide the stated terminal paths without expanding v1.

## Coverage summary

- Distinct actors: 10; actor-context rows: 25.
- Unique requirement/capability families: 79 (55 PRD IDs, seventeen normative companion IDs, seven derived unnumbered families).
- Actor-specific journeys: 66; Complete: 66; Partial/Missing/Contradictory: 0.
- Reachability: 66 Indeterminate; no Reachable claim. Implementation assessment: 66 Not verified; prior evidence was not refreshed.
- Entry points: 25; action mappings: 122; coverage rows: 66, exactly eight populated columns each.
- Unique gaps: 0 Blocker, 0 Major, 0 Minor; implementation gaps asserted: 0; unmapped requirements: 0.
- No implementation tests run. No product authority or code changed.

### Validated source revisions

| Input | Exact revision |
|---|---|
| docs/web-console-prd.md | sha256:48194cfbc4e55756649820a411aa0675c2a6be87c577bdd920b0aaf06e21b617 |
| product/security/web-console-security-contract.md | sha256:8f66520798094a2638f006c9f3145e263e96008fdf63480fc6b98c2b0ccddc35 |
| product/architecture/web-console-state-contract.md | sha256:c8e22b5013d89090cc451cb2ef0290d7517b05bebae746faa15b65f10fca9848 |
| docs/web-console-prd-coverage.md | sha256:db1dc7d715ff3704c3d211e4edbcd99aa8ec3f77cce3fdc40bc148aa31237379 |
| workflow/feedback/PO-FEEDBACK-2026-10-11-002/feedback.yaml | sha256:515a53d2c56f256708cef2fce9add362aa20f2fbcf1f6d34b4ff1a1dfdb9d53b |
| workflow/reconciliation/REC-RUN-004/reconciliation-result.yaml | sha256:ecaf289db5f2684b1195aa9b68a6b6957dc3074b98d61b2ef8882ffb27ebedde |
| workflow/reconciliation/REC-RUN-005/reconciliation-result.yaml | sha256:fbcfc50401f03cf2360fe0b6c68aca0c9439a5cdb0becb21d595c0f533f0dfbf |
| product/ux/00-overview.md | sha256:7cb20e4112c013d3188b307f4f91205e2edea977dc5f08d7231ae58bcfb8f51c |
| product/ux/01-information-architecture.md | sha256:46a44b43f12e8fec32e97abcf659581bc3c2d6b4c57c176038e495277a69c159 |
| product/ux/02-interaction-patterns.md | sha256:49afe01f26e05cb51e1a0183283ff07f16fdc4cb238cedc1bb85b35e0c6b5539 |
| product/ux/03-responsive-and-platform.md | sha256:ee4e4b2edecb8f56677145f3ea90c482334527c7e4d6356bf64220b7d3149b8f |
| product/ux/04-visual-system.md | sha256:9c30c4e67669f43a14234727d7bebf3e5a309f6915333aaf5c3827e79ce0590a |
| product/ux/05-accessibility.md | sha256:82b0463ee026354d14e01d925e5c734317774cac88396c103748f2d907e54dd1 |
| product/ux/06-feature-exceptions.md | sha256:427142201d4c4d0e6fc17c19d957f6f4eb8355c651554f0892aefcc1590468cd |
| product/ux/07-acceptance-checklist.md | sha256:7852a01661c26abc1868250219f85410857b0ce216b3c50cb71a5b79ec4162f5 |
| product/ux/experience-brief.yaml | sha256:859e7e6cd056f37a9682df291f0daa6d292d361b5a711fbbb824be2f1806c4e6 |
| product/ux/manifest.yaml | sha256:4c5851fd985e7fa83f5d902eaf0100f983cb5e3da240c28d7b4a789b80d0f8b2 |
| workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml | sha256:9b50a7d3dc87a3f2d45832b0deee4402b6e84b65092680a57f5bfbf8c7fbe0bf |
| workflow/reconciliation/REC-RUN-008/reconciliation-result.yaml | sha256:1018e24f89041935175c94108faa5339c6d09f2c4f9a15c244df5378d4177432 |

Decision provenance: Prior accepted decisions remain authoritative; REC-DEC-008, UX-DESIGN-004 and resolved REC-RUN-008 govern changed service journeys. This is a journey-stage result, not overall readiness or runtime acceptance.
