# Credential Management

SecretSauce stores downstream credential values in the isolated vault and keeps
only safe management metadata in SQLite. Credential definitions belong to one
service. They are an additional authorization boundary inside current service
access; they never grant service access on their own.

Database credentials remain control-plane state until Milestone 13 makes
persisted runtime authorization authoritative. The current YAML registry
continues to supply MCP runtime credentials.

## Scope and selectors

Superadmins manage credentials for every service. Admins manage credentials
only for services where they remain an active assigned administrator. Scope is
checked before credential existence and before every vault call.

Each credential has exactly one selector while active:

- `all` means every active ordinary user already authorized for the parent
  service;
- selected active groups must belong to that same service; and
- selected active ordinary users are direct exceptions and require explicit
  confirmation.

Authorization is the intersection of current service access and every
credential selector used by a request. Admins, superadmins, inactive users,
cross-service groups, duplicate targets, empty explicit selectors, and open
input fail closed.

## Safe metadata and placement

Browser/read/history/copy projections contain the credential UUID, service
UUID, name, optional description, placement, selector, status, optional
printable last-four hint, value-update time, authorization generation, version,
and timestamps. They never contain a value, ciphertext, locator, vault
generation, protocol frame, capability, verifier, or key.

Placement supports `header`, `query`, and `body`. Names and prefix/suffix hints
are bounded. CR, LF, and NUL are rejected. Headers cannot claim authority,
forwarding, hop-by-hop, cookie, or proxy-authorization fields. Header ownership
is explicit, valid only for a safe header placement, and defaults off.

Credential placement and selectors are validated when metadata is created or
changed. Service publication additionally refuses to proceed while any
credential has unresolved vault reconciliation. Credential value status is not
embedded in immutable service destination revisions: its lifecycle and
invalidation stream are independently versioned so a service rollback cannot
silently roll a secret generation backward.

## Value and lifecycle state

- `unconfigured`: no vault locator exists and the credential is unusable.
- `configured`: safe metadata matches a current vault record.
- `disabled`: a vault value may remain, but authorization rejects it.
- `archived`: no value or selector remains and metadata is read-only.

Values are accepted only in a write-only request body. Responses are no-store
and return safe metadata only. The browser uses a password input with
`autocomplete=new-password`, never pre-fills or previews it, and clears
component state after every attempt.

Create/replace and delete/archive use a durable consistency intent. The control
plane allocates the random UUIDv4 locator before calling the vault. The vault
record uses the service-wide compatibility binding
`(service UUID, service UUID, credential UUID)`. A future data-plane resolve
capability still binds the actual destination and request independently.

Success finalizes safe metadata transactionally. Reply loss is reconciled with
vault metadata. A definite absent create rolls back to `unconfigured`; a
confirmed absent delete finalizes deletion. An outcome that cannot be resolved
remains visibly non-usable with `vault_state=reconcile`, and startup performs a
bounded reconciliation pass. No dummy value is created.

Idempotency keys are durably bound to the principal, route, expected version,
and a keyed digest of the protected value request. The raw key and raw value
are not stored. A matching replay returns the completed safe result without a
second vault write; a different protected request returns
`idempotency_conflict`.

## Clone, copy, deletion, and audit

Credential clone/copy/import carries only safe metadata, placement, and the
same-service selector. The result always starts `unconfigured`. Unknown
value/secret/locator/generation/last-four/source fields are rejected.

A configured credential must have its value deleted as part of archive.
Permanent credential deletion requires archived state, current version,
justification, idempotency, and exact-operation step-up. Permanent service
deletion is blocked while any credential metadata remains, preventing vault
locators from becoming untraceable through an FK cascade.

Preparation and safe final/reconcile outcomes are audited. Events contain UUIDs,
operation/status categories, selector counts/kinds, and justification where
applicable. They exclude values, locators, generations, ciphertext, request
bodies, Authorization headers, cookies, opaque references, and downstream
responses.

## Browser API

- `GET|POST /api/v2/services/{service_id}/credentials`
- `GET|PATCH|DELETE /api/v2/services/{service_id}/credentials/{credential_id}`
- `GET|PUT .../{credential_id}/assignments`
- `PUT|DELETE .../{credential_id}/value`
- `POST .../{credential_id}/disable|enable|archive|clone`
- `GET .../{credential_id}/copy`
- `POST /api/v2/services/{service_id}/credentials/import`

Schemas are closed and bounded. Reads and value responses are `no-store`;
mutations use CSRF, permission/scope checks, strong ETags, audit metadata, and
idempotency where retry safety is required.
