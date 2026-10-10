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
status: pending
routing_status: awaiting_user
ask_user: true
affected_artifact: workflow/definition/drafts/product-ux/web-console-initial/experience-brief.yaml
```
