# REC-RUN-015 — Confirmed UX10 feedback reconciliation

Generated: 2026-11-19 UTC. Invocation: product-definition-orchestrator; originating stage: product. Inspected revision: d29f412f4587f2338dbc03b99231d179fb5f33cd. Status: RESOLVED; implementation ready: true; delivery planning ready: false; handoff: DEFINITION_REVALIDATION → product-definition-orchestrator. Six findings: two UX_SPEC_GAP, one each PRODUCT_SPEC_PROBLEM, NEW_REQUIREMENT, IMPLEMENTATION_DEFECT and UX_SPEC_PROBLEM; six NOT_ATTEMPTED reproductions. Six applied narrow source changes, no proposed changes.

## Scope and decision

All 17 confirmed PO-FB-265–281 items have dispositions. Six bounded outcomes are resolved; no owner question remains. This is source reconciliation, not implementation or runtime acceptance. The current user explicitly confirmed both destructive meanings with “yes to both”; the producer-owned deletion basis supplies D10-01–05 safety derivation. No new roles, authentication flows, vault, purge system or backup-retention exception is introduced.

## Evidence and authority

Read canonical feedback, current PRD, UX9 manifest/interaction/responsive patterns, STATE-09/10, SECRES-08/09 and affected source. `src/consoleServicePage.ts` removes a credential reference without a dialog, has generic Overview navigation, and renders credential labels; `src/consoleServices.ts` applies configuration without intended-value cleanup and only archives services. `src/consolePresentation.ts` supplies the repeated generic password help. `src/consolePage.ts` preserves distinct recovery-code sign-in and factor replacement. `src/consoleSettingsPage.ts` builds section content in the outer content container before reparenting after awaits, explaining the reported layout transition. These source facts establish the bounded remediation surfaces; reported visual states are not newly runtime-certified.

## Explicit supersession and preservation

CONFIG-02's unconditional promise that configuration removal never clears its value is superseded only by reviewed, intentional, unreferenced-on-Apply deletion. Immediate credential Clear/Delete and SMTP timing exceptions remain unchanged. CONFIG-05's archive-only Delete promise remains for non-archived services; a distinct permanent action for Archived services is added. Saved-draft-only removal requires persistent intent, not an applied-only diff or broad orphan sweep. Current and historical copies are distinct: ordinary retained backups remain and explicit restore keeps its existing contract. UX-IN20's link/retained-value rule and UX-IN23's generic setup shortcut are stale derivative guidance requiring bounded refresh.

Login preference PO-FB-272 is advisory and is considered through existing UX-R05 compact short-input guidance; PO-FB-274 exploration resolves by clarifying the existing replacement task, not deleting recovery capability. No preference is silently promoted to independent owner mandate. Settings stability is already required by UX-IN05/UX-R04; PRD clarification makes the reported temporal behavior explicit without redesign.

## Findings, source corrections and remediation

| Finding | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Revalidation |
|---|---|---|---|---|---|---|---|
| REC-064 | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High | None | Required | Yes |
| REC-065 | NEW_REQUIREMENT | HIGH | NOT_ATTEMPTED | High | None | Required | Yes |
| REC-066 | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High | None | Required | Yes |
| REC-067 | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High | None | Required | Yes |
| REC-068 | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High | None | Required | No independent semantic gate |
| REC-069 | UX_SPEC_PROBLEM | LOW | NOT_ATTEMPTED | High | None | Required | Yes |

Shared trace: [REPORTED] confirmed feedback; [REPOSITORY_EVIDENCED] source surfaces in Evidence and authority; [DOCUMENTED] PRD/UX/STATE/SECRES clauses. Journey authority: `docs/web-console-prd-user-journey-audit.md`, service configuration/review/lifecycle, sign-in and Settings journeys; the new deletion branches require supplementation, not a claim that those branches already exist. Current behavior and first inconsistent layers are established in Evidence and authority and Explicit supersession: REC-064/065 change the product contract, REC-066/067 need shared presentation details, REC-068 violates existing stable loading layout, REC-069 supersedes the prior redundant shortcut pattern. No runtime visual certification is implied.

Architecture/security basis for REC-064/065: D10-01–05 and current STATE-09/10, SECRES-08/09; other findings preserve the existing contracts without new security semantics. Affected domains for 064/065: product false, journeys/UX/architecture/security true. For 066/067/069: product false, journeys/UX true, architecture/security false. For 068: all definition domains false apart from the shared editorial clarification; no independent revalidation loop. The aggregate remains as recorded in the canonical result.


### REC-064 — Credential removal and Apply-coupled value deletion

Primary classification: **PRODUCT_SPEC_PROBLEM**. Severity: **HIGH**. Status: RESOLVED desired state; implementation remains. Evidence: confirmed PO-FB-266, PO-FB-267, PO-FB-268, PO-FB-269, PO-FB-270, current source inspection, and requirements CONFIG-02, CONFIG-03. Reproduction: NOT_ATTEMPTED; no new runtime finding or visual acceptance asserted.

Source correction REC-CHANGE-064: narrow PRD adoption; existing authority is preserved except the explicitly superseded behavior below. Remediation **REC-RM-058**: implement the adopted credential removal and apply-coupled value deletion contract, preserving unrelated capabilities and current permissions. Validation: Exercise applied and saved-draft-only removal, repeated save/reopen, Guided/Advanced parity, remove/re-add, cancel/discard, remaining-reference and unrelated-orphan retention; stale replacement/reference, role/CSRF, missing-value/no-auth, write/audit uncertainty, restart/old-reader and explicit restore fences.

### REC-065 — Archived service permanent deletion

Primary classification: **NEW_REQUIREMENT**. Severity: **HIGH**. Status: RESOLVED desired state; implementation remains. Evidence: confirmed PO-FB-279, PO-FB-280, PO-FB-281, current source inspection, and requirements CONFIG-05, CONFIG-04. Reproduction: NOT_ATTEMPTED; no new runtime finding or visual acceptance asserted.

Source correction REC-CHANGE-065: narrow PRD adoption; existing authority is preserved except the explicitly superseded behavior below. Remediation **REC-RM-059**: implement the adopted archived service permanent deletion contract, preserving unrelated capabilities and current permissions. Validation: Exercise correct/wrong/cancel typed confirmation, Archived-only and role/CSRF enforcement, changed/deleted/recreated target, other-service preservation, current-value removal, queued/reference/history fencing, unknown outcomes, restart and explicit restore.

### REC-066 — Distinct non-blocking no-access warning

Primary classification: **UX_SPEC_GAP**. Severity: **MEDIUM**. Status: RESOLVED desired state; implementation remains. Evidence: confirmed PO-FB-265, current source inspection, and requirements UX-03, CONFIG-01. Reproduction: NOT_ATTEMPTED; no new runtime finding or visual acceptance asserted.

Source correction REC-CHANGE-066: narrow PRD adoption; existing authority is preserved except the explicitly superseded behavior below. Remediation **REC-RM-060**: implement the adopted distinct non-blocking no-access warning contract, preserving unrelated capabilities and current permissions. Validation: Verify distinct accessible warning with zero grants, valid review/Apply still allowed, no security acknowledgment and no execution until explicit assignment.

### REC-067 — Compact sign-in and shared credential copy

Primary classification: **UX_SPEC_GAP**. Severity: **MEDIUM**. Status: RESOLVED desired state; implementation remains. Evidence: confirmed PO-FB-271, PO-FB-272, PO-FB-273, PO-FB-274, PO-FB-275, current source inspection, and requirements UX-02, IDENT-02. Reproduction: NOT_ATTEMPTED; no new runtime finding or visual acceptance asserted.

Source correction REC-CHANGE-067: narrow PRD adoption; existing authority is preserved except the explicitly superseded behavior below. Remediation **REC-RM-061**: implement the adopted compact sign-in and shared credential copy contract, preserving unrelated capabilities and current permissions. Validation: Inspect sign-in desktop/narrow/enlarged text, distinct recovery-code sign-in and Replace authenticator task; preserve existing recovery proofs and flows. Verify generic sentence absent across shared password decorators while write-only state and task-specific help remain.

### REC-068 — Stable Settings section rendering

Primary classification: **IMPLEMENTATION_DEFECT**. Severity: **MEDIUM**. Status: RESOLVED desired state; implementation remains. Evidence: confirmed PO-FB-276, PO-FB-277, current source inspection, and requirements UX-02. Reproduction: NOT_ATTEMPTED; no new runtime finding or visual acceptance asserted.

Source correction REC-CHANGE-068: narrow PRD adoption; existing authority is preserved except the explicitly superseded behavior below. Remediation **REC-RM-062**: implement the adopted stable settings section rendering contract, preserving unrelated capabilities and current permissions. Validation: Observe loading and populated section transitions under delay; navigation and content retain layout with no below-rail transient mount. Preserve all forms/guards and narrow layout.

### REC-069 — Remove redundant Overview navigation actions

Primary classification: **UX_SPEC_PROBLEM**. Severity: **LOW**. Status: RESOLVED desired state; implementation remains. Evidence: confirmed PO-FB-278, current source inspection, and requirements UX-01. Reproduction: NOT_ATTEMPTED; no new runtime finding or visual acceptance asserted.

Source correction REC-CHANGE-069: narrow PRD adoption; existing authority is preserved except the explicitly superseded behavior below. Remediation **REC-RM-063**: implement the adopted remove redundant overview navigation actions contract, preserving unrelated capabilities and current permissions. Validation: Verify no Overview control merely duplicates Configuration navigation; actual review and targeted blocker/fix actions remain reachable with existing dirty guards.

## Impact and handoff

Product direction is settled and narrowly adopted: product domain false (no further discovery). Journeys, UX, architecture and security true for stale dependent maps, shared appearance/copy and the new atomic deletion/incarnation contract. Coverage must include both destructive paths and negative role/dependency/uncertainty boundaries. Targeted definition revalidation is required before delivery planning. Existing implementation remains unchanged; all six remediation outcomes are outstanding. Exact feedback dispositions, provenance and affected paths are in reconciliation-result.yaml.

## Source change index

All target `docs/web-console-prd.md`; actual diff is application evidence. Previous/new rules are detailed in Explicit supersession and in each associated requirement. Confirmed directives supply exact decisions; D10 derives safeguards without introducing owner choices. Shared compact-login and task copy derive existing UX-R05/UX-02. REC-CHANGE-068 is an automatic clarification of existing UX-IN05/UX-R04, not conformance with defective code.

| Change | Finding | Feedback | Requirements | Status | Semantic impact |
|---|---|---|---|---|---|
| REC-CHANGE-064 | REC-064 | PO-FB-266, PO-FB-267, PO-FB-268, PO-FB-269, PO-FB-270 | CONFIG-02, CONFIG-03 | APPLIED_AFTER_DECISION | Associated resolved outcome above |
| REC-CHANGE-065 | REC-065 | PO-FB-279, PO-FB-280, PO-FB-281 | CONFIG-05, CONFIG-04 | APPLIED_AFTER_DECISION | Associated resolved outcome above |
| REC-CHANGE-066 | REC-066 | PO-FB-265 | UX-03, CONFIG-01 | APPLIED_AFTER_DECISION | Associated resolved outcome above |
| REC-CHANGE-067 | REC-067 | PO-FB-271, PO-FB-272, PO-FB-273, PO-FB-274, PO-FB-275 | UX-02, IDENT-02 | APPLIED_AFTER_DECISION | Associated resolved outcome above |
| REC-CHANGE-068 | REC-068 | PO-FB-276, PO-FB-277 | UX-02 | APPLIED_AUTOMATICALLY | Associated resolved outcome above |
| REC-CHANGE-069 | REC-069 | PO-FB-278 | UX-01 | APPLIED_AFTER_DECISION | Associated resolved outcome above |

## Resolved remediation backlog

Mode: CHANGE_PLAN. Implementation authority: amended PRD requirements and REC-CHANGE-064–069; D10 basis preserves derivation. Preservation baseline: d29f412, completed UX9/M47–48. Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml). Delivery planning ready: false pending targeted definition revalidation.

| Priority | Remediation | Outcome/finding | Dependencies | Validation |
|---|---|---|---|---|
| HIGH | REC-RM-058 | Credential removal / REC-064 | Amended CONFIG-02/03; shared incarnation fences with RM-059 | Detailed positive/negative checks above and D10-05 |
| HIGH | REC-RM-059 | Archived permanent deletion / REC-065 | Amended CONFIG-05; shared incarnation fences with RM-058 | Detailed positive/negative checks above and D10-05 |
| MEDIUM | REC-RM-060 | No-access advisory / REC-066 | Amended UX-03 | Empty grants valid; accessible distinct indicator |
| MEDIUM | REC-RM-061 | Login/credential copy / REC-067 | Amended UX-02, inherited UX-R05 | Existing recovery flows preserved; responsive screenshots |
| MEDIUM | REC-RM-062 | Stable Settings layout / REC-068 | Existing UX-IN05/R04 and clarified UX-02 | Delayed section load and dirty-form guards |
| LOW | REC-RM-063 | Overview action deduplication / REC-069 | Amended UX-01 | Preserve actual review and fix actions |

Roles/interfaces: RM-058/059 affect Owner/Administrator service UI and authenticated direct mutation APIs/state; Member/Auditor and restricted sessions remain denied. RM-060/063 affect permitted service viewers/editors without altering access. RM-061 covers existing public sign-in/recovery and authorized credential forms. RM-062 covers existing Settings editors/read-only viewers. Shared acceptance for every item: deliver its named positive outcome, retain existing permission/invalid/unknown safeguards, preserve exact settings and unaffected paths, and compare actual scoped desktop/narrow/enlarged-text browser states with current approved shared appearance. Destructive items additionally require each D10-05 state/compatibility boundary; source revalidation does not substitute for those implementation tests. Exclusions for all: no deployment, new recovery flow, bulk purge, orphan collector, archive erasure, new vault or broad redesign. No sibling remediation requires a particular slice/milestone order.

## Observation impact map

All items are TRACED; no partially traced or untraced evidence. Exact original wording, class, authority and clarifications are preserved in YAML. Potentially stale paths are exact in the canonical impact map; domains follow the per-finding grouping above.

| Feedback | Finding | Source change | Remediation | Decision | Trace |
|---|---|---|---|---|---|
| PO-FB-265 | REC-066 | REC-CHANGE-066 | REC-RM-060 | None | TRACED |
| PO-FB-266 | REC-064 | REC-CHANGE-064 | REC-RM-058 | None | TRACED |
| PO-FB-267 | REC-064 | REC-CHANGE-064 | REC-RM-058 | None | TRACED |
| PO-FB-268 | REC-064 | REC-CHANGE-064 | REC-RM-058 | None | TRACED |
| PO-FB-269 | REC-064 | REC-CHANGE-064 | REC-RM-058 | None | TRACED |
| PO-FB-270 | REC-064 | REC-CHANGE-064 | REC-RM-058 | None | TRACED |
| PO-FB-271 | REC-067 | REC-CHANGE-067 | REC-RM-061 | None | TRACED |
| PO-FB-272 | REC-067 | REC-CHANGE-067 | REC-RM-061 | None | TRACED |
| PO-FB-273 | REC-067 | REC-CHANGE-067 | REC-RM-061 | None | TRACED |
| PO-FB-274 | REC-067 | REC-CHANGE-067 | REC-RM-061 | None | TRACED |
| PO-FB-275 | REC-067 | REC-CHANGE-067 | REC-RM-061 | None | TRACED |
| PO-FB-276 | REC-068 | REC-CHANGE-068 | REC-RM-062 | None | TRACED |
| PO-FB-277 | REC-068 | REC-CHANGE-068 | REC-RM-062 | None | TRACED |
| PO-FB-278 | REC-069 | REC-CHANGE-069 | REC-RM-063 | None | TRACED |
| PO-FB-279 | REC-065 | REC-CHANGE-065 | REC-RM-059 | None | TRACED |
| PO-FB-280 | REC-065 | REC-CHANGE-065 | REC-RM-059 | None | TRACED |
| PO-FB-281 | REC-065 | REC-CHANGE-065 | REC-RM-059 | None | TRACED |

## Decisions required

No unresolved decisions. Both destructive directions were explicitly confirmed; safeguard derivation and inherited shared patterns settle the bounded remaining details.
