# M16 slice 01: Portable recovery archive and manual job provider

## Goal and observable outcome
Create complete encrypted portable recovery state, start a bounded manual job, download after recent authentication, and decrypt/verify on a host without app keys.

## Scope and non-scope
Archive crypto/schema/projection; setup public key; single-job persisted state; manual start/read/download; reachable Settings manual backup UI; HTTP tests.

Schedule/retention/material replacement and richer scheduling UI are later slices; installation is M17.

## Dependencies and ordering
M10–15 accepted. Governing plan milestone_16_plan_01.md; exactly M16.

## Entry point and end-to-end behavior
Owner Settings or bounded provider API validates input/current authority and durable audit, captures coherent state, performs bounded work, persists outcome and reports safe progress/error. Scheduled work uses durable system admission and cannot bypass audit. M17 consumes verifier and coordinator without installation implemented here.

## State transitions
Settings draft → reviewed → applied; job queued/running → completed/failed/unknown; restart resolves incomplete state truthfully. Only fully verified ciphertext is published. Current committed settings remain during draft errors. Retained archive material versions remain explicit.

## Authorization
Current active enrolled Owner for backup management, sensitive audit gate everywhere, recent password/TOTP for download/material/settings apply. Recheck after asynchronous waits and before final sensitive effects; restricted sessions never upgrade. CSRF/trusted origin enforced by shared HTTP boundary.

## Validation and recovery
Strict schemas, bounded size/time/storage/history, fixed safe filenames and validated directory. Wrong material/corrupt archive fail closed without output or filesystem extraction. Unknown jobs require explicit review/retry; keep last valid archive. Safe errors exclude credential/material/proof values.

## Implementation surfaces
src/consoleBackupArchive.ts, src/consoleBackups.ts, src/consoleStore.ts, src/consoleHttp.ts, src/audit.ts; test/console-backups*.test.ts

## Positive/negative validation
Positive archive round trip with credentials/system secrets/history/settings/retained verified audit; exact excluded-state checks; consistent rotation/apply ordering; Owner recent download; wrong material, corrupt/unsafe/unsupported/missing dependency/Owner manifests; overlapping starts; stale actor; audit/storage/encryption failure; restart publication ambiguity.

Commands: `npx vitest run test/console-backups.test.ts test/console-backups-http.test.ts; related setup/admission/services tests`. Environmental listener EPERM requires identical command with loopback permission. No plaintext evidence, browser persistent state, traces or HAR.

## Acceptance criteria
The stated observable outcome and governing milestone clauses are implemented with positive/negative evidence; no excluded live authority in archive; last valid output remains after failure; errors and progress are truthful and bounded.

## Commit boundary
One coherent delivery: M16 slice 01 commit containing owned implementation/tests/docs and this plan. Preserve test-results/ and upstream authority. Record exact commit externally and in next slice/index provenance; never squash.

## Execution evidence
Build passed; focused/related tests passed 41 tests / 5 files with loopback escalation after initial listen EPERM. Actual HTTPS browser passed 3 groups: manual complete archive, recent-auth real download/independent verification, missing-archive error; keyboard and 320px PNGs/report in evidence/qa/secretsauce-mcp/milestone16.

### Investigation corrections before further edits
Root review identified recursive field-name exclusion could erase legitimate service/credential identifiers. Replace with exact owned domain paths, add strict domain validators and collision-ID roundtrips. Backup-specific publication/download must use exclusive no-follow FD operations; directory iteration is bounded and ancestor/descendant live-storage overlap rejected except managed default. Add job elapsed budget and corresponding negative fixtures. These are implementation corrections within unchanged M16 authority. Precise PRD review confirmed manual start needs current Owner plus explicit confirmation and audit, while download/material require recent authentication.
