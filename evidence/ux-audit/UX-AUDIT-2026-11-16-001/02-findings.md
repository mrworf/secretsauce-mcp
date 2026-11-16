# Neutral observed differences

## UX-VIS-F001: Settings effects and discovery use disclosures while service exceptions are immediately visible

Category: CROSS_SURFACE_INCONSISTENCY. Materiality: MEDIUM. Scope: systemic.

Settings review folds Security and operational effects. Health folds audit retention and details. Settings search appears below the main content in a disclosure. Service review displays exception bullets openly. UX6 deliberately scopes its new review presentation to services; latest owner feedback requests changes in Settings. This difference requires interpretation, not automatic defect classification.

Evidence: UXVIS-001, UXVIS-002, UXVIS-004, UXVIS-007. Governing rules: UX-IN01/02. Reproduce using the named fixture commands and corresponding manifest state. Targeted revalidation: UXVIS-001, UXVIS-002, UXVIS-004, UXVIS-007.

Material consequence: inconsistent expectations for discovery, progression and visibility of decision information. No root cause or remediation is assigned here.

## UX-VIS-F002: Guided service navigation retains the fifth Review entry

Category: INTERACTION_MISMATCH. Materiality: MEDIUM. Scope: systemic.

Create shows five steps including Review; edit sidebar includes Review changes. This matches the retained UX6 design but differs from the latest confirmed four-section owner direction, which has not yet been adopted. The navigation harness verifies safe history and non-secret draft preservation.

Evidence: UXVIS-005, UXVIS-006, UXVIS-009. Governing rules: UX-IN15. Reproduce using the named fixture commands and corresponding manifest state. Targeted revalidation: UXVIS-005, UXVIS-006, UXVIS-009.

Material consequence: inconsistent expectations for discovery, progression and visibility of decision information. No root cause or remediation is assigned here.

## UX-VIS-F003: Missing credential review failure gives undifferentiated section recovery actions

Category: INTERACTION_MISMATCH. Materiality: HIGH.

Seeded draft has a named credential without a value. Review displays Service incomplete or invalid followed by four Check section buttons, without identifying the credential or affected section. Authentication shows Value missing near the bottom in a neutral panel; section navigation has no issue cue. This is recovery-direction evidence against UX-IN01/15 precise actionable validation obligations. The owner-requested yellow-circle mechanism is separately unadopted; this finding does not establish that particular design as authority.

Evidence and targeted revalidation: UXVIS-010, UXVIS-018. Reproduce using the retained focused fixture script. No root cause or implementation remedy assigned.

## UX-VIS-F004: Configuration export renders inline text and history remains visible

Category: INTERACTION_MISMATCH. Materiality: MEDIUM.

Clicking Export sanitized configuration renders named YAML text blocks beneath the tools screen. Applied configuration history remains visible in its empty state. Latest confirmed feedback asks for a downloadable importable YAML artifact and temporary hiding of the history interface; those requests remain unadopted. This capture does not test cross-instance import or populated history.

Evidence and targeted revalidation: UXVIS-015. Reproduce using the retained focused fixture script. No root cause or implementation remedy assigned.
