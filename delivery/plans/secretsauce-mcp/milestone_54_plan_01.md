# M54: Editable public service reference

## Outcome and context

One M54 companion transaction in fixed goal53–54. Start f01efc7; source428bae3/077b71b; planning8d853fb/392684a. Parent owns status, global goal and UX12-INTEGRATED. Governing contract54-editable-public-service-reference.md, CONFIG-06, STATE-12, SECRES-11, UX-G13/IN28/C96–97 and AGENTS.md. No deployment.

## Findings and implementation decisions

Managed dictionary keys currently double as public runtime keys. Keep dictionary keys as stable internal identities and add explicit public reference on managed records/proposals. Runtime configuration remains keyed by public reference; all managed actions resolve their stable identity and publish only the current public projection. Token broker already generation-fences public scopes: revoke both affected names on publication/reuse, translate internal subject/lifecycle actions to current public key. Existing archive/delete/history and credential projections must use this relationship explicitly. New one-way format10 prevents old readers interpreting separated ownership. No alias or new authentication.

## Scope and ownership

Own affected service/reference helper, store/schema/recovery/history/migration/runtime bindings, UI, focused tests/browser harness and evidence under milestone54. Preserve M53 proof/ABA/late-edit safeguards, exact keys, independent grants/values, monotonic formats and original three untracked files (unread). No milestone/status or definition edits. Stage owned paths per slice only.

## Slice index

| Slice | Outcome | Dependencies | Status | Commit |
|---|---|---|---|---|
| 01 | Authorized reviewed reference publication through API/runtime with complete compatibility, import/history/recovery and revocation | M53 | accepted | f22ae49 |
| 02 | Accessible guided/Advanced change task and actual joined browser qualification | 01 | accepted | slice02 (this commit) |

### Slice01 contract

Explicit current/proposed references and namespace claims, current Active acknowledgment bound to session/target/revision, strict new-key validation/legacy preservation, atomic Apply with Inactive ref-only preservation and old/new revocation. Preserve stable values/grants/routes/history/deletion; independent export/import and recovery relationship. Required tests: positive/negative input, collisions/reuse, current role/CSRF, queued/in-flight references, audit uncertainty/restart, actual prior reader, owned backup/restore/all writers. Extend existing coverage; no blanket code refactor. Publish only when core operation and compatibility independently usable.

### Slice02 contract

Details purpose/origin/copy, direct Inactive input and locked Active warning/unlock; same complete draft and Advanced parity; exact reviewed changes/client impact. Actual synthetic HTTPS browser at1440/390/320200 with focused/current/missing/conflict/read-only and safe review states. Inspect against approved appearance; preserve keyboard, text range and footer. Publish source/harness/evidence/plan after targeted acceptance.

## Validation and recovery

Focused tests/build per changed contract. No full suite during iteration. Parent runs frozen full suite after stable M54, then builds one exact secretsauce-local-review:m54 image for mandatory affected recovery/launcher drills; final-source browser evidence reusable. No concurrent browser/Docker during full suite. First unexpected out-of-area regression expands focused scope, second distinct regression triggers prescribed full suite after repairs. Audit uncertainty fences publication until durable inspection; no standalone rename replay. Format10 readers reject downgrade; code rollback requires compatible reader or explicit authorized older snapshot recovery, never manual format editing. No raw credentials/proofs/headers in logs or evidence.

## Execution notes

Plan saved before production edits. No new owner questions; detailed mechanisms remain within settled contract. Both slices implemented; targeted acceptance below.

### Slice01 validation

Build passed. Focused reference12, runtime18, history6, backup-domain4, restore-provenance3 passed; HTTP8 passed after correcting its new assertion to the existing message envelope. One additional actual renamed-format recovery test passed (other21 cases not rerun). Runtime positive/negative evidence includes actual downstream in-flight protection, old/queued key and token rejection, retained limiter occupancy, namespace collision/own keys, four old/new uncertain Apply boundaries, actual pinned format9 reader rejection and owned portable validation. Existing history/runtime/backup helpers now send current proposal generations introduced by M53; no assertions weakened. Parent's clean-host Docker branch M54_REFERENCE_RECOVERY=1 is prepared and syntax-checked, not yet executed.

Legacy scoped evidence uses positive retained incarnation history to establish a pre-upgrade attribution window; records without a provable boundary remain globally visible with their original labels but are omitted from service scope. Restored historical rows retain source metadata and use explicit source-instance/incarnation links, including same-host journal deduplication. No current-name lookup reattributes historical public keys. Final frozen full suite and actual-image recovery remain parent-owned.

### Slice02 acceptance

Actual sanitized Playwright HTTPS scenario PASS on final source hashes in milestone54/browser-report.json. Guided/Advanced share server confirmation; new creation consumes returned stable ID; current/proposed copy and old/new grouped review are exact. Inactive reference-only (excluding mixed instance settings) remains inactive. Member evidence equality authorizes only current assigned identity/public labels with separate actor/context fences. Readonly and true conflicts preserve prior behavior. Focused review/navigation11, evidence/Member9 and mixed-change lifecycle1 tests PASS; scoped discard/history/archive/reuse regression also included. Browser screenshots inspected by implementer and parent at desktop390/320200; enlarged warning action and focused reference field remain reachable.

Initial whole-repository Docker mount was rejected by automatic approval review because unrelated untracked files could be exposed. The accepted safer run used a sanitized tracked-source export with only owned overlays, read-only dependencies and scoped writable evidence. Original files were not read/mounted. Runtime source hashes match workspace exactly. No final full suite, image build or deployment performed by this companion; parent owns UX12-INTEGRATED.

### Corrective slice03 — frozen regression fixture boundary

Outer frozen full suite found one obsolete post-restore format9 assertion (836 tests passed). The archived managed service now carries an explicit public-reference relationship; recovery correctly installs format10. Update only the fixture name/post-restore boundary and assert its baseline public reference. Preserve pre-delete format9 plus every fresh incarnation, Disabled, credential, session and deletion-marker assertion. This is test-only; final-source browser hashes remain unchanged. Focused credential-recovery file is the validation gate; outer reruns the stable full suite.

Slice03 PASS: `npx vitest run --maxWorkers=2 test/console-credential-recovery.test.ts`, all6 tests passed (10.49s). No production or browser-source changes. Outer stable full-suite rerun remains required.

### Corrective slice04 — legacy Docker seed assertion

The exact-image renamed recovery drill reached reviewed publication, then its fixture incorrectly expected absent legacy service/key incarnations to remain absent. The first reference save intentionally initializes these through the format8→10 upgrade. The mounted harness now requires existing UUIDs unchanged or absent legacy UUIDs validly initialized, while comparing every other credential field and all assignments unchanged. Fixed non-secret assertion labels improve failure diagnostics without logging actual state. Script syntax and diff checks PASS. No application-source change; parent reruns the same e8c1ade application image with this separately recorded harness revision. Actual drill result remains outer-owned.
