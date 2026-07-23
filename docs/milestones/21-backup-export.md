# Milestone 21: Backup Export

## Purpose and why

Provide portable service-interaction configuration without turning backup into an installation clone or leaking instance identities, authorization bindings, operational state, or plaintext downstream credentials.

## Dependencies

- Milestones 03, 09–13, 16, and 19.

## PRD traceability

- Section 26: archive format, exclusions, interactive and API backup.
- Sections 11.3, 25, 29–31, and 33: step-up, limits, API/secret handling, and warnings.
- Sections 34.3/34.5/34.6 and 40: acceptance and settled boundaries.

## Scope

- Export schema-versioned `.tar.gz` archives containing `manifest.yaml`, `services.yaml`, `credentials.yaml`, `policies.yaml`, and optional `secrets.enc`.
- Include only portable services/destinations/TLS, credential definitions/placement metadata, policy matching/effect/priority/response behavior, and optional encrypted credential values.
- Exclude every user/role/group/principal binding, authenticator/provider link, session/OAuth/API key/reference, audit/activity, system/security/deployment/OIDC/vault/branding setting, path, and key material listed by the PRD.
- Add stepped-up interactive superadmin credential-less and passphrase-encrypted secret-bearing backup workflows with explicit exclusions warning.
- Derive a key from the user-supplied passphrase with the approved memory-hard KDF and use authenticated encryption for a distinct secret payload.
- Add credential-less complete programmatic backup for `system` API-role keys only; reject secrets and omit secret-derived last-four hints.
- Add manifest versions, product version, type, time, included/excluded domains, counts, checksums, and non-secret encryption metadata.
- Add rate limits, streaming or single-use download authorization, safe audit records, and archive retention/cleanup.

## Not in scope

- Users, authorization bindings, instance settings, audit/activity, OAuth/API-key/session/reference state, or service-scoped archives.
- Plaintext credential export.
- Restore or migration behavior.
- Persisting the passphrase or derived encryption key.

## Required behavior and interfaces

- Interactive secret backup requires current superadmin step-up, explicit warning/confirmation, and an in-memory passphrase lifecycle.
- API backup is always credential-less and only a valid `system` API-role key can invoke it.
- Archive order/serialization/checksums are deterministic enough for validation without exposing secrets.
- Credential-less backup omits last-four hints derived from secrets.
- Backup failure leaves no reusable partial public archive or lingering passphrase/key.

## Security, authorization, invalidation, and audit

- Passphrases never enter URLs, command arguments, persistent state, logs, audit, analytics, or manifest.
- Archive staging/download uses restrictive permissions, bounded lifetime, and single-use or direct streaming.
- Audit includes archive ID, actor/key safe metadata, type, object counts, checksum, outcome, and exclusions acknowledgement.
- Backup does not revoke or mutate live configuration.

## Tests

- Positive: interactive credential-less, interactive encrypted-secret, system-key credential-less, manifest/checksum validation, decryption with correct passphrase, and streaming/single-use download.
- Negative: admin/service/all key, API secret request, missing step-up/confirmation, wrong passphrase, malformed secret input, vault failure, oversized configuration, interrupted export, and prohibited-domain leakage.
- Boundary: empty optional domains, maximum archive/object/secret sizes, Unicode YAML, concurrent backups, download expiry/reuse, and KDF/resource limits.
- Integration: inspect archive entries and decoded YAML to prove exact inclusions/exclusions and absence of prohibited values/last-four hints.

## Acceptance criteria

- Backups contain only portable services, credentials, policies, and optional passphrase-encrypted credential values.
- Programmatic complete backup is credential-less and restricted to `system` API keys.
- Secret-bearing backup is interactive superadmin-only with step-up.
- Warnings and manifest clearly state that identities, bindings, instance state, and operational history are excluded.

## Planning handoff

Specify archive/schema versions, YAML canonicalization, manifest/checksum rules, KDF/AEAD envelope, vault export capability, staging/streaming cleanup, download authorization, size/count/rate bounds, exclusion assertions, and forward compatibility fixture policy.
