# Persisted Runtime Authorization

SecretSauce can run MCP from one of two mutually exclusive authorities:

- `runtime.authority: yaml` reads the configured YAML services.
- `runtime.authority: database` reads only activated, immutable snapshots built
  from published v2 database configuration.

Database authority requires `persistence.database_file` and an empty YAML
`services` map. Startup rejects mixed authority. After activation there is no
automatic YAML fallback: an unavailable database, schema, activation, or vault
makes readiness fail closed.

## Activation

Before activation, publish at least one valid service and configure its
destinations, assignments, credentials, vault records, and policies in the
control plane. Use a database-authority configuration such as:

```yaml
runtime:
  authority: database

persistence:
  database_file: /var/lib/secretsauce/control.sqlite

services: {}
```

Stop the gateway process that owns the database, then run the activation command
from an interactive terminal:

```bash
CONFIG_PATH=/absolute/path/to/config.yaml npm run runtime:activate-v2
```

The command accepts no arguments and requires the exact confirmation
`ACTIVATE V2`. It atomically creates active snapshots for every published
service and records a sanitized administrative audit event. Activation is
one-way in this milestone: a second activation is rejected, and rollback to
YAML authority is not automated. Back up the database and vault before the
cutover.

## Runtime vault boundary

The database stores credential metadata, an opaque vault locator, and a
generation—not credential values. The gateway process needs only:

- `SECRETSAUCE_VAULT_SOCKET`
- `SECRETSAUCE_VAULT_DATA_KEY_FILE`
- `SECRETSAUCE_VAULT_RESOLVE_KEY_FILE`

Mount the data-plane and resolve-capability caller keys read-only. Do not mount
the vault root, control, backup, encrypted-store, or other caller keys into the
gateway container.

For every request, SecretSauce authenticates the user UUID; checks current
service and credential assignments; canonicalizes and validates the
destination; validates reference placement and bindings; evaluates the service
policy and every used credential policy; and admits capacity before issuing a
single-use, operation-bound vault resolve capability. The returned secret
buffer exists only inside the downstream callback and is zeroed afterward.

## Snapshots, references, and invalidation

Draft and invalid configuration never enters an active snapshot. Publication
creates a new immutable snapshot and moves the active pointer atomically. One
request uses one consistent snapshot; committed assignment, credential, and
policy invalidations are reconciled before the next authorization read.

`gref_` and `sec_` references are bound to the authenticated UUID, immutable
service and destination IDs, publication and authorization generations,
security epoch, and global reference epoch. Credential references also bind the
credential authorization generation. Policy-only changes are reevaluated on
the next request without unnecessarily revoking otherwise valid references.
Account, service, assignment, publication, and credential changes invalidate
the affected scope.

References remain bounded, in-memory capability state. They expire on gateway
restart and cannot be shared across replicas. The supported topology is one
gateway runtime.

## Readiness and operations

In database mode, `/health` returns `503` unless all of these are ready:

- `checks.database`
- `checks.schema`
- `checks.runtime_activation`
- `checks.vault`

The response contains stable status categories only. Monitor readiness, the
writable audit volume, database durability, vault durability, and invalidation
processing. Runtime audits contain immutable IDs or safe names and never raw
credentials, opaque references, request bodies, Authorization headers, cookies,
or downstream response bodies.

