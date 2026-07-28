# Milestone 00: Implementation Readiness And Contract Baseline

## Outcome

SecretSauce v2.1 has decision-complete, reviewed implementation inputs for its
data and state model, public and private APIs, UX and accessibility behavior,
trust boundaries, and executable validation. Milestones 01 and 02 can be
planned without inventing shared schemas, transaction semantics, trust
boundaries, or validation strategy.

## Governing contracts

- PRD requirements:
  [`docs/prd/secretsauce-v2.1-prd.md`](../../prd/secretsauce-v2.1-prd.md),
  especially Sections 1–7, 14–22, and 24–28.
- Milestone acceptance criteria:
  [`docs/milestones/v2.1/00-implementation-readiness.md`](../../milestones/v2.1/00-implementation-readiness.md).
- Architecture decisions:
  [`docs/architecture/v2.1/provisioning.md`](../../architecture/v2.1/provisioning.md)
  and
  [`docs/architecture/v2.1/vault-rest-api.md`](../../architecture/v2.1/vault-rest-api.md).
- Repository instructions: [`AGENTS.md`](../../../AGENTS.md).

## Current-state findings

- The PRD settles observable behavior, logical key membership, authority,
  security invariants, and the fresh-only compatibility boundary.
- The provisioning and vault REST records settle coordinator ownership,
  topology, socket lifecycles, request/response trust, and root-maintenance
  authority.
- Existing v2 architecture documents provide conventions, but do not define the
  v2.1 state, API, UX, threat, or validation details required by this milestone.
- The repository uses Zod as the runtime schema source for its generated public
  OpenAPI contract, Fastify for HTTP adapters, React for the browser, Vitest for
  executable tests, and one SQLite application writer.
- The worktree was clean at selection. This milestone changes documentation
  only, so it has no executable baseline dependency.

## Decisions

- Place v2.1 architecture artifacts under `docs/architecture/v2.1`, the private
  contract under `docs/openapi`, the milestone plan under `docs/plans/v2.1`,
  and review evidence under `docs/audits/v2.1`.
- Keep public schemas in the application Zod/OpenAPI source of truth when
  implemented. Keep the private vault API in one hand-maintained OpenAPI 3.1
  source until Milestone 01 binds both server and clients to generated runtime
  validators and contract tests.
- Use one application-owned provisional enrollment ceremony record, not a
  partial user. Use bounded in-process retry state owned by the sole vault
  entrypoint. Use an internal conservative user-agent derivation rather than a
  new parser dependency.
- Preserve revoked records through their idempotency window, then permit bounded
  deletion only after immutable audit evidence exists. Use repository
  transactions and bounded batches for global revocation.
- Centralize source derivation at a shared listener request boundary. Reuse
  Fastify plus strict raw-message guards for Unix-socket HTTP. Use closed store
  adapters and a durable operation journal for root rewrap.
- These choices preserve settled behavior and do not alter an external product
  contract.

## Scope

### Included

- Detailed data/state, transaction, lifecycle, retention, migration, and
  rollback contracts.
- Public setup/control schema decisions and one canonical private vault OpenAPI
  3.1 contract.
- Decision-complete answers to all eight PRD Section 24 questions.
- Responsive and accessible browser flows and wireframes.
- Updated v2.1 threat model and executable validation matrix.
- Dependency/cryptography selections, review evidence, and PRD readiness update.

### Excluded and deferred

- Production code, generated OpenAPI, migrations, Compose changes, and browser
  implementation.
- Detailed plans or implementation for Milestones 01–10.
- HTTPS/mTLS vault transport, remote provisioning or rotation, feature-driven
  key membership, and deployed-state upgrade migration.
- Independent assurance, human approval, release qualification, and deployment.

## Slice plan

### Slice 1: Approve the v2.1 implementation contract

**Slice contract**

- Outcome: all shared v2.1 implementation decisions and validation evidence are
  explicit, linked, internally consistent, and reviewable.
- Included: architecture, OpenAPI, UX, threat-model, validation, review, status,
  and readiness documents.
- Excluded: executable behavior and later milestone implementation plans.
- Independently testable because: repository checks can validate structure,
  links, examples, OpenAPI parsing, requirement coverage, and prohibited
  material without production code.

**Expected changes**

- Code/modules: none.
- Data/schema/migrations: architecture contract only; no migration.
- API/CLI/UI: schema and interaction contracts only.
- Documentation/operations: all Milestone 00 outputs and acceptance evidence.

**Evidence**

- Positive tests: all required artifacts, Section 24 decisions, PRD requirement
  families, acceptance groups, external-input test mappings, and approved
  review links are present.
- Negative and boundary tests: no unresolved placeholders, non-example
  hostnames, credential examples, remote vault listener, or ambiguous readiness
  claims; Markdown relative links resolve.
- Integration or end-to-end tests: private OpenAPI parses as 3.1 YAML and its
  operations, bounds, authentication fields, responses, and errors match the
  architecture contract.
- Focused commands:
  `node scripts/validate-v2.1-readiness.mjs`.
- Required broad gate: review the documentation diff and rerun the readiness
  validator. Executable build and test suites are not required for this
  documentation-only slice.

**Acceptance mapping**

- Detailed UX/accessibility and data/API approval -> architecture artifacts,
  `docs/audits/v2.1/milestone-00-acceptance.md`, readiness validator.
- Eight Section 24 answers -> `docs/architecture/v2.1/decisions.md`, readiness
  validator.
- Threat model and validation coverage -> `docs/architecture/v2.1/threat-model.md`
  and `docs/architecture/v2.1/validation-matrix.md`.
- Milestones 01 and 02 planning readiness -> explicit handoff sections in the
  data/API and validation artifacts plus acceptance review.
- No contradiction -> cross-artifact review checklist and readiness validator.

## Cross-slice concerns

- Compatibility and migration: v2.1 remains fresh-only except for the exact
  complete-key adoption case; no deployed-state migration is introduced.
- Authorization and security: host, setup, runtime, browser, and OAuth
  authorities remain disjoint; no secret-bearing logs or examples are allowed.
- Invalidation and lifecycle effects: the data contract defines post-commit
  revocation, logout failure, suspension, deletion, and rotation semantics.
- Audit and observability: approvals distinguish authored review from
  independent or human assurance; ordinary telemetry remains secret-free.
- Performance and scale: every list, input, retry, replay cache, batch, and
  stream is bounded in the contracts.
- Environment or external services: no external service is required for this
  documentation slice.

## Milestone completion gate

- `node scripts/validate-v2.1-readiness.mjs`
- Manual cumulative diff review against the milestone and PRD Sections 21–28.
- Confirm the status record contains direct evidence and the commit hash.

## Rollback and recovery

This slice is documentation-only and can be reverted as one commit. Later
milestones must not begin from a reverted or incomplete readiness contract.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | `f9ab951` | `node scripts/validate-v2.1-readiness.mjs`; negative missing-artifact fixture; Markdown/link/OpenAPI/requirement/UX/threat checks; clean `git diff --check` | None |

## Deferred follow-ups

- Independent security, architecture, UX, and accessibility assurance remains a
  later review state and is not implied by Milestone 00 completion.
- Each implementation milestone must replace contract-level test mappings with
  executable evidence.
