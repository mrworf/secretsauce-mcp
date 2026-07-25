# Milestone 12 Implementation Plan: Policy Management And Explanation

## Scope review

Milestone 12 adds durable policy sets at service and credential boundaries,
principal-aware rules, deterministic multi-boundary evaluation, structured
explanations, safe copy operations, strict management/simulation APIs, and a
responsive Policies workspace. It extends the current YAML policy evaluator
through one canonical snapshot algorithm; it does not make database policy
runtime-authoritative until Milestone 13.

The work does not add an enterprise policy language, group precedence,
semantic HTTP-risk scoring, query-string matching, linked templates,
credential values, runtime references, or service-specific tools/profile
packs. Policy evaluation continues to use the exact canonical pathname sent
downstream and never performs network I/O.

## Persistent model and limits

Migration `0011` adds service-first tables:

- `policies`: immutable UUIDv7, service UUID, exactly one service or credential
  boundary, bounded name/description, operating mode `allow|deny` defaulting to
  `deny`, lifecycle `active|archived`, evaluation generation, version, and
  timestamps;
- `policy_rules`: immutable UUIDv7, policy/service UUID, bounded name/reason,
  `allow|deny`, signed bounded integer priority, enabled state, canonical
  method/host/path matcher JSON, response-safeguard JSON, version, and
  timestamps;
- `policy_rule_principal_assignments`: normalized `all|group|user` rows with
  same-service group ownership and active ordinary-user validation; and
- `policy_invalidation_events`: durable service/boundary events with optional
  affected ordinary-user UUID, generation, safe reason, dispatch state, and
  timestamps.

Migration `0012` adds scoped policy-copy batch membership so an atomic
multi-policy operation can retain one UUID result reference in durable
idempotency storage and resolve the original ordered results on replay.

There is at most one active policy per boundary. Initial limits are 20,000
rules installation-wide, 2,000 per policy, 64 methods, 64 host selectors, 128
path selectors, and 1,000 explicit principals per rule. Lists are service-first
and deterministically ordered by boundary, priority descending, effect
(`deny` first), name, and UUID.

## Canonical matchers and selectors

Managed rules normalize methods to unique uppercase HTTP tokens. An empty
method list means any method. Host selectors are explicit exact DNS/IP, suffix
DNS, or anchored regex matchers. Database-managed regex uses the same bounded,
anchored, linear-time subset as managed destination regex; arbitrary
management-supplied JavaScript regular expressions are never executed.

Path selectors are explicit exact or segment-prefix canonical pathnames, or
anchored patterns in a bounded linear subset. Inputs must begin with `/`, use
canonical UTF-8 URL spelling, and reject percent escapes that can change
routing semantics, including alternate spellings of unreserved bytes,
slash/backslash, NUL, and percent. Query and fragment text are not policy
inputs. The simulator resolves a relative path or allowed absolute URL through
the selected persisted destination and reuses the gateway canonical target
validator without downstream I/O.

Each enabled rule has exactly one explicit selector:

```text
{ kind: "all" }
{ kind: "groups", group_ids: [UUID, ...] }
{ kind: "users", user_ids: [UUID, ...], direct_assignment_confirmed: true }
{ kind: "principals", group_ids: [...], user_ids: [...],
  direct_assignment_confirmed: true }
```

`all` means every active ordinary user already authorized to the parent
service. Direct users require the visible group-preference confirmation.
Empty, duplicate, inactive, privileged, cross-service, or open selector input
fails closed. Disabled or archived rules never match; a rule without a valid
selector cannot be enabled.

## One evaluator and explanation contract

`src/policy.ts` becomes the canonical pure evaluator over an immutable
`PolicyEvaluationSnapshot`. The current YAML `evaluatePolicy` entry point is a
compatibility adapter into that same evaluator, preserving gateway behavior
and response-safeguard selection. The persisted simulator and Milestone 13
runtime adapter consume the identical function and reason codes.

For each boundary the evaluator:

1. evaluates current ordinary-user identity and group memberships;
2. records selector applicability for each enabled rule;
3. matches normalized method, canonical host, and exact downstream pathname;
4. selects only the greatest numeric priority;
5. makes `deny` win every equal-priority tie;
6. otherwise allows when the selected rules allow; and
7. applies the boundary operating mode when no rule matches.

The final outcome is `allow` only when the service boundary and every selected
credential boundary allow. A credential allow cannot override service denial,
and one denied credential denies the request.

The evaluator returns safe structured data: canonical target, user/group UUIDs,
assignment results, per-rule applicability and match/mismatch reason codes,
selected priority, selected rule UUIDs, tie/default reason, response safeguard
source, every boundary result, and final result. It contains no credential
value, locator/generation, reference, request body, Authorization/cookie
header, downstream response, or unauthorized display metadata.

## Repository, lifecycle, and copy semantics

Assigned admins manage policy only inside currently assigned services;
superadmins manage all services. Scope is checked before child existence.
Policy/rule/selector changes require current strong ETags, atomically audit a
sanitized diff, increment the boundary generation, and emit a targeted
invalidation event. Archive disables the boundary and rules before permanent
delete. Publication validation rejects unsafe or incomplete active policies.

Clone allocates new policy/rule UUIDs and copies only logic, safe response
safeguards, and selectors that remain valid in the same service. Copy/paste
uses a closed versioned document and never contains credentials, vault fields,
secrets, runtime references, grants, audits, or activity.

Bulk copy accepts explicit source policy/rule UUIDs and an explicit permitted
target boundary. It allocates all new IDs and validates target collisions and
principal mapping before one transaction. Same-service groups/users may be
preserved. Cross-service copies default to disabled and unassigned; principals
must be explicitly remapped to active target-service groups/users before rules
can be enabled. Partial copy is prohibited.

## APIs, simulation, audit, and browser UX

Browser-only management routes include:

- `GET|POST /api/v2/services/{service_id}/policies`;
- `GET|PATCH|DELETE .../policies/{policy_id}`;
- `POST .../policies/{policy_id}/archive|clone`;
- `GET|POST .../policies/{policy_id}/rules`;
- `GET|PATCH|DELETE .../rules/{rule_id}`;
- `GET|PUT .../rules/{rule_id}/assignments`;
- `GET .../policies/{policy_id}/copy`;
- `POST .../policies/import|bulk-copy`; and
- `POST /api/v2/services/{service_id}/policy-simulations`.

Schemas are closed and bounded. Mutations use service scope, CSRF, ETags, and
durable idempotency where retries can duplicate work. Reads and simulations
are `no-store`. Simulation requires a currently authorized viewer, service,
ordinary user, destination, method, path/allowed URL, and selected credential
UUIDs. It snapshots live service access, groups, credential selectors, and
policy rows in one persistence command before calling the pure evaluator.

Audit events record actor, service/policy/rule UUIDs, safe matcher categories
and counts, selector kinds/UUIDs, priority/effect/mode/status, outcome reason
codes, and simulation target categories. They never record raw request bodies,
credential material, headers, query strings, URLs containing userinfo, opaque
references, or downstream bodies. Activity emits only policy-defined rule or
boundary-default categories for later dashboards.

The `/control/policies` workspace is service-first. Wide layouts provide a
bounded rule table and editor beside a simulation/explanation panel. Narrow
layouts preserve boundary, mode, rule identity/effect/priority/status, and
final outcome before secondary actions. Direct-user warnings, default-deny
state, deny tie-breaks, disabled/unassigned remediation, safe copy previews,
and stale-conflict recovery remain visible. Quick links are generated only for
objects the current viewer is authorized to inspect.

## Delivery slices and acceptance

1. Migration, normalized matcher/selector contracts, shared evaluator,
   YAML-compatibility adapter, positive/negative/boundary unit tests, and a
   concise commit.
2. Scoped policy/rule repository and service, lifecycle, ETags, invalidation,
   clone/copy/import/bulk-copy, publication validation, atomic sanitized audit,
   and positive/negative persistence tests.
3. Transactional snapshot builder and explanation/simulation service with
   service/credential assignment intersection, authorized links, concurrency
   cases, and table-driven simulator/evaluator parity fixtures.
4. Strict scoped routes, production wiring, generated OpenAPI, durable
   idempotency, no-store responses, cross-service/stale/open-input tests, and a
   concise commit.
5. Responsive Policies workspace, safe copy and simulation flows, direct-user
   confirmation, narrow-layout/browser tests, and a concise commit.
6. Operator/security documentation, acceptance review, production build,
   current OpenAPI, full regression suite, milestone status, and final concise
   milestone commit.

Acceptance requires the service and every used credential boundary to
independently allow, exact highest-priority/deny-tie/default behavior, one
evaluator for enforcement and explanation, safe scoped editors/copy, complete
authorized explanations, no secret-bearing outputs, and the full suite passing.
