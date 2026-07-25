# Milestone 22: Restore

## Purpose and why

Safely replace portable service configuration from a backup while preserving target-instance identities/settings and making the destructive loss of bindings and active access explicit, previewed, atomic, and recoverable.

## Dependencies

- Milestones 18, 21, and all domains whose state restore revokes or replaces.

## PRD traceability

- Section 27: authorization, validation, replacement, missing passphrase, and recovery.
- Sections 11.3, 22, 30, 33, and 34.6: step-up, mutation, permissions, UX, and acceptance.
- Sections 31–32 and 40: secrecy, deployment/health, and settled restore decisions.

## Scope

- Add safe archive intake/staging that rejects path traversal, links/devices, archive bombs, excess size/count/YAML complexity/object counts, unsupported schemas, malformed objects, and checksum/cross-reference failures.
- Add a read-only preview showing creates/replacements, exclusions, missing/unavailable secrets, cleared assignments, revoked state, and post-restore remediation.
- Require an interactive superadmin session, current password+TOTP step-up, explicit destructive confirmation, and justification; API keys cannot restore.
- Preserve target users, roles, authenticators, external links, all instance/deployment/security settings, and at least one active superadmin.
- Atomically replace only services/destinations, credential definitions, and policy definitions.
- Remove service groups and every service-admin/user, group, credential-principal, and policy-principal binding; restore policies disabled/unassigned even when source was `all`.
- Revoke all target API keys, web sessions, OAuth grants, and gateway references.
- Import credential values only with a valid passphrase; otherwise mark affected credentials `unconfigured` and continue non-secret restore.
- Keep restored services unavailable until administrators complete persistent remediation tasks.
- Add maintenance mode, bounded encrypted pre-restore recovery, commit rollback, post-success logout, and safe audit.

## Not in scope

- Merging selected objects, preserving target bindings, restoring users/settings/audits/activity/API keys/sessions/grants/references, or API-key restore.
- Treating missing secrets as dummy values.
- V1 YAML migration.

## Required behavior and interfaces

- Preview and commit operate on the same validated archive identity/checksum and exact restore plan.
- Validation/staging failure leaves active configuration unchanged.
- Wrong/missing passphrase does not block non-secret restore; it never imports a partial/guessed value.
- Successful restore activates no service access until all required assignments, enabled policies, and credentials are intentionally remediated.
- Recovery can roll back unexpected commit failure without exposing credential values.

## Security, authorization, invalidation, and audit

- Archive parsing is isolated/bounded and never trusts filenames, permissions, links, device entries, YAML tags, aliases, or declared sizes.
- Passphrase and decrypted secrets remain in bounded memory and approved vault operations only.
- The restore audit records archive/checksum, actor, justification, preview counts, exclusions, revocations, remediation counts, and outcome without secret content.
- The initiating superadmin session is revoked after successful commit.

## Tests

- Positive: preview, credential-less restore, encrypted restore with correct passphrase, missing-passphrase non-secret restore, exact replacement, binding clearing, policy disabling, revocations, remediation, and rollback recovery.
- Negative: non-superadmin/API key, missing step-up/confirmation/justification, traversal/link/device/bomb, malformed/complex YAML, bad checksum/schema/reference, wrong passphrase, no retained active superadmin, preview/commit mismatch, and injected commit failure.
- Boundary: archive/file/object/alias/depth limits, inclusive supported schema versions, concurrent restore/mutation, maintenance mode, large credential set, and recovery retention.
- Integration: before/after database/vault/runtime assertions prove only allowed domains changed and every required active authorization artifact was revoked.

## Acceptance criteria

- Restore is interactive-superadmin-only, previewed, high-friction, atomic, and recoverable.
- Target identities/settings survive; groups/bindings do not; policies return disabled/unassigned.
- Missing/wrong passphrase still restores non-secret configuration with affected credentials unconfigured.
- Restored services remain unavailable until the remediation checklist is completed.

## Planning handoff

Specify upload/staging isolation, archive parser and YAML limits, preview-plan persistence/expiry, maintenance coordination, replacement transaction, vault import/reconciliation, revocation order, encrypted recovery snapshot, rollback/fault injection, remediation schema, and post-restore restart/readiness behavior.
