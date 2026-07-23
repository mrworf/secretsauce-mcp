# Vault Capability and Key Lifecycle

## Protocol

The private protocol is a small fixed binary frame over a Unix-domain socket:
magic/version, total length, caller enum, operation enum, request UUID, timestamp,
128-bit nonce, payload length, UTF-8 JSON payload bytes, and a 256-bit HMAC over
the preceding raw bytes. The payload has an operation-specific closed Zod schema;
the raw frame, not reserialized JSON, is authenticated. Maximum message size is
1 MiB except bounded streaming export/import frames. The broker permits at most 32
connections, 8 concurrent cryptographic operations, and a five-second request
deadline. Unknown frame flags, fields, versions, callers, operations, stale
timestamps, duplicate nonces, malformed lengths/UTF-8, and bad MACs are rejected
before store access.

| Caller | Allowed operations |
| --- | --- |
| Data plane | `resolve_for_request` |
| Control plane | `create`, `replace`, `delete`, `metadata` |
| Backup coordinator | `export_encrypted`, `import_encrypted`, `snapshot`, `restore_snapshot` |
| Local key CLI | `key_status`, `install_key`, `rewrap`, `retire_key` |

The control caller has no resolve or export operation. Backup operations require a
short-lived authorization record created by a stepped-up interactive superadmin;
the broker verifies its ID, operation digest, expiry, and one-use state through
the persistence owner. API keys cannot create that record.

A data-plane resolve capability is minted only after authentication,
service/credential authorization, canonical destination validation, policy, and
capacity. It binds caller, subject UUID, grant/security epochs, service,
destination, credential and vault generation, method/path digest, request ID, and
a 15-second expiry. It is single-use. Plaintext exists only in broker/data-plane
locked buffers for the immediate request and is zeroed on completion where the
runtime permits.

## Record envelope

```text
magic | format_version | record_uuid | generation | root_key_id
wrapped_dek_nonce | wrapped_dek_ciphertext | value_nonce | value_ciphertext
```

AES-256-GCM encrypts a random 256-bit DEK and the value. Fresh nonces are required
for every encryption. Associated data covers all cleartext header fields plus
`SecretSauce/vault-record`. Store commits use write-new, fsync, atomic rename, and
directory fsync. Locators are random UUIDs and reveal no value. Metadata returns
status, generation, byte-size class, last-four captured before encryption, and
timestamps—never ciphertext or key material.

For credential management, the control plane allocates the random locator before
`create` and binds the record to `(service UUID, service UUID, credential UUID)`.
That service-wide destination slot is only a compatibility binding for control
operations; Milestone 13 still binds the actual destination and request when it
mints a data-plane resolve capability. Create/replace/delete use a durable
database intent and reconcile reply loss through metadata. Unknown outcomes stay
visibly unavailable and are retried during startup reconciliation.

## Provisioning, rotation, and recovery

Initial bootstrap refuses to start until the broker root key and caller keys exist
with correct ownership and restrictive modes. Key generation is a local
interactive command that writes a new file atomically; it never prints key bytes.
The operator backs up root-key files separately from application archives.

Rotation is install, activate for new writes, resumably rewrap DEKs, verify,
inventory, then retire. A journal stores only record UUID, old/new key IDs, state,
and error category. Interrupted rotation resumes safely. Compromise rotation
invalidates runtime references and audit records the key IDs and counts.

Loss of an active root key makes affected values unrecoverable unless the operator
restores that key or imports a passphrase-encrypted secret backup. The database,
ordinary credential-less backup, and vault ciphertext alone cannot decrypt
records. This is intentional and is surfaced in readiness and operator docs.

Archive encryption uses Argon2id with a random 16-byte salt, minimum 64 MiB memory,
three iterations, and parallelism one, followed by chunked AES-256-GCM with unique
nonces and a manifest-bound header. Parameters are stored and bounded against
resource exhaustion. A wrong passphrase produces only a uniform authentication
failure. No plaintext temporary archive is written.
