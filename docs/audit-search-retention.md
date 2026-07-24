# Audit search and retention

Database mode stores administrative and runtime audit evidence in separate
immutable tables and FTS indexes. Administrative events describe control-plane
and security changes. Runtime events use a narrower projection for MCP
authorization and downstream outcomes. Search, browser views, and NDJSON
exports all use the same allowlisted projections.

The gateway does not index request or response bodies, headers, cookies,
credential values, access tokens, or opaque gateway references. Central
validation rejects prohibited names and recognizable values before persistence.
This remains best-effort exact and pattern defense: invertible downstream
encodings or reflections can evade pattern scanning, so operators must still
constrain credential placement and downstream response egress.

## Authorization and API behavior

- Superadmins can search both domains across all services.
- Service admins can search only events carrying a service currently assigned
  to them. Every page and export re-evaluates that current scope.
- Ordinary users receive only the reduced security history on their Security
  page. They cannot open either operator explorer.
- Search is literal-token FTS with at most 16 tokens and 256 Unicode code
  points. It exposes no rank, snippet, vocabulary, or unscoped count.
- Time filtering is inclusive. The API accepts canonical millisecond UTC
  timestamps; the browser converts local values using the selected IANA zone
  and makes repeated-time offset selection explicit.
- Exports are newline-delimited JSON capped at 10,000 rows and 5 MiB. They are
  not backups and are never written as server-side artifacts.

## Retention and maintenance

Both domains default to 400 days. A superadmin can configure each independently
from 1 through 3,650 days, or choose unlimited. Longer and unlimited values
produce capacity-planning warnings. The reported byte value is a SQLite
table/index estimate, not filesystem free space.

Retention updates require a strong `If-Match`, exact acknowledgement, human
step-up, and justification. Manual maintenance requires a proof bound to that
exact operation. Automatic maintenance runs at most hourly. Each run deletes
at most 1,000 expired rows per domain and repairs at most 1,000 missing FTS
rows; an event and its FTS row change in one transaction.

Monitor the retention response and administrative audit history for:

- `retention_above_default`;
- `unlimited_retention_requires_capacity_planning`;
- `audit_storage_above_planning_threshold`;
- maintenance outcomes `partial` or `error`.

The planning threshold is 1 GiB of estimated audit table/index pages. Ensure
the SQLite database and its WAL have durable writable storage and sufficient
host capacity. Audit history is deliberately excluded from configuration
backup and restore.

## Performance target

The local SQLite acceptance fixture seeds 10,000 administrative event/index
rows and requires a scoped first FTS page to complete within 1 second. This is
a regression target for the supported single-instance deployment, not a
latency guarantee for arbitrary disks, concurrent load, or unbounded history.

