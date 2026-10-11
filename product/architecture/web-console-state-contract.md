# Web console state and recovery contract

## Scope

Bounded architecture resolution `RES-PRD-ARCH-01` for PRD findings `F-PRD-002`, `F-PRD-003`, and `F-PRD-004`. This contract derives observable state behavior from the [web console PRD](../../docs/web-console-prd.md) and accepted decisions D-001 through D-012. It does not prescribe a database, API schema, cryptographic mechanism, or implementation plan. The separate security contract owns recovery proof and audit-outage access exceptions.

The bounded `REC-DEC-003` amendment below derives SMTP credential deletion semantics from confirmed feedback `PO-FB-013` and finding `REC-006`. It preserves Owner-only SMTP management and existing optional email/manual delivery behavior. It is ready for cross-artifact adoption; it is not the final architecture-stage review.

## Executive Summary

Keep one active application instance and one coherent active configuration. Separate configuration review from immediate access/lifecycle actions so draft application and history cannot undo revocation. Whole-instance restore is an explicit maintenance transition with recoverable installation, preserved audit evidence, and restricted recovery before services resume.

## What Is Good

- The PRD already separates administrative roles from service execution, requires atomic activation, and defines explicit revocation. These are sufficient foundations for predictable administration without approval chains.
- Single-process ownership matches current runtime-local configuration and references (`src/runtime.ts:24`, `src/tokens.ts:96`). It avoids introducing distributed coordination merely to support 50 users and 100 services.
- The gateway already evaluates service access, destinations, and policy before credential substitution (`src/gateway.ts:69`). Preserve that ordering when configuration becomes mutable.
- BACKUP-05 already invalidates live access and requires review after restore. This prevents a historic archive from silently restoring access that an administrator revoked later.

## What Is Bad Or Risky

The broad draft language in CONFIG-03 can otherwise be interpreted as delaying disable/revoke actions or replaying old permissions through history (`F-PRD-004`). BACKUP-04's rollback promise requires an installation recovery source distinct from a sanitized export backup, because normal backups deliberately exclude live enrollment/authentication state (`F-PRD-002`). Neither issue requires new product scope; the contracts below make the established intent testable.

## What Should Change

### STATE-01 — Configuration versus immediate actions

Configuration drafts contain service details, destinations, credential placement metadata, policy/scanner settings, and editable instance settings. Saved drafts have no runtime effect. Apply operates only on the explicitly reviewed changes; saving a service draft never imports unrelated Owner settings into its activation.

Account creation/invitation, role changes, account disabling/recovery, service access grants/removals, session/client-grant revocation, credential value creation/replacement/deletion, and service disable/archive actions are explicit, separately confirmed actions. They take effect when the action succeeds, without requiring a later configuration apply. They remain subject to current authorization, dependency checks, durable audit, and any required recent authentication. A credential's placement settings remain configuration; changing its secret value is an explicit write-only operation.

Initial service setup can collect proposed access assignments alongside its draft. The final review lists those as explicit new grants and applies them atomically with successful first activation after checking current identity eligibility. They are not reusable historic grant snapshots. A changed assignment, identity, or eligibility since review requires a fresh review; an old wizard cannot recreate removed access.

Disable/archive immediately block new service execution and revoke affected references. Unarchiving returns the service to Disabled. Activation/re-enabling requires an explicit review of the current service configuration and dependencies; configuration history alone cannot enable a disabled service. An active service with an unapplied edit stays on its previous active configuration.

### STATE-02 — Apply, concurrency, and authorization

At apply time, recheck the actor's current role and permission for every changed setting, the active base revision, and affected identity, service-lifecycle, assignment, and credential dependencies. If any relevant value changed, reject the stale operation without partial application and show a sanitized comparison/reload path. Demoting the author of a draft cannot leave that draft with the author's previous permissions.

Validate and prepare the candidate completely before activation. Successful activation makes one coherent configuration revision effective; a request must never combine a new destination with an old policy or credential-placement rule. Failure leaves the previous active configuration intact. Preserve unaffected live reference state; invalidate affected references whenever a binding or credential is no longer valid.

Configuration changes, immediate access actions, and request admission have an unambiguous observable order. Immediately before credential substitution and downstream dispatch, use current account/grant eligibility, current service lifecycle, valid references, and a coherent active policy/destination configuration. Authorization and audit readiness must still be valid at this boundary. Requests still waiting for admission cannot rely on an earlier successful check.

Already-dispatched downstream work may finish under its admitted configuration and response-protection context, including protection for credentials used by that request. Do not claim that revocation or an apply rolls back remote side effects. Its audit event identifies the admitted revision. A reference revoked during that work must not become usable again because the response completed. No new downstream dispatch can begin under superseded authority after the relevant revocation has succeeded.

### STATE-03 — History cannot restore access or secrets

Configuration history is sanitized configuration history, not a snapshot of live users, assignments, lifecycle state, sessions, grants, or credential values. Historic configuration creates a fresh draft scoped to the actor's current permissions. It may refer to currently available credential identities; it cannot recover deleted/replaced values. Missing dependencies are explicit validation failures.

History can intentionally propose an older policy or destination, with the usual impact review and exception acknowledgements. It cannot silently restore a removed assignment, re-enable a disabled service, revive an identity, or undo a session/grant/reference revocation. A deliberate new grant or enable action must use the corresponding current-authorized action.

#### STATE-01/02/03 amendment — Independent SMTP credential deletion

SMTP credential deletion is an explicit immediate write-only value operation. This bounded amendment preserves the existing SMTP credential creation/replacement draft/review/apply workflow; it does not require separate immediate create or replace controls. SMTP configuration (including host, port, sender, username and enabled state) continues to follow draft/review/apply. Disabling SMTP stops new delivery admission but retains its saved configuration and encrypted credential until an explicit credential deletion succeeds. A disabled setting is not a request to delete the value. Pending creation/replacement values remain encrypted and write-only, bound to the current SMTP base revision and credential version. Reviews expose only availability/version. Existing pending secret copies must not survive a successful deletion or reappear through an old browser submission.

Expose **Delete SMTP credential** separately from Save, Review and Apply. A current Owner with recent authentication confirms deletion of the currently displayed credential version. Administrator reset authority does not grant SMTP-management authority. Before mutation, recheck current authorization, recent authentication, durable audit readiness, the SMTP configuration revision, the credential version, and active dependencies. A stale confirmation, concurrent replacement or changed dependency rejects the action without deleting a newer value. Missing credentials produce an explicit already-absent result; they do not delete unrelated configuration or report a new deletion.

Reject deletion while enabled SMTP depends on that credential, naming the dependency and the path to disable SMTP in Settings. The Owner disables SMTP through its ordinary configuration review/apply, then confirms the separate deletion. Deletion does not silently disable delivery, clear the username, change the authentication mode, or fall back to anonymous SMTP. The existing ability to configure SMTP without authentication remains available only through an explicit valid configuration that does not depend on a stored credential.

A successful deletion atomically removes the live encrypted value and any pending secret copies, advances the credential version and SMTP state revision, and invalidates outstanding SMTP reviews. Preserve non-secret settings and draft edits for reload/review against the new revision; an old draft cannot apply until refreshed and its current dependencies validated. Blank or omitted password input cannot restore a deleted value from an old draft, history or read response. A later deliberate creation/replacement requires fresh value entry into a current draft and ordinary review/apply with current authorization, base revision and credential-version checks. Refreshing an old draft must not silently rebase its pending secret across a deletion or replacement. History rollback and configuration apply cannot recreate the deleted value without that new explicit entry. Existing encrypted backup retention and explicit whole-instance restore remain governed by STATE-04/05/06; deletion is not retroactive destruction of previously exported archives.

Order delivery admission with disable/delete/replacement. Work awaiting dispatch must recheck the current enabled configuration and credential dependency immediately before SMTP dispatch; it cannot retain an earlier authority to use the deleted version. Already-dispatched mail may finish within its existing timeout using its admitted revision and captured credential, with a sanitized delivery outcome attributed to that revision/version. Deletion cannot recall already-sent mail. Completion must not rewrite SMTP settings or resurrect the value. Manual invitation/recovery delivery remains available under its existing authorization; disabling email or a failed delivery must not grant account access or prevent gateway execution.

Record a durable, secret-free deletion admission and outcome identifying actor, target, affected revision/version and dependency result. Audit admission failure prevents mutation. A persistence or completion uncertainty is not success: fence new use of the affected credential until durable state is established, preserve the operation as uncertain, and never restore it from a stale draft merely to recover availability. Atomic durable state must recover either the prior coherent state or the completed deletion; a completed deletion remains deleted after restart. No new approval chain, delivery queue, or recovery interface is required.

### STATE-04 — Backup consistency

A completed backup represents one internally consistent recovery point across included configuration, credential versions, identities, assignments, settings, history, and an identified audit boundary. A concurrent rotation or apply must appear wholly before or wholly after that point; a manifest cannot refer to missing credential material or a partially applied revision. Backup status and manifest identify the recovery-point time, completion time, software/format compatibility, and included audit extent.

The operation may use a brief bounded write pause or an equivalent consistent snapshot mechanism; no continuous availability promise is introduced. Reads and execution need not stop for the entire archive-writing operation. Only one backup/restore job runs at once. Publish an archive as successful only after its contents and integrity metadata are complete; incomplete output cannot replace the last valid backup. Excluded ephemeral and authentication material remains excluded even if a storage mechanism normally copies it.

### STATE-05 — Restore installation and rollback

Validate the archive, recovery inputs, compatibility, audit provenance, capacity for staging/rollback, and nominated recovery Owner before replacement. A recoverable archive must contain a valid Owner identity. Clean-host restore uses restricted host-authorized setup; in-place restore uses current Owner authorization. The security contract defines the exact proof and continuation.

Enter maintenance before replacement: stop new downstream admissions and state-changing administration, then drain already-dispatched work within its existing finite deadlines. Do not extend timeouts indefinitely or claim cancellation reverses remote work. Record uncertain remote outcomes when appropriate. A failure to reach a consistent installation boundary aborts replacement and remains diagnosable.

For a functioning in-place instance, create and validate the required encrypted pre-restore backup and retain a protected local installation rollback source before replacement. These serve different purposes: the export backup follows BACKUP-01 exclusions; installation rollback preserves the prior live store so a failed installation does not require restoring excluded MFA state from an export. The local source is restricted to this installation, is neither downloadable nor a second backup product, and is removed after successful durable installation or completed rollback.

Installation is all-or-nothing across product state and key dependencies. If it fails, restore the prior coherent local state, retain failure/audit evidence, and require fresh login before resuming ordinary administration; do not revive sessions/references invalidated for the restore. If automatic rollback cannot complete, remain in maintenance with a recoverable prior store and an explicit host recovery path. A clean-host failure remains uninitialized/restricted and can be retried; it must not expose partially restored accounts or services.

A crash at any installation step must select either the prior coherent installation or the completely installed recovery state at restart. A completed installation's subsequent enrollment difficulty is handled through recovery, not automatic reactivation of the prior instance.

### STATE-06 — Recovery activation and audit continuity

After installation, fresh password/MFA enrollment establishes the nominated recovery Owner through the security-defined restricted continuation. This continuation is not a preserved browser session or general management authority. Before enrollment and audit readiness, expose only the authorized recovery steps and diagnostics.

After the recovery Owner is enrolled and durable audit is verified, Owner administration can resume while every restored service stays Disabled. Other users remain pending Owner review and fresh enrollment; saved assignments alone confer no access. Re-enabling each reviewed service is explicit. External OAuth and legacy bearer modes require explicit reactivation; old sessions, grants, bearer credentials, recovery links, and references remain invalid. The service can resume only with current eligible identities, current authorization mode, reviewed credentials/policy, and healthy audit recording.

For in-place restore, preserve the local audit sequence through maintenance, replacement, enrollment, and resume independently of the restored product snapshot. Imported archive evidence retains original provenance and is distinguishable from locally retained events; do not truncate newer local evidence to the archive time, rewrite old events, or represent overlapping copies as fresh activity. Retention remains a separately audited operation.

For clean-host restore, retain available archive evidence with original provenance and record a new restore event identifying the archive recovery point. Identify the interval after the last archived evidence and before the new installation's first event as unavailable; never fabricate continuity. Audit outage during installation/recovery prevents normal activation; the security contract governs the narrow repair interface.

### Acceptance scenarios

| Contract | Positive evidence | Negative evidence |
| --- | --- | --- |
| STATE-01/03 | Disable takes effect immediately; policy rollback produces reviewed draft; explicit new grants can succeed | Old drafts/history cannot restore revoked users, assignments, sessions, references, credential values, or disabled lifecycle |
| STATE-02 | Requests observe one admitted configuration; valid current-authorized apply succeeds | Role demotion, concurrent assignment removal, rotation, policy update, or disable defeats stale apply/admission; no mixed destination/policy execution |
| STATE-02 | Already-dispatched request completes with original credential response protection and attributable revision | Completion cannot revive revoked references; queued request cannot dispatch on old access |
| STATE-01/02/03 SMTP | Owner disables delivery, then separately confirms deletion; settings remain and the value is absent after restart; deliberate replacement and explicit unauthenticated SMTP remain possible | Enabled dependency, demoted Owner, expired recent authentication, stale confirmation, concurrent replacement and audit admission failure reject deletion; disable alone does not delete the secret |
| STATE-01/02/03 SMTP | Refreshed draft uses current credential availability; already-dispatched mail records its admitted revision and bounded outcome | Pending draft, stale browser value, history rollback, queued send or late completion cannot revive/use the deleted version; persistence uncertainty cannot report success or resume affected credential use |
| STATE-04 | Backup during rotation/apply is recoverable at its declared consistent point | Partial archive, missing dependency, capacity failure, or overlapping job is not reported successful |
| STATE-05 | Clean-host installation and in-place failure rollback reach their specified coherent states | Crash at each replacement boundary never activates partial state; failure cannot discard prior audit tail or require excluded backup MFA to undo installation |
| STATE-06 | Recovery Owner enrolls; reviewed user and service explicitly reactivate; audit provenance remains inspectable | Old MFA/session/grant/bearer/link/reference cannot authenticate; restored assignments do not activate pending users; audit outage blocks resume |

## What I Would Not Change Yet

Do not add multiple active gateways, cross-node invalidation, distributed transactions, selective backup merge, approval chains, or custom roles. One durable state owner with clear failure boundaries satisfies the accepted deployment and avoids unsupported consistency promises. Persistence and snapshot mechanisms remain architecture implementation choices.

## Overall Opinion

The bounded state semantics are resolved without changing settled product intent. Adopt these clarifications into CONFIG-03/04, AUTHZ-02, and BACKUP-02/04/05/06 through the PRD owner. The later architecture stage still reviews the complete refined definition, journeys, UX, and security contracts; this resolution is not that full-stage pass.
