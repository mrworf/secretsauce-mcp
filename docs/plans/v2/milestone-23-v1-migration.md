# Milestone 23 V1 Migration Plan

## Outcome and authority boundary

Milestone 23 adds one host-local command that converts the legacy YAML service
registry into the v2 database/vault once. The target `CONFIG_PATH` must already
load as `runtime.authority: database` with `services: {}`, durable persistence,
identity, and at least one active superadmin. The legacy source is supplied
separately through `SECRETSAUCE_V1_CONFIG`; the running gateway and control
processes must be stopped so the CLI can own SQLite and the vault migration
boundary.

Migration imports only portable interaction configuration. It creates new
UUIDv7 identities for every service, destination, credential, policy, and rule,
preserves an existing service slug only when it is already a unique valid v2
slug, and creates draft services with disabled/unassigned policies. It never
imports a v1 administrator, password hash, ACL identity, user, group,
membership, service administrator, assignment, OAuth record, runtime reference,
operational history, deployment setting, or ongoing environment/file provider.
On success the database runtime is activated with an empty active-service set;
later validated publication adds services to MCP one at a time. YAML is never a
fallback or second authority.

## CLI and source identity

Add `npm run migrate:v1 -- dry-run` and `npm run migrate:v1 -- commit`.
`--resolve-credentials` is the only optional flag and may follow either
subcommand. Unknown, duplicate, missing, or conflicting arguments fail with one
stable code. Dry run may write a sanitized JSON report to stdout but never opens
SQLite or the vault for mutation. Commit requires both input and output TTYs,
prints the same report, and prompts for the exact phrase
`MIGRATE V1 <first 12 source SHA-256 characters>`. No password, credential
value, ACL identity, or source path is accepted as an argument or echoed.

The source identity is SHA-256 over the exact bounded YAML bytes. The conversion
plan uses UUIDv7 values generated once in canonical traversal order and a
domain-separated SHA-256 over the source identity, option mode, canonical
portable projection, source-resolution dispositions, discarded counts, and
generated IDs. Commit reopens and rehashes the YAML, re-resolves each selected
source, rebuilds the canonical plan with the same ID map, and compares the exact
digest after confirmation but before recovery or vault/database mutation. A
source, environment value, file value, allowlist, or plan change fails with
`migration_plan_changed`.

CLI output is one closed JSON report with:

- source schema/version and SHA-256;
- plan digest and resolution mode;
- imported service/destination/credential/policy/rule counts;
- configured/unconfigured credential counts;
- discarded ACL entry count;
- retained/generated slug counts;
- generated service UUID/slug pairs;
- bounded warning-code counts, confirmation phrase for commit, and outcome.

Reports, errors, logs, and audit omit the v1 path, service source keys,
destination hosts, credential/source names and paths, ACL values, administrator
fields, environment values, secret bytes/digests/lengths, and raw YAML.

## Bounded v1 parser

Add a migration-only parser; production database-authority startup never calls
it. Read one canonical absolute regular source file without following a link,
bounded at 16 MiB. Decode strict UTF-8 and YAML core schema with duplicate keys
rejected, aliases/tags disabled, at most 100,000 nodes, depth 32, scalar size
1 MiB, 10,000 total portable objects, 2,000 rules per policy, 64 destinations
per service, 128 ACL values per service, and closed known v1 fields. The absent
legacy version is reported as schema `1`; an explicit version other than `1` is
unsupported.

The parser validates but does not resolve `auth`, built-in administrator,
credential source, or other deployment secret fields. It extracts only
`services` and counts `access.users`; all other accepted v1 top-level domains
are structurally recognized and discarded. Sanitized YAML failures use the
existing masked line/column diagnostic style and stable reason codes without
including file paths or scalar text. Validation never writes the database,
vault, source YAML, or credential files.

## Deterministic conversion

Canonical traversal sorts services by source key; destinations, credentials,
and rules use source order plus stable source IDs. For each service:

- retain the exact source key only when it matches
  `^[a-z][a-z0-9-]{0,63}$` and is unique; otherwise generate
  `migrated-<12 hex>` from a domain-separated source-key hash, extending the
  suffix deterministically on collision;
- normalize the service profile through the v2 profile validator and set
  lifecycle `draft`;
- use a valid unique legacy destination `id`/`name` as its slug or generate
  `destination-<ordinal>-<hash suffix>`, then require the exact v2 canonical
  URL, scheme/host/port, anchored linear-time regex, and TLS validators;
- convert every credential to one v2 definition with a bounded normalized
  display name, validated placement, `unconfigured` status by default, and no
  persisted source kind/name/path;
- create one active service-bound policy named `Migrated service policy`, map
  legacy mode exactly, create one new rule UUID per legacy rule, validate
  methods and anchored linear-time host/path regexes through v2 matchers, carry
  the supported response safeguards, and force every rule disabled with no
  principal assignments.

Unsafe destinations, ambiguous URLs, unsupported placements, unsafe policy
regexes, duplicate normalized names, generated-slug collision exhaustion, and
any v2 canonicalization mismatch reject the plan instead of broadening access.
Empty policy rules remain a deny-by-default boundary.

## Opt-in credential source resolver

`--resolve-credentials` additionally requires
`SECRETSAUCE_MIGRATION_ALLOWLIST_FILE`. The allowlist is an absolute canonical
regular mode-`0400` file with safe ownership and a closed schema:

```yaml
version: 1
environment:
  - EXAMPLE_API_TOKEN
files:
  - /run/migration-secrets/example-api-token
```

Lists are unique, sorted during normalization, and bounded to 10,000 entries.
Environment resolution uses exact names only. File resolution uses exact
canonical allowlisted paths only, rejects links and non-regular files, requires
owner/root ownership with no group/world permission, and reads at most 65,536
bytes. Values must be non-empty strict UTF-8 without NUL after matching the v1
file-source trim behavior and must remain within 65,536 UTF-8 bytes.

An unselected, absent, disallowed, unreadable, empty, malformed, or oversized
source produces only an `unconfigured` disposition and a safe warning code; it
does not fail non-secret migration or disclose which source failed. Resolved
buffers stay in memory until the vault write, are never included in canonical
reports/persistent plans, and are zeroed after every success/failure. The plan
binds each value with a process-memory keyed digest so commit can detect a
change without persisting or reporting a reusable secret verifier.

## Persistence, vault staging, and rollback

Migration 0023 adds:

- singleton `v1_migration_state` with `pending|completed`, migration/source/
  plan IDs and hashes, schema version, safe counts, resolution mode, activation
  generation, completion time, and version;
- `migration_remediations` keyed to the completed migration and imported
  service/optional target, with fixed task kinds for assigning administrators,
  assigning access, supplying credentials, reviewing/enabling policy, and
  validating/publishing service.

Commit obtains exclusive SQLite ownership and rechecks: migration is pending,
no service/domain row exists, runtime activation is inactive, no active runtime
snapshot exists, and at least one active superadmin survives. A completed or
partially populated target is a stable conflict; migration never merges with or
deletes v2 service configuration.

When no value resolves, one SQLite transaction inserts all portable rows,
remediations, the completed marker, safe local-CLI audit, and changes
`runtime_activation` from inactive to active with no active service snapshots
while incrementing activation and global-reference generations. This transaction
is the sole mutation and rolls back completely on failure.

When at least one value resolves, commit additionally requires the control
vault caller plus the complete backup/recovery deployment used by restore. It
uses the existing encrypted recovery manager before the first vault write,
advances the authenticated journal to `vault_applied` before mutation, and
creates records through the control caller with deterministic locators and exact
new service/credential bindings. Returned generation/locator metadata is bound
into the one database transaction. Any vault, transaction, or post-commit
database/schema/vault health failure restores both the pre-migration vault and
SQLite snapshot. A successful health gate removes recovery artifacts. Startup
recovery uses the existing pre-listener authenticated journal path after a
crash. Values and recovery DEKs are zeroed in all outcomes.

The database transaction preserves target identities/settings/audit, creates no
assignments/groups/publications, invalidates legacy runtime continuity through
the new database activation/global reference generations, and records one
sanitized `migration.v1.commit` event from a bounded host OS actor. The source
YAML, allowlist, and source credential files are opened read-only and never
renamed, chmodded, rewritten, or deleted.

## One-time behavior and operations

The completed marker permanently rejects rerun, including the same source. The
operator changes the deployed v2 config to database authority before running
the command, stops all gateway/control processes, performs dry run, bootstraps
and activates at least one v2 superadmin if needed, then commits. After success,
the source YAML may remain as an operator-retained artifact but must not be
mounted as runtime service authority.

Every imported service remains absent from MCP discovery until administrators
complete its persistent tasks: assign a service administrator, assign intended
users/groups, supply every unavailable credential, review and explicitly enable
policy rules, validate destinations, and publish. Publication while database
runtime is active creates the first active snapshot without a second activation
ceremony.

## Minimal delivery slices

1. Migration 0023, strict singleton/remediation repositories, bootstrap/empty-
   target/rerun invariants, positive/negative/boundary tests.
2. Bounded migration-only v1 YAML reader and closed schema with safe diagnostics,
   identity/ACL exclusion, complexity/object limits, and source-preservation
   tests.
3. Deterministic v1-to-v2 converter with new UUIDs, slug rules, strict
   destination/placement/policy mapping, canonical digest/report, and fixtures.
4. Mode-restricted exact source allowlist and bounded resolver with selected/
   disallowed/missing/unreadable/malformed/oversized/value-change tests and
   buffer-zeroization checks.
5. Atomic non-secret database import, database-only zero-service activation,
   complete exclusion assertions, fixed remediation creation, invalidation,
   audit, and rollback injection.
6. Opt-in vault import coordinated through encrypted recovery, deterministic
   locator/binding, fault/crash rollback, health gate, and real broker process.
7. Terminal commit/dry-run CLI, stable safe output/confirmation/error codes,
   target/source separation, TTY/argument/concurrency/rerun tests, and package
   command.
8. Operator/migration/deployment documentation, production build, OpenAPI
   currency, full acceptance review, and milestone status.

Each completed slice receives positive and negative tests, the full regression
suite, and one concise commit. Durable findings are added to `AGENTS.md`.

## Acceptance matrix

- Parsing: valid implicit-v1/full/partial/Unicode fixtures pass; unreadable,
  linked, oversized, malformed, duplicate-key, alias/tag, depth/node/scalar/
  object/ACL/rule limit, unknown schema/field, and unsafe config fail without
  mutation or scalar/path disclosure.
- Conversion: every object receives a new UUIDv7; only valid unique slugs
  survive; generated slugs are stable within the exact plan; v2 canonical
  destination/placement/policy constraints hold; rules are disabled and
  unassigned; reports disclose no ACL/source/secret detail.
- Secrets: no opt-in performs no source read; exact allowlist permits only safe
  sources; missing/unreadable/unselected values become unconfigured; selected
  values reach only exact vault bindings and buffers are cleared; source/value/
  allowlist changes reject before mutation.
- Commit: active superadmin and empty inactive v2 service target are required;
  imported services remain drafts; no users/groups/admins/assignments/OAuth/
  history/provider state is imported; source files remain byte-identical;
  completed marker and concurrent ownership prevent rerun.
- Atomicity: parser/plan/confirmation failures do no work; non-secret database
  injection rolls back; every resolved-secret vault/transaction/health/crash
  phase restores both stores; no partial locator or recovery plaintext remains.
- Authority/remediation: database activation and reference generations advance,
  YAML never participates at runtime, MCP discovers no imported service before
  remediation/publication, and exact durable tasks cover access, values,
  policy review, validation, and publication.
- Delivery: sanitized local audit/report/error output, production server/web
  builds, unchanged MCP/OpenAPI contract, and the complete regression suite pass.
