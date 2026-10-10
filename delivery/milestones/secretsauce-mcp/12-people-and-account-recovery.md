# Milestone 12: Manage people and recover accounts

## Objective

Complete the multi-user identity lifecycle and optional delivery channels without conflating role administration with execution grants.

## User/System Outcome

An Owner invites and manages four-role users, safely transfers ownership or recovers an account, while each enrolled person controls their security and administrators assign eligible identities.

## Scope

Invitations/reissue/revoke, all fixed-role views, ownership continuity, disable/role changes and access revocation; own and Owner-assisted password/MFA recovery, protected all-Owner host recovery; optional SMTP settings/testing/notifications and manual-link delivery.

## Explicit Exclusions

No public signup, groups, custom roles, SAML/OIDC/SCIM, identity-document collection or request-access workflow. Multi-user MCP consent and authentication-mode activation are 14; full instance restore is 17.

## Source Requirements

[PRD](../../../docs/web-console-prd.md) and normative contracts: `AUTHZ-01`, `AUTHZ-02`, `AUTHZ-03`, `IDENT-02`, `IDENT-03`, `IDENT-04`, `IDENT-05`, `IDENT-06`, `MCP-02`, `CONFIG-03`, `SEC-01`, `SEC-03`, `AUDIT-01`, `AUDIT-04`, `SECRES-01`, `SECRES-02`, `SECRES-03`, `STATE-01`, `UX-01`, `UX-03`, `UX-04`.

[Journey audit](../../../docs/web-console-prd-user-journey-audit.md): J-OWNER-ENROLL, J-ADMIN-ENROLL, J-AUDITOR-ENROLL, J-MEMBER-ENROLL, J-OWNER-PEOPLE, J-OWNER-RECOVERY, J-HOST-RECOVERY, J-OWNER-ACCOUNT, J-ADMIN-ACCOUNT, J-AUDITOR-ACCOUNT, J-MEMBER-ACCOUNT. Shared sources/revisions and preservation rules are in [index](index.md); exact coverage rows are in [traceability](traceability.md).

## Preconditions

11 supplies scoped instance-settings drafts, service assignments and current runtime invalidation; 10's transitive identity/audit/proof/session contracts remain mandatory.


Readiness prerequisite IDs resolve to the [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).

- `PRE-001–005` — committed authority, existing regression/build baseline, declared Node/npm/packages, writable loopback test execution and an available browser; current facilities verified with the limitations in the readiness report.
- `PRE-007`, `PRE-008` — the earlier providers named above must be completed with committed acceptance evidence before this milestone begins; currently pending implementation.
- `PRE-014` — this milestone owns its specific positive/negative and failure fixtures; reuse earlier declared harnesses, never undeclared local packages.
- `PRE-017` — use synthetic SMTP delivery and manual-link fallback; real SMTP provisioning is optional.

## Readiness checks

- Inspect `delivery/milestones/secretsauce-mcp/status.yaml` and the committed planning handoff: this milestone is selected explicitly, source revisions still match, and all direct dependencies are completed with evidence. The legacy next-MVP selector targets the historical packet and must not select this work.
- Run `node --version` and `npm --version`; Node satisfies `package.json` (>=22). On a fresh checkout run `npm ci`; installed dependencies come from the lockfile. CI remains Node22. Use writable temp storage and loopback permissions; if `npm test` reports `listen EPERM`, rerun the identical suite with permission per AGENTS.md.
- Confirm `npm run build` and `npm test` remain the documented baseline commands (a newly executed result is required at milestone acceptance; readiness’s existing baseline is not feature evidence). Inspect previous milestone validation before modifying shared contracts.
- Inspect the browser procedure/harness and available browser before UI validation; it must load the implemented local page and support keyboard and 320px checks without depending on undeclared cached packages. New commands are recorded by the owning implementation, not invented here.

## Functional Requirements

- Owners issue predetermined-role invitations expiring in 72 hours; revoke/reissue invalidates earlier proof. At least 128-bit unpredictable proofs are verifier-only, bound to purpose/identity/instance generation, single-use under concurrency, and neither preview GET nor email scanner consumes them. Password and fresh TOTP complete enrollment before access; failed/abandoned enrollment stays restricted.
- Provide Owner-only explicit external identity registration by issuer plus subject in advanced identity settings, with eligible service assignments and safe non-secret metadata. Registration does not enable an authentication mode or console access; 14 consumes this registry for external OAuth and 13 for explicit import mappings. Reject ambiguous/duplicate pair and email-only linking.
- Owner-only immediate role/disable/recovery actions and Administrator eligible-identity assignments enforce current permissions on direct interfaces. Final active Owner cannot be disabled/deleted/demoted; replacement is already enrolled, and concurrent transfers cannot leave zero. Recommend a second Owner without requiring one.
- Own password reset uses established contact with non-enumerating responses and never removes MFA. Factor replacement requires password plus current TOTP, password plus unused recovery code, or verified recently authenticated Owner assistance. Codes are hashed and single-use; session alone never suffices.
- Owner-assisted recovery confirms person verification through existing trusted channel and records only channel category, immediately revokes sessions/MCP grants and restricts account until fresh enrollment. Recheck issuer authority before activation. Recovery links expire in 30 minutes; bounded target/source/global attempts and replay defenses preserve host recovery.
- Document and implement protected host-local recovery when every Owner is locked out; selected Owner reenrolls with durable evidence, never a public password-only bypass. Audit storage must be repaired before identity mutation.
- Users manage own sessions and factors; Owners revoke others' sessions and client grants. Password change/recovery invalidates sessions and specified grants immediately. Five-minute recent password/TOTP applies to ownership/recovery/authentication changes as specified, bound to actual action.
- Owner SMTP/sender settings use scoped draft/apply; SMTP credentials use protected write-only handling. Test delivery, invitation/reset/security and later backup/audit alerts report safe delivery status. Without SMTP provide authorized one-time link copy and manual sharing. Delivery failure never means acceptance, undoes recovery, or blocks permitted gateway work; emit later event notices through the same bounded delivery boundary.
- Role shell is complete: Auditor inspects non-secret configuration without mutation/execution; Member sees assigned services, own activity/account/clients, no global administration. Administrator assigns existing eligible identities but cannot invite or recover them.

## UX Constraints

UX-IA01/04 define role-sensitive navigation, People & Access and account/client distinction. UX-IN03/06 make role/recovery consequences immediate and explain last-Owner protection, known delivery status, authorized link reissue and distinct reset versus MFA recovery. UX-EX02 keeps capability pages restricted. UX-A04 requires accessible seed/code entry; links appear only at issuance, never history/diagnostics.

All affected pages inherit [UX-R01–03](../../../product/ux/03-responsive-and-platform.md), [UX-V01–03](../../../product/ux/04-visual-system.md) and [UX-A01–04](../../../product/ux/05-accessibility.md): calm moderate-density service-first hierarchy, text/icon state, visible focus/labels/errors/status announcements, keyboard-only completion, no hover/drag-only action, accessible confirmation focus return, and routine reflow at 320 CSS px. Narrow layouts retain essential actions, My account and logout. Loading/empty/validation/forbidden/offline/expired/failed states preserve safe non-secret context and never fabricate success. The approved concepts guide composition, not missing-feature exemptions or exact pixels.

Required [observable checks](../../../product/ux/07-acceptance-checklist.md): UX-C01, UX-C07, UX-C08, UX-C11, UX-C12, UX-C15, UX-C20, UX-C21, UX-C22, UX-C25. IA and IN/EX references resolve to the canonical [UX manifest](../../../product/ux/manifest.yaml).

## Architecture / Security Constraints

SECRES-01–03 governs exact proof, origin, no-referrer/cache/telemetry, removal from address history and concurrent consumption. SMTP output must be bounded/sanitized. Trusted proxy configuration cannot let an attacker choose capability-link origin. Apply the audit outage gate to issuance, proof consumption, recovery and scheduled notifications with sensitive effects.

## Interfaces and Compatibility

Extend durable accounts/roles and management operations from 10; use 11's assignment/invalidation and settings transaction. Existing MCP authorization remains independently checked until 14 expands normal connection. Public reset responses avoid enumeration. No web route may read arbitrary host files/environment for recovery.

## Acceptance Criteria

- [ ] Each of four roles can enroll and exercise allowed cells; every forbidden matrix cell is denied on direct management/MCP interfaces, not just hidden.
- [ ] Invitation GET is harmless, one concurrent completion succeeds, revoked/expired/wrong-purpose links fail, and SMTP/manual delivery retains correct account state.
- [ ] Valid self/Owner/host recovery works, while password-only factor replacement, stale issuer and audit-outage mutation fail; prior sessions/grants cannot be used.
- [ ] An enrolled replacement can take ownership; last-Owner races fail safely. A representative Owner can disable a user within one minute.

## Required Validation

All role-matrix cells with direct object-ID and mixed-role attempts; valid/invalid/duplicate issuer-subject registration and prohibited email-only linking; parallel last-Owner removal; proof wrong-identity/purpose/instance/replay/expiry; stored versus fresh factor leakage; recovery-code races; non-enumeration; SMTP malformed addresses/settings, unsafe errors and delivery failure; host proof loss/reissue; session expiry during confirmation; issuer demotion between issuance/redemption. Exercise SECRES-T01/T03/T05/T06 and UX-C11/12 browser keyboard paths.

For each new external input add positive and negative tests, plus concurrency/failure cases named here. Run focused/related checks while building; at milestone completion run `npm test` and `npm run build` plus the required browser/operational evidence. If full tests fail with loopback `listen EPERM`, rerun the same suite with appropriate permission, never weaken listener tests. User-facing work requires rendered browser, keyboard and narrow-width evidence for its listed UX checks. Full-suite repetition is warranted after new changes, not as ceremony. No application tests are required merely to compile this documentation.

## Known Risks / Deferred Work

Optional SMTP remains optional; no external provider provisioning prerequisite is created by the product. Synthetic delivery tests and manual links enable acceptance without sending messages to real people; real send authorization remains outside this planning packet.
