# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: docs/web-console-prd.md CONFIG-03/POLICY-02/POLICY-04; product/ux/01-information-architecture.md UX-IA09/10; product/ux/02-interaction-patterns.md UX-IN16/17; APPLIED_AFTER_DECISION changes 038–041.
> Preservation baseline: f498938edf7858a5217f047efba22a727a7303fa, UX5 and completed M35–36.
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| MEDIUM | REC-RM-030 | New settings first and selected | REC-038 | CONFIG-03 / UX-IN17 | No other remediation | Focused tests/browser |
| MEDIUM | REC-RM-031 | Visible concrete review exceptions | REC-039 | CONFIG-03 / POLICY-04 / UX-IN17 | No other remediation | Focused tests/browser |
| MEDIUM | REC-RM-032 | Remove standalone guided Secret detection | REC-040 | POLICY-02 / UX-IA09 / UX-IA10 | No other remediation | Focused tests/browser |
| MEDIUM | REC-RM-033 | Highlight any scanning override | REC-041 | POLICY-02 / UX-IN16 | No other remediation | Focused tests/browser |

## REC-RM-030: New settings first and selected

Priority: MEDIUM. Source findings: REC-038. Product Owner feedback: PO-FEEDBACK-2026-10-18-002 / PO-FB-138.
Authoritative basis: CONFIG-03 / UX-IN17, docs/web-console-prd.md, product/ux/02-interaction-patterns.md, REC-CHANGE-038 APPLIED_AFTER_DECISION.
Desired outcome / Required behavior: New settings is first and selected on entering review; Changes remains available with identical reviewed scope.
Current behavior: Current serviceReviewTabs renders Changes first and selects it. UX-IN17 explicitly prescribed that default.
Affected users/roles: Owner/Administrator configuring authorized services; preserve permission-appropriate Auditor views and all Member restrictions.
Affected interfaces and compatibility: service configuration/review presentation only, same draft and API contracts, exact literals and arrays, no persistent migration.
UX constraints: approved UX5 visual direction; non-color labels, keyboard operation, narrow/text-enlarged layouts, safe focus/history and no false dirty state.
Architecture/security constraints: STATE-01/02/03, SECRES-01, unchanged POLICY-04 and no scanning guarantees beyond documented best effort.

Acceptance criteria:
1. New settings is first and selected on entering review; Changes remains available with identical reviewed scope.
2. Tab order/default and read-only switching; preserve exact complete proposal and all diff states.
3. Unauthorized mutation remains unavailable/rejected; stale dependencies remain rejected without partial apply. No changes to configuration data or security semantics through presentation/navigation alone.
4. Preserve exact custom/imported values, rule order, active/draft distinction, dialog cancellation, known/unknown outcomes and safe sanitization. Update expectations encoding only the superseded presentation.

Dependencies: applied authority above; no other remediation dependency. Definition revalidation gates delivery planning separately.
Explicit exclusions: optional slider, new numeric semantics, shared catalog redesign, blanket warning removal, new permissions/storage/API, unrelated services/Settings and deployment.
Required implementation validation: focused positive/negative tests covering criteria, real disposable-browser desktop/narrow/text-enlarged visual and interaction evidence against approved direction; relevant full regression checks at delivery acceptance. Do not treat source inspection as a browser pass.

## REC-RM-031: Visible concrete review exceptions

Priority: MEDIUM. Source findings: REC-039. Product Owner feedback: PO-FEEDBACK-2026-10-18-002 / PO-FB-139, PO-FB-140.
Authoritative basis: CONFIG-03 / POLICY-04 / UX-IN17, docs/web-console-prd.md, product/ux/02-interaction-patterns.md, REC-CHANGE-039 APPLIED_AFTER_DECISION.
Desired outcome / Required behavior: Show the actual security exception set as readable bullets before Approve changes, replacing that disclaimer; keep exact individual modal acknowledgments.
Current behavior: serviceApprovalFooter shows a count and a generic trust disclaimer, while detailed serviceExceptionLabel copy appears only in the dialog.
Affected users/roles: Owner/Administrator configuring authorized services; preserve permission-appropriate Auditor views and all Member restrictions.
Affected interfaces and compatibility: service configuration/review presentation only, same draft and API contracts, exact literals and arrays, no persistent migration.
UX constraints: approved UX5 visual direction; non-color labels, keyboard operation, narrow/text-enlarged layouts, safe focus/history and no false dirty state.
Architecture/security constraints: STATE-01/02/03, SECRES-01, unchanged POLICY-04 and no scanning guarantees beyond documented best effort.

Acceptance criteria:
1. Show the actual security exception set as readable bullets before Approve changes, replacing that disclaimer; keep exact individual modal acknowledgments.
2. Zero, one and multiple exceptions, safe TLS inheritance labels, no secret leakage, and unchanged missing/extra/stale acknowledgment rejection.
3. Unauthorized mutation remains unavailable/rejected; stale dependencies remain rejected without partial apply. No changes to configuration data or security semantics through presentation/navigation alone.
4. Preserve exact custom/imported values, rule order, active/draft distinction, dialog cancellation, known/unknown outcomes and safe sanitization. Update expectations encoding only the superseded presentation.

Dependencies: applied authority above; no other remediation dependency. Definition revalidation gates delivery planning separately.
Explicit exclusions: optional slider, new numeric semantics, shared catalog redesign, blanket warning removal, new permissions/storage/API, unrelated services/Settings and deployment.
Required implementation validation: focused positive/negative tests covering criteria, real disposable-browser desktop/narrow/text-enlarged visual and interaction evidence against approved direction; relevant full regression checks at delivery acceptance. Do not treat source inspection as a browser pass.

## REC-RM-032: Remove standalone guided Secret detection

Priority: MEDIUM. Source findings: REC-040. Product Owner feedback: PO-FEEDBACK-2026-10-18-002 / PO-FB-142, PO-FB-143, PO-FB-144, PO-FB-145.
Authoritative basis: POLICY-02 / UX-IA09 / UX-IA10, docs/web-console-prd.md, product/ux/01-information-architecture.md, REC-CHANGE-040 APPLIED_AFTER_DECISION.
Desired outcome / Required behavior: No standalone Secret detection guided section; policy overrides, shared Settings, review values and all saved configuration remain available.
Current behavior: Existing service sections include a Secret detection page with inherited explanation/current exceptions and a global settings link; editing remains in policy/global Settings.
Affected users/roles: Owner/Administrator configuring authorized services; preserve permission-appropriate Auditor views and all Member restrictions.
Affected interfaces and compatibility: service configuration/review presentation only, same draft and API contracts, exact literals and arrays, no persistent migration.
UX constraints: approved UX5 visual direction; non-color labels, keyboard operation, narrow/text-enlarged layouts, safe focus/history and no false dirty state.
Architecture/security constraints: STATE-01/02/03, SECRES-01, unchanged POLICY-04 and no scanning guarantees beyond documented best effort.

Acceptance criteria:
1. No standalone Secret detection guided section; policy overrides, shared Settings, review values and all saved configuration remain available.
2. Create/edit navigation, old section entry and Back/Forward remain safe; no lost draft or configuration; shared Settings and policy controls remain reachable.
3. Unauthorized mutation remains unavailable/rejected; stale dependencies remain rejected without partial apply. No changes to configuration data or security semantics through presentation/navigation alone.
4. Preserve exact custom/imported values, rule order, active/draft distinction, dialog cancellation, known/unknown outcomes and safe sanitization. Update expectations encoding only the superseded presentation.

Dependencies: applied authority above; no other remediation dependency. Definition revalidation gates delivery planning separately.
Explicit exclusions: optional slider, new numeric semantics, shared catalog redesign, blanket warning removal, new permissions/storage/API, unrelated services/Settings and deployment.
Required implementation validation: focused positive/negative tests covering criteria, real disposable-browser desktop/narrow/text-enlarged visual and interaction evidence against approved direction; relevant full regression checks at delivery acceptance. Do not treat source inspection as a browser pass.

## REC-RM-033: Highlight any scanning override

Priority: MEDIUM. Source findings: REC-041. Product Owner feedback: PO-FEEDBACK-2026-10-18-002 / PO-FB-146.
Authoritative basis: POLICY-02 / UX-IN16, docs/web-console-prd.md, product/ux/02-interaction-patterns.md, REC-CHANGE-041 APPLIED_AFTER_DECISION.
Desired outcome / Required behavior: Highlight every rule with explicit secret-detection or binary override, including protection-increasing and explicit default-equivalent binary values; unoverridden rules lack marker.
Current behavior: Policy rows display rule details without a distinct all-overrides marker; rule dialog already supports secretlint and binary_response overrides.
Affected users/roles: Owner/Administrator configuring authorized services; preserve permission-appropriate Auditor views and all Member restrictions.
Affected interfaces and compatibility: service configuration/review presentation only, same draft and API contracts, exact literals and arrays, no persistent migration.
UX constraints: approved UX5 visual direction; non-color labels, keyboard operation, narrow/text-enlarged layouts, safe focus/history and no false dirty state.
Architecture/security constraints: STATE-01/02/03, SECRES-01, unchanged POLICY-04 and no scanning guarantees beyond documented best effort.

Acceptance criteria:
1. Highlight every rule with explicit secret-detection or binary override, including protection-increasing and explicit default-equivalent binary values; unoverridden rules lack marker.
2. Both override families, inherited/explicit default-equivalent states, non-color accessible identification, exact imported values, and unchanged risk classification.
3. Unauthorized mutation remains unavailable/rejected; stale dependencies remain rejected without partial apply. No changes to configuration data or security semantics through presentation/navigation alone.
4. Preserve exact custom/imported values, rule order, active/draft distinction, dialog cancellation, known/unknown outcomes and safe sanitization. Update expectations encoding only the superseded presentation.

Dependencies: applied authority above; no other remediation dependency. Definition revalidation gates delivery planning separately.
Explicit exclusions: optional slider, new numeric semantics, shared catalog redesign, blanket warning removal, new permissions/storage/API, unrelated services/Settings and deployment.
Required implementation validation: focused positive/negative tests covering criteria, real disposable-browser desktop/narrow/text-enlarged visual and interaction evidence against approved direction; relevant full regression checks at delivery acceptance. Do not treat source inspection as a browser pass.
