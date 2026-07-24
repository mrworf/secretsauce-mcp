# Milestone 20 acceptance review

## Outcome

Milestone 20 is accepted. Database mode now provides bounded hourly activity,
scope-first reports, sanitized service/system status, a closed security-signal
catalog with durable guarded remediations, strict browser-only APIs, and
responsive operator workspaces.

## Evidence

- Migration 0020 adds low-cardinality hourly activity and subject tables,
  event-id projection ledger/state, and durable HMAC-keyed remediation rows.
- Runtime audit and activity projection commit together. Projection validation
  rejects prohibited request content and unknown dimensions before insertion;
  retries and leased rebuilds remain event-ID idempotent.
- Reports expose only fixed windows, authorized service filtering, zero-filled
  outcome/status trends, deterministic service and policy-category rankings,
  safe credential/tokenization/API-key counts, freshness, and privacy-suppressed
  service-admin active-user counts.
- Status begins with authorized services and distinguishes every credential,
  key, grant, reference, lifecycle, job, health, capacity, and remediation
  state required by the milestone. Missing adapters return stable unavailable
  categories without internal detail.
- Security signals cover authentication/TOTP/API-key failures, rate limits,
  break glass, blocked/approved self-key use, global authenticator events,
  identity lifecycle and last-superadmin protection, stale/never-used/
  non-expiring/unexpected keys, missing credentials, degraded components/jobs,
  pending enrollment, and zero-service active users.
- Remediation acknowledgement/dismissal requires current scope/version,
  justification, CSRF, and exact operation-bound human step-up, then commits
  the transition and sanitized administrative audit atomically.
- Six no-store browser-only control operations use strict schemas, bounded
  search limits, the dashboard capability matrix, and deny ordinary users and
  all API-key roles.
- Overview, Activity, Status, and Security render responsive cards/tables,
  accessible trend summaries, bounded filters, explicit suppression and
  degraded states, safe drill-down links, and secret-clearing remediation
  dialogs.
- Operator guidance documents scope, retention, privacy limits, rebuilds,
  status interpretation, remediation semantics, and troubleshooting.

## Verification

- Production TypeScript and Vite build: passed.
- Activity projection/rebuild/report, status, security/remediation, route,
  permission, scope/privacy, performance, and browser tests: passed.
- Control OpenAPI currency check: passed.
- Full privileged regression: 111 files and 804 tests passed.

## Delivery commits

- `3e3e963` — decision-complete milestone plan
- `3566c3a` — durable hourly activity projection
- `2c8efd4` — bounded idempotent rebuild and retention
- `fafc993` — scope-first reports and privacy suppression
- `7b9107f` — sanitized scoped status
- `46df860` — security findings and remediations
- `61497b8` — strict dashboard control APIs
- `7fa0fd8` — responsive operator workspaces
- `007cebb` — completed closed security catalog

## Residual boundaries

- Activity aggregates deliberately omit raw request content and cannot answer
  arbitrary path, query, header, body, or user-level analytics.
- Service-admin active-user suppression is a small-group control, not
  differential privacy. Superadmins receive exact system-wide counts.
- Dashboard health is a sanitized application view, not host or network
  observability. SQLite capacity is an estimate rather than free disk space.
- Historical security signals depend on retained allowlisted audit evidence.
  Current-state remediations continue independently of older audit retention.
- Activity and maintenance remain single-writer, single-instance facilities
  under the supported deployment topology.

