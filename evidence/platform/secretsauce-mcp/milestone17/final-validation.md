# M17 final local validation

Transaction: b08d4b8efaf3742eeb41bfdc9a90f437b768525c → three owned slice commits.
Root owns final milestone acceptance and records slice03 SHA after commit.
Current production includes final heading reflow correction; all final commands below run
serially after that change. No remaining production edits are planned.

| Check | Command / evidence | Result |
| --- | --- | --- |
| Current local Docker image | secretsauce-m17-local:acceptance, sha256:f17901a8e5fcd59fae0cdee319e9b7d1492574c4cbdea07e8c3d021a081c2487 | built |
| Every actual install/rollback hook occurrence | node scripts/verify-console-recovery-crashes-docker.mjs · [94 records](docker-crash-report.json) | PASS:63Prior,31Recovered; independent audit healthy |
| Launcher ownership | node scripts/verify-console-recovery-launcher-docker.mjs · [9 cases](docker-launcher-report.json) | PASS |
| Original-key-loss cleanhost, fresh enrollment/client and one reviewed service | node scripts/verify-console-recovery-cleanhost-docker.mjs · [report](docker-cleanhost-report.json) | PASS:5groups;23.870s fresh login,55.970s one service usable,100services/10k/12,270,470B |
| Current HTTPS recovery/reflow | node scripts/verify-console-recovery-browser.mjs with isolated evidence directory and declared Chromium · [report](../../../qa/secretsauce-mcp/milestone17/current/recovery/browser-report.json) | PASS:4groups; desktop320 and200% text enrollment/review/account; critical actions keyboard focused |
| Canonical full suite | npm test | PASS:620tests/67files,44.80s; identical command with authorized loopback permission after sandbox listenEPERM |
| Canonical build | npm run build | PASS after last production change |
| Syntax/diff checks | node --check owned verification scripts; git diff --check | PASS |

[All25 UX checks](../../../qa/secretsauce-mcp/milestone17/ux-coverage.md) and
[criterion/requirement mapping](acceptance-coverage.md) distinguish current rendered
observations, fault tests and actual local protocols from real external LLM connections.
The latter remain **NOT RUN** under the explicit user-authorized exception.

Validation fixes were classified narrowly: actual pre-Node PID/thread collision and
repeated-value provenance processing were implementation defects; placement/destination/
public-field drill corrections and scoped60s multistage Vitest deadlines were fixture
corrections. The real200% text H2 overflow required adding headings to the existing wrap
rule. Existing production admission/resource deadlines and acceptance targets remain.
Inherited11dependency advisories remain triaged separate follow-up. Owned temporary mounts
and containers are cleaned; pre-existing test-results/ and historical evidence are untouched.
