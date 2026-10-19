# Source changes

| Change ID | Source findings | PO feedback | Target artifact | Change kind | Status | Decision | Semantic impact |
|---|---|---|---|---|---|---|---|
| REC-CHANGE-038 | REC-038 | PO-FB-138 | docs/web-console-prd.md, product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directive | journeys, UX |
| REC-CHANGE-039 | REC-039 | PO-FB-139, PO-FB-140 | docs/web-console-prd.md, product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directive | journeys, UX |
| REC-CHANGE-040 | REC-040 | PO-FB-142, PO-FB-143, PO-FB-144, PO-FB-145 | docs/web-console-prd.md, product/ux/01-information-architecture.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directive | journeys, UX |
| REC-CHANGE-041 | REC-041 | PO-FB-146 | docs/web-console-prd.md, product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directive | journeys, UX |

## REC-CHANGE-038

Previous: Current serviceReviewTabs renders Changes first and selects it. UX-IN17 explicitly prescribed that default.

New testable rule: New settings is first and selected on entering review; Changes remains available with identical reviewed scope.

Gate: exact current confirmed choice, local within approved service UX, no unsettled security or architecture semantics. Applied at CONFIG-03 / UX-IN17; checked bounded diff against input hashes. Stable IDs retained. Derived UX acceptance/manifest and service journeys require propagation; no prior feedback or historical visuals rewritten.

## REC-CHANGE-039

Previous: serviceApprovalFooter shows a count and a generic trust disclaimer, while detailed serviceExceptionLabel copy appears only in the dialog.

New testable rule: Show the actual security exception set as readable bullets before Approve changes, replacing that disclaimer; keep exact individual modal acknowledgments.

Gate: exact current confirmed choice, local within approved service UX, no unsettled security or architecture semantics. Applied at CONFIG-03 / POLICY-04 / UX-IN17; checked bounded diff against input hashes. Stable IDs retained. Derived UX acceptance/manifest and service journeys require propagation; no prior feedback or historical visuals rewritten.

## REC-CHANGE-040

Previous: Existing service sections include a Secret detection page with inherited explanation/current exceptions and a global settings link; editing remains in policy/global Settings.

New testable rule: No standalone Secret detection guided section; policy overrides, shared Settings, review values and all saved configuration remain available.

Gate: exact current confirmed choice, local within approved service UX, no unsettled security or architecture semantics. Applied at POLICY-02 / UX-IA09 / UX-IA10; checked bounded diff against input hashes. Stable IDs retained. Derived UX acceptance/manifest and service journeys require propagation; no prior feedback or historical visuals rewritten.

## REC-CHANGE-041

Previous: Policy rows display rule details without a distinct all-overrides marker; rule dialog already supports secretlint and binary_response overrides.

New testable rule: Highlight every rule with explicit secret-detection or binary override, including protection-increasing and explicit default-equivalent binary values; unoverridden rules lack marker.

Gate: exact current confirmed choice, local within approved service UX, no unsettled security or architecture semantics. Applied at POLICY-02 / UX-IN16; checked bounded diff against input hashes. Stable IDs retained. Derived UX acceptance/manifest and service journeys require propagation; no prior feedback or historical visuals rewritten.
