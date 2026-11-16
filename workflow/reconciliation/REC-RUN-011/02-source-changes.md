# Source changes

| Change ID | Source findings | PO feedback | Target artifact | Change kind | Status | Decision | Semantic impact |
|---|---|---|---|---|---|---|---|
| REC-CHANGE-042 | REC-042 | PO-FB-149, PO-FB-150, PO-FB-163, PO-FB-164, PO-FB-165, PO-FB-166, PO-FB-167, PO-FB-168, PO-FB-169, PO-FB-170 | product/ux/01-information-architecture.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |
| REC-CHANGE-044 | REC-044 | PO-FB-153, PO-FB-154 | docs/web-console-prd.md, product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |
| REC-CHANGE-045 | REC-045 | PO-FB-158, PO-FB-159, PO-FB-160, PO-FB-162 | docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |
| REC-CHANGE-046 | REC-046 | PO-FB-172, PO-FB-173, PO-FB-174 | docs/web-console-prd.md, product/ux/01-information-architecture.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |
| REC-CHANGE-047 | REC-047 | PO-FB-171, PO-FB-175 | docs/web-console-prd.md, product/ux/01-information-architecture.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |
| REC-CHANGE-048 | REC-048 | PO-FB-176, PO-FB-177, PO-FB-178, PO-FB-179 | product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |
| REC-CHANGE-051 | REC-051 | PO-FB-185, PO-FB-186, PO-FB-187, PO-FB-188, PO-FB-189, PO-FB-190, PO-FB-191 | product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |
| REC-CHANGE-052 | REC-052 | PO-FB-192, PO-FB-193, PO-FB-194, PO-FB-195 | product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |
| REC-CHANGE-053 | REC-053 | PO-FB-196, PO-FB-197, PO-FB-198 | product/ux/02-interaction-patterns.md | ux_interaction | APPLIED_AFTER_DECISION | Confirmed directives; bounded specialist mechanics | journeys, UX |

## REC-CHANGE-042

Previous: Overview labels and entry points imply review readiness despite missing dependencies; list rows repeat missing-value or mapping detail.

New rule: Service rows retain lifecycle/draft distinctions with concise Needs configuration. Overview identifies actual blockers and links to correction; ready Review draft changes opens real review, unavailable while known issues remain. Top-align list controls.

Target rules: UX-IA02, UX-IA09; CONFIG-05. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.


## REC-CHANGE-044

Previous: Current section labels lack the owner-selected affected-section indicator.

New rule: Yellow circled exclamation with text/accessibility equivalent appears only beside affected section names; local affected controls are identifiable without color alone.

Target rules: UX-03; UX-IN15. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.


## REC-CHANGE-045

Previous: Five-step setup and edit Review changes placeholder follow stale UX6; edited services offer premature review instead of sequential progression.

New rule: Create and edit share Details, Destination, Authentication, Access & policy. First three Continue; last Review & apply opens actual review. Keep direct navigation, safe history guards, existing real review and incomplete draft saving.

Target rules: CONFIG-01; UX-IA02, UX-IA09, UX-IN11, UX-IN15. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.


## REC-CHANGE-046

Previous: Exporter already emits gateway and scanner catalog YAML strings, but UI renders them inline.

New rule: Download gateway YAML accepted by existing importer on another instance, with existing optional scanner catalogs downloadable separately. No live authority/secret transfer, no activation, no new bundle schema.

Target rules: MIGRATE-03; UX-IA03, UX-IA05. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.


## REC-CHANGE-047

Previous: History/reuse UI remains visible, including empty state.

New rule: Hide history/reuse console UI while retaining latest50 history and current permission/dependency constrained revision reuse backend. Do not purge revisions or remove APIs.

Target rules: CONFIG-04; UX-IA02, UX-IA03, UX-IA05. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.


## REC-CHANGE-048

Previous: Settings effects are folded; reported comparison formats same values differently. Service review already has visible exceptions, but service-specific approval pattern does not automatically govern Settings.

New rule: Show Settings security/operational effects immediately. Preserve full-scope atomic apply and existing acknowledgments; shared exact-value comparison must not invent different semantics or normalize literals.

Target rules: UX-IN02, UX-IN18; UX-02. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.


## REC-CHANGE-051

Previous: Inline replacement password and folded authentication contrast with focused service secret dialogs; owner reports green Not configured.

New rule: Visible current username/credential availability. Set/Replace opens username-prefilled/password-blank Save/Cancel dialog staging normal Settings review/apply; Clear is independent existing immediate deletion, blocked while enabled delivery depends on it. Yellow Not configured text state. Research informs presentation, never overrides timing.

Target rules: IDENT-04, CONFIG-03; UX-IN09, UX-IN13, UX-EX03. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.


## REC-CHANGE-052

Previous: Hour input accepts24 until validation; retention label obscures unit.

New rule: Only valid UTC hours00–23 can be chosen; invalid legacy/external data remains explicit error with backend checks retained. Label retention in days. Slider suggestion is not a requirement.

Target rules: UX-02, UX-03; UX-IN18; BACKUP-01. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.


## REC-CHANGE-053

Previous: Health details and audit retention remain disclosed rather than immediately available.

New rule: Show organized health details and audit retention directly with diagnostic context, current role-limited data and truthful loading/failure states; do not turn bounded public health into detailed diagnostics.

Target rules: UX-IA06, UX-IN18; UX-02. Gate: exact confirmed intent with existing roles, scope, timing and trust preserved; bounded Product UX mechanics recorded in 06-specialist-basis.md. Only named canonical paths changed; stable IDs retained. Application verified by bounded Git diff.

REC-043 is implementation-only precise-validation drift. REC-049 retains scope semantics; helper copy follows existing UX-IA08 with specialist interpretation. REC-050 navigation proposal changes no authority. The adjacent-heading correction for PO-FB-184 follows existing accessible orientation rules; UX-IN18 carries that bounded clarification alongside visible health/retention.
