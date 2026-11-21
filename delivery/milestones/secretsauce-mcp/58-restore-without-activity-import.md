# Milestone 58: Restore configuration without importing archived Activity

## Objective

Restore evidence installation changes a material trust boundary and needs independent old/new archive and crash qualification, separate from presentation or query implementation.

## User/System Outcome

Restore preserves current-host Activity and verifies archive evidence without installing any incoming archive Activity source.

## Scope

All accepted archive versions, nested imported domains, validation versus materialization, local continuity and recovery/rollback exclusion.

## Explicit Exclusions

No purge/hiding of current-host legacy domains, archive verification bypass, backup export evidence removal, new audit upload, format/cryptography redesign or weaker restore gates.

## Source Requirements

Ready UX13 package3a186ac/c096391 is primary PRODUCT_BUILD authority; REC018 bfacd51/352df68 is adopted provenance. REC-RM-075; PO-FB335–337/350; BACKUP-01/03/06, AUDIT-02/04; STATE-13/SECRES-12 D13-02; UX-C103. Preserve all completed M10–54 and SEC-DEF-001.

## Preconditions

- PRE-087/088/089 — current UX13 authority, declared Node/locked dependencies/OpenSSL and disposable browser/Docker facilities verified; provider: repository/current host.
- PRE-090/091 — completed prior contracts and declared earlier milestone providers must be accepted before consuming their changed behavior.
- PRE-092 — consuming-milestone focused acceptance and final UX13-INTEGRATED remain required; readiness does not certify them.

M56 supplies complete query/detail/export scopes for proving source exclusion; completed recovery/launcher contracts and format10 identity binding provide trust baseline. M57 format-writer preservation must be included in final integration before deployment, without a fabricated feature dependency.

## Functional Requirements

1. Exclude incoming archived local audit and nested importedAudit rows from newly installed/queryable Activity sources for every accepted archive version, including old valid archives. Query/detail/export cannot expose them indirectly. UI hiding alone is insufficient.
2. Keep cryptographic chain/head/dependency/provenance verification even for excluded rows; preserve bounded worker/job/staging, clean-host proof, exclusive publication, leases and recovery-material gates. Backup exports may still contain evidence.
3. Preserve independent current-host journal/gateway audit, post-snapshot/restore/enrollment/resume events and already-installed legacy imported domains with existing authorized query/export/retention; no purge, overwrite or duplicate reimport. Clean host starts local installation/recovery Activity, not archived continuity.
4. Retain nonqueryable metadata needed for verification/security and snapshot account/credential historical attribution. Preserve fresh incarnations, disabled service gates, enrollment, revoked sessions, protected cleanup and rollback.
5. Failed/uncertain installation restores coherent prior local state and reports truthfully. Restart/crash/cleanup/rollback cannot replay archived materialization. Preserve state-format10/newer through every writer and restore path, including existing SMTP path qualification from M57; no silent downgrade.

## UX Constraints

UX13 manifest, UX-G14/IN29–32/R15/A13 and applicable C98–105 preserve approved visual family. Apply only relevant task clauses above; preserve all unaffected timing/role exceptions, local error states, exact values and navigation guards. No new design variants required.

## Architecture / Security Constraints

STATE-13/SECRES-12 and prior service-reference/incarnation/restore/audit contracts govern. Current authorization, CSRF, bounded resource use, durable before-effect audit and honest unknown outcomes remain. No live credentials, headers or tokens in logs.

## Interfaces and Compatibility

All previously accepted archive versions remain accepted and fully verified, but archived Activity installation is deliberately removed. Current-host authorized legacy visibility, backup evidence, source attribution and recovery security remain.

## Acceptance Criteria

- [ ] Old/new valid archives with local and nested imported evidence restore settings without exposing incoming rows in query/detail/full export.
- [ ] Current-host local/post-snapshot and installed legacy sources remain authorized/visible; no duplicate import.
- [ ] Tampered archive evidence still fails verification; failures/interruptions/rollback/restart preserve coherent host state.
- [ ] Actual same-candidate-image clean-host/in-place/launcher recovery and format monotonicity evidence pass final checkpoint.

## Required Validation

Reuse/extend existing affected tests and isolated synthetic HTTPS/browser harnesses before adding tests; new external inputs need positive and negative cases. Run focused affected suites/build, not a full suite per milestone. Suppress request headers/cookies/credentials in harness failures. Compare actual equivalent screenshots against UX13 manifest and inherited approved appearance at1440,390 and320px/200% text; inspect images, keyboard/focus, full labels, text-range/document overflow and footer/modal clearance. Cover ordinary populated, clean/dirty, loading, empty, read-only, error and unknown states appropriate to the outcome. Functional PASS or screenshot existence alone is insufficient.

All new work reaches **UX13-INTEGRATED** before final acceptance/deployment: freeze clean tracked source and run `npm test -- --maxWorkers=2` without concurrent browser/Docker workloads (npm test pretest satisfies build). Reuse current final-source focused/browser evidence, supplement joined changed journeys, and build one exact final application image after the stable suite for mandatory affected in-place/clean-host/restart/rollback/launcher recovery drills. No repeated image builds by default. First confirmed out-of-area regression widens focused scope; second distinct regression or further spread requires full regression after focused repairs. Actual self-signed HTTPS is required if transport changes. Implementation/targeted acceptance never waives this final checkpoint.

## Known Risks / Deferred Work

No required scope deferred. Mechanism and coherent slice boundaries belong to delivery. Shared normalization/navigation can cause false dirtiness or stale-result races; preserve explicit task and authority contracts.

## Readiness checks

- `node --version`, `npm --version`, `npm ls --depth=0`, `openssl version` — Node satisfies package.json >=22; locked dependency tree is complete and TLS fixture tooling available. A fresh checkout uses `npm ci` with the committed lockfile.
- Inspect status.yaml and current definition-package hashes — declared dependencies completed before selection; no unresolved authority, stale source or competing transaction.
- `docker image inspect mcr.microsoft.com/playwright:v1.64.0-noble --format '{{.Id}}'` — declared synthetic-browser image available; existing browser/recovery/launcher scripts remain present. Readiness uses metadata only, not live workloads.
- Inspect UX13-INTEGRATED — preserve frozen bounded-worker full suite (pretest build), final-source browser evidence and one exact-image affected recovery/launcher drill. These checks belong to implementation acceptance, not this readiness pass.
