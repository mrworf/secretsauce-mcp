# Source changes

| Change | Findings | PO feedback | Target | Kind | Status | Decision | Impact |
|---|---|---|---|---|---|---|---|
| REC-CHANGE-020 | REC-020 | PO-FB-043, PO-FB-044, PO-FB-045, PO-FB-046, PO-FB-047, PO-FB-048, PO-FB-049 | docs/web-console-prd.md | adopted service contract | APPLIED_AFTER_DECISION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-020
Previous rule/behavior: List renders lifecycle and draft as plain text and an Open action. It lacks whole-row navigation and right-side requested lifecycle actions. Existing archive retains history; requested Delete is not yet specified against that lifecycle.
New rule: Corrected CONFIG-01–05, AUDIT-01, BACKUP-01 and MIGRATE-01/02 express the exact accepted outcome; the linked remediation acceptance makes it testable.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-021 | REC-021 | PO-FB-050, PO-FB-051, PO-FB-052, PO-FB-053, PO-FB-054, PO-FB-055, PO-FB-056, PO-FB-057, PO-FB-058, PO-FB-059 | product/ux/01-information-architecture.md | adopted service contract | NO_SOURCE_MUTATION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-021
Previous rule/behavior: Owner reports cryptic empty overview, redundant bars, one long configuration and visually merged rules. Code renders applied and draft summaries plus repeated controls; source inspection cannot establish exact visual severity.
New rule: Approved UX4 owns the service interaction change. This reconciler references that parent-owned synthesis and makes no mutation to it.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-022 | REC-022 | PO-FB-060 | docs/web-console-prd.md | adopted service contract | APPLIED_AFTER_DECISION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-022
Previous rule/behavior: ManagedCredential stores value/version/changed but no last-change actor; detail exposes time/version only. Current last-change metadata requirement does not settle legacy/restore actor display.
New rule: Corrected CONFIG-01–05, AUDIT-01, BACKUP-01 and MIGRATE-01/02 express the exact accepted outcome; the linked remediation acceptance makes it testable.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-023 | REC-023 | PO-FB-061, PO-FB-062, PO-FB-096, PO-FB-097, PO-FB-098 | docs/web-console-prd.md | adopted service contract | APPLIED_AFTER_DECISION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-023
Previous rule/behavior: Both configuration and wizard render password inputs inline and separate immediate buttons. Required-field context is confusing; the canonical credential card rule does not fully specify shared entry dialog state.
New rule: Corrected CONFIG-01–05, AUDIT-01, BACKUP-01 and MIGRATE-01/02 express the exact accepted outcome; the linked remediation acceptance makes it testable.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-024 | REC-024 | PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067 | docs/web-console-prd.md | adopted service contract | APPLIED_AFTER_DECISION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-024
Previous rule/behavior: CONFIG-02 forbids referenced credential deletion; credential() rejects applied or draft dependencies. New confirmed PO-FB-065/066 instead requires Delete to clear only the value while retaining an in-use key, and explain that consequence.
New rule: Corrected CONFIG-01–05, AUDIT-01, BACKUP-01 and MIGRATE-01/02 express the exact accepted outcome; the linked remediation acceptance makes it testable.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-025 | REC-025 | PO-FB-068, PO-FB-101 | product/ux/01-information-architecture.md | adopted service contract | NO_SOURCE_MUTATION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-025
Previous rule/behavior: Access shows assignments and grants only for an applied service; new-service checkboxes propose grants. Neither role ownership nor selecting oneself can resolve an import subject mapping. Owner reports that distinction is unclear.
New rule: Approved UX4 owns the service interaction change. This reconciler references that parent-owned synthesis and makes no mutation to it.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-026 | REC-026 | PO-FB-071, PO-FB-072, PO-FB-073, PO-FB-074, PO-FB-075, PO-FB-076, PO-FB-077, PO-FB-087, PO-FB-124 | docs/web-console-prd.md | adopted service contract | APPLIED_AFTER_DECISION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-026
Previous rule/behavior: renderEditor repeats Advanced editor (same draft) and heading; initial step list is inert. Existing-section tabs work but initial Back requires footer. Advanced editing covers the complete service.
New rule: Corrected CONFIG-01–05, AUDIT-01, BACKUP-01 and MIGRATE-01/02 express the exact accepted outcome; the linked remediation acceptance makes it testable.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-027 | REC-027 | PO-FB-078, PO-FB-079, PO-FB-080, PO-FB-089, PO-FB-090, PO-FB-091, PO-FB-092, PO-FB-093, PO-FB-094, PO-FB-095, PO-FB-102, PO-FB-103, PO-FB-105 | product/ux/01-information-architecture.md | adopted service contract | NO_SOURCE_MUTATION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-027
Previous rule/behavior: Labels/help exist in consolePresentation but Owner cannot understand prefix/suffix, generic placement, header ownership, host matching and policy reason/default. Existing help promises do not settle the refreshed composition and wording.
New rule: Approved UX4 owns the service interaction change. This reconciler references that parent-owned synthesis and makes no mutation to it.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-028 | REC-028 | PO-FB-082, PO-FB-083, PO-FB-084, PO-FB-085, PO-FB-086 | product/ux/01-information-architecture.md | adopted service contract | NO_SOURCE_MUTATION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-028
Previous rule/behavior: Current authority preserves service-default TLS and destination overrides, and stable identifiers. Nested advanced disclosure and ordinary identifier fields conflict with the requested simpler conditional exposure.
New rule: Approved UX4 owns the service interaction change. This reconciler references that parent-owned synthesis and makes no mutation to it.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-029 | REC-029 | PO-FB-099, PO-FB-100 | product/ux/01-information-architecture.md | adopted service contract | NO_SOURCE_MUTATION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-029
Previous rule/behavior: Add credential mutates draft then rebuilds editor with no insertion-focus/scroll step. Exact rendered jump is reported, not independently reproduced.
New rule: Approved UX4 owns the service interaction change. This reconciler references that parent-owned synthesis and makes no mutation to it.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-030 | REC-030 | PO-FB-104, PO-FB-106, PO-FB-107, PO-FB-108, PO-FB-109, PO-FB-110, PO-FB-117, PO-FB-118 | product/ux/01-information-architecture.md | adopted service contract | NO_SOURCE_MUTATION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-030
Previous rule/behavior: Always-visible Basic request rule precedes paragraph rules and repeated action labels; add methods are comma text while edit uses row list. Add and edit differ materially.
New rule: Approved UX4 owns the service interaction change. This reconciler references that parent-owned synthesis and makes no mutation to it.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-031 | REC-031 | PO-FB-111, PO-FB-112, PO-FB-115, PO-FB-120 | product/ux/01-information-architecture.md | adopted service contract | NO_SOURCE_MUTATION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-031
Previous rule/behavior: Service views do not update URL state; shared settings and tester leave editing context. Move earlier uses source index although display is priority sorted. User reports surprise unsaved prompt; no fresh browser reproduction was performed.
New rule: Approved UX4 owns the service interaction change. This reconciler references that parent-owned synthesis and makes no mutation to it.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-032 | REC-032 | PO-FB-116, PO-FB-119, PO-FB-121, PO-FB-122 | docs/web-console-prd.md | adopted service contract | APPLIED_AFTER_DECISION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-032
Previous rule/behavior: Import stores missingMappings; ordinary draft save retains it, review rejects generically and requires reimport; import result exposes only count. Selecting an account changes proposed grants but cannot resolve stored legacy subjects. UX-IA04 expressly permits correction in a draft.
New rule: Corrected CONFIG-01–05, AUDIT-01, BACKUP-01 and MIGRATE-01/02 express the exact accepted outcome; the linked remediation acceptance makes it testable.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.
| REC-CHANGE-034 | REC-034 | PO-FB-123 | product/ux/01-information-architecture.md | adopted service contract | NO_SOURCE_MUTATION | REC-DEC-008/009/010, UX-DESIGN-004 as applicable | selective definition revalidation |

## REC-CHANGE-034
Previous rule/behavior: Prior UX research covers general settings/account improvements; this feedback explicitly asks for established practices in service editing.
New rule: Approved UX4 owns the service interaction change. This reconciler references that parent-owned synthesis and makes no mutation to it.
Mutation gate: confirmed directives plus accepted independent specialist semantics and concrete UX approval remove consequential ambiguity; no new roles, purge, SMTP exception or configuration capability removal. Preserve stable requirement IDs. Application evidence: PRD diff and canonical source hashes; UX bytes are outside reconciliation commit ownership.

PRD-only auxiliary adoption under REC-CHANGE-022/024 covers AUDIT-01, BACKUP-01 and MIGRATE-02 coherent credential absence. CONFIG-03 explicitly separates immediate service operations from unchanged SMTP draft-based replacement/dependency-blocked deletion. No architecture/security source changed in this run.
