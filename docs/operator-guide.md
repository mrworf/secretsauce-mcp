# SecretSauce V2 operator guide

This is the release operations index for the supported topology: one gateway,
one control process, and one isolated vault broker. Read the linked focused
guides before the corresponding destructive or recovery operation.

## Install and bootstrap

1. Build or pull the pinned image and copy
   [`docker-compose.example.yaml`](../docker-compose.example.yaml).
2. Prepare private, explicitly owned directories for SQLite, vault storage,
   audit, OAuth state, and restore recovery. Provision stable signing, HMAC,
   wrapping, vault root, and caller keys as described in the
   [configuration reference](config-reference.md).
3. Keep the backend listeners private. Use the separate
   [MCP/OAuth proxy](../examples/proxy-mcp-oauth.haproxy.cfg) and
   [control proxy](../examples/proxy-control.haproxy.cfg) examples when the
   surfaces use separate public origins.
4. Start the vault, then the control and gateway processes. Require sanitized
   readiness before exposing either public origin.
5. Complete [local bootstrap and enrollment](local-authentication.md). A
   pending or recovery identity is not MCP-eligible.
6. Configure services, groups, credential definitions, policies, and
   publication through the focused
   [service](service-management.md), [group](group-assignments.md),
   [credential](credential-management.md), and
   [policy](policy-management.md) guides.

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

## Upgrade and restart

1. Create and verify a credential-less backup; use encrypted credential export
   only when required and approved.
2. Stop the single gateway/control writers cleanly.
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

Release validation is defined in the [release matrix](release-matrix.md).
