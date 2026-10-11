# Reconciliation findings

Current source fingerprints in canonical result. Implementation evidence is unchanged source inspection from REC-RUN-001; no runtime reproduction. Historical root classifications remain stable after correcting their authority layer. RESOLVED means desired behavior is settled, not software fixed.

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-001 | Separate assisted password reset | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High source/authority | None | REC-RM-003 | Bounded combined impact below |
| REC-002 | Separate assisted Authenticator reset | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High source/authority | None | REC-RM-003 | Bounded combined impact below |
| REC-003 | Visible exclusive current navigation | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High source/authority | None | REC-RM-001 | Bounded combined impact below |
| REC-004 | Focused Settings sections | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High source/authority | None | REC-RM-005 | Bounded combined impact below |
| REC-005 | Friendly configuration controls and summaries | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High source/authority | None | REC-RM-006 | Bounded combined impact below |
| REC-006 | Independent SMTP credential deletion | PRODUCT_SPEC_GAP | HIGH | NOT_ATTEMPTED | High source/authority | None | REC-RM-004 | Bounded combined impact below |
| REC-007 | Guided legacy YAML import | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High source/authority | None | REC-RM-002 | Bounded combined impact below |

## REC-001: Separate assisted password reset

Classification: PRODUCT_SPEC_PROBLEM; severity: HIGH; confidence: High for source/authority; reproduction: NOT_ATTEMPTED.
Evidence: DOCUMENTED — IDENT-05, SECRES-05, UX-IN08, current PRD and approved web-console-ux-2; REPOSITORY_EVIDENCED — src/consolePeople.ts; src/consolePeoplePage.ts; REPORTED — PO-FEEDBACK-2026-10-11-001 PO-FB-001, PO-FB-002. Exact original wording, authority and provenance remain canonical.
Current observed behavior / relevant implementation: prior source behavior remains unchanged; see [original evidence](../REC-RUN-001/01-findings.md) and [adopted reset/deletion evidence](../REC-RUN-002/01-findings.md). No runtime behavior is newly asserted.
Relevant UX rule: IDENT-05, SECRES-05, UX-IN08 and product/ux/01-information-architecture.md, 02-interaction-patterns.md, 07-acceptance-checklist.md.
Relevant journey: docs/web-console-prd-user-journey-audit.md, recovery/settings/configuration/import scoped journeys; bounded IA input compatibility passed against exact current approved UX.
Relevant product requirement: docs/web-console-prd.md, IDENT-05, SECRES-05, UX-IN08.
Architecture/security constraints: product/security/web-console-security-contract.md SECRES-01/03/04/05 and product/architecture/web-console-state-contract.md STATE-01/02/03; preserve current authorization, audit, secret handling and atomic scope. Final bounded cross-domain review remains.
Root source of inconsistency: historical root in REC-RUN-001 preserved. Current authority is sufficient: reset/deletion PRD adoption is validated; UX-IA05 supplies formerly missing focused Settings semantics, and UX-IA06 supplies complete friendly capability coverage. No implementation was changed to eliminate observed drift.
Authoritative desired state: Separate assisted password reset exactly under IDENT-05, SECRES-05, UX-IN08; complete observable behavior and positive/negative acceptance in REC-RM-003.
Authoritative artifact requiring change: None by this run.
Changed automatically: No.
Decision required: No. REC-DEC-001/002/003 and UX-DESIGN-002 are resolved.
Implementation remediation required: REC-RM-003.
Affected definition domains: product false; ux false against current exact PRD/UX PASS. Journey/coverage compatibility now passes exact inputs; only aggregate architecture/security review remain true; see impact map. Navigation alone still needs implementation acceptance, not definition redesign.
Potentially stale artifacts: aggregate canonical list; scope to applicable review/derived boundaries rather than all product authority.
Implementation validation: REC-RM-003 and UX-C26–33 where applicable; positive/negative permission, error, concurrency, preservation and actual HTTPS browser evidence. Definition approval does not claim runtime conformance.


## REC-002: Separate assisted Authenticator reset

Classification: PRODUCT_SPEC_PROBLEM; severity: HIGH; confidence: High for source/authority; reproduction: NOT_ATTEMPTED.
Evidence: DOCUMENTED — AUTHZ-03, IDENT-05, SECRES-05, UX-IN08, current PRD and approved web-console-ux-2; REPOSITORY_EVIDENCED — src/consolePeople.ts; src/consolePeoplePage.ts; REPORTED — PO-FEEDBACK-2026-10-11-001 PO-FB-003, PO-FB-004. Exact original wording, authority and provenance remain canonical.
Current observed behavior / relevant implementation: prior source behavior remains unchanged; see [original evidence](../REC-RUN-001/01-findings.md) and [adopted reset/deletion evidence](../REC-RUN-002/01-findings.md). No runtime behavior is newly asserted.
Relevant UX rule: AUTHZ-03, IDENT-05, SECRES-05, UX-IN08 and product/ux/01-information-architecture.md, 02-interaction-patterns.md, 07-acceptance-checklist.md.
Relevant journey: docs/web-console-prd-user-journey-audit.md, recovery/settings/configuration/import scoped journeys; bounded IA input compatibility passed against exact current approved UX.
Relevant product requirement: docs/web-console-prd.md, AUTHZ-03, IDENT-05, SECRES-05, UX-IN08.
Architecture/security constraints: product/security/web-console-security-contract.md SECRES-01/03/04/05 and product/architecture/web-console-state-contract.md STATE-01/02/03; preserve current authorization, audit, secret handling and atomic scope. Final bounded cross-domain review remains.
Root source of inconsistency: historical root in REC-RUN-001 preserved. Current authority is sufficient: reset/deletion PRD adoption is validated; UX-IA05 supplies formerly missing focused Settings semantics, and UX-IA06 supplies complete friendly capability coverage. No implementation was changed to eliminate observed drift.
Authoritative desired state: Separate assisted Authenticator reset exactly under AUTHZ-03, IDENT-05, SECRES-05, UX-IN08; complete observable behavior and positive/negative acceptance in REC-RM-003.
Authoritative artifact requiring change: None by this run.
Changed automatically: No.
Decision required: No. REC-DEC-001/002/003 and UX-DESIGN-002 are resolved.
Implementation remediation required: REC-RM-003.
Affected definition domains: product false; ux false against current exact PRD/UX PASS. Journey/coverage compatibility now passes exact inputs; only aggregate architecture/security review remain true; see impact map. Navigation alone still needs implementation acceptance, not definition redesign.
Potentially stale artifacts: aggregate canonical list; scope to applicable review/derived boundaries rather than all product authority.
Implementation validation: REC-RM-003 and UX-C26–33 where applicable; positive/negative permission, error, concurrency, preservation and actual HTTPS browser evidence. Definition approval does not claim runtime conformance.


## REC-003: Visible exclusive current navigation

Classification: IMPLEMENTATION_DEFECT; severity: MEDIUM; confidence: High for source/authority; reproduction: NOT_ATTEMPTED.
Evidence: DOCUMENTED — UX-IA01, UX-V04, UX-A05, current PRD and approved web-console-ux-2; REPOSITORY_EVIDENCED — src/consolePage.ts; src/consolePeoplePage.ts; src/consoleServicePage.ts; REPORTED — PO-FEEDBACK-2026-10-11-001 PO-FB-005, PO-FB-006. Exact original wording, authority and provenance remain canonical.
Current observed behavior / relevant implementation: prior source behavior remains unchanged; see [original evidence](../REC-RUN-001/01-findings.md) and [adopted reset/deletion evidence](../REC-RUN-002/01-findings.md). No runtime behavior is newly asserted.
Relevant UX rule: UX-IA01, UX-V04, UX-A05 and product/ux/01-information-architecture.md, 02-interaction-patterns.md, 07-acceptance-checklist.md.
Relevant journey: docs/web-console-prd-user-journey-audit.md, recovery/settings/configuration/import scoped journeys; bounded IA input compatibility passed against exact current approved UX.
Relevant product requirement: docs/web-console-prd.md, UX-IA01, UX-V04, UX-A05.
Architecture/security constraints: product/security/web-console-security-contract.md SECRES-01/03/04/05 and product/architecture/web-console-state-contract.md STATE-01/02/03; preserve current authorization, audit, secret handling and atomic scope. Final bounded cross-domain review remains.
Root source of inconsistency: historical root in REC-RUN-001 preserved. Current authority is sufficient: reset/deletion PRD adoption is validated; UX-IA05 supplies formerly missing focused Settings semantics, and UX-IA06 supplies complete friendly capability coverage. No implementation was changed to eliminate observed drift.
Authoritative desired state: Visible exclusive current navigation exactly under UX-IA01, UX-V04, UX-A05; complete observable behavior and positive/negative acceptance in REC-RM-001.
Authoritative artifact requiring change: None by this run.
Changed automatically: No.
Decision required: No. REC-DEC-001/002/003 and UX-DESIGN-002 are resolved.
Implementation remediation required: REC-RM-001.
Affected definition domains: product false; ux false against current exact PRD/UX PASS. Journey/coverage compatibility now passes exact inputs; only aggregate architecture/security review remain true; see impact map. Navigation alone still needs implementation acceptance, not definition redesign.
Potentially stale artifacts: aggregate canonical list; scope to applicable review/derived boundaries rather than all product authority.
Implementation validation: REC-RM-001 and UX-C26–33 where applicable; positive/negative permission, error, concurrency, preservation and actual HTTPS browser evidence. Definition approval does not claim runtime conformance.


## REC-004: Focused Settings sections

Classification: UX_SPEC_GAP; severity: MEDIUM; confidence: High for source/authority; reproduction: NOT_ATTEMPTED.
Evidence: DOCUMENTED — UX-02, UX-IA05, UX-R04, UX-C26/27, current PRD and approved web-console-ux-2; REPOSITORY_EVIDENCED — src/consolePeoplePage.ts:22; REPORTED — PO-FEEDBACK-2026-10-11-001 PO-FB-007, PO-FB-008, PO-FB-009. Exact original wording, authority and provenance remain canonical.
Current observed behavior / relevant implementation: prior source behavior remains unchanged; see [original evidence](../REC-RUN-001/01-findings.md) and [adopted reset/deletion evidence](../REC-RUN-002/01-findings.md). No runtime behavior is newly asserted.
Relevant UX rule: UX-02, UX-IA05, UX-R04, UX-C26/27 and product/ux/01-information-architecture.md, 02-interaction-patterns.md, 07-acceptance-checklist.md.
Relevant journey: docs/web-console-prd-user-journey-audit.md, recovery/settings/configuration/import scoped journeys; bounded IA input compatibility passed against exact current approved UX.
Relevant product requirement: docs/web-console-prd.md, UX-02, UX-IA05, UX-R04, UX-C26/27.
Architecture/security constraints: product/security/web-console-security-contract.md SECRES-01/03/04/05 and product/architecture/web-console-state-contract.md STATE-01/02/03; preserve current authorization, audit, secret handling and atomic scope. Final bounded cross-domain review remains.
Root source of inconsistency: historical root in REC-RUN-001 preserved. Current authority is sufficient: reset/deletion PRD adoption is validated; UX-IA05 supplies formerly missing focused Settings semantics, and UX-IA06 supplies complete friendly capability coverage. No implementation was changed to eliminate observed drift.
Authoritative desired state: Focused Settings sections exactly under UX-02, UX-IA05, UX-R04, UX-C26/27; complete observable behavior and positive/negative acceptance in REC-RM-005.
Authoritative artifact requiring change: None by this run.
Changed automatically: No.
Decision required: No. REC-DEC-001/002/003 and UX-DESIGN-002 are resolved.
Implementation remediation required: REC-RM-005.
Affected definition domains: product false; ux false against current exact PRD/UX PASS. Journey/coverage compatibility now passes exact inputs; only aggregate architecture/security review remain true; see impact map. Navigation alone still needs implementation acceptance, not definition redesign.
Potentially stale artifacts: aggregate canonical list; scope to applicable review/derived boundaries rather than all product authority.
Implementation validation: REC-RM-005 and UX-C26–33 where applicable; positive/negative permission, error, concurrency, preservation and actual HTTPS browser evidence. Definition approval does not claim runtime conformance.


## REC-005: Friendly configuration controls and summaries

Classification: IMPLEMENTATION_DEFECT; severity: MEDIUM; confidence: High for source/authority; reproduction: NOT_ATTEMPTED.
Evidence: DOCUMENTED — UX-02, UX-IA06, UX-C28, current PRD and approved web-console-ux-2; REPOSITORY_EVIDENCED — src/consoleServicePage.ts:42; src/consolePeoplePage.ts:22–23; REPORTED — PO-FEEDBACK-2026-10-11-001 PO-FB-010, PO-FB-011. Exact original wording, authority and provenance remain canonical.
Current observed behavior / relevant implementation: prior source behavior remains unchanged; see [original evidence](../REC-RUN-001/01-findings.md) and [adopted reset/deletion evidence](../REC-RUN-002/01-findings.md). No runtime behavior is newly asserted.
Relevant UX rule: UX-02, UX-IA06, UX-C28 and product/ux/01-information-architecture.md, 02-interaction-patterns.md, 07-acceptance-checklist.md.
Relevant journey: docs/web-console-prd-user-journey-audit.md, recovery/settings/configuration/import scoped journeys; bounded IA input compatibility passed against exact current approved UX.
Relevant product requirement: docs/web-console-prd.md, UX-02, UX-IA06, UX-C28.
Architecture/security constraints: product/security/web-console-security-contract.md SECRES-01/03/04/05 and product/architecture/web-console-state-contract.md STATE-01/02/03; preserve current authorization, audit, secret handling and atomic scope. Final bounded cross-domain review remains.
Root source of inconsistency: historical root in REC-RUN-001 preserved. Current authority is sufficient: reset/deletion PRD adoption is validated; UX-IA05 supplies formerly missing focused Settings semantics, and UX-IA06 supplies complete friendly capability coverage. No implementation was changed to eliminate observed drift.
Authoritative desired state: Friendly configuration controls and summaries exactly under UX-02, UX-IA06, UX-C28; complete observable behavior and positive/negative acceptance in REC-RM-006.
Authoritative artifact requiring change: None by this run.
Changed automatically: No.
Decision required: No. REC-DEC-001/002/003 and UX-DESIGN-002 are resolved.
Implementation remediation required: REC-RM-006.
Affected definition domains: product false; ux false against current exact PRD/UX PASS. Journey/coverage compatibility now passes exact inputs; only aggregate architecture/security review remain true; see impact map. Navigation alone still needs implementation acceptance, not definition redesign.
Potentially stale artifacts: aggregate canonical list; scope to applicable review/derived boundaries rather than all product authority.
Implementation validation: REC-RM-006 and UX-C26–33 where applicable; positive/negative permission, error, concurrency, preservation and actual HTTPS browser evidence. Definition approval does not claim runtime conformance.


## REC-006: Independent SMTP credential deletion

Classification: PRODUCT_SPEC_GAP; severity: HIGH; confidence: High for source/authority; reproduction: NOT_ATTEMPTED.
Evidence: DOCUMENTED — IDENT-04, CONFIG-03/04, STATE-01/02/03, UX-IN09, current PRD and approved web-console-ux-2; REPOSITORY_EVIDENCED — src/consoleNotifications.ts:111–112; src/consolePeoplePage.ts:23; REPORTED — PO-FEEDBACK-2026-10-11-001 PO-FB-012, PO-FB-013. Exact original wording, authority and provenance remain canonical.
Current observed behavior / relevant implementation: prior source behavior remains unchanged; see [original evidence](../REC-RUN-001/01-findings.md) and [adopted reset/deletion evidence](../REC-RUN-002/01-findings.md). No runtime behavior is newly asserted.
Relevant UX rule: IDENT-04, CONFIG-03/04, STATE-01/02/03, UX-IN09 and product/ux/01-information-architecture.md, 02-interaction-patterns.md, 07-acceptance-checklist.md.
Relevant journey: docs/web-console-prd-user-journey-audit.md, recovery/settings/configuration/import scoped journeys; bounded IA input compatibility passed against exact current approved UX.
Relevant product requirement: docs/web-console-prd.md, IDENT-04, CONFIG-03/04, STATE-01/02/03, UX-IN09.
Architecture/security constraints: product/security/web-console-security-contract.md SECRES-01/03/04/05 and product/architecture/web-console-state-contract.md STATE-01/02/03; preserve current authorization, audit, secret handling and atomic scope. Final bounded cross-domain review remains.
Root source of inconsistency: historical root in REC-RUN-001 preserved. Current authority is sufficient: reset/deletion PRD adoption is validated; UX-IA05 supplies formerly missing focused Settings semantics, and UX-IA06 supplies complete friendly capability coverage. No implementation was changed to eliminate observed drift.
Authoritative desired state: Independent SMTP credential deletion exactly under IDENT-04, CONFIG-03/04, STATE-01/02/03, UX-IN09; complete observable behavior and positive/negative acceptance in REC-RM-004.
Authoritative artifact requiring change: None by this run.
Changed automatically: No.
Decision required: No. REC-DEC-001/002/003 and UX-DESIGN-002 are resolved.
Implementation remediation required: REC-RM-004.
Affected definition domains: product false; ux false against current exact PRD/UX PASS. Journey/coverage compatibility now passes exact inputs; only aggregate architecture/security review remain true; see impact map. Navigation alone still needs implementation acceptance, not definition redesign.
Potentially stale artifacts: aggregate canonical list; scope to applicable review/derived boundaries rather than all product authority.
Implementation validation: REC-RM-004 and UX-C26–33 where applicable; positive/negative permission, error, concurrency, preservation and actual HTTPS browser evidence. Definition approval does not claim runtime conformance.


## REC-007: Guided legacy YAML import

Classification: IMPLEMENTATION_DEFECT; severity: MEDIUM; confidence: High for source/authority; reproduction: NOT_ATTEMPTED.
Evidence: DOCUMENTED — MIGRATE-01/02/03/04, UX-IA04/06, UX-C33, current PRD and approved web-console-ux-2; REPOSITORY_EVIDENCED — src/consoleMigration.ts; src/consoleServicePage.ts:23,40–41; test/console-migration.test.ts; REPORTED — PO-FEEDBACK-2026-10-11-001 PO-FB-014. Exact original wording, authority and provenance remain canonical.
Current observed behavior / relevant implementation: prior source behavior remains unchanged; see [original evidence](../REC-RUN-001/01-findings.md) and [adopted reset/deletion evidence](../REC-RUN-002/01-findings.md). No runtime behavior is newly asserted.
Relevant UX rule: MIGRATE-01/02/03/04, UX-IA04/06, UX-C33 and product/ux/01-information-architecture.md, 02-interaction-patterns.md, 07-acceptance-checklist.md.
Relevant journey: docs/web-console-prd-user-journey-audit.md, recovery/settings/configuration/import scoped journeys; bounded IA input compatibility passed against exact current approved UX.
Relevant product requirement: docs/web-console-prd.md, MIGRATE-01/02/03/04, UX-IA04/06, UX-C33.
Architecture/security constraints: product/security/web-console-security-contract.md SECRES-01/03/04/05 and product/architecture/web-console-state-contract.md STATE-01/02/03; preserve current authorization, audit, secret handling and atomic scope. Final bounded cross-domain review remains.
Root source of inconsistency: historical root in REC-RUN-001 preserved. Current authority is sufficient: reset/deletion PRD adoption is validated; UX-IA05 supplies formerly missing focused Settings semantics, and UX-IA06 supplies complete friendly capability coverage. No implementation was changed to eliminate observed drift.
Authoritative desired state: Guided legacy YAML import exactly under MIGRATE-01/02/03/04, UX-IA04/06, UX-C33; complete observable behavior and positive/negative acceptance in REC-RM-002.
Authoritative artifact requiring change: None by this run.
Changed automatically: No.
Decision required: No. REC-DEC-001/002/003 and UX-DESIGN-002 are resolved.
Implementation remediation required: REC-RM-002.
Affected definition domains: product false; ux false against current exact PRD/UX PASS. Journey/coverage compatibility now passes exact inputs; only aggregate architecture/security review remain true; see impact map. Navigation alone still needs implementation acceptance, not definition redesign.
Potentially stale artifacts: aggregate canonical list; scope to applicable review/derived boundaries rather than all product authority.
Implementation validation: REC-RM-002 and UX-C26–33 where applicable; positive/negative permission, error, concurrency, preservation and actual HTTPS browser evidence. Definition approval does not claim runtime conformance.
