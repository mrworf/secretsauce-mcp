# Milestone 15 Access, Session, and Grant Management Plan

## Outcome

Add one row-scoped access-management domain that lets an ordinary user inspect
and revoke only their own browser sessions and OAuth grants, lets a superadmin
inspect and revoke global session/grant state, and lets a service admin inspect
only the current relationship projected through services they administer.
OAuth revocation and dynamic capability invalidation remain separate operations,
labels, audit actions, and result contracts.

No bearer, cookie, authorization code, refresh/access value, `gref`, `sec`,
credential value, unrelated service relationship, or downstream material is
returned or audited.

## Durable model and state boundaries

Milestone 14 tables remain the source of truth for OAuth grants, families, and
hash-only token records. Existing `browser_sessions` remains the session source.
Status is computed on every query from stored state, configured lifetime
reductions, current user/global epochs, and current role/status; a browser never
filters a broader server result.

No durable bearer/reference table is introduced. Ephemeral gateway references
remain owned by `TokenBroker`. Add a narrow aggregate seam that can:

- sweep expiry before reading;
- count configured `gref` and response `sec` records by state, subject, service,
  and credential filters;
- invalidate by subject/service/credential using the existing bound metadata;
- return counts only, never record IDs, hashes, raw values, destinations, or
  secrets.

The control domain consumes that seam through dependency injection. Production
runtime coordination uses the existing durable invalidation outbox and
`RuntimeInvalidationConsumer`; direct in-process aggregate/invalidation support
is used only when the runtime owner is available. An unavailable aggregate seam
fails closed with a sanitized maintenance response and never broadens database
visibility.

## Viewer scopes and projections

### Ordinary user

- The authenticated UUID is the mandatory database predicate.
- List own browser sessions with session UUID, current-session flag, issue,
  last-use, effective expiry, and active/expired/revoked status.
- List own OAuth grants with grant UUID, safe client identifier/name, resource,
  scopes, authentication method, issue/last-use/effective expiry, family
  status, and names of services currently reachable by that UUID.
- Revoke an own session or grant idempotently. Revoking the current browser
  session clears its cookie after the transaction.

### Superadmin

- List all sessions and grants using current safe user profile label plus
  immutable UUID.
- Revoke one session; one grant/family; all grants for a user; all grants for
  an exact client UUID; or all grants.
- User/client/global bulk revocation requires step-up, justification, an
  idempotency key, and an exact confirmation string derived from the immutable
  target (`REVOKE USER <uuid>`, `REVOKE CLIENT <uuid>`, or
  `REVOKE ALL OAUTH GRANTS`).
- Global/session queries accept bounded status, user, client, and text filters.

### Service admin

- A service UUID is required in the route and the existing current
  `service_admins` relationship is checked before querying.
- Rows are selected by current effective ordinary-user access to that service.
- The projection contains user UUID/safe label, grant UUID, safe client
  name/identifier, grant status/times, and only the requested service's name,
  capability counts, credential count, and policy count.
- A service admin cannot call any grant/session revocation operation and cannot
  infer other services attached to a multi-service grant.
- Explicit capability invalidation may target the administered service, one
  credential in that service, one policy boundary in that service, or one
  current subject/service assignment. It returns only invalidated aggregate
  counts and never reports an OAuth grant as revoked.

## Pagination, filtering, and status

- Use stable `(effective_status, last_used_at DESC, id)` or
  `(last_activity_at DESC, id)` keyset cursors protected by the existing
  control cursor HMAC pattern.
- Default page size 50, accepted range 1–100, bounded text 1–128 characters,
  and exact enum filters.
- Apply viewer predicates and service relationships in SQL before search,
  ordering, and `LIMIT page_size + 1`.
- Effective expiry is the minimum of stored/issued ceilings and current
  configured reductions. The exact boundary is expired.
- Grant service names come from currently activated published services and
  effective direct/group/all assignments, not historical grant contents.

## Transaction and invalidation algorithms

Grant revocation runs one immediate audited transaction:

1. select only a target allowed by the actor scope;
2. transition an active grant and family to `revoked` with reason `manual`;
3. mark active refresh and access records revoked without touching raw values;
4. accept already-revoked/expired/missing-in-scope state as an idempotent
   no-change result without revealing cross-scope existence;
5. append `oauth.grant_revoke`, `oauth.user_revoke`,
   `oauth.client_revoke`, or `oauth.global_revoke` with safe UUIDs/counts.

Session revocation similarly predicates the actor scope and atomically sets
`revoked_at`; repeat revocation is a safe no-change result. Bulk operations use
bounded set-based updates and record safe affected counts.

Capability invalidation does not update OAuth tables. It atomically inserts the
existing typed service/credential/policy/assignment invalidation event with a
sanitized `access.capability_invalidate` audit. The runtime poll occurs before
the next persisted authorization/reference use, then the token broker removes
matching ephemeral records. Unrelated subjects/services/credentials remain
usable.

Simultaneous validation/revocation is serialized by the persistence owner:
whichever transaction commits first determines the next validation result.

## HTTP and UI contracts

Add strict, no-store control contracts:

- `GET /api/v2/access/sessions`
- `DELETE /api/v2/access/sessions/{session_id}`
- `GET /api/v2/access/grants`
- `DELETE /api/v2/access/grants/{grant_id}`
- `GET /api/v2/security/sessions`
- `DELETE /api/v2/security/sessions/{session_id}`
- `GET /api/v2/security/oauth-grants`
- `POST /api/v2/security/oauth-grants/revoke`
- `GET /api/v2/services/{service_id}/access`
- `POST /api/v2/services/{service_id}/capabilities/invalidate`

Responses use a common `data/items/next_cursor` envelope, explicit
`oauth_grant_status` versus `capability_status` terminology, and integer
aggregate counts. Mutations use browser CSRF, the existing authorization seam,
step-up rules, idempotency where required, and fixed safe error mapping.

Add an “Access and sessions” workspace:

- users see “Your sessions” and “Your MCP connections”;
- superadmins see global sessions/grants and guarded bulk controls;
- service admins see “Dynamic service access” and “Invalidate capabilities”;
- copy explains that removing capabilities/service access does not revoke an
  OAuth connection, and OAuth revocation does not alter assignments or policy.

The UI never receives data it must hide.

## Minimal delivery slices

1. Repository projections, effective-status calculations, cursor contracts,
   own/global positive and negative tests.
2. Idempotent own/superadmin session and OAuth revocation transactions,
   step-up/idempotency/audit tests, and immediate validation regressions.
3. Service-admin computed projection plus aggregate-only token-broker seam,
   scoped invalidation events, cross-service/multi-service leakage tests.
4. Strict HTTP routes and OpenAPI, including unauthorized/stale/bulk
   confirmation tests.
5. Responsive access workspace, role navigation, terminology and browser tests.
6. Operator documentation, production build, OpenAPI currency, full regression,
   and acceptance review/status update.

Each completed slice receives positive and negative tests, a full-suite
regression, and one concise commit.

## Acceptance matrix

- Own scope: current/other/expired sessions; current and historical grants;
  current reachable service names; repeated revoke.
- Superadmin: per-session, grant/family, user, client, and all-grant revocation;
  exact confirmation, justification, step-up, idempotency, pagination.
- Admin: current assigned-service rows only; multi-service grant redaction;
  lost/gained relationship; no whole-grant/session revocation.
- Capability boundary: active/expired/invalid aggregate counts only; scoped
  service/credential/policy/assignment invalidation; unrelated state survives.
- Security: no raw token/reference/cookie/hash/value fields in response, audit,
  error, OpenAPI, logs, or UI; viewer scope applied before pagination/search.
- Concurrency: simultaneous use/revoke and duplicate revocation resolve
  deterministically; the next request observes committed revocation.
