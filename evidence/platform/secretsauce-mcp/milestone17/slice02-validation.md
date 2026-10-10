# M17 slice 02 validation

Current focused affected-subsystem run: **PASS 79 tests / 9 files**; current TypeScript
build **PASS**. Tests: restore recovery (15), provenance (3), installer (4), preview (9),
HTTP (2), backups (22), evidence (11), authentication (8), services (5). Local listener
permission was used after EPERM; listener tests and production bounds remain intact.

Actual HTTPS keyboard browser: **PASS 4 groups**, synthetic example.org certificate,
loopback resolver, desktop and 320px. See [browser report](../../../qa/secretsauce-mcp/milestone17/recovery/browser-report.json)
and masked screenshots there. No HAR/traces/auth state files. Real ChatGPT/Codex is
**NOT RUN** under [local authorization](../../../../workflow/delivery/local-validation-authorization.md).

| Behavior | Current evidence |
| --- | --- |
| Every installer publication/selection/replacement/rollback/cleanup boundary selects coherent state | installer tests; [enumerated hooks](installer-boundaries.json) |
| COMPLETE never replaces subsequent fresh enrollment; completed prior/new outcomes differ | installer tests |
| Atomic hot recovery, old sessions/password/factor authority absent, fresh MFA and consumed continuation | recovery tests; actual HTTPS browser |
| Start/cancel/expiry races cannot release owning job lease | recovery concurrency test |
| Drain/pre-backup/preparation failure retains prior factors while revoking sessions/proofs and preserving backup metadata/failure tail | four fault cases plus rollback test |
| Initiator absent archived users remains separately named and audited | recovery absent-initiator test; browser named nominee/checklist |
| Completion audit outage leaves fresh Owner globally restricted; diagnostic session cannot upgrade | recovery activation audit fault |
| Host proof/material clean replacement, lost/expired/cross-archive continuation and audit outage | recovery and preview tests |
| Duplicate IDs/contacts/issuer-sub, cross human/external collisions, unknown UUID and duplicate assignment rejects before replacement | authentically encrypted hostile archive tests |
| Opaque legacy subjects preserved for explicit mapping/remove review; one reviewed service enables independently | legacy compatibility recovery test |
| Runtime auth/services match recovered disabled state; same logger/pools/brokers remain and prior rollback logging is published | real GatewayRuntime logging tests plus affected auth/service tests |
| Flat inherited provenance survives another backup; source keys/context stay encrypted; cached rows excluded/rebuilt in bounded worker | recovery round trip and provenance tests |
| Newer local completion wins overlap; current/source exact secrets sanitized | provenance tests |
| Expired resolved imported segments contribute to reviewed retention and leave source/head receipts; unresolved retained | provenance retention test |
| Clean replacement has new local audit ownership and explicit last-source/first-installed-local evidence interval | recovery clean-host test and Activity renderer |

Slice 03 remains responsible for actual Docker SIGKILL restart, total host/key loss,
real local protocol reconnection/complete old access checks, final UX-C01–25/timing mapping
and current complete npm test/build. This report does not claim final milestone acceptance.
