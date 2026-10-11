# M18: Separate assisted identity resets

## Outcome and governing contracts
Owner and Administrator initiate distinct, bounded password and Authenticator resets under SECRES-05. Authority: delivery/milestones/secretsauce-mcp/18-assisted-identity-resets.md; docs/web-console-prd.md IDENT-04/05/06, AUTHZ-02/03, AUDIT-01/04; product/security/web-console-security-contract.md SECRES-01/03/04/05; product/architecture/web-console-state-contract.md STATE-01/02/03; product/ux/02-interaction-patterns.md UX-IN08; AGENTS.md.

## Delivery context
Product secretsauce-mcp; active manifest delivery/milestones/secretsauce-mcp/status.yaml; goal M18–21 (this transaction M18 only). New transaction parent 7ca137fee85d669dfb591ca49beeac36640252a9; upstream source/planning provenance workflow/delivery-planning/handoff.yaml. Parent owns milestone status; preexisting test-results/ excluded.

## Current findings and decisions
ConsolePeople already owns synchronous encrypted identity mutations and proof consumption. Existing assisted recovery incorrectly restricts password issuance and replaces password during MFA recovery. Reuse those entry points with versioned generation-bound proofs; reject old incompatible reset proofs rather than reinterpret them. Keep public reset non-enumerating and self-service enrollment compatibility. No transport or infrastructure redesign.

## Scope
Include distinct recovery authority, lifecycle, recipient forms, minimal Administrator target controls, safe notification, regressions and actual HTTPS browser validation. Exclude M19–21, expanded user administration, contact changes, SSO, production deployment.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit | Evidence |
|---|---|---|---|---|---|---|
|01|[Password reset](milestone_18_plan_01_slice_01.md)|Factor-confirmed password-only reset and bounded administrative authority|none|validated; commit pending||6 new tests + 21 related regressions; build|
|02|[Authenticator reset](milestone_18_plan_01_slice_02.md)|Independent factor recovery, continuity, both-lost UX and cumulative acceptance|01|planned|||

## Cross-slice concerns
Proofs carry explicit semantic version and issuer/target generations. Synchronous mutation preserves atomic last-Owner decisions; current store commit uncertainty fences live authority. Retain generation-backed OAuth/reference checks and verifier-only encrypted state. Audit stores bounded identifiers and channel only. Isolated synthetic HTTPS/SMTP fixtures, never running user instance.

## Completion gate
Targeted identity/HTTP/OAuth regressions per slice; actual HTTPS browser roles/purposes/manual/SMTP failure/both-lost, keyboard, 320px and 200% text. Final npm test and npm run build. Evidence evidence/qa/secretsauce-mcp/milestone18/. Inspect cumulative diff and all milestone criteria before parent completes status.

## Rollback and recovery
Old incompatible assisted proofs reject and require authorized reissue; never restore revoked factors or lower generations. Revert code only with quiescent state handling that refuses incompatible authority, not by replaying old identity snapshots.

## Execution notes
Planning persisted and self-checked before production edits. Two vertical slices keep each recipient flow coherent and independently testable.
