# Referenced service credentials: security resolution

REC-DEC-008 is resolved for security semantics in SECRES-08. The confirmed Delete behavior remains required; no additional Product Owner choice is necessary. PRD/UX adoption is still required, so this bounded adapter reports RECONCILIATION_REQUIRED rather than a final security-stage pass.

Scope: the confirmed service credential clear/delete requirement, last successful actor metadata, temporary secret entry and their immediate dispatch, persistence and recovery boundaries. This is a definition resolution, not a full runtime security assessment; no implemented vulnerability or CVSS score is asserted. No live instance, production code or SMTP behavior changed.

## Evidence and trust boundaries

`src/consoleServices.ts:137` currently rejects referenced deletion, stores available value records and invalidates references after revision change. Its applied runtime projection holds additional secret copies; a future implementation cannot clear only the visible registry field. `src/consoleStore.ts:187` admits journal starts before durable mutation and represents completion uncertainty. `src/consoleBackupSchema.ts:20` currently requires value-bearing records and cross-checks normalized service copies. These are implementation evidence for the required boundaries, not findings that the unimplemented requested behavior already exists.

Confirmed feedback PO-FB-060/065/066/067 and Architecture STATE-09 agree on retaining identity, revoking value authority and protecting restoration. The independent security review derives authorization/revision checks, durable uncertainty fences, preserved admitted response protection, non-resurrection of values and source-qualified actor attribution. Saved draft dependencies retain keys; browser-only changes cannot reserve them. Absent applied values block execution without silently changing lifecycle/authentication. Current Owner/Administrator permissions remain unchanged. SMTP scope is explicitly excluded.

## Required downstream validation

SECRES-T17–T21 require positive/negative authorization, stale confirmation, queued/inflight work, temporary dialog handling, actor metadata, pre/post-replacement crash and restart, old-reader rejection, and coherent backup/restore evidence. These are required future acceptance cases; no executable implementation tests were run for this documentation-only change. No speculative exploit or severity rating was added.

## Adoption

PRD/UX owners should adopt SECRES-08 with STATE-09 into CONFIG-02/03, AUTHZ-02, AUDIT-01 and BACKUP-01/05. A later security stage must review the adopted product and UX artifacts; this bounded resolution does not approve undisclosed UX or implementation. No new product decisions remain in REC-DEC-008 security scope.
