# Management API reference

The V2 control API is served below `/api/v2` on the configured control origin.
The generated OpenAPI 3.1 contract is available at
`/api/v2/openapi.json`; `npm run check:control-openapi` detects artifact drift.
The runtime route registry and Zod schemas are authoritative.

## Authentication and authority

Browser routes use a same-origin `__Host-` session cookie, strict Origin/CSRF
checks for mutations, and human step-up where declared. System-owned API keys
use the `Authorization` header and are limited by their static API role and
optional service scope. API keys cannot satisfy browser step-up, interactive
backup/restore, recovery, self-security, or other human-only operations.
Host-local bootstrap, break-glass, vault-key, activation, and migration CLIs
are not remote API authentication methods.

Authorize every request independently. The control and MCP servers do not
accept transport session state as an authorization boundary.

## Requests

- JSON request schemas are closed and reject unknown fields.
- Secret inputs use request bodies only, are `no-store`, never appear in query
  strings, and are cleared by the browser after success or failure.
- Mutable versioned resources require a strong `If-Match` ETag.
- Retry-sensitive creation uses an `Idempotency-Key` bound to principal, route,
  target, and request digest. Reusing a key with different input is rejected.
- Collection reads use bounded `limit` and opaque `cursor` values. Cursors are
  integrity-protected and cannot be moved across principals, routes, filters,
  or sort orders.
- Binary backup/restore routes have explicit media types and byte ceilings.

## Responses and errors

JSON success responses use `data` plus safe request metadata. Errors expose a
stable code, generic message, and request ID; they do not return exception
text, SQL, paths, headers, cookies, opaque references, credential values, or
downstream bodies. A scoped resource may return `404` rather than reveal that a
cross-service target exists. Sensitive and interactive responses use
`Cache-Control: no-store`.

Retain request IDs and safe operation UUIDs for audit correlation. Do not copy
session cookies, API-key values, one-time values, credential inputs, or raw
request/response bodies into tickets or logs.

## Contract workflow

1. Retrieve `/api/v2/openapi.json` from the same control origin.
2. Select an operation whose `x-authentication-methods`, `x-permission`,
   step-up, ETag, and idempotency metadata match the caller.
3. Generate clients without weakening closed schemas or response bounds.
4. Treat a contract/runtime mismatch as release-blocking and regenerate only
   from the runtime registry.

Human role semantics are defined in
[the architecture matrix](architecture/v2/management-api.md); operational
API-key rules are in [API-key management](api-key-management.md).
