# Feedback 3 bounded product resolution

Scope: REC-DEC-010 and proposed product adoption of resolved REC-DEC-008. This is not a full PRD review or implementation approval. No canonical product source was edited.

## REC-DEC-010 — Resolved within existing lifecycle

PO-FB-048 requires right-side service Delete/Enable/Disable actions; PO-FB-049 requires confirmation. Neither requests irreversible purge, removal of audit/history, or removal of restoration. CONFIG-05 already specifies retained-history archive and restoration to Disabled, and the accepted Q-PRD-004 decision preserves immediate lifecycle/security actions and current role boundaries. These requirements can be jointly satisfied without a new destructive lifecycle.

Proposed CONFIG-05 clarification: the service-row **Delete** action uses the existing **Archived** lifecycle. Its confirmation must identify the service and explicitly state that it stops new execution, revokes references, retains configuration/history and audit attribution, and can be restored to Disabled. It must not claim permanent deletion or erased data. Cancel changes nothing. Preserve current permissions, immediate-action audit requirements, concurrent-state checks and already-dispatched work semantics. Restore and re-enable remain distinct: restoration returns to Disabled; enabling still requires review of current configuration and dependencies. A short generic “Are you sure?” alone is insufficient to convey this outcome.

This is the minimum behavior compatible with both authorities, not a new purge feature or an assumption that Delete means permanent erasure. Do not label the row action Archive instead of Delete without accounting for the confirmed feedback. No Product Owner question remains in this bounded scope. Present the retained-history consequence in the UX proposal so its appearance and wording are reviewable. A later explicit demand for irreversible purge would be a new material product change.

## REC-DEC-008 — Proposed adoption only

STATE-09 and SECRES-08 consistently resolve the already-confirmed clear-value/retain-key requirement. Adopt the following into product authority through reconciliation:

- **CONFIG-02:** distinguish key identity and optional write-only value. In-use includes applied and saved proposed references, including Disabled/Archived configurations; history/archives are not live references. Delete clears only the value when referenced and removes the key only when unreferenced. Confirm the actual outcome and current versus draft-only impact; stale target/version/dependency changes require fresh confirmation. An already-cleared referenced value is a truthful no-op. Set/Replace use explicit dialogs; cancellation leaves state unchanged.
- **CONFIG-02 / AUDIT-01:** show last successful Set/Replace/Clear actor and server time under existing identity visibility; preserve stable former-account attribution, use Unknown for absent legacy data, and retain source-qualified historical attribution after restore. No-op, failure or uncertainty must not fabricate a successful changer. No saved value or fingerprint is exposed.
- **CONFIG-03 / AUTHZ-02:** clearing is immediate under existing Owner/Administrator permission, audit admission and current-state checks. It does not silently change service lifecycle, assignments, authentication mode or apply an unrelated draft. A missing applied credential blocks new reference issuance and dispatch; a draft-only missing dependency blocks that draft's activation without interrupting valid current execution. Deliberate Set restores only otherwise eligible execution and never re-enables Disabled/Archived services or revives revoked references. Preserve in-flight response protection and durable generation/restart fences under STATE-09/SECRES-08.
- **CONFIG-03:** separate its currently conflated SMTP paragraph: service Set/Replace/Clear are immediate; SMTP creation/replacement keep draft/review/apply and SMTP deletion keeps its existing enabled-dependency block. No service-clear exception extends to SMTP.
- **CONFIG-04 / BACKUP-01 / BACKUP-05:** history/draft discard cannot restore cleared values. Completed-clear snapshots consistently preserve absence and generation/actor metadata without stale normalized value copies. Earlier encrypted archives are not retroactively erased; only existing explicit whole-instance restore can recover archived values, with restored services Disabled and fresh review. Restore is not a new credential change attributed to the recovering Owner.
- **Acceptance:** reference STATE-09 and SECRES-T17–T21 for authorization, stale confirmation, current/draft-only dependencies, cancel/no-op, late work, uncertain writes/restart, older-reader rejection, coherent backup and honest actor attribution.

These proposals require canonical reconciliation adoption and corresponding targeted PRD/coverage/journey/UX validation. Architecture and security supplied independent derivation; this result neither replaces their review nor reopens the confirmed clear-only intent.

## Evidence and ownership

Read confirmed feedback, CONFIG-02/03/04/05, accepted Q-PRD-004, current UX lifecycle confirmations, STATE-09, SECRES-08 and both bounded specialist adapters. No implementation inspection or research was needed to establish an existing explicit lifecycle. No production code, state ledger, PRD, UX, architecture or security artifact was changed by this specialist. Only this report and its YAML adapter are owned; parent orchestrator owns commits.
