# Milestone 15 Acceptance Review

## Outcome

Accepted. Users can inspect and revoke their own sessions and database OAuth
connections, superadmins can inspect global state and perform guarded exact
bulk revocation, and service administrators can inspect and invalidate only
their currently administered service relationship. OAuth revocation and
dynamic capability invalidation remain separate in storage, APIs, audits, and
the browser workspace.

## Acceptance evidence

- Own/global viewer predicates, user/client/text filters, effective status, and
  signed keyset pagination are applied server-side before bounded results.
- Effective expiry uses stored issuance ceilings plus current configured
  reductions; exact boundaries are expired. Current user/global epochs and
  role/status are reloaded for every projection.
- Grant projections contain only safe client metadata and current activated
  service names derived from effective direct/group/all assignment state.
- Session revocation is scoped and idempotent. Current-session revocation clears
  the browser cookie only after the transaction commits.
- Grant revocation atomically updates grant, family, active refresh, and access
  records. User, client, and all-grant bulk variants require exact
  confirmation, justification, idempotency, and operation-bound step-up.
- Service-admin queries recheck the current `service_admins` relationship and
  return only the requested service. Stale and unrelated relationships fail
  closed.
- The broker aggregate seam sweeps expiry and returns only active/expired/
  invalid integer counts for `gref` and `sec`; scoped invalidation preserves
  unrelated subjects. No reference IDs or values cross the seam.
- Service, credential, policy, and subject-assignment invalidation append typed
  durable events and do not update OAuth grant state.
- Strict no-store HTTP contracts cover personal, global, and service scopes.
  Unknown fields and unauthorized broad access are rejected.
- The responsive Access and sessions workspace labels OAuth grants and dynamic
  capabilities separately and never receives fields it must hide.
- The earlier assignment explainer moved to
  `/api/v2/services/{service_id}/assignments/access`; the Milestone 15 computed
  grant view owns `/api/v2/services/{service_id}/access`.

## Verification

- Focused repository, cursor, revocation, bulk-target, capability-target,
  aggregate-seam, HTTP, OpenAPI, browser-client, responsive workspace, and route
  migration tests pass.
- Production server and web builds pass.
- `npm run check:control-openapi` reports the committed artifact current.
- Full regression with listener/socket permission: **94 test files, 707 tests
  passed**.

## Implementation commits

- `cd56d80` — scoped access projections and signed pagination
- `6ff6c51` — audited session, grant, family, and token revocation
- `64944ab` — service-scoped projections and aggregate capability invalidation
- `309cc3b` — strict control API and runtime OpenAPI contracts
- `f081d66` — responsive access workspace and assignment route migration

## Runtime coordination boundary

Ephemeral reference details remain data-runtime memory only. A control process
without a connected aggregate owner returns a sanitized maintenance response
for reference counts/invalidation while durable outbox processing remains
available. It never fabricates zero counts or persists bearer metadata.
