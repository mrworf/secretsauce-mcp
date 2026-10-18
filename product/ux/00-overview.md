# SecretSauce web console UX system

**Authority:** Approved UX revision `web-console-ux-4`, adopting feedback-003-draft-1 under **UX-DESIGN-004** and preserving unaffected UX-DESIGN-001/002/003 authority, including the Product Owner’s instruction that actual UX generally match approved mockups. [Manifest](manifest.yaml) routes this system and exact source revisions; [experience brief](experience-brief.yaml) records approved direction. The [decision ledger](../../workflow/definition/decisions.md) is the approval record. The [preserved concepts](../../workflow/definition/drafts/product-ux/web-console-initial/index.md) are representative evidence, not an implementation or exhaustive screen specification. Their original unapproved labels document their pre-approval provenance; approval is recorded here and in the ledger without rewriting them.

## UX-G01 — Product and audience

A single-organization, self-hosted technical administration console. Owners and Administrators configure generic HTTP services; Members connect agents and understand their own access; Auditors inspect configuration and evidence. Four fixed roles, explicit service assignments and all product/security/state boundaries remain as specified in the [PRD](../../docs/web-console-prd.md). No SaaS tenancy selector, billing surface, SSO, custom roles or approval workflow is implied.

## UX-G02 — Approved experience

Use a calm, moderately dense console, with aligned service lists, restrained existing brand accents, grouped forms and progressive disclosure. Put current effective state and the useful next action first. Present impacts before consequential actions. Complex review and recovery use full pages; ordinary confirmations use concise dialogs. Keep recovery steps readable and usable on narrow screens. This is accepted designer-recommended direction under UX-DESIGN-001; routine spacing, icons and component geometry remain designer discretion.

Desktop is the primary authoring surface; narrow screens support essential monitoring, account security and recovery without removing permission or safety checks. All views share one semantic and visual system. No native application or separate mobile feature set is required.

## UX-G03 — Authority and responsibilities

The PRD, normative security/state contracts and actor journeys define required behavior. This system defines observable composition, interaction, disclosure and accessibility. The source contracts prevail for permissions and security transitions; a demonstrated conflict must be surfaced rather than silently implemented. No new cryptography, route/schema, storage, authentication mode, integration or release guarantee is introduced.

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

The approved [Settings concepts](../../workflow/definition/drafts/product-ux/web-console-feedback-001/index.md) establish focused sections, friendly controls, focused navigation and explicit whole-draft review (the summary-first editing pattern is superseded by UX-DESIGN-003). Their proposal labels and bytes are preserved as approval evidence. UX-DESIGN-002 covers the bounded Settings direction; current PRD/SECRES-05/STATE authority supplies the separate reset and deletion semantics. Unaffected visual direction remains UX-DESIGN-001. No production conformance is claimed by this revision.

## UX-G04 — Approved feedback 002 direction and fidelity

The approved [feedback 002 concepts](../../workflow/definition/drafts/product-ux/web-console-feedback-002/index.md) establish populated Settings forms, useful desktop width, compact account rows with full detail pages, plain terminology, required markers and short field help. **Review changes** durably saves pending work then opens the existing complete-scope review; **Save for later** retains save-only behavior. Explicit **Apply** remains necessary to change running configuration. Account edits remain immediate confirmed security actions.

The Owner approved the direction and specifically requested that implementation match the general look of these mockups. Composition, density, typography hierarchy, spacing, control treatment, colors, navigation and responsive transformations are therefore conformance requirements under UX-V05 and UX-C42, not optional decoration. Exact pixels and font rasterization are not the requirement. Approved source concepts are immutable evidence; their original pending-approval labels are historical.

[Research consulted 12 October 2026](../../workflow/definition/drafts/product-ux/web-console-feedback-002/research.md) uses Carbon populated forms, GOV.UK associated hints, Shopify visible save state, Auth0 list-to-detail accounts and Atlassian clear language. These patterns inform design, not permissions or guarantees. This synthesis does not certify implementation or refresh other domains’ validation.


## UX-G05 — Approved service configuration direction

UX-DESIGN-004 approves the [feedback 003 experience and representative visuals](../../workflow/definition/drafts/product-ux/web-console-feedback-003/index.md): compact service rows with independent lifecycle/readiness/draft state, focused populated Configuration sections, a single global Guided/Advanced mode, clickable creation steps, credential and rule dialogs, and explicit in-draft import recovery. Preserve the established shell, moderate density, useful width, white-card grouping and restrained orange accent. The approved concept labels remain historical proposal labels; approval is recorded in the decision ledger and manifest rather than by altering approved image bytes.

[Targeted primary-source research](../../workflow/definition/drafts/product-ux/web-console-feedback-003/research.md), consulted 17 October 2026, uses Cloudscape creation/editing structure, Carbon resource rows, GOV.UK linked error summaries and WAI modal focus. These inform composition, not scope or authority. STATE-09/SECRES-08 define credential clear semantics; the product resolution REC-DEC-010 preserves archive-backed service Delete. The PRD now adopts those resolved semantics; Product Definition owns reconciliation closeout and cross-domain validation. This UX synthesis is not implementation acceptance or whole-definition readiness.
