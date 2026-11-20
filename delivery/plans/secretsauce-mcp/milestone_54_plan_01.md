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
| 01 | Authorized reviewed reference publication through API/runtime with complete compatibility, import/history/recovery and revocation | M53 | accepted | pending commit |
| 02 | Accessible guided/Advanced change task and actual joined browser qualification | 01 | pending | |

### Slice01 contract

Explicit current/proposed references and namespace claims, current Active acknowledgment bound to session/target/revision, strict new-key validation/legacy preservation, atomic Apply with Inactive ref-only preservation and old/new revocation. Preserve stable values/grants/routes/history/deletion; independent export/import and recovery relationship. Required tests: positive/negative input, collisions/reuse, current role/CSRF, queued/in-flight references, audit uncertainty/restart, actual prior reader, owned backup/restore/all writers. Extend existing coverage; no blanket code refactor. Publish only when core operation and compatibility independently usable.

### Slice02 contract

Details purpose/origin/copy, direct Inactive input and locked Active warning/unlock; same complete draft and Advanced parity; exact reviewed changes/client impact. Actual synthetic HTTPS browser at1440/390/320200 with focused/current/missing/conflict/read-only and safe review states. Inspect against approved appearance; preserve keyboard, text range and footer. Publish source/harness/evidence/plan after targeted acceptance.

## Validation and recovery

Focused tests/build per changed contract. No full suite during iteration. Parent runs frozen full suite after stable M54, then builds one exact secretsauce-local-review:m54 image for mandatory affected recovery/launcher drills; final-source browser evidence reusable. No concurrent browser/Docker during full suite. First unexpected out-of-area regression expands focused scope, second distinct regression triggers prescribed full suite after repairs. Audit uncertainty fences publication until durable inspection; no standalone rename replay. Format10 readers reject downgrade; code rollback requires compatible reader or explicit authorized older snapshot recovery, never manual format editing. No raw credentials/proofs/headers in logs or evidence.

## Execution notes

Plan saved before production edits. No new owner questions; detailed mechanisms remain within settled contract. Implementation pending.

### Slice01 validation

Build passed. Focused reference12, runtime18, history6, backup-domain4, restore-provenance3 passed; HTTP8 passed after correcting its new assertion to the existing message envelope. One additional actual renamed-format recovery test passed (other21 cases not rerun). Runtime positive/negative evidence includes actual downstream in-flight protection, old/queued key and token rejection, retained limiter occupancy, namespace collision/own keys, four old/new uncertain Apply boundaries, actual pinned format9 reader rejection and owned portable validation. Existing history/runtime/backup helpers now send current proposal generations introduced by M53; no assertions weakened. Parent's clean-host Docker branch M54_REFERENCE_RECOVERY=1 is prepared and syntax-checked, not yet executed.

Legacy scoped evidence uses positive retained incarnation history to establish a pre-upgrade attribution window; records without a provable boundary remain globally visible with their original labels but are omitted from service scope. Restored historical rows retain source metadata and use explicit source-instance/incarnation links, including same-host journal deduplication. No current-name lookup reattributes historical public keys. Final frozen full suite and actual-image recovery remain parent-owned.
