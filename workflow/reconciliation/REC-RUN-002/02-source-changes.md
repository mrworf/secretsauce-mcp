# Source changes

| Change ID | Source findings | PO feedback | Target artifact | Change kind | Status | Decision | Semantic impact |
|---|---|---|---|---|---|---|---|
| REC-CHANGE-001 | REC-001 | PO-FB-001/002 | docs/web-console-prd.md | Recovery permissions and separate password semantics | APPLIED_AFTER_DECISION | REC-DEC-001 resolved | All five bounded domains |
| REC-CHANGE-002 | REC-002 | PO-FB-003/004 | docs/web-console-prd.md | Factor reset and Owner continuity | APPLIED_AFTER_DECISION | REC-DEC-001 resolved | All five bounded domains |
| REC-CHANGE-003 | REC-003 | PO-FB-005/006 | product/ux/01-information-architecture.md | Existing authority sufficient | NO_SOURCE_MUTATION | None | Implementation only |
| REC-CHANGE-004 | REC-004 | PO-FB-007/008/009 | product/ux/01-information-architecture.md | Focused settings unresolved | NO_SOURCE_MUTATION | REC-DEC-002 | UX/journeys |
| REC-CHANGE-005 | REC-005 | PO-FB-010/011 | product/ux/02-interaction-patterns.md | Friendly control details unresolved | NO_SOURCE_MUTATION | REC-DEC-002 | UX/coverage |
| REC-CHANGE-006 | REC-006 | PO-FB-012/013 | docs/web-console-prd.md | Independent SMTP deletion | APPLIED_AFTER_DECISION | REC-DEC-003 resolved | All five bounded domains |
| REC-CHANGE-007 | REC-007 | PO-FB-014 | docs/web-console-prd.md | Existing import authority sufficient | NO_SOURCE_MUTATION | None | Implementation only |

Mutation gate: precise confirmed directives plus SECRES-05 and corrected STATE-01/02/03 amendment supply exact delegated semantics, without a remaining product choice. Only PRD adoption is reconciliation-owned; domain contracts/results are orchestrator-owned inputs and are not staged here. No product expansion into invitation/SMTP management for Administrators, combined resets or immediate SMTP create/replace is introduced.

Previous → new rules:
- Role matrix/IDENT-05: Owner-only combined recovery → Owner and Administrator separate reset initiation under exact SECRES-05 target hierarchy; other identity administration stays Owner-only.
- AUTHZ-02/03: existing current-role/Owner continuity → explicitly covers proof issuer/target generations and concurrent Owner MFA restriction.
- IDENT-04/05/06: generic recovery restriction on issuance → non-restricting password proof issuance, proof+preserved factor password completion; immediate factor invalidation/restricted MFA recovery, unchanged password. Authorized reset link delivery stays on established channels; recent authentication applies to both resets and SMTP deletion.
- IDENT-04/CONFIG-03/04: SMTP secret deletion on application incompletely specified → separate confirmed current-version deletion after enabled dependency removal, no stale value resurrection, secret-free history; creation/replacement retains draft/review/apply and encrypted pending values.
- AUDIT-01: generic recovery events → distinct initiator/target/purpose/verification category/outcomes, no secrets and no mutation during audit outage.

Application evidence: scoped PRD diff and exact resulting PRD hash in canonical artifact_revisions. Companion cross-reference expanded SECRES-01–04 to SECRES-01–05. No authority change to REC-003/004/005/007. Every changed requirement is enumerated in change_impact; source records preserve stable finding IDs.
