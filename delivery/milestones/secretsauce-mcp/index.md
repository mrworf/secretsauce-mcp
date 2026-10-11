# SecretSauce web console delivery packet

**Mode:** CHANGE_PLAN. **Product:** `secretsauce-mcp`. M10–17 remain completed; new M18–21 are pending. This approved feedback delta preserves the single-organization self-hosted console and gateway. No implementation has begun.

## Authority and provenance

The [validated definition package](../../../workflow/definition/definition-package.yaml), revision `sha256:f60ab3efcfca9d95991c023058ee81e61838121275ec482b549fed55a87618f9`, producer `4d46db3fa08a25df52b8d7b0aa2357cf8446b2fd`, and committed [definition handoff](../../../workflow/definition/state.yaml) establish eligibility. All six definition stages passed; their validation is consumed, not rerun. REC-RUN-003/REC-IMPACT-003 is immutable provenance and its six [resolved remediation items](../../../workflow/reconciliation/REC-RUN-003/03-remediation-backlog.md) define the delta. Its historical false readiness concerned definition revalidation, explicitly satisfied in the later definition handoff. [Status](status.yaml) pins exact revisions and retains initial compilation provenance/history.

Implementation obligations: REC-RM-001–006 as adopted by PRD, SECRES-05, STATE SMTP amendment and approved UX2. Governing constraints: full indexed current UX/architecture/security, decisions, accepted risks and AGENTS.md. Evidence: findings, coverage and journey audits. Excluded: original exploratory subtabs mechanism, optional suggestions and already-completed behavior. Blocked required sources: none.

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
| 18 | [Separate assisted password and Authenticator resets](18-assisted-identity-resets.md) | 12, 14 | pending |
| 19 | [Delete SMTP credentials independently](19-independent-smtp-deletion.md) | 12 | pending |
| 20 | [Navigate focused Settings with exact draft review](20-focused-settings-and-navigation.md) | 15, 17 | pending |
| 21 | [Configure all capabilities with forms and lossless import](21-friendly-configuration-and-import.md) | 20 | pending |

M18 consumes completed identity recovery plus durable grant revocation. M19 consumes existing SMTP/draft infrastructure. M20 consumes completed operating and recovery surfaces so their actions remain reachable. M21 consumes M20 section/draft navigation and existing M13 import semantics. Only M20 → M21 is a new inter-milestone dependency; no artificial sequencing of resets, SMTP deletion and navigation. Import and friendly configuration consolidate one lossless authoring/round-trip outcome. No M0 or implementation slices are generated.

Completed M10–17 contract files and records, historical docs/milestones, and completed delivery_goal remain unchanged. The old goal is historical and must not be mistaken for completion of M18–21. The legacy next-MVP selector still targets the historical packet; downstream uses this explicit manifest.

## Shared preservation and delivery rules

1. Preserve the five MCP tools and supported schemas; per-POST authentication; subject/service-bound ephemeral references; no trusted transport session ID; cookies, Base64/binary, tolerant JSON source-range replacement and header enforcement. Keep destination/current authorization/canonical policy before substitution or downstream I/O. Actual self-signed TLS regression is mandatory when transport changes.
2. Role permissions, explicit execution assignments, current admission and mandatory durable audit apply on server interfaces, background jobs, imports/history and UI. No permission solely enforced by hiding controls. Every new event excludes raw credentials/tokens/headers/cookies/proofs/seeds and bodies by default.
3. Draft/apply, immediate value/access/lifecycle actions and recovery are separate state transitions. Sanitized history cannot resurrect access, lifecycle or secrets. Already-dispatched work may complete under its admitted protection context; no remote rollback or universal non-exfiltration promise.
4. One active instance, durable encrypted state/keys/audit, atomic hash-only refresh snapshots, ephemeral references and UI-managed routine settings. Preserve working gateway modules rather than rebuild algorithms to fit a frontend choice. No mandatory external database, identity provider, broker or Kubernetes.
5. Approved UX sources are linked in each contract with relevant rules and observable criteria. Four-area service-first navigation, safe operation-status reconciliation, accessible moderate density, progressive disclosure, secret-safe forms and full-page review/recovery apply across views. No inert prototype control counts as delivered behavior.
6. Every new external input has positive and negative tests. At milestone completion run `npm test`, `npm run build`, applicable browser/accessibility and named operational/client evidence. Per-slice planning/commits belong to subsequent minimal-slice-delivery, not this packet. Documentation generation is not runtime validation or release acceptance.
7. Finish relevant runbook/docs with each outcome; use `example.org` examples. Separate OAuth origin from full ChatGPT MCP URL. Keep Docker metadata generation local and tested. Operator responsibilities include off-host copies, patching, access review, incident response and host security; software does not establish SOC 2 compliance.


## Coverage and handoff

[Traceability](traceability.md) maps all six remediation items and retains the original build map as historical evidence. Every required directive is covered; no blocked, deferred or unmapped required work remains. Canonical UX2 includes exact per-field capabilities and UX-C26–33; each contract carries relevant constraints and positive/negative/browser validation.

Compiler structural, source/provenance, preservation and link checks are recorded in `workflow/delivery-planning/results/compiler.yaml`. This documentation-only compilation does not run application acceptance or declare implementation readiness. **Next: milestone-readiness**, automatically invoked by Delivery Planning, owns prerequisites and executable environment audit. Root owns the combined planning commit.
