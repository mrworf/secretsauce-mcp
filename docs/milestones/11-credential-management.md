# Milestone 11: Credential Management

## Purpose and why

Allow administrators to configure downstream credential metadata and values without making stored secrets readable through the control plane. Credentials add an authorization boundary inside an already authorized service.

## Dependencies

- Milestones 03, 09, and 10.

## PRD traceability

- Sections 6.2 and 13.4: vault capabilities and credential assignment.
- Section 15: credential model and editor.
- Sections 18.2, 22, 30, 33, and 34.3: status, mutation, permissions, UX, and secret acceptance.

## Scope

- Add persistent credential metadata, parent service, usage kind/placement, optional prefix/suffix hints, explicit header ownership configuration, status, locator, last-four hint, timestamps, and version.
- Apply `all`/group/user selectors as an additional boundary within service access.
- Add create/edit/archive/delete APIs and responsive editor workflows for metadata and write-only secret create/replace/delete.
- Integrate control-plane vault capabilities without adding any plaintext read path.
- Add safe clone/copy behavior that includes metadata, assignment, and later policy attachment points but always creates an `unconfigured` clone.
- Validate credential placement/header ownership before vault writes or publication.
- Emit replacement/delete/assignment invalidation events for Milestone 13.

## Not in scope

- Credential-level policy rules, added in Milestone 12.
- Runtime secret substitution from database credentials, added in Milestone 13.
- Secret-bearing backup/restore.
- External credential providers or ongoing environment/file credential authority.

## Required behavior and interfaces

- Read APIs expose status, optional captured last four, and update time but never plaintext, ciphertext, verifier, or a resolvable locator.
- Secret writes return only safe metadata and are non-cacheable.
- `unconfigured`, disabled, or archived credentials cannot be represented as usable runtime credentials.
- Access requires parent-service access plus the credential selector; every credential used by a request must authorize the user.
- Clone/copy never carries a value and clearly communicates remediation.

## Security, authorization, invalidation, and audit

- Only assigned admins and superadmins manage credentials for the service.
- Validate authorization, service ownership, input shape, and concurrency before invoking the vault.
- Coordinate database/vault failures using the approved consistency pattern so no configured metadata points silently to a missing value.
- Audit metadata and value-operation outcomes using status/last-four only; never audit input, plaintext, or vault ciphertext.
- Credential replacement/delete emits immediate scoped reference invalidation.

## Tests

- Positive: metadata CRUD, value create/replace/delete, selector access, clone/copy, status transitions, and last-four update.
- Negative: value retrieval, unassigned-admin/cross-service access, unauthorized selector, invalid placement/header ownership, stale write, oversized secret, vault failure, and clone containing secret fields.
- Boundary: multi-credential authorization, maximum sizes, concurrent replace/delete, absent last-four, and archived/unconfigured state.
- Integration: prove control-plane caller cannot resolve plaintext and database/vault consistency survives injected failures.

## Acceptance criteria

- Administrators can write and identify credentials but cannot retrieve stored values.
- Credential access is an additional boundary after service access.
- Clone/copy always produces an unconfigured credential without secret material.
- Missing/unconfigured credentials fail safely and are visible as remediation, never populated with dummy values.

## Planning handoff

Specify metadata schema, public/private DTO separation, vault consistency/reconciliation, write-only form lifecycle, selector query, status machine, placement validation reuse, clone/copy format, invalidation event payload, and failure-injection matrix.
