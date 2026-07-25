# Milestone 12 Policy Management And Explanation Acceptance Review

## Review conclusion

Milestone 12 is complete within its control-plane boundary. SecretSauce now has
durable service/credential policies, principal-aware rules, one deterministic
evaluator and explanation model, scoped optimistic management, atomic safe
copy, publication validation, invalidation metadata, strict browser APIs, and a
responsive policy workspace.

Persisted policies do not yet authorize live MCP requests. Milestone 13 owns
the runtime cutover, private credential resolution, and invalidation
consumption. No enterprise policy language, linked templates, service-specific
tool, profile pack, or secret-bearing copy format was added.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Durable boundaries | Migrations `0011` and `0012`, one active policy per service/credential boundary, bounded service-first indexes and copy-batch membership |
| Exact algorithm | One immutable evaluator selects greatest priority, deny wins ties, and operating mode handles no match |
| Boundary conjunction | Service and every used credential must allow; assignment denial and any credential denial fail the final result |
| Canonical matching | Normalized HTTP methods, canonical host, exact downstream pathname, ambiguous route-changing encodings rejected |
| Principal applicability | Live ordinary-user identity, current group membership, parent-service access, same-service selectors, explicit direct-user confirmation |
| Explanation parity | YAML compatibility adapter and transactional simulator invoke the same evaluator and reason-code contract |
| Scoped management | Browser-session service authorization precedes child lookup; ETags, lifecycle, generations, invalidation, and sanitized audit apply to mutations |
| Safe transfer | Closed copy document, fresh UUIDs, same-service selector preservation, cross-service disable/unassign, no credentials or foreign grants |
| Atomic bulk copy | Up to 20 validated policy sets commit or roll back together; UUID batch record supports exact durable replay |
| Publication safety | Enabled rules with missing, archived-group, inactive, or privileged targets block publication |
| API and UI | Strict no-store routes/OpenAPI plus service-first responsive editor, default/deny-tie warnings, direct-user guard, copy tools, and simulator |

## Security and architecture review

- Service scope, boundary ownership, capacity, selectors, versions, and
  canonical matchers are validated before policy mutation.
- Managed regexes use the anchored linear-time subset; arbitrary stored
  JavaScript regular expressions are never evaluated.
- Simulation resolves only a persisted permitted destination and performs no
  downstream I/O. Its audit event records categories and outcome reason only.
- Cross-service copy cannot silently transfer authorization: every copied rule
  is disabled and unassigned, even when the source was enabled.
- The bulk-copy transaction validates every target before inserting the first
  policy. Replay references a non-secret batch UUID rather than serializing a
  multi-result payload into idempotency storage.
- Explanation projections omit credentials, vault locators/generations,
  opaque references, headers, bodies, query strings, URLs, and downstream
  responses. Links are authority-filtered.
- Publication rechecks selector health so later group archive or user lifecycle
  changes cannot leave an enabled invalid rule unnoticed.

## Validation

- production server and responsive browser builds
- positive, negative, and boundary evaluator tests for priority, deny ties,
  operating defaults, disabled/inapplicable rules, and boundary conjunction
- scoped lifecycle, stale update, cross-service, selector, path-encoding,
  safe-copy, atomic rollback, and idempotent replay tests
- simulator snapshot/evaluator parity and authorized-link tests
- strict route/OpenAPI and browser direct-user/deny-tie/copy tests
- full regression suite: 88 files and 655 tests passed

Accepted implementation commits: `2148bf2`, `6ece8a5`, `3959d93`, `cac50cd`,
`21bd043`, and `c5d4e4a`.

