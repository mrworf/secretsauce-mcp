# Milestone 16: Create recoverable encrypted instance backups

## Objective

Create a complete portable recovery point with safe scheduling and independently held recovery material.

## User/System Outcome

An Owner makes/downloads a valid encrypted archive, sees truthful backup health and configures daily mounted-directory backups and retention; incomplete output never displaces the last valid archive.

## Scope

Manual/scheduled whole-instance backup, downloadable encrypted archive, format/integrity/dependency manifest, independent recovery material management, consistent snapshot and single-job coordination, progress/history/health/alerts and retention.

## Explicit Exclusions

Restore installation/reenrollment is 17. No remote-storage connector, selective/per-user backup product, downstream-data backup, plaintext export backup, or multi-instance coordination.

## Source Requirements

[PRD](../../../docs/web-console-prd.md) and normative contracts: `BACKUP-01`, `BACKUP-02`, `OPS-03`, `OPS-04`, `OPS-06`, `IDENT-04`, `IDENT-06`, `CONFIG-03`, `SEC-01`, `AUDIT-01`, `AUDIT-03`, `AUDIT-04`, `STATE-04`, `UX-03`, `UX-04`.

[Journey audit](../../../docs/web-console-prd-user-journey-audit.md): J-OWNER-BACKUP, J-SYSTEM-BACKUP, J-OWNER-SETTINGS. Shared sources/revisions and preservation rules are in [index](index.md); exact coverage rows are in [traceability](traceability.md).

## Preconditions

15 exposes all included identity/configuration/client/settings/audit domains and operating controls. Consume 10's setup recovery material and durable gate; 11's settings transaction; 12's notification boundary. The archive format and recovery verifier produced here are providers for 17.


Readiness prerequisite IDs resolve to the [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).

- `PRE-001–005` — committed authority, existing regression/build baseline, declared Node/npm/packages, writable loopback test execution and an available browser; current facilities verified with the limitations in the readiness report.
- `PRE-007`, `PRE-008`, `PRE-009`, `PRE-010`, `PRE-011`, `PRE-012` — the earlier providers named above must be completed with committed acceptance evidence before this milestone begins; currently pending implementation.
- `PRE-014` — this milestone owns its specific positive/negative and failure fixtures; reuse earlier declared harnesses, never undeclared local packages.
- `PRE-017` — use synthetic SMTP delivery and manual-link fallback; real SMTP provisioning is optional.
- `PRE-016` — host operator/CI maintainer supplies permitted Docker and isolated persistent/disposable storage before operational validation. Current sandbox daemon access is denied; record the manifest’s completion evidence before acceptance.
- `PRE-018` — generate protected synthetic archive/key and isolated recovery fixtures as part of this milestone; never require production data or original-host secrets.

## Readiness checks

- Inspect `delivery/milestones/secretsauce-mcp/status.yaml` and the committed planning handoff: this milestone is selected explicitly, source revisions still match, and all direct dependencies are completed with evidence. The legacy next-MVP selector targets the historical packet and must not select this work.
- Run `node --version` and `npm --version`; Node satisfies `package.json` (>=22). On a fresh checkout run `npm ci`; installed dependencies come from the lockfile. CI remains Node22. Use writable temp storage and loopback permissions; if `npm test` reports `listen EPERM`, rerun the identical suite with permission per AGENTS.md.
- Confirm `npm run build` and `npm test` remain the documented baseline commands (a newly executed result is required at milestone acceptance; readiness’s existing baseline is not feature evidence). Inspect previous milestone validation before modifying shared contracts.
- Inspect the browser procedure/harness and available browser before UI validation; it must load the implemented local page and support keyboard and 320px checks without depending on undeclared cached packages. New commands are recorded by the owning implementation, not invented here.
- On the authorized test host run `docker version` and `docker compose version`; both must succeed with server access. Inspect writable independent mounts and disposable target capacity before using the owning milestone’s smoke/drill instructions. Missing host access blocks those validation steps.
- Inspect synthetic archive/material provenance and separate staging/rollback target evidence. Pass when fixtures derive from completed providers and can be destroyed without touching real instance state.

## Functional Requirements

- Include services/destinations/policies/scanners/revisions, managed downstream and encrypted system secrets, users/roles/assignments/password verifiers, settings, retained audit and version/integrity/dependency manifest. Exclude gateway/response references, browser sessions, OAuth grants/refresh/auth codes, MFA seeds/recovery codes, pending invitations/recovery links, downstream data, images and proxy configuration.
- Capture one coherent point with identified audit boundary; concurrent apply/rotation is wholly before or after, never a missing dependency. Report recovery-point and completion time, software/format compatibility, size and outcome. Only one backup/restore job can run at once. Bounded snapshot coordination may pause writes; no uninterrupted-execution guarantee is invented.
- Encrypt every archive so independent recovery material alone can decrypt all included key dependencies on a clean host, without lost host storage. Owners received material at setup; changing it requires recent password/TOTP and clearly preserves knowledge of material required for retained archives. Never display secrets/recovery material in job history or diagnostics.
- Owner manually starts, downloads with recent authentication, and configures daily schedule/mounted directory plus 30-day default retention through the normal review/apply contract. Show deletion impact on retention reduction. Completed archives are published only after complete integrity checks; failures/partial output cannot replace the last valid backup.
- Bound job resources/storage, report progress without fabricated percentages, handle restart/interruption and unknown outcome by stable job state. Durable audit gates scheduled/manual creation, download and retention. Health and optional SMTP show failure without falsely succeeding or disabling unrelated operation.
- UI/runbook states off-host copy is operator responsibility, local storage does not protect against host loss, and RPO target is 24 hours with successful backups. Document recovery scope, independent material storage and scheduling/retention.

## UX Constraints

UX-IA03 Settings → Backups & restore and UX-IN07 show encrypted scope, recovery/completion points, compatibility, status, retention and off-host responsibility. UX-IN02/03 applies impact review/recent authentication where required. UX-IN05 separates queued/running/failed/completed/unknown; loading or failed download never reports success. UX-C17 is the milestone-specific observable contract.

All affected pages inherit [UX-R01–03](../../../product/ux/03-responsive-and-platform.md), [UX-V01–03](../../../product/ux/04-visual-system.md) and [UX-A01–04](../../../product/ux/05-accessibility.md): calm moderate-density service-first hierarchy, text/icon state, visible focus/labels/errors/status announcements, keyboard-only completion, no hover/drag-only action, accessible confirmation focus return, and routine reflow at 320 CSS px. Narrow layouts retain essential actions, My account and logout. Loading/empty/validation/forbidden/offline/expired/failed states preserve safe non-secret context and never fabricate success. The approved concepts guide composition, not missing-feature exemptions or exact pixels.

Required [observable checks](../../../product/ux/07-acceptance-checklist.md): UX-C10, UX-C15, UX-C17, UX-C20, UX-C21, UX-C22, UX-C24. IA and IN/EX references resolve to the canonical [UX manifest](../../../product/ux/manifest.yaml).

## Architecture / Security Constraints

STATE-04 inclusion/exclusion is semantic even if storage snapshot APIs would copy excluded state. The local installation rollback source in 17 is not this archive. Encryption/key wrapping mechanisms are delegated; validate clean-host decryption, excluded factor absence and corruption detection. No raw credentials/proofs in telemetry, metadata preview or unencrypted temporary artifacts.

## Interfaces and Compatibility

Add a versioned portable archive contract with integrity/dependency information, job status, download and schedule settings. Preserve gateway execution semantics and live reference lifecycle. Exported archives are distinct from 13's sanitized configuration export. Provide 17 a bounded validation/decryption interface, not host-arbitrary extraction.

## Acceptance Criteria

- [ ] Manual and scheduled encrypted archives represent consistent recoverable state under concurrent apply/rotation and can be verified/decrypted independently of original host material.
- [ ] Inclusion/exclusion checks find no live grants, MFA, recovery links or references in exported recovery data; retained credential dependencies are complete.
- [ ] Download/retention/material changes enforce Owner/recent-auth/audit rules; overlap, wrong material and interrupted/storage-failed jobs do not publish success or remove last good backup.
- [ ] UI reports true recovery point, completion, progress/health and off-host obligation; schedule demonstrates 24-hour target under successful operation.

## Required Validation

Positive/negative backup settings, archive manifest/key inputs and download authorization; simultaneous job starts, audit/disk/key failure and restart at publication boundaries; snapshot races with grants/rotation/apply; clean isolated decryption and malicious/corrupt manifest rejection; excluded-state inspection using synthetic secrets; retention failure/impact and SMTP alerts. Validate recoverability here without claiming restore installation acceptance until 17.

For each new external input add positive and negative tests, plus concurrency/failure cases named here. Run focused/related checks while building; at milestone completion run `npm test` and `npm run build` plus the required browser/operational evidence. If full tests fail with loopback `listen EPERM`, rerun the same suite with appropriate permission, never weaken listener tests. User-facing work requires rendered browser, keyboard and narrow-width evidence for its listed UX checks. Full-suite repetition is warranted after new changes, not as ceremony. No application tests are required merely to compile this documentation.

## Known Risks / Deferred Work

Backup portability depends on complete key dependencies; archive plus material exposes included data to its holder even though activation later needs host/Owner proof. Independent material protection/off-host copy is operational responsibility. RPO is conditional on successful backups, not a guarantee against missing copies.
