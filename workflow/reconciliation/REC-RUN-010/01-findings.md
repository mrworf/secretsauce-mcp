# Findings

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-038 | New settings first and selected | UX_SPEC_PROBLEM | MEDIUM | NOT_ATTEMPTED | High | No | Required | Yes |
| REC-039 | Visible concrete review exceptions | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High | No | Required | Yes |
| REC-040 | Remove standalone guided Secret detection | UX_SPEC_PROBLEM | MEDIUM | NOT_ATTEMPTED | High | No | Required | Yes |
| REC-041 | Highlight any scanning override | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High | No | Required | Yes |

## REC-038: New settings first and selected

Classification: UX_SPEC_PROBLEM; Severity: MEDIUM; Confidence: High; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] PO-FEEDBACK-2026-10-18-002, PO-FB-138. [REPOSITORY_EVIDENCED] src/consoleServiceReview.ts: serviceReviewTabs, inspected at f498938edf7858a5217f047efba22a727a7303fa. [DOCUMENTED] CONFIG-03 / UX-IN17, docs/web-console-prd.md, product/ux/02-interaction-patterns.md; baseline content hashes in canonical source.artifact_revisions.

Current observed behavior: Current serviceReviewTabs renders Changes first and selects it. UX-IN17 explicitly prescribed that default.
Relevant implementation: src/consoleServiceReview.ts: serviceReviewTabs. Relevant UX rule/product requirement: CONFIG-03 / UX-IN17. Relevant journey: service configuration and review flows in docs/web-console-prd-user-journey-audit.md, derived from these rules; selection/section/override visibility may be stale.

Root source of inconsistency: Explicit prior UX guidance no longer matches settled current intent. This is not an implementation defect against the old rule or new runtime capability.
Authoritative desired state: New settings is first and selected on entering review; Changes remains available with identical reviewed scope.
Authoritative artifacts requiring change: docs/web-console-prd.md, product/ux/02-interaction-patterns.md. Changed automatically: Yes, APPLIED_AFTER_DECISION based on confirmed directives. Decision required: No. Implementation remediation required: REC-RM-030.

Architecture/security constraint: STATE-01/02/03 and SECRES-01 retain current-authorized atomic application, exact scope/dependency checks, sanitization, write-only secrets and audit. POLICY-04 retains every existing acknowledgment identity. No new scan semantics, trusted actor, permission or persisted data.
Affected definition domains: product false; user_journeys true; ux true; architecture false; security false.
Potentially stale: docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md; also derived prose/concepts linked by the UX manifest, treated as historical visual baseline until bounded propagation.
Implementation validation: Tab order/default and read-only switching; preserve exact complete proposal and all diff states. Actual desktop/narrow browser screenshots, keyboard/focus and text enlargement verify the existing approved visual direction; source inspection alone does not establish visual acceptance.

## REC-039: Visible concrete review exceptions

Classification: UX_SPEC_GAP; Severity: MEDIUM; Confidence: High; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] PO-FEEDBACK-2026-10-18-002, PO-FB-139, PO-FB-140. [REPOSITORY_EVIDENCED] src/consoleServiceApproval.ts: serviceApprovalFooter / serviceExceptionLabel / openServiceApproval, inspected at f498938edf7858a5217f047efba22a727a7303fa. [DOCUMENTED] CONFIG-03 / POLICY-04 / UX-IN17, docs/web-console-prd.md, product/ux/02-interaction-patterns.md; baseline content hashes in canonical source.artifact_revisions.

Current observed behavior: serviceApprovalFooter shows a count and a generic trust disclaimer, while detailed serviceExceptionLabel copy appears only in the dialog.
Relevant implementation: src/consoleServiceApproval.ts: serviceApprovalFooter / serviceExceptionLabel / openServiceApproval. Relevant UX rule/product requirement: CONFIG-03 / POLICY-04 / UX-IN17. Relevant journey: service configuration and review flows in docs/web-console-prd-user-journey-audit.md, derived from these rules; selection/section/override visibility may be stale.

Root source of inconsistency: Local UX visibility rule was incomplete for the now-settled intent. This is not an implementation defect against the old rule or new runtime capability.
Authoritative desired state: Show the actual security exception set as readable bullets before Approve changes, replacing that disclaimer; keep exact individual modal acknowledgments.
Authoritative artifacts requiring change: docs/web-console-prd.md, product/ux/02-interaction-patterns.md. Changed automatically: Yes, APPLIED_AFTER_DECISION based on confirmed directives. Decision required: No. Implementation remediation required: REC-RM-031.

Architecture/security constraint: STATE-01/02/03 and SECRES-01 retain current-authorized atomic application, exact scope/dependency checks, sanitization, write-only secrets and audit. POLICY-04 retains every existing acknowledgment identity. No new scan semantics, trusted actor, permission or persisted data.
Affected definition domains: product false; user_journeys true; ux true; architecture false; security false.
Potentially stale: docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md; also derived prose/concepts linked by the UX manifest, treated as historical visual baseline until bounded propagation.
Implementation validation: Zero, one and multiple exceptions, safe TLS inheritance labels, no secret leakage, and unchanged missing/extra/stale acknowledgment rejection. Actual desktop/narrow browser screenshots, keyboard/focus and text enlargement verify the existing approved visual direction; source inspection alone does not establish visual acceptance.

## REC-040: Remove standalone guided Secret detection

Classification: UX_SPEC_PROBLEM; Severity: MEDIUM; Confidence: High; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] PO-FEEDBACK-2026-10-18-002, PO-FB-142, PO-FB-143, PO-FB-144, PO-FB-145. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts: serviceSections / renderEditor step 5, inspected at f498938edf7858a5217f047efba22a727a7303fa. [DOCUMENTED] POLICY-02 / UX-IA09 / UX-IA10, docs/web-console-prd.md, product/ux/01-information-architecture.md; baseline content hashes in canonical source.artifact_revisions.

Current observed behavior: Existing service sections include a Secret detection page with inherited explanation/current exceptions and a global settings link; editing remains in policy/global Settings.
Relevant implementation: src/consoleServicePage.ts: serviceSections / renderEditor step 5. Relevant UX rule/product requirement: POLICY-02 / UX-IA09 / UX-IA10. Relevant journey: service configuration and review flows in docs/web-console-prd-user-journey-audit.md, derived from these rules; selection/section/override visibility may be stale.

Root source of inconsistency: Explicit prior UX guidance no longer matches settled current intent. This is not an implementation defect against the old rule or new runtime capability.
Authoritative desired state: No standalone Secret detection guided section; policy overrides, shared Settings, review values and all saved configuration remain available.
Authoritative artifacts requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md. Changed automatically: Yes, APPLIED_AFTER_DECISION based on confirmed directives. Decision required: No. Implementation remediation required: REC-RM-032.

Architecture/security constraint: STATE-01/02/03 and SECRES-01 retain current-authorized atomic application, exact scope/dependency checks, sanitization, write-only secrets and audit. POLICY-04 retains every existing acknowledgment identity. No new scan semantics, trusted actor, permission or persisted data.
Affected definition domains: product false; user_journeys true; ux true; architecture false; security false.
Potentially stale: docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md; also derived prose/concepts linked by the UX manifest, treated as historical visual baseline until bounded propagation.
Implementation validation: Create/edit navigation, old section entry and Back/Forward remain safe; no lost draft or configuration; shared Settings and policy controls remain reachable. Actual desktop/narrow browser screenshots, keyboard/focus and text enlargement verify the existing approved visual direction; source inspection alone does not establish visual acceptance.

## REC-041: Highlight any scanning override

Classification: UX_SPEC_GAP; Severity: MEDIUM; Confidence: High; Reproduction: NOT_ATTEMPTED.

Evidence: [REPORTED] PO-FEEDBACK-2026-10-18-002, PO-FB-146. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts: policy rule rows / editRule; src/config.ts: rule schema, inspected at f498938edf7858a5217f047efba22a727a7303fa. [DOCUMENTED] POLICY-02 / UX-IN16, docs/web-console-prd.md, product/ux/02-interaction-patterns.md; baseline content hashes in canonical source.artifact_revisions.

Current observed behavior: Policy rows display rule details without a distinct all-overrides marker; rule dialog already supports secretlint and binary_response overrides.
Relevant implementation: src/consoleServicePage.ts: policy rule rows / editRule; src/config.ts: rule schema. Relevant UX rule/product requirement: POLICY-02 / UX-IN16. Relevant journey: service configuration and review flows in docs/web-console-prd-user-journey-audit.md, derived from these rules; selection/section/override visibility may be stale.

Root source of inconsistency: Local UX visibility rule was incomplete for the now-settled intent. This is not an implementation defect against the old rule or new runtime capability.
Authoritative desired state: Highlight every rule with explicit secret-detection or binary override, including protection-increasing and explicit default-equivalent binary values; unoverridden rules lack marker.
Authoritative artifacts requiring change: docs/web-console-prd.md, product/ux/02-interaction-patterns.md. Changed automatically: Yes, APPLIED_AFTER_DECISION based on confirmed directives. Decision required: No. Implementation remediation required: REC-RM-033.

Architecture/security constraint: STATE-01/02/03 and SECRES-01 retain current-authorized atomic application, exact scope/dependency checks, sanitization, write-only secrets and audit. POLICY-04 retains every existing acknowledgment identity. No new scan semantics, trusted actor, permission or persisted data.
Affected definition domains: product false; user_journeys true; ux true; architecture false; security false.
Potentially stale: docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md; also derived prose/concepts linked by the UX manifest, treated as historical visual baseline until bounded propagation.
Implementation validation: Both override families, inherited/explicit default-equivalent states, non-color accessible identification, exact imported values, and unchanged risk classification. Actual desktop/narrow browser screenshots, keyboard/focus and text enlargement verify the existing approved visual direction; source inspection alone does not establish visual acceptance.

## Supplementary evidence and exploration (no separate defect)

PO-FB-141 records satisfaction and is a preservation constraint, not proof of full conformance. PO-FB-147 proposes a slider, explicitly exploratory. PO-FB-148 reports concern about unsupported text, not an observed successful invalid apply. `src/config.ts` parseSize rejects unsupported syntax and zero, uses binary 1024-based kb/mb, and separately permits exact `unlimited`; `binary_response.scan` is the disable control. `src/consoleServicePage.ts` editRule checks positive size or unlimited before keeping changes. `test/console-services.test.ts` preserves binary values and checks invalid rule data (inspected, not rerun). Current UX-IA06 already allows size value/unit or supported unlimited, and UX-IN16 requires local validation. Thus a slider is not necessary to resolve these directives. Its proposed zero/10kb/1MB endpoints are not adopted as semantics or scope; future evaluation must preserve exact existing values and distinguish disabled from size. No unsupported acceptance was reproduced, so no defect is manufactured and no implementation remediation derives from these two items. Original and clarified wording remain in canonical dispositions. No evidence blockers prevent resolving the four directives.
