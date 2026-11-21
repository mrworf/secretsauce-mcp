# Milestone 56: Search and export complete filtered Activity coherently

## Objective

Keep filters, paging, counts and complete download together as one investigation outcome, not separate UI/API/export layers.

## User/System Outcome

Investigators see results matching their deliberate search and download every matching authorized retained event independently of page.

## Scope

Last24h default, All time/Custom, manual Search invalidation, fixed searched bounds, paging/total, complete bounded export and concise Activity copy.

## Explicit Exclusions

No durable search snapshot, retention hold, persistent export job, Member export privilege, audit retention redesign or incoming archive source behavior (M58).

## Source Requirements

Ready UX13 package3a186ac/c096391 is primary PRODUCT_BUILD authority; REC018 bfacd51/352df68 is adopted provenance. REC-RM-074; PO-FB319–334; AUDIT-02.a/b, UX-06; STATE-13/SECRES-12 D13-01; UX-IN31/C102–103. Preserve all completed M10–54 and SEC-DEF-001.

## Preconditions

- PRE-087/088/089 — current UX13 authority, declared Node/locked dependencies/OpenSSL and disposable browser/Docker facilities verified; provider: repository/current host.
- PRE-090/091 — completed prior contracts and declared earlier milestone providers must be accepted before consuming their changed behavior.
- PRE-092 — consuming-milestone focused acceptance and final UX13-INTEGRATED remain required; readiness does not certify them.

M55 supplies shared local-time and notification behavior consumed by Activity; existing M46 predicates/roles and M54 identity-bound service context remain.

## Functional Requirements

1. Initial Activity selects Last24h and may query once. All time disables bounds; Custom enables validated local dates. Resolve presets to inclusive absolute UTC instants at deliberate Search/Refresh, not on pagination.
2. Any committed filter/chip/range/date/Clear change immediately clears rows/count/paging/export and waits for Search. Canceling an uncommitted dialog retains current query. History may reuse only exact matching context; stale async completions cannot resurrect previous results.
3. Page-size25/50/100 (default50/max100) is presentation paging of successful criteria, resets page1; Previous/Next retain absolute bounds and fixed per-service scope. Show actual visible range, matching total and page count, including truthful zero-results behavior.
4. Export filtered activity is unavailable until successful current Search; rechecks authorization and uses all matching retained events of a fresh admitted snapshot, independent of offset/size. New/expired records may change export count. Preserve exact OR-positive/AND-veto filter semantics, Member scope/denial and fixed service context.
5. Remove500-row and2MiB successful completeness caps for Activity. Retain100,000 retained-row/2second aggregate selection protection; budget/serialization/cancel failures are explicit, never empty matches or a complete-looking partial file. Bound buffering/concurrency/work and recheck authority before releasing async output. No unbounded JSON-copy requirement or mandatory job system. Other exports retain bounds.
6. Preserve UTC evidence schema, nested sanitization, authenticated/CSRF audited admission and safe error logging. Keep applied retention visible; remove debug search, standing checkpoint and generic unknown instructions while retaining specific integrity/unknown/error actions. Current-host legacy domains remain authorized and queryable pending/after M58.

## UX Constraints

UX13 manifest, UX-G14/IN29–32/R15/A13 and applicable C98–105 preserve approved visual family. Apply only relevant task clauses above; preserve all unaffected timing/role exceptions, local error states, exact values and navigation guards. No new design variants required.

## Architecture / Security Constraints

STATE-13/SECRES-12 and prior service-reference/incarnation/restore/audit contracts govern. Current authorization, CSRF, bounded resource use, durable before-effect audit and honest unknown outcomes remain. No live credentials, headers or tokens in logs.

## Interfaces and Compatibility

Existing query default/max and offset0–100,000 remain. Activity export changes completeness behavior only; same public evidence schema, live authorization, audit and bounded trust. No filter log leakage.

## Acceptance Criteria

- [ ] Initial/default/custom/all-time and manual-search clearing match displayed/query criteria.
- [ ] Page ranges/counts/size preserve successful interval through later pages and async races.
- [ ] More than500matches and more than2MiB valid content export completely, independently of page; bounded/denied/canceled failures never claim complete file.
- [ ] Existing exact filters, Member denial, service scope, sanitization and current-host legacy visibility preserved.

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
