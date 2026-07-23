# Milestone 09 Service Management Acceptance Review

## Review conclusion

Milestone 09 is complete within its assigned boundary. SecretSauce now provides
durable service identity and ownership, canonical draft validation, immutable
publication history, rollback lineage, safe transfer and clone, archive and
dependency-aware deletion, invalidation events, strict browser APIs, and a
responsive permission-aware Services workspace.

Database-managed configuration remains deliberately disconnected from MCP
routing. No credential, policy, group, ordinary-user assignment, API key, OAuth
grant, service-specific tool, or profile pack was added.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Durable service boundary | Migration `0008` adds bounded service, destination, administrator, revision, and surviving invalidation relations with service-first child indexes |
| Stable identity | UUIDv7 service identity, immutable unique slug, aggregate version, lifecycle, draft digest, current publication, and monotonically increasing generation |
| Scoped ownership | Superadmin global authority, exact live service-admin assignment, not-found-equivalent cross-service denial, and actor-only relationship resolution |
| Canonical validation | Closed version-1 document, deterministic digest, canonical HTTP(S) URL and routing-changing escape rejection, bounded linear-time host matchers, schemes, ports, and explicit TLS state |
| Publication | Active administrator and complete destination requirements, immutable append, optimistic concurrency, generation/version advance, invalidation, and audit in one transaction |
| History and rollback | Bounded retained metadata without principal IDs/documents; rollback restores canonical state and appends lineage instead of moving history backward |
| Safe transfer | Copy/import exclude all secret, principal, policy, session, grant, reference, OAuth, deployment, and runtime domains; ownership-safe destination IDs |
| Isolated clone | Superadmin-only new service and destination UUIDs without administrators, history, audit, invalidation, or later-domain state |
| Archive and deletion | Justification, idempotency, version checks, archive invalidation, zero-owner dependency gate, exact one-time human proof, cascade cleanup, and surviving delete evidence |
| API contracts | Strict bounded no-store schemas, strong ETags, central permissions, idempotency and step-up seams, runtime-generated OpenAPI |
| Browser workspace | Role-filtered list/editor, multi-value destinations, validation and TLS warnings, dirty state, publication/history/rollback, safe transfer, ownership, lifecycle, exact deletion confirmation, and narrow ordered layout |
| Runtime isolation | Database-managed drafts and publications never enter the YAML-backed MCP registry before Milestone 13 |
| Secret-safe observability | No copy/history/admin output or audit event returns credential material, opaque references, raw bodies, actor IDs beyond role labels, or unsafe diagnostic data |

## Security and architecture review

- Authorization, scoped service lookup, current aggregate version, lifecycle,
  and ownership are re-read before mutation. Draft changes never affect the
  current immutable publication.
- Destination validation rejects routing-changing percent encodings and unsafe
  URL/matcher boundaries before future credential substitution or downstream
  I/O. TLS-disabled configuration stays explicit and visible.
- Import rejects unknown fields and cross-service UUID reuse. Clone allocates
  new UUIDs and carries only the canonical non-secret domain.
- Rollback parses and re-verifies the stored canonical JSON and digest before
  replacing draft rows. The selected revision remains immutable and a new
  lineage revision is created.
- Permanent deletion consumes an exact operation-bound proof inside the same
  transaction as live superadmin authorization, idempotency, dependency
  checks, deletion, invalidation, and audit. Route-forced one-time proof works
  even when five-minute elevation is the configured default.
- The browser keeps draft/import/copy state in component memory only. It does
  not log it or place it in local storage, session storage, URLs, or
  diagnostics; deletion credentials are cleared after the attempt and are not
  included in the destructive request.
- Review corrected two completeness issues before acceptance: service-admin
  removal now requires audited justification, and destination editing
  preserves every configured scheme, host matcher, and port.

## Deliberate handoff

Milestone 10 extends immutable service UUID ownership with groups and
ordinary-user assignments. Milestones 11–12 add redacted credential metadata
and policy definitions to publication. Milestone 13 consumes published
revisions and invalidation events to replace YAML runtime authority.

Until that handoff, operators must continue to treat the existing YAML service
registry as the only MCP routing configuration.

## Validation

- production server and responsive web build
- focused migration, canonical validation, repository, authorization,
  publication, lifecycle, step-up, API, browser API, UI, and responsive-style
  tests
- positive and negative strict-input, cross-scope, stale, replay, retention,
  unsafe destination, transfer exclusion, dependency, and exact-proof cases
- generated control OpenAPI consistency
- `git diff --check`
- full suite with required loopback and Unix-socket permission:
  **77 test files and 609 tests passed**

Accepted implementation commits: `186d8d9`, `4ae6b5b`, `1a20418`, and
`618f6e6`.
