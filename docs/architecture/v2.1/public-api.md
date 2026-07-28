# SecretSauce v2.1 Public Setup And Control API Contract

Status: approved schema and behavior baseline. The implementing milestones keep
runtime Zod schemas as the source used to generate
`docs/openapi/control-v2.json`.

All JSON objects are closed. Unknown fields, duplicate security headers,
malformed canonical UUIDs, invalid UTF-8, unsupported media types, and bodies
above the route bound fail before mutation. Errors use the existing bounded
public error envelope, never raw internal errors or prerequisite details.

## Setup and health

| Method and route | Input | Success | Failure and bounds |
| --- | --- | --- | --- |
| `GET /api/v2/health/live` | No body/query | `200 {"state":"live"}` | Always bounded while the process serves status. |
| `GET /api/v2/health/ready` | No body/query | `200 {"state":"operational"}` | `503` with `state: "not_ready"` and safe message; no internal setup state. |
| `GET /api/v2/setup/status` | No body/query | `200` with `state: "preparing" | "enrollment" | "available" | "not_ready"`, safe message, `retry_pending` | Unknown query/body rejected. Never reports key/user/path/store detail. |

Before `operational`, ordinary control and browser routes return one maintenance
503. OAuth and MCP return bounded temporary unavailability with `Retry-After`.
Setup gating precedes authentication, OAuth issuance, MCP work, credential
substitution, and downstream I/O.

## Unified enrollment

The neutral browser route does not disclose whether initial or existing-account
enrollment applies.

| Method and route | Input | Success | Failure |
| --- | --- | --- | --- |
| `POST /api/v2/enrollment/verify` | `code` 1–1024 UTF-8 bytes; optional `flow_id` canonical UUID | `200` restricted ceremony cookie plus password-policy projection | Uniform `401`; no eligibility or setup disclosure. Rate and concurrency bounds apply. |
| `POST /api/v2/enrollment/password` | CSRF, `password` 12–1024 bytes | `200` one-time TOTP provisioning projection | Validation summary; secret cleared. No user is created. |
| `POST /api/v2/enrollment/complete` | CSRF, six-digit `totp_code`, expected ceremony version | `204`, ceremony consumed, redirect target fixed to login | Uniform invalid/expired result, stale version conflict, or retryable 503. No partial user. |

The TOTP projection is `Cache-Control: no-store` and contains its seed/QR only
for the restricted view. It never enters a URL, durable browser storage, log,
audit, analytics, or error. Completion creates no authenticated session.

## Login and logout

`POST /api/v2/login/local` accepts a normalized email of 3–320 characters, a
password of 1–1024 bytes, exactly six ASCII TOTP digits, and an optional
same-origin relative post-login destination no longer than 2048 characters in
one closed body. Every nonexistent, ineligible, incomplete, password-invalid,
and TOTP-invalid case returns the same `401` body. An invalid, absolute,
scheme-relative, or ambiguous destination is rejected. Success honors only the
validated relative destination (otherwise the fixed overview), rotates to a new
opaque session cookie, and returns no token in JSON.

`POST /api/v2/logout` requires the browser session, same-origin check, and CSRF
proof. Success commits exact-session revocation and audit, then clears the
cookie and returns `204`. Persistence/audit failure returns sanitized `503`,
keeps the session and cookie active, and permits an idempotent retry. Repeating
an already committed logout through a still-verifiable request returns the
stored success without a second audit event.

## Account and abuse settings

`GET /api/v2/account/security` returns only the current user's safe profile,
authentication methods, and suspension state. Password change uses the existing
step-up/CSRF boundary, accepts 12–1024 bytes, retains TOTP, and never echoes the
password.

Superadmin suspension settings use:

```json
{
  "automatic_suspension_enabled": false,
  "totp_failure_threshold": 5,
  "expected_version": 1
}
```

The threshold is an integer from 3 through 20 and matters only while enabled.
Unknown fields, missing/stale version, non-integer/out-of-range threshold, and
inconsistent state are rejected. Disabling commits counter clearing and audit
in the same transaction.

Host protective-limit inputs are environment-only. Their exact names, defaults,
ranges, and cross-field rules are defined in the validation matrix. Empty,
malformed, signed, decimal, unsafe, out-of-range, or inconsistent values stop
startup with a sanitized configuration error.

## Session and agent-connection resources

All identifiers are canonical UUIDs. List routes use closed query inputs:
`limit` integer 1–100 (default 25), an opaque cursor no longer than 512
characters, and only the route's documented filters. Results contain a
`next_cursor` only when more rows exist.

Browser-session projection: UUID, current marker, creation/last activity/expiry,
authentication method, closed device family, and coarse source network.

Agent-connection projection: grant UUID, public client ID/name,
authentication method, creation/last use/expiry, scopes, current service names,
and usability status. It never contains authorization codes, tokens/hashes,
cookies, CSRF values, or gateway references.

| Method and route | Authority | Mutation input and result |
| --- | --- | --- |
| `GET /api/v2/account/sessions` | Own user | Paginated own browser sessions. |
| `DELETE /api/v2/account/sessions/{id}` | Own user | CSRF, expected version; audited success/no-change. |
| `POST /api/v2/account/sessions/revoke-all` | Own user | CSRF, typed confirmation `REVOKE ALL SESSIONS`, expected scope version; includes initiating session. |
| `GET /api/v2/account/connections` | Own user | Paginated own agent connections. |
| `DELETE /api/v2/account/connections/{id}` | Own user | CSRF, expected version; grant/tokens/references revoked atomically. |
| `POST /api/v2/account/connections/revoke-all` | Own user | CSRF, typed confirmation `REVOKE ALL CONNECTIONS`, scope version. |
| `GET /api/v2/admin/users/{user}/connections` | Admin or superadmin | Regular admin sees only targets whose complete nonempty service set is currently managed. |
| `DELETE /api/v2/admin/users/{user}/connections/{id}` | Admin or superadmin | `justification` 1–1000 characters, expected version, idempotency key. Current role, target eligibility, and full service scope are re-decided in the transaction. |
| `POST /api/v2/admin/access/revoke` | Superadmin, or regular admin within exact permitted scope | Closed target/scope union, typed confirmation, justification, expected scope version, idempotency key; atomic bounded bulk result. |

Unknown, deleted, unauthorized, stale-scope, and ineligible administrative
targets share the same non-disclosing result. An authorized inactive target may
return the audited idempotent no-change success while its tombstone remains
provable.

## Source and metadata boundary

The shared source resolver accepts only the immediate socket peer and at most
one configured forwarding header up to 4096 bytes and 32 hops. Direct mode
ignores the field. Trusted-proxy mode requires the immediate peer in the
canonical configured CIDR set and removes the declared trusted hop chain.
Always mode selects the client-most valid source and emits its warning.
Malformed, ambiguous, zone-qualified, non-IP, overlong, or over-hop input is
rejected uniformly. IPv4-mapped IPv6 canonicalizes to IPv4 before limiting.

The canonical address feeds rate limiting and coarse network derivation only.
Full addresses and forwarding chains are absent from sessions, logs, audits,
analytics, and telemetry.

## Retries, idempotency, and compatibility

Mutation idempotency keys are canonical UUIDs bound to actor, operation, target
scope, and exact normalized body digest for 30 days. Same key/body returns the
stored result; same key/different body is `409`. Stale expected versions are
`409` without partial mutation. Retryable persistence/audit unavailability is
`503`; validation/authentication/authorization errors are not retried
automatically by the server.

No v2.1 public route provisions keys, clears a manifest, rotates a root, exposes
private vault state, or accepts a remote vault target.
