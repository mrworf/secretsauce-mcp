# Milestone 13 Implementation Plan: Persisted Runtime Authorization

## Scope review and cutover invariant

Milestone 13 makes activated, immutable database snapshots the sole MCP runtime
authority while preserving the five generic tools and the existing stateless
HTTP, destination, TLS, redirect, limit, substitution, and response-protection
semantics. It does not add MCP OAuth users/grants, persistent references,
multiple replicas, v1 migration orchestration, or service-specific tools.

Cutover is explicit and one-way. Configuration selects `runtime.authority:
database`; a host-authority activation command transactionally records v2
activation only after persistence, schema, published configuration, and vault
metadata are valid. In database mode, missing activation or vault readiness is
not-ready and MCP tool calls fail closed. YAML services are never used as a
fallback or merged authority after activation. YAML remains available only in
legacy mode until the future migration command becomes its sole reader.

## Immutable snapshots and activation

Migration `0013` adds:

- a singleton `runtime_activation` row containing inactive/active state,
  activation generation, global reference epoch, activating actor category,
  activation time, and version;
- `runtime_service_snapshots`, keyed by immutable UUID and service publication
  generation, containing a bounded canonical private document and digest;
- `runtime_active_services`, mapping each service UUID to exactly one immutable
  snapshot and generation; and
- bounded runtime invalidation checkpoints used by the single data-plane
  process.

A snapshot includes immutable service/profile IDs and safe names, canonical
destinations, normalized service assignments, configured credential metadata
and private locator/generation, credential assignments, service and credential
policy boundaries/rules, response safeguards, and the publication/global
generations needed to bind references. It never contains plaintext credentials,
sessions, grants, opaque references, audit text, or downstream data.

Service publication validates and constructs the complete canonical snapshot in
the same transaction as the immutable service revision, active mapping,
publication generation, invalidation event, and audit. Draft changes remain
invisible. Activation constructs snapshots for every currently published valid
service in one bounded transaction, rejects any incomplete service/credential
or oversized installation, sets the active mapping, increments the global
epoch, and records only safe audit metadata.

## Runtime read model and request consistency

`PersistedRuntimeAuthority` is the asynchronous registry/read-model boundary.
Each tool operation obtains one immutable authorization view. A service request
loads one snapshot plus the active ordinary user, current service/group access,
credential access, and current identity/configuration generations in one
database read command. Publication committed afterward affects the next
request, never the in-flight object.

The YAML registry remains a compatibility adapter behind the same runtime
interface in legacy mode. Database mode never calls the YAML adapter. Public
list/describe/reference projections omit locator/generation and return only
services currently authorized to the UUID subject. Non-UUID, inactive, or
privileged subjects fail closed until Milestone 14 supplies verified MCP user
UUIDs.

## Exact request and vault ordering

The persisted request path is:

1. authenticate the stateless MCP POST and resolve an active ordinary-user UUID;
2. load one immutable service snapshot and current service/group authorization;
3. canonicalize the selected persisted destination and validate base URL,
   scheme, host, port, path encodings, headers, cookies, and request bounds;
4. preflight opaque reference hashes/bindings without refreshing or resolving
   them, derive the requested credential UUIDs, and require current credential
   assignments/status;
5. evaluate the service boundary and every requested credential boundary with
   the shared evaluator;
6. acquire subject/service/global capacity;
7. consume and validate the references against the request snapshot and current
   subject/configuration generations;
8. issue exact one-use vault capabilities bound to subject/security/grant
   epochs, service/destination/credential, locator/generation, method, canonical
   path digest, request UUID, and operation digest;
9. resolve through the data-plane-only vault client, substitute only inside the
   bounded callback, and perform downstream I/O; and
10. apply existing TLS/redirect/response limits, scan/tokenize, zero mutable
    secret buffers, and emit sanitized audit/denial metadata.

Every denial through step 7 produces zero vault resolution and zero downstream
I/O. Capacity admission precedes secret work. Vault capability construction is
internal and cannot accept caller-selected locator, generation, or binding.

## Reference identity and invalidation

Configured `gref` records bind subject UUID, service/destination/credential,
snapshot UUID, service publication generation, credential authorization
generation, subject security epoch, global epoch, and issuance lifetimes.
Response `sec` records bind subject, service, snapshot/publication/global
identity. Restart still expires all in-memory references.

The runtime consumes identity, service, assignment, credential, and policy
invalidation streams through a bounded single-process poller with durable
per-stream checkpoints. Events are marked dispatched only after cache/reference
effects are applied:

- account status/security events evict every reference for that user;
- service publication/archive events evict that service, or the affected user
  when targeted;
- service/group assignment events evict the affected user/service set;
- credential selector/value/status events evict only matching
  user/service/credential references, or the credential scope when broad;
- policy events invalidate cached snapshots/explanations but do not resolve
  secrets; every next request reevaluates policy.

Generation checks remain authoritative even if event delivery is delayed or a
process restarts. Event consumption improves prompt eviction but is not the
security boundary.

## Readiness, configuration, and lifecycle

Database authority requires persistence, activation, an active snapshot mapping,
the data-plane vault socket/key, and a resolve-capability signing key. Key files
use the existing canonical 32-byte base64url and restrictive-path rules. Health
reports only `database`, `schema`, `runtime_activation`, and `vault` categories;
it never reports paths, locators, generations, or broker bodies.

Composition starts persistence and validates activation/snapshots before the MCP
listener accepts privileged work, then constructs the data vault client,
capability issuer, runtime authority, invalidation poller, capabilities, and
secret scanner. Shutdown reverses ownership and is idempotent. A vault/database
failure after startup makes readiness fail and requests fail closed without
falling back to YAML.

## Delivery slices and compatibility matrix

1. Migration, canonical private snapshot schema/bounds, publication builder,
   activation repository/host CLI, positive/negative activation and atomic
   publication tests, then a concise commit.
2. Asynchronous runtime-registry abstraction with YAML compatibility adapter,
   persisted list/describe/access snapshot reads, one-request consistency, and
   draft/invalid/non-UUID/cross-user tests.
3. Generation-bound reference records, non-refreshing preflight, precise
   invalidation/checkpoint consumption, delayed-delivery/restart/target-scope
   tests, and a concise commit.
4. Data-plane vault configuration, one-use capability issuance, callback-only
   resolution, configured-token response matching, failure/zeroization tests,
   and a concise commit.
5. Persisted gateway pipeline integration preserving destination validation,
   policy conjunction, capacity ordering, generic MCP schemas, audits, denial
   explanations, and no-vault/no-I/O assertions for every preflight failure.
6. Real HTTP and self-signed HTTPS integration, simultaneous publish/request,
   next-request activation, multiple groups/credentials, snapshot limits,
   restart expiry, and database/vault readiness failure tests.
7. Operator/security documentation, activation and rollback warnings, current
   OpenAPI, production build, full suite, acceptance review, milestone status,
   and a final concise commit.

Compatibility must cover all five unchanged tool names/schemas through both
legacy YAML mode and activated database mode. Database mode additionally proves
published-only discovery, UUID identity, service/credential assignment
intersection, service-plus-credential policy conjunction, fresh-ID reference
binding, exact TLS metadata, response protection, and no simultaneous authority.

