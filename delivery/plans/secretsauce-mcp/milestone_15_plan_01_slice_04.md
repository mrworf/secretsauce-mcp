# M15 slice 04: Single-instance operating envelope and local deployment evidence

## Goal and observable outcome
Document persistent app/audit/backup/key mounts/private administration/public MCP HTTPS proxy; run50-user100-service retained evidence/quota/bounded background workload and browser field/role/task/reflow checks; actual isolated Docker smoke/restart.

## Scope and non-scope
Only the behavior above and tightly coupled tests/docs/evidence. No later milestone backup/restore implementation, product redesign, real LLM interoperability claim, service packs or upstream status/authority mutation.

## Dependencies and ordering
Existing accepted M13/M14; prior M15 slices; governing milestone_15_plan_01.md and AGENTS/security/state/UX contracts apply.

## Entry point and end-to-end behavior
Console role-scoped API and visible Activity/Settings/service links lead to safe read/filter or scoped draft→review→explicit apply. Current permission is rechecked before mutation/export; unknown completion links operation status and never auto-retries. Slice03 exercises these actual entry points through HTTPS and disposable Docker.

## State transitions
Read preserves current state. Every sensitive action first admits durable audit. Reviewed scoped settings use current base/actor/fingerprint; only admitted committed settings publish. Retention preserves integrity/deletion attribution/security revocation evidence; limits preserve occupied counters. Browser state never stores secrets.

## Authorization
Member reads only own permitted activity, no global export/settings. Owner/Administrator/Auditor inspect non-secret authorized evidence; Owner alone writes limits/retention. Existing Administrator scanner editing remains. Audit outage/restricted sessions block every sensitive action and background work.

## Validation, failure and recovery
Strict bounded inputs, pagination/export/resource deadlines; no raw credentials/tokens/headers/cookies/bodies/proofs in errors/evidence. Storage/integrity failures fail closed with host repair and uncertain operation status. New external inputs have positive and negative cases.

## Implementation surfaces
Docker/proxy/runbook examples, disposable verification scripts and QA/platform reports/screenshots; no upstream authority changes.

## Tests and required commands
Actual Docker retained managed config/hash-only refresh/audit after restart and old reference invalidation; missing key/mount and second writer;50users100services activity/inventory/quota/scanner workload/resource measurements; HTTPS keyboard320px denial<=2min disable<=1min; npm test + npm run build.
Focused `npm test -- <affected test files>` (pretest builds), related subsystem tests. Final slice additionally `npm test`, `npm run build`, actual browser/Docker scripts. If listen EPERM rerun identical command with loopback permission.

## Acceptance criteria
Milestone-required cases above pass; behavior/current role is exercised end-to-end; evidence has sanitized reproducible results and explicit pending M16 backup provider/NOT RUN realLLM boundary. No arbitrary50/100 hard cap or compliance claim.

## Commit boundary
One owned commit includes this plan, coupled code/tests/docs/evidence after required validation. Governing plan indexed status updated; exact resulting SHA reported to root externally. Exclude pre-existing test-results/ and upstream authority/status/goal files.

## Execution record
Implemented deployment/privateproxy/operatingenvelope and missing audit-identity/cross-container lease boundaries. ActualDocker/nginxHTTPS12groupsPASS; local50users100services100actualgatewaycalls10411retainedevents; actualHTTPSoperations6/advanced6/clients5checksPASS; final npmtest558tests58files and npmbuildPASS. See evidence/qa/secretsauce-mcp/milestone15/slice04-validation.md and evidence/platform/secretsauce-mcp/milestone15/docker-report.json. No later backup provider or actualLLM connection implemented/claimed.

Plan history: originally persisted as slice03 before production edits; renumbered04 when root security review inserted the admitted-context corrective transaction. Original scope/requirements retained.

## Reviewed operational correction before production edits
Root Docker review identified a missing-storage identity boundary: an entirely empty replacement audit directory could initialize a new chain on cold startup without the preserved app state detecting history reset. Associate the first healthy gateway audit integrity identity with encrypted app state under both gateway/app durable admission. Future missing/replaced identities stay degraded; no web reset/rebinding after repair. Keep identity non-secret, stable across retention/restart and independent of mutable checkpoints. If initial association completion is uncertain, fail closed. Add actual cold-replacement/missing mount and live material deletion tests; host-directory rename does not replace a live Docker bind inode, so delete actual material for live check. This is supporting M15 deployment/missing-mount acceptance, no M16 backup behavior. Final full suite/build must rerun after correction.

## Docker PID and proxy validation extension before edits
Actual SIGKILL restart exposed namespace PID reuse: init alone gives the replacement app the old writer PID, and correct fail-closed checks reject it. Add a bounded Docker entry launcher that reads only bounded writer-lock PID metadata, spawns/reaps harmless short-lived children until the future app child PID exceeds prior writer PIDs, then forwards shutdown signals/exit status. Existing writer ownership checks remain unchanged: old child PIDs must actually return ESRCH. Reject unbounded/invalid/PID-parent collisions for host repair; never clear locks based on weaker evidence. Test positive launch/signal behavior, malformed/bounded lock metadata, and actual crash restart. This is single-instance deployment support, no host PID namespace or privilege escalation.

Run actual loopback nginx with synthetic HTTPS certificate, public MCP/OAuth and private-console separation, denied public console/allowed private console, spoofed forwarded headers and configured origin/endpoint checks. Containers are disposable, no public ports/network or real account/domain. Proxy configuration validation alone is insufficient; record actual TLS requests and cleanup.

## Cross-container writer lease review
Root requires a kernel-held filesystem lease over both stable app and audit directories before namespace PID padding: separate containers cannot infer each other's PID liveness. Docker shell launcher holds nonblocking flock descriptors for process lifetime; files remain stable and are never deleted to steal ownership. Existing PID checks still require ESRCH. Unsupported non-Node invocation/missing writable mounts fail closed. Add actual second-container same-mount negative, plus signal/crash lease-release positives. Host CLI remains quiesced and never runs alongside app. BusyBox flock is present in the base image; no OS/group/privileged changes.
