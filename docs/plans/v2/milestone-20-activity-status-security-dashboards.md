# Milestone 20 Activity, Status, And Security Dashboards Plan

## Outcome and boundary

Milestone 20 gives superadmins and assigned-service admins bounded operational
visibility derived from already-sanitized durable state. It adds low-cardinality
hourly activity aggregates, scoped status summaries, stable component-health
categories, security signals, and audited remediation acknowledgement. It does
not expose raw paths, queries, headers, bodies, credentials, tokens, full
references, verifier material, downstream content, unscoped user identities,
or arbitrary metrics queries.

The dashboards are control-plane views. Ordinary users and every API-key role
are denied. Superadmins receive system-wide results. Service admins receive
only currently assigned services and related counts; scope is materialized
before aggregation. Dashboard responses are no-store and use the existing
search/report limiter.

## Durable activity model

Migration 0020 adds:

- `activity_hourly`, keyed by UTC hour, service UUID, destination, method,
  endpoint-category kind/value, authorization outcome, and downstream status
  class. It stores request count, safe credential-use count, response
  tokenization count, duration sum/count, and first/last event time.
- `activity_hourly_subjects`, keyed by UTC hour, service UUID, and subject UUID,
  solely for scoped active-user counts. It stores no profile label or request
  content and is never returned directly.
- `activity_projection_state`, a singleton leased rebuild cursor/outcome row
  with a one-hour schedule, 1,000-event batch, 30-second lease, version, and
  safe counts/codes.
- `dashboard_remediations`, stable finding key/category/scope/severity,
  first/last-seen time, current state, version, and optional acknowledged or
  dismissed actor/time/justification metadata. Finding keys are HMAC digests of
  type plus authorized durable UUIDs; they contain no secret or opaque value.

Activity rows retain 400 days, independently of audit settings in this
milestone. Cleanup is bounded to 1,000 buckets and their subject rows per
hourly run. Milestone 20 does not add another operator setting.

`service_request` durable runtime projections gain only safe scalar fields:
`credentialUseCount` and optional policy-rule label snapshot. The gateway
computes the distinct configured credential count after policy authorization
and substitution without storing credential IDs. The policy-rule label is
resolved from the immutable runtime snapshot; unmatched traffic is represented
as `boundary_default_allow` or `boundary_default_deny`. Raw target path and
host remain audit-only fields and are never activity dimensions.

The runtime audit insert and hourly aggregate upsert occur in the same worker
transaction. Aggregate dimensions are:

- service UUID plus event-time label;
- destination slug;
- uppercase method;
- endpoint category `policy_rule` plus safe rule UUID/label snapshot, or
  `boundary_default` plus the default outcome;
- decision `allow`, `deny`, or `error`;
- downstream status class `none`, `1xx`, `2xx`, `3xx`, `4xx`, or `5xx`.

The canonical UTC hour is `floor(occurred_at / 3_600_000) * 3_600_000`.
Unknown/invalid dimensions reject the projection before durable insertion.
Retries remain event-ID idempotent. A leased rebuild scans runtime audit
sequence order, derives only these dimensions, and uses a projection ledger
keyed by event ID so restart or overlap cannot double count. Historical events
without the new credential/rule-label fields use zero and stable ID/default
fallbacks.

## Query windows, reports, and privacy

Activity APIs accept one preset: `24h`, `7d`, `30d`, or `90d`; default is
`24h`. They accept an optional assigned service UUID and a limit of 1–100,
default 20. No arbitrary group-by, raw SQL, absolute multi-year range, rank
cursor, or user UUID filter is exposed.

Repository SQL begins with an `AS MATERIALIZED` authorized-service CTE. It
then returns:

- totals and allow/deny/error trend buckets;
- downstream status-class trend buckets;
- most-active services;
- most-active policy-defined endpoint categories;
- active-user counts;
- service-level credential-use counts;
- safe API-key activity totals from durable key activity.

Timeline buckets are hourly for 24h/7d and daily for 30d/90d. Missing buckets
are filled with zero by application code. Ranking is deterministic by count
descending then stable safe label/UUID. Service admins never receive a global
total or rank calculated before scope filtering.

Active-user counts are exact for superadmins. For service admins, nonzero
counts below three are returned as `{ value: null, suppressed: true,
threshold: 3 }`; zero is returned as zero. The API never returns the subjects
forming a count. Other service-operational totals are exact because their
dimensions identify already-visible assigned services rather than people.

Responses carry `generated_at`, window start/end, projection freshness, a
`partial` flag while rebuild is behind, and at most 100 rows per report.
Ordinary reads must finish within one second at the 10,000-event local fixture;
the intentionally broader 90-day report target is two seconds.

## Status snapshot

Status is computed from current durable tables and bounded aggregate
subqueries, not copied into an eventually consistent cache. Per authorized
service it includes:

- lifecycle and publication state;
- configured, unconfigured, disabled, and archived credential counts;
- active/expiring/expired `gref` and `sec` counts from the bounded in-process
  reference aggregate source when available, otherwise an explicit
  `unavailable` category rather than a zero;
- active OAuth grant count;
- active/expiring/expired service API-key counts;
- pending remediation count.

Superadmin system status additionally includes:

- database access and supported schema version;
- vault `ready`, `unavailable`, or `unsupported`;
- audit persistence `ready` or `unavailable`;
- identity/config activation readiness;
- inactivity, audit maintenance, and activity projection job state;
- SQLite audit capacity estimates and retention warnings;
- active/expiring/expired all-services and system API-key counts;
- suspended/deactivated/pending-enrollment/zero-service ordinary-user counts.

Component adapters accept only stable enums, timestamps, counts, and safe
codes. No filesystem path, exception text, socket address, key ID, user
profile, or downstream response is returned. A component without a configured
adapter reports `unavailable`, never guessed `ready`.

## Security signals and remediations

Security signal queries derive bounded counts and latest occurrence from
administrative/runtime audit categories plus current state:

- repeated login, TOTP, API, and rate-limit failures;
- break-glass use and last-superadmin protection;
- self-API-key blocks/approved use;
- global password/TOTP events;
- suspension/deactivation;
- stale, never-used, unexpectedly active, and non-expiring API keys;
- missing credentials;
- vault/audit/database/job degradation;
- pending enrollment and active ordinary users with zero services.

The signal catalog is closed, with stable code, severity
`info|warning|critical`, count, first/last occurrence, authorized service
context when applicable, and safe remediation link. It returns no audit
snippet, raw actor/target identifier, profile, query text, or failure message.
Service admins receive only service-bound signals for assigned services;
global identity/component/key signals are superadmin-only.

Actionable current-state findings create or refresh a remediation row.
Resolved conditions mark the row resolved; historical signal counts remain.
Superadmins may acknowledge or dismiss global findings. Service admins may do
so only for assigned-service findings. Both actions require `If-Match`,
justification, browser CSRF, configured human step-up, and an atomic
administrative audit. Dismissal hides a finding until its condition generation
changes; acknowledgement does not hide it. Dashboards never change the source
security, retention, credential, key, or lifecycle setting.

## APIs and permissions

Add browser-only, no-store routes:

- `GET /api/v2/dashboard/activity`;
- `GET /api/v2/dashboard/status`;
- `GET /api/v2/dashboard/security`;
- `GET /api/v2/dashboard/remediations`;
- `PATCH /api/v2/dashboard/remediations/:remediation_id`;
- `POST /api/v2/dashboard/activity/rebuild`.

Add capabilities `view_activity_dashboard`, `view_status_dashboard`,
`view_security_dashboard`, and `manage_dashboard_remediations`. Human
superadmins receive all. Human admins receive assigned-service view/manage
outcomes. Users and API roles are denied. Manual activity rebuild is
superadmin-only, uses an exact operation-bound proof and acknowledgement
`REBUILD ACTIVITY AGGREGATES`, and does not accept a service or time override.

All query/body/parameter schemas are strict. Unknown fields, invalid presets,
limit 0/101, invalid UUIDs, newline/control-character justifications, stale
versions, cross-scope remediation IDs, missing proof, and non-browser
authentication receive stable generic errors before mutation or privileged
detail lookup.

## Browser UX

Replace Overview, Activity, and the operator portion of Security placeholders
and add a Status route. Navigation uses the new capabilities:

- Overview presents concise status, latest activity trend, and top unresolved
  findings with authorized drill-down links.
- Activity uses wide-screen trend panels and ranked service/endpoint tables,
  bounded preset/service filters, suppression labels, loading/empty/error
  states, and no raw-path display.
- Status uses responsive service cards/tables plus superadmin component/job
  health and capacity panels.
- Security uses severity-ordered signals and remediations; acknowledge/dismiss
  dialogs identify the exact safe finding and retain non-secret form values on
  failure while clearing password/TOTP.

At narrow widths, cards stack and tables preserve name, state, count, and
action. Charts are accessible HTML/SVG with text summaries and do not use
third-party telemetry. Dashboard state is not persisted to local/session
storage.

## Minimal delivery slices

1. Migration 0020, closed aggregate/remediation schemas, runtime safe-count
   projection, atomic event+aggregate writes, cleanup/rebuild state, and
   positive/negative dimension tests.
2. Leased idempotent rebuild/retention job, delayed-projection freshness,
   restart/overlap recovery, boundary-default categorization, and high-volume
   cardinality tests.
3. Scope-first activity repository, fixed windows/reports, privacy
   suppression, API-key activity integration, query bounds, and 10k-event
   performance fixture.
4. Role-scoped current status repository and sanitized database/vault/audit/
   job/reference adapters with unavailable/degraded negative tests.
5. Closed security-signal catalog, remediation reconciliation and guarded
   acknowledgement/dismissal transactions with audit and scope tests.
6. Strict dashboard APIs, permission matrix/OpenAPI, malformed/unauthorized/
   cross-scope tests, and production wiring.
7. Responsive Overview/Activity/Status/Security workspaces, safe drill-downs,
   narrow/wide accessibility tests, and production browser build.
8. Operator/privacy documentation, production builds, OpenAPI currency, full
   regression, acceptance review, and milestone status.

Every slice adds positive and negative tests, runs the full regression suite,
and receives one concise commit. Findings that matter beyond this milestone
are added to `AGENTS.md`.

## Acceptance matrix

- Projection: every closed dimension and status class, policy-rule/default
  categories, exact hour boundary, atomic audit+aggregate visibility,
  credential safe counts, retry/rebuild idempotence, and cleanup boundary.
- Privacy: prohibited field/value ingestion, no raw path/query/header/body or
  opaque values in aggregates/APIs/UI, service-admin suppression below three,
  and no cross-scope global rank/count inference.
- Reports: empty/single/high-volume data, every preset, zero-filled trends,
  deterministic ranking, limits 1/100/101, freshness/partial state, and
  first-page targets.
- Status: every credential/key/service lifecycle state, grant/reference
  counts, unavailable reference source, schema/jobs/health/capacity warnings,
  expiry cutoffs, and exact role scope.
- Security: every closed signal, count/latest time, service/global scope,
  remediation creation/resolution/generation, stale/cross-scope mutation,
  acknowledgement/dismissal audit, and secret-free responses.
- UX: role-aware navigation, wide/narrow content, filters, suppression,
  loading/empty/error, accessible trends, exact-target remediation dialogs,
  safe links, and sensitive-field clearing.
- Integration: seeded runtime/admin/key/current state produces matching scoped
  reports; degraded adapters remain sanitized; production builds, current
  OpenAPI, performance fixtures, and full regression pass.

