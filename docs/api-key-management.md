# System-Owned Management API Keys

SecretSauce management API keys are durable system principals for automation.
They are independent of the human account that creates them: changing or
deleting that account does not change key authority. They authenticate the
versioned control API only; they are not MCP bearer tokens, browser sessions,
or human step-up proofs.

API-key management requires the v2 persistence and identity configuration.
Administrators use the browser workspace at `/control/api-keys`; lifecycle
endpoints do not accept API-key authentication.

## Static roles

Choose the narrowest immutable role:

| Role | Authority |
| --- | --- |
| `service` | One immutable service UUID. Assigned administrators may create and manage these keys only for services they currently administer. |
| `all_services` | Current and future services plus eligible ordinary-user operations. Only a superadmin can issue it, after acknowledging the durable warning. |
| `system` | Permitted system settings and ordinary/admin account administration. It has no service-management authority. |

No API-key role can manage API keys, satisfy step-up, view or affect a
superadmin, grant `superadmin`, assign service administrators, permanently
delete a service, restore a backup, use vault-key operations, or perform a
global password/TOTP reset. Endpoint access is deny-by-default and comes from
the static API-role permission matrix, not the creator's account role.

## Issue and store a key

1. Sign in to the browser control plane as an assigned administrator or
   superadmin and complete step-up.
2. Open **API keys**, choose a nickname, the permitted role/service, and either
   a finite 1–3650 day lifetime or no expiration.
3. For `all_services`, type the exact displayed acknowledgement. This role also
   covers services created later.
4. Create the key and copy the raw value from the one-time panel directly into
   an approved secret manager. Dismissal is permanent.

The raw value has the recognizable form
`ssk_v1_<identifier>_<secret>`. SecretSauce stores only its non-secret
identifier, last four characters, metadata, and a slow Argon2id verifier. It
cannot retrieve or reconstruct the raw value. Do not put it in source control,
configuration examples, shell history, URLs, logs, tickets, or chat.

Automation sends the value as the management request's bearer credential:

```http
Authorization: Bearer <one-time-key>
```

Use the control origin and `/api/v2/...` path, for example
`https://control.example.org/api/v2/services`. Inject the header from the
automation platform's secret store instead of placing the value in command-line
arguments. The authenticated key UUID and direct source are independently
limited to 120 management requests per minute; saturated verifier work and
request windows return `429`.

## Metadata, activity, and lifecycle

The browser workspace exposes only nickname, key UUID/prefix and last four,
static role/service scope, creator audit reference, status, version, and
created/updated/expiry/last-used/revocation timestamps. Activity contains safe
snapshots, route action, UUID target when present, outcome, request ID, bounded
failure code, and time. It contains no raw key, verifier, Authorization header,
request or response body, password/reset input, or temporary password.

Finite expiry can only move earlier. Role, service scope, expiration policy,
and a forever lifetime cannot be changed. Expiry is effective at the exact
stored timestamp. Revocation is terminal and repeated revocation is a safe
no-change operation.

Rotation atomically revokes the old key and creates a replacement with the same
immutable role, scope, and expiration policy. A finite replacement keeps the
old absolute expiry. The replacement value is shown once; if that response is
lost, rotate again rather than trying to recover it.

Use activity and `last_used_at` to investigate unexpected use before
revocation. A key scoped to an archived service remains scoped to that UUID and
is never retargeted. Account lifecycle changes do not revoke keys, so key
inventory and rotation remain explicit operator responsibilities.

## Failure handling

- `401` means the bearer is malformed, unknown, expired, or revoked.
- `403` means the static role or authentication method cannot perform the
  operation.
- Resource-scoped denials may return `404` to avoid revealing an unrelated
  service or user.
- `429` means the source, key, or verifier-work limit was reached; honor
  `Retry-After`.
- `409` indicates stale version or lifecycle conflict. Reload metadata before
  retrying.
- `503` indicates persistence or verifier service is unavailable.

Control responses are non-cacheable. Keep request IDs for troubleshooting, but
never attach the bearer value or full request/response bodies to diagnostics.
The generated authenticated OpenAPI document at
`/api/v2/openapi.json` is the source of truth for route contracts and each
route's accepted authentication methods.
