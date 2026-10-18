# Reconciliation findings

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-035 | Grouped review is obscured by repeated full configuration output | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High | No | Required | Yes |
| REC-036 | Service approval interaction lacks the requested final confirmation dialog | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High | No | Required | Yes |
| REC-037 | TLS exception scope is expressed with an internal destination identifier | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High | No | Required | No |

### REC-035: Grouped review is obscured by repeated full configuration output

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High
Reproduction: NOT_ATTEMPTED

Evidence: [REPOSITORY_EVIDENCED] src/consoleServicePage.ts:renderReview; namedDifferences and renderConfig call sites inspected at 35e6226b5a734b46bbc4b291e93ec103d8eee77c; [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-001/feedback.yaml, items PO-FB-125, PO-FB-126, PO-FB-127, PO-FB-128, PO-FB-129, PO-FB-130; [DOCUMENTED] docs/web-console-prd.md CONFIG-03, UX-02/04 and UX-IN02/04.

Product Owner feedback: PO-FEEDBACK-2026-10-18-001, PO-FB-125, PO-FB-126, PO-FB-127, PO-FB-128, PO-FB-129, PO-FB-130.

Current observed behavior: renderReview emits Named changes followed by complete Current applied and Proposed configuration blocks. The owner reports this as a wall of text; visual reproduction was not performed in this transaction.

Relevant implementation: src/consoleServicePage.ts:renderReview; namedDifferences and renderConfig call sites.
Relevant UX rule: product/ux/02-interaction-patterns.md UX-IN02/04; product/ux/04-visual-system.md UX-V01/02/05/06.
Relevant user journey: docs/web-console-prd-user-journey-audit.md J-OWNER-CONFIG/J-ADMIN-CONFIG review and activation.
Relevant product requirement: docs/web-console-prd.md CONFIG-03, UX-02/04.
Architecture/security constraint: STATE-01/02 atomic reviewed activation, current authorization and dependency fencing; SEC-01/02/03 and AUDIT-01/04 secret exclusion, access and durable admission remain unchanged.

Root source of inconsistency: Existing UX required sanitized before/after groups but omitted the newly selected local tabs/confirmation behavior. The precise directives support a narrow correction without a new capability or permission.

Authoritative desired state: Service review has separate Changes and complete New settings views, grouped by section, readable comparison and labeled green/red/yellow distinctions where feasible.
Authoritative artifact requiring change: docs/web-console-prd.md CONFIG-03; product/ux/02-interaction-patterns.md UX-IN02
Changed automatically: Yes, APPLIED_AFTER_DECISION
Decision required: No
Implementation remediation required: REC-RM-027

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}
Potentially stale artifacts: docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation:
- Changes groups only changed material by service configuration section; complete proposed settings remain reachable in the second tab.
- No-current-baseline, no-change, added/removed/changed values and exact nested/custom options and ordered arrays remain truthful; comparison does not normalize away meaning.
- Both tabs exclude credentials and secret-bearing values and retain affected scope, initial proposed grants and disruption context.
- Actual HTTPS browser evidence checks tab keyboard operation, readable wide comparison, narrow reflow and 200% text enlargement against the current visual system.

### REC-036: Service approval interaction lacks the requested final confirmation dialog

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High
Reproduction: NOT_ATTEMPTED

Evidence: [REPOSITORY_EVIDENCED] src/consoleServicePage.ts:renderReview; src/consoleServices.ts:review/apply inspected at 35e6226b5a734b46bbc4b291e93ec103d8eee77c; [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-001/feedback.yaml, items PO-FB-131, PO-FB-132, PO-FB-133; [DOCUMENTED] docs/web-console-prd.md CONFIG-03, POLICY-04, STATE-02 and UX-IN02/04.

Product Owner feedback: PO-FEEDBACK-2026-10-18-001, PO-FB-131, PO-FB-132, PO-FB-133.

Current observed behavior: renderReview currently places required exception checkboxes on the page and directly submits Apply reviewed changes. The server already enforces every exact reviewed exception.

Relevant implementation: src/consoleServicePage.ts:renderReview; src/consoleServices.ts:review/apply.
Relevant UX rule: product/ux/02-interaction-patterns.md UX-IN02/04; product/ux/04-visual-system.md UX-V01/02/05/06.
Relevant user journey: docs/web-console-prd-user-journey-audit.md J-OWNER-CONFIG/J-ADMIN-CONFIG review and activation.
Relevant product requirement: docs/web-console-prd.md CONFIG-03, POLICY-04, STATE-02.
Architecture/security constraint: STATE-01/02 atomic reviewed activation, current authorization and dependency fencing; SEC-01/02/03 and AUDIT-01/04 secret exclusion, access and durable admission remain unchanged.

Root source of inconsistency: Existing UX required sanitized before/after groups but omitted the newly selected local tabs/confirmation behavior. The precise directives support a narrow correction without a new capability or permission.

Authoritative desired state: Approve changes opens Continue/Cancel confirmation. With exceptions, every individual acknowledgment is required before Continue; without exceptions a concise activation confirmation suffices.
Authoritative artifact requiring change: docs/web-console-prd.md CONFIG-03; product/ux/02-interaction-patterns.md UX-IN02
Changed automatically: Yes, APPLIED_AFTER_DECISION
Decision required: No
Implementation remediation required: REC-RM-028

Affected definition domains: {"product": false, "user_journeys": true, "ux": true, "architecture": false, "security": false}
Potentially stale artifacts: docs/web-console-prd-user-journey-audit.md, product/ux/manifest.yaml, product/ux/07-acceptance-checklist.md
Implementation validation:
- Opening or cancelling the modal causes no activation; Continue without exceptions commits the exact reviewed proposal after existing checks.
- With exceptions Continue is unavailable until all boxes are checked; forged/missing/extra acknowledgments are rejected server-side.
- Role change, stale base/draft/dependency or credential mutation rejects old review and acknowledgments; no partial activation or false success.
- Pending submission prevents duplicate apply; known failure and unknown completion use existing truthful recovery/status behavior. Keyboard focus is contained/restored and controls are accessible.

### REC-037: TLS exception scope is expressed with an internal destination identifier

Classification: IMPLEMENTATION_DEFECT
Severity: MEDIUM
Confidence: High
Reproduction: NOT_ATTEMPTED

Evidence: [REPOSITORY_EVIDENCED] src/consoleServices.ts:exceptions; src/config.ts:normalizeDestinations/normalizeTls inspected at 35e6226b5a734b46bbc4b291e93ec103d8eee77c; [REPORTED] workflow/feedback/PO-FEEDBACK-2026-10-18-001/feedback.yaml, items PO-FB-134, PO-FB-135, PO-FB-136, PO-FB-137; [DOCUMENTED] docs/web-console-prd.md POLICY-04, UX-02, UX-IN02/04 and UX-IN02/04.

Product Owner feedback: PO-FEEDBACK-2026-10-18-001, PO-FB-134, PO-FB-135, PO-FB-136, PO-FB-137.

Current observed behavior: exceptions emits Service TLS verification disabled plus TLS verification disabled: id/name for each effective false destination. An imported name primary is used as the main context. Destination override takes precedence over service default; an omitted destination setting inherits the service default.

Relevant implementation: src/consoleServices.ts:exceptions; src/config.ts:normalizeDestinations/normalizeTls.
Relevant UX rule: product/ux/02-interaction-patterns.md UX-IN02/04; product/ux/04-visual-system.md UX-V01/02/05/06.
Relevant user journey: docs/web-console-prd-user-journey-audit.md J-OWNER-CONFIG/J-ADMIN-CONFIG review and activation.
Relevant product requirement: docs/web-console-prd.md POLICY-04, UX-02, UX-IN02/04.
Architecture/security constraint: STATE-01/02 atomic reviewed activation, current authorization and dependency fencing; SEC-01/02/03 and AUDIT-01/04 secret exclusion, access and durable admission remain unchanged.

Root source of inconsistency: Existing UX already requires readable effective TLS inheritance and specific exception effects; internal-only labels do not meet that rule. Runtime TLS policy is not changed by the owner question.

Authoritative desired state: Security exceptions identify recognizable affected destinations and truthful effective TLS scope. A service-wide default is not described as applying to overridden destinations; retain every distinct risk and acknowledgment obligation.
Authoritative artifact requiring change: None; existing POLICY-04 and UX-IN02/04 already apply.
Changed automatically: Not applicable
Decision required: No
Implementation remediation required: REC-RM-029

Affected definition domains: {"product": false, "user_journeys": false, "ux": false, "architecture": false, "security": false}
Potentially stale artifacts: None
Implementation validation:
- Service default false with no overrides describes affected destinations; true override is not falsely described as disabled.
- Service default true with destination false identifies only the overridden destination; omitted default stays true.
- Duplicate/internal/missing display names remain distinguishable using safe recognizable destination context; never include credentials or secret-bearing URL components.
- Cleartext HTTP, broad matching, reduced scanning, default allow and recovered-service acknowledgments remain accurate and independently required.
