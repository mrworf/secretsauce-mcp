# Web console delivery milestones — current UX7 delta

Input mode: **PRODUCT_BUILD**, current validated Product Definition package as primary authority. This is incremental completion of the remaining approved capability, not a rebuild. Completed M10–40 remain unchanged. Historical REC012 pending-definition flags are retained; the committed current definition handoff discharged that gate. No unready standalone CHANGE_PLAN is consumed.

## Authority and eligibility

- Package: workflow/definition/definition-package.yaml, `sha256:5cbab67a72563abc911de8c314ad900dd9da2614118a27fc4e3500d502ac5732`, payload `ff213d5a1803b337050149ebffc8ae2debaadee5`; all indexed revisions verified and six passed validation records consumed without repeating Product Definition.
- Current PRD and UX7 govern required behavior; STATE-01/03/09, SECRES-07/08 and approved UX exception rules constrain it. Accepted UX-DESIGN-006 selects both Limits categories and Settings search dialog.
- REC011/012 resolved remediations and all53 feedback dispositions are traceability, audit states are evidence, not independent scope. Prototype values do not create new knobs/defaults.
- Preserve implementation6810fe3 behavior outside the exact delta. No new roles, SSO, templates, transport, migrations or automatic activation.

## Current outcome graph

| Milestone | User-visible outcome | Completed providers | State |
|---|---|---|---|
| [M41: Complete service setup through precise guidance](41-service-setup-and-readiness.md) | Import or create a service, see exactly what is missing, correct it, and reach the actual review through one consistent four-section flow. | M25, M26, M33, M38, M39 | pending |
| [M42: Transfer configuration with usable YAML downloads](42-configuration-transfer-tools.md) | Download sanitized configuration, import it into an isolated second instance, and finish setup without exposing live authority; history/reuse UI stays hidden while its capability persists. | M13, M25 | pending |
| [M43: Find and review operational settings clearly](43-settings-navigation-and-review.md) | An administrator finds a setting, edits a focused populated group, corrects an error and reviews the exact full change set without losing work or hiding decision information. | M20, M24 | pending |
| [M44: Manage SMTP credentials through a clear focused task](44-smtp-credential-dialogs.md) | An Owner sees current SMTP credential status and stages Set/Replace in a focused dialog, while independent Clear preserves its existing immediate dependency-checked contract. | M19, M24, M30 | pending |

The four new outcomes have no new inter-milestone prerequisite: each consumes completed providers. Shared files do not create a dependency. Recommended delivery order starts M41 for the earliest integrated demonstration: imported service → precise missing-value/mapping correction → four-section editing → real review. Other outcomes can proceed independently; final integration checkpoint covers their shared shell/edit guards.

## Granularity assessment

| Milestone | Why this boundary |
|---|---|
| M41 | Readiness explanation, corrections and progression are inseparable parts of reaching a valid review; splitting produces inconsistent error paths. |
| M42 | Portable transfer plus simpler configuration-tools entry is independently valuable; file fidelity/authority sanitization is a separate integration risk from editor routing. |
| M43 | One find-edit-correct-review Settings journey unifies navigation, search, local bounded controls and readable effects; these share unsaved-form and full-scope review state. No scheduler/runtime/recovery redesign. |
| M44 | Credential entry and Clear presentation share focused task UX but have security-sensitive distinct timing/dependency semantics, independently testable from general Settings navigation. |

Twelve resolved remediation items consolidate into four outcomes, not one milestone per finding. No generic foundation, M0, standalone copy cleanup or catch-all feature bucket. M43 is finite: find a supported setting, edit its populated group, correct it, inspect complete review; it excludes scheduler, recovery, persistence and SMTP credential mutation. M44 stays separate because credential staging/deletion have distinct trust and timing risk. M42 tests cross-instance YAML compatibility independently of editing. No required work is deferred.

## Validation and qualification

Focused affected tests, build and actual browser/visual evidence belong to each outcome. The separate `status.yaml#regression_checkpoints.UX7-INTEGRATED` requires one full bounded-worker suite/build and joined browser qualification after all outcomes and before deployment/final packet acceptance. This supersedes the prior compiler preference to rerun full regression after every small milestone; it does not waive AGENTS gates. New external inputs still need positive/negative tests. First confirmed out-of-area regression expands focused scope; second distinct regression or spread escalates full regression after repairs. A bounded delivery stop records broader qualification pending.

Use matching approved references in product/ux/manifest.yaml, with UX7 delta precedence. Compare actual states for width, spacing, density, typography, controls, colors and hierarchy; functional PASS or uninspected screenshots are insufficient. Cover touched missing-credential/import-mapping, SMTP absent/current/pending/clear-blocked, role/navigation, keyboard and enlarged-text states. Audit INCOMPLETE_COVERAGE is not release acceptance. Synthetic local MCP/browser evidence does not certify real external LLM connectivity.

## Completed history

| Milestone | Title | State |
|---|---|---|
| M10 | [Establish secure audited console access](10-secure-audited-setup.md) | completed |
| M11 | [Configure and activate services safely](11-managed-service-configuration.md) | completed |
| M12 | [Manage people and recover accounts](12-people-and-account-recovery.md) | completed |
| M13 | [Author advanced policy and migrate configuration](13-advanced-policy-and-migration.md) | completed |
| M14 | [Connect and govern MCP clients](14-mcp-client-access.md) | completed |
| M15 | [Operate and inspect the managed instance](15-operating-evidence-and-limits.md) | completed |
| M16 | [Create recoverable encrypted instance backups](16-encrypted-instance-backups.md) | completed |
| M17 | [Restore and resume an instance safely](17-safe-instance-recovery.md) | completed |
| M18 | [Separate assisted password and Authenticator resets](18-assisted-identity-resets.md) | completed |
| M19 | [Delete SMTP credentials independently](19-independent-smtp-deletion.md) | completed |
| M20 | [Navigate focused Settings with exact draft review](20-focused-settings-and-navigation.md) | completed |
| M21 | [Configure all capabilities with forms and lossless import](21-friendly-configuration-and-import.md) | completed |
| M22 | [Readable forms and service configuration](22-readable-forms-and-services.md) | completed |
| M23 | [Manage accounts through clear People details](23-people-details-and-account-management.md) | completed |
| M24 | [Use populated Settings with explicit email transport](24-populated-settings-and-email-modes.md) | completed |
| M25 | [Resolve imported identities without reupload](25-import-identity-recovery.md) | completed |
| M26 | [See service state and confirm lifecycle actions](26-service-lifecycle-rows.md) | completed |
| M27 | [Edit focused service sections in Guided or Advanced mode](27-focused-service-editing.md) | completed |
| M28 | [Configure destinations with explicit TLS scope](28-destination-configuration.md) | completed |
| M29 | [Clear in-use credential values with durable attribution](29-durable-credential-clearing.md) | completed |
| M30 | [Manage write-only values through focused dialogs](30-credential-value-dialogs.md) | completed |
| M31 | [Author policy rules in a clear list and shared dialog](31-policy-rule-dialogs.md) | completed |
| M32 | [Understand service settings and explicit execution access](32-service-help-and-access.md) | completed |
| M33 | [Navigate service history and test policy without losing work](33-service-navigation-and-testing.md) | completed |
| M34 | [Recover credential absence and historical attribution coherently](34-credential-recovery-compatibility.md) | completed |
| M35 | [Compare service changes and inspect complete new settings](35-grouped-service-review.md) | completed |
| M36 | [Confirm reviewed changes with understandable security exceptions](36-service-approval-and-exception-scope.md) | completed |
| M37 | [Open review on the complete proposed settings](37-default-proposed-settings-review.md) | completed |
| M38 | [See concrete security exceptions before approval](38-visible-review-exceptions.md) | completed |
| M39 | [Navigate guided editing without a redundant detection section](39-focused-guided-service-navigation.md) | completed |
| M40 | [Identify every explicit policy scanning override](40-policy-scanning-override-markers.md) | completed |

Completed contracts, records, evidence and delivery-goal history are unchanged. Current status manifest is authoritative; earlier indexes are available in Git history. No new delivery goal is started by compilation.

## Handoff

[Traceability](traceability.md) maps every required delta and every feedback item. Known semantic blockers/unmapped requirements: none. Packet is complete for milestone-readiness, not yet an environment-readiness or release claim. Parent delivery-planning-orchestrator owns commit/publication.
