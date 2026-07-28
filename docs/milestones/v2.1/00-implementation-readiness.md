# Milestone 00: Implementation Readiness And Contract Baseline

## Purpose and why

Turn the approved v2.1 product and architecture baselines into decision-complete
implementation inputs before code changes cross the provisioning, vault,
identity, browser, and OAuth trust boundaries. The PRD is ready for milestone
breakdown but explicitly not implementation-ready until detailed UX,
accessibility, data-model, API-contract, and validation reviews are complete.

## Dependencies

- None. This milestone consumes the approved v2.1 PRD and architecture records,
  not an earlier v2.1 implementation milestone.

## PRD traceability

- Sections 1–7, 14–20, and 27–28 — authority, actors, cross-cutting invariants,
  deployment constraints, review focus, and readiness state.
- Section 24 — all eight delegated architecture questions.
- Section 25 — settled decisions that downstream plans may not reopen silently.
- Section 26 — authoritative requirement families and acceptance mapping.
- `docs/architecture/v2.1/provisioning.md` and
  `docs/architecture/v2.1/vault-rest-api.md` — approved starting baselines.

## Scope

- Approve the detailed v2.1 data model, state transitions, transaction
  boundaries, ownership, retention, deletion, migration, and rollback contracts.
- Approve canonical public control/setup schemas and the private vault OpenAPI
  3.1 contract, including errors, bounds, media types, request/response
  authentication, boot handshake, pagination, idempotency, and versioning.
- Resolve every PRD Section 24 mechanism question without changing settled
  product behavior.
- Produce reviewed UX flows and responsive, accessible wireframes for setup,
  unified enrollment, login, logout failure/retry, account settings, suspension
  settings, recovery, and scoped session/connection administration.
- Update the threat model and trust-boundary diagrams for privileged
  provisioning, root maintenance, bootstrap-log authority, proxy trust,
  private vault REST, and revocation races.
- Define the executable validation matrix, fixtures, failure injection,
  interruption points, timing-comparability method, Compose topology checks,
  browser/accessibility gates, and release evidence ownership.
- Record approved dependency and cryptography choices and any required
  amendments to existing v2 ADRs.

## Not in scope

- Production code, database migrations, generated OpenAPI, deployable Compose
  changes, or UI implementation.
- Reopening fixed key membership, the single vault-owned provisioner,
  Unix-socket-only v2.1 vault transport, local TOTP requirements, role
  authority, or other settled product decisions without a documented blocker
  and PRD amendment.
- Detailed implementation plans for Milestones 01–10.

## Required behavior and interfaces

- Artifacts must preserve the PRD's four internal setup states, bounded public
  setup projection, fixed logical key registry, enrollment and login failure
  uniformity, immediate post-commit revocation, and fresh-only compatibility
  boundary.
- Data/API contracts must specify actors, inputs, outputs, errors, concurrency,
  retries, idempotency, lifecycle, and compatibility precisely enough to create
  bounded implementation plans.
- UX artifacts must cover wide and narrow viewports, keyboard-only completion,
  focus behavior, status announcements, destructive confirmations, secret
  clearing, and failure/retry states.
- Architecture choices must retain transport-neutral vault domain handlers,
  one application SQLite writer, closed key/store adapter registries, and an
  irreversible boundary between setup/maintenance authority and runtime
  authority.

## Security, authorization, invalidation, and audit

- Threat modeling must follow each privileged operation from authentication or
  host authority through authorization, mutation, invalidation, audit, and
  recovery.
- Contracts must keep raw keys, credentials, opaque bearer values,
  Authorization headers, cookies, forwarding chains, and request/response
  bodies out of ordinary logs and audits.
- Administrative connection revocation must authorize current role, target
  eligibility, and complete current service scope at the mutation boundary.
- Root rotation must retain the old root through verified rewrap and atomic
  manifest/receipt commit; no remote interface may acquire rotation authority.
- Review artifacts must distinguish agent-authored review, independent review,
  human approval, implementation, and release evidence.

## Required tests and validation

- Review the data/API contracts against every requirement family and every
  acceptance subsection in PRD Sections 21–22.
- Walk the state model through fresh, interrupted, adopted, partial-restore,
  configured-key-loss, rotation-resume, enrollment-race, logout-failure,
  suspension-race, and stale-administrator-scope scenarios.
- Map at least one positive and one negative test to every new external input;
  map boundary, concurrency, browser, Compose, and security cases where
  applicable.
- Confirm every Section 24 question has an approved answer or an approved
  alternative with no product-contract change.
- Validate Markdown, links, diagrams, example hostnames, and absence of secret
  material or private deployment identifiers.

## Acceptance criteria

- [x] Detailed UX/accessibility and data/API reviews are approved and linked.
- [x] All eight Section 24 questions have decision-complete recorded answers.
- [x] The updated threat model and validation matrix cover all v2.1 trust
      boundaries, requirement families, and negative paths.
- [x] Milestone 01 and Milestone 02 can be planned without selecting shared
      schemas, transaction semantics, trust boundaries, or validation strategy.
- [x] No artifact contradicts the PRD, approved architecture baselines, or
      repository security rules.

Acceptance evidence is recorded in
[`docs/audits/v2.1/milestone-00-acceptance.md`](../../audits/v2.1/milestone-00-acceptance.md)
and enforced by `node scripts/validate-v2.1-readiness.mjs`.

## Planning handoff

The implementation plan must resolve artifact locations, reviewers, ADR
amendments, schema/OpenAPI source-of-truth tooling, representative fixtures,
failure-injection seams, Compose-capability checks, and approval evidence. Keep
this as one documentation/review slice; completion authorizes detailed planning
but does not mark any implementation or independent assurance complete.

## Shared delivery contract

Every later v2.1 milestone must:

- Treat `docs/prd/secretsauce-v2.1-prd.md` as authoritative when a milestone
  summary is ambiguous.
- Start from a separate decision-complete implementation plan and normally
  deliver one to three coherent, reviewable slices.
- Add positive and negative tests for every new external input and state
  transition, including malformed, unauthorized, stale, and boundary cases.
- Run focused validation per slice and the production build, canonical full
  suite, OpenAPI checks, and other applicable milestone gates at milestone
  completion.
- Create one concise commit per completed implementation slice.
- Authenticate and authorize, validate destination and policy, and enforce
  capacity before credential substitution or downstream I/O.
- Keep MCP HTTP stateless, authenticate every POST independently, and never
  issue or trust `mcp-session-id`.
- Never log raw credentials, opaque token values, Authorization headers,
  cookies, forwarding chains, or downstream response bodies by default.
- Use `example.org` in documentation and tests and preserve the distinct OAuth
  origin versus MCP Server URL contracts.
- Avoid service-specific tools/profile packs, remote provisioning or rotation,
  multiple active application instances, and all other v2.1 non-goals.

## Requirement allocation

| Requirement or cross-cutting area | Primary milestone |
| --- | --- |
| `VAULTAPI-001`–`VAULTAPI-008` | 01 |
| `SETUP-001`–`SETUP-007`, `SETUP-009`, `SETUP-013`, `SETUP-015`–`SETUP-020`, `SETUP-023`–`SETUP-024`, `SETUP-026` | 02 |
| `SETUP-008`, `SETUP-010`–`SETUP-012`, `SETUP-014`, `SETUP-021`–`SETUP-025`, `HEALTH-001`–`HEALTH-009` | 03 |
| `SETUP-027`–`SETUP-028` | 04 |
| `ENROLL-001`–`ENROLL-013` | 05 |
| `LOGIN-001`–`LOGIN-007`, `LOGOUT-001`–`LOGOUT-006`, `SESSION-001`–`SESSION-008` | 06 |
| `ABUSE-001`–`ABUSE-015`, `SOURCE-001`–`SOURCE-009` | 07 |
| `RECOVER-001`–`RECOVER-007` | 08 |
| `ACCESS-001`–`ACCESS-012` | 09 |
| Sections 14–23 and product-wide qualification | 10 and every affected milestone |
