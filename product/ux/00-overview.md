# SecretSauce web console UX system

**Authority:** Approved UX revision `web-console-ux-1`, synthesized from draft-1 under accepted **UX-DESIGN-001** (“I approve of the current design”). [Manifest](manifest.yaml) routes this system and exact source revisions; [experience brief](experience-brief.yaml) records approved direction. The [decision ledger](../../workflow/definition/decisions.md) is the approval record. The [preserved concepts](../../workflow/definition/drafts/product-ux/web-console-initial/index.md) are representative evidence, not an implementation or exhaustive screen specification. Their original unapproved labels document their pre-approval provenance; approval is recorded here and in the ledger without rewriting them.

## UX-G01 — Product and audience

A single-organization, self-hosted technical administration console. Owners and Administrators configure generic HTTP services; Members connect agents and understand their own access; Auditors inspect configuration and evidence. Four fixed roles, explicit service assignments and all product/security/state boundaries remain as specified in the [PRD](../../docs/web-console-prd.md). No SaaS tenancy selector, billing surface, SSO, custom roles or approval workflow is implied.

## UX-G02 — Approved experience

Use a calm, moderately dense console, with aligned service lists, restrained existing brand accents, grouped forms and progressive disclosure. Put current effective state and the useful next action first. Present impacts before consequential actions. Complex review and recovery use full pages; ordinary confirmations use concise dialogs. Keep recovery steps readable and usable on narrow screens. This is accepted designer-recommended direction under UX-DESIGN-001; routine spacing, icons and component geometry remain designer discretion.

Desktop is the primary authoring surface; narrow screens support essential monitoring, account security and recovery without removing permission or safety checks. All views share one semantic and visual system. No native application or separate mobile feature set is required.

## UX-G03 — Authority and responsibilities

The PRD, normative security/state contracts and 47 actor journeys define required behavior. This system defines observable composition, interaction, disclosure and accessibility. The source contracts prevail for permissions and security transitions; a demonstrated conflict must be surfaced rather than silently implemented. No new cryptography, route/schema, storage, authentication mode, integration or release guarantee is introduced.

Implementation must preserve all supported gateway configuration, including advanced controls. A missing field in a representative concept is not permission to remove it. Prototype controls that illustrate structure without working behavior must become real, permission-appropriate interactions in implementation.

## Artifact map

| Artifact | Responsibility |
| --- | --- |
| [Information architecture](01-information-architecture.md) | Discovery, role-specific surfaces, configuration capability placement |
| [Interaction patterns](02-interaction-patterns.md) | Forms, actions, states, feedback and recovery |
| [Responsive behavior](03-responsive-and-platform.md) | Narrow layouts and shared desktop/mobile semantics |
| [Visual system](04-visual-system.md) | Hierarchy, density, state and action prominence |
| [Accessibility](05-accessibility.md) | Keyboard, focus, semantics, reflow and announcements |
| [Feature exceptions](06-feature-exceptions.md) | Justified restricted or immediate-action experiences |
| [Conformance checklist](07-acceptance-checklist.md) | Stable observable design checks, not release certification |

## Research basis

Consulted 2026-10-09. [IBM Carbon table guidance](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) informs aligned data, search/filter grouping and primary-action placement. [GOV.UK check answers](https://design-system.service.gov.uk/patterns/check-answers/) informs grouped review with deliberate submission. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) informs retaining task content as width decreases. These conventions informed the approved recommendation; none adds product scope or substitutes for Owner approval.

The prior [visual inspection record](../../workflow/definition/drafts/product-ux/web-console-initial/index.md) covers five rendered concepts, including 390px recovery. This synthesis checks rule coherence and source traceability. Runtime usability, assistive-technology and full accessibility evidence remain future implementation work.
