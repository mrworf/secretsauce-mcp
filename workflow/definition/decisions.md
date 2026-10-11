# Web console product decisions

These decisions preserve the Product Owner's explicit answers and the subsequently accepted PRD. The authoritative product source is [the web console PRD](../../docs/web-console-prd.md). No application implementation is authorized by this definition workflow.

| ID | Status | Source | Settled behavior |
| --- | --- | --- | --- |
| D-001 | accepted | Owner answer: hosting | One organization per self-hosted Docker instance; administrator-managed reverse proxy; no multi-tenancy or hosted SaaS control plane. |
| D-002 | accepted | Owner answer: RBAC | Four fixed roles: Owner, Administrator, Auditor, Member; explicit service grants; no custom roles or groups. |
| D-003 | accepted | Owner answer: credentials | Enter and rotate managed encrypted credentials through the UI; only startup necessities remain in Docker/environment configuration. Existing source mechanisms can change through migration. |
| D-004 | accepted | Owner answer: audit outage | Stop sensitive work when durable audit recording fails; retain diagnostics and recovery access. |
| D-005 | accepted | Owner answer: backups | Scheduled and manual encrypted whole-instance backups to a mounted directory, with download/upload and full restore; operator handles off-host copying. |
| D-006 | accepted | Owner answer: SMTP | Optional UI-configured SMTP; preserve manual invitation/recovery-link delivery. |
| D-007 | accepted | Owner answer: restore | Full restore invalidates sessions and MCP grants; users enroll MFA again and reconnect clients. |
| D-008 | accepted | Owner answer: operating baseline | Validate 50 users/100 services; retain audit 365 days and daily backups 30 days; 24-hour data-loss/4-hour restore targets; 30-minute idle/12-hour maximum browser sessions. |
| D-009 | accepted | Original task | Preserve existing gateway capabilities; configuration creation/maintenance can change. Support ChatGPT and Codex. Authenticator-app MFA required; no SAML, browser OIDC, or SCIM. |
| D-010 | accepted | Original task and accepted PRD | KISS initial offering; modern UI; no service-specific tool packs, custom roles, approval chains, billing, remote backup integration, or active-active gateways. |
| D-011 | accepted | Accepted PRD | Preserve existing external OAuth and legacy bearer MCP modes with explicit identity registration and no console access; distinguish MCP authorization from browser SSO. |
| D-012 | accepted | Accepted PRD | Owners/Administrators are trusted credential-destination authors; response scanning and write-only fields are not universal non-exfiltration guarantees. |

Domain semantics implied by these choices are delegated to specialists. Only remaining materially distinct product choices return to the Owner. This ledger must not substitute for updating authoritative requirements.

## RES-PRD-SEC-01

```yaml
id: RES-PRD-SEC-01
status: accepted
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
status: accepted
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
status: accepted
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
status: accepted
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
status: accepted
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
status: accepted
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
status: accepted
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
status: accepted
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
implementation_ready: false
affected_requirements:
- UX-02
- UX-IA03
- UX-IN01
status: pending
resolution_owner:
- ux
routing_status: delegated
depends_on: []
ask_user: false
result: workflow/definition/results/feedback-ux-resolution.yaml
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
status: accepted
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

## Confirmed feedback directives — PO-FEEDBACK-2026-10-11-001

The following current Product Owner decisions are accepted from the committed feedback package. Their narrower domain semantics are delegated above.

| Feedback item | Status | Settled behavior |
| --- | --- | --- |
| PO-FB-002 | accepted | Owner and Administrator can initiate password resets for other users. |
| PO-FB-004 | accepted | Owner and Administrator can initiate Authenticator MFA resets for other users. |
| PO-FB-006 | accepted | Highlight the active tab in the menu bar. |
| PO-FB-008 | accepted | Group settings into focused sections instead of one long scrolling page containing all settings. |
| PO-FB-011 | accepted | Provide user-friendly configuration controls that hide technical configuration detail. |
| PO-FB-013 | accepted | Use an explicit, confirmed delete action independent of applying configuration edits. |
| PO-FB-014 | accepted | Support importing legacy YAML configuration into the new system. |

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
status: pending
stage: ux
routing_status: awaiting_user
ask_user: true
proposal_revisions:
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
```
