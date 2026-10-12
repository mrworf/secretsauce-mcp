# Findings

Current desired states are resolved. Original classes identify the root layer found in REC004/005; resolved does not mean implemented. Source investigation and exact evidence remain in immutable REC004/005. This run consumes approved UX3 rather than rerunning runtime tests.

| Finding | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|
| REC-008 | UX_SPEC_PROBLEM | MEDIUM | NOT_ATTEMPTED | High for authority/source | None | REC-RM-012 | Yes, derived authority |
| REC-009 | IMPLEMENTATION_DEFECT | MEDIUM | REPRODUCED | High for authority/source | None | REC-RM-008 | No from this finding |
| REC-010 | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High for authority/source | None | REC-RM-012 | Yes, derived authority |
| REC-011 | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High for authority/source | None | REC-RM-013 | Yes, derived authority |
| REC-012 | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High for authority/source | None | REC-RM-009 | Yes, derived authority |
| REC-013 | PRODUCT_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High for authority/source | None | REC-RM-010 | Yes, derived authority |
| REC-014 | PRODUCT_SPEC_GAP | HIGH | NOT_ATTEMPTED | High for authority/source | None | REC-RM-011 | Yes, derived authority |
| REC-015 | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High for authority/source | None | REC-RM-007 | No from this finding |
| REC-016 | UX_SPEC_PROBLEM | MEDIUM | NOT_ATTEMPTED | High for authority/source | None | REC-RM-014 | Yes, derived authority |
| REC-017 | EXPECTED_BEHAVIOR | MEDIUM | NOT_ATTEMPTED | High for authority/source | None | None | No from this finding |
| REC-018 | EXPECTED_BEHAVIOR | MEDIUM | NOT_ATTEMPTED | High for authority/source | None | None | No from this finding |

### REC-008

Classification: UX_SPEC_PROBLEM
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-008. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-015, PO-FB-016, PO-FB-017, PO-FB-029.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-008; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: UX-IA08 names Secret detection with immediate explanation of returned service data and best-effort scope; UX-R05 uses wider desktop composition and responsive account/form layout. UX-V05 requires material visual fidelity.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: UX_SPEC_PROBLEM, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: UX-IA08 names Secret detection with immediate explanation of returned service data and best-effort scope; UX-R05 uses wider desktop composition and responsive account/form layout. UX-V05 requires material visual fidelity.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-012.
Affected definition domains: product false; user_journeys/ux/architecture/security true for bounded derived revalidation.
Potentially stale artifacts: coverage, journeys and architecture/security review paths enumerated in canonical change_impact.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-009

Classification: IMPLEMENTATION_DEFECT
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: REPRODUCED (UX-VIS-F001, inherited six synthetic captures)
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-009. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-018.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-009; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: Keep wizard numbers and labels distinct without overlap at desktop/narrow/enlarged text under UX-R01 and UX-IN11; retain all steps.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: IMPLEMENTATION_DEFECT, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: Keep wizard numbers and labels distinct without overlap at desktop/narrow/enlarged text under UX-R01 and UX-IN11; retain all steps.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-008.
Affected definition domains: all false for this independent finding.
Potentially stale artifacts: None from this finding.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-010

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-010. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-019, PO-FB-020, PO-FB-021, PO-FB-022.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-010; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: UX-IN11 requires mandatory-field asterisk, adjacent * Required legend and programmatic semantics; short associated help explains non-obvious fields. Conditional rules follow actual mode.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: UX_SPEC_GAP, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: UX-IN11 requires mandatory-field asterisk, adjacent * Required legend and programmatic semantics; short associated help explains non-obvious fields. Conditional rules follow actual mode.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-012.
Affected definition domains: product false; user_journeys/ux/architecture/security true for bounded derived revalidation.
Potentially stale artifacts: coverage, journeys and architecture/security review paths enumerated in canonical change_impact.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-011

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-011. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-023, PO-FB-024.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-011; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: UX-IA07 establishes one row per human account and a keyboard-accessible link to a full account detail page, preserving return/filter context and current permission controls.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: UX_SPEC_GAP, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: UX-IA07 establishes one row per human account and a keyboard-accessible link to a full account detail page, preserving return/filter context and current permission controls.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-013.
Affected definition domains: product false; user_journeys/ux/architecture/security true for bounded derived revalidation.
Potentially stale artifacts: coverage, journeys and architecture/security review paths enumerated in canonical change_impact.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-012

Classification: PRODUCT_SPEC_PROBLEM
Severity: HIGH
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-012. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-025.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-012; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: Preserve adopted IDENT-02B / SECRES-06 bounded Administrator contact/role editing with immediate authority revocation; UX-IN12 supplies its approved confirmation/detail expression.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: PRODUCT_SPEC_PROBLEM, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: Preserve adopted IDENT-02B / SECRES-06 bounded Administrator contact/role editing with immediate authority revocation; UX-IN12 supplies its approved confirmation/detail expression.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-009.
Affected definition domains: product false; user_journeys/ux/architecture/security true for bounded derived revalidation.
Potentially stale artifacts: coverage, journeys and architecture/security review paths enumerated in canonical change_impact.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-013

Classification: PRODUCT_SPEC_GAP
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-013. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-026, PO-FB-027.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-013; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: Preserve IDENT-02A / STATE-07 event and persistence semantics; UX-IN12 shows read-only Created and Last console sign-in, timezone and truthful Never/Unknown/Not applicable/restored provenance.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: PRODUCT_SPEC_GAP, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: Preserve IDENT-02A / STATE-07 event and persistence semantics; UX-IN12 shows read-only Created and Last console sign-in, timezone and truthful Never/Unknown/Not applicable/restored provenance.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-010.
Affected definition domains: product false; user_journeys/ux/architecture/security true for bounded derived revalidation.
Potentially stale artifacts: coverage, journeys and architecture/security review paths enumerated in canonical change_impact.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-014

Classification: PRODUCT_SPEC_GAP
Severity: HIGH
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-014. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-030, PO-FB-031.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-014; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: Preserve IDENT-04 / SECRES-07 / STATE-08 TLS default or acknowledged None; UX-IN13 populates non-secret fields, keeps password blank and tests applied settings, requiring pending changes to be applied first.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: PRODUCT_SPEC_GAP, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: Preserve IDENT-04 / SECRES-07 / STATE-08 TLS default or acknowledged None; UX-IN13 populates non-secret fields, keeps password blank and tests applied settings, requiring pending changes to be applied first.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-011.
Affected definition domains: product false; user_journeys/ux/architecture/security true for bounded derived revalidation.
Potentially stale artifacts: coverage, journeys and architecture/security review paths enumerated in canonical change_impact.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-015

Classification: IMPLEMENTATION_DEFECT
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-015. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-032.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-015; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: UX-IA08 / UX-C34 distinguishes loading, unconfigured, unavailable and read errors; no undefined sentinel or fabricated defaults.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: IMPLEMENTATION_DEFECT, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: UX-IA08 / UX-C34 distinguishes loading, unconfigured, unavailable and read errors; no undefined sentinel or fabricated defaults.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-007.
Affected definition domains: all false for this independent finding.
Potentially stale artifacts: None from this finding.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-016

Classification: UX_SPEC_PROBLEM
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-016. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-033, PO-FB-035, PO-FB-036, PO-FB-037, PO-FB-038, PO-FB-039, PO-FB-041.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-016; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: UX-IA05 / UX-IN10 opens populated forms, separates Unsaved / Saved for later · Not in use yet / In use, uses Review changes to validate/save then full review and atomic Apply; backup/diagnostics refresh actual current revision and cleanup outcomes separately.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: UX_SPEC_PROBLEM, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: UX-IA05 / UX-IN10 opens populated forms, separates Unsaved / Saved for later · Not in use yet / In use, uses Review changes to validate/save then full review and atomic Apply; backup/diagnostics refresh actual current revision and cleanup outcomes separately.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: REC-RM-014.
Affected definition domains: product false; user_journeys/ux/architecture/security true for bounded derived revalidation.
Potentially stale artifacts: coverage, journeys and architecture/security review paths enumerated in canonical change_impact.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-017

Classification: EXPECTED_BEHAVIOR
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-017. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-028, PO-FB-040.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-017; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: Research request completed; primary-source note informs approved UX3 without inventing universal settings rules.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: EXPECTED_BEHAVIOR, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: Research request completed; primary-source note informs approved UX3 without inventing universal settings rules.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: No; aligned research or preserved write-only behavior.
Affected definition domains: all false for this independent finding.
Potentially stale artifacts: None from this finding.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.

### REC-018

Classification: EXPECTED_BEHAVIOR
Severity: MEDIUM
Confidence: High for authoritative desired state and recorded evidence; untested current implementation is not accepted.
Reproduction: NOT_ATTEMPTED in this transaction
Evidence: DOCUMENTED approved UX-DESIGN-003, web-console-ux-3 and adopted PRD; REPOSITORY_EVIDENCED baseline preserved in REC005 finding REC-018. REC009 adds OBSERVED UX-VIS-F001; other owner experiences retain REPORTED status where no runtime reproduction exists.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-034.
Current observed behavior and relevant implementation: unchanged M18–21 implementation described in ../REC-RUN-005/01-findings.md#rec-018; no code changes or new runtime acceptance claimed.
Relevant UX / product / architecture / security rule: Keep SMTP stored passwords write-only under UX-IN01/13 and SECRES-07; blank unchanged replacement retains only permitted existing value under version fencing.
Relevant journeys: service configuration J-OWNER-CONFIG/J-ADMIN-CONFIG; account J-OWNER-PEOPLE and expanded Administrator detail; settings J-OWNER-SETTINGS. Derived journeys require refresh against these rules.
Root source of inconsistency: EXPECTED_BEHAVIOR, retained from earlier investigation; approved authority now settles the remaining direction without reclassifying old code as correct.
Authoritative desired state: Keep SMTP stored passwords write-only under UX-IN01/13 and SECRES-07; blank unchanged replacement retains only permitted existing value under version fencing.
Authoritative artifact requiring change: None in this transaction; consumed UX3/PRD changes belong to root's definition transaction.
Changed automatically: No.
Decision required: No.
Implementation remediation required: No; aligned research or preserved write-only behavior.
Affected definition domains: all false for this independent finding.
Potentially stale artifacts: None from this finding.
Implementation validation: applicable REC-RM criteria plus UX-C34–42; compare matching-state implementation screenshots against approved concept hashes, fix material divergence or explicitly accept scoped exceptions. Functional tests alone do not demonstrate visual conformance.
