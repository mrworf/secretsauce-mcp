# Milestone 55: Use consistent clean, read-only and feedback states

## Objective

Shared editor state, read-only configuration, notification and date presentation form one cross-console pattern outcome; avoid separate milestones for each component or reported screen.

## User/System Outcome

People see only meaningful actions, readable archived configuration, concise task-bound outcomes and consistent local dates.

## Scope

Clean action bars across Services/Settings, archived layout parity, field cues, assignment copy, shared successes/download labels and browser-local timestamps.

## Explicit Exclusions

No Activity query/export semantics (M56), Settings transaction repair/dedicated review (M57), restore materialization (M58), new notification center, permissions or timestamp-storage migration.

## Source Requirements

Ready UX13 package3a186ac/c096391 is primary PRODUCT_BUILD authority; REC018 bfacd51/352df68 is adopted provenance. REC-RM-071/072/073; PO-FB299–318; UX-06, CONFIG-01; U13-01/02/03; UX-IN29/30/31, UX-R15/A13/C98–101. Preserve all completed M10–54 and SEC-DEF-001.

## Preconditions

- PRE-087/088/089 — current UX13 authority, declared Node/locked dependencies/OpenSSL and disposable browser/Docker facilities verified; provider: repository/current host.
- PRE-090/091 — completed prior contracts and declared earlier milestone providers must be accepted before consuming their changed behavior.
- PRE-092 — consuming-milestone focused acceptance and final UX13-INTEGRATED remain required; readiness does not certify them.

M54 shared service identity/reference and proposal/access lifecycle contracts remain; existing Settings and identity forms provide sibling consumers.

## Functional Requirements

1. Hide bars/reserved space only with no real local delta, saved proposal or independent pending intent. Preserve independent errors/unknown state, full-label focus clearance and immediate current Access/service value/SMTP exceptions.
2. Archived Configuration uses ordinary sections/order/cards/width and exact readable non-secret values with read-only semantics. Preserve allowed Advanced/copy/navigation and separate lifecycle/discard/delete actions; no hidden write-only secrets or configuration mutation.
3. Remove standalone Required legends across equivalent forms/dialogs; retain local asterisks/programmatic/conditional required semantics and help/errors. Remove redundant Explicitly assigned row qualifier, explaining roles alone grant no service use.
4. Shared concise routine successes are dismissible, about5seconds only with durable equivalent, polite without focus theft, paused on hover/focus; upper-right workspace placement never covers sidebar/actions/errors and reflows at narrow widths. Scope to completed task; unrelated navigation dismisses stale context, but publish legitimate Apply success after its intended return. Persistent security/unknown/validation/cleanup failures remain actionable. No unlimited notification stack.
5. No successful-download toast; preserve failures/audit/safeguards. Rename People action Export service assignments.
6. Browser-local timestamps identify zone across Activity, people, credentials, backups, health and history. UTC internal/API/export instants stay unchanged. Explicit UTC backup scheduling stays UTC. Preserve milliseconds/instant semantics and distinguish DST repeated times; invalid local inputs fail precisely.

## UX Constraints

UX13 manifest, UX-G14/IN29–32/R15/A13 and applicable C98–105 preserve approved visual family. Apply only relevant task clauses above; preserve all unaffected timing/role exceptions, local error states, exact values and navigation guards. No new design variants required.

## Architecture / Security Constraints

STATE-13/SECRES-12 and prior service-reference/incarnation/restore/audit contracts govern. Current authorization, CSRF, bounded resource use, durable before-effect audit and honest unknown outcomes remain. No live credentials, headers or tokens in logs.

## Interfaces and Compatibility

Public MCP/configuration/auth semantics unchanged. Shared time presentation cannot alter stored instants, schedules or export schema. No readonly task may gain mutation authority.

## Acceptance Criteria

- [ ] Clean versus local/saved/pending-intent bars and focus behavior are correct across siblings.
- [ ] Archived layout matches active/inactive read-only; no legend or lost required semantics.
- [ ] Success scope/timing/dismissal/durable equivalent and persistent error behavior proven; downloads silent on success.
- [ ] Local timestamps/DST and UTC schedule/export exceptions correct.

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
