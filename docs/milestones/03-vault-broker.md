# Milestone 03: Vault Broker

## Purpose and why

Create a meaningful secret-isolation boundary before credentials are managed through the control plane. A TypeScript module that shares unrestricted memory and filesystem access with every caller does not satisfy the PRD's write-only credential model.

## Dependencies

- Milestones 00 and 01.

## PRD traceability

- Sections 3.4, 6.1–6.3, and 15: vault boundary and credential secrecy.
- Sections 26–27: authorized encrypted export/import needs.
- Sections 31, 32.3, and 34.3: redaction, health, and vault acceptance.

## Scope

- Implement the approved private process/OS boundary and authenticated local transport.
- Implement encrypted downstream-credential records, authenticated metadata, and opaque non-secret locators.
- Implement capability-separated operations: control-plane create/replace/delete/masked metadata; runtime resolve for an already authorized operation; backup encrypted export/import.
- Provision and load the vault master key using the approved deployment mechanism without making the database self-decrypting.
- Implement atomic writes, corruption detection, restrictive storage permissions, health/lock state, and lifecycle shutdown.
- Provide test-only isolation and deterministic failure injection without production secret bypasses.

## Not in scope

- Credential records or editors in the management database.
- A public vault listener or general-purpose secret retrieval API.
- Returning plaintext credentials to the control plane.
- Backup archives, restore orchestration, or master-key rotation UX.
- External cloud-vault integrations.

## Required behavior and interfaces

- Control-plane operations never receive stored plaintext, including after create/replace.
- Runtime resolution requires a narrowly scoped request identifying the authorized service/credential operation.
- Backup export returns only an already passphrase-encrypted payload through its dedicated capability.
- Invalid caller identity, capability, locator, ciphertext, or operation fails closed.
- Metadata exposes only status and an optional last-four hint captured during a write.

## Security, authorization, invalidation, and audit

- Local transport authenticates callers and rejects capability escalation or replay according to the approved design.
- Secrets never appear in logs, traces, errors, audit, crash metadata, command arguments, or health output.
- Vault writes emit sanitized operation results for the caller to include in its transaction/audit workflow.
- Deleting or replacing a value makes the previous value unreachable; higher-level reference invalidation is added later.

## Tests

- Positive: create, replace, masked inspect, authorized runtime resolve, delete, restart persistence, and encrypted export/import capability.
- Negative: control-plane read attempt, wrong caller/capability, cross-credential locator, tampered ciphertext, missing key, wrong key, malformed request, replay where prohibited, and unavailable broker.
- Boundary: maximum secret/metadata sizes, concurrent writes, atomic interruption, and restrictive file/socket permissions.
- Integration: separate caller identities prove the control plane cannot invoke runtime resolution and the runtime cannot request export.

## Acceptance criteria

- Operation-level isolation is enforced by a process or OS boundary approved in Milestone 00.
- Stored values remain encrypted at rest and are never returned through control-plane interfaces.
- Broker unavailability/degradation is visible through sanitized readiness.
- All secret-bearing negative tests assert absence from output and logs.

## Planning handoff

Specify process startup/order, IPC authentication and framing, capability issuance, key provisioning paths, encryption envelope/versioning, atomic storage layout, crash recovery, resource limits, and integration-test process orchestration.
