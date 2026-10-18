# M29 slice 01 — Clear in-use values without losing their keys

## Goal and boundary

An authorized administrator confirms Delete using current dependency metadata. Referenced keys retain an explicitly absent value; unreferenced keys are removed. Set restores only eligible applied execution. Last successful actor/time survives restart. This single vertical slice includes required security state and UI; full entry-dialog redesign remains M30, exhaustive archives M34.

## Behavior and state

Use exact own-property keys. Bind confirmations to current revision, version/incarnation and durable applied/draft references. Reject stale and spoofed fields. Persist secret-free mutation intent before atomic missing/value/projection/generation changes. Reconcile uncertain admitted revocations before sensitive startup admission without overwriting newer replacements. Old readers must reject new state format. Remove normalized copies; preserve lifecycle, drafts and assignments. Invalidate reviews/references and retain admitted response protection. Attribution derives from authenticated identity and server time; legacy and uncertain metadata is honest.

## Authorization and errors

Owner/Administrator only under existing sensitive admission; Auditor metadata read-only, Member no restricted metadata. Cancel, audit rejection and no-op do not mutate attribution. Unknown writes require durable reconciliation. SMTP unchanged.

## Surfaces and investigation

ConsoleServices/Store/Journal, migration value creation, backup schemas and restoration format recognition, service UI, existing gateway admission integration, focused tests and isolated browser harness. Investigate dispatch fences before modifying transport; preserve live broker/scanner/limiter.

## Validation and acceptance

Positive/negative referenced (applied/draft/disabled/archived) versus unreferenced deletion; stale target/version/dependencies; canonical value and spoof rejection; authority; missing applied versus draft-only; set and disabled/recovered behavior; queued/dispatched races; pre/post persistence and audit faults/restart; later replacement replay; old-reader rejection; imported and renamed/removed/legacy actor; no secret in reads/audit; snapshot consistency. Actual HTTPS clear confirmation, cancel/keyboard/focus, narrow/200%-text and visual reference comparison. Final full suite with two workers and build. Record criterion map, commands and tested-input hashes. One commit only after all required checks pass; root records exact resulting SHA.

## Investigation resolution

The existing broker already rechecks managed admission after request-body waits and retains captured response protection. No gateway transport replacement was necessary. Missing applied dependencies remove the executable normalized projection; draft-only keys do not invalidate unrelated applied references. A format-5 checkpoint precedes the first new credential intent. Identifier-derived journal identity plus monotonic state generation binds replay without writing a value fingerprint. Existing-key Set/Replace/Clear/Delete requires current confirmation; first creation remains compatible and rejects concurrent existence.

Successful actor/time/action is persisted directly, independent of later journal retention. An ephemeral mutation-specific uncertainty set selects bounded prior metadata only for that unresolved action. Restart uses durable unresolved intents, removes unknown credential authority once, preserves prior attribution correctly at either replacement boundary, and cannot overwrite a newer generation. Supplied import values have mutation-bound attribution too: unresolved committed imports retain their new draft value but show Unknown, without activating it. Restore marks retained attribution historical.

Required validation is recorded in the milestone29 acceptance artifact. Early loopback/spawn EPERM was rerun with local permission. An intermediate full-suite run was invalidated by concurrent final review edits (new assertions observed its cached prior module); it is not acceptance evidence. Final inputs are frozen and hashed before the closing suite. No assertions or timeouts were weakened.

## Completed validation

Final `npm test -- --maxWorkers=2`: PASS 748/748 tests, 74/74 files, 106.96s. TypeScript build and final synthetic HTTPS browser PASS. Exact tested-input hashes verified unchanged after completion. `git diff --check` PASS. One slice commit includes implementation, tests, operator/AGENTS guidance, plans and sanitized QA/visual evidence; parent orchestrator records its final SHA without a self-referential commit.
