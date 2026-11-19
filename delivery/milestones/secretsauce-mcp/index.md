# Web console delivery milestones — current UX8 delta

Input mode **PRODUCT_BUILD**. Current published UX8 definition package is primary authority; compile only remaining REC013 delta after completed M10–44. Historical REC013 pending revalidation flags were discharged by six current definition passes; no unready standalone CHANGE_PLAN is consumed.

## Authority and eligibility

Package `workflow/definition/definition-package.yaml` at `sha256:781ffaf28362e1189a5e7f7353bbf8d9b89f1d4928b98e1f060f7022d3cf9548`, payload `80edc3f0b720b3a5bf7b49a8585817a38072ed54`; exact indexed revisions verified, passed definition validations consumed without repeating them. Current PRD/UX8 and targeted architecture/security reviews create/constrain work; REC013/feedback preserve trace, not fresh scope. Preserve completed M10–44 and passed UX7-INTEGRATED. Accepted SEC-DEF-001 and SMTP UX-EX03 remain unchanged.

## Current outcome graph

| Milestone | Outcome | Completed providers | Status |
|---|---|---|---|
| [M45](45-consistent-editing-actions.md) | Consistent Settings/service editing actions and explanations | M31,M32,M41,M43,M44 | pending |
| [M46](46-scoped-activity-investigation.md) | Bounded scoped Activity investigation and relevant evidence exports | M15,M42,M43 | pending |

No dependency between new outcomes: both consume completed contracts. Earliest integrated demonstration is M45: edit populated Settings through one bar; configure a named service credential/policy/access and review without changing value timing. M46 independently demonstrates query→detail→searched export plus report destinations. Shared files require coordination, not false dependency edges.

## Granularity assessment

Five remediation outcomes consolidate into two bounded user tasks. M45 combines small presentation corrections sharing the editing/state/action hierarchy and existing form guards; a separate footer, wording or card milestone would add gates without independent substantial capability. It excludes Activity, new predicates and persistence changes. M46 joins chips, hard scope, pagination/detail/export parity and report placement because shipping half would leave investigation/export inconsistent. Its richer user input and confidentiality/authorization risk justify separation from M45. No foundation, catch-all subsystem rewrite, per-finding milestone or prescribed slice count.

## Validation boundary

Focused build/tests/browser and actual approved-state visual comparison belong to each milestone. `status.yaml#regression_checkpoints.UX8-INTEGRATED` separately requires one full bounded-worker suite/build plus joined role/edit/investigation qualification before deployment/final acceptance. Preserve AGENTS mandatory gates and first/second unexpected-regression escalation. No tests, readiness bootstrap or acceptance executed in compilation. Local synthetic evidence cannot certify external LLM connectivity.

## Exclusions and blockers

No blocked or unmapped required work. Superseded220/223 do not create work; suggestions/preferences remain advisory. Existing result cards, SMTP timing, history UI hiding, transfer YAML, all completed runtime and recovery behavior remain intact. No new roles, query language, saved searches, extra Settings primary section or immutable search persistence.

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

| M41 | [Complete service setup through precise guidance](41-service-setup-and-readiness.md) | completed |
| M42 | [Transfer configuration with usable YAML downloads](42-configuration-transfer-tools.md) | completed |
| M43 | [Find and review operational settings clearly](43-settings-navigation-and-review.md) | completed |
| M44 | [Manage SMTP credentials through a clear focused task](44-smtp-credential-dialogs.md) | completed |

Completed contracts, records, evidence and delivery-goal history are unchanged. Current status manifest is authoritative; earlier indexes are available in Git history. No new delivery goal is started by compilation.

## Handoff

[Traceability](traceability.md) maps every required delta and every feedback item. Known semantic blockers/unmapped requirements: none. Packet is complete for milestone-readiness, not yet an environment-readiness or release claim. Parent delivery-planning-orchestrator owns commit/publication.
