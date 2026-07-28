# V2.1 Milestone 00 Acceptance Review

- Review date: 2026-07-27
- Scope: implementation-readiness and shared-contract artifacts
- Review type: project-authored architecture, data/API, UX/accessibility,
  security, and validation review
- Result: approved as an implementation baseline
- Independent review: not performed
- Human approval: not recorded
- Implementation/release evidence: not applicable to this documentation
  milestone

## Artifacts reviewed

- [Implementation decisions](../../architecture/v2.1/decisions.md)
- [Data and state contract](../../architecture/v2.1/data-model.md)
- [Public setup and control API](../../architecture/v2.1/public-api.md)
- [Private vault OpenAPI 3.1](../../openapi/vault-v1.yaml)
- [UX and accessibility](../../architecture/v2.1/ux.md)
- [Threat model](../../architecture/v2.1/threat-model.md)
- [Validation matrix](../../architecture/v2.1/validation-matrix.md)
- [Provisioning baseline](../../architecture/v2.1/provisioning.md)
- [Vault REST baseline](../../architecture/v2.1/vault-rest-api.md)
- [Milestone implementation plan](../../plans/v2.1/milestone-00-implementation-readiness.md)

## Approval findings

### Data and API

Approved. State ownership, setup and rotation transitions, transaction
boundaries, concurrency, idempotency, retention, deletion, fresh-only
compatibility, and rollback/resume behavior are explicit. Public route schemas,
errors, bounds, authorization points, pagination, retries, and secret delivery
are decision-complete. The private OpenAPI defines both Unix-socket lifecycles,
fixed resources, media types, authentication fields, boot handshake, bounds,
closed schemas, and bounded errors.

Milestones 01 and 02 do not need to choose shared ownership, authority,
transport, manifest, transaction, compatibility, or validation semantics.

### UX and accessibility

Approved. Setup, unified enrollment, login, logout failure/retry, account
security, suspension/recovery, browser sessions, and agent connections have wide
and narrow behavior, keyboard flow, focus/error/live-region behavior,
destructive confirmation, secret clearing, privacy, and responsive evidence
defined. This is not independent accessibility certification.

### Section 24 decisions

Approved. ADR-2.1-01 through ADR-2.1-08 answer all eight questions:

1. provisional ceremony record, never a partial user;
2. sole-entrypoint bounded retry loop;
3. conservative internal coarse device derivation;
4. audited tombstone plus authentication/idempotency retention window;
5. one bounded SQLite transaction through the application writer;
6. shared pre-authentication `ClientSourceResolver`;
7. Fastify/Node Unix adapters with strict raw HTTP guards and Zod/OpenAPI
   conformance;
8. closed store rewrap adapters plus a canonical durable journal.

None changes settled product behavior.

### Threat and validation coverage

Approved. The threat model follows setup, rotation, enrollment, login,
suspension, logout, recovery, and scoped revocation from authority through
mutation, invalidation, audit, and recovery. It covers bootstrap-log authority,
socket replacement, proxy trust, private REST parsing and mutual trust, root
maintenance, revocation races, diagnostic leakage, and residual risk.

The validation matrix maps every requirement family and acceptance group,
enumerates positive and negative classes for each external-input family, names
boundary/concurrency/interruption seams, defines timing comparability, and
assigns Compose, browser/accessibility, client, security, and release evidence.

## State-model walkthrough

| Required scenario | Review result |
| --- | --- |
| Fresh | Fixed registry, manifest-before-key, bounded retry, configured commit, and setup-only application are coherent. |
| Interrupted | Per-key and per-journal restart derives authority from validated durable state and preserves the old root. |
| Adopted | Only an exact complete compatible key set with explicit adoption can commit; keys do not change. |
| Partial restore | Partial/missing/indeterminate manifest-key-store lineage fails before write or runtime listener. |
| Configured key loss | Status-only configuration error; no replacement, manifest amendment, or credential socket. |
| Rotation resume | Exact journal/request/install/aggregate/versions plus conditional rewrap and zero inventory are required. |
| Enrollment race | Final zero-user/version predicate permits one atomic complete superadmin only. |
| Logout failure | Failed persistence/audit retains session and cookie, announces failure, and permits one committed retry. |
| Suspension race | Immutable-user counter and deciding transaction prevent bypass/double count and revoke atomically. |
| Stale administrator scope | Current role, target eligibility, and complete service scope are mutation predicates; no stale-list authority. |

## Cross-artifact consistency

- Four internal setup states and the bounded public projection are unchanged.
- The fixed logical key registry, sole vault provisioner, no-network topology,
  and fresh-only boundary are unchanged.
- Setup/maintenance authority cannot coexist with runtime credential authority.
- One application SQLite writer remains authoritative.
- Raw credentials, bearer values, Authorization headers, cookies, forwarding
  chains, full addresses, and bodies are excluded from ordinary logs/audits.
- Administrative connection revocation is authorized at the deciding mutation.
- Root rotation retains the old root through verified rewrap and atomic receipt.
- Agent-authored approval is clearly separated from independent, human,
  implementation, and release evidence.

## Acceptance conclusion

All Milestone 00 acceptance criteria are satisfied by direct linked artifacts
and the repository readiness validator. This approval authorizes detailed
Milestone 01 and 02 planning. It does not claim their behavior is implemented,
independently assured, release-ready, or deployed.
