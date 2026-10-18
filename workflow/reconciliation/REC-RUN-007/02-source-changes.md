# Source changes

No authoritative source was mutated. The confirmed directives remain current intent; proposed specialist completion is not implementation authority. Preserving all old requirements unchanged here is deliberate pending resolution, not endorsement of contradictory old behavior.

| Change ID | Source findings | PO feedback | Target artifact | Change kind | Status | Decision | Semantic impact |
|---|---|---|---|---|---|---|---|
| REC-CHANGE-020 | REC-020 | PO-FB-043, PO-FB-044, PO-FB-045, PO-FB-046, PO-FB-047, PO-FB-048, PO-FB-049 | product/ux/01-information-architecture.md (UX-01, CONFIG-05) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009, REC-DEC-010 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-020
Previous rule/state: List renders lifecycle and draft as plain text and an Open action. It lacks whole-row navigation and right-side requested lifecycle actions. Existing archive retains history; requested Delete is not yet specified against that lifecycle.
Required direction (not completed specification): Represent active and pending draft independently; make rows navigable and provide confirmed lifecycle actions. Color bars are exploratory. Resolve Delete semantics without silently removing audit/history.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009, REC-DEC-010 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-021 | REC-021 | PO-FB-050, PO-FB-051, PO-FB-052, PO-FB-053, PO-FB-054, PO-FB-055, PO-FB-056, PO-FB-057, PO-FB-058, PO-FB-059 | product/ux/01-information-architecture.md (UX-02, UX-03, CONFIG-01) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-021
Previous rule/state: Owner reports cryptic empty overview, redundant bars, one long configuration and visually merged rules. Code renders applied and draft summaries plus repeated controls; source inspection cannot establish exact visual severity.
Required direction (not completed specification): Design understandable distinct service configuration sections and truthful empty/current/draft states. Preserve review/apply safety; do not simply delete bars based on an observation.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-022 | REC-022 | PO-FB-060 | docs/web-console-prd.md (CONFIG-02, AUDIT-01) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-008 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-022
Previous rule/state: ManagedCredential stores value/version/changed but no last-change actor; detail exposes time/version only. Current last-change metadata requirement does not settle legacy/restore actor display.
Required direction (not completed specification): Show who changed each credential alongside its change metadata. Resolve non-fabricated legacy, system/import and restored actor attribution; preserve write-only secrets.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-008 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-023 | REC-023 | PO-FB-061, PO-FB-062, PO-FB-096, PO-FB-097, PO-FB-098 | product/ux/01-information-architecture.md (CONFIG-02, UX-02, UX-04) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-023
Previous rule/state: Both configuration and wizard render password inputs inline and separate immediate buttons. Required-field context is confusing; the canonical credential card rule does not fully specify shared entry dialog state.
Required direction (not completed specification): Set/Replace opens a write-only Save/Cancel dialog in both locations; no inline secret input or reveal. Keep metadata associated with its credential and action-scoped validation.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-024 | REC-024 | PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067 | docs/web-console-prd.md (CONFIG-02, CONFIG-03, CONFIG-04) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-008 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-024
Previous rule/state: CONFIG-02 forbids referenced credential deletion; credential() rejects applied or draft dependencies. New confirmed PO-FB-065/066 instead requires Delete to clear only the value while retaining an in-use key, and explain that consequence.
Required direction (not completed specification): Required intent: Delete on an in-use credential clears its value, retains its key, and explains this before proceeding; only unreferenced keys may be deleted. Derive safe admission, revision, audit, persistence/restart and restore contracts. Do not extend this to SMTP.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-008 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-025 | REC-025 | PO-FB-068, PO-FB-101 | product/ux/01-information-architecture.md (AUTHZ-01, CONFIG-03) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-025
Previous rule/state: Access shows assignments and grants only for an applied service; new-service checkboxes propose grants. Neither role ownership nor selecting oneself can resolve an import subject mapping. Owner reports that distinction is unclear.
Required direction (not completed specification): Explain who can use the service and when assignments take effect; distinguish new proposed grants, current immediate access and imported subject mapping without changing permissions.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-026 | REC-026 | PO-FB-071, PO-FB-072, PO-FB-073, PO-FB-074, PO-FB-075, PO-FB-076, PO-FB-077, PO-FB-087, PO-FB-124 | product/ux/01-information-architecture.md (CONFIG-01, POLICY-02, UX-02) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-026
Previous rule/state: renderEditor repeats Advanced editor (same draft) and heading; initial step list is inert. Existing-section tabs work but initial Back requires footer. Advanced editing covers the complete service.
Required direction (not completed specification): Offer one global Guided/Advanced switch, clickable guided steps and no redundant selected-step heading or same-draft wording. Retain exact supported fields and unsaved work. Nested per-step advanced tabs were superseded exploratory placement, not required design.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-027 | REC-027 | PO-FB-078, PO-FB-079, PO-FB-080, PO-FB-089, PO-FB-090, PO-FB-091, PO-FB-092, PO-FB-093, PO-FB-094, PO-FB-095, PO-FB-102, PO-FB-103, PO-FB-105 | product/ux/01-information-architecture.md (UX-02, POLICY-01, BASE-01) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-027
Previous rule/state: Labels/help exist in consolePresentation but Owner cannot understand prefix/suffix, generic placement, header ownership, host matching and policy reason/default. Existing help promises do not settle the refreshed composition and wording.
Required direction (not completed specification): Explain docs as useful to an LLM; allowed destinations/matcher choices, literal prefix/value/suffix, header ownership, default allow/deny and rule reason. Show the lone placement field directly. Default allow does not prohibit allow rules: POLICY-01 still governs priorities and ties.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-028 | REC-028 | PO-FB-082, PO-FB-083, PO-FB-084, PO-FB-085, PO-FB-086 | product/ux/01-information-architecture.md (BASE-01, POLICY-02, POLICY-04) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-028
Previous rule/state: Current authority preserves service-default TLS and destination overrides, and stable identifiers. Nested advanced disclosure and ordinary identifier fields conflict with the requested simpler conditional exposure.
Required direction (not completed specification): Show service TLS default visibly and identify per-destination inheritance/override. Avoid nested disclosures. Hide identifiers in ordinary work only if system-only; service/destination identifiers used in MCP/import must remain accessible and unchanged. Focused advanced page is exploratory.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-029 | REC-029 | PO-FB-099, PO-FB-100 | product/ux/01-information-architecture.md (UX-03, UX-04) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-029
Previous rule/state: Add credential mutates draft then rebuilds editor with no insertion-focus/scroll step. Exact rendered jump is reported, not independently reproduced.
Required direction (not completed specification): After adding a credential, scroll to the new item with coherent keyboard focus; preserve safe existing work and viewport context.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-030 | REC-030 | PO-FB-104, PO-FB-106, PO-FB-107, PO-FB-108, PO-FB-109, PO-FB-110, PO-FB-117, PO-FB-118 | product/ux/01-information-architecture.md (POLICY-01, POLICY-02, BASE-01) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-030
Previous rule/state: Always-visible Basic request rule precedes paragraph rules and repeated action labels; add methods are comma text while edit uses row list. Add and edit differ materially.
Required direction (not completed specification): Show a recognizable list with Add/Edit/Delete; Add opens a modal; select methods from a list and keep row labels concise. Preserve imported/custom supported method values, rule priorities, exact regex and scanning controls. Hiding rule IDs is advisory, not authority to remove identifiers.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-031 | REC-031 | PO-FB-111, PO-FB-112, PO-FB-115, PO-FB-120 | product/ux/01-information-architecture.md (UX-03, POLICY-01, POLICY-03) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-031
Previous rule/state: Service views do not update URL state; shared settings and tester leave editing context. Move earlier uses source index although display is priority sorted. User reports surprise unsaved prompt; no fresh browser reproduction was performed.
Required direction (not completed specification): Specify reliable Back/Forward and return-to-edit context with honest unsaved state; explain shared-scope navigation and effective rule order. Do not infer a tester modal requirement or silently change priority/order.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
| REC-CHANGE-034 | REC-034 | PO-FB-123 | product/ux/01-information-architecture.md (UX-02, UX-04) | unresolved specification | NO_SOURCE_MUTATION | REC-DEC-009 | UX/journey; credential and lifecycle also product/architecture/security |

## REC-CHANGE-034
Previous rule/state: Prior UX research covers general settings/account improvements; this feedback explicitly asks for established practices in service editing.
Required direction (not completed specification): Research established service/configuration settings patterns and produce a concrete service proposal with visual and interaction evidence. Research is definition work, not a feature or permission to expand scope.
Mutation gate: no narrow separable canonical change is applied while REC-DEC-009 remains unresolved. Application evidence: none. Preserve stable requirements and exact literals; do not modify architecture/security in reconciliation.
