# M50 reviewed credential removal — companion plan

Starting HEAD e8cbbb038b150ac75ee2c102339b307de1816ca4. One authorized M50 transaction under parent M49–51 goal. Governing contract: milestone50, published UX10 and STATE-11/SECRES-10/D10-01/02/04/05. Completed M49 task shell preserved. Tracked tree initially clean; unrelated passwd, codex-session and test-results paths remain unread/untouched. Own affected service/store/credential/recovery/history schema modules, focused tests/harness, this plan and milestone50 evidence only. Parent owns status. No permanent service deletion or deployment.

## Slice 1 — Reviewed atomic cleanup with durable dependency fences

Observable through current service APIs: removal from applied or saved-only proposal creates durable scoped intent; review names exactly eligible keys; Apply publishes candidate and deletes eligible current values together. Save/discard/re-add do not collect values; unrelated orphan values remain. Bind actor/session/config/proposal/value incarnations and reject changed review dependencies. Preserve current immediate credential operations and SMTP. Extend current format/owned backup and restore validation only where required, with old-reader rejection before new mutation semantics and monotonic dependency identity across reuse/restore. Unknown commit results fence execution until coherent durable inspection; no standalone deletion replay.

Surfaces: consoleServices, consoleStore, consoleCredentialState, consoleHistory and owned backup/restore schemas plus existing service/value/recovery tests. Focused positives/negatives include saved-draft-only, remaining references, orphan retention, cancel/discard/re-add, stale replacement, role/schema, audit/write faults/restart, reader fence and restore. Commit coherent API/state behavior and focused evidence. Do not ship an API cleanup half-path that lacks corresponding recovery safety.

## Slice 2 — Confirm removal and inspect exact effects in the existing review

Observable: named Remove credential button opens shared modal; confirm changes proposal only, cancel preserves it; plain where/how-sent copy. Actual grouped New settings review displays exact saved-value deletion effects, retains existing acknowledgments and final approval. Guided/Advanced parity uses slice1 intent derivation. Return focus correctly; preserve write-only immediate value controls and SMTP exception.

Surfaces: consoleServicePage and review presentation; extend existing HTTPS service browser harness rather than duplicate fixtures. Capture/inspect1440/390/320+200% text proposal/modal/review/apply/cancel and stale/unknown states. Exercise full saved-draft-only removal through Apply and preservation checks. Run focused affected UI/API tests and build, isolated synthetic Docker HTTPS browser plus changed backup/restore qualification; no live stores or request/header logs. Commit slice behavior with acceptance and source revisions.

## Validation and completion

Every new external input has valid/invalid, role and stale checks. Reuse unchanged evidence; meaningful faults require targeted repairs, not weakened assertions. First unexpected out-of-area regression widens checks; second distinct regression escalates full suite. Final frozen full bounded-worker suite is outer-owned UX10-INTEGRATED after M51; targeted M50 acceptance does not claim release qualification. Maintain existing required actual recovery/Docker gates when changing recovery. Plan amendments record concrete findings before scope adjustment; per-slice commits use narrow Git paths.

## Progress

Plan persisted before production edits. Slice1 pending; slice2 pending.

Slice1 complete: API/state/compatibility focused checks PASS; evidence slice1-acceptance.md. Format8 is the bounded mechanism chosen for durable service/key identity, with current history scopes and fresh restore incarnation. Existing generic commit also preserves a newer format and initializes owned new records atomically, preventing old import/retirement writers from downgrading state. Degraded audit cleanup startup retains diagnostic availability and blocks sensitive work until healthy restart. Slice2/browser/recovery qualification remains; no permanent service deletion added.
