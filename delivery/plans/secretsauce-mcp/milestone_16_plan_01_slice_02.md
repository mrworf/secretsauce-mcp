# M16 slice 02: Daily scheduling, retention and independent material lifecycle

## Goal and observable outcome
Owner saves/reviews/applies daily UTC mounted-directory settings with default 30 days, sees deletion impact, changes independent wrapping material with retained-archive warning, and scheduled failures surface optional SMTP alerts.

## Scope and non-scope
Settings transaction; mounted path/input bounds; daily tick/restart; bounded retention; public-key rotation.

No remote storage connector or restore installation.

## Dependencies and ordering
Slice 01. Governing plan milestone_16_plan_01.md; exactly M16.

## Entry point and end-to-end behavior
Owner Settings or bounded provider API validates input/current authority and durable audit, captures coherent state, performs bounded work, persists outcome and reports safe progress/error. Scheduled work uses durable system admission and cannot bypass audit. M17 consumes verifier and coordinator without installation implemented here.

## State transitions
Settings draft → reviewed → applied; job queued/running → completed/failed/unknown; restart resolves incomplete state truthfully. Only fully verified ciphertext is published. Current committed settings remain during draft errors. Retained archive material versions remain explicit.

## Authorization
Current active enrolled Owner for backup management, sensitive audit gate everywhere, recent password/TOTP for download/material/settings apply. Recheck after asynchronous waits and before final sensitive effects; restricted sessions never upgrade. CSRF/trusted origin enforced by shared HTTP boundary.

## Validation and recovery
Strict schemas, bounded size/time/storage/history, fixed safe filenames and validated directory. Wrong material/corrupt archive fail closed without output or filesystem extraction. Unknown jobs require explicit review/retry; keep last valid archive. Safe errors exclude credential/material/proof values.

## Implementation surfaces
src/consoleBackups.ts, src/server.ts; test/console-backups.test.ts; docs/console-backups.md

## Positive/negative validation
Daily successful backups/24-hour target; valid positive settings/material inputs; malformed/path/symlink/stale/review/demoted/recent-auth inputs; retention reduction impact, last-good protection, deletion/storage failure; audit-failed scheduled job; SMTP synthetic success/failure; old material still decrypts old archives; one shared backup/restore slot.

Commands: `npx vitest run test/console-backups.test.ts test/console-backups-http.test.ts test/console-notifications.test.ts`. Environmental listener EPERM requires identical command with loopback permission. No plaintext evidence, browser persistent state, traces or HAR.

## Acceptance criteria
The stated observable outcome and governing milestone clauses are implemented with positive/negative evidence; no excluded live authority in archive; last valid output remains after failure; errors and progress are truthful and bounded.

## Commit boundary
One coherent delivery: M16 slice 02 commit containing owned implementation/tests/docs and this plan. Preserve test-results/ and upstream authority. Record exact commit externally and in next slice/index provenance; never squash.

## Execution evidence
Pending.
