# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: docs/web-console-prd.md MIGRATE-01/02, AUTHZ-01/02, UX-03; product/ux/01-information-architecture.md UX-IA04/06; product/ux/07-acceptance-checklist.md UX-C33
> Preservation baseline: 4703c56c17020bc04f8a58c90c1ae0f23ca3886e; YAML import, explicit grants, exact literals, current policy evaluation, write-only values and reviewed activation
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

Only the following independent outcome is resolved. Whole-scope planning remains blocked by the canonical decisions. None of the redesign or lifecycle proposals is included as implementation-ready work.

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| HIGH | REC-RM-015 | Repair unresolved imported subjects from the draft with actionable errors | REC-032 | MIGRATE-01/02, UX-03, UX-IA04/06 | Existing eligible identity authority | Positive/negative mapping and browser recovery |

## REC-RM-015: Actionable imported identity correction

Priority: HIGH
Source findings: REC-032
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-116, PO-FB-119, PO-FB-121, PO-FB-122
Authoritative basis: existing approved MIGRATE-01/02 and UX-IA04/06, not a proposed new grant model.
Desired outcome: An authorized editor can identify and explicitly correct every unresolved imported subject in the saved draft and reach fresh review without guessing or repeating unrelated work.
Current behavior: Import stores missingMappings and shows a count; save preserves the blocker; review gives a generic reimport message. Selecting a proposed account does not establish legacy-subject mapping.
Required behavior: Show permitted unresolved subjects and affected service/field context, explain the identity distinction, expose explicit eligible local or exact registered external mapping correction and current validation failures. Preserve safe draft work and exact configuration. Continue to block apply until all required mappings and dependencies are valid; never infer mappings from email or role.
Affected users/roles: Owner and Administrator within current configuration and identity-selection authority; Auditor/Member cannot mutate.
Affected interfaces and compatibility: Import result, draft editor/review and mapping admission. Keep existing YAML/catalog fields, literal IDs, external issuer/subject identity and managed source-of-truth behavior.
UX constraints: Field-linked/actionable errors and permitted draft correction under UX-IA04/06; layout follows applicable canonical UX, with no invented modal requirement.
Architecture/security constraints: STATE-01/02 grants apply only explicitly/currently; AUTHZ-01/02 and mandatory audit. Mapping is not a console invitation or automatic activation. No arbitrary host credential reads or secret persistence in browser.

Acceptance criteria:
1. Import with unresolved subjects shows each permitted subject, why review is blocked and a reachable correction action. Correct explicit mappings allow fresh review and normal apply.
2. Merely selecting the current Owner account as an assignment does not silently clear unrelated legacy mappings. Unknown, duplicate, disabled, unenrolled, wrong external issuer/subject and forbidden-role mappings fail with safe actionable errors.
3. Current permissions, service revision and identity eligibility are rechecked; concurrent revocation, stale state and audit failure cannot activate or grant access. Preserve authorized non-secret draft work for correction.
4. Partial mapping leaves only genuine remaining blockers; existing active services retain current assignments until authorized changes and prior applied configuration until explicit successful apply.
5. Existing imports without unresolved identities remain successful; imported identifiers, regexes, methods, ordering, catalogs and exceptions survive correction; no secret value appears in URL/log/history/export.

Dependencies: Existing identity/migration authority; no unresolved product decision is required for this isolated desired outcome. Final redesigned placement is separate REC-DEC-009 work.
Explicit exclusions: User creation, inferred email mappings, new external identity provisioning, bulk activation, relaxed enrollment/role checks and redesign of unrelated settings.
Required implementation validation: Unit/integration positive and negative mapping/admission tests plus a real browser journey from imported blocked draft through correction to review, preserving safe work and testing denied/stale/error paths. This run performs no implementation tests or code changes.
