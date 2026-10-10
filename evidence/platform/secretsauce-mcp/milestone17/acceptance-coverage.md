# M17 local delivery coverage

Delivery transaction started at `b08d4b8efaf3742eeb41bfdc9a90f437b768525c`.
Slice01: `03cb353584303f1f13fcab8e5ff4f39f5c2ef645`.
Slice02: `c774c4f7fca5803ab3385425104fc0f1d23db0ad`.
Slice03 SHA is recorded by the accepting orchestrator after commit.
This report provides implementation evidence; milestone acceptance/status remains root-owned.
[Final commands/results](final-validation.md) accompany the requirement mappings.

Authority: [milestone17](../../../../delivery/milestones/secretsauce-mcp/17-safe-instance-recovery.md),
[PRD](../../../../docs/web-console-prd.md),
[state](../../../../product/architecture/web-console-state-contract.md),
[security](../../../../product/security/web-console-security-contract.md),
[UX checklist](../../../../product/ux/07-acceptance-checklist.md).

## Acceptance criteria

| Criterion | Current evidence and practical scope |
| --- | --- |
|1: Authorized bounded clean/in-place preview and restricted complete installation; malformed input unchanged | `console-restore-preview`9 and `console-restore-http`2 tests; encrypted semantic negative fixtures in `console-restore-recovery`15; actual [preview HTTPS](../../../qa/secretsauce-mcp/milestone17/preview/browser-report.json), [current recovery HTTPS](../../../qa/secretsauce-mcp/milestone17/current/recovery/browser-report.json) and [100service cleanhost Docker](docker-cleanhost-report.json). Clean proof actually admitted before large body; Owner password/TOTP5m; independent material; fixed ciphertext staging and shared slot. |
|2: Every atomic boundary coherent prior or restricted new; retained local evidence; no partial activation | [94 actualSIGKILL cases](docker-crash-report.json), [hook invocation inventory](installer-boundaries.json), installer4 tests including repeated hook occurrences and completed enrollment preservation; current-image [launcher9cases](docker-launcher-report.json), actual enrolled-state restart in cleanhost drill. Rollback full factors remain local nondownloadable; all old sessions/grants/proofs remain invalid. Cleanup-only namespace precedes deletion. |
|3: Every old local authority denies; fresh restricted Owner and selective explicit service/user review | Actual `console-restore-protocol` local OAuth/MCP tests preserves issuer/signing while old JWT/refresh/service/response references and late completion deny after a fresh grant; old invitation/setup/TOTP/recovery-code negatives; source-accepted real signed externalJWT denies while restored exact mapping inactive/authentication requires explicit reactivation; `console-restore-recovery` covers absent archived initiator, incomplete nominee protection and reenrollment. Cleanhost original master-key deletion, old bearer/session/password/TOTP denial, fresh Owner factors, protected lost-continuation reissue, one service actual downstream200 and99Disabled. No bulk resumption. |
|4: Provenance/unknown interval truthful, audit health mandatory, conditional timed cleanhost and current client reconnect | `console-restore-provenance`3 verifies derived cache/source authenticity, local newer completion, flat rebackup dedup, original/current secret redaction, retained unresolved evidence and deletion receipts; cleanhost authenticated Activity verifies imported source and last-archive→first-installed-local endpoint. Audit missing key blocks enrollment; recovery15 covers completion uncertainty after durable activation. New MCP current bearer/reference downstream succeeds. [Runbook](../../../../docs/console-recovery.md) and report give measured conditional RTO/RPO. |

Actual external ChatGPT/Codex execution is **NOT RUN**, exactly as authorized in
[local validation exception](../../../../workflow/delivery/local-validation-authorization.md).
Local protocol/browser validation does not claim to be those products. External-issuer
JWT lifetime remains issuer-owned: restored mappings inactive and authentication requires
explicit reactivation; ordinary accepted issuer semantics remain the existing external
OAuth contract. There is no new token-digest/issued-at fencing or claim of revoking all
unknown external JWTs. Existing `managed-external-oauth` regression verifies normal exact
issuer/subject mappings and asynchronous verification fencing.

## Requirement and failure mapping

| Requirements | Positive/negative/failure evidence |
| --- | --- |
| BACKUP03/04, SECRES02, STATE05 | Bounded archive/deployment/capacity/proof/preview validators; restore-preview9/http2, recovery15, installer4,94crash, cleanhost5groups; wrong material/version/corruption/noOwner/ambiguous identities/unsafe links/space/drain/prebackup failures leave unchanged or coherent rollback. |
| BACKUP05, STATE06, AUTHZ03, IDENT01/05/06, SECRES01 | Restricted continuation30m/10attempts/instance+archive bound; old/replayed/crossarchive/lost/expired capabilities; fresh Owner pw/TOTP/codes; incomplete nominee and lastOwner safeguards; other users remain unenrolled/inactive and assignments alone grant nothing; explicit single-service review. |
| BACKUP06, AUDIT01/03/04, SECRES04 | Independent current local journal/gateway binding; newer in-place tail and failure audit retained; flat source identity/hash/HMAC provenance and dedup; honest clean unknown/clock-order interval; audit outage enrollment/completion restrictions; host-only repair never upgrades diagnostic session. |
| MCP02/04, SEC01/03 | Actual stateless local POST OAuth/MCP reconnect, old built-in grant/JWT/reference/completion fences and fresh issuer/signing semantics; new credential placement actual downstream, remaining services disabled; full gateway/scanner/TLS/policy regression required below. |
| OPS03/04/06, CAP-ACCEPT01 | Shared bounded worker slot held through termination, bounded staging/rollback/prebackup capacity and existing work deadlines; both independent mounts guarded by kernel leases; real key/host-loss drill,94crashes and same-mount writer denial; timing and archive100/10k scope below. |
| UX03/04 | Current actual HTTPS/desktop320/keyboard task evidence and full UX-C01–25 mapping in [UX evidence](../../../qa/secretsauce-mcp/milestone17/ux-coverage.md). |

## Current execution

Current Docker image `sha256:f17901a8e5fcd59fae0cdee319e9b7d1492574c4cbdea07e8c3d021a081c2487`.
Actual94SIGKILL boundary records:63prior and31restricted recovered selections; every
restart verified healthy independent local audit. Duplicate rollback hook names execute
by occurrence index, not deduplicated strings. Launcher9cases include retainedPID16/thread
collision, stalePID4096, malformed/out-of-range/oversize/multiline/symlink/livePID1 failure;
no lease/writer metadata is removed to steal ownership.

Cleanhost archive12,270,470bytes,100services/10kretained events. Original synthetic master
key is physically deleted; only ciphertext and independent material enter a replacement
with new key/app/audit mounts. Management fresh login23.870seconds; one reviewed usable
service with current client auth/reference and verified downstream55.970seconds; source
snapshot age5.632seconds. These observed values meet conditional4hRTO/24hRPO once required
infrastructure/archive/material exist. This is the measured synthetic workload, not an
unconditional disaster guarantee. Owner authentication waits use actual TOTP counters.

Initial representative preview failed unchanged at the2second provenance work deadline:
200locations reused the same credential. Deduplicating identical exact-redaction values
preserves redaction semantics and original bounds. A1000-fold duplicate-context regression
and actual100service/10kdrill now pass. Initial actual crash restart correctly failed closed
when oldPID16 collided with a new Node launcher thread. Preliminary bounded shell child
advancement after both leases now precedes Node threads; Node revalidation and ESRCH-only
stale-writer recovery remain. Final image regenerates all94cases.

Final canonical `npm test`:620tests/67filesPASS; final `npm run build`:PASS. Initial sandbox run
failed `listen EPERM`; same `npm test` rerun with loopback permission is mandatory.
A subsequent full run failed the first new multi-stage recovery workflow at Vitest's
default5s test timeout; its still-running bounded worker correctly made the next14fixtures
fail capacity admission. The serialized run reproduced this after all heavy Docker/browser
work ended, ruling out that contention. Only the new multi-stage recovery integration tests
received explicit60s test deadlines. Failed-fixture cleanup remains; temporary diagnostic
spy was removed. Production worker30s/snapshot5s/provenance2s and deadline-negative tests
remain unchanged. The corrected canonical full suite passed619tests/67files in45.15s;
the final suite after the last heading reflow change includes the actual externalJWT case:620/67PASS in44.80s, and explicit buildPASS.

Inherited dependency advisories remain11 (3moderate,7high,1critical), as triaged atM15;
no unsolicited package upgrade or certification claim. Off-host archive/material retention,
external infrastructure availability and original-source events after the snapshot remain
operator responsibilities. Scripts remove only owned synthetic mounts/containers; no
credential/cookie/token/header/body output, HAR, auth trace or browser storage is retained.

Focused 200% text enlargement at320CSSpx initially exposed an unbroken H2 extending to370px despite all component boxes fitting. Adding headings to the existing wrap rule preserves content. Actual HTTPS restricted enrollment, recovered review and account now pass document reflow plus keyboard focus on their critical action at200%; normal desktop/320px states also pass. This is text enlargement, not a claim of native browser zoom or human usability research. The protected diagnostic retains geometry only.
