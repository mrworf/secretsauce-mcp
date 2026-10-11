# Reconciliation findings

Inspected repository at `ca6be40d83df9c204f804904c018870b6becc31f`. Source-only investigation; no user account mutation or runtime reproduction. All feedback is dated by its package; original wording and provenance are preserved in the canonical result.

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-001 | Administrator-assisted password reset | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High (source) | REC-DEC-001 | Blocked | True |
| REC-002 | Administrator-assisted Authenticator reset | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High (source) | REC-DEC-001 | Blocked | True |
| REC-003 | Current navigation lacks visible selection and consistent exclusivity | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High (source) | No | Resolved remediation | False |
| REC-004 | Settings sections remain one long page | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High (source) | REC-DEC-002 | Blocked | True |
| REC-005 | Friendly configuration is replaced by required JSON authoring | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High (source) | REC-DEC-002 | Blocked | True |
| REC-006 | SMTP credential deletion waits for configuration apply | PRODUCT_SPEC_GAP | HIGH | NOT_ATTEMPTED | High (source) | REC-DEC-003 | Blocked | True |
| REC-007 | Legacy YAML import exists but entry and identifier preservation fall short | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High (source) | No | Resolved remediation | False |

## REC-001: Administrator-assisted password reset

Classification: PRODUCT_SPEC_PROBLEM
Severity: HIGH
Confidence: High for inspected source; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED — src/consolePeople.ts:49,107; src/consolePeoplePage.ts:15–17, at the inspected commit. DOCUMENTED — IDENT-05, AUTHZ-02, role matrix. REPORTED — PO-FEEDBACK-2026-10-11-001 items PO-FB-001, PO-FB-002.

Current observed behavior: Owner recovery already exists through Recover → Password reset; Administrator is rejected by identity authorization. This source inspection does not reproduce the reported Owner experience.

Relevant implementation: src/consolePeople.ts:49,107; src/consolePeoplePage.ts:15–17.
Relevant UX rule: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md; IDENT-05, AUTHZ-02, role matrix.
Relevant user journey: docs/web-console-prd-user-journey-audit.md, J-OWNER-RECOVERY and missing Administrator counterpart.
Relevant product requirement: docs/web-console-prd.md, IDENT-05, AUTHZ-02, role matrix.
Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01–03 current role/draft/secret boundaries and product/security/web-console-security-contract.md SECRES-01/03/04 capability, recovery and durable audit. No relaxation is authorized. For navigation and import-entry/identifier repair, those contracts remain semantically valid and require implementation regression only.

Root source of inconsistency: PRD role matrix and IDENT-05; UX-IA04 and SECRES-03 expressly reserve recovery to Owner, conflicting with the newer confirmed Administrator directive.
Authoritative desired state: Owner and Administrator can initiate password resets for other users; password reset must retain MFA. Target restrictions, privileged-target/last-Owner continuity and issuer revalidation need bounded resolution.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, docs/web-console-prd-user-journey-audit.md, docs/web-console-prd-coverage.md.
Changed automatically: No
Decision required: REC-DEC-001
Implementation remediation required: Blocked pending domain semantics

Affected definition domains: {architecture: true, product: true, security: true, user_journeys: true, ux: true}
Potentially stale artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, docs/web-console-prd-user-journey-audit.md, docs/web-console-prd-coverage.md.
Implementation validation: positive task completion, current-role denial, cancellation and stale-state failures; actual HTTPS keyboard/narrow-screen conformance for relevant pages. Existing import and recovery suites are evidence inspected, not tests executed in this run.


## REC-002: Administrator-assisted Authenticator reset

Classification: PRODUCT_SPEC_PROBLEM
Severity: HIGH
Confidence: High for inspected source; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED — src/consolePeople.ts:107–115; src/consolePeoplePage.ts:17, at the inspected commit. DOCUMENTED — IDENT-05, AUTHZ-03, SECRES-03. REPORTED — PO-FEEDBACK-2026-10-11-001 items PO-FB-003, PO-FB-004.

Current observed behavior: Owner recovery includes fresh MFA enrollment; Administrator lacks identity recovery permission. Authorization immediately restricts targets and invalidates sessions/grants. No runtime reset was attempted.

Relevant implementation: src/consolePeople.ts:107–115; src/consolePeoplePage.ts:17.
Relevant UX rule: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md; IDENT-05, AUTHZ-03, SECRES-03.
Relevant user journey: docs/web-console-prd-user-journey-audit.md, J-OWNER-RECOVERY and missing Administrator counterpart.
Relevant product requirement: docs/web-console-prd.md, IDENT-05, AUTHZ-03, SECRES-03.
Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01–03 current role/draft/secret boundaries and product/security/web-console-security-contract.md SECRES-01/03/04 capability, recovery and durable audit. No relaxation is authorized. For navigation and import-entry/identifier repair, those contracts remain semantically valid and require implementation regression only.

Root source of inconsistency: Same Owner-only authority is stale for MFA recovery; silently widening the identity permission would incorrectly grant unrelated invitation/role powers.
Authoritative desired state: Owner and Administrator can initiate other-user MFA resets, with fresh enrollment and no MFA-disable shortcut; safe target hierarchy and issuer/continuity checks remain unresolved.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, docs/web-console-prd-user-journey-audit.md, docs/web-console-prd-coverage.md.
Changed automatically: No
Decision required: REC-DEC-001
Implementation remediation required: Blocked pending domain semantics

Affected definition domains: {architecture: true, product: true, security: true, user_journeys: true, ux: true}
Potentially stale artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, docs/web-console-prd-user-journey-audit.md, docs/web-console-prd-coverage.md.
Implementation validation: positive task completion, current-role denial, cancellation and stale-state failures; actual HTTPS keyboard/narrow-screen conformance for relevant pages. Existing import and recovery suites are evidence inspected, not tests executed in this run.


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
Confidence: High for inspected source; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED — src/consolePeoplePage.ts:23; src/consoleNotifications.ts:111–112, at the inspected commit. DOCUMENTED — CONFIG-02, CONFIG-03, IDENT-04, STATE-01–03. REPORTED — PO-FEEDBACK-2026-10-11-001 items PO-FB-012, PO-FB-013.

Current observed behavior: Delete SMTP credential on apply writes clearCredential into the SMTP draft. Service credential value deletion already uses a separate immediate confirmed action. No legacy-bearer delete checkbox was found.

Relevant implementation: src/consolePeoplePage.ts:23; src/consoleNotifications.ts:111–112.
Relevant UX rule: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md; CONFIG-02, CONFIG-03, IDENT-04, STATE-01–03.
Relevant user journey: docs/web-console-prd-user-journey-audit.md, J-OWNER-SETTINGS / J-AUDITOR-CONFIG and shared navigation.
Relevant product requirement: docs/web-console-prd.md, CONFIG-02, CONFIG-03, IDENT-04, STATE-01–03.
Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01–03 current role/draft/secret boundaries and product/security/web-console-security-contract.md SECRES-01/03/04 capability, recovery and durable audit. No relaxation is authorized. For navigation and import-entry/identifier repair, those contracts remain semantically valid and require implementation regression only.

Root source of inconsistency: The new explicit independent-delete directive is settled, but SMTP dependency, active-delivery, pending-draft and history behavior are not explicitly covered by the current service-credential-centric immediate-action contract.
Authoritative desired state: Deletion is an explicit confirmed action independent of applying unrelated edits; specify dependency handling and prevent stale drafts/history resurrecting deleted values.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/02-interaction-patterns.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, docs/web-console-prd-user-journey-audit.md, docs/web-console-prd-coverage.md.
Changed automatically: No
Decision required: REC-DEC-003
Implementation remediation required: Blocked pending domain semantics

Affected definition domains: {architecture: true, product: true, security: true, user_journeys: true, ux: true}
Potentially stale artifacts: docs/web-console-prd.md, product/ux/02-interaction-patterns.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, docs/web-console-prd-user-journey-audit.md, docs/web-console-prd-coverage.md.
Implementation validation: positive task completion, current-role denial, cancellation and stale-state failures; actual HTTPS keyboard/narrow-screen conformance for relevant pages. Existing import and recovery suites are evidence inspected, not tests executed in this run.


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
