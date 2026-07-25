# Milestone 01: Persistence And Audit Foundation

## Purpose and why

Create the durable, transactional substrate needed by every v2 domain. Identity and administrative mutations cannot safely proceed until schema evolution, repository ownership, and fail-closed control-plane auditing are established.

## Dependencies

- Milestone 00.

## PRD traceability

- Section 6.3: persistence.
- Sections 22 and 23.2: mutation behavior and transactional administrative audit.
- Sections 31, 32.1, and 32.3: redaction, single-instance operation, and health.
- Sections 34.1, 34.3, and 36: security and testing requirements.

## Scope

- Add the approved SQLite driver, connection/composition ownership, startup schema validation, and forward-only migration runner.
- Establish schema metadata and the shared persistence conventions for UUIDv7 identifiers, UTC timestamps, foreign keys, optimistic-concurrency versions, and bounded indexes.
- Establish transaction helpers that commit a control-plane mutation and its sanitized administrative audit event atomically.
- Add the foundational administrative audit schema with denormalized actor/target snapshots and no live user dependency.
- Add repository interfaces and test transaction fixtures without implementing product-domain CRUD.
- Enforce one active application writer for one database and fail startup on unsupported schema state.
- Add sanitized database/migration/audit readiness checks and lifecycle shutdown.

## Not in scope

- User, service, credential, policy, OAuth, session, API-key, activity, or backup domain behavior.
- Audit search, FTS, retention UX, or export; those belong to Milestone 19.
- A distributed database, ORM-generated public model, queue, or multi-replica coordination.
- Importing v1 YAML.

## Required behavior and interfaces

- Startup applies supported pending migrations transactionally and refuses downgrade or unknown-future schemas.
- Repository mutations require a transaction context; audited control-plane mutation helpers cannot commit data without the matching audit event.
- An audit persistence failure aborts a privileged mutation without returning internal paths or raw database errors.
- Readiness distinguishes database, schema, and administrative-audit health using sanitized stable codes.
- Migration and repository errors do not expose SQL containing secret inputs.

## Security, authorization, invalidation, and audit

- Database files and migrations use restrictive deployment permissions.
- Audit payload construction applies allowlisted, typed fields and rejects prohibited secret-bearing fields.
- Failed and denied sensitive actions have a safe append path even when no product mutation occurs.
- This milestone creates no user-facing authorization decisions or runtime invalidation behavior.

## Tests

- Positive: empty database initialization, ordered migration, restart at current schema, transaction commit, and sanitized audit persistence.
- Negative: unsupported future schema, failed migration rollback, locked/misconfigured database, missing audit event for an audited mutation, and injected audit write failure.
- Boundary: concurrent startup/writer ownership, maximum safe audit field sizes, foreign-key enforcement, and optimistic-version increment primitives.
- Integration: restart persistence and readiness transitions without exposing file paths or SQL.

## Acceptance criteria

- A fresh and current database starts cleanly; unsupported or partially migrated state fails safely.
- Atomic mutation/audit helpers are demonstrated by integration tests.
- No product-domain tables or CRUD are added beyond shared schema/audit infrastructure.
- Build and full tests pass with no sensitive output.

## Planning handoff

Specify the exact first migrations, connection lifecycle, transaction API, test database isolation, UUID/time source, error mapping, and how later repositories register migrations without bypassing audit coupling.
