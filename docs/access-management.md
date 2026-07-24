# Access, Session, and OAuth Grant Management

The control application exposes an **Access and sessions** workspace for
database-backed built-in OAuth deployments. It deliberately treats an OAuth
connection and a dynamic service capability as different security objects.

## Viewer boundaries

- An ordinary user or administrator can list and revoke only their own browser
  sessions and OAuth grants under `/api/v2/access`.
- A superadmin can list global session and grant metadata under
  `/api/v2/security`, revoke any session, and revoke grants by exact user UUID,
  exact client UUID, or globally.
- A service administrator can inspect only the requested service and only while
  the current `service_admins` relationship exists. The response does not
  disclose any other service attached to the same grant.

Every list predicate is applied in SQLite before ordering and pagination.
Responses contain current profile labels and immutable UUIDs, but never cookie
values, token/reference values, hashes, authorization codes, credential values,
or downstream material.

## Revocation behavior

Revoking an OAuth grant atomically revokes the active grant, refresh family,
active refresh records, and access records. Repeating the operation is a safe
no-change result. The next database OAuth validation observes the committed
revocation.

Bulk revocation requires:

- a browser session and CSRF proof;
- an operation-bound `always` step-up proof;
- an idempotency key and justification; and
- one exact confirmation:
  - `REVOKE USER <uuid>`
  - `REVOKE CLIENT <uuid>`
  - `REVOKE ALL OAUTH GRANTS`

Revoking the current browser session clears the control session cookie after
the durable transaction.

## Capability invalidation

Capability invalidation does not change OAuth grant state. It writes a typed
service, credential, policy, or subject-assignment invalidation event, appends
an `access.capability_invalidate` audit, and asks the connected runtime
aggregate seam to remove matching ephemeral `gref` and `sec` records.

The runtime seam returns integer counts only. It never returns reference IDs,
hashes, values, destinations, or secrets. If the control process is not
connected to a runtime aggregate owner, service-reference views and explicit
capability invalidation return sanitized maintenance errors; they do not report
false zeroes or broaden durable visibility. Embedded deployments can pass a
`ReferenceAggregateSource` to `startControlServer`.

The assignment explanation API introduced earlier now uses
`GET /api/v2/services/{service_id}/assignments/access`. The reserved
`GET /api/v2/services/{service_id}/access` route is the grant/capability view.

## Operational checks

Monitor administrative audit persistence and the runtime invalidation consumer.
An undispatched durable invalidation event is retryable; OAuth grant revocation
does not depend on the ephemeral broker. Keep control cursor and idempotency
keys stable across restarts, and keep the database OAuth HMAC key in stable
mode-`0400` storage.

Both ChatGPT and Codex continue to use the stateless MCP endpoint. OAuth
`server.resource` and issuer values are origins, while the configured MCP
Server URL includes the MCP path, for example
`https://mcp.example.org/mcp`.
