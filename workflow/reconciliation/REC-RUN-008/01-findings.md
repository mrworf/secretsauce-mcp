# Resolved findings

Continuation of REC-RUN-007 after accepted REC-DEC-008/010 and approved UX-DESIGN-004. Stable finding IDs and original feedback classifications are retained. Implementation evidence remains source-inspected M24; no runtime reproduction is claimed.

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-019 | Preserve successful import, Activity and guided foundation | EXPECTED_BEHAVIOR | LOW | NOT_ATTEMPTED | High on source | Resolved | None | Yes, targeted |
| REC-020 | Service list status, row navigation and lifecycle actions | UX_SPEC_GAP | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-016 | Yes, targeted |
| REC-021 | Readable configuration overview and section composition | UX_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-017 | Yes, targeted |
| REC-022 | Credential last-change actor | PRODUCT_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source | Resolved | REC-RM-021, REC-RM-026 | Yes, targeted |
| REC-023 | Credential Set/Replace dialog interaction | UX_SPEC_GAP | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-022 | Yes, targeted |
| REC-024 | Delete clears referenced value but retains key | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-020, REC-RM-026 | Yes, targeted |
| REC-025 | Understandable execution assignment context | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source | Resolved | REC-RM-024 | Yes, targeted |
| REC-026 | Global editing mode and navigable guided steps | UX_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-018 | Yes, targeted |
| REC-027 | Service-specific field comprehension | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source | Resolved | REC-RM-024 | Yes, targeted |
| REC-028 | Destination TLS scope, disclosure and identifiers | UX_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-019 | Yes, targeted |
| REC-029 | New credential insertion focus and scroll | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source | Resolved | REC-RM-022 | Yes, targeted |
| REC-030 | Policy rule list, method selection and add/edit consistency | UX_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-023 | Yes, targeted |
| REC-031 | Browser and policy-tool context preservation | UX_SPEC_GAP | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-025 | Yes, targeted |
| REC-032 | Unresolved import identities have no actionable draft repair | IMPLEMENTATION_DEFECT | HIGH | NOT_ATTEMPTED | High on source | Resolved | REC-RM-015 | Yes, targeted |
| REC-033 | Preserve safe policy preview with optional presentation exploration | EXPECTED_BEHAVIOR | LOW | NOT_ATTEMPTED | High on source | Resolved | REC-RM-025 | Yes, targeted |
| REC-034 | Research-led service editing refinement | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High on source | Resolved | None | Yes, targeted |

## REC-019: Preserve successful import, Activity and guided foundation
Classification: EXPECTED_BEHAVIOR; Severity: LOW; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-042, PO-FB-069, PO-FB-070, PO-FB-081, PO-FB-088. [REPOSITORY_EVIDENCED] src/consoleMigration.ts importConfiguration; src/consoleServicePage.ts serviceDetail/renderEditor. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Import preserves supported YAML into drafts; Activity and guided/authentication basics are reported satisfactory. No removal or replacement of these capabilities is requested.

Relevant implementation: src/consoleMigration.ts importConfiguration; src/consoleServicePage.ts serviceDetail/renderEditor. Relevant prior UX: UX-IA02/04; UX-IN04; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CONFIG, J-OWNER-HISTORY; targeted revalidation required. Product requirements: BASE-01, CONFIG-01, MIGRATE-01.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original EXPECTED_BEHAVIOR classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: Preserve successful capabilities and no downstream I/O in preview; praise alone adds no requirement.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: None.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: No executable change required; definition evidence only.

## REC-020: Service list status, row navigation and lifecycle actions
Classification: UX_SPEC_GAP; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-043, PO-FB-044, PO-FB-045, PO-FB-046, PO-FB-047, PO-FB-048, PO-FB-049. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts services/serviceDetail; src/consoleServices.ts list/lifecycle. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: List renders lifecycle and draft as plain text and an Open action. It lacks whole-row navigation and right-side requested lifecycle actions. Existing archive retains history; requested Delete is not yet specified against that lifecycle.

Relevant implementation: src/consoleServicePage.ts services/serviceDetail; src/consoleServices.ts list/lifecycle. Relevant prior UX: UX-IA02, UX-IN03; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-ACCESS; targeted revalidation required. Product requirements: UX-01, CONFIG-05.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_GAP classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-016 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: docs/web-console-prd.md; see source-change ledger.
Changed automatically: Yes, APPLIED_AFTER_DECISION. Decision required: No. Implementation remediation: REC-RM-016.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Role/state matrix browser test, lifecycle integration, desktop/narrow screenshot comparison.

## REC-021: Readable configuration overview and section composition
Classification: UX_SPEC_PROBLEM; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-050, PO-FB-051, PO-FB-052, PO-FB-053, PO-FB-054, PO-FB-055, PO-FB-056, PO-FB-057, PO-FB-058, PO-FB-059. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts serviceDetail; src/consoleFriendlyPage.ts renderConfig. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Owner reports cryptic empty overview, redundant bars, one long configuration and visually merged rules. Code renders applied and draft summaries plus repeated controls; source inspection cannot establish exact visual severity.

Relevant implementation: src/consoleServicePage.ts serviceDetail; src/consoleFriendlyPage.ts renderConfig. Relevant prior UX: UX-IA02/06; UX-IN01/11; UX-V05; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CONFIG; targeted revalidation required. Product requirements: UX-02, UX-03, CONFIG-01.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_PROBLEM classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-017 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: REC-RM-017.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Populated/empty/error/read-only browser cases and UX4 matching-state visual comparison.

## REC-022: Credential last-change actor
Classification: PRODUCT_SPEC_GAP; Severity: MEDIUM; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-060. [REPOSITORY_EVIDENCED] src/consoleServices.ts ManagedCredential, credential, detail; src/consoleMigration.ts. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: ManagedCredential stores value/version/changed but no last-change actor; detail exposes time/version only. Current last-change metadata requirement does not settle legacy/restore actor display.

Relevant implementation: src/consoleServices.ts ManagedCredential, credential, detail; src/consoleMigration.ts. Relevant prior UX: UX-IA06 Authentication; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CREDENTIAL; targeted revalidation required. Product requirements: CONFIG-02, AUDIT-01.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original PRODUCT_SPEC_GAP classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-021, REC-RM-026 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: docs/web-console-prd.md; see source-change ledger.
Changed automatically: Yes, APPLIED_AFTER_DECISION. Decision required: No. Implementation remediation: REC-RM-021, REC-RM-026.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Metadata positive/negative persistence/rename/removal/legacy tests and read-permission browser evidence.; Encrypted backup/restore positive/negative fixtures and supported Docker recovery/restart checks; old archive compatibility, schema contradictions and leak assertions.

## REC-023: Credential Set/Replace dialog interaction
Classification: UX_SPEC_GAP; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-061, PO-FB-062, PO-FB-096, PO-FB-097, PO-FB-098. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts serviceDetail/renderEditor step 2; src/consolePresentation.ts. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Both configuration and wizard render password inputs inline and separate immediate buttons. Required-field context is confusing; the canonical credential card rule does not fully specify shared entry dialog state.

Relevant implementation: src/consoleServicePage.ts serviceDetail/renderEditor step 2; src/consolePresentation.ts. Relevant prior UX: UX-IN01/03; UX-A04; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CREDENTIAL; targeted revalidation required. Product requirements: CONFIG-02, UX-02, UX-04.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_GAP classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-022 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: docs/web-console-prd.md; see source-change ledger.
Changed automatically: Yes, APPLIED_AFTER_DECISION. Decision required: No. Implementation remediation: REC-RM-022.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Dialog keyboard/focus/required-input positive/negative tests, secret-leak checks, add-row viewport test and visual comparison.

## REC-024: Delete clears referenced value but retains key
Classification: PRODUCT_SPEC_PROBLEM; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067. [REPOSITORY_EVIDENCED] src/consoleServices.ts credential/publish/fingerprint; src/consoleMigration.ts. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: CONFIG-02 forbids referenced credential deletion; credential() rejects applied or draft dependencies. New confirmed PO-FB-065/066 instead requires Delete to clear only the value while retaining an in-use key, and explain that consequence.

Relevant implementation: src/consoleServices.ts credential/publish/fingerprint; src/consoleMigration.ts. Relevant prior UX: UX-IN03; UX-IA06; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CREDENTIAL; targeted revalidation required. Product requirements: CONFIG-02, CONFIG-03, CONFIG-04.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original PRODUCT_SPEC_PROBLEM classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-020, REC-RM-026 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: docs/web-console-prd.md; see source-change ledger.
Changed automatically: Yes, APPLIED_AFTER_DECISION. Decision required: No. Implementation remediation: REC-RM-020, REC-RM-026.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: STATE-09 acceptance and SECRES-T17–T19: positive/negative direct API, actual dispatch races, fault injection, restart and prior-reader compatibility tests.; Encrypted backup/restore positive/negative fixtures and supported Docker recovery/restart checks; old archive compatibility, schema contradictions and leak assertions.

## REC-025: Understandable execution assignment context
Classification: UX_SPEC_GAP; Severity: MEDIUM; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-068, PO-FB-101. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts serviceDetail Access/renderEditor step 3; src/consoleServices.ts access. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Access shows assignments and grants only for an applied service; new-service checkboxes propose grants. Neither role ownership nor selecting oneself can resolve an import subject mapping. Owner reports that distinction is unclear.

Relevant implementation: src/consoleServicePage.ts serviceDetail Access/renderEditor step 3; src/consoleServices.ts access. Relevant prior UX: UX-IA02/04; UX-IN03; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-ACCESS; targeted revalidation required. Product requirements: AUTHZ-01, CONFIG-03.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_GAP classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-024 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: REC-RM-024.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Copy/behavior contract tests, role/access positive/negative checks and browser helper/required/focus validation.

## REC-026: Global editing mode and navigable guided steps
Classification: UX_SPEC_PROBLEM; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-071, PO-FB-072, PO-FB-073, PO-FB-074, PO-FB-075, PO-FB-076, PO-FB-077, PO-FB-087, PO-FB-124. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor/advancedEditor. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: renderEditor repeats Advanced editor (same draft) and heading; initial step list is inert. Existing-section tabs work but initial Back requires footer. Advanced editing covers the complete service.

Relevant implementation: src/consoleServicePage.ts renderEditor/advancedEditor. Relevant prior UX: UX-IA02/03/06; UX-IN11; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CONFIG; targeted revalidation required. Product requirements: CONFIG-01, POLICY-02, UX-02.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_PROBLEM classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-018 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: docs/web-console-prd.md; see source-change ledger.
Changed automatically: Yes, APPLIED_AFTER_DECISION. Decision required: No. Implementation remediation: REC-RM-018.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Round-trip advanced/guided positive/negative tests and keyboard/browser step traversal.

## REC-027: Service-specific field comprehension
Classification: UX_SPEC_GAP; Severity: MEDIUM; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-078, PO-FB-079, PO-FB-080, PO-FB-089, PO-FB-090, PO-FB-091, PO-FB-092, PO-FB-093, PO-FB-094, PO-FB-095, PO-FB-102, PO-FB-103, PO-FB-105. [REPOSITORY_EVIDENCED] src/consolePresentation.ts fieldHints/fieldHint; src/consoleServicePage.ts renderEditor; src/policy.ts. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Labels/help exist in consolePresentation but Owner cannot understand prefix/suffix, generic placement, header ownership, host matching and policy reason/default. Existing help promises do not settle the refreshed composition and wording.

Relevant implementation: src/consolePresentation.ts fieldHints/fieldHint; src/consoleServicePage.ts renderEditor; src/policy.ts. Relevant prior UX: UX-IA06/08; UX-IN01/04; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CONFIG, J-OWNER-POLICY; targeted revalidation required. Product requirements: UX-02, POLICY-01, BASE-01.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_GAP classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-024 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: REC-RM-024.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Copy/behavior contract tests, role/access positive/negative checks and browser helper/required/focus validation.

## REC-028: Destination TLS scope, disclosure and identifiers
Classification: UX_SPEC_PROBLEM; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-082, PO-FB-083, PO-FB-084, PO-FB-085, PO-FB-086. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor step 1; src/config.ts destination normalization/serviceDraft. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Current authority preserves service-default TLS and destination overrides, and stable identifiers. Nested advanced disclosure and ordinary identifier fields conflict with the requested simpler conditional exposure.

Relevant implementation: src/consoleServicePage.ts renderEditor step 1; src/config.ts destination normalization/serviceDraft. Relevant prior UX: UX-IA03/06; UX-IN04; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CONFIG; targeted revalidation required. Product requirements: BASE-01, POLICY-02, POLICY-04.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_PROBLEM classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-019 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: REC-RM-019.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: All matching modes/TLS inheritance round-trip tests; actual self-signed transport test if transport changes; responsive keyboard visual cases.

## REC-029: New credential insertion focus and scroll
Classification: UX_SPEC_GAP; Severity: MEDIUM; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-099, PO-FB-100. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor step 2. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Add credential mutates draft then rebuilds editor with no insertion-focus/scroll step. Exact rendered jump is reported, not independently reproduced.

Relevant implementation: src/consoleServicePage.ts renderEditor step 2. Relevant prior UX: UX-IN11; UX-A04; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CONFIG; targeted revalidation required. Product requirements: UX-03, UX-04.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_GAP classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-022 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: REC-RM-022.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Dialog keyboard/focus/required-input positive/negative tests, secret-leak checks, add-row viewport test and visual comparison.

## REC-030: Policy rule list, method selection and add/edit consistency
Classification: UX_SPEC_PROBLEM; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-104, PO-FB-106, PO-FB-107, PO-FB-108, PO-FB-109, PO-FB-110, PO-FB-117, PO-FB-118. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor step 3/editRule; src/config.ts methods schema. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Always-visible Basic request rule precedes paragraph rules and repeated action labels; add methods are comma text while edit uses row list. Add and edit differ materially.

Relevant implementation: src/consoleServicePage.ts renderEditor step 3/editRule; src/config.ts methods schema. Relevant prior UX: UX-IA06; UX-IN04; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-POLICY; targeted revalidation required. Product requirements: POLICY-01, POLICY-02, BASE-01.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_PROBLEM classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-023 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: REC-RM-023.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Rule positive/negative round-trips, ordering/priority/tie tests and modal keyboard/responsive visual checks.

## REC-031: Browser and policy-tool context preservation
Classification: UX_SPEC_GAP; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-111, PO-FB-112, PO-FB-115, PO-FB-120. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts renderEditor/policyTester; src/consoleSettingsPage.ts popstate; src/consolePeoplePage.ts currentNav. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Service views do not update URL state; shared settings and tester leave editing context. Move earlier uses source index although display is priority sorted. User reports surprise unsaved prompt; no fresh browser reproduction was performed.

Relevant implementation: src/consoleServicePage.ts renderEditor/policyTester; src/consoleSettingsPage.ts popstate; src/consolePeoplePage.ts currentNav. Relevant prior UX: UX-IA01/02/03; UX-IN02/04/05; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CONFIG, J-OWNER-POLICY; targeted revalidation required. Product requirements: UX-03, POLICY-01, POLICY-03.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_GAP classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-025 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: REC-RM-025.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Actual browser history/dirty-state/dialog journey plus no-downstream preview assertion and unauthorized/stale context tests.

## REC-032: Unresolved import identities have no actionable draft repair
Classification: IMPLEMENTATION_DEFECT; Severity: HIGH; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-116, PO-FB-119, PO-FB-121, PO-FB-122. [REPOSITORY_EVIDENCED] src/consoleMigration.ts importConfiguration lines 22-42; src/consoleServices.ts save/candidate lines 83/93; src/consoleServicePage.ts migrationForm/renderEditor. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Import stores missingMappings; ordinary draft save retains it, review rejects generically and requires reimport; import result exposes only count. Selecting an account changes proposed grants but cannot resolve stored legacy subjects. UX-IA04 expressly permits correction in a draft.

Relevant implementation: src/consoleMigration.ts importConfiguration lines 22-42; src/consoleServices.ts save/candidate lines 83/93; src/consoleServicePage.ts migrationForm/renderEditor. Relevant prior UX: UX-IA04/06; UX-IN05; UX-C33; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-HISTORY; targeted revalidation required. Product requirements: MIGRATE-01, MIGRATE-02, UX-03.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original IMPLEMENTATION_DEFECT classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-015 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: docs/web-console-prd.md; see source-change ledger.
Changed automatically: Yes, APPLIED_AFTER_DECISION. Decision required: No. Implementation remediation: REC-RM-015.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Mapping integration and browser import-to-review journey, including stale/permission/error paths.

## REC-033: Preserve safe policy preview with optional presentation exploration
Classification: EXPECTED_BEHAVIOR; Severity: LOW; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-113, PO-FB-114. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts policyTester; src/consoleServices.ts preview. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Owner likes the tester; code presents no-downstream-request notice and preview inputs/results. A modal is suggested, not selected.

Relevant implementation: src/consoleServicePage.ts policyTester; src/consoleServices.ts preview. Relevant prior UX: UX-IN04; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-POLICY; targeted revalidation required. Product requirements: POLICY-03.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original EXPECTED_BEHAVIOR classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: The observable outcomes and acceptance criteria in REC-RM-025 are governed by corrected PRD, approved UX4, STATE-09/SECRES-08. Exploratory mechanisms are requirements only where separately selected in UX-DESIGN-004.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: REC-RM-025.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: Actual browser history/dirty-state/dialog journey plus no-downstream preview assertion and unauthorized/stale context tests.

## REC-034: Research-led service editing refinement
Classification: UX_SPEC_GAP; Severity: MEDIUM; Confidence: High on source, reported visual impact; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] confirmed PO-FEEDBACK-2026-10-17-001 items PO-FB-123. [REPOSITORY_EVIDENCED] product/ux/manifest.yaml; workflow/definition/drafts/product-ux/web-console-feedback-002/research.md. [DOCUMENTED] approved UX-DESIGN-004, STATE-09/SECRES-08, accepted REC-DEC-010 and corrected PRD; see canonical hashed inputs.

Current observed behavior: Prior UX research covers general settings/account improvements; this feedback explicitly asks for established practices in service editing.

Relevant implementation: product/ux/manifest.yaml; workflow/definition/drafts/product-ux/web-console-feedback-002/research.md. Relevant prior UX: UX-G04; UX-V05; current UX4 service rules supersede inconsistent service presentation while preserving other UX3 authority.

Relevant journey: docs/web-console-prd-user-journey-audit.md / J-OWNER-CONFIG; targeted revalidation required. Product requirements: UX-02, UX-04.

Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve current role/admission, immediate operations, dependency/generation fences, write-only values and recovery. SMTP is unchanged.

Root source of inconsistency: original UX_SPEC_GAP classification from REC007 remains the historic first inconsistent layer; resolution adopts approved desired state rather than rewriting authority to match old code.

Authoritative desired state: Research request is satisfied by the approved proposal/research. No separate implementation work.

Authoritative artifact requiring change: None in this run.
Changed automatically: No; parent owns approved UX synthesis. Decision required: No. Implementation remediation: None.

Affected definition domains: product=true, user_journeys=true, ux=true for complete adopted service contract; architecture=true/security=true only where credential/admission/recovery or reviewed access dependencies are implicated. These require targeted validation, not redesign or whole-product restart.
Potentially stale artifacts: corrected PRD, service journeys/coverage and approved UX4; architecture/security contracts require consistency review against those final inputs. Exact paths are canonical.
Implementation validation: No executable change required; definition evidence only.
