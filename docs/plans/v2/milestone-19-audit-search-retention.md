# Milestone 19 Audit Search And Retention Plan

## Outcome and boundary

Milestone 19 makes administrative/security evidence and MCP/runtime evidence
durable, independently searchable, independently retained, and visible only
through current authorization scope. The two domains keep distinct immutable
schemas and APIs. Search and export expose the same allowlisted projections;
neither can return a hidden field, count, snippet, raw request, header, body,
cookie, token, credential, opaque gateway reference, or downstream response.

Database mode is authoritative for searchable audit history. The existing
bounded memory/optional JSONL runtime sink remains available in YAML-only mode
and as an operator-local diagnostic output, but it is not presented as durable
searchable history. This milestone does not add activity aggregates, backup or
restore of audit history, SIEM delivery, arbitrary query syntax, or distributed
retention coordination.

## Immutable event schemas

Migration 0019 adds an integer `sequence` key to each domain for stable
pagination while retaining public UUIDv7 event IDs.

`administrative_audit_events` remains the control-plane source of truth and is
extended with:

- `category`: `authentication`, `authorization`, `identity`, `service`,
  `credential`, `policy`, `security`, `system`, `audit`, or `other`;
- event-time `actor_label`, optional UUID `actor_id`, actor type/role/auth
  method, action, result, event-time target type/label and optional UUID
  `target_id`;
- optional event-time service UUID and label;
- required or nullable safe justification according to the producer contract;
- sanitized field changes, correlation ID, safe source/client metadata, and
  bounded failure code;
- no foreign key from actor, target, or service snapshots to live domain rows.

Existing administrative rows are backfilled deterministically. Missing labels
become stable intelligible fallbacks such as `deleted-user:<uuid>` and
`deleted-service:<uuid>` rather than being joined to mutable current names.
The application builder snapshots labels at event creation and validates UUID
fields without requiring the referenced object to remain live.

`runtime_audit_events` stores a deliberately narrower projection:

- sequence, UUIDv7 event ID, UTC event time, event type, outcome, category;
- actor type plus optional subject UUID and event-time subject label;
- optional service UUID and event-time service label, destination name,
  action/tool, HTTP method, target host and canonical path;
- optional downstream status, safe policy rule/reason/failure code,
  correlation/request UUID, safe source/client metadata, duration, TLS
  verification, tokenization count, warning counts, and bounded allowlisted
  detail values.

The runtime projection never stores access IDs, internal reference IDs, full
`gref_`/`sec_` values, API-key values, credential values, Authorization or
Cookie values, request/response headers or bodies, downstream response
content, error messages, or producer-owned unknown fields. Nickname and
last-four metadata may be stored only in the named self-key event fields after
central validation; they are not credential values.

Rows are append-only. Database triggers reject UPDATE in both domains.
Retention is the only ordinary DELETE path and runs through a private
repository transaction. User/service deletion does not delete audit rows or
rewrite their content.

## Producer and central sink contract

Administrative producers continue to use `buildAdministrativeAuditEvent` and
the existing `withAdministrativeAudit` transaction helpers. The builder gains
strict category, label, service snapshot, correlation, change, and source
validation. Success audits remain in the same SQLite transaction as the
mutation and therefore fail closed. Route-registry failure/denial producers
append a separate safe event after the failed mutation, as today.

Runtime producers continue to call the synchronous `AuditSink.record` API so
the MCP authorization and downstream order does not change. In database mode
the sink additionally builds a strict durable projection and enqueues it on
one bounded, ordered writer:

- sanitization and schema validation happen synchronously before enqueue;
- at most 1,024 projections may be pending; saturation marks audit readiness
  degraded and rejects further runtime work before a downstream call;
- each accepted event receives a UUID/time at production and is inserted with
  its FTS document in one worker transaction;
- `flush()` is awaited during graceful shutdown and by integration tests;
- insertion failure marks readiness degraded and prevents new downstream
  calls until a successful health probe/flush restores it;
- already completed downstream requests are not falsely reported as rolled
  back, and no retry duplicates an event because event IDs are unique.

Database-mode gateway startup attaches the writer before accepting MCP
traffic. Event-time user/service labels are resolved from the current runtime
snapshot when available, otherwise use stable UUID-derived fallback labels.
The durable sink never receives vault material and cannot be configured by a
producer to add arbitrary fields.

Central validation is defense in depth:

- strict schemas reject unknown fields, unsafe names, noncanonical UUIDs,
  control characters, invalid enums, excessive arrays/strings/numbers, and
  recursive/unbounded objects;
- the existing credential/reference/pattern sanitizer runs before projection;
- a prohibited-name/value scanner rejects any residual header/cookie/body,
  token, password, secret, credential, verifier, opaque-reference, or
  authorization-shaped material instead of indexing it;
- database insert methods accept only validated event objects and derive the
  canonical search document themselves.

No raw event or downstream body is logged when validation or persistence
fails.

## Canonical FTS documents

Migration 0019 creates one contentless FTS5 table per domain:

- `administrative_audit_fts(event_id UNINDEXED, document)`;
- `runtime_audit_fts(event_id UNINDEXED, document)`.

Every insert transaction constructs one canonical document from an explicit
allowlist in fixed field order. Values are normalized to Unicode NFKC,
lowercase, whitespace-separated text with control characters removed. Arrays
are sorted only where semantically unordered; change entries retain producer
order. Administrative search includes every exposed field except occurrence
time. Runtime search includes every exposed field except occurrence time and
numeric duration/count metrics. UUIDs, labels, action/outcome/category,
service, safe changes/reasons, correlation, source, and safe codes are
searchable.

The document is never accepted from a route or producer. Insert and FTS insert
share one transaction. Retention deletes the matching FTS row and event row in
one transaction. Startup verifies row-count/event-ID parity and a bounded
maintenance job repairs only missing/stale index rows from immutable event
columns; it never rewrites event content. Index repairs and retention runs emit
administrative audit summaries without embedding matched content.

FTS input is a literal token query, not raw FTS syntax. The API accepts 1–256
Unicode code points, normalizes it, rejects control characters and more than
16 tokens, quotes each token, and combines tokens with `AND`. Wildcards,
column selectors, boolean operators, proximity syntax, and malformed quote
syntax are treated as literals or rejected before SQLite sees them. No snippet,
highlight, vocabulary, match-count, or query-plan API is exposed.

## Scope-first query strategy

Search repositories accept a precomputed viewer scope, never a caller-supplied
role:

- superadmins may search both domains across all services;
- service admins may search rows whose event-time `service_id` is currently in
  `service_admins` for that actor; administrative events about an ordinary
  user are also visible only when their stored service context is assigned;
- ordinary users have no administrative/runtime explorer permission. A
  separate self-security endpoint returns only their own allowlisted
  authentication, security, session, grant, and access events where their UUID
  is the actor or target;
- service/all-services/system API identities are denied browser explorers and
  exports.

The SQL builds an `AS MATERIALIZED` authorized-events CTE using the
authenticated actor UUID and current service-admin relation before joining
FTS and applying pagination. There are no unscoped preliminary counts,
facets, ranks, or snippets. Result ordering is `occurred_at DESC, sequence
DESC`; FTS affects membership, not ordering, so pagination is deterministic
and does not leak cross-scope rank. The first page and every cursor page rerun
current scope, so revoked administration takes effect immediately.

Add capabilities `view_administrative_audit`, `view_runtime_audit`,
`export_audit`, and `manage_audit_retention`. Only superadmins may manage
retention. Audit viewing/export for admins uses `assigned_services`; ordinary
self history stays under authenticated self scope rather than an explorer
capability.

## Search, time, pagination, and export APIs

Add browser-authenticated, no-store routes:

- `GET /api/v2/audits/administrative`;
- `GET /api/v2/audits/runtime`;
- `GET /api/v2/audits/self-security`;
- `POST /api/v2/audits/administrative/export`;
- `POST /api/v2/audits/runtime/export`;
- `GET|PATCH /api/v2/audits/retention`;
- `POST /api/v2/audits/retention/run`;
- `GET /api/v2/audits/maintenance`.

Search accepts strict filters: `q`, domain-specific action/type, outcome,
category, service UUID, actor/subject UUID, preset, absolute `start_utc`,
absolute `end_utc`, limit, and signed cursor. Limit defaults to 50 and is
1–100. Presets are `24h`, `7d`, `30d`, `90d`, and `year`; each computes
`[now-duration, now]` once per request. Absolute endpoints must be canonical
RFC 3339 UTC with `Z`, millisecond precision, safe epoch conversion, start not
after end, and a maximum 400-year span. Preset and absolute bounds are
mutually exclusive. SQL uses inclusive `>= start` and `<= end`.

The browser converts `datetime-local` values plus the selected IANA display
timezone to UTC before submission and renders every result with the chosen
zone and explicit abbreviation/offset. The API never interprets a local time
or timezone. Browser zone validation uses `Intl.DateTimeFormat`; invalid or
DST-nonexistent local values are rejected, and ambiguous values require the
explicit earlier/later offset choice.

`ControlCursorCodec` binds route, authenticated principal, a digest of current
scope, domain, sort, and all normalized filters. Its last key is
`<occurred_at>:<sequence>`. Scope/filter/route changes, expiry, tampering, and
noncanonical base64url fail generically.

Export accepts the same filter object but no cursor. It produces UTF-8 NDJSON
from the same repository projection, one canonical JSON object per line, in
timeline order. It is capped at 10,000 events and 5 MiB; an over-limit export
fails with a generic bounded-result error rather than truncating silently.
The JSON API returns a one-use downloadable blob response from the browser;
the server sets safe attachment metadata and never creates a backup artifact.
Export authorization and audit commit before content is returned. The export
audit stores domain, normalized filter names, time bounds, and row/byte counts,
not the query text or event content.

## Retention and maintenance

`audit_retention_settings` contains separate administrative and runtime
retention values. Each is either an integer 1–3,650 days or `NULL` for
unlimited, defaults to 400 days, and has optimistic version/timestamps.
Updates are superadmin browser-only, require configured human step-up,
justification, `If-Match`, and exact acknowledgement
`I ACCEPT AUDIT RETENTION CHANGES`.

The settings response reports each domain's row count, oldest/newest event
time, SQLite event/index byte estimate, and warning codes. Values above 400
days emit `retention_above_default`; unlimited emits
`unlimited_retention_requires_capacity_planning`; a database audit footprint
above the documented 1 GiB planning threshold emits
`audit_storage_above_planning_threshold`. These are capacity-planning
warnings, not claims about filesystem free space.

`audit_maintenance_state` holds one leased job row with next run, lease
owner/expiry, per-domain cursors, parity state, counts, safe outcome/code, and
version. The single-instance maintenance runner executes at most hourly,
processes at most 1,000 expired rows per domain and 1,000 index repairs per
run, and stops after 30 seconds. Cutoffs are exact:
`occurred_at <= now - days*86_400_000`; unlimited skips deletion. Each deletion
batch and its FTS cleanup are atomic. Index repair derives documents from
immutable rows. A safe administrative summary is appended after state/results
commit without recursive indexing content.

Manual execution uses the same lease, exact step-up, idempotency, and
acknowledgement. Concurrent runners either acquire the lease or return the
current state; expiration makes restart retry safe.

## Browser UX

Replace the MCP audit and Admin audit placeholders with responsive explorers.
Superadmins see both; service admins see both with an explicit assigned-service
scope banner; ordinary users do not see either navigation item.

Each explorer provides bounded search, domain filters, relative presets,
absolute UTC controls, display-timezone selection, accessible result cards/
tables, deterministic next-page controls, empty/error/loading states, and an
authorized export action. No snippet HTML is rendered. Labels are event-time
snapshots and deleted actors/targets remain visibly marked by fallback label.

The Security/access area gives every human user a compact own-security
timeline using the reduced endpoint. Superadmins additionally receive
retention controls, capacity warnings, last/next job state, and the guarded
manual-run action. Search/filter state may remain after an error, but no
step-up password, TOTP code, export content, or audit event content is stored
in local/session storage.

## Minimal delivery slices

1. Migration 0019, immutable domain tables/extensions, central schemas,
   canonical documents, transactional FTS insert/delete/parity, and
   producer/sink secret-fuzz tests.
2. Durable ordered runtime audit writer, runtime projection/label snapshots,
   startup/readiness/shutdown integration, saturation/failure behavior, and
   positive/negative MCP event tests.
3. Scope-first repositories, permission rows, literal search grammar,
   inclusive time filters, signed pagination, self-security projection, and
   authorization/performance tests.
4. Strict search/self APIs with all presets, absolute UTC contracts,
   role/service enforcement, malformed/expensive input tests, and OpenAPI.
5. Permission-checked bounded NDJSON export using the same projection/scope,
   exact limit behavior, export auditing, and sanitized-output tests.
6. Independent retention settings, leased batch cleanup and FTS maintenance,
   capacity statistics/warnings, guarded APIs, and cutoff/concurrency/restart
   tests.
7. Responsive administrative/runtime explorers, own-security timeline,
   timezone/DST handling, export download, retention UX, navigation/accessibility
   tests, and production browser build.
8. Operator/privacy documentation, target-volume performance fixture,
   production builds, OpenAPI currency, full regression, acceptance review,
   and milestone status.

Each slice gets positive and negative tests, a full-suite regression, and one
concise commit. New routes, query fields, bodies, cursor forms, event fields,
and settings receive invalid, unknown, oversized, wrong-role, stale, and
cross-scope coverage.

## Acceptance matrix

- Domains: both schemas, immutable snapshots, deleted actor/target/service,
  admin success atomicity, denied/failed events, and distinct retention.
- Secret defense: every prohibited name/value at producer and sink, common
  token/reference/header/cookie/body encodings, sanitizer failure, no raw
  diagnostic/log/DB/FTS/API/UI/export exposure.
- FTS: every allowed textual field, excluded timestamp/numeric-only fields,
  transactional visibility, no snippet/count leakage, literal grammar,
  Unicode normalization, index parity/repair, and concurrent insertion.
- Scope: superadmin all, admin assigned only, revoked scope on cursor reuse,
  cross-service query/filter/export denial, ordinary self-only reduced
  history, and denial to non-browser API roles.
- Time/page: every preset, exact inclusive endpoints, invalid/reversed/
  excessive ranges, 1/100/101 limits, deterministic equal-time pagination,
  cursor tamper/expiry/filter/scope binding, UTC API and DST display behavior.
- Export: same rows/fields/order as search, 10,000/5 MiB boundaries, no
  truncation, safe attachment, authorization before generation, and
  content-free export audit.
- Retention: default/exact 400-day cutoff, 1/3,650/unlimited, separate domain
  settings, warning codes/stats, batch continuation, lease retry, event+FTS
  deletion, immutable survivor content, and audited maintenance.
- Performance/integration: first page within the documented local SQLite
  target at representative volume, bounded memory/query plans, restart/flush,
  production builds, current OpenAPI, and full regression.
