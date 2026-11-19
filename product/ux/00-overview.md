# SecretSauce web console UX system

**Authority:** Approved UX revision `web-console-ux-11`, preserving the established visual direction and applying confirmed PO-FB-282–289 under PO-REFINEMENT-016 and REC016. [Manifest](manifest.yaml) routes the exact current sources and [experience brief](experience-brief.yaml); the [decision ledger](../../workflow/definition/decisions.md) records accepted intent. Earlier approved concepts remain appearance references with the explicit delta precedence below; their historical labels and image bytes are unchanged.

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


## UX-G06 — Approved service review direction

UX-DESIGN-005 approves the [feedback 004 representative visuals and interaction contract](../../workflow/definition/drafts/product-ux/web-console-feedback-004/index.md), with approval recorded in its [immutable-revision sidecar](../../workflow/definition/drafts/product-ux/web-console-feedback-004/approval.yaml). Service review uses paired Before/After groups in Changes, complete section cards in New settings, and a concise approval dialog with individually required security acknowledgments. Preserve UX4 shell, typography, moderate density and warm accent; this is a bounded service-review change, not a redesign of global Settings or SMTP. Prototype labels remain historical and prototype actions do not establish runtime behavior.

W3C [tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) and [modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) guidance consulted 18 October 2026 informs keyboard and focus mechanics. UX5 publishes design authority only; downstream implementation acceptance and cross-domain freshness remain separate.


## UX-G07 — Confirmed service-review refinements

PO-REFINEMENT-010 and confirmed PO-FB-138/140/145/146, resolved by REC-RUN-010, refine the already approved UX4/UX5 experience. New settings is first/default, actual exception bullets appear before approval, the standalone guided Secret detection destination is removed, and any explicit rule scanning override is identified. These exact directions supersede the corresponding details in feedback 003/004 concepts; preserve all other composition, controls, density, styling and responsive behavior. The original approved images remain immutable visual references, not a requirement to restore the superseded tab order, empty guided destination or summary-only warning. No new overall design direction or consequential choice is introduced.

The optional slider PO-FB-147 was evaluated without adopting it: a fixed scale cannot faithfully represent all supported saved sizes, and disabled scanning is distinct from a zero size. Retain the existing value/unit or supported unlimited interaction and local validation contract (UX-IA06/UX-IN16); do not round imported values, introduce a new maximum, or reinterpret zero. Future slider design can be considered separately. This records the suggestion's disposition, not a new implementation requirement or a claim that invalid input was accepted.

## UX-G08 — Approved consistency corrections and Settings navigation

UX7 adopts confirmed PO-FB-149–201 as resolved by REC-RUN-011 and the Product Owner's **“Agreed, do both”** approval of UX-DESIGN-006 (REC-DEC-011/012). The [feedback 007 concepts](../../workflow/definition/drafts/product-ux/web-console-feedback-007/index.md) approve five Limits categories and a persistent Settings search action/dialog. Preserve the approved UX4/UX5/UX6 shell and visual character. These exact changes supersede older references showing a fifth service Review placeholder, inline SMTP password editing, visible configuration-history UI, folded short Settings effects/health/retention or bottom-only search. Other reference content remains unchanged; approved image bytes are never rewritten to hide drift.

The shared pattern is visible decision information and focused work, not removing every advanced disclosure. New/imported/existing service corrections use the same precise validation and four-section progression. Settings retain their complete-scope review and draft lifecycle. SMTP dialog Set/Replace saves pending work; service credential changes and eligible SMTP Clear remain immediate under UX-EX03. [The bounded shared-pattern assessment and primary-source SMTP research](../../workflow/definition/results/feedback7-ux-assessment.md) inform these choices, not permissions or credential timing.

The runtime audit remains incomplete evidence rather than conformance certification. Uninspected mapping, SMTP and accessibility states must be qualified during implementation. Prototype sample values/units are illustrative and authorize no rounding, new limits or semantic change.

## UX-G09 — Confirmed Settings, credentials and Activity refinements

PO-REFINEMENT-013 and confirmed PO-FB-202–237, adopted by REC-RUN-013, refine the approved UX7 system without a new visual direction: one persistent Settings footer; named bordered credential cards with explicit configuration versus value actions; compact policy explanation and access wording; shared Activity filter chips; and task-appropriate existing evidence-export locations. UX8-ACTIVITY-SEMANTICS records delegated matching semantics now adopted in AUDIT-02.a/b. These sources settle the composition and interactions; no unanswered direction choice remains.

Preserve manifest-routed UX7 and earlier approved concepts, colors, width, cards, spacing and density. This exact delta supersedes duplicate Settings status bars, ambiguous credential availability/removal labels, repeated policy explanations, old single-value Activity controls and unrelated Activity export actions in older references. The current event-result card/details presentation remains. Do not modify approved image bytes to legitimize drift. Runtime acceptance must compare equivalent states against preserved references plus these explicit delta rules.

This is a shared-pattern correction: all editable Settings sections including multi-form pages use one status/action owner; service credential summaries/editors use the same set/not-set wording and distinct mutation timing; main and per-service Activity share one filtering mechanism and permission-safe export behavior. Account-security actions, restore maintenance, SMTP timing and service review confirmation retain justified exceptions under UX-EX01–05. No new service capability, permission, mutation timing, saved-search persistence or frozen evidence snapshot is added.


## UX-G10 — Service editing consistency refinement (UX9)

Confirmed PO-FEEDBACK-2026-11-18-002 (238–264) and UX9-SERVICE-SEMANTICS/S9-01–05 refine only shared service navigation, footer, review/discard, lifecycle/readiness and import behavior. Reuse the approved Settings white persistent footer and existing shared service header, section navigation, grouped review and modal patterns. No new visual family or direction choice is introduced. UX-G10 supersedes prior Continue/Back-to-Services controls, mapping flows, Draft-as-lifecycle and readiness-blocked review entry in older prose/concepts; all other approved appearance remains authoritative. Images are historical appearance references and are not edited to represent the new delta.

Equivalent surfaces assessed: new/imported/existing Guided and Advanced editors; Overview/Configuration/Access/Activity shared header; Services rows; Settings footer as conforming shared pattern; grouped review and navigation guards. Preserve justified immediate service value/access operations and different staged SMTP timing. Definition synthesis is not runtime conformance certification.


## UX-G11 — Clear credential, deletion and recovery tasks (UX10)

Confirmed PO-FEEDBACK-2026-11-19-001 and REC-RUN-015 refine the existing system: a nonblocking no-access advisory; named credential-removal button/dialog and Apply-bound value cleanup; typed Archived permanent deletion; plain shared helper/recovery wording; compact sign-in; stable Settings loading composition; and removal of duplicate Overview-to-Configuration actions. D10-01–05 govern the deletion boundaries. This delta supersedes only the old text-link/removal-retains-value promise, no-permanent-delete statement and named redundant actions. UX-G10 and earlier approved composition, density, color, cards, footer and modal family remain authoritative.

No new visual concept or authentication flow is introduced. Login uses the existing short-input/task-form pattern rather than the broad administration canvas; ordinary recovery-code sign-in remains distinct from replacing an authenticator. Shared credential task consistency covers Guided/Advanced removal, value dialogs, SMTP and equivalent password forms, while UX-EX03 retains their different mutation timing. Delivery must compare actual matching populated, confirmation, loading/error and wide/narrow states; this synthesis is not runtime acceptance.

## UX-G12 — Bounded UX11 refinement precedence

REC016 and U11-01–05 supersede only prior assignment location, service Authentication width, deletion challenge delimiters and redundant Default policy helper. Dedicated Access owns proposed initial assignments and current immediate assignments without changing their timing. Configuration section four is Request rules. Preserve all earlier approved appearance references and unrelated UX10 semantics; historical prototype Access & policy labels are not current navigation authority. Delivery must compare actual affected states; this definition revision is not runtime acceptance.
