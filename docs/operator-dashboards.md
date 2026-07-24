# Operator dashboards

Database mode provides browser-only Overview, Activity, Status, and Security
workspaces under `/control`. They are operational views over bounded,
low-cardinality projections; they are not a general metrics system and do not
replace host monitoring.

## Scope and access

- Superadmins see every service plus system component, job, capacity, identity,
  and global security state.
- Service admins see only currently assigned services and service-bound
  signals. Scope is applied before totals, rankings, and active-user counts are
  calculated.
- Ordinary users and every API-key role are denied the operator dashboard
  APIs. Ordinary users retain their personal overview and Security workspace.
- All dashboard responses are `no-store`. Browser dashboard state is not
  written to local or session storage.

Removing a service-admin assignment takes effect on the next request. A prior
rank, total, link, or remediation identifier does not grant continued access.

## Activity and privacy

Activity is aggregated into UTC hourly rows and retained for 400 days. Reports
offer fixed `24h`, `7d`, `30d`, and `90d` windows and an optional authorized
service filter. The 24-hour and 7-day trends use hourly buckets; longer windows
use daily buckets.

The projection stores only service, destination slug, uppercase method,
authorization outcome, downstream status class, safe credential-use and
tokenization counts, and an endpoint category. An endpoint category is a
policy-rule label/identifier or the stable boundary default. Raw paths,
queries, headers, bodies, credentials, tokens, opaque references, and
downstream content are never activity dimensions.

Superadmin active-user counts are exact. A service admin's nonzero count below
three is displayed as `Fewer than 3`; the API does not return the contributing
subjects. Zero remains zero. This suppression prevents tiny-group identity
inference, but it is not differential privacy and should not be represented as
such.

The hourly projection is written atomically with accepted runtime audit
events. A leased maintenance run can rebuild missed rows in bounded,
event-id-idempotent batches. `partial: true` means the rebuild cursor is behind
the runtime audit source; the browser marks the displayed totals accordingly.
The superadmin-only rebuild endpoint requires the exact
`REBUILD ACTIVITY AGGREGATES` acknowledgement, justification, browser CSRF, and
operation-bound password/TOTP step-up. It accepts no caller-selected service or
time range.

## Status interpretation

Service status distinguishes configured, unconfigured, disabled, and archived
credentials; active, expiring, and expired API keys; active grants; safe
gateway/secret reference counts; and unresolved remediations. If the
in-process reference source is absent or fails validation, the state is
`unavailable`, not a guessed zero.

Superadmin status also reports stable component categories, background-job
state, audit row/storage estimates, API-key posture, and lifecycle counts.
`unavailable`, `unsupported`, and `degraded` values never include exception
text, filesystem paths, socket addresses, or downstream response details.
Audit storage is an estimate of SQLite table/index pages, not host free space.
Continue to monitor the host filesystem, SQLite/WAL storage, process health,
and the public endpoint independently.

## Security findings and remediation

The Security dashboard uses a closed catalog derived from current durable
state and allowlisted audit categories. It covers authentication and API-key
failures, rate limits, break-glass use, self-key defenses, global authenticator
events, identity lifecycle changes, last-superadmin protection, stale,
never-used, non-expiring, or unexpectedly active keys, missing credentials,
component/job degradation, pending enrollment, and active users with no
services.

Current actionable conditions have durable remediation records. A service
admin may act only on findings for an assigned service; a superadmin may also
act on global findings. Acknowledgement leaves the condition visible.
Dismissal hides the current generation until it resolves and later recurs.
Neither action changes the source credential, key, user, service, security
policy, or retention setting.

Acknowledgement and dismissal require the current finding version,
justification, browser CSRF, and exact-operation password/TOTP step-up. The
administrative audit records the safe finding code, state transition,
generation, actor, and justification. Passwords and authenticator codes are
cleared from the browser after failure; non-secret justification is retained
for correction and retry.

## Troubleshooting

- `partial` activity: allow the hourly activity job to catch up or use the
  guarded rebuild operation after investigating persistence health.
- `unavailable` references: verify the runtime reference aggregate adapter is
  connected; do not interpret the counts as zero.
- degraded jobs: inspect sanitized job outcome codes and the administrative
  audit, then check durable SQLite/WAL capacity and the relevant worker.
- unavailable vault or identity: use the component's separate sanitized
  readiness check. Error bodies and local paths are deliberately not returned
  by dashboard APIs.
- persistent missing-credential or key findings: correct the source object in
  its dedicated management workspace. Dashboard acknowledgement is not a fix.

