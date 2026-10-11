# Milestone 18: Separate assisted password and Authenticator resets

## Objective

Allow Owners and Administrators to recover eligible other users through distinct password and Authenticator operations without granting unrelated administration powers.

## User/System Outcome

Allow Owners and Administrators to recover eligible other users through distinct password and Authenticator operations without granting unrelated administration powers.

## Scope

People detail, protected initiation/reissue/completion interfaces, proof lifecycle, identity persistence, revocation and safe notification/manual delivery.

## Explicit Exclusions

General Administrator user management, MFA disabling, contact overrides, combined reset proof, SSO and new approval chains.

## Source Requirements

Resolved REC-RM-003 from [REC-RUN-003 remediation](../../../workflow/reconciliation/REC-RUN-003/03-remediation-backlog.md), adopted by the committed [definition handoff](../../../workflow/definition/state.yaml) and [validated package](../../../workflow/definition/definition-package.yaml). Detailed authority: IDENT-04/05/06, AUTHZ-02/03, AUDIT-01/04; SECRES-01/03/04/05; STATE-01/02/03; UX-IA04, UX-IN08, UX-C29–31. Findings are provenance, not independent scope.

## Preconditions

M12 provides verifier-only invitation/recovery and Owner continuity; M14 provides current-identity durable MCP grants and generation-bound revocation. Current approved definition revisions are pinned in [status](status.yaml); all definition gates have passed.


Readiness prerequisite IDs below resolve to the [active feedback manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md#active-feedback-prerequisites).

- `PRE-019–024` — committed approved definition, locked developer tools, declared Chromium, permitted disposable loopback/storage, optional Docker regression facility and delivered console baseline; available with the execution limits recorded in the readiness report. Use isolated synthetic state, never the running user instance.
- `PRE-025` — this milestone owns new positive/negative, browser and failure fixtures for its stated acceptance criteria; existing test/harness infrastructure is a provider, not evidence that changed behavior passes.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml` and `delivery/milestones/secretsauce-mcp/status.yaml`: parent planning commit is finalized, current authority revisions match, this milestone is selected from this packet and its direct predecessors are completed. The completed M10–17 delivery goal and legacy next-MVP selector do not select this new work.
- Run `node --version`, `npm --version`, `openssl version`; Node meets `package.json` >=22, CI/Docker use22, OpenSSL supports the synthetic HTTPS fixtures. From a fresh checkout run `npm ci` using the committed lockfile and `npm run build`. `npm test` remains the full-suite acceptance command; on listener EPERM rerun the same suite with loopback permission.
- Provision the declared browser with `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` (documented Playwright setup in `docs/console-operations.md`). Retain that same environment variable for browser harness commands. This temporary cache can disappear after reboot; reinstall rather than assuming an older cached browser matches the locked version. Browser/network permission may require narrow execution approval; do not change host security or install OS packages implicitly.
- Inspect relevant `scripts/verify-console-*-browser.mjs` and `test/console-*.test.ts` facilities before adapting the owning slice's fixture commands. Pass when actual HTTPS, synthetic roles/state, keyboard, 320px and 200% text/range checks can run without real accounts, SMTP recipients or credentials. Feature evidence is recorded by implementation, not by this readiness check.
- Before any required container regression, `docker version` must report both client/server and `docker compose version` must succeed. Use only disposable loopback-bound test resources and existing launcher/kernel leases. Do not run deployment Compose against the user's current mounts; no container is a prerequisite for starting ordinary source work.

## Functional Requirements

### REC-RM-003

Priority: HIGH. Source findings: REC-001, REC-002. Product Owner feedback: PO-FB-001–004 in PO-FEEDBACK-2026-10-11-001.
Authoritative basis: adopted PRD IDENT-04/05/06, AUTHZ-02/03, AUDIT-01 and normative SECRES-05. Desired outcome: both designated roles initiate separate resets within precise target hierarchy and bounded recovery authority. Current behavior: Owner-only combined recovery restricts at issuance and factor recovery also replaces password; change those transitions as specified.
Affected actors/interfaces: Owner; Administrator with minimum safe target visibility; permitted other users; protected reset initiation/reissue/completion UI/API and browser proof flow. Existing invitation/role/reactivation/SMTP management remains Owner-only; self-service existing-factor recovery remains available.
UX constraints: distinguish Reset password and Reset authenticator with target/consequence confirmation, recent initiator authentication and verified-channel acknowledgement; recipient sees only the purpose-bound continuation. Approved UX-IN08 governs the flow; no global redesign is implied.
Security/architecture: SECRES-01/03/04/05 and STATE-01/02/03 are normative; preserve verifier-only proofs, immediate revocation, durable audit, generation fencing and no secret logging.


## UX Constraints

Follow canonical [UX manifest](../../../product/ux/manifest.yaml) `web-console-ux-2`. Apply [interaction states](../../../product/ux/02-interaction-patterns.md) UX-IN05, [responsive rules](../../../product/ux/03-responsive-and-platform.md) and [accessibility](../../../product/ux/05-accessibility.md): labeled loading/empty/error/success, linked field errors, safe expired/forbidden/offline/unknown outcomes, visible keyboard focus and return, text plus non-color status. Check actual HTTPS browser at desktop, 320 CSS px and 200% text; inspect document width and text ranges, not only component boxes. Account/logout and authorized recovery paths remain reachable. Preserve only authorized non-secret input; never cache secrets/proofs in browser storage. Use task-appropriate exceptions in [feature exceptions](../../../product/ux/06-feature-exceptions.md).

## Architecture / Security Constraints

Preserve [state contract](../../../product/architecture/web-console-state-contract.md) and [security contract](../../../product/security/web-console-security-contract.md). Enforce current server authorization, recent authentication where required, durable audit admission, generation/revision checks and fail-closed uncertain outcomes. Never log raw credentials, opaque values, cookies, headers, proof material or downstream bodies. Maintain encrypted persistence, live runtime instances, current subject/service references, lease ownership and audit boundaries; no broad infrastructure refactor.

## Interfaces and Compatibility

Preserve ordinary login, self-service verification, invitations, user roles and service assignments. Existing outstanding combined recovery proofs must never be silently reinterpreted as a new operation: fail safely and require authorized reissue when incompatible. Durable state migration must preserve generations and restrictions across restart. Rollback must not reactivate invalidated credentials/proofs; reject incompatible persisted authority rather than downgrade.

## Acceptance Criteria

- [ ] Owner initiates either reset for eligible other roles; Administrator can do so for Administrator/Auditor/Member, never Owner. Reject assisted self, forbidden lifecycle/identity classes, arbitrary contact and unauthorized direct API.
- [ ] Password issuance does not restrict or revoke; proof plus existing TOTP/recovery code and new password completes once, preserving MFA and revoking old sessions/grants/references; ordinary login follows.
- [ ] MFA issuance invalidates old factor/codes/access immediately; completion installs fresh factor/codes while preserving password. Both-lost path completes MFA first then a new password reset. Expiry/abandonment stays restricted.
- [ ] Current issuer/target role, generation and lifecycle changes invalidate proof authority; natural issuer session expiry alone does not. Last enrolled Owner continuity survives concurrent restrictions and role changes.
- [ ] Wrong purpose/target/instance, replay/concurrent completion, audit failure, uncertain persistence and old JWT/refresh/reference completion cannot restore access; no proof/password/seed appears in logs/history.

## Required Validation

SECRES-T08–11 plus retained T01/T05/T06; actual HTTPS browser for each role and reset purpose, both-lost sequence, accessible enrollment and manual/SMTP failure paths. Integrate old JWT/refresh/reference revocation, concurrent final-Owner restriction, replay, issuer expiry versus demotion, audit-failure and uncertain-write tests. Use synthetic SMTP recipients only.

Every new external input requires positive and negative tests. Run targeted and related regressions while implementing, then `npm test` and `npm run build` at milestone completion; retain full listener tests and rerun with required loopback permission if sandbox EPERM occurs. Record sanitized milestone evidence under `evidence/qa/secretsauce-mcp/milestone18/` with relevant UX/browser evidence. Preserve existing gateway, authentication and configuration behavior; actual self-signed HTTPS test is required if downstream transport changes. Do not count mocked or inert controls as browser completion. Documentation examples use `example.org`; include changed user/operator instructions. Readiness supplies executable environment prerequisites separately.

## Known Risks / Deferred Work

Changing recovery authority requires particular care for outstanding links and persistence uncertainty; implementation chooses migration mechanics within the fail-closed contract. Accepted SEC-DEF-001 remains; no universal credential non-exfiltration claim. Actual ChatGPT/Codex validation retains its existing explicit external exception, never represented as passed. No required feedback work is deferred; no implementation slices are prescribed here.
