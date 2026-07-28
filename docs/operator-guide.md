# SecretSauce v2.1 operator guide

This is the release operations index for the supported topology: one
SecretSauce application process owning the gateway and control listeners plus
their single SQLite writer, and one isolated vault broker. Read the linked
focused guides before the corresponding destructive or recovery operation.

## Install and bootstrap

1. Build or pull the pinned image and copy
   [`docker-compose.example.yaml`](../docker-compose.example.yaml),
   [`examples/config-v2.1.yaml`](../examples/config-v2.1.yaml), and
   [`examples/vault.yaml`](../examples/vault.yaml) without changing their
   container target paths.
2. Review the public MCP/OAuth and control origins, allowed client-metadata
   origins, source-trust mode, and storage ownership. The vault entrypoint
   generates the fixed v2.1 key registry into the durable generated-key
   volume; do not run a key-initialization CLI or inject those key values
   through environment variables.
3. Keep the backend listeners private. Use the separate
   [MCP/OAuth proxy](../examples/proxy-mcp-oauth.haproxy.cfg) and
   [control proxy](../examples/proxy-control.haproxy.cfg) examples when the
   surfaces use separate public origins.
4. Run `docker compose -f docker-compose.example.yaml up --build`. Both
   services start concurrently. Before provisioning and validation complete,
   only bounded setup/liveness surfaces are available; the vault remains
   networkless. Require sanitized readiness before exposing either public
   origin. `npm run start:gateway` and `npm run start:control` are diagnostic
   single-surface entrypoints, not a supported concurrent database topology.
5. Read the clearly labeled initial enrollment secret from the current
   application container log, protect it as temporary root enrollment
   authority, open **Enroll account** in the browser, and complete
   [local bootstrap and enrollment](local-authentication.md). Log retention and
   forwarding can retain that accepted bootstrap value, so restrict access and
   retention. A restart invalidates unused process-lifetime enrollment
   authority and emits a replacement only while the database has zero users.
6. Configure services, groups, credential definitions, policies, and
   publication through the focused
   [service](service-management.md), [group](group-assignments.md),
   [credential](credential-management.md), and
   [policy](policy-management.md) guides.

Portable restore is intentionally not enabled by the clean Compose example.
Enable it only by adding the private durable restore directory, a distinct
stable recovery-key file, and both variables specified in
[Portable restore](restore.md). Adding only one input fails startup.

## Public URL contract

For a built-in OAuth deployment, `server.resource` and the OAuth issuer are the
origin only:

```yaml
server:
  resource: https://mcp.example.org
auth:
  builtin_oauth:
    issuer: https://mcp.example.org
```

Codex and ChatGPT receive the MCP Server URL including the MCP path:
`https://mcp.example.org/mcp`. The browser control origin is distinct, for
example `https://control.example.org`, and must match `control.public_origin`.
Do not expose the vault socket, vault store, or direct backend listeners.

## Daily administration

- Use [operator dashboards](operator-dashboards.md) for sanitized status,
  activity freshness, capacity warnings, and remediation.
- Use [audit search and retention](audit-search-retention.md) for scoped
  investigation. Monitor disk space and treat degraded audit readiness as an
  operational incident.
- Use [access management](access-management.md) and
  [API-key management](api-key-management.md) for revocation and rotation.
- Use [security settings](security-settings-automation.md) for session,
  password, step-up, and bounded maintenance-job policy.
- Use the [management API reference](management-api.md) for automation.

## Backup, restore, and migration

- Follow [portable backup](backup-export.md) and independently protect stable
  keys that the archive deliberately excludes.
- Follow [portable restore](restore.md) for staging, preview, exact
  confirmation, maintenance, restart recovery, and post-restore revocation.
- Follow [V1 migration](v1-migration.md) only against a stopped, empty target.
  Complete every durable item in the Recovery tasks workspace before
  publication.

Never persist runtime `gref_…` or `sec_…` references. Persist SQLite, vault
store/root keys, OAuth signing and HMAC keys, audit, and restore recovery state.
Back up key material separately from application archives.

## Envelope-root rotation

Only the host-local vault entrypoint may rotate the configured `identity` or
`vault` envelope root. Before starting, take a consistent backup of the
database, vault store, generated-key volume, and setup-state volume. Stop the
ordinary application and vault processes together; do not leave the
application SQLite writer running.

Start the vault with exactly one target and a fresh canonical UUID:

```text
node dist/vault/main.js --rotate-root-key identity --rotation-request-id 10000000-0000-7000-8000-000000000001
node dist/vault/main.js --rotate-root-key vault --rotation-request-id 10000000-0000-7000-8000-000000000002
```

For Compose, apply a temporary command override containing the same arguments
and recreate both services concurrently. An identity rotation override must
also replace the vault's ordinary read-only database inventory mount with the
same volume mounted read-write at `/inventory/database`. Do not make any other
retained store writable. The application remains in setup-only mode and does
not acquire its SQLite writer until the vault commits and reports ready.
Remove the override and recreate the vault after success.

The status socket and setup page remain available, but the credential socket,
OAuth, MCP, login, and ordinary control behavior remain absent through
maintenance. Safe vault logs report only the phase class. A restart with a
valid journal resumes without repeating the arguments. Repeating the exact
completed UUID is a no-change replay; reusing it for the other target fails
closed.

On `configuration_error`, do not edit the journal, manifest, archived root,
encrypted records, or SQLite rows. Correct storage availability or ownership
and restart without arguments to resume. If continuity cannot be established,
stop both services and restore the database, vault store, generated keys, and
setup state from one consistent pre-rotation snapshot, then escalate for
review. Never delete a retained `*.retired` root until a later reviewed
retention policy explicitly permits it.

## Upgrade and restart

1. Create and verify a credential-less backup; use encrypted credential export
   only when required and approved.
2. Stop the single application writer cleanly.
3. Preserve all durable mounts and stable key files. Never copy an active
   SQLite database independently of its WAL state.
4. Deploy the new image and require gateway `/health` plus control
   `/api/v2/health`.
5. Run the [client compatibility checklist](client-compatibility.md). Existing
   OAuth access should survive when the relevant stable keys/state survive;
   runtime references intentionally do not.
6. Review recovery tasks, dashboard findings, and audit continuity before
   reopening privileged work.

## Troubleshooting

- `not_ready`: inspect only the named sanitized component, then its focused
  guide. Health never returns paths, key material, database errors, or response
  bodies.
- OAuth discovery works but tools are absent: confirm that the client URL ends
  in `/mcp`, while resource and issuer values do not.
- References fail after restart: obtain new references. This is expected;
  never restore or share ephemeral capability memory.
- Audit is degraded: protect availability, repair storage/ownership, restart,
  and verify a new safe audit event. Do not log request bodies or headers.
- Vault is unavailable: verify socket ownership, stable root/caller keys, and
  broker health without mounting root keys into the gateway.
- Restore or migration is incomplete: do not edit recovery files or database
  rows manually; use the Recovery tasks workspace and focused runbook.

Release validation is defined in the [release matrix](release-matrix.md) and
the [exact-candidate v2.1 qualification runbook](v2.1-release-qualification.md).
