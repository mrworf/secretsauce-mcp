# Findings

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-019 | Preserve successful import, Activity and guided foundation | EXPECTED_BEHAVIOR | LOW | NOT_ATTEMPTED | High on source / reported visual | None | No | No |
| REC-020 | Service list status, row navigation and lifecycle actions | UX_SPEC_GAP | HIGH | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009, REC-DEC-010 | Blocked | Yes |
| REC-021 | Readable configuration overview and section composition | UX_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-022 | Credential last-change actor | PRODUCT_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-008 | Blocked | Yes |
| REC-023 | Credential Set/Replace dialog interaction | UX_SPEC_GAP | HIGH | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-024 | Delete clears referenced value but retains key | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-008 | Blocked | Yes |
| REC-025 | Understandable execution assignment context | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-026 | Global editing mode and navigable guided steps | UX_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-027 | Service-specific field comprehension | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-028 | Destination TLS scope, disclosure and identifiers | UX_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-029 | New credential insertion focus and scroll | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-030 | Policy rule list, method selection and add/edit consistency | UX_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-031 | Browser and policy-tool context preservation | UX_SPEC_GAP | HIGH | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |
| REC-032 | Unresolved import identities have no actionable draft repair | IMPLEMENTATION_DEFECT | HIGH | NOT_ATTEMPTED | High on source / reported visual | None | REC-RM-015 | No |
| REC-033 | Preserve safe policy preview with optional presentation exploration | EXPECTED_BEHAVIOR | LOW | NOT_ATTEMPTED | High on source / reported visual | None | No | No |
| REC-034 | Research-led service editing refinement | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source / reported visual | REC-DEC-009 | Blocked | Yes |

## REC-019: Preserve successful import, Activity and guided foundation
Classification: EXPECTED_BEHAVIOR  
Severity: LOW  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-042, PO-FB-069, PO-FB-070, PO-FB-081, PO-FB-088; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleMigration.ts importConfiguration; src/consoleServicePage.ts serviceDetail/renderEditor, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (BASE-01, CONFIG-01, MIGRATE-01); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA02/04; UX-IN04).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-042, PO-FB-069, PO-FB-070, PO-FB-081, PO-FB-088.

Current observed behavior: Import preserves supported YAML into drafts; Activity and guided/authentication basics are reported satisfactory. No removal or replacement of these capabilities is requested.

Relevant implementation: src/consoleMigration.ts importConfiguration; src/consoleServicePage.ts serviceDetail/renderEditor.

Relevant UX rule: UX-IA02/04; UX-IN04.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CONFIG, J-OWNER-HISTORY.

Relevant product requirement: docs/web-console-prd.md: BASE-01, CONFIG-01, MIGRATE-01.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Preserved capability has affirmative authority and implementation support; no required change follows from praise or exploratory presentation.

Authoritative desired state: Preserve YAML import, Activity, guided editing and adding multiple destinations. Positive reports are not proof that every import/review state works.

Authoritative artifact requiring change: None.
Changed automatically: No
Decision required: No.
Implementation remediation required: No.

Affected definition domains: {"product": false, "user_journeys": false, "ux": false, "architecture": false, "security": false}.
Potentially stale artifacts: None.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-020: Service list status, row navigation and lifecycle actions
Classification: UX_SPEC_GAP  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-043, PO-FB-044, PO-FB-045, PO-FB-046, PO-FB-047, PO-FB-048, PO-FB-049; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts services/serviceDetail; src/consoleServices.ts list/lifecycle, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (UX-01, CONFIG-05); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA02, UX-IN03).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-043, PO-FB-044, PO-FB-045, PO-FB-046, PO-FB-047, PO-FB-048, PO-FB-049.

Current observed behavior: List renders lifecycle and draft as plain text and an Open action. It lacks whole-row navigation and right-side requested lifecycle actions. Existing archive retains history; requested Delete is not yet specified against that lifecycle.

Relevant implementation: src/consoleServicePage.ts services/serviceDetail; src/consoleServices.ts list/lifecycle.

Relevant UX rule: UX-IA02, UX-IN03.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-ACCESS.

Relevant product requirement: docs/web-console-prd.md: UX-01, CONFIG-05.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Represent active and pending draft independently; make rows navigable and provide confirmed lifecycle actions. Color bars are exploratory. Resolve Delete semantics without silently removing audit/history.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009, REC-DEC-010.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": true, "user_journeys": true, "ux": true, "architecture": true, "security": true}.
Potentially stale artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, docs/web-console-prd-coverage.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-021: Readable configuration overview and section composition
Classification: UX_SPEC_PROBLEM  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-050, PO-FB-051, PO-FB-052, PO-FB-053, PO-FB-054, PO-FB-055, PO-FB-056, PO-FB-057, PO-FB-058, PO-FB-059; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts serviceDetail; src/consoleFriendlyPage.ts renderConfig, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (UX-02, UX-03, CONFIG-01); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA02/06; UX-IN01/11; UX-V05).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-050, PO-FB-051, PO-FB-052, PO-FB-053, PO-FB-054, PO-FB-055, PO-FB-056, PO-FB-057, PO-FB-058, PO-FB-059.

Current observed behavior: Owner reports cryptic empty overview, redundant bars, one long configuration and visually merged rules. Code renders applied and draft summaries plus repeated controls; source inspection cannot establish exact visual severity.

Relevant implementation: src/consoleServicePage.ts serviceDetail; src/consoleFriendlyPage.ts renderConfig.

Relevant UX rule: UX-IA02/06; UX-IN01/11; UX-V05.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CONFIG.

Relevant product requirement: docs/web-console-prd.md: UX-02, UX-03, CONFIG-01.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Design understandable distinct service configuration sections and truthful empty/current/draft states. Preserve review/apply safety; do not simply delete bars based on an observation.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-022: Credential last-change actor
Classification: PRODUCT_SPEC_GAP  
Severity: MEDIUM  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-060; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServices.ts ManagedCredential, credential, detail; src/consoleMigration.ts, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (CONFIG-02, AUDIT-01); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA06 Authentication).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-060.

Current observed behavior: ManagedCredential stores value/version/changed but no last-change actor; detail exposes time/version only. Current last-change metadata requirement does not settle legacy/restore actor display.

Relevant implementation: src/consoleServices.ts ManagedCredential, credential, detail; src/consoleMigration.ts.

Relevant UX rule: UX-IA06 Authentication.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CREDENTIAL.

Relevant product requirement: docs/web-console-prd.md: CONFIG-02, AUDIT-01.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Show who changed each credential alongside its change metadata. Resolve non-fabricated legacy, system/import and restored actor attribution; preserve write-only secrets.

Authoritative artifact requiring change: docs/web-console-prd.md.
Changed automatically: No
Decision required: REC-DEC-008.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": true, "user_journeys": true, "ux": true, "architecture": true, "security": true}.
Potentially stale artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, docs/web-console-prd-coverage.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-023: Credential Set/Replace dialog interaction
Classification: UX_SPEC_GAP  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-061, PO-FB-062, PO-FB-096, PO-FB-097, PO-FB-098; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts serviceDetail/renderEditor step 2; src/consolePresentation.ts, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (CONFIG-02, UX-02, UX-04); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IN01/03; UX-A04).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-061, PO-FB-062, PO-FB-096, PO-FB-097, PO-FB-098.

Current observed behavior: Both configuration and wizard render password inputs inline and separate immediate buttons. Required-field context is confusing; the canonical credential card rule does not fully specify shared entry dialog state.

Relevant implementation: src/consoleServicePage.ts serviceDetail/renderEditor step 2; src/consolePresentation.ts.

Relevant UX rule: UX-IN01/03; UX-A04.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CREDENTIAL.

Relevant product requirement: docs/web-console-prd.md: CONFIG-02, UX-02, UX-04.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Set/Replace opens a write-only Save/Cancel dialog in both locations; no inline secret input or reveal. Keep metadata associated with its credential and action-scoped validation.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-024: Delete clears referenced value but retains key
Classification: PRODUCT_SPEC_PROBLEM  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServices.ts credential/publish/fingerprint; src/consoleMigration.ts, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (CONFIG-02, CONFIG-03, CONFIG-04); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IN03; UX-IA06).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067.

Current observed behavior: CONFIG-02 forbids referenced credential deletion; credential() rejects applied or draft dependencies. New confirmed PO-FB-065/066 instead requires Delete to clear only the value while retaining an in-use key, and explain that consequence.

Relevant implementation: src/consoleServices.ts credential/publish/fingerprint; src/consoleMigration.ts.

Relevant UX rule: UX-IN03; UX-IA06.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CREDENTIAL.

Relevant product requirement: docs/web-console-prd.md: CONFIG-02, CONFIG-03, CONFIG-04.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Existing explicit dependency-block rule conflicts with the new confirmed clearing requirement; this is stale product authority, not expected behavior.

Authoritative desired state: Required intent: Delete on an in-use credential clears its value, retains its key, and explains this before proceeding; only unreferenced keys may be deleted. Derive safe admission, revision, audit, persistence/restart and restore contracts. Do not extend this to SMTP.

Authoritative artifact requiring change: docs/web-console-prd.md.
Changed automatically: No
Decision required: REC-DEC-008.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": true, "user_journeys": true, "ux": true, "architecture": true, "security": true}.
Potentially stale artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, docs/web-console-prd-coverage.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-025: Understandable execution assignment context
Classification: UX_SPEC_GAP  
Severity: MEDIUM  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-068, PO-FB-101; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts serviceDetail Access/renderEditor step 3; src/consoleServices.ts access, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (AUTHZ-01, CONFIG-03); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA02/04; UX-IN03).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-068, PO-FB-101.

Current observed behavior: Access shows assignments and grants only for an applied service; new-service checkboxes propose grants. Neither role ownership nor selecting oneself can resolve an import subject mapping. Owner reports that distinction is unclear.

Relevant implementation: src/consoleServicePage.ts serviceDetail Access/renderEditor step 3; src/consoleServices.ts access.

Relevant UX rule: UX-IA02/04; UX-IN03.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-ACCESS.

Relevant product requirement: docs/web-console-prd.md: AUTHZ-01, CONFIG-03.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Explain who can use the service and when assignments take effect; distinguish new proposed grants, current immediate access and imported subject mapping without changing permissions.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-026: Global editing mode and navigable guided steps
Classification: UX_SPEC_PROBLEM  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-071, PO-FB-072, PO-FB-073, PO-FB-074, PO-FB-075, PO-FB-076, PO-FB-077, PO-FB-087, PO-FB-124; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor/advancedEditor, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (CONFIG-01, POLICY-02, UX-02); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA02/03/06; UX-IN11).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-071, PO-FB-072, PO-FB-073, PO-FB-074, PO-FB-075, PO-FB-076, PO-FB-077, PO-FB-087, PO-FB-124.

Current observed behavior: renderEditor repeats Advanced editor (same draft) and heading; initial step list is inert. Existing-section tabs work but initial Back requires footer. Advanced editing covers the complete service.

Relevant implementation: src/consoleServicePage.ts renderEditor/advancedEditor.

Relevant UX rule: UX-IA02/03/06; UX-IN11.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CONFIG.

Relevant product requirement: docs/web-console-prd.md: CONFIG-01, POLICY-02, UX-02.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Offer one global Guided/Advanced switch, clickable guided steps and no redundant selected-step heading or same-draft wording. Retain exact supported fields and unsaved work. Nested per-step advanced tabs were superseded exploratory placement, not required design.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-027: Service-specific field comprehension
Classification: UX_SPEC_GAP  
Severity: MEDIUM  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-078, PO-FB-079, PO-FB-080, PO-FB-089, PO-FB-090, PO-FB-091, PO-FB-092, PO-FB-093, PO-FB-094, PO-FB-095, PO-FB-102, PO-FB-103, PO-FB-105; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consolePresentation.ts fieldHints/fieldHint; src/consoleServicePage.ts renderEditor; src/policy.ts, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (UX-02, POLICY-01, BASE-01); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA06/08; UX-IN01/04).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-078, PO-FB-079, PO-FB-080, PO-FB-089, PO-FB-090, PO-FB-091, PO-FB-092, PO-FB-093, PO-FB-094, PO-FB-095, PO-FB-102, PO-FB-103, PO-FB-105.

Current observed behavior: Labels/help exist in consolePresentation but Owner cannot understand prefix/suffix, generic placement, header ownership, host matching and policy reason/default. Existing help promises do not settle the refreshed composition and wording.

Relevant implementation: src/consolePresentation.ts fieldHints/fieldHint; src/consoleServicePage.ts renderEditor; src/policy.ts.

Relevant UX rule: UX-IA06/08; UX-IN01/04.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CONFIG, J-OWNER-POLICY.

Relevant product requirement: docs/web-console-prd.md: UX-02, POLICY-01, BASE-01.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Explain docs as useful to an LLM; allowed destinations/matcher choices, literal prefix/value/suffix, header ownership, default allow/deny and rule reason. Show the lone placement field directly. Default allow does not prohibit allow rules: POLICY-01 still governs priorities and ties.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-028: Destination TLS scope, disclosure and identifiers
Classification: UX_SPEC_PROBLEM  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-082, PO-FB-083, PO-FB-084, PO-FB-085, PO-FB-086; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor step 1; src/config.ts destination normalization/serviceDraft, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (BASE-01, POLICY-02, POLICY-04); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA03/06; UX-IN04).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-082, PO-FB-083, PO-FB-084, PO-FB-085, PO-FB-086.

Current observed behavior: Current authority preserves service-default TLS and destination overrides, and stable identifiers. Nested advanced disclosure and ordinary identifier fields conflict with the requested simpler conditional exposure.

Relevant implementation: src/consoleServicePage.ts renderEditor step 1; src/config.ts destination normalization/serviceDraft.

Relevant UX rule: UX-IA03/06; UX-IN04.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CONFIG.

Relevant product requirement: docs/web-console-prd.md: BASE-01, POLICY-02, POLICY-04.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Show service TLS default visibly and identify per-destination inheritance/override. Avoid nested disclosures. Hide identifiers in ordinary work only if system-only; service/destination identifiers used in MCP/import must remain accessible and unchanged. Focused advanced page is exploratory.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-029: New credential insertion focus and scroll
Classification: UX_SPEC_GAP  
Severity: MEDIUM  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-099, PO-FB-100; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor step 2, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (UX-03, UX-04); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IN11; UX-A04).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-099, PO-FB-100.

Current observed behavior: Add credential mutates draft then rebuilds editor with no insertion-focus/scroll step. Exact rendered jump is reported, not independently reproduced.

Relevant implementation: src/consoleServicePage.ts renderEditor step 2.

Relevant UX rule: UX-IN11; UX-A04.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CONFIG.

Relevant product requirement: docs/web-console-prd.md: UX-03, UX-04.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: After adding a credential, scroll to the new item with coherent keyboard focus; preserve safe existing work and viewport context.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-030: Policy rule list, method selection and add/edit consistency
Classification: UX_SPEC_PROBLEM  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-104, PO-FB-106, PO-FB-107, PO-FB-108, PO-FB-109, PO-FB-110, PO-FB-117, PO-FB-118; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor step 3/editRule; src/config.ts methods schema, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (POLICY-01, POLICY-02, BASE-01); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA06; UX-IN04).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-104, PO-FB-106, PO-FB-107, PO-FB-108, PO-FB-109, PO-FB-110, PO-FB-117, PO-FB-118.

Current observed behavior: Always-visible Basic request rule precedes paragraph rules and repeated action labels; add methods are comma text while edit uses row list. Add and edit differ materially.

Relevant implementation: src/consoleServicePage.ts renderEditor step 3/editRule; src/config.ts methods schema.

Relevant UX rule: UX-IA06; UX-IN04.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-POLICY.

Relevant product requirement: docs/web-console-prd.md: POLICY-01, POLICY-02, BASE-01.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Show a recognizable list with Add/Edit/Delete; Add opens a modal; select methods from a list and keep row labels concise. Preserve imported/custom supported method values, rule priorities, exact regex and scanning controls. Hiding rule IDs is advisory, not authority to remove identifiers.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-031: Browser and policy-tool context preservation
Classification: UX_SPEC_GAP  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-111, PO-FB-112, PO-FB-115, PO-FB-120; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor/policyTester; src/consoleSettingsPage.ts popstate; src/consolePeoplePage.ts currentNav, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (UX-03, POLICY-01, POLICY-03); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA01/02/03; UX-IN02/04/05).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-111, PO-FB-112, PO-FB-115, PO-FB-120.

Current observed behavior: Service views do not update URL state; shared settings and tester leave editing context. Move earlier uses source index although display is priority sorted. User reports surprise unsaved prompt; no fresh browser reproduction was performed.

Relevant implementation: src/consoleServicePage.ts renderEditor/policyTester; src/consoleSettingsPage.ts popstate; src/consolePeoplePage.ts currentNav.

Relevant UX rule: UX-IA01/02/03; UX-IN02/04/05.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CONFIG, J-OWNER-POLICY.

Relevant product requirement: docs/web-console-prd.md: UX-03, POLICY-01, POLICY-03.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Specify reliable Back/Forward and return-to-edit context with honest unsaved state; explain shared-scope navigation and effective rule order. Do not infer a tester modal requirement or silently change priority/order.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-032: Unresolved import identities have no actionable draft repair
Classification: IMPLEMENTATION_DEFECT  
Severity: HIGH  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-116, PO-FB-119, PO-FB-121, PO-FB-122; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleMigration.ts importConfiguration lines 22-42; src/consoleServices.ts save/candidate lines 83/93; src/consoleServicePage.ts migrationForm/renderEditor, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (MIGRATE-01, MIGRATE-02, UX-03); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IA04/06; UX-IN05; UX-C33).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-116, PO-FB-119, PO-FB-121, PO-FB-122.

Current observed behavior: Import stores missingMappings; ordinary draft save retains it, review rejects generically and requires reimport; import result exposes only count. Selecting an account changes proposed grants but cannot resolve stored legacy subjects. UX-IA04 expressly permits correction in a draft.

Relevant implementation: src/consoleMigration.ts importConfiguration lines 22-42; src/consoleServices.ts save/candidate lines 83/93; src/consoleServicePage.ts migrationForm/renderEditor.

Relevant UX rule: UX-IA04/06; UX-IN05; UX-C33.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-HISTORY.

Relevant product requirement: docs/web-console-prd.md: MIGRATE-01, MIGRATE-02, UX-03.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Existing migration/UX authority already requires explicit correction and actionable errors; code provides no draft repair and obscures source subjects.

Authoritative desired state: Identify each unresolved legacy subject in permitted draft context and offer explicit eligible local/exact registered external mapping correction. Preserve work, explain errors and next actions, reject ineligible/stale/unauthorized mappings and never infer grants from email or admin role.

Authoritative artifact requiring change: None.
Changed automatically: No
Decision required: No.
Implementation remediation required: REC-RM-015.

Affected definition domains: {"product": false, "user_journeys": false, "ux": false, "architecture": false, "security": false}.
Potentially stale artifacts: None.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-033: Preserve safe policy preview with optional presentation exploration
Classification: EXPECTED_BEHAVIOR  
Severity: LOW  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-113, PO-FB-114; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts policyTester; src/consoleServices.ts preview, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (POLICY-03); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-IN04).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-113, PO-FB-114.

Current observed behavior: Owner likes the tester; code presents no-downstream-request notice and preview inputs/results. A modal is suggested, not selected.

Relevant implementation: src/consoleServicePage.ts policyTester; src/consoleServices.ts preview.

Relevant UX rule: UX-IN04.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-POLICY.

Relevant product requirement: docs/web-console-prd.md: POLICY-03.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Preserved capability has affirmative authority and implementation support; no required change follows from praise or exploratory presentation.

Authoritative desired state: Preserve the safe preview capability and explicit no-downstream-request boundary. Evaluate modal only as advisory design input; no standalone implementation requirement.

Authoritative artifact requiring change: None.
Changed automatically: No
Decision required: No.
Implementation remediation required: No.

Affected definition domains: {"product": false, "user_journeys": false, "ux": false, "architecture": false, "security": false}.
Potentially stale artifacts: None.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.

## REC-034: Research-led service editing refinement
Classification: UX_SPEC_GAP  
Severity: MEDIUM  
Confidence: High on source; visual impact reported  
Reproduction: NOT_ATTEMPTED

Evidence: [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml, items PO-FB-123; exact wording/provenance retained in canonical dispositions. [REPOSITORY_EVIDENCED] product/ux/manifest.yaml; workflow/definition/drafts/product-ux/web-console-feedback-002/research.md, inspected at 4703c56. [DOCUMENTED] docs/web-console-prd.md (UX-02, UX-04); product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md (UX-G04; UX-V05).

Product Owner feedback: PO-FEEDBACK-2026-10-17-001: PO-FB-123.

Current observed behavior: Prior UX research covers general settings/account improvements; this feedback explicitly asks for established practices in service editing.

Relevant implementation: product/ux/manifest.yaml; workflow/definition/drafts/product-ux/web-console-feedback-002/research.md.

Relevant UX rule: UX-G04; UX-V05.

Relevant user journey: docs/web-console-prd-user-journey-audit.md: J-OWNER-CONFIG.

Relevant product requirement: docs/web-console-prd.md: UX-02, UX-04.

Architecture/security constraint: product/architecture/web-console-state-contract.md STATE-01/02/03 preserves immediate authority, coherent configuration, current eligibility, no history-based secret/access resurrection; product/security/web-console-security-contract.md SECRES-01/04 preserves write-only secrets and audit admission. Credential clearing requires deeper lifecycle resolution; ordinary UX changes cannot weaken these.

Root source of inconsistency: Current UX/product contract lacks or conflicts with the requested coherent interaction; specialist resolution is needed before design is implementation authority.

Authoritative desired state: Research established service/configuration settings patterns and produce a concrete service proposal with visual and interaction evidence. Research is definition work, not a feature or permission to expand scope.

Authoritative artifact requiring change: product/ux/01-information-architecture.md and product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-009.
Implementation remediation required: Blocked pending specialist resolution.

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}.
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md.

Implementation validation: source inspection is not runtime acceptance. Require focused positive/negative role and failure coverage, exact-value preservation and browser keyboard/responsive tests for affected transitions. For redesigned UX compare screenshots at matching approved states/viewports under UX-C42. No existing passing test or mockup is claimed as new evidence.
