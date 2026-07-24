# Portable Restore

Portable restore replaces the configuration domains in a SecretSauce portable
backup. It is deliberately not an instance restore: target identities,
authenticators, linked identity providers, deployment/security settings, and
audit history survive, while services, destinations, credential definitions,
policies, and rules are replaced.

Restore is destructive. It removes groups and all access/administrative
bindings, disables and unassigns every restored rule, revokes API keys, browser
sessions, OAuth grants/tokens, and runtime references, and leaves every restored
service in draft. No restored service is callable until an administrator
completes its remediation.

## Enable restore

Restore requires all of the following:

- one gateway process with a durable `persistence.database_file`;
- the backup-only vault socket, caller key, and capability key documented in
  [Portable Backup Export](backup-export.md);
- `SECRETSAUCE_RESTORE_DIRECTORY`, an absolute canonical mode-`0700` directory
  owned by the gateway process;
- `SECRETSAUCE_RESTORE_RECOVERY_KEY_FILE`, a stable canonical 32-byte base64url
  key in a regular mode-`0400` file with safe ownership.

Create the recovery key through the same local key-generation workflow used for
vault key files:

```bash
npm run vault:key -- generate --output /absolute/path/to/restore-recovery.key
```

Keep the restore directory and recovery key on stable mounts. The directory is
single-process writable and must not be shared between replicas. Never mount the
recovery key or restore directory into the vault broker. Never mount vault root
keys or its encrypted store into the gateway.

Both restore variables must be present or absent together. A partial pair stops
startup. A complete restore pair without the durable database or complete
backup-only vault access also fails closed. Ordinary backup and service behavior
remains available when restore is intentionally disabled.

## Interactive workflow

Only an active human `superadmin` can restore. API keys cannot upload, inspect,
preview, or commit a restore. In **Backup and restore**:

1. Upload one `application/gzip` portable archive. Uploads are bounded at
   256 MiB, strictly decoded, and staged for one hour.
2. Inspect the validated archive UUID and resume identifier. The opaque stage
   identifier can resume the same actor's unexpired workflow; it is not an
   authorization credential.
3. Build a server-derived preview. For an encrypted archive, enter the archive
   passphrase if credential values should be imported.
4. Review replacement, preservation, clearing, revocation, unavailable-secret,
   and remediation counts separately.
5. Enter a 10–1,024 character justification, the exact displayed
   `RESTORE <archive UUID>` phrase, current password and TOTP, then commit.

Preview and commit re-read the staged bytes and bind the archive checksum,
canonical documents, actor, expiry, secret disposition, credential selection,
and preview counts. Any mismatch or concurrent configuration change fails
before mutation. Password, TOTP, archive passphrase, and upload inputs are
cleared after every attempt and are not kept in browser persistence.

A missing or wrong archive passphrase is not guessed and does not partially
import values. The preview explicitly becomes `configuration_only`; the
portable configuration can still be restored, with every affected credential
marked unconfigured. To import encrypted values, build a new preview with the
correct passphrase and supply it again at commit.

## Commit and recovery

Commit first blocks new ordinary control and data-plane work and waits up to 30
seconds for in-flight work to drain. Before changing live state, SecretSauce
creates an encrypted SQLite snapshot and an encrypted full-vault recovery
archive. A fresh in-memory recovery key encrypts both and is wrapped by the
stable recovery key; plaintext database, credential values, passphrases, vault
locators, and key material are not persisted in the restore directory.

Vault replacement happens before one atomic SQLite replacement transaction. If
vault replacement, database commit, or the post-commit database/schema/vault/
identity/audit health gate fails, SecretSauce restores both stores from the
recovery set. Maintenance remains fail closed during this sequence. On success,
the recovery set is removed and the initiating browser is signed out because
all sessions were revoked.

If the process stops during commit, do not delete or edit files in the restore
directory and do not rotate the recovery or backup-only vault keys. Restart the
same single gateway with the same database, restore directory, recovery key,
vault store, and backup-only vault mounts. Before opening listeners, it will:

- discard an authenticated snapshot when no live mutation began;
- roll back both vault and SQLite after a recorded mutation; or
- stop startup for an invalid, expired, oversized, or unauthenticated journal.

An operator must investigate a fail-closed startup condition without printing
recovery files or downstream response bodies. Preserve the directory and keys,
check filesystem ownership/modes, free space, vault readiness, and sanitized
startup diagnostics. Do not repeatedly move files or substitute keys in an
attempt to bypass journal authentication. Use an independently retained backup
and documented disaster-recovery procedure if the stable recovery material is
irretrievably unavailable.

## Post-restore remediation

Sign in again as a surviving target-instance superadmin. Target users,
authenticators, external links, and settings are unchanged, but no restored
service has active access. For every restored service:

1. assign service administrators and intended users/groups;
2. enter every credential value reported unavailable or unconfigured;
3. review policy/rule targets and assignments, then intentionally enable them;
4. validate destinations and credential behavior;
5. publish the reviewed service configuration.

Treat the preview and completion counts as a checklist, not as proof that
downstream credentials or endpoints are operational. Verify `/api/v2/health`,
vault readiness, the open remediation set, and expected service discovery before
returning the instance to users.

## Archive custody and audit

Accept archives only from an authenticated source and keep them in
access-controlled storage. SecretSauce rejects traversal, links/devices, archive
extensions, duplicate or unexpected entries, malformed or complex YAML,
unsupported schemas, excess sizes/counts, bad checksums, and invalid
cross-references before staging succeeds. Validation and preview do not mutate
live configuration.

Archive passphrases are never command-line arguments. The browser sends them
only in request bodies; SecretSauce uses bounded buffers and clears them after
the attempt. Do not log request bodies, `Authorization` headers, cookies,
archive bytes, passphrases, ciphertext, opaque stage identifiers, or downstream
responses.

Sanitized audit evidence records the actor, archive UUID/checksum, justification,
preview and remediation counts, revocations, phase/outcome, and safe operation
identifiers. It excludes archive content, passphrases, decrypted values,
ciphertext, vault identifiers, keys, cookies, and local paths.
