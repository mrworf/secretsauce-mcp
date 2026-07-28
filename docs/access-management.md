# Web Session and Agent-Connection Management

The control application exposes **Account Settings** for Profile, Password and
TOTP, Web sessions, and Agent connections. Superadmins also receive the global
**Sessions and connections** workspace. An agent connection is the user-facing
name for one OAuth grant and its refresh family; it is not a service assignment
or dynamic capability.

## Authority matrix

- Every authenticated user may list and revoke one or all of their own web
  sessions and agent connections under `/api/v2/access`.
- A superadmin may list and revoke an individual record, every record for one
  user, or every record globally under `/api/v2/security`.
- A regular admin never sees another user's web sessions. The admin may list or
  revoke an ordinary user's agent connection only when the connection has at
  least one currently reachable service and the admin currently manages every
  service in that complete set.
- A regular admin never receives partial connection metadata, never manages an
  admin or superadmin owner, and cannot manage a zero-service connection.

List scope is applied in SQLite before ordering and pagination. Signed cursors
are bound to the viewer UUID/role, resource kind, scope, and filters and cannot
be replayed across those boundaries. Regular-admin role, owner eligibility, and
the complete current service set are checked again in the revocation
transaction; a prior list response is not authority.

## Display metadata and privacy

Web-session responses contain only:

- current-session marker;
- creation, last-activity, and effective-expiry times;
- authentication method;
- a conservative derived browser/device family; and
- the canonical source reduced to IPv4 `/24` or IPv6 `/48`.

Missing or unrecognized metadata is displayed as **Unknown**. The labels are
informational and never bind session authority. User-agent values are
length-bounded and reduced before storage. Raw user agents, full source
addresses, forwarding chains, cookies, CSRF proofs, and session hashes are not
stored as display metadata.

Agent-connection responses contain only public client name/identifier,
authentication method, timestamps, scopes, current service names, and effective
status/usability. Authorization codes, access/refresh tokens or hashes,
gateway/response references, credential values, and downstream bodies are
never returned.

## Revocation contracts

Individual self-revocation requires the authenticated browser session and CSRF
proof. Self bulk operations additionally require an idempotency key and one
exact confirmation:

- `REVOKE ALL MY WEB SESSIONS`
- `REVOKE ALL MY AGENT CONNECTIONS`

Administrative individual operations require an operation-bound `always`
step-up proof. Administrative bulk operations additionally require an
idempotency key, justification, and one exact confirmation:

- `REVOKE USER SESSIONS <user-uuid>`
- `REVOKE ALL WEB SESSIONS`
- `REVOKE USER <user-uuid>`
- `REVOKE CLIENT <client-uuid>` (superadmin only)
- `REVOKE ALL OAUTH GRANTS` (superadmin only)

Bulk updates and their generated administrative audit commit atomically.
Self/global web-session bulk includes the initiating session. The response then
clears the browser cookie and the UI returns to login. Revoking an agent
connection atomically revokes its grant, refresh family, refresh records, and
access records. The next independently authenticated browser or OAuth request
after commit observes the revocation; work fully authenticated before commit is
not forcibly interrupted.

Each global web-session or agent-connection operation supports at most 100,000
active selected records. A limit-plus-one preflight rejects the operation
before revocation, idempotency, success audit, or step-up consumption commits.
Operators must first reduce the selected scope through supported narrower
operations.

An authorized inactive record returns a sanitized no-change result. An
inaccessible or unknown administrative target follows the same uniform denial
path without revealing which authorization condition failed.

## Inactive-row cleanup

Operational browser-session and OAuth-grant rows are retained by default.
`AccessManagementRepository.cleanupInactive` is a bounded maintenance primitive
for deployments that elect physical cleanup. It accepts only an inactive cutoff,
an evidence window from one day through 366 days, and a batch limit of at most
1,000 records of each kind.

In one transaction it:

1. selects only revoked/expired browser sessions and revoked/expired grants;
2. writes immutable `access_cleanup_evidence` containing the opaque record UUID,
   owner UUID, bounded service-UUID snapshot, inactive/cleanup times, evidence
   expiry, and correlation identifier;
3. deletes only rows for which that evidence exists; and
4. appends the sanitized `access.cleanup` administrative audit with counts.

Evidence update and deletion are prohibited by database triggers. While evidence
is current, superadmin retries and regular-admin retries whose current actor,
owner, and exact service scope still qualify can return an authorized no-change.
Unknown IDs, expired evidence, changed ownership eligibility, or changed/lost
service scope remain inaccessible. The cleanup evidence and administrative
audit contain no raw bearer, proof, reference, network, user-agent, or request
body values.

## Capability invalidation

Capability invalidation remains distinct from agent-connection revocation. It
writes a typed service, credential, policy, or subject-assignment invalidation
event and removes matching ephemeral `gref` and `sec` records without changing
OAuth grant state.

`GET /api/v2/services/{service_id}/assignments/access` explains assignment
access. `GET /api/v2/services/{service_id}/access` is the separate
grant/capability view.

## Operational checks

Monitor administrative audit persistence and keep the database, control cursor
HMAC key, idempotency HMAC key, and OAuth HMAC key durable across restarts. Run
cleanup only after the chosen evidence window and administrative-audit retention
have been reviewed together.

Both ChatGPT and Codex continue to use stateless MCP HTTP authentication. OAuth
`server.resource` and issuer values are origins, while the configured MCP
Server URL includes the MCP path, for example
`https://mcp.example.org/mcp`.
