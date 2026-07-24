# One-time V1 YAML migration

The host-local migration command imports portable V1 service interaction
configuration into a fresh V2 database exactly once. It does not import the V1
administrator, password hash, ACL identities, users, groups, assignments, OAuth
state, runtime references, or history. The original YAML and credential source
files are opened read-only and are never changed or removed.

Migration is not a compatibility mode. After a successful commit, the database
is the sole runtime authority. Do not mount the V1 file as a runtime service
configuration and do not run YAML and database authorities side by side.

## Prepare the V2 target

Build the production application, then prepare a target configuration with:

```yaml
runtime:
  authority: database

persistence:
  database_file: /var/lib/secretsauce/control.sqlite

services: {}
```

The complete target must also configure `identity`. Before migration, use the
documented identity bootstrap and enrollment flow to create and activate at
least one V2 superadmin. The migration refuses a missing or non-active
superadmin, a populated service database, an already-active runtime, or a
previously completed migration.

Stop the SecretSauce application process before dry-run or commit. Exactly one
process may own the target SQLite database, migration files, and recovery
directory. Keep the vault broker running only when importing credential values.

Set these host-local environment variables; do not put their paths or any
credential value in command arguments:

- `CONFIG_PATH`: the absolute V2 database-authority configuration path.
- `SECRETSAUCE_V1_CONFIG`: the absolute canonical V1 YAML path.

Run a non-mutating preview:

```bash
CONFIG_PATH=/absolute/path/to/v2.yaml \
SECRETSAUCE_V1_CONFIG=/absolute/path/to/v1.yaml \
npm run migrate:v1 -- dry-run
```

Dry-run validates the bounded source and deterministic conversion plan but does
not open SQLite or the vault for mutation. Its JSON report contains safe
fingerprints, generated service UUID/slug pairs, counts, warning-code counts,
and the outcome. It excludes local paths, source keys, destination hosts,
credential source names, ACL values, administrator fields, and secret material.

## Commit definitions without values

Review the dry-run report, keep the application process stopped, and run
the terminal-only commit:

```bash
CONFIG_PATH=/absolute/path/to/v2.yaml \
SECRETSAUCE_V1_CONFIG=/absolute/path/to/v1.yaml \
npm run migrate:v1 -- commit
```

The command displays the same plan and asks for the exact phrase
`MIGRATE V1 <source fingerprint prefix>`. It reopens and rehashes the source
after confirmation. Any source or plan change fails before mutation.

Without `--resolve-credentials`, all credential definitions are imported as
`unconfigured`. No V1 environment variable or file is read as a credential
value. One SQLite transaction creates draft services, disabled and unassigned
policy rules, durable remediation tasks, a safe audit event, the completed
one-time marker, and database-only runtime activation with no published
services.

## Optional credential-value import

Credential resolution is explicit. Add `--resolve-credentials` and provide
`SECRETSAUCE_MIGRATION_ALLOWLIST_FILE`, an absolute canonical regular file
owned by the operator or root with exact mode `0400`:

```yaml
version: 1
environment:
  - EXAMPLE_API_TOKEN
files:
  - /run/migration-secrets/example-api-token
```

Only exact listed V1 sources are considered. File values must also be canonical,
regular, safely owned, non-group/world-accessible files. Missing, unreadable,
unsafe, malformed, oversized, or unlisted values remain `unconfigured` with a
safe warning count. The allowlist is selection authority for this one command;
it is never installed as an ongoing credential provider.

Preview and commit with the flag:

```bash
CONFIG_PATH=/absolute/path/to/v2.yaml \
SECRETSAUCE_V1_CONFIG=/absolute/path/to/v1.yaml \
SECRETSAUCE_MIGRATION_ALLOWLIST_FILE=/absolute/path/to/allowlist.yaml \
npm run migrate:v1 -- dry-run --resolve-credentials

CONFIG_PATH=/absolute/path/to/v2.yaml \
SECRETSAUCE_V1_CONFIG=/absolute/path/to/v1.yaml \
SECRETSAUCE_MIGRATION_ALLOWLIST_FILE=/absolute/path/to/allowlist.yaml \
npm run migrate:v1 -- commit --resolve-credentials
```

Resolved commit additionally needs the control-only vault caller and the
complete restore recovery deployment:

- `SECRETSAUCE_VAULT_SOCKET`;
- `SECRETSAUCE_VAULT_CONTROL_KEY_FILE`;
- `SECRETSAUCE_VAULT_BACKUP_KEY_FILE`;
- `SECRETSAUCE_VAULT_BACKUP_CAPABILITY_KEY_FILE`;
- `SECRETSAUCE_RESTORE_DIRECTORY`;
- `SECRETSAUCE_RESTORE_RECOVERY_KEY_FILE`.

The restore directory, recovery key, database, vault store, and backup keys must
use the same stable private mounts documented in [Portable restore](restore.md).
Use the same control caller key mounted by the combined application, but keep
the application stopped while the migration command owns the database. The
control key cannot resolve or export credentials. Never mount vault root keys
or its encrypted store into the migration caller. Credential resolution is
terminal-only; do not add it to the ordinary gateway runtime.

After confirmation, the command re-reads the V1 YAML, allowlist, environment
values, and selected files. A change to any of them fails with
`migration_plan_changed` before recovery, vault, or database mutation. Before
the first vault write, the command creates authenticated encrypted recovery
state. A vault, SQLite, or health-gate failure restores both stores. If the
process stops during commit, preserve every stable mount and restart through
the normal recovery path before retrying or investigating.

## Result and remediation

The import creates no active service access. Every service remains a draft and
is absent from MCP discovery in both Codex and ChatGPT until V2 administrators:

1. assign a service administrator and intended users or groups;
2. supply every unavailable credential value;
3. review policy targets and deliberately enable appropriate rules;
4. validate destinations and credential behavior;
5. publish the service.

The completed marker permanently rejects reruns, including the same source.
Retain the original V1 files according to your own evidence and backup policy,
but remove them from runtime mounts and automation. The source is not a rollback
authority. Use V2 portable backup/restore for subsequent recovery.

## Safe failure response

The command writes only stable JSON error codes to stderr. Common operator
actions are:

- `terminal_required`: run commit directly in an interactive host/container
  terminal; dry-run may remain non-interactive.
- `database_runtime_required`: use an empty `services: {}` V2 configuration
  with `runtime.authority: database` and durable persistence.
- `bootstrap_required`: finish V2 bootstrap and activate at least one
  superadmin.
- `migration_plan_changed`: repeat dry-run and review the new report; do not
  bypass source, allowlist, or value-change detection.
- `vault_recovery_required` or a vault/recovery error: preserve recovery files,
  verify the complete stable mounts and broker readiness, and follow the
  fail-closed recovery procedure.
- `already_completed`: do not merge or rerun. Continue with the persisted V2
  remediation tasks.

Do not troubleshoot by printing the V1 YAML, allowlist, credential files,
environment, vault identifiers, recovery artifacts, `Authorization` headers,
cookies, or downstream response bodies.
