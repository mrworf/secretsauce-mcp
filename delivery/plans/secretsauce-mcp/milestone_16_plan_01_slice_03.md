# M16 slice 03: Settings experience and verified operating evidence

## Goal and observable outcome
Owner reaches Backups & restore, creates/downloads encrypted archive with truthful times/stages, configures daily backups/retention, and sees real backup health/version evidence and off-host responsibility.

## Scope and non-scope
Accessible Settings UI; health/evidence integrations; runbooks; HTTPS browser and isolated Docker failure/clean-host drills.

M17 restore activation and actual LLM integration are not claimed.

## Dependencies and ordering
Slices 01 and 02. Governing plan milestone_16_plan_01.md; exactly M16.

## Entry point and end-to-end behavior
Owner Settings or bounded provider API validates input/current authority and durable audit, captures coherent state, performs bounded work, persists outcome and reports safe progress/error. Scheduled work uses durable system admission and cannot bypass audit. M17 consumes verifier and coordinator without installation implemented here.

## State transitions
Settings draft → reviewed → applied; job queued/running → completed/failed/unknown; restart resolves incomplete state truthfully. Only fully verified ciphertext is published. Current committed settings remain during draft errors. Retained archive material versions remain explicit.

## Authorization
Current active enrolled Owner for backup management, sensitive audit gate everywhere, recent password/TOTP for download/material/settings apply. Recheck after asynchronous waits and before final sensitive effects; restricted sessions never upgrade. CSRF/trusted origin enforced by shared HTTP boundary.

## Validation and recovery
Strict schemas, bounded size/time/storage/history, fixed safe filenames and validated directory. Wrong material/corrupt archive fail closed without output or filesystem extraction. Unknown jobs require explicit review/retry; keep last valid archive. Safe errors exclude credential/material/proof values.

## Implementation surfaces
src/consoleBackupsPage.ts, src/consolePage.ts, src/consolePeoplePage.ts, src/consoleOperations.ts, src/consoleEvidence.ts; scripts/verify-console-backups-*.mjs; docs; evidence; AGENTS.md if durable lessons.

## Positive/negative validation
Rendered actual HTTPS creation/download/settings/recent authentication/failure context; keyboard-only and 320px essential actions; real health and export; actual Docker archive/material alone independent decryption with no lost host keys; corruption/wrong material/storage/restart drills; final regression/build.

Commands: `npm test; npm run build; PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-m10-browsers node scripts/verify-console-backups-browser.mjs; node scripts/verify-console-backups-docker.mjs`. Environmental listener EPERM requires identical command with loopback permission. No plaintext evidence, browser persistent state, traces or HAR.

## Acceptance criteria
The stated observable outcome and governing milestone clauses are implemented with positive/negative evidence; no excluded live authority in archive; last valid output remains after failure; errors and progress are truthful and bounded.

## Commit boundary
One coherent delivery: M16 slice 03 commit containing owned implementation/tests/docs and this plan. Preserve test-results/ and upstream authority. Record exact commit externally and in next slice/index provenance; never squash.

## Execution evidence
Pending.
