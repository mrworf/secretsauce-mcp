# Milestone 19: Audit Search And Retention

## Purpose and why

Complete durable, searchable evidence for administrative/security and MCP activity while preserving their distinct schemas, viewer permissions, and strict prohibition on secret material.

## Dependencies

- Milestones 01, 07, 13, and 16.

## PRD traceability

- Section 23: audit domains, content, search, visibility, and retention.
- Sections 24.4, 29, and 31: security surfacing, API bounds, and privacy.
- Sections 34.3, 35, and 36: security, performance, and testing.

## Scope

- Finalize separate MCP/runtime and control-plane administrative/security event schemas and retention classes.
- Persist immutable event-time actor/target labels and UUIDs so permanent deletion requires no tombstone or live foreign key.
- Add sanitized field-level before/after changes, action/outcome/category, service context, correlation IDs, required justification, and safe client/source metadata.
- Add transactional SQLite FTS over an allowlisted canonical representation of all searchable fields except timestamp.
- Add scoped APIs and responsive audit explorers for superadmins and service admins; users receive only their own security/session/grant event views, not the administrative explorer.
- Add inclusive relative presets and absolute start/end UTC filtering with explicit display timezone.
- Add bounded pagination/search, permission-checked audit export separate from backup, and configurable default 400-day/longer/unlimited retention with capacity warnings.
- Add audited retention/index-maintenance jobs without rewriting event content before expiry.

## Not in scope

- Backing up/restoring audit history.
- Enterprise SIEM streaming, distributed search, or unbounded raw-query language.
- Indexing raw requests, headers, bodies, tokens, secrets, or timestamps in the text search.
- Activity aggregates, handled in Milestone 20.

## Required behavior and interfaces

- Successful control-plane mutations and their audits remain atomic and fail closed.
- Denied/failed sensitive actions are persisted safely even without a mutation.
- Search applies to all authorized sanitized fields except time; time filters are separate and inclusive at both endpoints.
- Viewer scope is applied in the database query before result pagination and FTS ranking.
- Deleting a user leaves historical events intelligible and immutable.

## Security, authorization, invalidation, and audit

- Central sink sanitization rejects or redacts prohibited values regardless of producer.
- Search indexes only allowlisted sanitized event data and cannot expose hidden fields through snippets/counts.
- Exports honor the same scope and redaction as interactive results.
- Retention/export/search administrative actions are themselves audited without recursively embedding event content.

## Tests

- Positive: both event domains, full-field search, every relative preset, inclusive absolute range, timezone presentation, role-scoped views, export, retention, and deleted-user readability.
- Negative: raw secret/token/reference/header/cookie/body insertion at producers and sink, timestamp text search, unauthorized/cross-service search, FTS snippet leakage, malformed/expensive query, invalid range, and mutation when audit persistence fails.
- Boundary: exact inclusive timestamps, DST/display zones, 400-day cutoff, unlimited retention, maximum query/page/export sizes, deleted actor/target, and concurrent mutation/index update.
- Integration: transactional event+FTS visibility, retention index cleanup, first-page performance at target data volume, and sanitized export.

## Acceptance criteria

- Separate audit domains are searchable and viewable according to exact role/service scope.
- Search covers all allowed fields except time, and inclusive time filters behave exactly as documented.
- Audit evidence survives permanent user deletion without tombstones.
- Prohibited values are absent from event storage, indexes, API/UX, logs, and exports.

## Planning handoff

Specify event schemas/allowlists, producer API, canonical FTS document, transactional triggers/application writes, scoped SQL strategy, search grammar and limits, time parsing/timezone handling, retention batching, export format, performance fixture, and sink-fuzz tests.
