# Web console delivery milestones — UX10 remaining delta

Input mode **PRODUCT_BUILD**. Current validated package `workflow/definition/definition-package.yaml` revision `sha256:6ac2a12358abf60bee58ee1f5377ff7c119e06895d099b255cbac78182599b2c`, published payload `6a03a5523246e8b834aeceb97dc818de32fce461`, governs. All indexed hashes verified; passed definition gates consumed without rerunning them. REC015 is adopted provenance for six remaining remediations, not unresolved producer authority. Completed M10–48 and all prior regression history remain preserved. Accepted SEC-DEF-001 and SMTP exception remain.

## Current outcomes

| Milestone | Outcome | Dependencies | Status |
|---|---|---|---|
| [M49](49-clear-shared-console-tasks.md) | Use clear shared sign-in, Settings and service tasks | M43, M45, M48 | pending |
| [M50](50-reviewed-credential-removal.md) | Remove credential configuration and eligible saved values on Apply | M49, M29, M34, M47 | pending |
| [M51](51-archived-service-permanent-deletion.md) | Permanently delete an Archived service with retained evidence | M50 | pending |

## Granularity and order

M49 consolidates four small shared task-shell/presentation remediations; separate milestones for helper copy, warning, sign-in or transient Settings mounting would multiply gates without a substantial new outcome. Its finite demo is sign-in → stable Settings → service advisory/review/fix navigation, not an unbounded Settings redesign. M50 is the complete reviewed credential-removal transaction across UI/proposal/state/runtime/recovery. M51 separately delivers immediate Archived object destruction, a materially different lifecycle and confirmation risk, consuming M50's durable incarnation/dependency fences. No standalone foundation, catchall bucket, per-finding milestone or implementation slices. Earliest integrated demonstration is M49's existing task journey; earliest destructive demonstration is M50's saved-draft-only removal through actual Apply.

## Validation and boundaries

Focused affected checks/build and inspected actual visual evidence at each outcome; **UX10-INTEGRATED** separately schedules complete bounded-worker suite/build, joined browser and changed-state recovery qualification before deployment/final acceptance. Preserve mandatory security/external-input/recovery gates; one milestone's targeted PASS does not certify release. First unexpected out-of-area regression widens focused scope; second distinct regression/spread requires full regression after repairs. No tests, bootstrap probes, code or readiness repair run during compilation. No blocked, deferred or unmapped required work. Completed contracts remain historical and unchanged.

## Completed history

| Milestone | Contract | Status |
| --- | --- | --- |
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
| M41 | [Complete service setup through precise guidance](41-service-setup-and-readiness.md) | completed |
| M42 | [Transfer configuration with usable YAML downloads](42-configuration-transfer-tools.md) | completed |
| M43 | [Find and review operational settings clearly](43-settings-navigation-and-review.md) | completed |
| M44 | [Manage SMTP credentials through a clear focused task](44-smtp-credential-dialogs.md) | completed |
| M45 | [Configure services and Settings with clear consistent actions](45-consistent-editing-actions.md) | completed |
| M46 | [Investigate scoped Activity with reusable filters and relevant exports](46-scoped-activity-investigation.md) | completed |
| M47 | [Edit and discard service proposals through one coherent flow](47-service-edit-review-and-discard.md) | completed |
| M48 | [Import separate unassigned services and retire legacy mappings safely](48-independent-unassigned-service-import.md) | completed |
