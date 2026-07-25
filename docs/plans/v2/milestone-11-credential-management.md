# Milestone 11 Implementation Plan: Credential Management

## Scope review

Milestone 11 adds service-owned credential definitions, credential-level
principal selectors, write-only vault value operations, redacted
clone/copy/import, invalidation, strict browser APIs, and the Credentials
workspace. It extends service drafts/publications with redacted credential
metadata so placement is validated before publication.

The work remains control-plane only. It does not resolve a database credential
for MCP, change YAML runtime authority, add credential policy rules, export
secrets, accept environment/file sources as ongoing authority, approve a
SecretSauce API key for self-use, or add a service-specific tool/profile pack.
Milestone 12 attaches policies and Milestone 13 builds and consumes persisted
runtime snapshots.

## Persistent model and public/private projections

Migration `0010` adds service-first credential tables:

- `service_credentials`: immutable UUIDv7, service UUID, trimmed name and
  normalized service-unique name, optional bounded description, usage kind and
  name, bounded prefix/suffix hints, explicit header-ownership flag, public
  status (`configured|unconfigured|disabled|archived`), private vault locator
  and generation, optional printable last-four, value update timestamp,
  authorization generation, version, and timestamps;
- `credential_principal_assignments`: normalized `all|group|user` rows using the
  Milestone 10 selector model and same-service group foreign key;
- `credential_invalidation_events`: durable service/credential events with
  optional affected ordinary-user UUID, generation, bounded reason, and
  dispatch state; and
- `credential_vault_operations`: one durable, credential-bound consistency
  intent recording operation kind, random locator, expected/target generation,
  prior safe status, phase, bounded result category, and timestamps. It never
  stores a secret, ciphertext, request body, or diagnostic.

The repository uses separate projections. Public/browser/history/copy DTOs
contain credential UUID, service UUID, name/description, usage, selector,
status, optional last-four, value update time, version, and timestamps. Only the
internal vault coordinator and future runtime snapshot builder can read locator
and vault generation. No general repository or route returns those fields.

Credential names are case-insensitively unique within a service. The initial
limit is 5,000 credentials per installation, with at most 1,000 credentials per
service and 1,000 explicit principals per credential.

## Placement and assignment validation

Database credentials support `header`, `query`, and `body` placement. Every
kind requires a bounded name. Header names must be valid HTTP field names and
cannot claim authority, forwarding, hop-by-hop, cookie, or proxy-authorization
headers. Prefix/suffix validation reuses the gateway contract: CR, LF, and NUL
are forbidden, total hints are bounded, and a non-empty suffix must begin
outside the opaque-reference alphabet so reference parsing is unambiguous.

Header ownership is explicit and default-off. It is valid only for a header
placement with a safe name. Future runtime enforcement must validate or clobber
the owned caller header before substitution and downstream I/O; metadata never
implies ownership merely because a header is named.

Each credential normalizes exactly one selector:

```text
{ kind: "all" }
{ kind: "groups", group_ids: [UUID, ...] }
{ kind: "users", user_ids: [UUID, ...], direct_assignment_confirmed: true }
{ kind: "principals", group_ids: [...], user_ids: [...],
  direct_assignment_confirmed: true }
```

At this boundary `all` means every active ordinary user already authorized to
the parent service. Credential access is the intersection of current service
access and the credential selector; every credential in a future request must
pass independently. Direct users retain the explicit group-preference warning
and confirmation. Empty, duplicate, inactive, privileged, cross-service, and
open selector input fails before vault or downstream I/O.

## Status and metadata lifecycle

Metadata creation is idempotent, explicitly initializes the selector (`all` is
shown as the editor default), and begins `unconfigured`. Profile/usage/selector
changes require the current credential ETag. Selector, disable, value,
archive, and delete changes increment the credential authorization generation
and emit scoped invalidation.

- `unconfigured`: no usable vault value; a new value transitions to
  `configured`.
- `configured`: value metadata is consistent and the credential may become
  runtime-eligible in Milestone 13.
- `disabled`: a value may remain stored but cannot be represented as usable;
  enable first verifies current vault metadata.
- `archived`: no value remains, selectors are removed, metadata is read-only,
  and permanent deletion is allowed.

Deleting a value transitions to `unconfigured`. Archive disables/invalidate
first, removes any vault value through the consistency protocol, clears private
value metadata, removes selectors, and then marks `archived`. Permanent delete
requires archived state, justification, version, and idempotency. Missing values
are never replaced by dummy data.

## Vault binding and consistency protocol

Credential values are service-wide, but the existing version-1 vault envelope
contains a destination-sized binding field. New credential operations use a
canonical service-wide record binding of `(service UUID, service UUID,
credential UUID)` in that fixed envelope. The control client exposes this as a
service/credential binding rather than leaking the compatibility encoding.

Milestone 13's one-use resolve capability will still bind the actual canonical
destination, method/path digest, request, subject, service, credential,
locator, and generation. The broker verifies that request capability before it
resolves the separately service-bound record, so the compatibility encoding
does not weaken destination authorization.

The vault `create` operation is extended to accept a control-generated random
UUIDv4 locator. Before any vault call the database commits an operation intent
containing that locator and the expected/target generation, marks the credential
non-usable for the operation where necessary, increments invalidation, and
audits the transition. The raw submitted value exists only in the route/service
and authenticated vault frame buffers and is zeroed where runtime APIs permit.

After the vault call:

1. success finalizes locator/generation/status/last-four/timestamp and the safe
   operation outcome transactionally;
2. a definite pre-write failure restores the prior safe state;
3. timeout/connection ambiguity invokes vault `metadata` using the durable
   intent: target generation finalizes, the prior generation restores/retries
   safely, and absence finalizes delete or rolls back create/replace as
   appropriate; and
4. an unresolved outcome leaves the credential non-usable with a sanitized
   reconciliation state. Startup/request reconciliation can complete it using
   only intent plus metadata/delete operations; it never needs or retrieves the
   submitted value.

Only one vault intent may exist per credential. Version checks and the intent
row serialize replace/delete/archive races. A control process crash can
therefore leave a visible non-usable remediation state, but never a silently
configured missing value or an untraceable locator.

The injected failure matrix covers before-vault, vault rejection, reply loss
after create/replace/delete, database finalize failure, cleanup failure,
restart reconciliation, stale generation, and concurrent replace/delete.

## Clone, copy, publication, and deletion

Credential clone is within the same service so same-service group selectors
remain valid. It allocates a new UUID/name, copies metadata, usage and selector,
and always starts `unconfigured` with no locator, generation, last-four, value
timestamp, policies, audit history, or invalidation history.

Credential copy emits a closed versioned JSON document containing only
metadata, usage, and selector. Import validates every field and same-service
group reference and creates a new unconfigured credential. Unknown secret-like
fields (`value`, `secret`, `locator`, `generation`, `last_four`, ciphertext,
source) are rejected, not ignored. No copy/import path accepts a value.

Service canonical draft/publication documents gain redacted credential
definitions and selectors. Validation rejects unsafe placement and cross-service
bindings before publication. Availability is represented only by safe status;
unconfigured/disabled credentials remain visible remediation and are never
treated as usable. Immutable history excludes locator, generation, last-four,
value time, and every secret-derived or vault field.

Service clone/copy continues its Milestone 09 non-principal behavior; credential
clone/copy is the operation that preserves credential selectors within their
valid service scope. Service permanent deletion first records durable vault
cleanup intents for every remaining value; a service cannot disappear while
unresolved cleanup would make its locators untraceable.

## APIs, authorization, audit, and browser UX

The authenticated browser API adds:

- `GET|POST /api/v2/services/{service_id}/credentials`;
- `GET|PATCH|DELETE /api/v2/services/{service_id}/credentials/{credential_id}`;
- `POST .../{credential_id}/disable|enable|archive|clone`;
- `PUT|DELETE .../{credential_id}/value`;
- `GET|PUT .../{credential_id}/assignments`; and
- `GET .../{credential_id}/copy` plus `POST .../credentials/import`.

All schemas are closed and bounded. Reads and value responses are `no-store`.
Metadata/selector/value/lifecycle writes require current ETags; create,
replace/delete value, clone/import, archive, and permanent delete are
idempotent. Scope is checked before credential existence and before any vault
call. The service rechecks live assigned-admin/superadmin authority, service
lifecycle, credential state, placement, selector, and version.

Audit events record credential/service UUID, metadata field names, selector
kinds/UUIDs, safe status, last-four presence (not necessarily its content),
vault outcome category, generation change, and justification. They never
contain a submitted value, locator, ciphertext, vault key, request body,
Authorization header, cookie, opaque reference, or downstream response.

The `/control/credentials` workspace is service-first and responsive. It shows
safe metadata/status/last-four/time, group-first assignment controls, the
separate confirmed direct-user exception, lifecycle actions, and write-only
create/replace/delete value forms. A value field is never prefilled, copied into
URL/storage, previewed, or retained after an attempt. Clone/import state clearly
requires a new value before use. Narrow layouts keep identity, state, placement,
assignment, and remediation visible before actions.

## Delivery slices and acceptance

1. Persistence, public/private DTOs, placement/selector domain, lifecycle,
   invalidation, clone/copy, publication projection, and positive/negative
   repository tests.
2. Service-wide vault binding, control-chosen locators, durable consistency
   coordinator/reconciliation, injected failure tests, production wiring, and
   real broker integration proving the control caller cannot resolve.
3. Strict scoped APIs and authorization with OpenAPI, concurrency,
   idempotency, value non-disclosure, and cross-scope tests.
4. Responsive Credentials workspace, write-only value handling, selector
   warnings/confirmation, status/remediation, narrow-layout tests, and full
   browser build.
5. Operator/security documentation, acceptance review, current generated
   OpenAPI, full regression suite, milestone status, and concise commits.
