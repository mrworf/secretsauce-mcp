# Source changes

| Change | Finding / feedback | Target | Status | Previous → adopted rule | Gate |
|---|---|---|---|---|---|
| REC-CHANGE-012 | REC-012; PO-FB-025 | docs/web-console-prd.md | APPLIED_AFTER_DECISION | Owner-only role/contact editing → SECRES-06 bounded Administrator edits, verified contact change and generation revocation; IDENT-02B | Confirmed direction plus exact bounded specialist resolution; no remaining product choice |
| REC-CHANGE-013 | REC-013; PO-FB-026/027 | docs/web-console-prd.md | APPLIED_AFTER_DECISION | No timestamp semantics → STATE-07 exact creation/sign-in events and legacy/restore truth; IDENT-02A/BACKUP-01/05 | Confirmed direction plus exact bounded specialist resolution; no remaining product choice |
| REC-CHANGE-014 | REC-014; PO-FB-030/031 | docs/web-console-prd.md | APPLIED_AFTER_DECISION | Unspecified transport → TLS default or explicit acknowledged None; SECRES-07/STATE-08, IDENT-04/SEC-01/BACKUP-05 | Confirmed direction plus exact bounded specialist resolution; no remaining product choice |

Application evidence: PRD diff changes only affected role/contact statements, adds IDENT-02A/B and transport details, and propagates exact backup/security consequences. Normative companion ranges advance to SECRES-01–07 and STATE-01–08. No UX/architecture/security source was modified by this producer.

REC-CHANGE-009 now records reproduced implementation drift (no source mutation). REC-CHANGE-008/010/011/016 remain NO_SOURCE_MUTATION pending REC-DEC-006 / UX-DESIGN-003. REC-CHANGE-015/017/018 remain unchanged no-source-mutation dispositions. All stable IDs and exact feedback links remain in canonical YAML. Every adopted rule stales its bounded derived definition surfaces; delivery is not ready. Source contract files themselves remain root-owned uncommitted and must be closed out at the exact recorded revision.
