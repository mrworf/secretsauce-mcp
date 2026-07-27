# SecretSauce v2.1 Key-Manifest Security Review

## Metadata

- **Project/repository:** SecretSauce (MCP)
- **Git SHA:** `1ecd520bab973de46f54539efe330c5028e0358e`
- **Review date/time:** 2026-07-27T23:08:16Z
- **Reviewer role:** senior application security reviewer
- **Scope reviewed:** proposed progressive key-fingerprint manifest and configured
  commitment for v2.1 automatic key provisioning
- **Primary product source:** `docs/prd/secretsauce-v2.1-prd.md`
- **Implementation context:** current vault key-file creation and validation,
  vault record encryption, v2 key ownership, and example Compose topology

## Executive Summary

The proposed design is **acceptable with conditions**.

A non-secret manifest containing domain-separated fingerprints of every
high-entropy application key, plus a canonical digest of the completed
inventory, can safely detect accidental key deletion, replacement, and mixed
key sets. It can also support restart-safe provisioning without exposing raw key
material.

Two distinctions are mandatory:

1. There must be a durable **progress manifest** from the first provisioning
   attempt, separate from the final **configured commitment**. An absent final
   commitment plus a valid progress manifest can prove which keys were already
   created. An absent commitment by itself cannot.
2. Automatically adopting a complete pre-manifest key set is safe only when
   every owning component validates that its keys are compatible with any
   retained key-bound state. Merely hashing the files proves which files are
   present, not that they can decrypt or authenticate retained data.

The unsafe case is: no progress manifest, only some keys present, and retained
application state may exist. Treating that state as an interrupted first boot
could replace a lost key from a previously configured installation. That case
must fail closed unless the owning components can prove the installation is an
eligible pre-manifest adoption with no incompatible retained state.

This is a design review, not a finding in deployed code. CVSS v3.1 is therefore
not applicable.

## Scope and Methodology

The review compared the proposal with:

- the v2.1 installation state and setup requirements
  (`docs/prd/secretsauce-v2.1-prd.md:190-210`,
  `docs/prd/secretsauce-v2.1-prd.md:489-532`);
- the current no-automatic-adoption compatibility statement
  (`docs/prd/secretsauce-v2.1-prd.md:960-969`);
- the current vault key parser and atomic exclusive-create behavior
  (`src/vault/keyFile.ts:18-105`);
- the separate vault ownership boundary
  (`docs/architecture/v2/system-architecture.md:21-34`);
- the fact that vault key loss makes retained ciphertext unrecoverable
  (`docs/architecture/v2/vault.md:58-73`).

No v2.1 manifest implementation exists, so runtime exploit validation and CVSS
scoring were not possible or appropriate.

## Threat Model

- **Sensitive assets:** identity encryption keys, session/token hashing keys,
  OAuth signing keys, vault root keys, vault caller/capability keys, encrypted
  identity data, vault ciphertext, and durable authentication/grant state.
- **Trust boundaries:** key-owning component to coordinator; key volume to
  replaceable container; application to separate vault process; configured
  commitment to progress manifests.
- **Relevant failures:** process termination between file operations, loss of
  one volume, partial restore, operator mixing keys from installations, deletion
  or replacement of a key, and adoption of manually provisioned pre-manifest
  keys.
- **Out-of-scope attacker:** a host administrator who can replace both all key
  files and every manifest/commitment. An unkeyed manifest digest provides
  consistency, not authenticity, against that authority.

## Security Assessment

### Positive observation: per-key fingerprints are appropriate

The application-owned keys are high-entropy cryptographic values. A
domain-separated cryptographic digest stored in a non-secret manifest does not
practically reveal those values and gives a stable comparison for deletion or
replacement.

Each owning component should compute fingerprints locally and return only key
identity, format/version, validation status, and fingerprint. The coordinator
must not read vault root or caller key bytes merely to construct the manifest.

### Required condition: progress and completion are separate states

A single absent/present flag cannot safely represent partial progress. Use:

- a durable, atomically replaced progress manifest containing a bounded,
  canonical key inventory and per-key state; and
- a final configured commitment containing the canonical digest of the complete
  verified inventory.

The progress manifest should distinguish at least:

- `pending`: this owner is permitted to create the key;
- `verified`: the key exists, validates, and its fingerprint is recorded.

This closes the crash window between deciding to create a key and recording its
fingerprint:

- `pending` plus no file: create it;
- `pending` plus a valid file: fingerprint and adopt it into this provisioning
  generation;
- `verified` plus a missing or mismatched file: fail closed;
- no entry for a required key: add `pending` before attempting creation.

A final hash of all fingerprints is useful as a canonical completion
commitment, but a “hash of hashes so far” does not by itself solve the
key-file/manifest crash window. Explicit per-entry state does.

### Required condition: define fingerprint semantics

The architecture must define:

- a domain-separated fingerprint construction;
- canonical key bytes for each supported key format;
- canonical ordering by stable key identity;
- inventory schema and key algorithm/version;
- exact decode-and-re-encode validation before hashing;
- atomic file replacement, file and directory synchronization, restrictive
  ownership/modes, no-follow behavior, and bounded manifest size.

For example, hashing canonical decoded key bytes avoids treating a harmless PEM
or line-ending representation change as a different key. The PRD need not select
the hash algorithm, but it must require collision-resistant, domain-separated,
canonical fingerprints.

### Required condition: configured commitment is authoritative

When the configured commitment exists:

- every required key must be present;
- every owner-reported fingerprint must equal the committed fingerprint;
- the canonical complete-manifest digest must equal the configured commitment;
- missing, additional, malformed, or mismatched entries must produce
  `configuration_error`;
- no automatic key generation or replacement is permitted.

This portion of the proposed behavior is sound.

### Required condition: pre-manifest adoption validates retained state

When every required key exists but no progress manifest or configured commitment
exists, automatic adoption can be supported as a deliberate migration path.
Before writing the manifest and commitment, every owner must validate:

1. key format, ownership, mode, and expected cryptographic type; and
2. compatibility with all retained state bound to that key.

Examples include decrypting or inventory-validating every retained identity or
vault envelope and validating a durable key-check value for HMAC-only keys.
Validation must be exhaustive or rely on a purpose-built cryptographic key-check
record; a format check or hash of the candidate file is insufficient.

If no retained state exists, the complete pre-provisioned set can be adopted
after structural validation. If retained state exists and any owner cannot prove
compatibility, startup must fail closed without writing a commitment.

This behavior changes the current product statement that automated adoption of
older key state is not required. The PRD must explicitly identify complete
pre-manifest key adoption as the one supported migration case.

### Unsafe condition: partial keys without progress evidence

The following rule is not acceptable without another guard:

> Final flag absent and some keys missing means interrupted boot, so generate the
> rest.

The same observation can result from deletion of the commitment and one or more
keys from a previously configured installation. For a vault or identity
encryption key, generating a replacement can make retained ciphertext
unrecoverable.

Safe behavior is:

- resume and generate only unrecorded keys when a valid progress manifest proves
  the incomplete provisioning generation; or
- allow partial pre-manifest adoption only when every component proves there is
  no retained state bound to a missing key and all retained state bound to
  present keys validates; otherwise fail closed.

## Recommended Startup Matrix

| Observed state | Required behavior |
| --- | --- |
| No progress manifest, no commitment, no keys | Create a provisioning generation and progress manifest, then generate keys |
| Valid progress manifest, no commitment, only unrecorded/pending keys absent | Resume and generate only those keys |
| Valid progress manifest, no commitment, a verified key missing or mismatched | `configuration_error`; do not replace it |
| No manifest or commitment, every required key present | Run complete pre-manifest adoption validation; commit only if every owner proves compatibility |
| No manifest or commitment, only some keys present | Adopt/generate only if owners prove no incompatible retained state; otherwise `configuration_error` |
| Commitment present and every fingerprint matches | Continue to enrollment-required or operational state |
| Commitment present and any key/fingerprint/final digest differs | `configuration_error`; do not generate or replace keys |

## Safe Validation Plan

Use generated test keys and local temporary stores only.

1. Inject process termination before key creation, after key `fsync`, after
   progress-manifest replacement, and before final commitment.
2. Verify restart never changes a `verified` key and creates only a
   pending/unrecorded key.
3. Delete or replace each committed key independently and verify nonzero startup
   with no writes to any key file or manifest.
4. Mix a key and manifest from two test installations and verify fail-closed
   behavior.
5. Test complete pre-manifest adoption with empty state and with valid retained
   encrypted state.
6. Test complete and partial pre-manifest key sets against incompatible retained
   state and verify no commitment or new key is written.
7. Prove the coordinator receives fingerprints and statuses but never raw key
   bytes.

These tests are non-destructive because they use disposable generated fixtures
and do not expose or operate on deployment credentials.

## Hardening Recommendations

- Bind the canonical manifest to an installation identifier, inventory schema,
  enabled-feature inventory, key identities, owners, formats, and algorithms.
- Make the configured commitment and progress manifests atomic, synced, bounded,
  and strict-schema documents.
- Do not describe the final digest as protection against a host authority that
  can replace both keys and manifests.
- Keep raw key values out of SQLite, logs, audits, health, setup status, and
  inter-component inventory messages.

## Positive Security Observations

- The current vault key writer already uses restrictive permissions, exclusive
  creation, file synchronization, a no-overwrite link, and directory
  synchronization (`src/vault/keyFile.ts:65-105`).
- Existing key loading rejects symlinks, multiple hard links, permissive modes,
  malformed lengths, and non-canonical base64url
  (`src/vault/keyFile.ts:26-63`).
- The approved v2.1 contract already assigns one owner per key and prohibits
  races between owners.
- Configured key loss already fails closed and prohibits regeneration.

## Overall Verdict

**Conditionally approved.** The fingerprint-manifest direction is sound and is
more precise than inferring installation continuity from unrelated application
records. Approval requires a progressive per-key manifest, an authoritative
final commitment, owner-local fingerprinting, compatibility validation for
pre-manifest adoption, and fail-closed handling for partial key sets that lack
valid progress evidence.

No confirmed or likely vulnerability exists yet because the mechanism is not
implemented. The conditions above are requirements intended to prevent a future
data-loss and key-substitution vulnerability.

## Appendix: Commands

```text
git rev-parse HEAD
date -u +"%Y-%m-%dT%H:%M:%SZ"
git status --short
rg -n "keyFile|root key|fingerprint|digest|manifest|configured flag" src test docs
nl -ba src/vault/keyFile.ts
nl -ba docs/architecture/v2/vault.md
nl -ba docs/architecture/v2/system-architecture.md
nl -ba docs/prd/secretsauce-v2.1-prd.md
```
