# Management API Contract

## Source of truth and domains

Runtime Zod schemas and a typed route registry are authoritative. The registry
binds method/path, accepted authentication methods, permission, step-up rule,
request/response schemas, error codes, rate-limit class, audit action, and secret
fields. OpenAPI 3.1 is generated from that registry and checked into a release
artifact; CI fails on drift. Handwritten OpenAPI is prohibited.

All routes begin `/api/v2`. Domains are authentication/enrollment, self-service,
users, services/destinations, credentials, policies/simulation, groups/assignments,
access/sessions/grants/references, API keys, settings/security, audits/activity,
backup/restore/migration, status/jobs, and OpenAPI.

## Common wire contracts

Requests and responses are JSON UTF-8 unless an explicitly bounded archive stream
is declared. Schemas are closed by default. IDs are canonical UUIDs; timestamps
are RFC 3339 UTC in the wire format.

```json
{
  "data": {},
  "meta": {"request_id": "req_...", "api_version": "v2"}
}
```

Errors use the same HTTP status and stable body:

```json
{
  "error": {
    "code": "stale_version",
    "message": "The resource changed. Refresh and retry.",
    "request_id": "req_...",
    "details": {"current_version": 8}
  }
}
```

Details are code-specific, bounded, allowlisted, and contain no raw inputs or
authorization internals. Validation errors identify JSON Pointer and rule, never
the rejected secret value. Stable codes include `invalid_request`,
`unauthenticated`, `forbidden`, `step_up_required`, `not_found`,
`stale_version`, `idempotency_conflict`, `rate_limited`, `vault_unavailable`,
`maintenance`, and `internal_error`. Unauthorized cross-scope resources return
`404` where existence would leak; authenticated policy denials use `403` only when
the caller may know the target.

Lists use `?limit=1..200&cursor=<opaque signed cursor>`, default 50. Responses carry
`next_cursor` only. Search adds a 1–512 character query and inclusive bounded time
range. Cursors bind route, authenticated principal/scope, sort, filters, last key,
and 15-minute expiry; malformed or cross-scope cursors are invalid.

Mutable resource reads return strong `ETag: "<version>"`. Mutations require
`If-Match`; absence is `428`, mismatch is `409 stale_version`. Create and
retry-sensitive actions require `Idempotency-Key` of 16–128 printable ASCII
characters. The keyed-hash record binds principal, route, canonical request digest,
result reference/status, and 24-hour expiry. Same key/different digest is
`409 idempotency_conflict`.

## Authentication and authorization middleware

Middleware order is request byte/time limit, canonical Host/Origin validation,
request ID, authentication, CSRF for cookie mutation, static permission and
resource-scope authorization, account/epoch validation, step-up, schema parsing,
domain invariants, transaction/audit, then response security headers. No bearer or
cookie is logged.

- Browser endpoints accept only opaque server session cookies and CSRF tokens.
- API-key endpoints parse a recognizable identifier plus random secret, perform
  constant-time slow verifier checking, then apply immutable API role/scope and
  hard denials.
- Local CLI endpoints require Unix socket/host authority and never accept remote
  bearer substitution.

The Section 30 permission matrix is encoded as table-driven static policy. Service
access is checked before child credential/policy/group/user relationship.
`service` and `all_services` keys cannot edit profiles or account state; `system`
does not inherit service management; no API key affects superadmins, API keys,
restore, secret export, step-up, global authenticator events, or vault keys.
API keys never satisfy human step-up: an endpoint either explicitly permits the
key's static role and resource scope without step-up or rejects the request.

## Browser and secret input rules

Control responses set CSP, `frame-ancestors 'none'`, no-sniff, strict referrer
policy, and deny permissive CORS. Authentication and secret routes set
`Cache-Control: no-store`. Cookie-authenticated mutations require same-origin
Host/Origin plus synchronizer CSRF token. Secret-bearing fields are accepted only
in bodies over the protected control listener, have per-field byte limits, are
tagged in the schema registry, and are removed before error/audit/log formatting.
Responses expose one-time temporary passwords/API keys only from endpoints whose
contract declares them and never repeat them on later GET.

## Representative contract exercises

| Case | Expected contract |
| --- | --- |
| Valid admin updates assigned service with current ETag | `200`, version +1, mutation and audit atomic |
| Valid `system` key updates ordinary-user profile | Allowed without human step-up |
| Unknown request field or invalid UUID | `400 invalid_request`, no side effect |
| Admin requests unassigned service | `404`, no existence leak |
| `service` key changes user status | `403 forbidden` before domain mutation |
| Any API key targets superadmin or restore | Hard deny and sanitized security audit |
| Browser mutation lacks CSRF or wrong Origin | Reject before body/domain side effect |
| Correct request with stale ETag | `409 stale_version` with safe current version |
| Same idempotency key and digest | Replay original safe result, no second mutation |
| Same idempotency key with different digest | `409 idempotency_conflict` |
| Credential write succeeds | Returns metadata/status only; later reads never return value |
| Secret fails validation | Error identifies field/rule, never echoes value |
