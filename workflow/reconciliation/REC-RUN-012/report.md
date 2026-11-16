# REC-RUN-012 — approved Settings navigation continuation

Generated: 2026-11-16. Product: secretsauce-mcp. Invocation: product-definition-orchestrator, continuation of committed REC-RUN-011. Implementation remains 6810fe32ab0c461946a78751be82b7c21fedecd7. This is definition evidence, not runtime acceptance.

## Summary

**RESOLVED** desired state: all twelve findings, all 53 original feedback items. Ten previously eligible remediation outcomes are preserved; two newly approved navigation outcomes complete REC-050. There are no unresolved decisions. Implementation is required and its desired state is ready; delivery planning is **not ready** until bounded definition revalidation.

Approval: “Agreed, do both” resolves REC-DEC-011/012 under UX-DESIGN-006. [Approval basis](approval-basis.md) preserves the exact bounded contract, original proposal hash and provenance without treating original optional suggestions as directives. Feedback classes and exact original/normalized text are unchanged.

No canonical product/UX, architecture/security, implementation or workflow state was changed by this producer. Canonical UX7 synthesis is saved (UX-IA11, UX-IN19, UX-R09, UX-V09, UX-A10, UX-C69–71); publication belongs to the definition transaction. This run resolves approved intent and requires coverage/journey/UX propagation. Architecture/security boundaries and product semantics remain valid; no new permissions, timing, persistence or data transfer format is introduced.

## Findings and preserved evidence

The eleven independently resolved findings REC-042–049 and REC-051–053 retain their exact classifications, evidence, source changes and desired states from [REC011 findings](../REC-RUN-011/01-findings.md), [source changes](../REC-RUN-011/02-source-changes.md) and [shared-pattern analysis](../REC-RUN-011/04-impact-map.md). REC011 producer payload is 2cda731ec976d53be6167846544e1bb1d6db141b. This continuation does not manufacture new runtime reproduction.

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-050 | Settings organization and search | UX_SPEC_PROBLEM | MEDIUM | PARTIALLY_REPRODUCED | High for approved intent; bounded runtime | REC-DEC-011/012 accepted | REC-RM-046/047 | journeys, UX; affected coverage |

### REC-050 — approved desired state

Evidence: [OBSERVED] UX-AUDIT-2026-11-16-001 F001 records search disclosure and affected Settings surfaces. [REPORTED] feedback003 PO-FB-181–184/199–201. [REPOSITORY_EVIDENCED] src/consoleSettingsPage.ts and src/consoleOperations.ts retain long disclosure groups/footer search. [DOCUMENTED] UX-IA03/06/08 and UX-02 establish grouped configuration, exact preserved values, search and guarded navigation. [DOCUMENTED] accepted UX-DESIGN-006 now selects the bounded five-category Limits and search-dialog proposal.

Root source: missing settled design direction for two optional navigation mechanisms in REC011, now resolved by explicit approval. This remains UX_SPEC_PROBLEM; no claim that old implementation violated an unapproved proposal.

Desired state: five exact existing Limits categories, one visible; persistent Search settings opens the focused guarded role-scoped search dialog, as recorded in approval-basis.md. Keep existing supported settings, exact values, status/error semantics and approved visual language. Adjacent heading repetition was already bounded by shared orientation rules in REC011; this approval does not remove meaningful page names.

Relevant journey: existing Settings editing, review, search and cross-section correction. Relevant product: UX-02, UX-03, CONFIG-03. Relevant UX: current UX-IA06/08 and canonical synthesis of accepted UX-DESIGN-006. Architecture/security: STATE-01/03, SECRES-07/08, mandatory audit and UX-EX03. SMTP Set/Replace remains draft/review/apply and independent Clear remains dependency-checked immediate action; navigation changes none of that.

Authority edits by this producer: none. Canonical UX changes are owned separately; current exact revisions are linked in result source when available. Derived definition revalidation remains mandatory. Impact: product false, journeys true, UX true, architecture false, security false. Potentially stale: coverage, journey audit, UX manifest/acceptance. Implementation validation: actual desktop/narrow screenshots, browser history, guarded unsaved work, read-only roles, keyboard/focus, index-loading races and precise error routing.

## Source changes

No new canonical authority mutation by this run. REC-CHANGE-042/044–048/051–053 remain the committed changes from REC011. New accepted decisions resolve REC-050; [approval-basis.md](approval-basis.md) records exact intent. UX7 synthesis and its publication remain owned by the definition transaction, not absorbed into reconciliation.

## Resolved remediation backlog

Mode: CHANGE_PLAN. Delivery planning ready: false. Preservation baseline: committed REC011 canonical corrections, approved UX6 appearance and unchanged implementation6810fe3; accepted UX-DESIGN006 adds only the bounded navigation delta. Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml).

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| HIGH/MEDIUM | REC-RM-034–040,043–045 | Ten settled outcomes preserved exactly | REC-042–048,051–053 | Existing named requirements in REC011 | Bounded definition validation | Existing detailed acceptance contracts |
| MEDIUM | REC-RM-046 | Focused Limits categories | REC-050 | UX-02, UX-03, CONFIG-03; UX-DESIGN006 | Canonical synthesis/revalidation | All categories, guards, history, exact values and roles |
| MEDIUM | REC-RM-047 | Discoverable guarded Settings search | REC-050 | UX-IA03/06/08; UX-DESIGN006 | Canonical synthesis/revalidation | Loading/query race, role scope, focus, cancellation, correction links |

The ten preserved items are authoritative by exact reference to [REC011 backlog](../REC-RUN-011/03-remediation-backlog.md); all their positive/negative/preservation criteria remain required. They do not depend on approval again.

### REC-RM-046 — focused Limits categories

Priority: MEDIUM. Source: REC-050, PO-FB-181/182/183, accepted REC-DEC-011. Authority: UX-02 and accepted UX-DESIGN006; approval-basis.md. Owner edits; authorized Administrator/Auditor reads retain equivalent hierarchy. Member gains no access.

Current: repeated expandable groups make Limits hard to scan. Required: Requests & responses; References & retained state; HTTP & authentication; Scanner capacity; Regex workers. Show one category at a time through ordinary navigation, with labeled select on narrow screens. Preserve fixed boundary explanation and all exact supported fields.

Acceptance:
1. Every existing Limits field remains reachable in its correct category with populated current/pending values, units and local errors; no lossy migration or new semantic knob.
2. Continue browser Back/Forward/deep links and restore selected location without silent save/apply/discard. Cross-category unsaved handling preserves every form and uses existing guard; errors focus the actual field/category.
3. Review still commits only through existing full-scope atomic application, current authorization, dependency and audit checks. Read-only roles have no mutation affordances; expired/changed roles do not leak editable state.
4. Match approved proposal appearance at desktop and narrow widths; check keyboard, visible selection, enlarged text, wrapping and meaningful page naming.

Interfaces: Settings UI and routing; unchanged limits schema/API. Dependencies: canonical UX synthesis and bounded definition validation. Exclusions: capacity/default changes, backend redesign, blanket accordion removal, new permissions. Validation: focused browser cases for each category and unsaved/error/history paths; exact-value preservation and existing full-scope Settings tests.

### REC-RM-047 — discoverable guarded Settings search

Priority: MEDIUM. Source: REC-050, PO-FB-199/200/201, accepted REC-DEC-012. Authority: existing search scope and accepted UX-DESIGN006; approval-basis.md.

Current: search is below main content in a disclosure. Required: persistent Search settings above navigation opens a focused named dialog with query and result links. Results include authorized labels/help/aliases only. Selection closes search, invokes existing dirty guard, navigates to correct section/category and focuses the field/read-only value. Cancellation returns focus to the trigger.

Acceptance:
1. Loading, empty results and load failure are distinct; a query entered during asynchronous index load is replayed when ready. Clearing/editing query never submits or activates settings.
2. No secret value or unauthorized destination is indexed/revealed. Existing role-scoped search and direct correction links remain; read-only users receive readable target focus.
3. No stacked search/dirty dialogs. Stay retains original work/location; Save/Discard use existing precise semantics. Cancel/Escape before admission changes nothing. Unknown save results require state resolution, never guessed success or automatic retry.
4. Dialog has accessible name, bounded focus, keyboard operability and restored focus. Match approved desktop/narrow layout and enlarged-text reflow.

Interfaces: Settings search UI/index and guarded navigation; no new persistence or APIs implied. Dependencies: canonical UX synthesis and bounded definition validation. Exclusions: global product search, secret-content search, new permissions and auto-save. Validation: positive/negative role/query/load/cancellation/focus tests plus browser navigation and exact work preservation.

## Impact and dispositions

All 53 feedback dispositions in the canonical result copy original wording, class, confirmation and authority from the confirmed package. REC011's complete item-to-finding/source/remediation map remains applicable; only PO-FB-181–183 and199–201 now link approved REC-RM-046/047 with no open decision. PO-FB-184's bounded heading correction remains REC011, not a third approval.

Shared-pattern analysis and SMTP research remain [REC011 specialist basis](../REC-RUN-011/06-specialist-basis.md). Service validation/progression, Settings comparison/visibility, SMTP/service credential differences, backup-hour selection and accessible orientation are preserved. Neither new navigation pattern globalizes approval timing or removes advanced capabilities elsewhere.

## Decisions and evidence limitations

No unresolved decisions. UX-DESIGN006 and REC-DEC-011/012 accepted by “Agreed, do both”. Audit remains INCOMPLETE_COVERAGE (16/19 states,14/17 journeys). Import mapping, absent SMTP and broader accessibility require impacted delivery qualification; no unseen state is certified. New prototype screenshots demonstrate approved direction, not runtime acceptance.

Handoff: DEFINITION_REVALIDATION to product-definition-orchestrator. Delivery readiness remains false until exact canonical synthesis and dependent coverage/journey/UX validation are published.
