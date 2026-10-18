# M29 acceptance evidence

Scope: STATE-09, SECRES-08, REC-RM-020/021. One vertical slice includes clear/set/delete semantics, format fence, durable intent reconciliation, projection coherence and attribution. No SMTP behavior or downstream transport changed. Current executable projection is removed when an applied required value is missing; lifecycle/configuration/assignments remain unchanged. The explicit missing marker has no executable empty-secret projection.

| Criterion | Evidence |
| --- | --- |
| Applied/saved/Disabled/Archived dependencies and no-op/unreferenced deletion | console-credential-clearing.test.ts, positive and negative dependency cases |
| Current confirmation, stale dependency/incarnation/revision, cancel and admission failure | confirmation rejects missing/stale; direct role/spoof and audit failure tests; actual browser Escape |
| Applied vs draft-only execution; Set preserves lifecycle | clearing tests and real browser clear→value submission; Disabled/Archived Set tests |
| Old reference/queued/dispatched safety and retained resources | console-service-runtime.test.ts held HTTP body Clear and admitted downstream Clear; existing rotation/protection/pool tests |
| Pre/post replacement failure, restart, idempotency, later replacement and old-reader fence | clearing fault matrix, replay and immutable v4 reader subprocess fixture (constructor reached) |
| Permissions and unchanged SMTP | domain role matrix and existing service HTTP boundary suite; full SMTP suite |
| Last successful stable actor/server time, imported supplied values | mutation and migration storage derive actor/server time; rename/removal/restart/legacy tests |
| No-op/rejected/uncertain attribution and spoof rejection | clearing tests; mutation-specific uncertainty and previous-success metadata; unrelated degraded state regression |
| No values/fingerprints exposed in reads/history/audit | explicit sanitized detail assertions, existing write-only runtime/history tests, secret-free identifier-bound intents |
| Current snapshot consistency | portable missing-state validation positive and contradictory normalized projection negative; existing archive domain suite |
| Browser and visual appearance | actual HTTPS browser report and matching clear-dialog viewport/narrow/200% screenshots in UX evidence |
| Independent checkpoint | browser clears an applied key and explicitly supplies a replacement before M30 exists |

## Validation record

Focused clearing/runtime tests passed with loopback permission (sandbox EPERM was environmental and assertions were retained). Backup-domain tests passed after rebuilding the compiled bounded worker for the new schema. Actual HTTPS Chromium browser passed, including cancel/focus, narrow and 200% text, Clear→Set, read-only Auditor and empty browser persistent storage. Final full-suite results and exact tested hashes are recorded at closeout.

The old-reader fixture is immutable source from parent 95b1415 with SHA-256 recorded beside it. Tests do not require Git ancestry. No live deployment or volumes were used. M34 retains exhaustive archive/recovery qualification; actual external ChatGPT/Codex validation remains the existing recorded exception.

Final focused regressions: 49 tests across clearing/runtime/migration passed after action attribution and draft-only invalidation changes; 33 tests across clearing/migration passed after the bounded uncertain-import handling. Browser passed again on that final build. `test/console-migration.test.ts` proves successful imported supplied values credit the submitting actor and unresolved completion shows Unknown both live and after restart; it retains the committed draft value without activation. Metadata includes the actual last successful Set/Replace/Clear action, while durable audit distinguishes Clear from key Delete.

## Final result

PASS — `npm test -- --maxWorkers=2`: **748 tests, 74 files**, 106.96 seconds. The pretest TypeScript build passed; the explicit final browser build also passed. No browser or Docker workload ran concurrently. Every entry in `tested-inputs.json` matched after completion (zero mismatches). `git diff --check` passed. Final HTTPS browser report is PASS with the current code. No required M29 criterion is deferred to a later milestone.
