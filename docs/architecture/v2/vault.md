# Vault Capability and Key Lifecycle

## Protocol

The private protocol is authenticated HTTP/1.1 over separate provisioning-status
and credential Unix-domain sockets. Request HMACs bind the fixed audience and
version, caller, method, exact origin-form target, selected representation
headers, exact body digest, request UUID, timestamp, 128-bit nonce, and current
boot identifier. Authenticated response HMACs bind the caller, boot, request,
status, representation, and exact body. The store-free readiness handshake is
the only credential request without an inbound boot identifier.

Operation payloads have closed Zod schemas. Credentials and transfer chunks are
limited to 64 KiB, archives to 1 GiB, and selections to 10,000 records. The
broker permits at most eight concurrent cryptographic operations and applies a
five-second request deadline. Unknown routes or fields, ambiguous targets or
framing, stale timestamps, duplicate nonces or security headers, malformed
UTF-8/base64url, wrong boot identifiers, and bad MACs fail before domain/store
access.

| Caller | Allowed operations |
| --- | --- |
| Data plane | readiness and `resolve_for_request` |
| Control plane | readiness, `create`, `replace`, `delete`, `metadata` |
| Backup coordinator | readiness, `export_encrypted`, `import_encrypted`, `replace_empty` |

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
