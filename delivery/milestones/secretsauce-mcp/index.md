# Service review delivery delta — feedback 004

Mode: **CHANGE_PLAN**, product `secretsauce-mcp`. M10–34 are completed and unchanged; M35–36 are pending. [Status](status.yaml) is authoritative for current execution status; tables under historical sections reflect their compilation date.

## Authority and source classes

[Validated definition package](../../../workflow/definition/definition-package.yaml), revision `sha256:a8282a031ef8c76e5b80f620e30b26eb202763b5eb65b4a091fd2435ac6e449b`, producer `d84ac2265bd6c055a6da5edfe5f3d586137d30e9`, and [effective handoff](../../../workflow/definition/state.yaml#next_handoff) establish current eligibility. Required work is adopted REC-RM-027–029 from [REC009](../../../workflow/reconciliation/REC-RUN-009/03-remediation-backlog.md). Immutable REC009 historical revalidation flags are satisfied by committed targeted definition revalidation, not rewritten. UX5/UX-DESIGN-005, CONFIG-03/POLICY-04, architecture/security and AGENTS.md are governing constraints. Findings, screenshots and observations are context; prototype omissions do not remove capabilities. No blocked or unresolved required item.

## Current milestones and dependencies

| ID | Outcome | Direct providers | Initial status |
| --- | --- | --- | --- |
| M35 | [Compare service changes and inspect complete new settings](35-grouped-service-review.md) | M27, M33 | pending |
| M36 | [Confirm reviewed changes with understandable security exceptions](36-service-approval-and-exception-scope.md) | M35, M28 | pending |

M35 → M36: confirmation consumes the reviewed comparison context. M27/M33 supply existing editing/navigation; M28 supplies effective destination TLS semantics. Completed providers are not reopened. No generic foundation or M0. M35 is the earliest integrated checkpoint; no confirmation redesign must be completed before demonstrating its comparison outcome.

## Granularity assessment

| Milestone | Observable checkpoint | Boundary and coupling |
| --- | --- | --- |
| M35 | Edit a representative imported service, save and open review; compare changed section pairs, inspect the complete proposal, then return to edit without mutation. | Comparison and complete-proposal tabs share one immutable reviewed scope and must agree; confirmation and exception wording remain a separate independently acceptable outcome. |
| M36 | From the grouped review, open and cancel confirmation, then acknowledge every effective exception and apply exactly the reviewed service; stale or unauthorized attempts remain rejected. | The confirmation and readable exception scope are one approval decision: each visible risk must map to its existing exact acknowledgment identity. TLS transport and independent comparison rendering are not rebuilt. |

PASS: no unresolved granularity findings. Shared code/testing does not justify merging both outcomes. TLS scope and exact risk identities remain inseparable from the acknowledgment decision; no standalone copy sweep or lower-layer scaffolding milestone. No implementation slices are prescribed.

## Validation and exclusions

Each milestone owns focused tests, positive/negative external-input and state evidence, actual HTTPS screenshots against approved feedback004 at matching desktop/narrow states, keyboard and 200% text checks, then full bounded-worker suite/build. M36 owns combined review-to-activation acceptance, with prior functionality regression; no deployment/real-user data. Synthetic representative inputs include custom methods, nested options, regex and array reorder; they do not certify external client connections. Existing explicit real-LLM exception remains. All supported capability/literal and review security contracts survive. Global Settings/SMTP, TLS runtime, backup/recovery redesign, new permissions/tenancy and unrelated repairs are excluded. Readiness auditing is delegated; this is only a complete compilation packet.

---

## Historical compilation index (status at its compilation date)

# SecretSauce web console delivery packet

**Mode:** CHANGE_PLAN. **Product:** `secretsauce-mcp`. Completed M10–24 and earlier legacy history are preserved; M25–34 are pending. Only adopted feedback 003 remediation is new scope.

## Authority and provenance

The [validated package](../../../workflow/definition/definition-package.yaml) at `sha256:7f417f6965b95f3451144126133831ec1d5c62daee6a148d3606e7552f0b134c`, producer `d0dffc6ffbc47f114dc232abedf40f50db3e52f3`, and committed [definition next_handoff](../../../workflow/definition/state.yaml) establish eligibility. All six passed definition validations are consumed, not repeated. Immutable REC-RUN-008/REC-IMPACT-008 and its [resolved backlog](../../../workflow/reconciliation/REC-RUN-008/03-remediation-backlog.md) supply REC-RM-015–026. Its historical definition/source-closeout gate is fulfilled by the later definition transaction; raw historical flags are not rewritten. [Status](status.yaml) pins all hashes and preserves previous compilation provenance.

Implementation authority is adopted REC-RM-015–026 and corrected PRD requirements. Governing constraints are UX4/UX-DESIGN-004, STATE-09, SECRES-08, existing architecture/security/roles/audit and AGENTS.md. Research, observations, prototype samples and findings are context, not independent work. Approved prototype references constrain general appearance without removing omitted capabilities. No unresolved required work or product decision remains.

## Milestones and dependencies

| ID | Outcome | Direct prerequisites | Status |
| --- | --- | --- | --- |
| 10 | [Establish secure audited console access](10-secure-audited-setup.md) | Existing gateway | completed |
| 11 | [Configure and activate services safely](11-managed-service-configuration.md) | 10 | completed |
| 12 | [Manage people and recover accounts](12-people-and-account-recovery.md) | 11 | completed |
| 13 | [Author advanced policy and migrate configuration](13-advanced-policy-and-migration.md) | 12 | completed |
| 14 | [Connect and govern MCP clients](14-mcp-client-access.md) | 12 | completed |
| 15 | [Operate and inspect the managed instance](15-operating-evidence-and-limits.md) | 13, 14 | completed |
| 16 | [Create recoverable encrypted instance backups](16-encrypted-instance-backups.md) | 15 | completed |
| 17 | [Restore and resume an instance safely](17-safe-instance-recovery.md) | 16 | completed |
| 18 | [Separate assisted password and Authenticator resets](18-assisted-identity-resets.md) | 12, 14 | completed |
| 19 | [Delete SMTP credentials independently](19-independent-smtp-deletion.md) | 12 | completed |
| 20 | [Navigate focused Settings with exact draft review](20-focused-settings-and-navigation.md) | 15, 17 | completed |
| 21 | [Configure all capabilities with forms and lossless import](21-friendly-configuration-and-import.md) | 20 | completed |
| 22 | [Readable forms and service configuration](22-readable-forms-and-services.md) | 21 | completed |
| 23 | [Manage accounts through clear People details](23-people-details-and-account-management.md) | 22, 18 | completed |
| 24 | [Use populated Settings with explicit email transport](24-populated-settings-and-email-modes.md) | 22, 19, 20 | completed |
| 25 | [Resolve imported identities without reupload](25-import-identity-recovery.md) | 21 | pending |
| 26 | [See service state and confirm lifecycle actions](26-service-lifecycle-rows.md) | 22 | pending |
| 27 | [Edit focused service sections in Guided or Advanced mode](27-focused-service-editing.md) | 22 | pending |
| 28 | [Configure destinations with explicit TLS scope](28-destination-configuration.md) | 27 | pending |
| 29 | [Clear in-use credential values with durable attribution](29-durable-credential-clearing.md) | 11 | pending |
| 30 | [Manage write-only values through focused dialogs](30-credential-value-dialogs.md) | 27, 29 | pending |
| 31 | [Author policy rules in a clear list and shared dialog](31-policy-rule-dialogs.md) | 27 | pending |
| 32 | [Understand service settings and explicit execution access](32-service-help-and-access.md) | 27 | pending |
| 33 | [Navigate service history and test policy without losing work](33-service-navigation-and-testing.md) | 27, 31 | pending |
| 34 | [Recover credential absence and historical attribution coherently](34-credential-recovery-compatibility.md) | 17, 25, 26, 28, 30, 32, 33 | pending |

M25 is the earliest integrated checkpoint: representative YAML import, explicit mapping correction and fresh review with preserved edits. It runs before broad editor changes and proves the reported blocked journey. Synthetic fixtures use realistic multi-service structures/custom options; they do not prove a real deployment or real ChatGPT/Codex connection. Every later milestone has its own usable checkpoint and focused evidence; M34 adds complete integrated local browser/protocol/Docker qualification. No M0 or implementation slices are generated.

## Granularity assessment

| Milestone | Observable checkpoint | Scope boundary and coupling rationale |
| --- | --- | --- |
| M25 | Import a representative multi-service YAML fixture, explicitly repair two unresolved subjects in place, retain unrelated edits and reach review without granting execution. | Mapping inspection and correction are inseparable parts of this recovery journey; no generic importer rebuild. |
| M26 | Inspect Active plus draft and unavailable activation, then confirm Disable/Delete and restore as Disabled from the list. | Rows and their lifecycle actions share one state/confirmation contract; no configuration editor or network health subsystem. |
| M27 | Open an imported service, inspect actual current Overview, edit one populated section, switch whole-draft representations losslessly and navigate creation steps directly. | Focused sections and the global mode switch govern the same draft representation/navigation boundary; separating them would temporarily duplicate editors or risk losing hidden data. Destination/rule/secret dialogs remain later independently acceptable outcomes. |
| M28 | Edit a destination with inherited certificate verification and an explicit override, use focused advanced matching and return without losing literals. | One destination editing journey including ordinary and advanced representations; transport changes are excluded unless necessary to preserve semantics. |
| M29 | Clear an applied key through confirmed UI, observe blocked new execution with unchanged lifecycle, deliberately Set it, and verify stable last-successful attribution after restart. | Clear, generation fencing, current projection coherence and successful actor/time persistence form one atomic mutation outcome. Splitting attribution storage would create newly written records without required attribution. Full entry-dialog redesign and archive qualification are separate. |
| M30 | Open Set/Replace from Configuration and creation Authentication, cancel without mutation, save immediately, and focus a newly added credential. | Shared entry dialogs must agree in both contexts; no new credential storage or admission design is assigned here. |
| M31 | Add and edit a representative imported rule through the same dialog, select common methods and retain custom methods/regex/options while preserving effective order. | List and shared Add/Edit are one rule-authoring outcome; safe testing/history are separate. |
| M32 | Read context-specific guidance, distinguish a proposed assignment from current execution access, and confirm an authorized existing-service access change. | Plain guidance is tied to actual field/access consequences rather than a standalone copy sweep; it preserves all advanced capabilities and does not repeat destination/rule redesign. |
| M33 | Use actual browser Back/Forward and a deep link, run no-I/O policy testing in context, return with focus/scroll and safe edits intact. | History, tool return and dirty guards share the same editing-context contract; no router-wide rewrite or global Settings redesign. |
| M34 | Create an encrypted post-clear snapshot and restore it on isolated supported Docker mounts, proving absence, historical attribution and Disabled lifecycle. | Snapshot projection, bounded validation and restore admission must agree end-to-end; unrelated backup scheduling and recovery UI redesign are excluded. |

No unresolved oversized milestone findings. PRE-043 correction: M34 explicitly depends on the terminal provider milestones for its full integrated acceptance; M27/M29/M31 are covered transitively. Numeric order is not relied on. The focused draft representation and mode switch stay together; atomic credential clearing and successful actor storage stay together. Destination editing, value-entry presentation, rule authoring, access guidance, navigation/testing and recovery retain independent acceptance boundaries. Shared files or validation cost are not dependencies. Completed provider prerequisites and genuine new dependencies are explicit in the manifest; implementation must not infer a chain from numeric order.

## Shared preservation and delivery rules


1. Preserve the five MCP tools and supported schemas; per-POST authentication; subject/service-bound ephemeral references; no trusted transport session ID; cookies, Base64/binary, tolerant JSON source-range replacement and header enforcement. Keep destination/current authorization/canonical policy before substitution or downstream I/O. Actual self-signed TLS regression is mandatory when transport changes.
2. Role permissions, explicit execution assignments, current admission and mandatory durable audit apply on server interfaces, background jobs, imports/history and UI. No permission solely enforced by hiding controls. Every new event excludes raw credentials/tokens/headers/cookies/proofs/seeds and bodies by default.
3. Draft/apply, immediate value/access/lifecycle actions and recovery are separate state transitions. Sanitized history cannot resurrect access, lifecycle or secrets. Already-dispatched work may complete under its admitted protection context; no remote rollback or universal non-exfiltration promise.
4. One active instance, durable encrypted state/keys/audit, atomic hash-only refresh snapshots, ephemeral references and UI-managed routine settings. Preserve working gateway modules rather than rebuild algorithms to fit a frontend choice. No mandatory external database, identity provider, broker or Kubernetes.
5. Approved UX sources are linked in each contract with relevant rules and observable criteria. Four-area service-first navigation, safe operation-status reconciliation, accessible moderate density, progressive disclosure, secret-safe forms and full-page review/recovery apply across views. No inert prototype control counts as delivered behavior.
6. Every new external input has positive and negative tests. At milestone completion run `npm test`, `npm run build`, applicable browser/accessibility and named operational/client evidence. Per-slice planning/commits belong to subsequent minimal-slice-delivery, not this packet. Documentation generation is not runtime validation or release acceptance.
7. Finish relevant runbook/docs with each outcome; use `example.org` examples. Separate OAuth origin from full ChatGPT MCP URL. Keep Docker metadata generation local and tested. Operator responsibilities include off-host copies, patching, access review, incident response and host security; software does not establish SOC 2 compliance.




## Visual fidelity, coverage and handoff

[Traceability](traceability.md) maps all twelve remediations and every feedback record to its adopted authority or non-implementation disposition. UX-V05/V06 and UX-C42/C53 require actual matching-state browser screenshots against approved feedback 003 concepts, at desktop/narrow states with keyboard/text enlargement checks. Functional tests alone cannot establish acceptance. Repair material differences or obtain explicit scoped approval; do not change reference designs to hide drift.

Completed M10–24 documents/status records and existing completed delivery_goal remain history. New scope is not yet a delivery goal. Compiler result: workflow/delivery-planning/results/compiler.yaml. Packet is complete for **milestone-readiness**, not a claim of executable readiness or implemented behavior. Parent Delivery Planning owns the combined transaction; no child commit.
