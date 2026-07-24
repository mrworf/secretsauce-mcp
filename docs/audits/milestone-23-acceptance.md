# Milestone 23 acceptance review

## Outcome

Milestone 23 is accepted. SecretSauce now provides a one-time, host-local,
auditable migration from bounded V1 YAML service configuration into the V2
database and vault while excluding V1 identity/ACL authority and leaving every
imported service inaccessible pending explicit V2 remediation and publication.

## Evidence

- Migration 0023 persists a strict pending/completed singleton marker and fixed
  per-service remediation tasks. Preflight requires one active superadmin, an
  empty service domain, inactive database runtime, and no active snapshots;
  populated, partial, concurrent, and completed targets fail closed.
- The migration-only source reader opens one absolute canonical regular file
  without following links, fingerprints exact bounded bytes, decodes strict
  UTF-8 and closed core-schema YAML, rejects aliases/tags/duplicates and excess
  depth/nodes/scalars/objects/rules/ACL entries, and reports only safe reason and
  position data.
- Parsing structurally discards the V1 administrator/password hash, ACL
  identities, users, groups, assignments, OAuth/reference state, settings, and
  history. Tests prove sensitive identities and values do not enter the portable
  source projection or diagnostics and that source bytes remain unchanged.
- Deterministic conversion creates new UUIDv7 identifiers for every imported
  object, retains only valid unique service slugs, generates collision-safe
  replacements, revalidates canonical V2 destinations/TLS/placements/policies,
  and forces services to draft with disabled, unassigned rules.
- The canonical report and plan digest contain safe counts, warning counts,
  source identity, and resulting service UUID/slug pairs. They exclude raw YAML,
  paths, destination hosts, source names, ACL identities, administrator fields,
  and credential bytes or reusable value verifiers.
- Optional credential resolution requires an exact canonical mode-`0400`
  allowlist. Environment/file names are matched exactly; selected files must be
  canonical regular safely owned files with safe modes and bounded strict UTF-8
  values. Missing, disallowed, unreadable, unsafe, malformed, and oversized
  sources become warning-only `unconfigured` dispositions.
- Resolution binds the exact allowlist bytes and selected values into a
  process-keyed plan digest. Value buffers and the in-memory binding key are
  cleared after success and every failure. No environment/file provider is
  persisted as ongoing runtime authority.
- Definitions-only commit inserts all portable rows, remediations, safe audit,
  completed marker, activation/reference invalidation, and a database-only
  zero-service activation in one SQLite transaction with fault-injected
  rollback coverage.
- Resolved commit advances authenticated encrypted recovery before the first
  vault mutation, writes deterministic exact service/credential-bound records,
  commits returned locator generations atomically with metadata, verifies
  database/schema/audit/vault health, and restores both SQLite and vault after
  injected vault, transaction, and health failures.
- Real standalone broker-process tests prove credential creation, exact
  metadata, recovery artifact cleanup, and two-store rollback rather than only
  mocked socket behavior.
- The host-local CLI separates `CONFIG_PATH` from
  `SECRETSAUCE_V1_CONFIG`, performs mutation-free dry-run, requires input/output
  terminals and an exact source-fingerprint phrase for commit, and reopens the
  source after confirmation. Credential mode also re-reads and binds the exact
  allowlist and selected environment/file values before any mutation.
- CLI argument, TTY, target, source, confirmation, source-change, value-change,
  allowlist-change, rerun, and safe-output behavior have positive and negative
  tests. Errors are stable JSON codes and do not include local paths or source
  content.
- Operator guidance documents bootstrap, stopped-process ownership, default
  definitions-only migration, opt-in allowlisting, temporary control-vault
  authority, stable recovery mounts, crash response, permanent database
  authority, and the complete Codex/ChatGPT remediation path.

## Verification

- Focused migration state, parser, conversion, resolver, database commit,
  resolved commit, real broker-process, CLI, and documentation tests: passed.
- Positive, negative, boundary, concurrent/rerun, source-preservation,
  exclusion, sanitized-output, fault-injection, and recovery fixtures: passed.
- Production TypeScript and Vite build: passed.
- Control OpenAPI currency check: passed; migration remains host-local and adds
  no management HTTP surface.
- Full regression with loopback/private-socket permission: 136 files and 924
  tests passed.

## Delivery commits

- `a319a9b` — decision-complete milestone plan
- `aac95d9` — durable migration state and remediation
- `5727609` — bounded closed V1 source parser
- `afffe99` — deterministic strict V2 conversion
- `3b046e9` — allowlisted credential resolution
- `43d7465` — atomic definitions-only database commit
- `299605d` — recovery-coordinated resolved commit
- `ed70892` — terminal dry-run/commit CLI

## Residual boundaries

- Migration is deliberately one-time and only targets a fresh, empty V2 service
  domain. It does not merge configurations or support ongoing dual authority.
- The V1 source and credential files are preserved but are not rollback or
  runtime authorities after success.
- Unselected or unusable values remain unconfigured. The migration does not
  invent placeholder secrets, infer access assignments, or enable policies.
- Imported services remain drafts and absent from MCP discovery in both Codex
  and ChatGPT until administrators complete access, credential, policy,
  validation, and publication remediation.
- Resolved commit availability depends on operator custody of the stable
  database, vault store, backup caller/capability keys, restore directory,
  recovery key, and temporary control caller key. Fail-closed recovery is not
  bypassable when that material is missing or changed.
- The supported deployment remains one database-owning gateway/control process;
  migration is not a distributed coordinator.
