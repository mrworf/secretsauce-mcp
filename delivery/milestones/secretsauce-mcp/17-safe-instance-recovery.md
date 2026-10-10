# Milestone 17: Restore and resume an instance safely

## Objective

Complete crash-safe whole-instance recovery with explicit authority, fresh enrollment and preserved audit provenance.

## User/System Outcome

An Owner restores in place or a host operator recovers on a clean replacement, then reenrolls the nominated Owner and selectively reviews users/services before clients reconnect.

## Scope

Archive upload/validation/preview, clean-host and in-place authority, maintenance/drain and pre-restore protection, atomic crash recovery/local rollback, restricted continuation, fresh Owner enrollment and explicit reactivation, evidence continuity and practical recovery runbook.

## Explicit Exclusions

No selective merge/per-user restore, downstream rollback guarantee, bulk Resume everything, old-authentication restoration, remote backup integration or HA. Completed installation never automatically returns to old state because enrollment is difficult.

## Source Requirements

[PRD](../../../docs/web-console-prd.md) and normative contracts: `BACKUP-03`, `BACKUP-04`, `BACKUP-05`, `BACKUP-06`, `AUTHZ-03`, `IDENT-01`, `IDENT-05`, `IDENT-06`, `MCP-02`, `MCP-04`, `OPS-03`, `OPS-04`, `OPS-06`, `AUDIT-01`, `AUDIT-03`, `AUDIT-04`, `SEC-01`, `SEC-03`, `SECRES-01`, `SECRES-02`, `SECRES-04`, `STATE-05`, `STATE-06`, `CAP-ACCEPT-01`, `UX-03`, `UX-04`.

[Journey audit](../../../docs/web-console-prd-user-journey-audit.md): J-OWNER-RESTORE, J-HOST-RESTORE, J-OWNER-RESUME, J-HOST-RECOVERY. Shared sources/revisions and preservation rules are in [index](index.md); exact coverage rows are in [traceability](traceability.md).

## Preconditions

16 supplies complete encrypted archives, independent recovery material, consistent manifests and single-job gate; all transitive state domains and security/operation contracts are implemented. Consume 12's fresh enrollment and 14's explicit mode/client invalidation; 15 supplies audit provenance views.


Readiness prerequisite IDs resolve to the [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).

- `PRE-001–005` — committed authority, existing regression/build baseline, declared Node/npm/packages, writable loopback test execution and an available browser; current facilities verified with the limitations in the readiness report.
- `PRE-007`, `PRE-008`, `PRE-009`, `PRE-010`, `PRE-011`, `PRE-012`, `PRE-013` — the earlier providers named above must be completed with committed acceptance evidence before this milestone begins; currently pending implementation.
- `PRE-014` — this milestone owns its specific positive/negative and failure fixtures; reuse earlier declared harnesses, never undeclared local packages.
- `PRE-015` — Product Owner/authorized tester supplies real ChatGPT and Codex access/reachability and recorded client evidence at this milestone’s acceptance. This dependency is unverified and cannot be waived by protocol mocks.
- `PRE-016` — host operator/CI maintainer supplies permitted Docker and isolated persistent/disposable storage before operational validation. Current sandbox daemon access is denied; record the manifest’s completion evidence before acceptance.
- `PRE-018` — generate protected synthetic archive/key and isolated recovery fixtures as part of this milestone; never require production data or original-host secrets.

## Readiness checks

- Inspect `delivery/milestones/secretsauce-mcp/status.yaml` and the committed planning handoff: this milestone is selected explicitly, source revisions still match, and all direct dependencies are completed with evidence. The legacy next-MVP selector targets the historical packet and must not select this work.
- Run `node --version` and `npm --version`; Node satisfies `package.json` (>=22). On a fresh checkout run `npm ci`; installed dependencies come from the lockfile. CI remains Node22. Use writable temp storage and loopback permissions; if `npm test` reports `listen EPERM`, rerun the identical suite with permission per AGENTS.md.
- Confirm `npm run build` and `npm test` remain the documented baseline commands (a newly executed result is required at milestone acceptance; readiness’s existing baseline is not feature evidence). Inspect previous milestone validation before modifying shared contracts.
- Inspect the browser procedure/harness and available browser before UI validation; it must load the implemented local page and support keyboard and 320px checks without depending on undeclared cached packages. New commands are recorded by the owning implementation, not invented here.
- Inspect the PRE-015 tester/reachability authorization record and, before completion, the real-client evidence listed in the manifest; missing evidence blocks acceptance. Do not request or log token values.
- On the authorized test host run `docker version` and `docker compose version`; both must succeed with server access. Inspect writable independent mounts and disposable target capacity before using the owning milestone’s smoke/drill instructions. Missing host access blocks those validation steps.
- Inspect synthetic archive/material provenance and separate staging/rollback target evidence. Pass when fixtures derive from completed providers and can be destroyed without touching real instance state.

## Functional Requirements

- Validate decryption/integrity/version, required deployment inputs, available staging/rollback storage, bounded archive size/count/time and safe entries before replacement. Reject wrong key, corruption, unsafe paths/links, unsupported versions or missing recoverable Owner. Preview archive/recovery time, included objects and replacement/access impact without exposing material.
- Clean host requires a newly issued protected host-local restore proof plus archive material; in-place requires current Owner password/TOTP within five minutes plus archive material. Bind authorization to archive/operation; nominate an Owner from verified archive even when initiator is absent there. Preview/audit distinguishes actual initiator from recovered Owner.
- Enter maintenance: stop new sensitive administration and downstream admission, drain dispatched work only within existing deadlines, retain uncertain outcomes without claiming remote rollback. Before replacing functioning state, validate automatic encrypted pre-restore backup and protect a separate temporary non-downloadable local prior installation including necessary live factor store for failed-install rollback.
- Install product state and key dependencies atomically and recoverably. Crash at any installation step chooses coherent prior installation or complete restricted recovery state. Failed install preserves local audit/failure evidence, rolls back coherently and requires fresh login without reviving invalidated sessions/references. Failed rollback stays in maintenance with prior store/host-recovery path; clean-host failure stays restricted. Remove temporary local rollback source after durable success/completed rollback.
- On successful install invalidate all sessions, grants, bearer credentials, references and old proofs/factors. Restricted continuation permits status and nominated-Owner enrollment only, expires 30 minutes after enrollment stage, is single-use/instance/archive bound and omitted from backups. Lost/expired continuation uses protected host recovery; archive or old password alone cannot enroll.
- Require fresh nominated-Owner password/TOTP/recovery codes and healthy durable audit before management review. Protect that Owner during incomplete enrollment. Other users require explicit Owner review and fresh bound enrollment; saved assignments alone grant nothing. Every restored service remains Disabled until individually reviewed/re-enabled with current credentials/policy/access. External OAuth/legacy bearer requires explicit reactivation; clients reconnect. One reviewed service can resume without completing all others.
- Preserve in-place local audit sequence independently of snapshot replacement, including events newer than archive, install/failure/enrollment/resume. Imported evidence retains provenance; overlapping records are not fresh activity. Clean host identifies unavailable post-archive interval rather than fabricating continuity. Audit failure prevents activation and uses existing restricted repair route.
- Complete operator recovery/runbook, key/host-loss drills and full final compatibility/UX regression across restored state. Demonstrate RTO target of four hours once replacement infrastructure/material are available, with conditional 24-hour backup RPO; document observed timing and limitations.

## UX Constraints

UX-IN07/EX04 requires full-page validation → impact review → explicit start → maintenance status → fresh enrollment → management-review checklist. Name initiator and archived Owner separately, preserve pending counts/navigation progress and never offer arbitrary cancellation after installation begins. UX-EX02 restricts continuation authority; UX-C18/19 preserves no-bulk-resume and provenance. Narrow recovery retains account/logout when authorized and all required consequences.

All affected pages inherit [UX-R01–03](../../../product/ux/03-responsive-and-platform.md), [UX-V01–03](../../../product/ux/04-visual-system.md) and [UX-A01–04](../../../product/ux/05-accessibility.md): calm moderate-density service-first hierarchy, text/icon state, visible focus/labels/errors/status announcements, keyboard-only completion, no hover/drag-only action, accessible confirmation focus return, and routine reflow at 320 CSS px. Narrow layouts retain essential actions, My account and logout. Loading/empty/validation/forbidden/offline/expired/failed states preserve safe non-secret context and never fabricate success. The approved concepts guide composition, not missing-feature exemptions or exact pixels.

Required [observable checks](../../../product/ux/07-acceptance-checklist.md): UX-C08, UX-C12, UX-C14, UX-C15, UX-C16, UX-C18, UX-C19, UX-C20, UX-C21, UX-C22, UX-C25. IA and IN/EX references resolve to the canonical [UX manifest](../../../product/ux/manifest.yaml).

## Architecture / Security Constraints

SECRES-02 and STATE-05/06 distinguish export backup, temporary local rollback, failed installation and completed recovery. Never use excluded backup MFA to undo installation. Current durable audit is mandatory for restore/enrollment/activation; host repair is separate. Bound hostile archives before extraction/replacement, suppress all proof/key leakage and exercise every interruption boundary.

## Interfaces and Compatibility

Full replacement consumes 16's versioned archive; no selective import/merge or host file browser. Existing MCP contracts resume only after explicit current authorization; all old transport/state credentials fail. Failure evidence and local audit live outside replaced snapshot projection. Operator entry handles total host loss without old instance sessions/storage.

## Acceptance Criteria

- [ ] Valid clean-host and in-place restores preview correct authority/source and achieve complete restricted state; invalid/unsafe/wrong-key archives change nothing.
- [ ] Faults/crashes at every install boundary reach prior coherent state or complete recovery; audit tail persists and no partial account/service activation occurs.
- [ ] Old password-only enrollment, MFA/codes/session/grant/bearer/link/reference cannot authenticate; fresh nominated Owner gains only permitted review and explicitly reenrolled users/reviewed services resume.
- [ ] Imported provenance and unavailable intervals remain truthful; audit failure blocks resumption. A documented clean-host drill meets the conditional RTO and clients reconnect with required new authorization.

## Required Validation

Wrong/missing proof/key/Owner, initiator absent from archive, continuation expiry/replay/cross-archive concurrency, unsafe archive entries/zip expansion/resource bounds, insufficient staging space, interrupted drain, failed pre-backup, every atomic install/rollback crash point, missing original host/key, lost continuation and host recovery. Verify old-access invalidation exhaustively and local/clean-host audit continuity, including outage during enrollment. Browser desktop/narrow/keyboard recovery plus final UX-C01–25 task evidence; repeat ChatGPT/Codex reconnect after restore and full gateway preservation tests.

For each new external input add positive and negative tests, plus concurrency/failure cases named here. Run focused/related checks while building; at milestone completion run `npm test` and `npm run build` plus the required browser/operational evidence. If full tests fail with loopback `listen EPERM`, rerun the same suite with appropriate permission, never weaken listener tests. User-facing work requires rendered browser, keyboard and narrow-width evidence for its listed UX checks. Full-suite repetition is warranted after new changes, not as ceremony. No application tests are required merely to compile this documentation.

## Known Risks / Deferred Work

Crash consistency and audit provenance are the main remaining implementation risks; no successful happy-path demo substitutes for failure injection. Infrastructure/material availability is outside the four-hour clock. Final acceptance requires completed prior milestones and recorded runtime evidence, not this planning document.
