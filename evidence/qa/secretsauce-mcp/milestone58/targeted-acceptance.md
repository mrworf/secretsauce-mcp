# M58 targeted recovery acceptance

Restore now verifies incoming local and nested archive evidence without constructing Activity projections or installing source domains. This applies to legacy/current valid archives through the common verification/installation path. Current-host imported domains are copied from current state, never the archive; current local journal remains independent. Clean-host restore starts with no imported domains. Archive backup evidence and full cryptographic/head/dependency validation remain intact.

The validation-only worker pass retains record shape, timestamps/revisions, ancestry consistency, domain/count and work bounds without sanitized display-row construction. Shared job/worker termination/staging remains unchanged. Incoming service evidence links and legacy attribution windows are removed; only positively proven current-host incarnation lineage is retained. Current-host legacy domains remain globally queryable/exportable even when a scoped lineage cannot be proven. Public references are revoked through the manager mapping on pre/post install and rollback, rather than passing immutable managed IDs to a public-reference invalidator.

Restored local state uses format10 or a newer current-host format, including empty-service archives. Portable archive state.v remains its existing schema1, so it cannot be mistaken for the local reader floor. Fresh incarnations, disabled service state, fresh enrollment, historical credential/account metadata and transaction cleanup remain intact.

## Focused evidence

`npm run build` PASS.

`npx vitest run test/console-restore-recovery.test.ts test/console-restore-provenance.test.ts test/console-restore-install.test.ts test/console-restore-preview.test.ts test/console-backup-domains.test.ts --maxWorkers=2` — **47 tests,5 files PASS**. Identical command rerun with loopback permission after one backup-domain listener EPERM. Initial new fence tests spied on a separate fixture manager; corrected to the actual restore-owned singleton without weakening the public-reference assertion.

Coverage includes legacy/current/empty archive cases; cryptographically corrupt nested evidence rejected before mutation; incoming rows absent from query/detail/full export; clean-host local installation events retained; target-host legacy and post-snapshot local rows visible/exportable; existing archive serialization preserves legacy source domains while dropping cached rows; renamed references revoked on successful install and rollback; reused crash publication/cleanup, enrollment, authority/staging, storage and SMTP restoration checks. Exact source hashes are in source-revisions.json.

No graphical layout changed. M55/M56 Activity presentation evidence remains applicable; this acceptance proves source visibility through actual service/API code, not a screenshot claim. Restore notice now states archive Activity was not imported.

## Required final same-image qualification — pending outer UX13-INTEGRATED

No full suite, image build, Docker recovery or deployment ran in this transaction. The outer checkpoint must freeze source, run the full bounded-worker suite without competing workloads, build one exact image, then run these existing scripts sequentially against that image:

```sh
M17_DOCKER_IMAGE=secretsauce-local-review:m58 M54_REFERENCE_RECOVERY=1 CONSOLE_PLATFORM_EVIDENCE_DIR=evidence/platform/secretsauce-mcp/ux13-integrated node scripts/verify-console-recovery-cleanhost-docker.mjs
M17_DOCKER_IMAGE=secretsauce-local-review:m58 CONSOLE_PLATFORM_EVIDENCE_DIR=evidence/platform/secretsauce-mcp/ux13-integrated node scripts/verify-console-recovery-crashes-docker.mjs
M17_DOCKER_IMAGE=secretsauce-local-review:m58 CONSOLE_PLATFORM_EVIDENCE_DIR=evidence/platform/secretsauce-mcp/ux13-integrated node scripts/verify-console-recovery-launcher-docker.mjs
```

Clean-host harness retains100-service/10000-event encrypted archive, destroyed original key, fresh enrollment, renamed public route, real MCP, restart and competing lease checks; now asserts no incoming rows in state/query/full export and local installation evidence present. Crash harness adds two actual ConsoleRestore in-place install/rollback cases before its existing all-boundary SIGKILL matrix. Its fixture preserves a real signed pre-existing legacy domain and post-snapshot local event; checks query/full export and public-reference invalidation. Both prior/new crash states retain the exact legacy-domain hash through restart and cleanup. Launcher keeps its existing9metadata cases. All three scripts syntax-check PASS; actual execution is pending the final supplied image. No qualification gate waived.
