# REC-RUN-014 — Service editing, lifecycle and import consistency

## Summary

Invocation: product-definition-orchestrator; canonical confirmed feedback PO-FEEDBACK-2026-11-18-002,27 items238–264. Inspected implementation8181af4 (includes tested26ad775/68dcc36 and shared-header change); transaction begins307202c. No new runtime reproduction or visual acceptance is claimed. Source-only findings are REPOSITORY_EVIDENCED; walkthrough is REPORTED. Five coherent findings, five resolved remediation outcomes; no open owner decision. Status RESOLVED, implementation-ready semantics, delivery planning blocked pending targeted definition revalidation. Narrow PRD corrections only; no code, UX authority, architecture/security authority, workflow state or milestones changed.

Current Product Owner directives override stale Continue/mapping/lifecycle specifications for their exact outcomes. Existing immediate values/access, current authorization, mandatory audit, atomic review and recovery controls remain. Specialist S9-01–05 copied into [producer-owned basis](service-semantics-basis.md), derived from confirmed intent and STATE-01/02/09; the copy is reasoning provenance and PRD is normative authority. Saved-neveractive discard is proposal removal, not an unrequested archive/delete: it retains Inactive identity/display identity and independent values/audit. No REC-DEC-013 is needed.

## Findings

|Finding|Classification|Severity|Reproduction|Implementation|
|---|---|---|---|---|
|REC-059 Service navigation and incomplete review|PRODUCT_SPEC_PROBLEM|HIGH|NOT_ATTEMPTED|REC-RM-053|
|REC-060 Discard only the named proposal|PRODUCT_SPEC_GAP|HIGH|NOT_ATTEMPTED|REC-RM-054|
|REC-061 Navigation-guard save must finish|IMPLEMENTATION_DEFECT|HIGH|NOT_ATTEMPTED|REC-RM-055|
|REC-062 Lifecycle labels separate from saved drafts|PRODUCT_SPEC_PROBLEM|MEDIUM|NOT_ATTEMPTED|REC-RM-056|
|REC-063 Independent unassigned imports and mapping retirement|PRODUCT_SPEC_PROBLEM|HIGH|NOT_ATTEMPTED|REC-RM-057|

### REC-059 — Service navigation and incomplete review

Classification: PRODUCT_SPEC_PROBLEM. Severity: HIGH. Confidence: High for source/intent. Reproduction: NOT_ATTEMPTED.
Evidence/current behavior: [REPORTED] confirmed feedback PO-FB-238, PO-FB-239, PO-FB-240, PO-FB-241, PO-FB-242, PO-FB-243, PO-FB-244, PO-FB-248, PO-FB-249, PO-FB-261, PO-FB-262; [REPOSITORY_EVIDENCED] Current section advancement and complete-only review follow superseded CONFIG-01. Shared header at8181af4 is recent valid baseline but retains Back to Services. Overview/section indicators already provide useful precise guidance.
Implementation: src/consoleServicePage.ts renderServiceHeader/renderEditor/reviewService; src/consoleServices.ts candidate/review; src/consoleSettingsPage.ts settingsFooter.
Product requirements: CONFIG-01, CONFIG-03, UX-03 in docs/web-console-prd.md. Canonical UX8 interaction/navigation and shared-pattern rules apply but require bounded refinement for newer directives; preserved Settings footer is a conforming sibling, SMTP timing is an explicit unchanged exception. User journeys: service setup/edit/review/import/exit portions of docs/web-console-prd-user-journey-audit.md; old advancement/mapping/lifecycle steps are potentially stale. Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve independent values, current assignments, audit, reviewed activation and recovery fences.
Root inconsistent layer: current product/interaction specification does not express the newer confirmed directive; conformity to the older rule is not expected current behavior.
Authoritative desired state: Use the shared persistent status/Discard/Save for later/Review changes bar, direct section navigation, parent Configuration indicators and incomplete non-activatable review; remove Back to Services across four tabs.
Authority change: REC-CHANGE-059, docs/web-console-prd.md, APPLIED_AFTER_DECISION (confirmed directives plus S9 preservation derivation). No unresolved decision. Remediation: REC-RM-053. Validation: New/edited/incomplete/complete/read-only; issue fix links, no approval authority before valid review, active execution preserved; desktop/narrow/enlarged-text footer/focus and browser history.
Affected domains: product false (resolved by adopted precise clauses); journeys/UX true; architecture/security true for the aggregate changed discard/import lifecycle boundary, not as a claim every presentation change alters trust. Exact paths in Impact below.

### REC-060 — Discard only the named proposal

Classification: PRODUCT_SPEC_GAP. Severity: HIGH. Confidence: High for source/intent. Reproduction: NOT_ATTEMPTED.
Evidence/current behavior: [REPORTED] confirmed feedback PO-FB-245, PO-FB-246, PO-FB-247; [REPOSITORY_EVIDENCED] Service editor has browser guard discard but no separately confirmed durable service-draft discard; current source retains independent immediate values.
Implementation: src/consoleServicePage.ts leaveEditor/saveEditor; src/consoleServices.ts managed service/draft/value state.
Product requirements: CONFIG-03, CONFIG-05, STATE-01, STATE-09 in docs/web-console-prd.md. Canonical UX8 interaction/navigation and shared-pattern rules apply but require bounded refinement for newer directives; preserved Settings footer is a conforming sibling, SMTP timing is an explicit unchanged exception. User journeys: service setup/edit/review/import/exit portions of docs/web-console-prd-user-journey-audit.md; old advancement/mapping/lifecycle steps are potentially stale. Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve independent values, current assignments, audit, reviewed activation and recovery fences.
Root inconsistent layer: current product/interaction specification does not express the newer confirmed directive; conformity to the older rule is not expected current behavior.
Authoritative desired state: Never-saved abandon creates nothing; unsaved reverts to saved/applied; saved discard explicitly removes proposal/review only. Retain never-active Inactive identity/display identity/values/audit and current applied or Archived lifecycle.
Authority change: REC-CHANGE-060, docs/web-console-prd.md, APPLIED_AFTER_DECISION (confirmed directives plus S9 preservation derivation). No unresolved decision. Remediation: REC-RM-054. Validation: Cancel, stale generation, unauthorized/audit outage and uncertain outcome; immediate values and live assignments unchanged; fresh setup after discard does not resurrect proposal.
Affected domains: product false (resolved by adopted precise clauses); journeys/UX true; architecture/security true for the aggregate changed discard/import lifecycle boundary, not as a claim every presentation change alters trust. Exact paths in Impact below.

### REC-061 — Navigation-guard save must finish

Classification: IMPLEMENTATION_DEFECT. Severity: HIGH. Confidence: Medium for reported symptom; high for required behavior. Reproduction: NOT_ATTEMPTED.
Evidence/current behavior: [REPORTED] confirmed feedback PO-FB-252; [REPOSITORY_EVIDENCED] Reported Save draft guard loop/lost Access & policy selection. Source guard awaits saveEditor, but save may reject and refresh dependencies; exact reported runtime failure was not reproduced.
Implementation: src/consoleServicePage.ts leaveEditor/saveEditor/serviceError; test/console-services.test.ts.
Product requirements: CONFIG-03, UX-03 in docs/web-console-prd.md. Canonical UX8 interaction/navigation and shared-pattern rules apply but require bounded refinement for newer directives; preserved Settings footer is a conforming sibling, SMTP timing is an explicit unchanged exception. User journeys: service setup/edit/review/import/exit portions of docs/web-console-prd-user-journey-audit.md; old advancement/mapping/lifecycle steps are potentially stale. Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve independent values, current assignments, audit, reviewed activation and recovery fences.
Root inconsistent layer: reported implementation behavior under existing safe-save/exit authority; no speculative root-cause diagnosis is asserted.
Authoritative desired state: Confirm successful persistence before intended navigation; preserve work and specific error on failure/uncertainty, without repeated guard loop or false success.
Authority change: REC-CHANGE-061, docs/web-console-prd.md, APPLIED_AUTOMATICALLY (narrow safe-save clarification of existing UX-03). No unresolved decision. Remediation: REC-RM-055. Validation: Reproduce navigation from edited Access & policy; successful save survives reopening, Stay preserves, explicit discard loses only named edits; failure/stale/unknown does not navigate or lose safe input.
Affected domains: product false (resolved by adopted precise clauses); journeys/UX true; architecture/security true for the aggregate changed discard/import lifecycle boundary, not as a claim every presentation change alters trust. Exact paths in Impact below.

### REC-062 — Lifecycle labels separate from saved drafts

Classification: PRODUCT_SPEC_PROBLEM. Severity: MEDIUM. Confidence: High for source/intent. Reproduction: NOT_ATTEMPTED.
Evidence/current behavior: [REPORTED] confirmed feedback PO-FB-256, PO-FB-257, PO-FB-258, PO-FB-259, PO-FB-260; [REPOSITORY_EVIDENCED] PRD and source present Draft/Active/Disabled/Archived; new shared header can show Draft with Draft changes.
Implementation: src/consoleServices.ts ServiceLifecycle/list/detail; src/consoleServicePage.ts shared header/list filters.
Product requirements: CONFIG-05, UX-03 in docs/web-console-prd.md. Canonical UX8 interaction/navigation and shared-pattern rules apply but require bounded refinement for newer directives; preserved Settings footer is a conforming sibling, SMTP timing is an explicit unchanged exception. User journeys: service setup/edit/review/import/exit portions of docs/web-console-prd-user-journey-audit.md; old advancement/mapping/lifecycle steps are potentially stale. Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve independent values, current assignments, audit, reviewed activation and recovery fences.
Root inconsistent layer: current product/interaction specification does not express the newer confirmed directive; conformity to the older rule is not expected current behavior.
Authoritative desired state: Active/Inactive/Archived lifecycle; legacy Draft/Disabled project to Inactive, saved Draft separate, browser-unsaved distinct. Preserve execution/readiness distinctions, disable/revoke and reviewed enable.
Authority change: REC-CHANGE-062, docs/web-console-prd.md, APPLIED_AFTER_DECISION (confirmed directives plus S9 preservation derivation). No unresolved decision. Remediation: REC-RM-056. Validation: All four tabs/list filters, Active+Draft, Inactive with/without draft, Archived, missing applied/proposed values and restored state; no implied enum migration or auto-enable.
Affected domains: product false (resolved by adopted precise clauses); journeys/UX true; architecture/security true for the aggregate changed discard/import lifecycle boundary, not as a claim every presentation change alters trust. Exact paths in Impact below.

### REC-063 — Independent unassigned imports and mapping retirement

Classification: PRODUCT_SPEC_PROBLEM. Severity: HIGH. Confidence: High for source/intent. Reproduction: NOT_ATTEMPTED.
Evidence/current behavior: [REPORTED] confirmed feedback PO-FB-250, PO-FB-251, PO-FB-253, PO-FB-254, PO-FB-255, PO-FB-263, PO-FB-264; [REPOSITORY_EVIDENCED] MIGRATE-01 requires mapping; importConfiguration reuses same-ID existing services/values and records missingMappings/importedIdentities. candidate blocks unresolved mappings; zero grants otherwise has no minimum validation.
Implementation: src/consoleMigration.ts importConfiguration; src/consoleServices.ts mappingIssues/resolveImportMappings/candidate/apply; src/consoleServicePage.ts migrationForm/openMappingRecovery.
Product requirements: MIGRATE-01, MIGRATE-03, CONFIG-03, AUTHZ-02 in docs/web-console-prd.md. Canonical UX8 interaction/navigation and shared-pattern rules apply but require bounded refinement for newer directives; preserved Settings footer is a conforming sibling, SMTP timing is an explicit unchanged exception. User journeys: service setup/edit/review/import/exit portions of docs/web-console-prd-user-journey-audit.md; old advancement/mapping/lifecycle steps are potentially stale. Architecture/security: STATE-01/02/03/09 and SECRES-08 preserve independent values, current assignments, audit, reviewed activation and recovery fences.
Root inconsistent layer: current product/interaction specification does not express the newer confirmed directive; conformity to the older rule is not expected current behavior.
Authoritative desired state: Every import creates a separate identity with collision-safe Imported name suffixes and empty access. Ordinary eligible selection only; empty grants can apply. Legacy unresolved proposal mapping retires safely without reimport/live-grant changes or implicit metadata grants.
Authority change: REC-CHANGE-063, docs/web-console-prd.md, APPLIED_AFTER_DECISION (confirmed directives plus S9 preservation derivation). No unresolved decision. Remediation: REC-RM-057. Validation: Same-ID/name active/inactive/archived/batch collisions; independent supplied values, empty grants/execution denial, current-eligibility rejection, old mapping API cannot grant, ambiguous pending access reset visibly, live assignments intact, stale/unknown import and restored legacy state.
Affected domains: product false (resolved by adopted precise clauses); journeys/UX true; architecture/security true for the aggregate changed discard/import lifecycle boundary, not as a claim every presentation change alters trust. Exact paths in Impact below.

## Source changes

|Change|Finding|Target requirements|Status|Previous → adopted rule|
|---|---|---|---|---|
|REC-CHANGE-059|REC-059|CONFIG-01, CONFIG-03, UX-03|APPLIED_AFTER_DECISION|Use the shared persistent status/Discard/Save for later/Review changes bar, direct section navigation, parent Configuration indicators and incomplete non-activatable review; remove Back to Services across four tabs.|
|REC-CHANGE-060|REC-060|CONFIG-03, CONFIG-05, STATE-01, STATE-09|APPLIED_AFTER_DECISION|Never-saved abandon creates nothing; unsaved reverts to saved/applied; saved discard explicitly removes proposal/review only. Retain never-active Inactive identity/display identity/values/audit and current applied or Archived lifecycle.|
|REC-CHANGE-061|REC-061|CONFIG-03, UX-03|APPLIED_AUTOMATICALLY|Confirm successful persistence before intended navigation; preserve work and specific error on failure/uncertainty, without repeated guard loop or false success.|
|REC-CHANGE-062|REC-062|CONFIG-05, UX-03|APPLIED_AFTER_DECISION|Active/Inactive/Archived lifecycle; legacy Draft/Disabled project to Inactive, saved Draft separate, browser-unsaved distinct. Preserve execution/readiness distinctions, disable/revoke and reviewed enable.|
|REC-CHANGE-063|REC-063|MIGRATE-01, MIGRATE-03, CONFIG-03, AUTHZ-02|APPLIED_AFTER_DECISION|Every import creates a separate identity with collision-safe Imported name suffixes and empty access. Ordinary eligible selection only; empty grants can apply. Legacy unresolved proposal mapping retires safely without reimport/live-grant changes or implicit metadata grants.|

All actual authority edits are in docs/web-console-prd.md. CONFIG-01 supersedes step-button guidance; CONFIG-03 clarifies review/guard/discard outcomes; CONFIG-05 and UX-03 supersede display lifecycle/draft conflation; MIGRATE-01/03 supersede mapping/overwriting behavior. Original older feedback, UX8 authority and completed delivery history are preserved. No runtime control is weakened to make incomplete setup appear active.

## Resolved remediation

> Mode: CHANGE_PLAN. Authority: current docs/web-console-prd.md plus retained state/security contracts. Preservation baseline8181af4. Canonical result: reconciliation-result.yaml. Delivery planning ready: false until definition revalidation.

### REC-RM-053 — Service navigation and incomplete review

Priority HIGH; source REC-059/REC-CHANGE-059; feedback PO-FB-238, PO-FB-239, PO-FB-240, PO-FB-241, PO-FB-242, PO-FB-243, PO-FB-244, PO-FB-248, PO-FB-249, PO-FB-261, PO-FB-262; authority CONFIG-01, CONFIG-03, UX-03. Current: Current section advancement and complete-only review follow superseded CONFIG-01. Shared header at8181af4 is recent valid baseline but retains Back to Services. Overview/section indicators already provide useful precise guidance. Required: Use the shared persistent status/Discard/Save for later/Review changes bar, direct section navigation, parent Configuration indicators and incomplete non-activatable review; remove Back to Services across four tabs.
Actors: Owner/Administrator editors and read-only permitted viewers; ordinary execution eligibility unchanged. Interfaces/state: src/consoleServicePage.ts renderServiceHeader/renderEditor/reviewService; src/consoleServices.ts candidate/review; src/consoleSettingsPage.ts settingsFooter. Compatibility: preserve exact supported configuration, current live assignments, independent values, audited mutation, scoped stale/unknown recovery and existing API authorization. Retired mapping inputs cannot introduce grants.
Acceptance/validation: New/edited/incomplete/complete/read-only; issue fix links, no approval authority before valid review, active execution preserved; desktop/narrow/enlarged-text footer/focus and browser history. Related authorization, audit outage, concurrency and preservation tests are mandatory where boundary changes. UX acceptance uses current approved shared family at desktop/narrow/enlarged text, keyboard focus and history; no new theme. Dependencies: adopted PRD and targeted definition revalidation; no unresolved decision dependency. Exclusions: storage redesign, automatic credential cleanup, permanent service erasure, unrelated Settings/Activity changes and retrospective cloning of historic imports.

### REC-RM-054 — Discard only the named proposal

Priority HIGH; source REC-060/REC-CHANGE-060; feedback PO-FB-245, PO-FB-246, PO-FB-247; authority CONFIG-03, CONFIG-05, STATE-01, STATE-09. Current: Service editor has browser guard discard but no separately confirmed durable service-draft discard; current source retains independent immediate values. Required: Never-saved abandon creates nothing; unsaved reverts to saved/applied; saved discard explicitly removes proposal/review only. Retain never-active Inactive identity/display identity/values/audit and current applied or Archived lifecycle.
Actors: Owner/Administrator editors and read-only permitted viewers; ordinary execution eligibility unchanged. Interfaces/state: src/consoleServicePage.ts leaveEditor/saveEditor; src/consoleServices.ts managed service/draft/value state. Compatibility: preserve exact supported configuration, current live assignments, independent values, audited mutation, scoped stale/unknown recovery and existing API authorization. Retired mapping inputs cannot introduce grants.
Acceptance/validation: Cancel, stale generation, unauthorized/audit outage and uncertain outcome; immediate values and live assignments unchanged; fresh setup after discard does not resurrect proposal. Related authorization, audit outage, concurrency and preservation tests are mandatory where boundary changes. UX acceptance uses current approved shared family at desktop/narrow/enlarged text, keyboard focus and history; no new theme. Dependencies: adopted PRD and targeted definition revalidation; no unresolved decision dependency. Exclusions: storage redesign, automatic credential cleanup, permanent service erasure, unrelated Settings/Activity changes and retrospective cloning of historic imports.

### REC-RM-055 — Navigation-guard save must finish

Priority HIGH; source REC-061/REC-CHANGE-061; feedback PO-FB-252; authority CONFIG-03, UX-03. Current: Reported Save draft guard loop/lost Access & policy selection. Source guard awaits saveEditor, but save may reject and refresh dependencies; exact reported runtime failure was not reproduced. Required: Confirm successful persistence before intended navigation; preserve work and specific error on failure/uncertainty, without repeated guard loop or false success.
Actors: Owner/Administrator editors and read-only permitted viewers; ordinary execution eligibility unchanged. Interfaces/state: src/consoleServicePage.ts leaveEditor/saveEditor/serviceError; test/console-services.test.ts. Compatibility: preserve exact supported configuration, current live assignments, independent values, audited mutation, scoped stale/unknown recovery and existing API authorization. Retired mapping inputs cannot introduce grants.
Acceptance/validation: Reproduce navigation from edited Access & policy; successful save survives reopening, Stay preserves, explicit discard loses only named edits; failure/stale/unknown does not navigate or lose safe input. Related authorization, audit outage, concurrency and preservation tests are mandatory where boundary changes. UX acceptance uses current approved shared family at desktop/narrow/enlarged text, keyboard focus and history; no new theme. Dependencies: adopted PRD and targeted definition revalidation; no unresolved decision dependency. Exclusions: storage redesign, automatic credential cleanup, permanent service erasure, unrelated Settings/Activity changes and retrospective cloning of historic imports.

### REC-RM-056 — Lifecycle labels separate from saved drafts

Priority MEDIUM; source REC-062/REC-CHANGE-062; feedback PO-FB-256, PO-FB-257, PO-FB-258, PO-FB-259, PO-FB-260; authority CONFIG-05, UX-03. Current: PRD and source present Draft/Active/Disabled/Archived; new shared header can show Draft with Draft changes. Required: Active/Inactive/Archived lifecycle; legacy Draft/Disabled project to Inactive, saved Draft separate, browser-unsaved distinct. Preserve execution/readiness distinctions, disable/revoke and reviewed enable.
Actors: Owner/Administrator editors and read-only permitted viewers; ordinary execution eligibility unchanged. Interfaces/state: src/consoleServices.ts ServiceLifecycle/list/detail; src/consoleServicePage.ts shared header/list filters. Compatibility: preserve exact supported configuration, current live assignments, independent values, audited mutation, scoped stale/unknown recovery and existing API authorization. Retired mapping inputs cannot introduce grants.
Acceptance/validation: All four tabs/list filters, Active+Draft, Inactive with/without draft, Archived, missing applied/proposed values and restored state; no implied enum migration or auto-enable. Related authorization, audit outage, concurrency and preservation tests are mandatory where boundary changes. UX acceptance uses current approved shared family at desktop/narrow/enlarged text, keyboard focus and history; no new theme. Dependencies: adopted PRD and targeted definition revalidation; no unresolved decision dependency. Exclusions: storage redesign, automatic credential cleanup, permanent service erasure, unrelated Settings/Activity changes and retrospective cloning of historic imports.

### REC-RM-057 — Independent unassigned imports and mapping retirement

Priority HIGH; source REC-063/REC-CHANGE-063; feedback PO-FB-250, PO-FB-251, PO-FB-253, PO-FB-254, PO-FB-255, PO-FB-263, PO-FB-264; authority MIGRATE-01, MIGRATE-03, CONFIG-03, AUTHZ-02. Current: MIGRATE-01 requires mapping; importConfiguration reuses same-ID existing services/values and records missingMappings/importedIdentities. candidate blocks unresolved mappings; zero grants otherwise has no minimum validation. Required: Every import creates a separate identity with collision-safe Imported name suffixes and empty access. Ordinary eligible selection only; empty grants can apply. Legacy unresolved proposal mapping retires safely without reimport/live-grant changes or implicit metadata grants.
Actors: Owner/Administrator editors and read-only permitted viewers; ordinary execution eligibility unchanged. Interfaces/state: src/consoleMigration.ts importConfiguration; src/consoleServices.ts mappingIssues/resolveImportMappings/candidate/apply; src/consoleServicePage.ts migrationForm/openMappingRecovery. Compatibility: preserve exact supported configuration, current live assignments, independent values, audited mutation, scoped stale/unknown recovery and existing API authorization. Retired mapping inputs cannot introduce grants.
Acceptance/validation: Same-ID/name active/inactive/archived/batch collisions; independent supplied values, empty grants/execution denial, current-eligibility rejection, old mapping API cannot grant, ambiguous pending access reset visibly, live assignments intact, stale/unknown import and restored legacy state. Related authorization, audit outage, concurrency and preservation tests are mandatory where boundary changes. UX acceptance uses current approved shared family at desktop/narrow/enlarged text, keyboard focus and history; no new theme. Dependencies: adopted PRD and targeted definition revalidation; no unresolved decision dependency. Exclusions: storage redesign, automatic credential cleanup, permanent service erasure, unrelated Settings/Activity changes and retrospective cloning of historic imports.

## Impact and feedback trace

Derived service setup/edit/exit/import coverage and journeys, shared UX navigation/status/review patterns, and architecture/security discard/import migration contracts require targeted semantic revalidation. Existing Settings footer, SMTP timing, Activity predicates/export and remote MCP behavior are preserved. No full product audit is requested. Potentially stale paths:
- docs/web-console-prd-coverage.md
- docs/web-console-prd-user-journey-audit.md
- product/ux/manifest.yaml
- product/ux/01-information-architecture.md
- product/ux/02-interaction-patterns.md
- product/architecture/web-console-state-contract.md
- product/security/web-console-security-contract.md

|Feedback|Finding|Change|Remediation|Disposition|
|---|---|---|---|---|
|PO-FB-238|REC-059|REC-CHANGE-059|REC-RM-053|EVIDENCE_CORRELATED|
|PO-FB-239|REC-059|REC-CHANGE-059|REC-RM-053|FULLY_RESOLVED|
|PO-FB-240|REC-059|REC-CHANGE-059|REC-RM-053|EVIDENCE_CORRELATED|
|PO-FB-241|REC-059|REC-CHANGE-059|REC-RM-053|FULLY_RESOLVED|
|PO-FB-242|REC-059|REC-CHANGE-059|REC-RM-053|EVIDENCE_CORRELATED|
|PO-FB-243|REC-059|REC-CHANGE-059|REC-RM-053|FULLY_RESOLVED|
|PO-FB-244|REC-059|REC-CHANGE-059|REC-RM-053|FULLY_RESOLVED|
|PO-FB-245|REC-060|REC-CHANGE-060|REC-RM-054|FULLY_RESOLVED|
|PO-FB-246|REC-060|REC-CHANGE-060|REC-RM-054|FULLY_RESOLVED|
|PO-FB-247|REC-060|REC-CHANGE-060|REC-RM-054|FULLY_RESOLVED|
|PO-FB-248|REC-059|REC-CHANGE-059|REC-RM-053|EVIDENCE_CORRELATED|
|PO-FB-249|REC-059|REC-CHANGE-059|REC-RM-053|ADVISORY_CONSIDERED|
|PO-FB-250|REC-063|REC-CHANGE-063|REC-RM-057|EVIDENCE_CORRELATED|
|PO-FB-251|REC-063|REC-CHANGE-063|REC-RM-057|EXPLORATORY_RECORDED|
|PO-FB-252|REC-061|REC-CHANGE-061|REC-RM-055|EVIDENCE_CORRELATED|
|PO-FB-253|REC-063|REC-CHANGE-063|REC-RM-057|FULLY_RESOLVED|
|PO-FB-254|REC-063|REC-CHANGE-063|REC-RM-057|FULLY_RESOLVED|
|PO-FB-255|REC-063|REC-CHANGE-063|REC-RM-057|FULLY_RESOLVED|
|PO-FB-256|REC-062|REC-CHANGE-062|REC-RM-056|EVIDENCE_CORRELATED|
|PO-FB-257|REC-062|REC-CHANGE-062|REC-RM-056|FULLY_RESOLVED|
|PO-FB-258|REC-062|REC-CHANGE-062|REC-RM-056|FULLY_RESOLVED|
|PO-FB-259|REC-062|REC-CHANGE-062|REC-RM-056|EXPLORATORY_RECORDED|
|PO-FB-260|REC-062|REC-CHANGE-062|REC-RM-056|FULLY_RESOLVED|
|PO-FB-261|REC-059|REC-CHANGE-059|REC-RM-053|FULLY_RESOLVED|
|PO-FB-262|REC-059|REC-CHANGE-059|REC-RM-053|FULLY_RESOLVED|
|PO-FB-263|REC-063|REC-CHANGE-063|REC-RM-057|FULLY_RESOLVED|
|PO-FB-264|REC-063|REC-CHANGE-063|REC-RM-057|FULLY_RESOLVED|

All27 items traced. Mapping-before-edit idea251 is superseded by253. Preference249 retains already-correct guidance under existing authority, not new scope. Observation252 remains reported/unreproduced; downstream validation must diagnose it, not claim this reconciliation reproduced a root cause.

## Decisions and limitations

No unresolved decisions. Draft-only discard preservation derives directly from246/247 plus independent-action boundaries; archive/delete is not an alternative silently selected. New imports are separate; old unresolved drafts retire mapping safely without retroactively cloning or changing live grants. Unknown provenance affects proposed selection only, with a visible reset notice and ordinary explicit selection. Exact migration mechanism remains subject to existing bounded state/security review, not a new Product Owner choice.

No runtime or screenshots were produced in this definition transaction. Prior runtime evidence only establishes its tested revision/states. Required future implementation acceptance is distinct from semantic resolution. Handoff DEFINITION_REVALIDATION → product-definition-orchestrator. No implementation authorization is inferred by this report.
