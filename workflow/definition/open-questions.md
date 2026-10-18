# Web console definition questions

The four initial PRD questions below were resolved by delegated Security and Architecture contracts and PRD revalidation. UX-DESIGN-001 is resolved by explicit Product Owner approval of the current design. Canonical UX, Architecture and Security reviews have passed. No unresolved questions remain. Previously answered scope questions are preserved in [decisions.md](decisions.md) and must not be asked again.

Specialist-owned technical and domain contracts are delegated automatically; user questions are limited to unresolved consequential product choices or unavailable facts.

## RES-PRD-SEC-01

```yaml
id: RES-PRD-SEC-01
status: resolved
stage: prd
blocking: true
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
  - security
routing_status: resolved
depends_on: []
affected_requirements:
  - IDENT-01
  - IDENT-03
  - IDENT-05
  - SEC-01
  - AUDIT-04
  - BACKUP-05
result: workflow/definition/results/security-resolution.yaml
ask_user: false
reason: PRD specialist identified missing domain semantics implied by
  established product intent; specialist delegation preserves prior decisions.
resolution_artifact: product/security/web-console-security-contract.md
resolution_revision: sha256:95e342c77316f1697540fa8da29c6dd6333d6b6d3356b326c4dde921bca4540d
```

## RES-PRD-ARCH-01

```yaml
id: RES-PRD-ARCH-01
status: resolved
stage: prd
blocking: true
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
  - architecture
routing_status: resolved
depends_on: []
affected_requirements:
  - AUTHZ-02
  - CONFIG-03
  - CONFIG-04
  - BACKUP-04
  - BACKUP-05
result: workflow/definition/results/architecture-resolution.yaml
ask_user: false
reason: PRD specialist identified missing domain semantics implied by
  established product intent; specialist delegation preserves prior decisions.
resolution_artifact: product/architecture/web-console-state-contract.md
resolution_revision: sha256:54956edc26dbcebcb48ecca0697a4695012d61488fa2297e56b6c04c9cbaa858
```

## Q-PRD-001

```yaml
id: Q-PRD-001
source_finding_ids:
  - F-PRD-001
blocking: true
affected_requirement: SEC-01
affected_requirements:
  - SEC-01
  - IDENT-03
  - IDENT-05
  - BASE-01
affected_artifact: docs/web-console-prd.md
question: Derive the narrow URL/token exposure contract preserving
  enrollment/recovery links, OAuth flows, and supported gateway query placement.
reason: Distinct implementations could prohibit required links or remove
  existing downstream placement, or leak management secrets.
options:
  - Define purpose-bound short-lived capability exceptions with leakage controls
    while prohibiting ordinary credential exposure
  - Return a precise remaining product choice only if the established
    requirements cannot coexist
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
  - security
depends_on: []
ask_user: false
status: resolved
stage: prd
routing_status: resolved
delegated_to:
  - RES-PRD-SEC-01
resolution_result: workflow/definition/results/prd.yaml
authoritative_updates:
  - docs/web-console-prd.md
```

## Q-PRD-002

```yaml
id: Q-PRD-002
source_finding_ids:
  - F-PRD-002
blocking: true
affected_requirement: BACKUP-03
affected_requirements:
  - BACKUP-03
  - BACKUP-04
  - BACKUP-05
  - AUTHZ-03
  - IDENT-01
  - IDENT-05
affected_artifact: docs/web-console-prd.md
question: Derive recovery proof, restricted Owner enrollment, and activation
  transitions for clean-host and in-place restore.
reason: Recovery may deadlock or allow unauthenticated takeover; final Owner and
  service resumption cannot be tested.
options:
  - Use established host/bootstrap and backup recovery authority in a restricted
    restore ceremony
  - Identify only any residual consequential product tradeoff that cannot be
    derived
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
  - security
  - architecture
depends_on: []
ask_user: false
status: resolved
stage: prd
routing_status: resolved
delegated_to:
  - RES-PRD-SEC-01
  - RES-PRD-ARCH-01
resolution_result: workflow/definition/results/prd.yaml
authoritative_updates:
  - docs/web-console-prd.md
```

## Q-PRD-003

```yaml
id: Q-PRD-003
source_finding_ids:
  - F-PRD-003
blocking: true
affected_requirement: AUDIT-01
affected_requirements:
  - AUDIT-01
  - AUDIT-04
  - IDENT-02
  - IDENT-05
  - SEC-03
affected_artifact: docs/web-console-prd.md
question: Specify allowed read-only/recovery access and prohibited changes while
  durable audit is unavailable, plus verified resumption.
reason: Implementers could enable unaudited privileged mutation or eliminate the
  promised recovery access.
options:
  - Restrict outage access to diagnosis and operator repair with durable
    recording before sensitive work resumes
  - Identify only any residual safety-versus-availability product choice
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
  - security
  - architecture
depends_on: []
ask_user: false
status: resolved
stage: prd
routing_status: resolved
delegated_to:
  - RES-PRD-SEC-01
  - RES-PRD-ARCH-01
resolution_result: workflow/definition/results/prd.yaml
authoritative_updates:
  - docs/web-console-prd.md
```

## Q-PRD-004

```yaml
id: Q-PRD-004
source_finding_ids:
  - F-PRD-004
blocking: true
affected_requirement: CONFIG-02
affected_requirements:
  - CONFIG-02
  - CONFIG-03
  - CONFIG-04
  - CONFIG-05
  - AUTHZ-02
  - AUTHZ-03
  - SEC-03
  - OPS-02
affected_artifact: docs/web-console-prd.md
question: Derive draft transaction and immediate-operation boundaries,
  apply-time actor checks, scoped rollback and related lifecycle invalidation.
reason: Revocation could wait for apply, or an Administrator could
  apply/rollback Owner-only settings through a mixed draft.
options:
  - Preserve immediate security actions and restrict draft/apply/rollback to the
    acting role permitted configuration
  - Surface a remaining product choice only if simpler safe semantics cannot
    satisfy the existing matrix
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
  - architecture
  - security
depends_on: []
ask_user: false
status: resolved
stage: prd
routing_status: resolved
delegated_to:
  - RES-PRD-ARCH-01
resolution_result: workflow/definition/results/prd.yaml
authoritative_updates:
  - docs/web-console-prd.md
```

## UX-DESIGN-001

```yaml
id: UX-DESIGN-001
kind: UX_DIRECTION_APPROVAL
blocking: true
stage: ux
resolution_category: PRODUCT_DECISION
resolution_owner: user
depends_on: []
affected_requirement: UX-02
affected_requirements:
  - UX-01
  - UX-02
  - UX-03
  - UX-04
  - CONFIG-03
  - BACKUP-05
affected_surfaces:
  - service-list
  - service-edit
  - apply-review
  - recovery-review
  - narrow-recovery
question: Approve the proposed calm, moderately dense visual and interaction
  direction shown in the service, edit, review and recovery concepts?
reason: The PRD settles navigation and behavior; explicit Owner approval of
  consequential composition, disclosure, risk prominence and visual character is
  required before canonical UX synthesis.
recommendation: "Approve this direction: aligned service lists, grouped forms
  with advanced disclosure, explicit impact review, and calm guided recovery
  that reflows to one column."
alternatives:
  - option: Refine the proposal
    tradeoff: Name a consequential concern in hierarchy, density, disclosure or
      character; revise these draft concepts before synthesis.
options:
  - Approve this direction
  - Refine the proposal
proposal_paths:
  - workflow/definition/drafts/product-ux/web-console-initial/experience-brief.yaml
  - workflow/definition/drafts/product-ux/web-console-initial/index.md
  - workflow/definition/drafts/product-ux/web-console-initial/edit-desktop.png
  - workflow/definition/drafts/product-ux/web-console-initial/recovery-desktop.png
  - workflow/definition/drafts/product-ux/web-console-initial/recovery-narrow.png
  - workflow/definition/drafts/product-ux/web-console-initial/review-desktop.png
  - workflow/definition/drafts/product-ux/web-console-initial/services-desktop.png
approval_consequence: Publish canonical UX system and observable conformance
  criteria; enables downstream architecture/security review without authorizing
  implementation.
status: resolved
routing_status: resolved
ask_user: false
affected_artifact: workflow/definition/drafts/product-ux/web-console-initial/experience-brief.yaml
resolution: "Product Owner: I approve of the current design"
approval_scope: Current draft-1 experience brief and rendered design proposal
approved_proposal_revisions:
  - path: workflow/definition/drafts/product-ux/web-console-initial/experience-brief.yaml
    revision: sha256:1f06ace4bfa0d7a64f15cf32adbe80ada89ebae427a73e3c3e9e860ad4ef5e6e
  - path: workflow/definition/drafts/product-ux/web-console-initial/index.md
    revision: sha256:aae30919180997b72f4b5c202ad1bf43f745c904e5d1936eb32d33b1c09a1233
  - path: workflow/definition/drafts/product-ux/web-console-initial/edit-desktop.png
    revision: sha256:c6951c8a2aaea3d519f28120ec2111d55a274d64a282e36c6416ec2bb683cb6c
  - path: workflow/definition/drafts/product-ux/web-console-initial/recovery-desktop.png
    revision: sha256:587fc00b71471d7d953192c8e9da6f4ebcdb74c3d3ca1cec47173222ba54a275
  - path: workflow/definition/drafts/product-ux/web-console-initial/recovery-narrow.png
    revision: sha256:3fb318cc988beb2a9bb4679ebee5b1ccd0a186768ddcd711b49c34e6d35cb9a3
  - path: workflow/definition/drafts/product-ux/web-console-initial/review-desktop.png
    revision: sha256:90b4bf895c7b1a0a89336d2388d94efe2c937495edb2764ae5f362d1ef33fd18
  - path: workflow/definition/drafts/product-ux/web-console-initial/services-desktop.png
    revision: sha256:407270942e6fbdd3fb67920becebfd5d4ac6f4fb75406a0f9ae47fbad297a42d
```

## REC-DEC-001

```yaml
id: REC-DEC-001
source_findings:
- REC-001
- REC-002
product_owner_feedback:
- PO-FB-002
- PO-FB-004
domain: security
affected_requirement: IDENT-05
blocking: true
question: Derive the permitted target matrix and revocation/enrollment/issuer-continuity
  checks for Owner and Administrator password and MFA reset initiation, keeping unrelated
  identity administration Owner-only.
reason: Current authority explicitly permits Owner only. Role expansion is settled;
  target hierarchy, final Owner restriction, password-versus-factor transitions and
  pending proof issuer eligibility need precise safe semantics.
resolution_category: SPECIALIST_RESOLUTION
implementation_ready: false
affected_requirements:
- IDENT-05
- AUTHZ-02
- AUTHZ-03
status: resolved
resolution_owner:
- security
routing_status: resolved
depends_on: []
ask_user: false
result: workflow/definition/results/feedback-security-resolution.yaml
resolution_artifact: product/security/web-console-security-contract.md
resolution_result: workflow/definition/results/feedback-security-resolution.yaml
remaining_product_choices: []
adopted_by: workflow/reconciliation/REC-RUN-002/reconciliation-result.yaml
```

## REC-DEC-002

```yaml
id: REC-DEC-002
source_findings:
- REC-004
- REC-005
product_owner_feedback:
- PO-FB-008
- PO-FB-009
- PO-FB-011
domain: ux
affected_requirement: UX-02
blocking: true
question: Specify focused Settings navigation, search/draft transitions and minimum
  friendly control/read-summary coverage for existing configuration, preserving advanced
  capabilities and role scopes.
reason: No-long-page and friendly controls are settled; subtabs are exploratory. Derive
  bounded UX within the approved calm grouped design, without adding features or assuming
  a new global redesign.
resolution_category: SPECIALIST_RESOLUTION
implementation_ready: true
affected_requirements:
- UX-02
- UX-IA03
- UX-IN01
status: resolved
resolution_owner:
- ux
routing_status: resolved
depends_on: []
ask_user: false
result: workflow/definition/results/feedback-ux-resolution.yaml
adopted_by: workflow/reconciliation/REC-RUN-003/reconciliation-result.yaml
resolution_result: workflow/definition/results/ux.yaml
resolution: Approved UX-DESIGN-002 synthesized as web-console-ux-2; REC-RUN-003 resolves
  focused Settings and friendly control coverage.
```

## REC-DEC-003

```yaml
id: REC-DEC-003
source_findings:
- REC-006
product_owner_feedback:
- PO-FB-013
domain: architecture
affected_requirement: CONFIG-03
blocking: true
question: Define independent confirmed deletion for SMTP credentials and the audit/dependency/current-state/stale-draft/history
  behavior needed to prevent later apply from restoring deleted values.
reason: Independent deletion is settled, but active SMTP dependency handling and stored
  draft credentials cross existing configuration and immediate-value boundaries; the
  existing service-value contract cannot simply be assumed complete for SMTP.
resolution_category: SPECIALIST_RESOLUTION
implementation_ready: false
affected_requirements:
- CONFIG-03
- IDENT-04
- STATE-01
- STATE-02
- STATE-03
status: resolved
resolution_owner:
- architecture
routing_status: resolved
depends_on: []
ask_user: false
result: workflow/definition/results/feedback-architecture-resolution.yaml
resolution_artifact: product/architecture/web-console-state-contract.md
resolution_result: workflow/definition/results/feedback-architecture-resolution.yaml
remaining_product_choices: []
adopted_by: workflow/reconciliation/REC-RUN-002/reconciliation-result.yaml
```

## UX-DESIGN-002

```yaml
id: UX-DESIGN-002
kind: UX_DIRECTION_APPROVAL
blocking: true
origin_stage: product-ux
resolution_category: PRODUCT_DECISION
resolution_owner: user
depends_on: []
affected_requirement: UX-02
affected_requirements:
- UX-02
- UX-03
- UX-04
- CONFIG-03
affected_surfaces:
- settings-sections
- settings-search
- settings-draft-review
- configuration-forms
question: 'Approve the focused Settings direction shown in the concepts: six named
  sections, one visible at a time, readable summaries and friendly forms, with all
  draft changes shown together before applying?'
reason: Existing feedback establishes focused sections and friendly controls; the
  proposed secondary navigation, responsive selection and cross-section review composition
  are consequential experience choices not explicitly covered by UX-DESIGN-001.
recommendation: Approve this bounded direction; retain the existing calm visual language
  and all advanced capabilities.
options:
- Approve this direction
- Refine this direction
alternatives:
- option: Refine this direction
  tradeoff: Identify a material concern with section navigation, disclosure or review;
    revise only this bounded proposal.
proposal_paths:
- workflow/definition/drafts/product-ux/web-console-feedback-001/index.md
- workflow/definition/drafts/product-ux/web-console-feedback-001/experience-brief.yaml
- workflow/definition/drafts/product-ux/web-console-feedback-001/settings-desktop.png
- workflow/definition/drafts/product-ux/web-console-feedback-001/email-desktop.png
- workflow/definition/drafts/product-ux/web-console-feedback-001/settings-narrow.png
- workflow/definition/drafts/product-ux/web-console-feedback-001/settings-review.png
- workflow/definition/drafts/product-ux/web-console-feedback-001/design-contract.md
approval_consequence: Allows synthesis of this Settings direction into canonical UX
  after current product reconciliation is adopted; does not approve new roles, reset
  semantics or deletion mechanisms beyond their authoritative contracts.
derived_from: REC-DEC-002
status: resolved
stage: ux
routing_status: resolved
ask_user: false
proposal_revisions: &id001
- path: workflow/definition/drafts/product-ux/web-console-feedback-001/index.md
  revision: sha256:c42697e3e9460e052835e8474ec4f729daaff3078b6d2653d16bdfbe998a8349
- path: workflow/definition/drafts/product-ux/web-console-feedback-001/experience-brief.yaml
  revision: sha256:f512bbc5726f914bf53127217d3d3e215340a36752df1c786264dda5549cbd85
- path: workflow/definition/drafts/product-ux/web-console-feedback-001/settings-desktop.png
  revision: sha256:3655babf82cde5849e55a9a8b73e3042617dc37cc78bfc45440c10df73d2183f
- path: workflow/definition/drafts/product-ux/web-console-feedback-001/email-desktop.png
  revision: sha256:7807ee626e1180e7810a00c83f23e40e45a0fd5e6278c30563f8276dd7774377
- path: workflow/definition/drafts/product-ux/web-console-feedback-001/settings-narrow.png
  revision: sha256:ee10a30ef701e84cf10c181ea4281f263fabfbd7e1da339554b313648ed26012
- path: workflow/definition/drafts/product-ux/web-console-feedback-001/settings-review.png
  revision: sha256:e7c29bdf7b6a12eff35494c2d9e8185fca99d9ef4aa21c30249fefde33d41625
- path: workflow/definition/drafts/product-ux/web-console-feedback-001/design-contract.md
  revision: sha256:626f6a5c5b65f9965d98642e1e906823fd186fccbed7daaab4cb5379061fb3bb
resolution: 'Product Owner: i approve of the proposal'
approval_scope: feedback-draft-1 focused Settings direction and the recorded representative
  concepts
approved_proposal_revisions: *id001
```

## REC-DEC-004

```yaml
id: REC-DEC-004
status: resolved
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
- security
routing_status: resolved
depends_on: []
ask_user: false
blocking: true
scope: Derive Administrator account-management safeguards from confirmed role expansion.
product_owner_feedback:
- PO-FB-025
source: REC-RUN-004 early specialist routing
source_findings:
- REC-012
domain: security
affected_requirement: AUTHZ-02/03; IDENT-04/05
resolution_type: SPECIALIST_RESOLUTION
question: What precise property, target-role, self-management and security-consequence
  rules realize approved Administrator account management?
reason: Expansion is settled; older Owner-only rules are stale, but field/contact
  and escalation boundaries need security/product semantics.
implementation_ready: false
resolution_results:
- workflow/definition/results/feedback2-security-resolution.yaml
adopted_by: workflow/reconciliation/REC-RUN-005/reconciliation-result.yaml
```

## REC-DEC-005

```yaml
id: REC-DEC-005
status: resolved
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
- security
- architecture
routing_status: resolved
depends_on: []
ask_user: false
blocking: true
scope: Derive explicit unencrypted SMTP mode safeguards, persistence, and migration.
product_owner_feedback:
- PO-FB-030
- PO-FB-031
source: REC-RUN-004 early specialist routing
source_findings:
- REC-014
domain: security
affected_requirement: IDENT-04
resolution_type: SPECIALIST_RESOLUTION
question: What explicit transport-mode, credential-use and acknowledgement rules support
  unencrypted SMTP while retaining secure defaults and no silent downgrade?
reason: Unencrypted support is settled; persisted modes, transport/auth behavior,
  compatibility and warning semantics are undefined.
implementation_ready: false
resolution_results:
- workflow/definition/results/feedback2-security-resolution.yaml
- workflow/definition/results/feedback2-architecture-resolution.yaml
adopted_by: workflow/reconciliation/REC-RUN-005/reconciliation-result.yaml
```

## REC-DEC-006

```yaml
id: REC-DEC-006
status: resolved
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
- ux
routing_status: resolved
depends_on:
- UX-DESIGN-003
ask_user: false
blocking: true
scope: Develop bounded settings, People, forms, language, and layout direction with
  representative concepts.
product_owner_feedback:
- PO-FB-015
- PO-FB-016
- PO-FB-017
- PO-FB-019
- PO-FB-020
- PO-FB-021
- PO-FB-022
- PO-FB-023
- PO-FB-024
- PO-FB-029
- PO-FB-033
- PO-FB-035
- PO-FB-036
- PO-FB-037
- PO-FB-038
- PO-FB-039
- PO-FB-041
source: REC-RUN-004 early specialist routing
source_findings:
- REC-008
- REC-010
- REC-011
- REC-016
domain: ux
affected_requirement: UX-02/03/04; CONFIG-03
resolution_type: SPECIALIST_RESOLUTION
question: What coherent language, layout, required-field, People detail and current-value
  settings pattern addresses this feedback while preserving review and permission
  safeguards?
reason: Existing explicit labels and applied-summary/edit patterns need design reconsideration;
  preferences and exploratory mechanisms do not select the final design.
implementation_ready: false
result: workflow/definition/results/feedback2-ux-resolution.yaml
adopted_by: workflow/reconciliation/REC-RUN-006/reconciliation-result.yaml
```

## REC-DEC-007

```yaml
id: REC-DEC-007
status: resolved
resolution_category: SPECIALIST_RESOLUTION
resolution_owner:
- architecture
routing_status: resolved
depends_on: []
ask_user: false
blocking: true
scope: Define creation and last-login events, legacy unknowns, and restore semantics.
product_owner_feedback:
- PO-FB-026
- PO-FB-027
source: REC-RUN-004 early specialist routing
source_findings:
- REC-013
domain: architecture
affected_requirement: IDENT-02/03
resolution_type: SPECIALIST_RESOLUTION
question: Which creation and last-login events and unknown/never/restore semantics
  govern the requested account timestamps?
reason: Metadata display is settled; historical truth, authenticated event boundaries
  and portable recovery projection are not defined.
implementation_ready: false
resolution_results:
- workflow/definition/results/feedback2-architecture-resolution.yaml
adopted_by: workflow/reconciliation/REC-RUN-005/reconciliation-result.yaml
```

## UX-DESIGN-003 — approve second feedback UX direction

```yaml
id: UX-DESIGN-003
kind: UX_DIRECTION_APPROVAL
blocking: true
affected_requirement: UX-02/03/04; IDENT-05; BACKUP-02
affected_surfaces:
- Settings
- People & Access
- service creation
question: Approve the proposed populated-form Settings and account list/detail direction
  shown in feedback-002-draft-1?
reason: Changes editing structure, save-state presentation, terminology and account
  information hierarchy beyond previously approved UX2.
recommendation: Populated current-value forms; Review changes then Apply, with existing
  save-only capability labeled Save for later; useful wider layouts; compact account
  list and full detail.
alternatives:
- option: retain summary-first editing
  tradeoff: Preserves read-first scanning but keeps a separate Edit step and duplicate
    value presentation.
options:
- approve recommended direction
- request adjustments
proposal_paths:
- workflow/definition/drafts/product-ux/web-console-feedback-002/index.md
- workflow/definition/drafts/product-ux/web-console-feedback-002/experience-brief.yaml
- workflow/definition/drafts/product-ux/web-console-feedback-002/design-contract.md
status: resolved
resolution_category: PRODUCT_DECISION
resolution_owner: user
routing_status: resolved
depends_on: []
ask_user: false
derived_from: REC-DEC-006
proposal_revisions: &id001
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/applied-desktop.png
  revision: sha256:88883813822fc62478fdd1f2398868fd30554f69f8485eaae57be99473e3347a
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/applied.html
  revision: sha256:a0deb0a1d769360a94faffe3d60656786bfff251e8ea5ef7b5381a8b574564a1
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/backups-desktop.png
  revision: sha256:24ca35bd839d1638c297294dd3cda9fb6cf96d09fe3dbb78353b61fc52c079fc
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/backups.html
  revision: sha256:9493546aeea22a5fe6441ff66ee09a9f9d85428156a3499bb0b7d8d96cc77838
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/design-contract.md
  revision: sha256:03c15ccd3771bf988d69858d8fb3d93dc575f5888add7618d624e3e21b4e55d2
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/email-desktop.png
  revision: sha256:89cc554c77925c758a6db57e9251015fd0089bfcb3e402333b93210b84e0d70f
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/email-narrow.png
  revision: sha256:12f01cdfba2c06cc9ae4795e6c8cde6679682881fdeec08bb328982b7153d090
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/email-unencrypted-desktop.png
  revision: sha256:87addefb645d36a512eb87392c249cbeb2050b57595b2c4de6473a9040bbe5e7
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/email-unencrypted.html
  revision: sha256:cf83a1cf7c58c1ef32387111d5027a75d46801c56cb3657186652f01e8179c82
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/email.html
  revision: sha256:8a3190838d961be0a8fdbcec5da7e9835ac7d15350182875d1f52686e63b5ee0
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/experience-brief.yaml
  revision: sha256:9586ee91923146c2200eefe88ce54052e441edca945c5ec7b938116d77bdd13f
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/health-desktop.png
  revision: sha256:9658ff4f0a49df664a27534fc1fb589ff76feb77896c7822131403d08e6312dc
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/health.html
  revision: sha256:a52129cc06c327e4bb9dc6b9cf7ba5212c7d3bd8d527916181b6f54755d4c7a7
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/index.md
  revision: sha256:6c25aaeb67be2a76cf590b785335c26195b5fb148f256d0983995706021e71e2
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/people-desktop.png
  revision: sha256:52448c32c4bdd68c9f1fb16a7a68c350dd712117901c8b9068524ee01095c689
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/people-narrow.png
  revision: sha256:511588b3f86e4d1283976695ae3d4b8f02c2d04d500745d96c5099b5f69a1400
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/people.html
  revision: sha256:e65f05d878e1dc570d18f58c9454e42966438752f57280b36000324c5ec2dfc9
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/person-desktop.png
  revision: sha256:62b963894fe5f7b4a7f8be484f0230fb3c0277e2afabc7fbd78fe4dfeae6ccd7
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/person.html
  revision: sha256:87d27056da0bd3f27aa54703471d4c1bcd06d9b3e682d824f5127ffadae63908
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/render-checks.json
  revision: sha256:17e6bf6955708a1b5e6cc6749d55d64b8643afc8723c2fa5c216020bd1b874c9
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/research.md
  revision: sha256:04c1955fe894207d5987741aacd140986d88f3772040608376897052deb49650
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/review-desktop.png
  revision: sha256:e43a0dce1e32c643e8c3fa4a24a215bc35c9c7b94df6c66a4cc3176173ae24b2
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/review.html
  revision: sha256:39659ab5d77125174c343bda3eabc28a9f0b130ce22a15ca1e8135f1e7404dc2
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/service-desktop.png
  revision: sha256:1d31ea296d0bafdfde5db3f872afd33f1f36f074fda109eb9fffbfce1b83ce5d
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/service.html
  revision: sha256:7ebeed7cbefedbe77083ba75a6160332bc10e8a271598d7aaa54326833ae484a
- path: workflow/definition/drafts/product-ux/web-console-feedback-002/styles.css
  revision: sha256:ea601aef177d7644e5a3eab2a02e477b055d73700ed94d3e94b1ac249676fe93
resolution: approved, this time around, try to make sure the actual UX matches the
  look in general as shown in the mockups
approval_scope: feedback-002-draft-1 experience direction and general visual appearance
approved_proposal_revisions: *id001
```

## Service setup feedback — REC-RUN-007

```yaml
id: REC-DEC-008
source_findings:
- REC-022
- REC-024
product_owner_feedback:
- PO-FB-060
- PO-FB-063
- PO-FB-064
- PO-FB-065
- PO-FB-066
- PO-FB-067
domain: architecture
affected_requirement: CONFIG-02/03/04; STATE-01/02/03; AUDIT-01
blocking: true
resolution_category: SPECIALIST_RESOLUTION
question: What safe durable credential state and attribution contract realizes clear-value/retain-key
  deletion and last-changed-by display?
reason: The Product Owner has settled clearing an in-use value and retaining its key. Existing
  authority blocks referenced deletion; current storage conflates value presence with metadata.
  Derive current authorization/version/dependency checks, immediate reference/admission effects,
  failure/restart, restore/history, missing-value behavior and honest legacy actor attribution
  without reopening that intent. Security and architecture boundaries both need resolution.
status: accepted
resolution_owner:
- architecture
- security
routing_status: resolved_pending_reconciliation_adoption
depends_on: []
ask_user: false
resolved_behavior: Referenced service credential Delete clears only value, retains key and exact
  references, reports consequence, and follows STATE-09/SECRES-08 for durable failure, execution
  fencing, recovery and actor provenance. SMTP remains separate.
resolution_artifacts:
- product/architecture/web-console-state-contract.md
- product/security/web-console-security-contract.md
- workflow/definition/results/feedback3-architecture-resolution.yaml
- workflow/definition/results/feedback3-security-resolution.yaml
```

```yaml
id: REC-DEC-009
source_findings:
- REC-020
- REC-021
- REC-023
- REC-025
- REC-026
- REC-027
- REC-028
- REC-029
- REC-030
- REC-031
- REC-034
product_owner_feedback:
- PO-FB-043
- PO-FB-044
- PO-FB-045
- PO-FB-046
- PO-FB-047
- PO-FB-048
- PO-FB-049
- PO-FB-050
- PO-FB-051
- PO-FB-052
- PO-FB-053
- PO-FB-054
- PO-FB-055
- PO-FB-056
- PO-FB-057
- PO-FB-058
- PO-FB-059
- PO-FB-061
- PO-FB-062
- PO-FB-096
- PO-FB-097
- PO-FB-098
- PO-FB-068
- PO-FB-101
- PO-FB-071
- PO-FB-072
- PO-FB-073
- PO-FB-074
- PO-FB-075
- PO-FB-076
- PO-FB-077
- PO-FB-087
- PO-FB-124
- PO-FB-078
- PO-FB-079
- PO-FB-080
- PO-FB-089
- PO-FB-090
- PO-FB-091
- PO-FB-092
- PO-FB-093
- PO-FB-094
- PO-FB-095
- PO-FB-102
- PO-FB-103
- PO-FB-105
- PO-FB-082
- PO-FB-083
- PO-FB-084
- PO-FB-085
- PO-FB-086
- PO-FB-099
- PO-FB-100
- PO-FB-104
- PO-FB-106
- PO-FB-107
- PO-FB-108
- PO-FB-109
- PO-FB-110
- PO-FB-117
- PO-FB-118
- PO-FB-111
- PO-FB-112
- PO-FB-115
- PO-FB-120
- PO-FB-123
domain: ux
affected_requirement: CONFIG-01/02/05; POLICY-01/02/03; UX-01/02/03/04; MIGRATE-01
blocking: true
resolution_category: SPECIALIST_RESOLUTION
question: What coherent researched service configuration design realizes the confirmed directives
  while preserving existing capabilities, current versus draft state and safe navigation?
reason: Individual directives settle interaction outcomes but not the full layout, responsive
  states, composition or approved mockups. Existing authority needs selective service UX refinement.
  Color bars, tester modal and speculative identifier hiding remain advisory/exploratory. Any
  required approval is for a concrete design, not reauthorization of the directives.
status: pending
resolution_owner:
- ux
routing_status: awaiting_proposal_approval
depends_on:
- UX-DESIGN-004
ask_user: false
```

```yaml
id: REC-DEC-010
source_findings:
- REC-020
product_owner_feedback:
- PO-FB-048
- PO-FB-049
domain: product
affected_requirement: CONFIG-05; STATE-01; AUDIT-01
blocking: true
resolution_category: SPECIALIST_RESOLUTION
question: How should the requested row-level Delete action map to existing retained-history
  Archive lifecycle without silently inventing permanent deletion or misleading the operator?
reason: The feedback confirms a Delete action and confirmation, but existing authority specifies
  archive/restore-to-Disabled and retained audit/history. First derive the smallest faithful
  lifecycle contract; only a remaining material retention/destruction tradeoff requires a Product
  Owner choice. Do not infer purge or erase audit from a label.
status: accepted
resolution_owner:
- prd
routing_status: resolved_pending_reconciliation_adoption
depends_on: []
ask_user: false
resolved_behavior: Service Delete uses existing archive lifecycle with explicit retention and
  restore-to-Disabled explanation; no permanent purge inferred.
resolution_artifacts:
- workflow/definition/results/feedback3-product-resolution.yaml
```


## Service UX proposal review

```yaml
id: UX-DESIGN-004
status: open
stage: ux
derived_from: REC-DEC-009
affected_requirement: CONFIG-01/02/05; POLICY-01/02/03; UX-01/02/03/04; MIGRATE-01
affected_artifact: workflow/definition/drafts/product-ux/web-console-feedback-003/index.md
blocking: true
question: Approve feedback-003-draft-1 experience direction and representative visual appearance,
  or specify changes.
reason: The revised service configuration hierarchy and navigation require explicit visual-direction
  approval under product-ux; earlier approval covered UX3.
options:
- Approve proposed direction and appearance
- Request changes before approval
resolution_category: PRODUCT_DECISION
resolution_owner: user
routing_status: asked
depends_on: []
ask_user: true
proposal_revisions:
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/access.html
  revision: sha256:2fca9dfe7d01bff6f9e332d5377e3cd3a263df1a4ce728a2dba40b6355d4caaa
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/advanced.html
  revision: sha256:a7ba0cf076ba534bb5cc89b2135ac2a9f154553e223ea86b75198a3458045d56
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/authentication-desktop.png
  revision: sha256:2a768226fe2f3a9bc16b1ff1d075205e724e3dba9eaae085e2dccad8790acf6c
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/authentication-narrow.png
  revision: sha256:c5f906859a1bd14e5b04ab57584236ca930d427cd0e123401e262e89ab4daf2c
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/authentication.html
  revision: sha256:cb43ac3091c6e87345d7c57f7d77054b1b878a2079452f7a40c1ded1d1e8816b
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/clear-dialog.png
  revision: sha256:8dd879a51113b26e791319207b7170cca0dff495bc0e9db1300f618ea7c1327b
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/create-desktop.png
  revision: sha256:0d065d6b1cf8932f8a7dfbdbf162abf84805042dfbb36d61a16409e43fb03303
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/create-narrow.png
  revision: sha256:a625844084afd66e45102a877dd353955c1bf2c3a82935c4597c41af291074e6
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/create.html
  revision: sha256:c10ac93657bddd031692b89b7638625ee7115663e969a8d45e3cdeae6a072faf
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/design-contract.md
  revision: sha256:58912bc6fdaa7be64cb57be6998450c4436ca35a34d52bb624a0ef5798e7e381
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/destination-options.html
  revision: sha256:5434c9994bc76229cbc0a499963019d8ddb4af68ab2f5b1043cef6f515ed0390
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/destinations-desktop.png
  revision: sha256:f456eccb47caf5f7dc3e53ef29b8303aac0eac51f7bf190d6a8fe1c8475078f1
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/destinations-narrow.png
  revision: sha256:4ac958db88e62cb8afd6de7f3c2344cf828089783aed7bddf83822f6aa65e00c
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/destinations.html
  revision: sha256:e497597f48cd5e3bcb07e14391717b1109ef81336577f38adaf3f631511fce84
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/details.html
  revision: sha256:96f10bd2dd20bb7289ea8e2354b9d0ac0cd72f772ef1b0e38796a462e970f8f0
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/detection.html
  revision: sha256:2a52416c9b5a0f51347c3df0d89bd044a3a1cbac7d749270e8040f82ea5bbece
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/experience-brief.yaml
  revision: sha256:884a94552be4077add3c54ad4d559a0d6e5d53c3c7829d5890e033dc91d66aab
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/import-recovery-desktop.png
  revision: sha256:42a1fbfcb127bb431d7feb3c0f84642cbab2a2a2f4c132977af1107026cd8938
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/import-recovery-narrow.png
  revision: sha256:d9843f1637ad38206b7be942f682c4d7393dc1d14d88be4f0db79478b18420ac
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/import-recovery.html
  revision: sha256:60164ee50351fb072738fb023a4feb4937764deb6174d198bfec7f7651c627ce
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/index.md
  revision: sha256:8a0b44e651e80eb124475c72575b15bd536068714f18b73da9d8966cde463cb6
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/overview-desktop.png
  revision: sha256:2b1e0028d2d900115d0be8b9fc245c70ed1874fe93e3b4aaab9188b3eebf370c
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/overview-narrow.png
  revision: sha256:c485be9194ffa402e9bfdaf4c48471a39811fc45d669f678d18040cb6d13b635
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/overview.html
  revision: sha256:aa996a619a55a70b045339a8493639ff9bc9768301f2e36195920d7ce9d8e931
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/policy-desktop.png
  revision: sha256:6726143cff615118463c83504d334acb801efc91951dd6be1273d3509291c633
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/policy-narrow.png
  revision: sha256:05bdb549aa0de16c3e72b762fcbe5288e715863bb189f9a926da96020d122582
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/policy.html
  revision: sha256:10414461a628e1a7f1b350c31be563ea85dbe47b14c9f880137bb08b5e5f49e1
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/render-checks.json
  revision: sha256:be68de04473cb6a2134fae89577ca3242ccd26a3f3c887cd7790b871b21187ea
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/render-concepts.mjs
  revision: sha256:7429c2aacd434dd9b493cf6ce5eac949823fc3dc8fa70fb0952d2ba914de7256
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/replace-dialog.png
  revision: sha256:e44c825c7e9225767409aa11e1f9669bf327d05ec6d49a4093af2bb8988a3c37
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/research.md
  revision: sha256:083c93e8da761489cebf686841c071a620f88fb9ce7d5b242276f2b3165327ad
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/review.html
  revision: sha256:a84cd0eaefac24d6425529a1d34112b9a2eb7601332e6a024bf5c39db563c576
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/rule-dialog.png
  revision: sha256:cc8226b21762cf5fd1401010a63f3cdecda1b42725bde8bf3ea8a8f34640d571
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/services-desktop.png
  revision: sha256:850d6d4e6dd422cd57a842adbeb0f489d55881d4bec73022e967e874116c8342
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/services-narrow.png
  revision: sha256:31c7d7f7881c4ccbf23956f4329e2010a5e4b2cf75511cad921e800545ec495d
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/services.html
  revision: sha256:3265bfef2a354de761436d0189165327006b8fc588ebf4fcde033f267099f59a
- path: workflow/definition/drafts/product-ux/web-console-feedback-003/styles.css
  revision: sha256:1de78d96aee168f9d0a356a45bef9fbb7ae16a9c088343fdf0a24ff57663596d
```
