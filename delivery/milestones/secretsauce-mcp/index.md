# SecretSauce web console delivery packet

**Mode:** CHANGE_PLAN. **Product:** `secretsauce-mcp`. Completed M10–21 and earlier legacy history remain preserved; M22–24 are pending. This is the approved second-feedback delta, not a product rebuild or implementation claim.

## Authority and provenance

The [validated definition package](../../../workflow/definition/definition-package.yaml) at `sha256:82014f66c15c3e7246144c9b44b95c70c7a22aba863d1e8bbd6887ca6afed506`, producer `653ac14f771dc1da7d1d650c577ff439e9b99bce`, and committed [definition next_handoff](../../../workflow/definition/state.yaml) are the effective eligible change handoff. All six definition stages passed and are consumed without revalidation. Immutable REC-RUN-006/REC-IMPACT-006 and its [resolved backlog](../../../workflow/reconciliation/REC-RUN-006/03-remediation-backlog.md) provide eight adopted remediation items; its historical source-closeout/revalidation flag was explicitly satisfied by the later definition transaction. This is not compilation from a stale raw reconciliation handoff. [Status](status.yaml) pins all source hashes and keeps prior compilation provenance.

Implementation authority: adopted REC-RM-007–014 and their PRD/SECRES-06/07/STATE-07/08/approved UX3 contracts. Governing constraints: indexed UX/security/architecture, approved decisions, accepted risks and AGENTS.md. Context/evidence: observations, research, audits and delivered baseline. Exclusions: already-conforming capability, optional unadopted mechanisms, SaaS expansion and unrelated redesign. No unresolved required source work.

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
| 22 | [Readable forms and service configuration](22-readable-forms-and-services.md) | 21 | pending |
| 23 | [Manage accounts through clear People details](23-people-details-and-account-management.md) | 22, 18 | pending |
| 24 | [Use populated Settings with explicit email transport](24-populated-settings-and-email-modes.md) | 22, 19, 20 | pending |

M22 delivers observable shared form/layout and service-authoring correction, consuming M21's working friendly controls. M23 combines People presentation, authorization and metadata because a detail screen without its bounded edits/dates is incomplete; it consumes M22 visual/form rules and M18 durable reset/revocation. M24 combines populated Settings and explicit SMTP transport so saved values, risk/review and current tests are coherent; it consumes M22 presentation, M19 deletion fences and M20 atomic Settings. M23 and M24 are independent of one another. No M0, standalone test-only milestone or implementation slices generated.

Historical completed M10–21 contracts/records and legacy docs/milestones remain unchanged. Existing completed delivery_goal remains historical, not completion of this new scope. Downstream uses this explicit packet manifest, not the legacy next-MVP selector.

## Shared preservation and delivery rules

1. Preserve the five MCP tools and supported schemas; per-POST authentication; subject/service-bound ephemeral references; no trusted transport session ID; cookies, Base64/binary, tolerant JSON source-range replacement and header enforcement. Keep destination/current authorization/canonical policy before substitution or downstream I/O. Actual self-signed TLS regression is mandatory when transport changes.
2. Role permissions, explicit execution assignments, current admission and mandatory durable audit apply on server interfaces, background jobs, imports/history and UI. No permission solely enforced by hiding controls. Every new event excludes raw credentials/tokens/headers/cookies/proofs/seeds and bodies by default.
3. Draft/apply, immediate value/access/lifecycle actions and recovery are separate state transitions. Sanitized history cannot resurrect access, lifecycle or secrets. Already-dispatched work may complete under its admitted protection context; no remote rollback or universal non-exfiltration promise.
4. One active instance, durable encrypted state/keys/audit, atomic hash-only refresh snapshots, ephemeral references and UI-managed routine settings. Preserve working gateway modules rather than rebuild algorithms to fit a frontend choice. No mandatory external database, identity provider, broker or Kubernetes.
5. Approved UX sources are linked in each contract with relevant rules and observable criteria. Four-area service-first navigation, safe operation-status reconciliation, accessible moderate density, progressive disclosure, secret-safe forms and full-page review/recovery apply across views. No inert prototype control counts as delivered behavior.
6. Every new external input has positive and negative tests. At milestone completion run `npm test`, `npm run build`, applicable browser/accessibility and named operational/client evidence. Per-slice planning/commits belong to subsequent minimal-slice-delivery, not this packet. Documentation generation is not runtime validation or release acceptance.
7. Finish relevant runbook/docs with each outcome; use `example.org` examples. Separate OAuth origin from full ChatGPT MCP URL. Keep Docker metadata generation local and tested. Operator responsibilities include off-host copies, patching, access review, incident response and host security; software does not establish SOC 2 compliance.



## Visual fidelity and coverage

[Traceability](traceability.md) maps all eight remediations and retains prior maps. UX-V05/UX-C42 apply to every new milestone: actual browser screenshots must match approved concepts in general appearance at equivalent states/viewports. Each milestone names its references and evidence requirements. Functional tests alone cannot pass visual acceptance; fix material differences or obtain explicit scoped approval. No reference rewriting to hide drift.

Compiler checks are recorded in `workflow/delivery-planning/results/compiler.yaml`. No application acceptance was run by documentation compilation. **Next: milestone-readiness**, inside the root-owned planning transaction; only that specialist assesses executable prerequisites and implementation readiness.
