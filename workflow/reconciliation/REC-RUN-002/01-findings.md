# Reconciliation findings

Implementation baseline inspected at `ca6be40d83df9c204f804904c018870b6becc31f`. Source-only investigation; no user account mutation or runtime reproduction. All feedback is dated by its package; original wording and provenance are preserved in the canonical result.

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-001 | Administrator-assisted password reset | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High (source) | Resolved REC-DEC-001 | REC-RM-003 | True |
| REC-002 | Administrator-assisted Authenticator reset | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High (source) | Resolved REC-DEC-001 | REC-RM-003 | True |
| REC-003 | Current navigation lacks visible selection and consistent exclusivity | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High (source) | No | Resolved remediation | False |
| REC-004 | Settings sections remain one long page | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High (source) | REC-DEC-002 | Blocked | True |
| REC-005 | Friendly configuration is replaced by required JSON authoring | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High (source) | REC-DEC-002 | Blocked | True |
| REC-006 | SMTP credential deletion waits for configuration apply | PRODUCT_SPEC_GAP | HIGH | NOT_ATTEMPTED | High (source) | Resolved REC-DEC-003 | REC-RM-004 | True |
| REC-007 | Legacy YAML import exists but entry and identifier preservation fall short | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High (source) | No | Resolved remediation | False |

## REC-001: Administrator-assisted password reset

Classification: PRODUCT_SPEC_PROBLEM
Severity: HIGH
Confidence: High for source and authority trace
Reproduction: NOT_ATTEMPTED
Evidence: DOCUMENTED — confirmed PO-FEEDBACK-2026-10-11-001 PO-FB-001, PO-FB-002, product/security/web-console-security-contract.md SECRES-05; REPOSITORY_EVIDENCED — unchanged implementation inspected in REC-RUN-001. Exact current input hashes are in the canonical result.
Current observed behavior: unchanged Owner-only combined recovery / SMTP clear-on-apply implementation as documented in the prior finding. This run changes definition only.
Relevant implementation: src/consolePeople.ts and src/consolePeoplePage.ts; prior detailed source evidence remains in [REC-RUN-001 findings](../REC-RUN-001/01-findings.md).
Relevant UX rule: product/ux/01-information-architecture.md and 02-interaction-patterns.md remain pending derived adoption; no UX authority changed here.
Relevant user journey: docs/web-console-prd-user-journey-audit.md recovery/settings journeys require bounded propagation.
Relevant product requirement: docs/web-console-prd.md IDENT-04/05/06, AUTHZ-02/03 and AUDIT-01 now incorporates SECRES-05.
Architecture/security constraint: product/security/web-console-security-contract.md is the normative bounded resolution; other domain contracts remain intact. Full definition validation remains required.
Root source of inconsistency: previously stale or incomplete PRD now corrected using the confirmed directive and delegated exact semantics. Historical classification is preserved rather than rewriting prior cause as expected behavior.
Authoritative desired state: Separate Owner/Administrator assisted password and MFA reset flows, exact SECRES-05 target hierarchy, factor-preserving password completion and password-preserving factor recovery, issuer/target generation fencing and Owner continuity.
Authoritative artifact requiring change: docs/web-console-prd.md corrected; derived UX/journeys/coverage remain for definition work.
Changed automatically: Yes, APPLIED_AFTER_DECISION
Decision required: No; REC-DEC-001 resolved by bounded specialist evidence and adoption.
Implementation remediation required: REC-RM-003; whole-scope planning remains unready due REC-DEC-002 and definition revalidation.
Affected definition domains: product: true; user_journeys: true; ux: true; architecture: true; security: true. These mean bounded combined-authority validation remains, not an unresolved product choice.
Potentially stale artifacts: exact paths in canonical change_impact; old UX/coverage/journeys are not implementation authority where contradicted by the adopted PRD.
Implementation validation: normative positive/negative contract scenarios; current-role direct denial, concurrency, replay, audit/persistence uncertainty, no secret logging, actual HTTPS browser flows. No tests executed by this definition-only transaction.


## REC-002: Administrator-assisted Authenticator reset

Classification: PRODUCT_SPEC_PROBLEM
Severity: HIGH
Confidence: High for source and authority trace
Reproduction: NOT_ATTEMPTED
Evidence: DOCUMENTED — confirmed PO-FEEDBACK-2026-10-11-001 PO-FB-003, PO-FB-004, product/security/web-console-security-contract.md SECRES-05; REPOSITORY_EVIDENCED — unchanged implementation inspected in REC-RUN-001. Exact current input hashes are in the canonical result.
Current observed behavior: unchanged Owner-only combined recovery / SMTP clear-on-apply implementation as documented in the prior finding. This run changes definition only.
Relevant implementation: src/consolePeople.ts and src/consolePeoplePage.ts; prior detailed source evidence remains in [REC-RUN-001 findings](../REC-RUN-001/01-findings.md).
Relevant UX rule: product/ux/01-information-architecture.md and 02-interaction-patterns.md remain pending derived adoption; no UX authority changed here.
Relevant user journey: docs/web-console-prd-user-journey-audit.md recovery/settings journeys require bounded propagation.
Relevant product requirement: docs/web-console-prd.md IDENT-04/05/06, AUTHZ-02/03 and AUDIT-01 now incorporates SECRES-05.
Architecture/security constraint: product/security/web-console-security-contract.md is the normative bounded resolution; other domain contracts remain intact. Full definition validation remains required.
Root source of inconsistency: previously stale or incomplete PRD now corrected using the confirmed directive and delegated exact semantics. Historical classification is preserved rather than rewriting prior cause as expected behavior.
Authoritative desired state: Separate Owner/Administrator assisted password and MFA reset flows, exact SECRES-05 target hierarchy, factor-preserving password completion and password-preserving factor recovery, issuer/target generation fencing and Owner continuity.
Authoritative artifact requiring change: docs/web-console-prd.md corrected; derived UX/journeys/coverage remain for definition work.
Changed automatically: Yes, APPLIED_AFTER_DECISION
Decision required: No; REC-DEC-001 resolved by bounded specialist evidence and adoption.
Implementation remediation required: REC-RM-003; whole-scope planning remains unready due REC-DEC-002 and definition revalidation.
Affected definition domains: product: true; user_journeys: true; ux: true; architecture: true; security: true. These mean bounded combined-authority validation remains, not an unresolved product choice.
Potentially stale artifacts: exact paths in canonical change_impact; old UX/coverage/journeys are not implementation authority where contradicted by the adopted PRD.
Implementation validation: normative positive/negative contract scenarios; current-role direct denial, concurrency, replay, audit/persistence uncertainty, no secret logging, actual HTTPS browser flows. No tests executed by this definition-only transaction.


## REC-003: Current navigation lacks visible selection and consistent exclusivity

Classification: IMPLEMENTATION_DEFECT
Severity: MEDIUM
Confidence: High for inspected source; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED — src/consolePage.ts:9,23; src/consolePeoplePage.ts:14; src/consoleServicePage.ts:23–24, at the inspected commit. DOCUMENTED — UX-01, UX-04, UX-IA01, UX accessibility semantics. REPORTED — PO-FEEDBACK-2026-10-11-001 items PO-FB-005, PO-FB-006.

Current observed behavior: The stylesheet has no aria-current selection style. Services and My account clear only one peer, while currentNav clears all peers; service-detail tabs set page/false. Browser appearance has not been independently reproduced.

Relevant implementation: src/consolePage.ts:9,23; src/consolePeoplePage.ts:14; src/consoleServicePage.ts:23–24.
Relevant UX rule: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md; UX-IA01 and accessibility current-state rule.
Relevant user journey: docs/web-console-prd-user-journey-audit.md, J-OWNER-SETTINGS / J-AUDITOR-CONFIG and shared navigation.
Relevant product requirement: docs/web-console-prd.md, UX-01, UX-04, UX-IA01, UX accessibility semantics.
Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01–03 current role/draft/secret boundaries and product/security/web-console-security-contract.md SECRES-01/03/04 capability, recovery and durable audit. No relaxation is authorized. For navigation and import-entry/identifier repair, those contracts remain semantically valid and require implementation regression only.

Root source of inconsistency: Implementation omits visible current-area distinction required by UX-IA01 and fails consistent current-navigation semantics.
Authoritative desired state: Exactly one primary area and one applicable subnavigation item are visibly and programmatically current; focus remains independently visible.
Authoritative artifact requiring change: None for the resolved bounded remediation.
Changed automatically: No
Decision required: No
Implementation remediation required: REC-RM-001

Affected definition domains: {architecture: false, product: false, security: false, user_journeys: false, ux: false}
Potentially stale artifacts: None on this finding alone.
Implementation validation: positive task completion, current-role denial, cancellation and stale-state failures; actual HTTPS keyboard/narrow-screen conformance for relevant pages. Existing import and recovery suites are evidence inspected, not tests executed in this run.



## REC-004: Settings sections remain one long page

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High for inspected source; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED — src/consolePeoplePage.ts:22, at the inspected commit. DOCUMENTED — UX-02, UX-IA03, UX-IN01. REPORTED — PO-FEEDBACK-2026-10-11-001 items PO-FB-007, PO-FB-008, PO-FB-009.

Current observed behavior: settings() appends authentication, protection, limits, health, backup, retention and email together. Existing labels group topics but do not constrain the page to the chosen task.

Relevant implementation: src/consolePeoplePage.ts:22.
Relevant UX rule: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md; UX-02, UX-IA03, UX-IN01.
Relevant user journey: docs/web-console-prd-user-journey-audit.md, J-OWNER-SETTINGS / J-AUDITOR-CONFIG and shared navigation.
Relevant product requirement: docs/web-console-prd.md, UX-02, UX-IA03, UX-IN01.
Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01–03 current role/draft/secret boundaries and product/security/web-console-security-contract.md SECRES-01/03/04 capability, recovery and durable audit. No relaxation is authorized. For navigation and import-entry/identifier repair, those contracts remain semantically valid and require implementation regression only.

Root source of inconsistency: Canonical Settings placement names sections but leaves focused section navigation and cross-section search/draft behavior unspecified for the newer no-long-page directive.
Authoritative desired state: Focused Settings sections preserve every capability and role boundary. Subtabs remain exploratory, not selected. Section navigation and search/draft transitions need UX specification.
Authoritative artifact requiring change: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/07-acceptance-checklist.md, docs/web-console-prd-user-journey-audit.md.
Changed automatically: No
Decision required: REC-DEC-002
Implementation remediation required: Blocked pending domain semantics

Affected definition domains: {architecture: false, product: false, security: false, user_journeys: true, ux: true}
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/07-acceptance-checklist.md, docs/web-console-prd-user-journey-audit.md.
Implementation validation: positive task completion, current-role denial, cancellation and stale-state failures; actual HTTPS keyboard/narrow-screen conformance for relevant pages. Existing import and recovery suites are evidence inspected, not tests executed in this run.



## REC-005: Friendly configuration is replaced by required JSON authoring

Classification: IMPLEMENTATION_DEFECT
Severity: MEDIUM
Confidence: High for inspected source; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED — src/consoleServicePage.ts:42; src/consolePeoplePage.ts:22–23, at the inspected commit. DOCUMENTED — UX-02, CONFIG-01, UX-IA03, UX-IN01. REPORTED — PO-FEEDBACK-2026-10-11-001 items PO-FB-010, PO-FB-011.

Current observed behavior: Shared scanner catalogs require a JSON textarea. SMTP applied/draft and review are JSON blocks. Advanced editor itself is intentional and remains a supported capability.

Relevant implementation: src/consoleServicePage.ts:42; src/consolePeoplePage.ts:22–23.
Relevant UX rule: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md; UX-02, CONFIG-01, UX-IA03, UX-IN01.
Relevant user journey: docs/web-console-prd-user-journey-audit.md, J-OWNER-SETTINGS / J-AUDITOR-CONFIG and shared navigation.
Relevant product requirement: docs/web-console-prd.md, UX-02, CONFIG-01, UX-IA03, UX-IN01.
Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01–03 current role/draft/secret boundaries and product/security/web-console-security-contract.md SECRES-01/03/04 capability, recovery and durable audit. No relaxation is authorized. For navigation and import-entry/identifier repair, those contracts remain semantically valid and require implementation regression only.

Root source of inconsistency: Ordinary friendly controls and plain-language summaries are already required; the implementation exposes technical data as the routine task. Exact bounded control/summary coverage must be derived before implementation handoff, without removing supported advanced options.
Authoritative desired state: Routine configuration and review use friendly controls/summaries; preserve same-draft advanced capability without forcing JSON for ordinary tasks.
Authoritative artifact requiring change: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/07-acceptance-checklist.md, docs/web-console-prd-coverage.md.
Changed automatically: No
Decision required: REC-DEC-002
Implementation remediation required: Blocked pending domain semantics

Affected definition domains: {architecture: false, product: false, security: false, user_journeys: true, ux: true}
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/07-acceptance-checklist.md, docs/web-console-prd-coverage.md.
Implementation validation: positive task completion, current-role denial, cancellation and stale-state failures; actual HTTPS keyboard/narrow-screen conformance for relevant pages. Existing import and recovery suites are evidence inspected, not tests executed in this run.



## REC-006: SMTP credential deletion waits for configuration apply

Classification: PRODUCT_SPEC_GAP
Severity: HIGH
Confidence: High for source and authority trace
Reproduction: NOT_ATTEMPTED
Evidence: DOCUMENTED — confirmed PO-FEEDBACK-2026-10-11-001 PO-FB-012, PO-FB-013, product/architecture/web-console-state-contract.md STATE-01/02/03 SMTP deletion amendment; REPOSITORY_EVIDENCED — unchanged implementation inspected in REC-RUN-001. Exact current input hashes are in the canonical result.
Current observed behavior: unchanged Owner-only combined recovery / SMTP clear-on-apply implementation as documented in the prior finding. This run changes definition only.
Relevant implementation: src/consoleNotifications.ts and src/consolePeoplePage.ts; prior detailed source evidence remains in [REC-RUN-001 findings](../REC-RUN-001/01-findings.md).
Relevant UX rule: product/ux/01-information-architecture.md and 02-interaction-patterns.md remain pending derived adoption; no UX authority changed here.
Relevant user journey: docs/web-console-prd-user-journey-audit.md recovery/settings journeys require bounded propagation.
Relevant product requirement: docs/web-console-prd.md IDENT-04, CONFIG-03/04 and IDENT-06 now incorporates STATE-01/02/03 SMTP deletion amendment.
Architecture/security constraint: product/architecture/web-console-state-contract.md is the normative bounded resolution; other domain contracts remain intact. Full definition validation remains required.
Root source of inconsistency: previously stale or incomplete PRD now corrected using the confirmed directive and delegated exact semantics. Historical classification is preserved rather than rewriting prior cause as expected behavior.
Authoritative desired state: Owner independently confirms SMTP credential deletion after enabled dependency removal; current version/revision, audit and stale-draft checks prevent resurrection; creation/replacement retain draft/review/apply.
Authoritative artifact requiring change: docs/web-console-prd.md corrected; derived UX/journeys/coverage remain for definition work.
Changed automatically: Yes, APPLIED_AFTER_DECISION
Decision required: No; REC-DEC-003 resolved by bounded specialist evidence and adoption.
Implementation remediation required: REC-RM-004; whole-scope planning remains unready due REC-DEC-002 and definition revalidation.
Affected definition domains: product: true; user_journeys: true; ux: true; architecture: true; security: true. These mean bounded combined-authority validation remains, not an unresolved product choice.
Potentially stale artifacts: exact paths in canonical change_impact; old UX/coverage/journeys are not implementation authority where contradicted by the adopted PRD.
Implementation validation: normative positive/negative contract scenarios; current-role direct denial, concurrency, replay, audit/persistence uncertainty, no secret logging, actual HTTPS browser flows. No tests executed by this definition-only transaction.


## REC-007: Legacy YAML import exists but entry and identifier preservation fall short

Classification: IMPLEMENTATION_DEFECT
Severity: MEDIUM
Confidence: High for inspected source; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED — src/consoleServicePage.ts:23,40–41; src/consoleMigration.ts:8–42; test/console-migration.test.ts, at the inspected commit. DOCUMENTED — MIGRATE-01–04, UX-IA02–04. REPORTED — PO-FEEDBACK-2026-10-11-001 items PO-FB-014.

Current observed behavior: Configuration tools imports raw legacy gateway YAML plus both catalogs with explicit identity mappings and write-only credential values. Services lacks the required direct Import configuration action. Import rejects new-to-managed legacy service IDs outside the new-service creation regex, although legacy config accepts dictionary keys; current managed IDs bypass that restriction.

Relevant implementation: src/consoleServicePage.ts:23,40–41; src/consoleMigration.ts:8–42; test/console-migration.test.ts.
Relevant UX rule: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md; MIGRATE-01–04, UX-IA02–04.
Relevant user journey: docs/web-console-prd-user-journey-audit.md, J-OWNER-HISTORY / J-ADMIN-HISTORY.
Relevant product requirement: docs/web-console-prd.md, MIGRATE-01–04, UX-IA02–04.
Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01–03 current role/draft/secret boundaries and product/security/web-console-security-contract.md SECRES-01/03/04 capability, recovery and durable audit. No relaxation is authorized. For navigation and import-entry/identifier repair, those contracts remain semantically valid and require implementation regression only.

Root source of inconsistency: Import is already required, not new scope. UX-IA02 promises Services entry, and MIGRATE-01 promises preservation of supported identifiers. Existing tested migration must be retained and these concrete violations repaired.
Authoritative desired state: Expose existing guided import directly to Owner/Administrator and preserve legacy-supported identifiers on first import with safe dictionary handling, while retaining explicit rejection of genuinely unsupported fields.
Authoritative artifact requiring change: None for the resolved bounded remediation.
Changed automatically: No
Decision required: No
Implementation remediation required: REC-RM-002

Affected definition domains: {architecture: false, product: false, security: false, user_journeys: false, ux: false}
Potentially stale artifacts: None on this finding alone.
Implementation validation: positive task completion, current-role denial, cancellation and stale-state failures; actual HTTPS keyboard/narrow-screen conformance for relevant pages. Existing import and recovery suites are evidence inspected, not tests executed in this run.
