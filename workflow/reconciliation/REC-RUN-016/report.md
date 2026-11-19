# REC-RUN-016 — One Access surface and bounded presentation repairs

Generated 2026-11-19 UTC; invocation product-definition-orchestrator, originating stage product. Status RESOLVED. All8 PO-FB-282–289 dispositions:4 DIRECTIVE fully resolved,3 OBSERVATION evidence correlated,1 PREFERENCE advisory considered. Four findings:2 UX_SPEC_GAP,1 PRODUCT_SPEC_PROBLEM,1 IMPLEMENTATION_DEFECT. Four resolved remediation outcomes; no questions or proposed authority. Implementation ready true; delivery planning ready false pending selective definition revalidation. Handoff DEFINITION_REVALIDATION → product-definition-orchestrator.

## Evidence and authority

Preservation baseline: implementation70db8b7 and qualificatione15c814; source inspected at83f1f2, whose later changes are feedback publication. Canonical feedback validates against installed schema1. [REPORTED] all supplied feedback; [REPOSITORY_EVIDENCED] source references below; [DOCUMENTED] PRD CONFIG01/03/05, AUTHZ01/02, POLICY01, UX02/03, STATE01/02/10, SECRES09/10, UX-R05/R12, UX-IN24–26 and UX-EX03. ProductUX U11-01–05 is copied into design-basis.md for immutable producer provenance and adopted through this PRD correction. No runtime or deployed visual reproduction was attempted here; each finding has reproduction NOT_ATTEMPTED and high confidence in its bounded source/authority mapping. Earlier screenshots are supporting evidence only, not certification of unseen states.

## Shared pattern and preservation

Inspect guided/edit/read-only and Advanced configuration, new/imported/saved never-applied services, applied/Inactive/Archived Access, review and Overview; compare service Authentication with Details/Destinations and compact sign-in/replacement. Source confirms the shared authentication class width collision and the inverted Access locations. The dedicated Access pattern already exists; consolidation removes redundant controls rather than inventing another navigation model. PO-FB288 stays advisory: the explicit removal directive, existing shared tab pattern and delegated U11 interpretation supply the narrow placement rule. Fourth section becomes Request rules. No-access warning follows its task; imported reset notice does too.

STATE01 explicitly separates initial reviewed grants from existing immediate assignments. STATE02 and SECRES09 keep actor/eligibility/dependency/CSRF/audit gates, zero-access denial and import non-authority. consoleServices candidate rejects changed applied grants; Apply grants only first-time selections; access requires applied configuration and current eligible identity. consoleHttp retains CSRF before service mutations. No new role, grant timing, storage ownership, auth, destructive gate or recovery rule is introduced; architecture/security semantic revalidation is therefore false, with boundary regression required in delivery. Existing SMTP staged Set/Replace versus immediate Clear, service-value actions and retained backups remain exceptions unchanged. Current applied access cannot be overwritten by a stale Advanced document.

## Findings and source corrections

| Finding | Classification | Severity | Source items | Source change | Authority | Outcome |
|---|---|---|---|---|---|---|
| REC-070 | UX_SPEC_GAP | LOW | PO-FB-282 | REC-CHANGE-070: APPLIED_AFTER_DECISION | CONFIG-05 | REC-RM-064 |
| REC-071 | IMPLEMENTATION_DEFECT | MEDIUM | PO-FB-283, PO-FB-284 | REC-CHANGE-071: NO_SOURCE_MUTATION | UX-02, CONFIG-02 | REC-RM-065 |
| REC-072 | PRODUCT_SPEC_PROBLEM | MEDIUM | PO-FB-285, PO-FB-286, PO-FB-287, PO-FB-288 | REC-CHANGE-072: APPLIED_AFTER_DECISION | CONFIG-01, UX-03, MIGRATE-01, AUTHZ-01, AUTHZ-02 | REC-RM-066 |
| REC-073 | UX_SPEC_GAP | LOW | PO-FB-289 | REC-CHANGE-073: APPLIED_AFTER_DECISION | POLICY-01, UX-02 | REC-RM-067 |

Applied corrections are limited to docs/web-console-prd.md. CONFIG01 and MIGRATE01 replace embedded initial-access placement with the dedicated Access surface; UX03 relocates its nonblocking warning. CONFIG05 delimits the existing challenge without changing it. POLICY01 removes the quoted redundant helper. Narrow confirmed-direction gate is satisfied through exact directives and adopted U11 semantics; no new product choice remains. Width has NO_SOURCE_MUTATION because UX-R12 already explicitly excludes service editors from compact-login width. Source change IDs include this unchanged-authority trace. No architecture/security source mutation occurs.

## Resolved remediation backlog

Mode CHANGE_PLAN. Implementation authority: corrected PRD and adopted U11 basis with preserved UX10/STATE/SECRES constraints. Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml). Delivery planning ready false pending revalidation; each outcome is decision-complete.

### REC-070 / REC-RM-064 — Quoted exact deletion challenge

Priority LOW; source PO-FB-282; requirements CONFIG-05. Source/first inconsistent layer: src/consoleServicePage.ts: permanent-delete dialog. The dialog asks Type plus a bare value, without delimiters. The local presentation requirement lacked this now-explicit detail.

Required behavior: Enclose the exact displayed value in decorative quotes, explaining their exclusion from input; preserve literal server matching and current target/session/Archived gates.

Actors: existing authorized Owners/Administrators; read-only/Auditor and restricted/Member boundaries unchanged. Interfaces: shared service browser surfaces and existing management calls, no API authority widening. UX constraints: U11 basis and existing responsive/dialog/tab families. Architecture/security: STATE01/02/10/11, SECRES09/10 and AUTHZ01/02 preserved.

Acceptance and targeted validation: Correct/wrong/cancel input, embedded quotes, long and whitespace-bearing names; keyboard focus and desktop/narrow/text enlargement. Positive action, rejection/cancel/stale behavior and preservation must be demonstrated; inspect actual matching screenshots instead of relying only on source or functional tests. No new roles, authentication, policy semantics, import mapping, automatic saving or grants, storage redesign or deployment. Dependencies: adopted current authority and selective definition revalidation; no other unresolved remediation prerequisite.

### REC-071 / REC-RM-065 — Service Authentication width isolation

Priority MEDIUM; source PO-FB-283, PO-FB-284; requirements UX-02, CONFIG-02. Source/first inconsistent layer: src/consolePresentation.ts .authentication-form; src/consoleServicePage.ts renderAuthentication. Compact-login max-width applies to the service form through a shared class. Existing width authority is valid and the implementation violates it.

Required behavior: Service Authentication fills its normal editor content column like its siblings; short sign-in and Replace authenticator remain compact.

Actors: existing authorized Owners/Administrators; read-only/Auditor and restricted/Member boundaries unchanged. Interfaces: shared service browser surfaces and existing management calls, no API authority widening. UX constraints: U11 basis and existing responsive/dialog/tab families. Architecture/security: STATE01/02/10/11, SECRES09/10 and AUTHZ01/02 preserved.

Acceptance and targeted validation: Actual populated/no-auth/missing-value/read-only service states at1440/390/320 and200% text; sibling edges/credential cards/footer focus plus ultrawide compact-login preservation. Positive action, rejection/cancel/stale behavior and preservation must be demonstrated; inspect actual matching screenshots instead of relying only on source or functional tests. No new roles, authentication, policy semantics, import mapping, automatic saving or grants, storage redesign or deployment. Dependencies: adopted current authority and selective definition revalidation; no other unresolved remediation prerequisite.

### REC-072 / REC-RM-066 — Single Access surface with preserved timing

Priority MEDIUM; source PO-FB-285, PO-FB-286, PO-FB-287, PO-FB-288; requirements CONFIG-01, UX-03, MIGRATE-01, AUTHZ-01, AUTHZ-02. Source/first inconsistent layer: src/consoleServicePage.ts renderServiceAccess/renderPolicyRules; src/consoleServices.ts candidate/apply/access. Never-applied Access redirects to Configuration selection; applied Configuration redirects to Access. The PRD explicitly places initial assignments in Access & policy. Existing explicit product placement is stale under the current directive.

Required behavior: Dedicated Access owns proposed initial selection and current applied assignments; Configuration fourth section is Request rules. Shared proposal state survives navigation; first Apply grants versus immediate current actions remain distinct. No-access advisory moves with Access and never blocks activation.

Actors: existing authorized Owners/Administrators; read-only/Auditor and restricted/Member boundaries unchanged. Interfaces: shared service browser surfaces and existing management calls, no API authority widening. UX constraints: U11 basis and existing responsive/dialog/tab families. Architecture/security: STATE01/02/10/11, SECRES09/10 and AUTHZ01/02 preserved.

Acceptance and targeted validation: New unsaved/imported/saved initial/Inactive-applied/Archived/read-only roles; zero-access Apply and denied execution; complete shared save/review, Guided/Advanced/history/dirty guards; stale eligibility, immediate removal with draft, role/CSRF/audit/unknown outcomes. Positive action, rejection/cancel/stale behavior and preservation must be demonstrated; inspect actual matching screenshots instead of relying only on source or functional tests. No new roles, authentication, policy semantics, import mapping, automatic saving or grants, storage redesign or deployment. Dependencies: adopted current authority and selective definition revalidation; no other unresolved remediation prerequisite.

### REC-073 / REC-RM-067 — Remove redundant policy helper

Priority LOW; source PO-FB-289; requirements POLICY-01, UX-02. Source/first inconsistent layer: src/consolePresentation.ts fieldHints policy-default; src/consoleServicePage.ts renderPolicyRules/editRule. Shared decoration emits Choose Allow or Deny beneath Default policy. The local presentation requirement lacked this now-explicit detail.

Required behavior: Remove that redundant helper from Request rules and equivalent Add/Edit dropdowns where present, preserving field label/options and useful fallback/priority/mixed-effect explanation.

Actors: existing authorized Owners/Administrators; read-only/Auditor and restricted/Member boundaries unchanged. Interfaces: shared service browser surfaces and existing management calls, no API authority widening. UX constraints: U11 basis and existing responsive/dialog/tab families. Architecture/security: STATE01/02/10/11, SECRES09/10 and AUTHZ01/02 preserved.

Acceptance and targeted validation: Default-policy and Add/Edit helper inspection, available options, unchanged policy evaluation and narrow layout. Positive action, rejection/cancel/stale behavior and preservation must be demonstrated; inspect actual matching screenshots instead of relying only on source or functional tests. No new roles, authentication, policy semantics, import mapping, automatic saving or grants, storage redesign or deployment. Dependencies: adopted current authority and selective definition revalidation; no other unresolved remediation prerequisite.

## Impact and trace

Every item maps once in canonical feedback_dispositions, preserving exact wording, authority and relationship fields; all source→finding→change→remediation links above are TRACED. REC070/072/073 need UX/journey alignment; REC071 is implementation-only and does not independently stale definition. Aggregate product false after narrow adoption, journeys true, UX true, architecture false, security false. Potentially stale artifacts are listed exactly in the canonical result (coverage/journeys and affected UX files), not the whole product graph. Journey mapping is the existing owner/admin configuration/access and read-only paths; these must reflect dedicated Access without changing their grant gates.

## Decisions and evidence limits

No unresolved decisions. No implementation edits, tests, runtime acceptance, milestones or workflow-state mutation belong to this transaction. No newly observed visual claims. Delivery must verify responsive, navigation and permission behavior on final source. Producer payload and exact content hashes are recorded in the canonical result; the required metadata-only closeout finalizes its commit provenance.
