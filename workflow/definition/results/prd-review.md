# Web console PRD targeted revalidation — feedback 002

**Current PRD stage: PASS. Implementation-ready: yes for the PRD product-contract gate.** This is not whole-workflow readiness or implementation authorization. Canonical UX synthesis, coverage, journeys and full architecture/security revalidation remain separate gates.

Rechecked REC005 adoption and approved UX-DESIGN-003 against confirmed feedback 002, SECRES-06/07 and STATE-07/08. Exact source hashes are in `prd.yaml`. Account permissions, contact verification and revocation, immutable timestamps and legacy/restore meaning, and explicit unencrypted SMTP are settled. No new product question is needed.

| Scope | Result |
| --- | --- |
| Administrator account management | Contact/role edits cover other non-Owners, never grant Owner or permit own-role editing; own contact allowed. Lifecycle, invitation and other-user session/grant administration remain Owner-only. Recent authentication, trusted-channel contact verification, immediate generation revocation, continuity and uncertainty safeguards are explicit. |
| Creation and sign-in dates | Durable identity creation and full console session admission define timestamps. Never, Unknown, Not applicable and restored snapshot history remain distinct; dates grant no authority. |
| SMTP | TLS default and explicit None preserve independent authentication/custom ports; no fallback or mode inference. Owner acknowledgment, current dependency checks, secret-safe fields and fresh restored review are explicit. |
| UX-02 correction | Removed stale summary-first/pending-approval prose using already-approved populated forms and same-group read-only values. Exact final text rechecked against approved design contract; CONFIG-03 still requires reviewed atomic activation. Visual fidelity belongs canonical UX acceptance. |
| Preservation | Existing gateway capability, manual email fallback, write-only secrets, independent deletion, whole-instance backup, four fixed roles and single-organization deployment remain intact. |

All applicable product-level readiness gates pass in this bounded scope; companion acceptance contracts include positive, unauthorized, stale/concurrent, failure and recovery cases. Existing 53 IDs remain and adopted IDENT-02A/B add two IDs. Local PRD links resolve. No code or runtime tests were changed/run. Remaining technical mechanisms belong downstream specialists; missing implementation is not a definition defect. Historical findings below retain their original review-time context, including previously pending approvals and older Owner-only boundaries now explicitly superseded by SECRES-06.

Changed paths: `docs/web-console-prd.md`, `workflow/definition/results/prd.yaml`, `workflow/definition/results/prd-review.md`. No commits by this specialist.

---

## Historical earlier PRD review

# Web console PRD targeted revalidation

**Current feedback PRD revalidation: PASS.** Targeted recheck of UX-02 passed at the exact recorded revision. The initial refinement evidence below remains historical; this update does not claim whole-workflow readiness.

**Implementation-ready: no** at the whole-product workflow level: coverage, journey, UX and full Architecture/Security review remain separate required gates managed by the orchestrator. Their status does not prevent this PRD stage from passing. Missing application code is not a definition blocker.

## Scope and evidence

Revalidated F-PRD-001–004 and direct effects against the current PRD, the normative Security resolution contract SECRES-01–04, and the normative state/recovery contract STATE-01–06. Exact SHA-256 revisions are recorded in `prd.yaml`. No normative source was edited in this validation pass.

| Finding and question | Result and evidence |
| --- | --- |
| F-PRD-001 / Q-PRD-001 | Resolved. SEC-01 and IDENT-03/05 incorporate SECRES-01. Management-secret exposure is prohibited; narrowly bound proof links and OAuth code redirects remain possible; approved downstream query placement remains supported without exposing substituted URLs in product output. |
| F-PRD-002 / Q-PRD-002 | Resolved. AUTHZ-03, IDENT-01 and BACKUP-02/03/04/05/06 incorporate SECRES-02 and STATE-04/05/06. Clean-host authority does not depend on absent MFA, old password or old session. Current initiator and archived recovery Owner are distinct. Installation rollback has protected local live state rather than relying on an export that excludes MFA. Fresh recovery enrollment unlocks management only; other users and services require review. |
| F-PRD-003 / Q-PRD-003 | Resolved. AUDIT-04 and SEC-03 incorporate SECRES-04. Sensitive operations and jobs fail closed; restricted diagnostic login is a deliberate best-effort audit exception with reliable authentication/replay state required. Host repair does not authorize unaudited product mutation. Normal admission follows a durable recovery record; uncertain downstream effects remain explicit. |
| F-PRD-004 / Q-PRD-004 | Resolved. AUTHZ-02, CONFIG-02/03/04/05 and SEC-03 incorporate STATE-01/02/03. Identity/grant/secret/lifecycle actions take effect independently of drafts while retaining audit/authorization gates. Apply rechecks current permissions and dependencies, and history cannot revive access, services or secret values. Admission uses coherent current authority; dispatched work retains appropriate response protection. |

## Preservation and checks

All 53 requirement IDs remain in their original order. D-001–D-012 are preserved: hosting, fixed roles, write-only managed credentials, fail-closed audit, optional SMTP, backup scope, fresh post-restore MFA, KISS limits, supported clients/authentication modes and administrative trust are unchanged. No new wire schema, storage engine, SSO, tenancy, approval chain, implementation slice or feature pack was introduced.

All local PRD links resolve. Normative hashes match those at correction completion. Companion acceptance scenarios cover positive, negative, replay, stale-permission, outage and recovery boundaries. Static/diff validation is proportionate; runtime tests were not run because no product code changed.

Remaining mechanism choices (durable storage implementation, encryption/key handling, audit integrity construction and crash-safe installation mechanics) remain with the full specialist reviews under the already-settled observable contracts. This result does not pass those separate stages or claim SOC 2 compliance.

Changed only `workflow/definition/results/prd-review.md` and `workflow/definition/results/prd.yaml`. Earlier full-review and correction evidence remains in the orchestrator's history directory.

## REC-RUN-002 feedback revalidation

Scoped review of REC-001, REC-002 and REC-006 confirms the PRD adopts SECRES-05 and the SMTP STATE-01/02/03 amendment. Owners and Administrators can initiate distinct password and MFA resets within the target matrix; invitations and unrelated user administration remain Owner-only. Password issuance retains access while completion revokes it; MFA issuance immediately restricts the target and invalidates factors/access. Both-lost recovery, issuer continuity, final enrolled Owner protection, concurrency, audit failure and ordinary-login completion remain explicit.

SMTP deletion is separately confirmed and immediate, requires current Owner authority and recent authentication, rejects an enabled credential dependency, and cannot be undone through stale drafts, pending values, browser submissions or history. Creation/replacement retain draft/review/apply. Non-secret settings survive deletion; queued work rechecks admission and already-dispatched work cannot resurrect credentials. Migration still covers existing YAML and both scanner catalogs, explicit subject mapping, safe credential resolution and managed-source precedence.

**Narrow correction F-PRD-005:** UX-02 previously supplied only general progressive-disclosure language. Added the already-confirmed focused Settings sections/no-long-page and friendly configuration control outcomes from PO-FB-008/011. It preserves advanced capability and existing values and chooses no layout, section names or navigation mechanism. The concrete UX-DESIGN-002 proposal remains pending approval. The subsequent targeted recheck of this exact addition passed against PRD SHA-256 `bc908afcb8c40184dfcccdf296672bc559f5499236ed37f351a82f34ad0e9843` and unchanged companion/source revisions. F-PRD-005 is resolved; the earlier FIX_LOCAL correction and this recheck are distinct steps. The wording faithfully captures PO-FB-008/011 and grants no proposed layout authority.

Requirement identifiers are preserved; source revisions are recorded in `prd.yaml`. Historical F-PRD-001–004 remain resolved and were not reopened. Static checks cover local PRD links and requirement IDs; no code changed or runtime tests ran. Current changed paths are the PRD and the two PRD result files only. The overall workflow remains not implementation-ready while UX direction and dependent specialist revalidation remain outstanding.
