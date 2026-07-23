# Milestone 01 Implementation Plan

Status: approved for implementation.

This plan implements only `docs/milestones/01-persistence-audit-foundation.md`.
Audit FTS/search, retention, activity aggregation, product-domain tables, control
HTTP routes, and v1 import remain deferred to their named later milestones.

## Slice 1: schema and migration foundation

Outcome: an optional `persistence.database_file` configuration selects a durable
SQLite database, and the approved driver opens it with restrictive permissions,
validates mandatory pragmas, and applies schema `0001` transactionally.

Schema `0001` contains only:

- `schema_migrations`, with immutable version/name/checksum/application metadata.
- `administrative_audit_events`, with denormalized actor/target snapshots,
  allowlisted safe fields, optimistic-independent immutable event rows, and
  bounded indexes.

The migration runner accepts an internal ordered migration registry. It rejects
gaps, duplicate/non-positive versions, checksum drift, partial history, and
unknown-future versions with stable sanitized error codes. Failed migrations roll
back. Tests use one real temporary database per case and injected internal test
migrations; no production fixture table is added.

External-input coverage:

- Positive: omitted persistence configuration and a valid non-empty database path.
- Negative: empty/NUL paths, unknown configuration fields, and `:memory:` in
  deployment configuration.

Focused tests: `test/config.test.ts` and `test/persistence-migrations.test.ts`.

Commit: `Add persistence migration foundation`.

## Slice 2: exclusive owner, readiness, and lifecycle

Outcome: one `PersistenceWorker` serializes commands and owns the sole application
connection. A separate SQLite ownership-lock file holds an exclusive transaction
for the worker lifetime, so another process/worker fails while crash cleanup is
handled by SQLite rather than a stale PID file.

The worker exposes sanitized readiness:

```text
database: ready | unavailable
schema: ready | unsupported
administrative_audit: ready | unavailable
```

It opens after configuration/key validation and closes idempotently before other
runtime resources finish shutdown. When persistence is not configured, the v1
gateway remains unchanged. When configured, `/health` includes only stable check
states and returns `503` for persistence degradation; no path, SQL, or raw driver
error appears.

Coverage includes two concurrent owners, locked/misconfigured databases, restart
persistence, partial initialization cleanup, queue serialization, idempotent
close, and health transition sanitization.

Focused tests: `test/persistence-worker.test.ts` and `test/server.test.ts`.

Commit: `Own persistence lifecycle`.

## Slice 3: audited unit of work and shared primitives

Outcome: internal repositories receive an explicit transaction context. An
audited mutation can commit only after a valid administrative audit event is
inserted in the same transaction. Failed/denied sensitive actions have a
standalone safe append path. Audit insertion failure rolls back the mutation.

The audit builder uses a closed Zod contract with byte/count bounds and
denormalized actor/target snapshots. It rejects unknown or prohibited
secret-bearing field names before SQL. Caller-controlled safe text passes through
the existing gateway-owned exact/pattern audit sanitizer. Persistence errors map
to stable codes and never contain SQL, paths, values, or downstream driver bodies.

Shared helpers provide injectable UTC millisecond time, RFC 9562 UUIDv7 generation,
and an optimistic update primitive that increments a positive version and returns
a stale-version result when the expected version does not match.

Coverage includes mutation+audit commit, missing audit rejection, injected audit
write rollback, denied/failed append, restart persistence, maximum accepted audit
field sizes, limit-plus-one rejection, foreign-key enforcement, UUID ordering,
and optimistic version success/staleness.

Focused tests: `test/persistence-audit.test.ts`.

Commit: `Add transactional administrative audit`.

## Gates and handoff

Every slice runs its focused tests, `npm run build`, and the unchanged `npm test`
suite before commit. A loopback `EPERM` reruns the same full suite with network
permission. The milestone is complete only when all three slices are committed,
the current database restarts cleanly, every required negative case is proven,
and `docs/milestones/status.yaml` records the validated commits.

Later repositories register internal commands with `PersistenceWorker` and perform
SQL only through its transaction context. They may add forward-only numbered
migrations but may not rewrite schema `0001`, bypass migration checksums, open a
second writable connection, or persist privileged mutations outside
`withAdministrativeAudit`.
