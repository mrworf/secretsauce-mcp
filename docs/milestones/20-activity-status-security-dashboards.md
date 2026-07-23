# Milestone 20: Activity, Status, And Security Dashboards

## Purpose and why

Give operators actionable visibility into service use, authorization outcomes, security signals, and component health without exposing request content, secret values, or unauthorized users.

## Dependencies

- Milestones 13–19.

## PRD traceability

- Sections 18.2 and 24: references, activity, reports, status, and security dashboard.
- Sections 21.3–21.4 and 33: responsive UX/navigation.
- Sections 25, 31, 32.3, and 35: query bounds, privacy, health, and performance.

## Scope

- Add bounded activity aggregation by service, destination, method, matched policy rule/default, allow/deny, and downstream status class.
- Use policy-defined endpoint categories; unmatched traffic belongs to the boundary default rather than storing raw high-cardinality paths.
- Add reports for active services/endpoints, allow/deny trends, status trends, scoped active-user counts, credential-use counts, and API-key activity.
- Add role-scoped status views for service/credential state, active `gref`/`sec` counts, grants, API keys, schema/jobs, database/vault/audit health, disk/retention warnings, and remediation tasks.
- Add security signals for authentication/API failures, rate limits, break glass, self-key defenses, global events, lifecycle changes, stale/non-expiring keys, missing credentials, degraded components, pending enrollment, zero-service users, and last-superadmin protections.
- Implement responsive, wide-screen-efficient overview/status/activity/security UX with bounded filters and safe drill-down links.

## Not in scope

- Raw path/query/header/body analytics, full references, credentials, API-key values, OAuth tokens, or downstream bodies.
- A general metrics/observability platform, distributed time-series database, or enterprise alerting service.
- Changing audit retention or security policies from dashboard widgets.

## Required behavior and interfaces

- Aggregates are updated/rebuilt according to the approved bounded design and never require prohibited raw event fields.
- Viewer scope filters services, users, credentials, grants, keys, and drill-down links before aggregation output.
- Health/readiness detail uses stable sanitized categories and no paths/internal errors.
- Status distinguishes configured/unconfigured/disabled/archived credentials and active/expiring/expired safe counts.
- Activity queries meet PRD response targets at design scale.

## Security, authorization, invalidation, and audit

- Admins see only assigned-service metrics and related user counts; superadmins see system-wide data; ordinary users do not receive operator dashboards.
- Low-cardinality aggregation and suppression rules prevent unauthorized inference from tiny groups where required by the approved UX/privacy design.
- Dashboard responses and client telemetry contain no raw identifiers outside viewer scope.
- Administrative acknowledgement/dismissal of remediation warnings is audited.

## Tests

- Positive: every aggregation dimension/report, role-scoped status, component health, remediation items, security signals, drill-down authorization, and responsive layouts.
- Negative: raw path/query/body ingestion, cross-service/user inference, full token/reference/key fields, unauthorized dashboard access, malformed/expensive filters, and degraded component detail leakage.
- Boundary: empty data, high event volume/cardinality, status transitions, expiry cutoffs, unknown policy default categories, and delayed/rebuilt aggregates.
- Integration: seeded activity/audit/runtime data produces correct scoped totals and meets first-page performance targets.

## Acceptance criteria

- Operators can identify active services/endpoints and important security/health conditions without secret or privacy leakage.
- Endpoint activity is categorized by policy rules/defaults, never generic raw paths.
- Status includes all PRD-required safe counts, health, warnings, and remediation state.
- Responsive dashboards remain useful at wide and narrow supported viewports.

## Planning handoff

Specify aggregate tables/windows/retention, update/rebuild jobs, safe dimensions, scope-aware SQL, privacy suppression if needed, health adapters, remediation model, query bounds/caching, charts/tables, and performance/E2E fixtures.
