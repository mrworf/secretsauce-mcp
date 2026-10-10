# Milestone 10: Establish secure audited console access

## Objective

Create an independently usable first-Owner console with durable identity and audit admission before later administrative mutations are exposed.

## User/System Outcome

A host-authorized Owner can initialize the instance, enroll password/TOTP, sign in, inspect safe instance status, manage their own sessions and sign out; audit failure safely restricts access.

## Scope

First-run host proof, instance name/trusted URL, first Owner and independent backup recovery material; encrypted sensitive persistence, account/session verification and current four-role authorization contract; protected browser shell and My account; durable append-only tamper-evident audit admission and operation-status contract; read-only outage diagnosis and restart behavior.

## Explicit Exclusions

Invitations, assisted/all-Owner recovery and SMTP are milestone 12. Service authoring starts in 11; full audit search/export/retention is 15; backup archive jobs are 16. No SaaS, SSO, custom roles or generic infrastructure milestone.

## Source Requirements

[PRD](../../../docs/web-console-prd.md) and normative contracts: `BASE-02`, `AUTHZ-02`, `AUTHZ-03`, `IDENT-01`, `IDENT-02`, `IDENT-06`, `AUDIT-01`, `AUDIT-03`, `AUDIT-04`, `SEC-01`, `OPS-03`, `OPS-05`, `UX-01`, `UX-03`, `UX-04`, `SECRES-01`, `SECRES-02`, `SECRES-04`.

[Journey audit](../../../docs/web-console-prd-user-journey-audit.md): J-HOST-01, J-OWNER-01, J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT, J-OWNER-DIAG, J-ADMIN-DIAG, J-AUDITOR-DIAG, J-MEMBER-DIAG, J-PUBLIC-01. Shared sources/revisions and preservation rules are in [index](index.md); exact coverage rows are in [traceability](traceability.md).

## Preconditions

No new milestone prerequisite. Consume the existing gateway baseline and committed definition package; this milestone is the first provider of durable identity, current authorization, audit admission and operation-state contracts.


Readiness prerequisite IDs resolve to the [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).

- `PRE-001–005` — committed authority, existing regression/build baseline, declared Node/npm/packages, writable loopback test execution and an available browser; current facilities verified with the limitations in the readiness report.
- `PRE-006` — this milestone owns console/storage/browser setup and synthetic proof/session/fault fixtures within its vertical outcome; declare dependencies and reproducible validation before its acceptance. No external database/account is a start prerequisite.

## Readiness checks

- Inspect `delivery/milestones/secretsauce-mcp/status.yaml` and the committed planning handoff: this milestone is selected explicitly, source revisions still match, and all direct dependencies are completed with evidence. The legacy next-MVP selector targets the historical packet and must not select this work.
- Run `node --version` and `npm --version`; Node satisfies `package.json` (>=22). On a fresh checkout run `npm ci`; installed dependencies come from the lockfile. CI remains Node22. Use writable temp storage and loopback permissions; if `npm test` reports `listen EPERM`, rerun the identical suite with permission per AGENTS.md.
- Confirm `npm run build` and `npm test` remain the documented baseline commands (a newly executed result is required at milestone acceptance; readiness’s existing baseline is not feature evidence). Inspect previous milestone validation before modifying shared contracts.
- Inspect the browser procedure/harness and available browser before UI validation; it must load the implemented local page and support keyboard and 320px checks without depending on undeclared cached packages. New commands are recorded by the owning implementation, not invented here.
- Before implementation, inspect the slice plan for explicit store/key/audit initialization, isolated synthetic fixtures and browser/dependency setup. Pass when each belongs to this outcome and no undeclared running service or product decision is required.

## Functional Requirements

- Protected host-local proof is instance/operation bound, at least 128 random bits, expires after 30 minutes, is single-use and never appears in normal logs. Web discovery cannot claim an instance. Setup records name/origin, fresh Owner password/TOTP and independently stored backup recovery material before ordinary access.
- Require password and authenticator TOTP for all human access. Password minimum is 15 characters with support for at least 64, compromised-value rejection, paste/password managers, and no composition/periodic-expiry rules. Protect seeds at rest; show QR/manual seed only in non-cacheable authorized enrollment. Recovery codes are shown once and stored as hashes; milestone 12 supplies their recovery paths.
- Persist sessions with 30-minute idle and 12-hour absolute limits. Support logout and own other-session revocation; password change invalidates existing sessions. Provide the five-minute action-bound recent password/TOTP check consumed by later high-risk operations. Reject replay/concurrent TOTP reuse and bound attempts. Session alone never changes MFA.
- Enforce four fixed human roles in management interfaces as well as UI. Establish current permission checks and last-Owner invariant; later milestones add permitted operations, not alternate authorization paths. Separate execution assignment from administrative role.
- Record sanitized actor/action/target/result/time/operation identity and applicable revision. Audit is append-only through product interfaces and tamper-evident. Sensitive effects require durable admission; existing gateway reference/dispatch and OAuth issuance/refresh paths also fail closed. Durable start precedes downstream dispatch; missing completion is uncertain and never automatically retried.
- Persist coherent committed state, encrypted system material and audit evidence through restart with one writable application instance. Missing encryption/storage material fails safely and is diagnosable. Do not silently load obsolete YAML after a managed instance exists.
- Audit outage blocks every sensitive path and scheduled job. Preserve role-scoped reads; allow restricted diagnostic password/TOTP login only if verification, throttle and replay protections remain reliable. Otherwise fail closed. Local logout/expiry remain possible. Repair is host storage/process repair; durable append verification plus outage/recovery evidence precede normal work, and restricted sessions must reauthenticate.
- Expose bounded public health only; authenticated diagnostics show relevant safe cause. Unknown operation completion is retrieved by identity/status rather than blindly replayed. Document setup, key/storage responsibilities and diagnosis.

## UX Constraints

UX-IA01 establishes Services, People & Access, Activity, Settings and persistent My account/logout with permission-safe navigation; initially only completed capabilities have actionable controls. UX-IN06 and UX-A04 require accessible QR/manual setup, code paste, explicit one-time display and expiry/reissue guidance. UX-EX01/02 separate restricted diagnosis/enrollment from ordinary authority; outage banners remain visible. Apply UX-IN05 empty/loading/failed/offline/expired/forbidden states; no secret persistence or false completion.

All affected pages inherit [UX-R01–03](../../../product/ux/03-responsive-and-platform.md), [UX-V01–03](../../../product/ux/04-visual-system.md) and [UX-A01–04](../../../product/ux/05-accessibility.md): calm moderate-density service-first hierarchy, text/icon state, visible focus/labels/errors/status announcements, keyboard-only completion, no hover/drag-only action, accessible confirmation focus return, and routine reflow at 320 CSS px. Narrow layouts retain essential actions, My account and logout. Loading/empty/validation/forbidden/offline/expired/failed states preserve safe non-secret context and never fabricate success. The approved concepts guide composition, not missing-feature exemptions or exact pixels.

Required [observable checks](../../../product/ux/07-acceptance-checklist.md): UX-C01, UX-C12, UX-C15, UX-C16, UX-C20, UX-C21, UX-C22. IA and IN/EX references resolve to the canonical [UX manifest](../../../product/ux/manifest.yaml).

## Architecture / Security Constraints

SECRES-01/02 govern proof binding/leakage and startup authority; SECRES-04 is shared by all future operations. Trusted origins do not derive from arbitrary Host/forwarded headers. Implement session theft/forgery and CSRF defenses without selecting a mandated framework. Durable storage and audit commit ordering must be documented and interruption-tested; database/crypto mechanisms remain engineering choices.

## Interfaces and Compatibility

Add console and management interfaces plus host-local setup entry without altering the five MCP tool schemas or granting console access to external/bearer authentication. Integrate fail-closed audit into preserved gateway/auth paths as BASE-02's intentional change; revise old fail-open expectations, not gateway validation-before-substitution. Provide durable operation status for later apply/recovery consumers.

## Acceptance Criteria

- [ ] Host-authorized setup and normal password/TOTP login survive restart; unproven first visitor, expired/replayed proof and incomplete MFA cannot acquire access.
- [ ] Own security/session controls enforce scope and expiry; password changes invalidate old sessions; a direct forbidden management request fails independently of UI visibility.
- [ ] Forced audit failure prevents existing and new sensitive effects before I/O, preserves safe diagnosis, and never upgrades a restricted session after repair.
- [ ] Secrets are absent from logs/URLs/history/browser persistent storage except the narrowly governed enrollment/OAuth cases; public health discloses no configuration details.

## Required Validation

Bootstrap race/replay, malformed identity/session inputs, password boundaries, TOTP concurrent replay, session/CSRF/forgery negatives, unavailable encryption/storage, interrupted durable writes, disk full, unsafe diagnostic login, uncertain downstream completion, restart and normal reauthentication. Cover SECRES-T01–03/T06–07 for applicable paths. Browser-check setup/login/My account and diagnostic reflow, keyboard and secret-safe errors; prove downstream call count stays zero on failed admission.

For each new external input add positive and negative tests, plus concurrency/failure cases named here. Run focused/related checks while building; at milestone completion run `npm test` and `npm run build` plus the required browser/operational evidence. If full tests fail with loopback `listen EPERM`, rerun the same suite with appropriate permission, never weaken listener tests. User-facing work requires rendered browser, keyboard and narrow-width evidence for its listed UX checks. Full-suite repetition is warranted after new changes, not as ceremony. No application tests are required merely to compile this documentation.

## Known Risks / Deferred Work

Persistence, browser technology, cryptography and commit-order mechanisms are delegated implementation choices. This is a working security boundary with a usable Owner flow, not a separately approved architecture phase. Future routes must join the same gate; all new role surfaces are tested when introduced.
