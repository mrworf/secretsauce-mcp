# Milestone 23: V1 Migration

## Purpose and why

Provide a one-time, auditable transition from the v1 YAML service configuration to the v2 database/vault without importing obsolete single-user identity or leaving two competing configuration authorities.

## Dependencies

- Milestones 04, 13, and 22.

## PRD traceability

- Section 28: migration form, identity, configuration, and credentials.
- Sections 34.6, 37–38, and 40: acceptance, documentation, compatibility, and settled migration decisions.
- Sections 31–32: safe diagnostics and startup readiness.

## Scope

- Add a host-local CLI with dry run, sanitized validation/report, explicit commit, and transactional rollback.
- Require secure v2 superadmin bootstrap before migration commit.
- Import service metadata, stable valid/unique slugs, destinations/TLS, credential metadata, and policies using new internal UUIDs.
- Import no users, provider links, built-in v1 administrator/password hash, `access.users` identities, groups, memberships, admin assignments, OAuth state, or inferred assignments.
- Report discarded ACL entry counts without unnecessary identity disclosure.
- Optionally and explicitly resolve v1 environment/file credential sources, normalize clean values, and write them through the vault capability.
- Mark missing/unreadable/unselected credential sources `unconfigured`.
- Preserve the original YAML and source files and invalidate all v1 OAuth/reference state.
- On success, set the database as sole runtime configuration authority and create persistent assignment/remediation tasks.

## Not in scope

- Ongoing dual YAML/database authority.
- Automatic users/groups/admin assignments from v1 ACL values.
- Keeping environment/file sources as ongoing credential providers.
- Rewriting or deleting the original YAML/source files.
- Importing operational history.

## Required behavior and interfaces

- Dry run and commit use the same validated source identity and deterministic conversion plan.
- Stable service slugs are retained only when valid/unique; every imported object receives a new immutable UUID.
- Resolution of credential sources is opt-in and never includes values in reports, shell arguments, logs, or audit.
- Imported services remain inaccessible until v2 admins, groups/users, bindings, enabled policies, and credentials are configured.
- Any validation/import failure leaves active v2 state unchanged and retains the source untouched.

## Security, authorization, invalidation, and audit

- Migration requires direct host authority and a verified bootstrapped v2 installation.
- File/environment resolution is allowlisted, bounded, and does not create a second runtime secret authority.
- Reports/audits contain counts, source schema/version, imported IDs, warnings, and outcome but no ACL identities or secret values.
- Successful commit invalidates preexisting v1 grants/references and records sole-authority activation.

## Tests

- Positive: valid full/partial fixtures, dry run, explicit commit, stable slug preservation, opt-in secret resolution, unconfigured fallback, remediation creation, and source preservation.
- Negative: malformed YAML/schema, duplicate/invalid slugs, unsafe destination/policy, missing bootstrap, missing/unreadable source, secret resolution without opt-in, report leakage, commit-plan mismatch, and injected transaction/vault failure.
- Boundary: maximum YAML/object/ACL counts, aliases/depth/size, Unicode values, duplicate ACLs, concurrent startup/migration, and rerun after success.
- Integration: compare converted database/vault/runtime state and prove no users/ACL identities or ongoing env/file authority were imported.

## Acceptance criteria

- V1 service interaction configuration can be previewed and imported once without changing its source files.
- No v1 user, administrator credential, ACL identity, OAuth state, or reference is imported.
- Database becomes the only runtime authority after successful commit.
- Imported services are safe/inaccessible until explicit v2 remediation is complete.

## Planning handoff

Specify CLI UX/confirmation, source fingerprint, parser/resource limits, conversion mapping and UUID/slug rules, credential source resolver sandbox, transaction/vault staging, rerun/idempotency marker, remediation records, report schema, and fixture catalog.
