# Milestone 11 Credential Management Acceptance Review

## Review conclusion

Milestone 11 is complete within its control-plane boundary. SecretSauce now has
durable service-owned credential metadata, intersecting credential selectors,
validated placement, write-only vault value operations, crash/reply-loss
reconciliation, safe clone/copy/import, scoped invalidation, strict APIs, and a
responsive credential workspace.

The implementation does not make database credentials MCP-authoritative,
resolve plaintext through the control plane, attach policy rules, include
secrets in backup/restore, add an external provider, or add a service-specific
tool/profile pack. Those boundaries remain assigned to later milestones.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Durable safe metadata | Migration `0010`, service-first keys/indexes, bounded checks, public/private DTO split, and no locator/generation in browser routes |
| Placement safety | Closed header/query/body normalization, forbidden authority/forwarding/hop-by-hop/cookie headers, bounded hints, explicit default-off header ownership |
| Additional authorization | Live parent-service access intersected with every configured idle credential selector; same-service group and active ordinary-user checks |
| Write-only values | Control routes mark `/value` secret-bearing, return no-store safe metadata, zero request buffers, and expose no control resolve method |
| Vault isolation | Real Unix-socket broker integration uses control-selected UUIDv4 locators and service-wide bindings; control caller supports create/replace/delete/metadata only |
| Consistency | Durable per-credential intent serializes operations; metadata reconciliation handles applied, unchanged, absent, and unresolved outcomes without dummy values |
| Retry safety | Durable principal/route key hash plus keyed protected request digest replays the safe result without a second vault call and rejects changed requests |
| Lifecycle | Unconfigured/configured/disabled/archived transitions, metadata verification before enable, delete-value, archive cleanup, and archive-before-delete |
| Clone/copy/import | Closed versioned secret-free document and unconfigured clone; unknown secret-like fields fail |
| Invalidation and deletion | Selector/value/status/archive/delete generation events; service deletion blocked until credential metadata is explicitly removed |
| Audit safety | Actor preparation plus transactional system final/reconcile outcomes include safe categories only |
| API and UI | Strict scoped ETag/idempotency/no-store OpenAPI routes and responsive service-first workspace with write-only clearing and direct-user confirmation |

## Security and architecture review

- Authorization, service ownership, credential state, version, selector
  targets, and placement are checked before vault I/O.
- Public projections cannot expose the private locator/generation columns.
  The `ControlVaultClient` has no plaintext resolution method.
- The database intent is committed before an external write. A configured
  credential is runtime-eligible only when its state is idle; ambiguous work is
  therefore non-usable.
- Value retry digests are keyed. This avoids persisting a brute-force oracle for
  a low-entropy submitted value.
- Credential status is independently versioned from immutable service
  destination history. Publication fails during unresolved reconciliation
  rather than attempting to roll vault generations backward with service
  rollback.
- The browser keeps values, selectors, and remediation state in component
  memory only. Values are not placed in a URL, storage API, preview, or error.
- Service deletion refuses every remaining credential row, so neither configured
  nor unresolved vault ownership can disappear through cascade deletion.

## Deliberate handoff

Milestone 12 attaches credential/service policy rules. Milestone 13 consumes
credential invalidation and vault locator/generation through private runtime
projections, mints exact one-use resolve capabilities, and makes persisted
service/credential authorization authoritative for MCP requests.

Until Milestone 13, the current YAML service registry remains runtime authority.

## Validation

- production server and responsive browser builds
- positive and negative metadata, selector, placement, lifecycle, clone/copy,
  protected idempotency, stale/cross-scope, and archive/delete tests
- injected before-write, reply-loss, absent-record, ambiguous metadata, restart
  reconciliation, and real broker integration
- strict route/OpenAPI and narrow-layout browser tests
- full regression suite with required loopback and Unix-socket permission

Accepted implementation commits: `2b2ce07`, `76e1e7d`, `193563b`, `0c433d4`,
`94328ae`, `87390c6`, and `f753526`.
