# Reconciliation findings

Evidence labels distinguish observed audit states from source inspection and reported experience. Runtime inspection is bounded to the audit manifest; this report does not certify uninspected roles/states.

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-042 | Concise service readiness and honest review entry | UX_SPEC_GAP | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | journeys, UX |
| REC-043 | Precise local validation and recovery | IMPLEMENTATION_DEFECT | HIGH | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | No |
| REC-044 | Affected-section attention cue | UX_SPEC_GAP | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | journeys, UX |
| REC-045 | Four-section guided progression | UX_SPEC_PROBLEM | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | journeys, UX |
| REC-046 | Portable sanitized YAML download | PRODUCT_SPEC_GAP | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | journeys, UX |
| REC-047 | Temporarily hidden history UI | PRODUCT_SPEC_PROBLEM | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | journeys, UX |
| REC-048 | Visible Settings review effects and comparable values | UX_SPEC_GAP | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | journeys, UX |
| REC-049 | MCP required scopes comprehension | EXPECTED_BEHAVIOR | LOW | REPORTED_ONLY | High for settled intent; bounded runtime | None | False | No |
| REC-050 | Settings organization and search design | UX_SPEC_PROBLEM | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | REC-DEC-011 | False | journeys, UX |
| REC-051 | SMTP credential task presentation | UX_SPEC_PROBLEM | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | journeys, UX |
| REC-052 | Safe backup schedule and clear retention units | UX_SPEC_GAP | MEDIUM | REPORTED_ONLY | High for settled intent; bounded runtime | None | True | journeys, UX |
| REC-053 | Visible organized health and retention | UX_SPEC_GAP | MEDIUM | PARTIALLY_REPRODUCED | High for settled intent; bounded runtime | None | True | journeys, UX |

### REC-042: Concise service readiness and honest review entry

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-149, PO-FB-150, PO-FB-163, PO-FB-164, PO-FB-165, PO-FB-166, PO-FB-167, PO-FB-168, PO-FB-169, PO-FB-170; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleServicePage.ts; src/consoleServicePage.ts.
- [DOCUMENTED] UX-IA02, UX-IA09; CONFIG-05; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Overview labels and entry points imply review readiness despite missing dependencies; list rows repeat missing-value or mapping detail.

Relevant implementation: src/consoleServicePage.ts; src/consoleServicePage.ts.

Relevant UX rule and product requirement: UX-IA02, UX-IA09; CONFIG-05.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Service rows retain lifecycle/draft distinctions with concise Needs configuration. Overview identifies actual blockers and links to correction; ready Review draft changes opens real review, unavailable while known issues remain. Top-align list controls.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-034

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-043: Precise local validation and recovery

Classification: IMPLEMENTATION_DEFECT
Severity: HIGH
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-151, PO-FB-152, PO-FB-155, PO-FB-156, PO-FB-157, PO-FB-161; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleServices.ts; src/consoleServicePage.ts; src/consoleFriendlyPage.ts.
- [DOCUMENTED] UX-IN01, UX-IN15; UX-03; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Observed missing-value review lists four potentially faulty sections and neutral Authentication status rather than the actual named missing credential.

Relevant implementation: src/consoleServices.ts; src/consoleServicePage.ts; src/consoleFriendlyPage.ts.

Relevant UX rule and product requirement: UX-IN01, UX-IN15; UX-03.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: Existing precise-local-error authority is sufficient; the undifferentiated implementation violates it. The new section-indicator mechanism is separately REC-044.

Authoritative desired state: Identify actual invalid or missing fields, their section and safe recovery action. Incomplete imported and new services receive the same precise error handling; resolved issues disappear, safe input persists, and mere credential presence never proves downstream validity.
Authoritative artifact requiring change: None applied for this finding.
Changed automatically: No
Decision required: No
Implementation remediation required: REC-RM-035

Affected definition domains: {'product': False, 'user_journeys': False, 'ux': False, 'architecture': False, 'security': False}
Potentially stale artifacts: None for this finding
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-044: Affected-section attention cue

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-153, PO-FB-154; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleServicePage.ts; src/consoleFriendlyPage.ts.
- [DOCUMENTED] UX-03; UX-IN15; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Current section labels lack the owner-selected affected-section indicator.

Relevant implementation: src/consoleServicePage.ts; src/consoleFriendlyPage.ts.

Relevant UX rule and product requirement: UX-03; UX-IN15.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Yellow circled exclamation with text/accessibility equivalent appears only beside affected section names; local affected controls are identifiable without color alone.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-036

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-045: Four-section guided progression

Classification: UX_SPEC_PROBLEM
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-158, PO-FB-159, PO-FB-160, PO-FB-162; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleServicePage.ts; src/consoleFriendlyPage.ts.
- [DOCUMENTED] CONFIG-01; UX-IA02, UX-IA09, UX-IN11, UX-IN15; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Five-step setup and edit Review changes placeholder follow stale UX6; edited services offer premature review instead of sequential progression.

Relevant implementation: src/consoleServicePage.ts; src/consoleFriendlyPage.ts.

Relevant UX rule and product requirement: CONFIG-01; UX-IA02, UX-IA09, UX-IN11, UX-IN15.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Create and edit share Details, Destination, Authentication, Access & policy. First three Continue; last Review & apply opens actual review. Keep direct navigation, safe history guards, existing real review and incomplete draft saving.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-037

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-046: Portable sanitized YAML download

Classification: PRODUCT_SPEC_GAP
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-172, PO-FB-173, PO-FB-174; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleMigration.ts exportConfiguration/importConfiguration; src/consoleServicePage.ts.
- [DOCUMENTED] MIGRATE-03; UX-IA03, UX-IA05; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Exporter already emits gateway and scanner catalog YAML strings, but UI renders them inline.

Relevant implementation: src/consoleMigration.ts exportConfiguration/importConfiguration; src/consoleServicePage.ts.

Relevant UX rule and product requirement: MIGRATE-03; UX-IA03, UX-IA05.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Download gateway YAML accepted by existing importer on another instance, with existing optional scanner catalogs downloadable separately. No live authority/secret transfer, no activation, no new bundle schema.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-038

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-047: Temporarily hidden history UI

Classification: PRODUCT_SPEC_PROBLEM
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-171, PO-FB-175; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleServicePage.ts; src/consoleServices.ts.
- [DOCUMENTED] CONFIG-04; UX-IA02, UX-IA03, UX-IA05; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: History/reuse UI remains visible, including empty state.

Relevant implementation: src/consoleServicePage.ts; src/consoleServices.ts.

Relevant UX rule and product requirement: CONFIG-04; UX-IA02, UX-IA03, UX-IA05.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Hide history/reuse console UI while retaining latest50 history and current permission/dependency constrained revision reuse backend. Do not purge revisions or remove APIs.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-039

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-048: Visible Settings review effects and comparable values

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-176, PO-FB-177, PO-FB-178, PO-FB-179; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleSettingsPage.ts renderSettingsReview.
- [DOCUMENTED] UX-IN02, UX-IN18; UX-02; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Settings effects are folded; reported comparison formats same values differently. Service review already has visible exceptions, but service-specific approval pattern does not automatically govern Settings.

Relevant implementation: src/consoleSettingsPage.ts renderSettingsReview.

Relevant UX rule and product requirement: UX-IN02, UX-IN18; UX-02.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Show Settings security/operational effects immediately. Preserve full-scope atomic apply and existing acknowledgments; shared exact-value comparison must not invent different semantics or normalize literals.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-040

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-049: MCP required scopes comprehension

Classification: EXPECTED_BEHAVIOR
Severity: LOW
Confidence: High on authority; runtime verification limited below
Reproduction: REPORTED_ONLY

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-180; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleSettingsPage.ts; src/config.ts.
- [DOCUMENTED] MCP-02; UX-IA03, UX-IA08; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Owner questions why scope values can be edited; supported OAuth configuration intentionally exposes required scopes.

Relevant implementation: src/consoleSettingsPage.ts; src/config.ts.

Relevant UX rule and product requirement: MCP-02; UX-IA03, UX-IA08.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: Existing scope semantics are affirmative authority; exploratory question selects no protocol change.

Authoritative desired state: Retain scope editability and semantics. Explain scopes using existing field-help authority; no protocol/default change selected.
Authoritative artifact requiring change: None applied for this finding.
Changed automatically: No
Decision required: No
Implementation remediation required: No new scope; existing field-help expectations remain

Affected definition domains: {'product': False, 'user_journeys': False, 'ux': False, 'architecture': False, 'security': False}
Potentially stale artifacts: None for this finding
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-050: Settings organization and search design

Classification: UX_SPEC_PROBLEM
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-181, PO-FB-182, PO-FB-183, PO-FB-184, PO-FB-199, PO-FB-200, PO-FB-201; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleSettingsPage.ts.
- [DOCUMENTED] UX-IA03, UX-IA06, UX-IA08; UX-02; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Limits has numerous disclosures; Settings search sits in a footer disclosure; repeated selected-section heading is reported redundant.

Relevant implementation: src/consoleSettingsPage.ts.

Relevant UX rule and product requirement: UX-IA03, UX-IA06, UX-IA08; UX-02.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: Product UX has supplied concrete shared-pattern options; consequential navigation direction awaits approval rather than treating advisory suggestions as mandatory.

Authoritative desired state: Product UX supplied UX-DESIGN-006; Limits categories and search modal remain proposed until Product Owner approval (REC-DEC-011/012).
Authoritative artifact requiring change: None applied for this finding.
Changed automatically: No
Decision required: REC-DEC-011 and REC-DEC-012; bounded design choices only
Implementation remediation required: Blocked for proposed navigation redesign only

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-051: SMTP credential task presentation

Classification: UX_SPEC_PROBLEM
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-185, PO-FB-186, PO-FB-187, PO-FB-188, PO-FB-189, PO-FB-190, PO-FB-191; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleSettingsPage.ts; src/consoleNotifications.ts.
- [DOCUMENTED] IDENT-04, CONFIG-03; UX-IN09, UX-IN13, UX-EX03; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Inline replacement password and folded authentication contrast with focused service secret dialogs; owner reports green Not configured.

Relevant implementation: src/consoleSettingsPage.ts; src/consoleNotifications.ts.

Relevant UX rule and product requirement: IDENT-04, CONFIG-03; UX-IN09, UX-IN13, UX-EX03.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Visible current username/credential availability. Set/Replace opens username-prefilled/password-blank Save/Cancel dialog staging normal Settings review/apply; Clear is independent existing immediate deletion, blocked while enabled delivery depends on it. Yellow Not configured text state. Research informs presentation, never overrides timing.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-043

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-052: Safe backup schedule and clear retention units

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: REPORTED_ONLY

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-192, PO-FB-193, PO-FB-194, PO-FB-195; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleSettingsPage.ts; src/consoleBackups.ts.
- [DOCUMENTED] UX-02, UX-03; UX-IN18; BACKUP-01; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Hour input accepts24 until validation; retention label obscures unit.

Relevant implementation: src/consoleSettingsPage.ts; src/consoleBackups.ts.

Relevant UX rule and product requirement: UX-02, UX-03; UX-IN18; BACKUP-01.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Only valid UTC hours00–23 can be chosen; invalid legacy/external data remains explicit error with backend checks retained. Label retention in days. Slider suggestion is not a requirement.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-044

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.


### REC-053: Visible organized health and retention

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High on authority; runtime verification limited below
Reproduction: PARTIALLY_REPRODUCED

Evidence:
- [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-003/feedback.yaml: PO-FB-196, PO-FB-197, PO-FB-198; exact wording and classes remain in canonical result.
- [REPOSITORY_EVIDENCED] Implementation baseline 6810fe32ab0c461946a78751be82b7c21fedecd7: src/consoleSettingsPage.ts; src/consolePage.ts.
- [DOCUMENTED] UX-IA06, UX-IN18; UX-02; current PRD/UX6 and the confirmed directive govern only their explicit scope.
- [OBSERVED] Audit UX-AUDIT-2026-11-16-001 findings F001–004 and named state coverage, where applicable. Not all feedback was runtime-reproduced.

Current observed behavior: Health details and audit retention remain disclosed rather than immediately available.

Relevant implementation: src/consoleSettingsPage.ts; src/consolePage.ts.

Relevant UX rule and product requirement: UX-IA06, UX-IN18; UX-02.
Relevant user journey: docs/web-console-prd-user-journey-audit.md service setup/review, configuration tools, or Settings path matching this finding; derived surface descriptions require targeted refresh.
Architecture/security constraint: STATE-01/03/09 and SECRES-07/08 remain unchanged. Preserve permission-scoped reads/mutations, mandatory audit, no raw secret export/reveal, and guarded atomic draft activation.

Root source of inconsistency: The canonical definition lacks or contradicts the newer exact confirmed interaction; updating only this local contract is necessary, rather than calling stale implementation expected.

Authoritative desired state: Show organized health details and audit retention directly with diagnostic context, current role-limited data and truthful loading/failure states; do not turn bounded public health into detailed diagnostics.
Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md
Changed automatically: Yes, after confirmed directive
Decision required: No
Implementation remediation required: REC-RM-045

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation: positive and negative inputs; permission-safe errors; stale/unknown state preserves safe work; actual browser comparison with routed approved references, desktop/narrow/enlarged text and keyboard focus. Unseen audit states require targeted acceptance rather than assumed conformance.
