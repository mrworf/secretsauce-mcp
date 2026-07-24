# Milestone 19 acceptance review

## Outcome

Milestone 19 is accepted. Database mode now persists separate immutable
administrative and runtime evidence, indexes only canonical allowlisted
documents, applies viewer scope before search and pagination, and exposes
bounded search, self-history, export, retention, and maintenance contracts.

## Evidence

- Migration 0019 adds domain indexes, runtime storage, immutable-update
  triggers, independent retention settings, and leased maintenance state.
- Administrative and runtime inserts commit their FTS document atomically.
  Runtime persistence uses a bounded ordered writer and closes only after
  flushing accepted projections.
- Central runtime projection and administrative event validation reject
  prohibited fields and recognizable credentials, tokens, cookies, headers,
  bodies, and opaque references.
- Search uses materialized authorized scope, literal FTS tokens, inclusive
  canonical UTC bounds, deterministic keyset pagination, and signed
  route/principal/scope/filter-bound cursors.
- Exports reuse the search projection and scope, enforce the 10,000-row and
  5-MiB limits, and audit only safe filter names and result measurements.
- Retention uses exact 400-day cutoff semantics, unlimited support, atomic
  event/index deletion, bounded missing-index repair, capacity warnings,
  optimistic updates, and operation-bound manual execution.
- The responsive browser explorers expose assigned-service scope, timezone and
  DST controls, bounded download, retention state, and reduced personal
  security history without rendering snippets or raw event JSON.
- The 10,000-row local SQLite fixture meets the documented sub-second first
  scoped-page target.

## Verification

- Production TypeScript and Vite build: passed.
- Focused audit search, export, retention, route, permission, timezone/DST, and
  UI tests: passed.
- Control OpenAPI currency check: passed.
- Full privileged regression: 105 files and 777 tests passed.

## Residual boundaries

- Audit response protection is exact/pattern defense, not a universal
  non-exfiltration proof against invertible downstream transformations.
- Capacity values estimate SQLite pages; they do not measure host free space.
- Searchable audit storage and maintenance are single-writer, single-instance
  facilities. Multi-instance coordination and SIEM delivery remain out of
  scope.
- Audit export is evidence extraction, not configuration backup, and audit
  history remains outside backup/restore scope.

