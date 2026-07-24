# Policy Management And Explanation

SecretSauce stores principal-aware policy at service and credential boundaries.
This control-plane state remains preparatory until Milestone 13 makes persisted
runtime authorization authoritative; the current YAML registry still governs
MCP gateway requests.

## Deterministic evaluation

Every enabled rule has an effect, signed integer priority, normalized methods,
canonical host/path matchers, response safeguards, reason, and exactly one
principal selector. Selectors apply to all currently service-authorized
ordinary users, active same-service groups, or explicitly confirmed direct
ordinary users.

The shared evaluator applies this order:

1. Reject a boundary whose service or credential assignment does not authorize
   the current user.
2. Ignore disabled and principal-inapplicable rules.
3. Match normalized method, canonical destination host, and the exact canonical
   pathname that would be sent downstream.
4. Keep only matching rules at the greatest priority.
5. Let deny win an equal-priority tie.
6. Use the boundary operating mode when no rule matches.
7. Allow only when the service boundary and every used credential boundary
   independently allow.

The default operating mode is deny. A credential allow never overrides a
service denial, and one denied credential denies the complete request.

## Matcher and assignment safety

Managed host and path regular expressions use a bounded anchored linear-time
subset. Paths reject percent encodings that can alter routing meaning,
including encoded slash, backslash, NUL, percent, and alternate encodings of
unreserved bytes. Query and fragment data are not policy match inputs.

Enabled rules require a non-empty valid selector. Direct users must remain
active ordinary users currently authorized to the service. Group targets must
remain active and belong to that service. Publication validation reports
`policy_configuration_invalid` if an enabled rule becomes unassigned or its
group/user target becomes invalid.

## Explanation helper

`POST /api/v2/services/{service_id}/policy-simulations` accepts an authorized
ordinary user, persisted destination, method, path or allowed URL, and selected
credential UUIDs. It performs no downstream network call. One database
transaction snapshots live service access, group membership, credential
selectors, and policy rows before invoking the same pure evaluator used by the
legacy YAML adapter.

The response reports the canonical target, assignment outcome, applicable and
inapplicable rules, mismatch reason codes, selected priority/rules, default or
deny-tie decision, each boundary, and final result. Quick links are emitted
only for objects the viewer may inspect. The response excludes credential
values, vault metadata, opaque references, request bodies, headers, query
strings, and downstream data.

## Lifecycle, copy, and invalidation

Policy and rule mutations use strong ETags. Changes increment the boundary
evaluation generation and emit durable targeted invalidation metadata. Archive
disables every rule before permanent deletion is allowed.

Clone and import allocate new policy and rule UUIDs. Their closed versioned
documents contain only policy logic, selectors, and response safeguards.
Credential material, vault fields, grants, runtime references, and audit data
are neither copied nor accepted.

Atomic bulk copy accepts 1–20 complete policy sets. All source and target
services are authorized and all target boundaries/capacity are validated before
any row is written. Same-service selectors may be preserved. Cross-service
rules are always disabled and unassigned until an administrator explicitly
maps target principals. A durable batch UUID makes a matching retry return the
original set without creating duplicates; one invalid target rolls the entire
batch back.

## Browser API

- `GET|POST /api/v2/services/{service_id}/policies`
- `GET|PATCH|DELETE .../policies/{policy_id}`
- `POST .../policies/{policy_id}/archive|clone`
- `GET|POST .../policies/{policy_id}/rules`
- `GET|PATCH|DELETE .../rules/{rule_id}`
- `GET|PUT .../rules/{rule_id}/assignments`
- `GET .../policies/{policy_id}/copy`
- `POST .../policies/import|bulk-copy`
- `POST /api/v2/services/{service_id}/policy-simulations`

Schemas are closed and bounded. Routes are browser-session only, service
scoped, CSRF protected, no-store, and audited with safe categories. Create and
copy operations use durable idempotency; retryable outputs contain no secrets.

