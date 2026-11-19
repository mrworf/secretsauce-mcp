# REC-RUN-013 — Settings, credentials and Activity consistency

Generated 2026-11-18. Invocation: product-definition-orchestrator. Product: secretsauce-mcp. Inspected implementation/starting HEAD: fc458fe5e202b9d14a1f32a39749540cec3ac928. Confirmed feedback producer 1062a57394b34e58decf1d9afa0bdf6c1e01bec4, closeout fc458fe. Baseline is completed UX7; the definition history snapshot preserves it. Source inspection is read-only; no runtime reproduction or release acceptance is claimed.

## Summary

**RESOLVED**: five findings, five grouped eligible remediation outcomes, all 36 feedback items dispositioned. Two UX_SPEC_GAP, two UX_SPEC_PROBLEM, one NEW_REQUIREMENT. Five narrow PRD corrections applied after confirmed decisions; no UX, architecture/security, implementation or workflow-state mutation by this producer. No unresolved decisions. Implementation desired state is ready; delivery planning is not ready until bounded definition revalidation.

All five domains require bounded revalidation: product for adopted Activity semantics, journeys/UX and coverage for changed flows, architecture/security only for new bounded predicates/scope/detail/export parity. Existing roles, secrets handling, storage, mutation timing, policy evaluation and atomic activation remain authoritative.

## Findings

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-054 | One Settings status and action footer | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High for source/intent | Settled | REC-RM-048 | Bounded |
| REC-055 | Credential cards distinguish configuration from stored values | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High for source/intent | Settled | REC-RM-049 | Bounded |
| REC-056 | One policy explanation and plain access actions | UX_SPEC_PROBLEM | MEDIUM | NOT_ATTEMPTED | High for source/intent | Settled | REC-RM-050 | Bounded |
| REC-057 | Shared bounded Activity comparison chips | NEW_REQUIREMENT | HIGH | NOT_ATTEMPTED | High for source/intent | Settled | REC-RM-051 | Bounded |
| REC-058 | Evidence exports live with their subject | UX_SPEC_PROBLEM | MEDIUM | NOT_ATTEMPTED | High for source/intent | Settled | REC-RM-052 | Bounded |

### REC-054 — One Settings status and action footer

Classification: UX_SPEC_GAP. Severity: MEDIUM. Confidence: high for source and settled direction. Reproduction: NOT_ATTEMPTED (source inspection and reported walkthrough; visible conformance unverified).

Evidence and feedback: [REPORTED] PO-FEEDBACK-2026-11-18-001, PO-FB-202, PO-FB-203. [REPOSITORY_EVIDENCED] src/consoleSettingsPage.ts: settings/footer, settingsDirtyStatus, saveSettingsForms. [DOCUMENTED] docs/web-console-prd.md: UX-02, CONFIG-03; UX-IA05/08, UX-IN01/02/05; J-OWNER-SETTINGS.

Current behavior/root layer: Current shared editor renders pending status at the top and actions/status at the bottom; per-form badges also exist. The prior contract lacks the now-required single persistent global bar.

Authoritative desired state: One white persistent bottom bar supplies status, Discard, Save for later and Review changes across authorized Settings editors; omit the duplicate top bar. Keep contextual errors/field states. Preserve all-form save, pending-versus-unsaved distinction, confirmation, current dependencies and atomic review.

Authority change: REC-CHANGE-054, smallest corresponding PRD paragraph; APPLIED_AFTER_DECISION. Confirmed directives establish only their precise selected scope. UX synthesis remains separate; no new product choice is inferred from observations or preferences. No decision remains.

Constraints: AUTHZ-02, AUDIT-03/04; STATE-01/02/03 preserve draft versus immediate boundaries; STATE-09/SECRES-08 preserve service clear/deletion; SMTP UX-EX03/SECRES-07 stays distinct. Activity retains bounded current-snapshot evidence, no storage/search persistence or new permission. No architecture/security conflict found; the new predicate/input boundary still needs targeted revalidation.

Potentially stale: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/manifest.yaml.

Implementation validation: Verify each populated Settings section and multiple forms; unchanged/unsaved/saved/error/unknown/read-only states; discard scope and no undo of immediate actions; keyboard focus and desktop/narrow/enlarged-text bar occlusion.

### REC-055 — Credential cards distinguish configuration from stored values

Classification: UX_SPEC_GAP. Severity: MEDIUM. Confidence: high for source and settled direction. Reproduction: NOT_ATTEMPTED (source inspection and reported walkthrough; visible conformance unverified).

Evidence and feedback: [REPORTED] PO-FEEDBACK-2026-11-18-001, PO-FB-204, PO-FB-205, PO-FB-206, PO-FB-207, PO-FB-208, PO-FB-209, PO-FB-210, PO-FB-211. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts: credentialMetadata, credentialActions, renderAuthentication, serviceSummaryCard; src/consolePeoplePage.ts: emailSettings. [DOCUMENTED] docs/web-console-prd.md: CONFIG-02, CONFIG-03; UX-IA03/06, UX-IN14/15, UX-EX03; J-OWNER-CONFIG/J-ADMIN-CONFIG.

Current behavior/root layer: Service fieldsets exist, but status says Value available/missing and configuration removal says Remove placement N. Add is after the cards in source; visible grouping difficulty is owner-reported, not independently reproduced. Immediate value Delete/Clear and draft placement removal are already distinct backend operations.

Authoritative desired state: Border each credential card, place a credential-named configuration-removal action in its card, and Add credential below all cards. Use Credential value set/not set across equivalent service metadata surfaces. Retain version/last-successful attribution, clearly distinguish draft reference removal from immediate stored-value action, and preserve service value dialogs. SMTP retains its explicit staged Set/Replace versus immediate dependency-blocked Clear exception.

Authority change: REC-CHANGE-055, smallest corresponding PRD paragraph; APPLIED_AFTER_DECISION. Confirmed directives establish only their precise selected scope. UX synthesis remains separate; no new product choice is inferred from observations or preferences. No decision remains.

Constraints: AUTHZ-02, AUDIT-03/04; STATE-01/02/03 preserve draft versus immediate boundaries; STATE-09/SECRES-08 preserve service clear/deletion; SMTP UX-EX03/SECRES-07 stays distinct. Activity retains bounded current-snapshot evidence, no storage/search persistence or new permission. No architecture/security conflict found; the new predicate/input boundary still needs targeted revalidation.

Potentially stale: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/manifest.yaml.

Implementation validation: Verify multiple/new/imported credentials, named configuration removal changes only draft, stored-value clear retains referenced key, read-only/no-auth states, missing-value cues, exact identifiers and metadata. Compare actual card boundaries/action hierarchy at desktop/narrow/enlarged text; no value reveal or change to SMTP timing.

### REC-056 — One policy explanation and plain access actions

Classification: UX_SPEC_PROBLEM. Severity: MEDIUM. Confidence: high for source and settled direction. Reproduction: NOT_ATTEMPTED (source inspection and reported walkthrough; visible conformance unverified).

Evidence and feedback: [REPORTED] PO-FEEDBACK-2026-11-18-001, PO-FB-212, PO-FB-213, PO-FB-214, PO-FB-215. [REPOSITORY_EVIDENCED] src/consoleServicePage.ts: renderPolicyRules, serviceAccessCard, serviceAccessDialog. [DOCUMENTED] docs/web-console-prd.md: POLICY-01, AUTHZ-02; UX-IN04/16 and UX-IA04; J-OWNER-CONFIG/J-ADMIN-CONFIG.

Current behavior/root layer: Existing rule explanations include disabled-direction/priority wording and access uses eligible-identity terminology. UX-IN16 explicitly requires explanation of unavailable directions, now superseded for that copy by the confirmed concise directive. Evaluation/eligibility semantics are already coherent.

Authoritative desired state: Default policy left and one bullet explanation box right, responsive stacking; preserve fallback, mixed effects, priority, deny ties and stable equal-priority/effect order. Reorder help is exactly the single requested sentence. Give access and Choose a user or client replace jargon without changing eligibility/confirmation.

Authority change: REC-CHANGE-056, smallest corresponding PRD paragraph; APPLIED_AFTER_DECISION. Confirmed directives establish only their precise selected scope. UX synthesis remains separate; no new product choice is inferred from observations or preferences. No decision remains.

Constraints: AUTHZ-02, AUDIT-03/04; STATE-01/02/03 preserve draft versus immediate boundaries; STATE-09/SECRES-08 preserve service clear/deletion; SMTP UX-EX03/SECRES-07 stays distinct. Activity retains bounded current-snapshot evidence, no storage/search persistence or new permission. No architecture/security conflict found; the new predicate/input boundary still needs targeted revalidation.

Potentially stale: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/manifest.yaml.

Implementation validation: Check both default modes, mixed effects/ties, disabled move controls, override indicators, initial versus immediate assignments, read-only/denied roles and accessible named controls. No policy-order or authorization changes.

### REC-057 — Shared bounded Activity comparison chips

Classification: NEW_REQUIREMENT. Severity: HIGH. Confidence: high for source and settled direction. Reproduction: NOT_ATTEMPTED (source inspection and reported walkthrough; visible conformance unverified).

Evidence and feedback: [REPORTED] PO-FEEDBACK-2026-11-18-001, PO-FB-216, PO-FB-217, PO-FB-218, PO-FB-219, PO-FB-220, PO-FB-221, PO-FB-222, PO-FB-223, PO-FB-224, PO-FB-225, PO-FB-226, PO-FB-227, PO-FB-228, PO-FB-229, PO-FB-230, PO-FB-231, PO-FB-232. [REPOSITORY_EVIDENCED] src/consoleEvidencePage.ts: activity, exportEvidence; src/consoleEvidence.ts: filters, select, detail, export; src/consoleHttp.ts: activity routes. [DOCUMENTED] docs/web-console-prd.md: AUDIT-02.a, AUDIT-02.b, AUDIT-03, AUDIT-04; UX-IA04 and UX-IN05; J-OWNER/ADMIN/AUDITOR/MEMBER-ACTIVITY.

Current behavior/root layer: Current filters accept one exact value per field. The per-service entry merely prepopulates service and Clear returns to global; this is not an existing hard scope. Server Member own-actor fencing and export prohibition, sanitization and bounded scans already exist. Rich repeated comparisons and explicit service context require a bounded contract.

Authoritative desired state: Apply AUDIT-02.a/b and the adopted AF01–06 derivation: OR positives within field AND every exclusion, AND fields/time/context; literal case-sensitive matching; missing positives false/negatives true; duplicates by field+value rejected in modal and server; 32-chip bound; fixed editable UTC presets. Search separates edits from successful criteria. Clear retains hard service/actor scope. Export uses successful searched criteria/offset against current bounded snapshot. Keep event presentation.

Authority change: REC-CHANGE-057, smallest corresponding PRD paragraph; APPLIED_AFTER_DECISION. Confirmed directives establish only their precise selected scope. UX synthesis remains separate; no new product choice is inferred from observations or preferences. No decision remains.

Constraints: AUTHZ-02, AUDIT-03/04; STATE-01/02/03 preserve draft versus immediate boundaries; STATE-09/SECRES-08 preserve service clear/deletion; SMTP UX-EX03/SECRES-07 stays distinct. Activity retains bounded current-snapshot evidence, no storage/search persistence or new permission. No architecture/security conflict found; the new predicate/input boundary still needs targeted revalidation.

Potentially stale: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/manifest.yaml, product/architecture/web-console-architecture-review.md, product/security/web-console-security-review.md.

Implementation validation: Truth-table positives/exclusions/mixed/cross-field/contradictory/order tests; literal/control/empty/oversize/32–33/duplicate/legacy inputs; inclusive/open/reversed times; scope on list/detail/export and Clear; Member exact denials/exclusions, forbidden exports/role loss/audit outage; edited/failed-search export parity; nested metadata sanitization, offset/truncation and bounded failure; actual shared modal/chips keyboard/narrow states.

### REC-058 — Evidence exports live with their subject

Classification: UX_SPEC_PROBLEM. Severity: MEDIUM. Confidence: high for source and settled direction. Reproduction: NOT_ATTEMPTED (source inspection and reported walkthrough; visible conformance unverified).

Evidence and feedback: [REPORTED] PO-FEEDBACK-2026-11-18-001, PO-FB-233, PO-FB-234, PO-FB-235, PO-FB-236, PO-FB-237. [REPOSITORY_EVIDENCED] src/consoleEvidencePage.ts: exportEvidence; src/consolePeoplePage.ts; src/consoleSettingsPage.ts; src/consoleOperationsPage.ts. [DOCUMENTED] docs/web-console-prd.md: AUDIT-02.b, AUDIT-03, AUTHZ-02; UX-IA03/04 and UX-IN05; Activity, People and Settings journeys.

Current behavior/root layer: All four evidence export actions currently render together in Activity. The old IA groups evidence with Activity; the confirmed destinations supersede that placement without removing exports.

Authoritative desired state: Only filtered Activity export remains beside the count. Access inventory goes in People & Access; configuration and exceptions in Settings → Configuration tools; software/job status in Settings → Health & retention. Preserve current evidence format, role reachability, current authorization/audit/sanitization. Do not confuse configuration evidence with gateway YAML transfer.

Authority change: REC-CHANGE-058, smallest corresponding PRD paragraph; APPLIED_AFTER_DECISION. Confirmed directives establish only their precise selected scope. UX synthesis remains separate; no new product choice is inferred from observations or preferences. No decision remains.

Constraints: AUTHZ-02, AUDIT-03/04; STATE-01/02/03 preserve draft versus immediate boundaries; STATE-09/SECRES-08 preserve service clear/deletion; SMTP UX-EX03/SECRES-07 stays distinct. Activity retains bounded current-snapshot evidence, no storage/search persistence or new permission. No architecture/security conflict found; the new predicate/input boundary still needs targeted revalidation.

Potentially stale: docs/web-console-prd-coverage.md, docs/web-console-prd-user-journey-audit.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/manifest.yaml, product/architecture/web-console-architecture-review.md, product/security/web-console-security-review.md.

Implementation validation: Owner/Administrator/Auditor reach unchanged permitted exports from their new locations; Member/restricted/degraded direct requests stay denied. Validate errors/downloads and clear evidence-versus-YAML labels, unsaved Settings navigation guards, keyboard and narrow layouts. No new export schema or permissions.

## Source changes

| Change | Finding | Target | Before → after | Status |
|---|---|---|---|---|
| REC-CHANGE-054 | REC-054; PO-FB-202–203 | docs/web-console-prd.md: UX-02, CONFIG-03 | Earlier incomplete/stale presentation or exact-only query → One Settings status and action footer | APPLIED_AFTER_DECISION |
| REC-CHANGE-055 | REC-055; PO-FB-204–211 | docs/web-console-prd.md: CONFIG-02, CONFIG-03 | Earlier incomplete/stale presentation or exact-only query → Credential cards distinguish configuration from stored values | APPLIED_AFTER_DECISION |
| REC-CHANGE-056 | REC-056; PO-FB-212–215 | docs/web-console-prd.md: POLICY-01, AUTHZ-02 | Earlier incomplete/stale presentation or exact-only query → One policy explanation and plain access actions | APPLIED_AFTER_DECISION |
| REC-CHANGE-057 | REC-057; PO-FB-216–232 | docs/web-console-prd.md: AUDIT-02.a, AUDIT-02.b, AUDIT-03, AUDIT-04 | Earlier incomplete/stale presentation or exact-only query → Shared bounded Activity comparison chips | APPLIED_AFTER_DECISION |
| REC-CHANGE-058 | REC-058; PO-FB-233–237 | docs/web-console-prd.md: AUDIT-02.b, AUDIT-03, AUTHZ-02 | Earlier incomplete/stale presentation or exact-only query → Evidence exports live with their subject | APPLIED_AFTER_DECISION |

Mutation gate: each paragraph follows confirmed authoritative directives, existing state/security constraints and delegated UX8-ACTIVITY-SEMANTICS derivation. [Activity basis](activity-filter-basis.md) preserves the specialist AF01–06 contract as provenance; canonical adopted requirements are AUDIT-02.a/b in the PRD. No preferences become additional scope. 220 silent duplicate and 223 global AND remain historical and are explicitly superseded by 221/222 and224. No other source edited.

## Resolved remediation backlog

Mode: CHANGE_PLAN. Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml). Delivery planning ready: false pending definition revalidation. Preservation baseline: fc458fe, completed UX7/M41–44; do not redo completed outcomes. Actors are existing authorized editors/readers, with Member Activity own-read only.

| Priority | Remediation | Outcome | Findings | Requirements | Dependencies | Validation |
|---|---|---|---|---|---|---|
| MEDIUM | REC-RM-048 | One Settings status and action footer | REC-054 | UX-02, CONFIG-03 | Adopted PRD and bounded definition validation | Positive, negative, preservation and browser evidence below |
| MEDIUM | REC-RM-049 | Credential cards distinguish configuration from stored values | REC-055 | CONFIG-02, CONFIG-03 | Adopted PRD and bounded definition validation | Positive, negative, preservation and browser evidence below |
| MEDIUM | REC-RM-050 | One policy explanation and plain access actions | REC-056 | POLICY-01, AUTHZ-02 | Adopted PRD and bounded definition validation | Positive, negative, preservation and browser evidence below |
| HIGH | REC-RM-051 | Shared bounded Activity comparison chips | REC-057 | AUDIT-02.a, AUDIT-02.b, AUDIT-03, AUDIT-04 | Adopted PRD and bounded definition validation | Positive, negative, preservation and browser evidence below |
| MEDIUM | REC-RM-052 | Evidence exports live with their subject | REC-058 | AUDIT-02.b, AUDIT-03, AUTHZ-02 | Adopted PRD and bounded definition validation | Positive, negative, preservation and browser evidence below |

### REC-RM-048 — One Settings status and action footer

Finding REC-054; source feedback PO-FB-202–203; authoritative basis REC-CHANGE-054, UX-02, CONFIG-03.

Current: Current shared editor renders pending status at the top and actions/status at the bottom; per-form badges also exist. The prior contract lacks the now-required single persistent global bar.

Required outcome and acceptance: One white persistent bottom bar supplies status, Discard, Save for later and Review changes across authorized Settings editors; omit the duplicate top bar. Keep contextual errors/field states. Preserve all-form save, pending-versus-unsaved distinction, confirmation, current dependencies and atomic review.

Required positive/negative/preservation validation: Verify each populated Settings section and multiple forms; unchanged/unsaved/saved/error/unknown/read-only states; discard scope and no undo of immediate actions; keyboard focus and desktop/narrow/enlarged-text bar occlusion.

Interfaces: src/consoleSettingsPage.ts: settings/footer, settingsDirtyStatus, saveSettingsForms. Preserve existing API consumers and exact stored values; Activity new inputs require server validation and compatibility. UX: current approved shared appearance plus derived scoped synthesis, keyboard focus and color-independent states; compare actual desktop/narrow/enlarged-text screenshots. Dependencies: canonical PRD, affected definition revalidation; no dependency on unresolved decisions. Exclusions: unrelated refactors, new roles or scopes, saved searches/autocomplete/query language, secret disclosure, credential lifecycle redesign, global result redesign, deployment and implementation in this transaction.

### REC-RM-049 — Credential cards distinguish configuration from stored values

Finding REC-055; source feedback PO-FB-204–211; authoritative basis REC-CHANGE-055, CONFIG-02, CONFIG-03.

Current: Service fieldsets exist, but status says Value available/missing and configuration removal says Remove placement N. Add is after the cards in source; visible grouping difficulty is owner-reported, not independently reproduced. Immediate value Delete/Clear and draft placement removal are already distinct backend operations.

Required outcome and acceptance: Border each credential card, place a credential-named configuration-removal action in its card, and Add credential below all cards. Use Credential value set/not set across equivalent service metadata surfaces. Retain version/last-successful attribution, clearly distinguish draft reference removal from immediate stored-value action, and preserve service value dialogs. SMTP retains its explicit staged Set/Replace versus immediate dependency-blocked Clear exception.

Required positive/negative/preservation validation: Verify multiple/new/imported credentials, named configuration removal changes only draft, stored-value clear retains referenced key, read-only/no-auth states, missing-value cues, exact identifiers and metadata. Compare actual card boundaries/action hierarchy at desktop/narrow/enlarged text; no value reveal or change to SMTP timing.

Interfaces: src/consoleServicePage.ts: credentialMetadata, credentialActions, renderAuthentication, serviceSummaryCard; src/consolePeoplePage.ts: emailSettings. Preserve existing API consumers and exact stored values; Activity new inputs require server validation and compatibility. UX: current approved shared appearance plus derived scoped synthesis, keyboard focus and color-independent states; compare actual desktop/narrow/enlarged-text screenshots. Dependencies: canonical PRD, affected definition revalidation; no dependency on unresolved decisions. Exclusions: unrelated refactors, new roles or scopes, saved searches/autocomplete/query language, secret disclosure, credential lifecycle redesign, global result redesign, deployment and implementation in this transaction.

### REC-RM-050 — One policy explanation and plain access actions

Finding REC-056; source feedback PO-FB-212–215; authoritative basis REC-CHANGE-056, POLICY-01, AUTHZ-02.

Current: Existing rule explanations include disabled-direction/priority wording and access uses eligible-identity terminology. UX-IN16 explicitly requires explanation of unavailable directions, now superseded for that copy by the confirmed concise directive. Evaluation/eligibility semantics are already coherent.

Required outcome and acceptance: Default policy left and one bullet explanation box right, responsive stacking; preserve fallback, mixed effects, priority, deny ties and stable equal-priority/effect order. Reorder help is exactly the single requested sentence. Give access and Choose a user or client replace jargon without changing eligibility/confirmation.

Required positive/negative/preservation validation: Check both default modes, mixed effects/ties, disabled move controls, override indicators, initial versus immediate assignments, read-only/denied roles and accessible named controls. No policy-order or authorization changes.

Interfaces: src/consoleServicePage.ts: renderPolicyRules, serviceAccessCard, serviceAccessDialog. Preserve existing API consumers and exact stored values; Activity new inputs require server validation and compatibility. UX: current approved shared appearance plus derived scoped synthesis, keyboard focus and color-independent states; compare actual desktop/narrow/enlarged-text screenshots. Dependencies: canonical PRD, affected definition revalidation; no dependency on unresolved decisions. Exclusions: unrelated refactors, new roles or scopes, saved searches/autocomplete/query language, secret disclosure, credential lifecycle redesign, global result redesign, deployment and implementation in this transaction.

### REC-RM-051 — Shared bounded Activity comparison chips

Finding REC-057; source feedback PO-FB-216–232; authoritative basis REC-CHANGE-057, AUDIT-02.a, AUDIT-02.b, AUDIT-03, AUDIT-04.

Current: Current filters accept one exact value per field. The per-service entry merely prepopulates service and Clear returns to global; this is not an existing hard scope. Server Member own-actor fencing and export prohibition, sanitization and bounded scans already exist. Rich repeated comparisons and explicit service context require a bounded contract.

Required outcome and acceptance: Apply AUDIT-02.a/b and the adopted AF01–06 derivation: OR positives within field AND every exclusion, AND fields/time/context; literal case-sensitive matching; missing positives false/negatives true; duplicates by field+value rejected in modal and server; 32-chip bound; fixed editable UTC presets. Search separates edits from successful criteria. Clear retains hard service/actor scope. Export uses successful searched criteria/offset against current bounded snapshot. Keep event presentation.

Required positive/negative/preservation validation: Truth-table positives/exclusions/mixed/cross-field/contradictory/order tests; literal/control/empty/oversize/32–33/duplicate/legacy inputs; inclusive/open/reversed times; scope on list/detail/export and Clear; Member exact denials/exclusions, forbidden exports/role loss/audit outage; edited/failed-search export parity; nested metadata sanitization, offset/truncation and bounded failure; actual shared modal/chips keyboard/narrow states.

Interfaces: src/consoleEvidencePage.ts: activity, exportEvidence; src/consoleEvidence.ts: filters, select, detail, export; src/consoleHttp.ts: activity routes. Preserve existing API consumers and exact stored values; Activity new inputs require server validation and compatibility. UX: current approved shared appearance plus derived scoped synthesis, keyboard focus and color-independent states; compare actual desktop/narrow/enlarged-text screenshots. Dependencies: canonical PRD, affected definition revalidation; no dependency on unresolved decisions. Exclusions: unrelated refactors, new roles or scopes, saved searches/autocomplete/query language, secret disclosure, credential lifecycle redesign, global result redesign, deployment and implementation in this transaction.

### REC-RM-052 — Evidence exports live with their subject

Finding REC-058; source feedback PO-FB-233–237; authoritative basis REC-CHANGE-058, AUDIT-02.b, AUDIT-03, AUTHZ-02.

Current: All four evidence export actions currently render together in Activity. The old IA groups evidence with Activity; the confirmed destinations supersede that placement without removing exports.

Required outcome and acceptance: Only filtered Activity export remains beside the count. Access inventory goes in People & Access; configuration and exceptions in Settings → Configuration tools; software/job status in Settings → Health & retention. Preserve current evidence format, role reachability, current authorization/audit/sanitization. Do not confuse configuration evidence with gateway YAML transfer.

Required positive/negative/preservation validation: Owner/Administrator/Auditor reach unchanged permitted exports from their new locations; Member/restricted/degraded direct requests stay denied. Validate errors/downloads and clear evidence-versus-YAML labels, unsaved Settings navigation guards, keyboard and narrow layouts. No new export schema or permissions.

Interfaces: src/consoleEvidencePage.ts: exportEvidence; src/consolePeoplePage.ts; src/consoleSettingsPage.ts; src/consoleOperationsPage.ts. Preserve existing API consumers and exact stored values; Activity new inputs require server validation and compatibility. UX: current approved shared appearance plus derived scoped synthesis, keyboard focus and color-independent states; compare actual desktop/narrow/enlarged-text screenshots. Dependencies: canonical PRD, affected definition revalidation; no dependency on unresolved decisions. Exclusions: unrelated refactors, new roles or scopes, saved searches/autocomplete/query language, secret disclosure, credential lifecycle redesign, global result redesign, deployment and implementation in this transaction.

## Impact and shared-pattern disposition

Settings scan includes all section renderers using the shared footer, not only a single example. Service credential scan includes guided edit, overview/read-only metadata, unused stored-key actions and service value dialog; SMTP inspected as a deliberate timing exception, not silently converted. Policy includes guided/create/edit and immediate Access view. Activity includes main/service/list/detail/export and the three destination surfaces. Existing result cards, sanitizer, role checks and bounded exports are preservation examples, not proof that new comparisons are already correct.

All items map below; exact original/normalized/class/authority/relationships are copied to canonical result. Empty traces for superseded items are deliberate, not omissions.

| Feedback | Finding | Change | Remediation | Disposition |
|---|---|---|---|---|
| PO-FB-202 | REC-054 | REC-CHANGE-054 | REC-RM-048 | EVIDENCE_CORRELATED |
| PO-FB-203 | REC-054 | REC-CHANGE-054 | REC-RM-048 | FULLY_RESOLVED |
| PO-FB-204 | REC-055 | REC-CHANGE-055 | REC-RM-049 | EVIDENCE_CORRELATED |
| PO-FB-205 | REC-055 | REC-CHANGE-055 | REC-RM-049 | FULLY_RESOLVED |
| PO-FB-206 | REC-055 | REC-CHANGE-055 | REC-RM-049 | ADVISORY_CONSIDERED |
| PO-FB-207 | REC-055 | REC-CHANGE-055 | REC-RM-049 | EVIDENCE_CORRELATED |
| PO-FB-208 | REC-055 | REC-CHANGE-055 | REC-RM-049 | FULLY_RESOLVED |
| PO-FB-209 | REC-055 | REC-CHANGE-055 | REC-RM-049 | FULLY_RESOLVED |
| PO-FB-210 | REC-055 | REC-CHANGE-055 | REC-RM-049 | EXPLORATORY_RECORDED |
| PO-FB-211 | REC-055 | REC-CHANGE-055 | REC-RM-049 | ADVISORY_CONSIDERED |
| PO-FB-212 | REC-056 | REC-CHANGE-056 | REC-RM-050 | FULLY_RESOLVED |
| PO-FB-213 | REC-056 | REC-CHANGE-056 | REC-RM-050 | EVIDENCE_CORRELATED |
| PO-FB-214 | REC-056 | REC-CHANGE-056 | REC-RM-050 | FULLY_RESOLVED |
| PO-FB-215 | REC-056 | REC-CHANGE-056 | REC-RM-050 | FULLY_RESOLVED |
| PO-FB-216 | REC-057 | REC-CHANGE-057 | REC-RM-051 | EVIDENCE_CORRELATED |
| PO-FB-217 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-218 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-219 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-220 | REC-057 | None (superseded) | None | NO_CHANGE_REQUIRED |
| PO-FB-221 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-222 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-223 | REC-057 | None (superseded) | None | NO_CHANGE_REQUIRED |
| PO-FB-224 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-225 | REC-057 | REC-CHANGE-057 | REC-RM-051 | EXPLORATORY_RECORDED |
| PO-FB-226 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-227 | REC-057 | REC-CHANGE-057 | REC-RM-051 | ADVISORY_CONSIDERED |
| PO-FB-228 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-229 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-230 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-231 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-232 | REC-057 | REC-CHANGE-057 | REC-RM-051 | FULLY_RESOLVED |
| PO-FB-233 | REC-058 | REC-CHANGE-058 | REC-RM-052 | EVIDENCE_CORRELATED |
| PO-FB-234 | REC-058 | REC-CHANGE-058 | REC-RM-052 | FULLY_RESOLVED |
| PO-FB-235 | REC-058 | REC-CHANGE-058 | REC-RM-052 | FULLY_RESOLVED |
| PO-FB-236 | REC-058 | REC-CHANGE-058 | REC-RM-052 | FULLY_RESOLVED |
| PO-FB-237 | REC-058 | REC-CHANGE-058 | REC-RM-052 | FULLY_RESOLVED |

## Decisions and limitations

No unresolved decisions. UX8-ACTIVITY-SEMANTICS resolves specialist derivation, not a new owner approval gate. All source claims are source-inspected or owner-reported; no live role/viewport/accessibility or runtime regression certification. Baseline evidence remains historical. Semantic desired-state resolution does not imply implementation passes. Next handoff category DEFINITION_REVALIDATION; next workflow product-definition-orchestrator.

## Publication and validation

Producer owns only this run and the five PRD amendments. Parent owns definition state/results/UX synthesis. Pre-existing dirty definition ledgers/history and unrelated passwd/session/test-results are excluded and were not read. Required package validator PASS. YAML parse, all 36 exact wording/class/authority/relationship dispositions, trace IDs and readiness invariants PASS. git diff --check PASS. No product tests were run for definition-only changes. Content revisions plus Git history resolve payload provenance; no self-referential SHA is invented.
