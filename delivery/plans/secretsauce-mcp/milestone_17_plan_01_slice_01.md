# M17 slice 01: Authorized restore preview

## Goal, entry and end-to-end behavior

Owner Settings → Backups → Restore, or clean-host restricted restore entry, accepts a
bounded ciphertext file and independent material. Newly host-issued proof selects restore
rather than setup and binds the clean installation; in-place Owner recent password/TOTP
uses restore action. Worker validates version, digests, domain dependencies and schema.
Preview shows source/recovery point, counts, initiator separately from archived nominees,
replacement/access consequences and deployment/capacity readiness. Nothing is replaced.

Single encrypted staging candidate and bounded review lifecycle hold shared restore job
lease; cancellation/expiry before installation clears staging/authority and releases slot.
Host proof TTL30m, ten attempts; upload bounded192MiB/30s and finite count/depth from
M16 verifier, staging file exclusive/no-follow0600. Preview expiry5m. Material never
stored. Strict fields and candidate hash guard stale/cross-instance/archive/replay.
Capacity includes staged encrypted state, prior local rollback and pre-restore archive,
with recheck at start. All archive paths are semantic JSON, no extraction.

Production surfaces: new consoleRestore provider/page and bounded HTTP entry, ConsoleStore
restore metadata/proof schema, host CLI, Backup projection exclusions. No install or
ordinary auth activation in this slice; explicit start unavailable until slice02.
Tests: valid Owner and cleanhost previews; initiator absent archive; no recoverable Owner;
wrong/missing key/proof/recent auth; expired/replayed/cross-archive/concurrent proofs;
corrupt/version/schema/unsafe path/link attempts; byte/time/count/depth limits; space,
staging symlink and cleanup; audit unavailable; preview never mutates live config/users.
Focused: npm run build then npx vitest run test/console-restore-preview.test.ts plus
backup/provider/http related tests. Actual HTTPS preview desktop320/keyboard evidence.
Acceptance: valid authority yields exact non-secret review; invalid input leaves live
installation intact and releases resources. Commit all slice01 owned code/tests/docs/plans.

## Exclusions and boundaries

Only whole-instance local recovery, no remote data rollback/selective merge/HA/new auth protocols.
No changes to authoritative Product Definition or prior evidence. Parent transaction and
unrelated work are recorded in governing plan. This slice owns only its listed surfaces.

## Investigation and delivered boundaries

Node listener is HTTP behind the configured HTTPS proxy; no invented native TLS key fields.
Clean-host actual proof is checked from a dedicated bounded header BEFORE large body read;
body proof duplicates reject. Decoded192MiB archive /192MiB+64KiB fixed JSON wire bound.
One fixed exclusive ciphertext staging reservation blocks restart reuse, including unknown
or changed files; verified owned cleanup only, observable host repair on cleanup uncertainty.
Existing archived schemas verify semantic paths, dependency/Owner and bound depth/count;
there is no archive extraction. Settings preview and clean-host UI are reachable now.

Validation: focused recovery/backup tests (15 across4files initially, final staging fault regression and recovery HTTP rerun11/2 pass); npm run build; actualHTTPS headless
preview4groups with keyboard320px and masked screenshots in
[evidence](../../../evidence/qa/secretsauce-mcp/milestone17/preview/browser-report.json).
Full suite intentionally reserved for milestone completion. No install claimed.
