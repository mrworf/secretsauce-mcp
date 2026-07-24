# Portable Backup Export

SecretSauce portable backups preserve configuration for interacting with
downstream services. They are not installation clones. A backup can be restored
into an instance without copying the source instance's identities, access
bindings, security state, deployment settings, or operational history.

## Operator workflows

### Browser

Only a signed-in `superadmin` can open **Backup and restore** in the control
application. Every export requires current password and TOTP verification bound
to the exact backup request.

The default **Portable configuration only** mode contains credential definitions
but no credential values. The optional **Include encrypted credential values**
mode encrypts eligible configured values with a distinct passphrase. The
passphrase must contain 12–1,024 UTF-8 bytes. It is sent only in request bodies,
used in memory, and cleared from the browser form after every attempt. It is not
recoverable by SecretSauce; losing it makes `secrets.enc` unusable.

The browser receives the archive directly as
`secretsauce-portable-backup.tar.gz`. SecretSauce does not publish a reusable
download URL or stage a public file.

### System API key

A `system` API-role key can send an authenticated `POST` to
`/api/v2/backups/programmatic` with this exact JSON body:

```json
{
  "acknowledgement": "I understand this backup permanently excludes identities, access grants, audit history, runtime state, and deployment configuration."
}
```

The response is the same direct gzip attachment. This endpoint is always
credential-less. It rejects `include_secrets`, `passphrase`, and every other
unrecognized field. `service` and `all_services` keys cannot export a complete
backup.

Clients should stream the response to protected local storage, verify transport
success before replacing an older copy, restrict file access, and apply their
own retention and off-host storage policy. Do not print the response body or
authentication material.

## Permanent exclusions

Every archive excludes:

- users, roles, authenticators, OIDC links, groups, service administrators, and
  every principal, credential, or policy assignment;
- sessions, OAuth clients/grants/codes/tokens, API keys, API-key activity,
  gateway references, and response-secret references;
- administrative audit, runtime audit, activity aggregates, remediations, jobs,
  and runtime generations;
- security and system settings, deployment and OIDC configuration, branding,
  local paths, key material, publication history, and instance identity.

Credential metadata also excludes vault locators/generations unless required to
bind an encrypted payload, and always excludes last-four hints. A
credential-less restore therefore recreates definitions as unconfigured.

The control workspace presents this warning before export, and `manifest.yaml`
records both included and excluded domain names.

## Archive contract

The outer file is deterministic POSIX ustar inside gzip. Entries are regular
mode-`0600` files in this exact order:

1. `manifest.yaml`
2. `services.yaml`
3. `credentials.yaml`
4. `policies.yaml`
5. optional `secrets.enc`

The portable schema version is `1` and archive type is
`secretsauce-portable-configuration`. YAML is UTF-8 with LF endings, sorted
mappings, deterministic arrays, no aliases or tags, and a terminal newline.
Each document repeats its kind and schema version.

`manifest.yaml` records the archive UUID, product version, creation time,
credential mode, included/excluded domains, object counts, file order, and the
SHA-256 plus byte length of every other entry. An encrypted archive also records
only public algorithm/KDF parameters and the encrypted payload checksum/count.
It never records the passphrase, derived key, vault keys, ciphertext internals,
locators, or last-four hints.

The implementation accepts at most 10,000 portable objects, 16 MiB per YAML
entry, 256 MiB of uncompressed payload, and a 256 MiB final archive. Tar parsing
rejects extensions, links, devices, sparse records, path prefixes/traversal,
duplicates, unexpected order/entries, truncation, and noncanonical metadata.

`secrets.enc` uses Argon2id with 64 MiB memory, three iterations, and
parallelism one, followed by independently authenticated 64 KiB AES-256-GCM
chunks and a final authenticated manifest. The vault exports exactly the sorted
credential selection bound into a five-minute, one-use authorization. Missing,
stale, duplicate, or extra records fail the export.

## Vault deployment boundary

Credential-less exports do not require backup vault access. Encrypted exports
require all three variables below as a complete set:

- `SECRETSAUCE_VAULT_SOCKET`
- `SECRETSAUCE_VAULT_BACKUP_KEY_FILE`
- `SECRETSAUCE_VAULT_BACKUP_CAPABILITY_KEY_FILE`

The coordinating process mounts only the backup caller key, the backup
capability-signing key, and the socket directory for this function. Neither key
grants control-plane writes, data-plane resolution, or vault-root access. The
broker continues to own the encrypted store, root keys, and all verifier keys.
An incomplete set fails startup without echoing paths. An absent complete set
keeps credential-less export usable and returns a generic unavailable error for
encrypted export.

If one container performs both gateway runtime and backup coordination, mount
the data-plane/resolve, control-plane, and backup/backup-capability keys as
separate read-only files. The broker permits the control key to perform
write-only credential management and never resolve/export. Do not mount vault
root keys or the encrypted store into that container.

## Audit and troubleshooting

Every attempt writes sanitized administrative evidence with the archive UUID,
safe actor/key identity, mode, counts, included/excluded domain names,
acknowledgement, outcome, and—on success—archive byte length and SHA-256. Audit
records never contain archive bytes, passphrases, ciphertext, locators, paths,
or secret-derived suffixes.

Common failures:

- `step_up_required`: repeat current password/TOTP verification; proofs are
  request-specific and single-use.
- `rate_limited`: wait for the configured backup window.
- `vault_unavailable`: use credential-less mode or restore the complete
  backup-key/socket configuration and broker readiness.
- `invalid_request`: confirm the exact acknowledgement, passphrase byte bounds,
  and selected mode.
- `internal_error`: no usable partial archive is returned; inspect only
  sanitized readiness and audit outcome codes.

Backup generation does not mutate live configuration or invalidate sessions,
OAuth state, API keys, or runtime references.
