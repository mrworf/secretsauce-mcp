# Milestone 00: Architecture Baseline

## Purpose and why

Resolve the design questions that must be settled before SecretSauce v2 implementation plans can be safe and decision-complete. Version 2 introduces durable identity, a control plane, and a credential vault across new trust boundaries; implementing those pieces without an approved composition, data model, and threat model would create avoidable rework and security risk.

## Dependencies

- None.

## PRD traceability

- Sections 3–6: principles, goals, non-goals, and logical architecture.
- Section 21: control-plane deployment and browser security.
- Sections 29 and 32: management API and deployment model.
- Sections 35–39: scale, testing, documentation, rollout, and architecture-review questions.
- Section 43: definition of ready for implementation planning.

## Scope

- Produce and approve a component and deployment architecture for the MCP data plane, control plane, identity subsystem, SQLite persistence, and operation-restricted vault broker.
- Produce a threat model covering public listeners, browser sessions, OAuth, API keys, database access, vault operations, backup/restore, migration, and local break-glass authority.
- Select the SQLite access and forward-migration approach for Node.js 22 and define transaction ownership, connection lifecycle, busy handling, backup coordination, and single-writer enforcement.
- Define the normalized data model, deletion behavior, immutable identifiers, optimistic-concurrency fields, audit denormalization, indexes, retention state, and schema-version strategy.
- Define the versioned management API conventions: authentication methods, authorization middleware, errors, pagination, ETags, idempotency, secret-input handling, and OpenAPI source of truth.
- Define the vault process or operating-system boundary, authenticated caller capabilities, encrypted record format, master-key provisioning/rotation, and recovery model.
- Decide OAuth access-token form and mandatory grant-state validation, refresh-family persistence, and security-epoch checks.
- Define transactional audit/FTS indexing, activity aggregation bounds, configuration version history, and bounded encrypted pre-restore recovery snapshots.
- Define safe configurable ranges for sessions, authentication limits, API limits, search, backups, and jobs.
- Define vendor-neutral OIDC MFA-assurance configuration and claim validation.
- Produce reviewed UX navigation, responsive layout rules, and wireframes for enrollment, service editing, credentials, policy explanation, audit, security, backup, and restore.
- Record approved dependencies and the boundary between the existing gateway runtime and the new v2 subsystems.

## Not in scope

- Production code, schemas, migrations, API endpoints, or UX implementation.
- Reopening product decisions listed as settled in PRD Section 40.
- Multi-replica support, multi-tenancy, service-specific tools, enterprise IAM, a general-purpose vault API, or any other PRD non-goal.
- Replacing the generic MCP tools or weakening the existing stateless MCP contract.

## Required behavior and interfaces

- Approved contracts must preserve all externally observable PRD behavior while leaving internal mechanisms replaceable behind explicit interfaces.
- Component interfaces must make secret access, authorization context, transaction ownership, invalidation, readiness, and lifecycle responsibilities explicit.
- Common API and event contracts must be versioned, bounded, runtime-validatable, and usable by both browser-session and permitted API-key callers without treating API keys as human step-up.
- Architecture artifacts must identify which decisions are mandatory for later milestones and which implementation details remain local to a milestone plan.

## Required artifacts and decisions

- Architecture decision records that answer every PRD Section 39 question.
- Component, trust-boundary, deployment, and key/data-flow diagrams.
- Reviewed entity-relationship model with deletion and retention annotations.
- Management API domain map and common wire contracts.
- Vault capability and key-lifecycle specification.
- Identity, session, OAuth grant, and invalidation state diagrams.
- UX workflow/wireframe packet and accessibility approach.
- Dependency and cryptography selections with maintenance and threat justification.
- Sequencing constraints consumed by Milestones 01–24.

## Security, authorization, invalidation, and audit

- The threat model must trace every privileged operation from authentication through authorization, mutation or runtime use, invalidation, and sanitized audit.
- Trust-boundary diagrams must identify which components can read, write, resolve, encrypt, decrypt, export, or delete each secret class.
- The permission model must cover every account-role and static API-role matrix cell, cross-service denial, step-up boundary, and last-superadmin invariant.
- Invalidation design must cover user security/profile changes, role/status changes, assignments, configuration publication, restore, and global events.
- Audit design must prove transactional control-plane writes, deletion-safe event snapshots, searchable-field allowlists, and prohibited-data exclusion.

## Shared delivery contract

Every later milestone must:

- Start with a decision-complete implementation plan and split delivery into the smallest independently useful, reviewable slices.
- Add positive and negative tests for every new external input and state transition.
- Run focused tests while developing, then `npm run build` and the unchanged `npm test` suite for every implementation slice.
- Fix slice-related failures before committing and create one concise commit per completed slice.
- Preserve the order: authenticate, authorize service and credentials, validate the destination, evaluate policy, enforce capacity, then resolve/substitute credentials and perform downstream I/O.
- Keep MCP HTTP stateless by authenticating every POST independently and never issuing or trusting `mcp-session-id`.
- Never log or audit raw credentials, opaque token values, authorization headers, cookies, authenticated request bodies, or downstream response bodies.
- Use `example.org` stand-ins in documentation and tests.
- Avoid service-specific tools/profile packs, multi-replica design, and other v2 non-goals.
- Treat the PRD as authoritative if a milestone summary is ambiguous.

## Tests and validation

- Architecture, security, UX, and data/API reviewers confirm that all required artifacts are internally consistent.
- Every PRD Section 39 question has an explicit approved answer or a documented rejection with an approved alternative.
- Threat-model abuse cases include both allowed and denied paths for every trust boundary.
- The proposed data model is walked through for user deletion, restore, API-key revocation, global security events, and service publication.
- The API conventions are exercised with representative ordinary, stale-write, validation, authorization, step-up, and secret-input cases.
- Positive and negative architecture test scenarios are mapped to the milestone that will implement them, including cross-boundary integration and failure-injection cases.

## Acceptance criteria

- All required artifacts and decisions are approved and linked from this milestone's completion notes.
- No product ambiguity is delegated to an implementation milestone.
- The architecture preserves the PRD security invariants and small single-instance deployment target.
- Milestone 01 can be planned without selecting foundational libraries, trust boundaries, or cross-cutting contracts.

## Planning handoff

The implementation plan must use the approved artifacts rather than choosing substitutes. It must identify the first schema version, migration tooling, composition roots, process boundaries, test harnesses, and dependency additions. Any later need to change an approved architecture decision requires an explicit ADR update and security/compatibility review.
