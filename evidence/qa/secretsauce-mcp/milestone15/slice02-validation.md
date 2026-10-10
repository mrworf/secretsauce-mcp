# M15 slice 02 validation

Focused and related command:

`npm test -- test/console-operations.test.ts test/console-operations-http.test.ts test/console-evidence.test.ts test/audit.test.ts test/inflight-limiter.test.ts test/secret-scanner-pool.test.ts test/login-attempt-limiter.test.ts test/console-authentication.test.ts test/console-admission.test.ts test/managed-oauth.test.ts test/oauth-client-metadata.test.ts test/sensitive-names.test.ts test/denials.test.ts`

PASS 128 tests / 13 files, including pretest TypeScript build. Loopback permission was required; listener tests were preserved. Checks include current-role/scoped draft review, failed prepare, uncertain committed completion, long reference lifetimes, occupied request/body/password/reference/denial state, held actual metadata retrievals while lowering capacity, active/queued scanner jobs and idle worker retirement, actual bounded name-only workers, managed policy denial/capacity admitted revision, missing/replaced/permissive application key and deleted audit materials, safe public health, forged proxy headers, and pending backup health. Existing managed OAuth test exercises held code/grant/JWT state and rejects additional allocation after lowering occupied bounds.

Actual HTTPS Chromium, synthetic example.org certificate and loopback resolver:

`PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-m10-browsers node scripts/verify-console-operations-browser.mjs`

Six groups pass: Activity investigation/details/audited export, retention impact/review/apply, all 39 visible labeled limits in human units with invalid-combination context preserved and explicit review/apply, current role restrictions, recent-MFA account disable, and audit-outage retained reads/blocked export. Screenshots at 320 CSS pixels verify reflow and keyboard action reachability. Account-disable and denial-investigation timings are recorded in browser-report.json; both are below one minute/two minutes respectively. Health labels backup pending and email not configured. Screens mask password/code/proof-bearing nodes; no trace/HAR/storage persistence.

An additional exact-unit regression saves/reviews/applies an unchanged imported 1001ms deadline as 1.001 seconds. Conversion checks whole-byte MiB and whole-count values, rejecting actual sub-ms/sub-byte/fractional counts. Strict input rejects prototype keys. Final whole-suite/build and real retained-disk/Docker evidence remain slice03 obligations. Real LLM client interoperability is NOT RUN under the recorded local-validation authorization; browser checks do not claim it.
