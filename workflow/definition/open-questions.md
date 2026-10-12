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
