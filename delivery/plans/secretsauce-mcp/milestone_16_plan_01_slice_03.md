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
Completed all planned implementation and verification. Final npm test:585tests/61files PASS (identical authorized loopback rerun after sandbox EPERM); final npm run build PASS. Focused48tests/4files PASS, final rich/cold-cache4tests PASS, actual TLS SMTP4tests PASS. Final actual HTTPS backup7groups PASS including keyboard320px unknown acknowledgement, blocked health, account/logout; preserved operations6/advanced6/clients5groups PASS stored only underM16. Historic earlier evidence remains untouched.

Current-image actual Docker11groups PASS: clean network-none ciphertext-only mount/material stdin independently verifies100credential plus management/gateway audit-key dependencies; wrong material/truncation reject; five actual SIGKILL publication boundaries restart unknown, refuse interrupted download and preserve last-good download; real storage/audit and independent PID-namespace writer faults. Final image sha256:de535a12ada9a76ac50377ea0259666a666fe0bac99bd1f24ffd0f63d776f938.100services/10k synthetic retained audit:12,270,470B archive,2.383s job,106authenticated MCP tools/list reads mean7.318ms/max349.723ms. No continuous reads/downstream-dispatch claim. One attempt under simultaneous full-suite/browser load failed before its expected crash marker; isolated rerun passed unchanged strict limits. Root cause unproven, attempt reported transparently.

Requirement matrix: evidence/platform/secretsauce-mcp/milestone16/acceptance-coverage.md. Exact commands/outcomes: validation-report.json and docker-report.json there; actual HTTPS reports/masked PNGs: evidence/qa/secretsauce-mcp/milestone16/. Owned ephemeral containers/temp mounts removed; local acceptance image retained. Pre-existing test-results/ excluded/preserved. Actual LLM checks NOT RUN under explicit exception; restore installation belongs17; inherited dependency findings carried transparently.

Slice03 commit SHA is sent externally to root after this coherent commit; the committed payload cannot contain its own SHA. Parent slice02:ee29ef90afc8c6842c81aa6ad8b6928f2f4beb29. No upstream authority/status changed.

### Pre-implementation findings
Slice02 delivered at ee29ef90afc8c6842c81aa6ad8b6928f2f4beb29. Health must report accessible archive integrity/availability, a missed conditional daily target, retained-output/catalog capacity and separate retention failure; historic completion alone is insufficient. Archive-rich validation must cover builtin/external authentication, scanner catalogs/regex destinations, service drafts/history, SMTP system secrets, migrationGlobals and operating settings. Provide the M17 bounded decryption worker API with the same single-job coordination contract. Docker fixtures use launcher leases, actual loopback listeners and only synthetic isolated mounts; no host-key overwrite to simulate restore.

### Review corrections before final production changes
Original gateway audit binding is included as provenance and requires its matching audit domain; M17 owns fresh local binding. Health integrity caches use no-follow same-file-descriptor stat stamps and at most one uncached archive verification per request, reporting checking rather than claiming accessibility. Manifest assembly time and actual post-publication job completion remain distinct. Rich domain tests validate normalized current/applied dependencies and imported proposals.
