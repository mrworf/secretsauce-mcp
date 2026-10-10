# Web console experience proposal — draft 1

**Status:** Unapproved design proposal. No canonical UX authority is published. Product direction and all D-001–D-012 decisions remain settled.

Recommended direction: a calm, moderately dense service console using the existing SecretSauce mark, warm orange actions, neutral surfaces and strong text hierarchy. Show effective state and useful next actions first. Use grouped forms with advanced disclosure, an explicit review page for applying changes, and guided full-page recovery. Navigation and product workflows already specified in the PRD are constraints, not reopened choices.

## Review evidence

| Concept | Inspectable prototype | Preview | What it establishes |
| --- | --- | --- | --- |
| Services and shell | [services.html](services.html) | [desktop](services-desktop.png) | Scan-friendly rows, separate runtime/draft states, one main action, contextual guidance |
| Service editing | [edit.html](edit.html) | [desktop](edit-desktop.png) | Grouped fields, visible active revision, advanced controls, immediate credential replacement clearly distinguished |
| Apply review | [review.html](review.html) | [desktop](review-desktop.png) | Sanitized before/after, affected service and access, impact before apply |
| Recovery after enrollment | [recovery.html](recovery.html) | [desktop](recovery-desktop.png), [390px](recovery-narrow.png) | Calm risk communication, reviewed reactivation, useful narrow-screen recovery |

Open the local HTML in a browser. There are no dependencies, network calls, submitted data, persistence, real credentials, or production implementation. The top proposal bar switches concepts. Native advanced sections expand. Other controls illustrate position and wording and are intentionally inert. Sample services are generic configured HTTP APIs, not service integrations or profile packs. All sample hosts and contact addresses use example.org.

The narrow concept is the same responsive HTML, not a different mobile product. The shell keeps the four established areas visible as wrapping navigation; production account controls must remain reachable at narrow widths (omitted from this representative view). Prototype panels intentionally demonstrate only representative fields; they do not remove any configuration capability.

## Constraints and open direction

Non-negotiable: existing service-first four-area navigation; four roles and server permissions; mandatory authenticator MFA; write-only credentials; preserved advanced matching/scanning/transport features; review/apply separate from immediate access/credential/lifecycle operations; audit fail-closed; restricted restore followed by explicit user/service reactivation; WCAG 2.2 AA; ChatGPT and Codex; self-hosted single instance.

Open for approval: moderate-density calm visual character, list-based hierarchy, in-context advanced disclosure, risk/impact prominence, full-page complex review/recovery and one-column responsive treatment. Exact tokens and component geometry remain designer discretion. No cosmetic alternative was manufactured: all four views form one recommended direction.

## Research and design rationale

Consulted 2026-10-09; these conventions inform the recommendation and do not replace Product Owner approval:

- [IBM Carbon data-table guidance](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines): aligned resource data, search/filter toolbar and primary action support finding and working with a service. Use a restrained subset; no batch editing or AI features are inferred.
- [GOV.UK check-answers pattern](https://design-system.service.gov.uk/patterns/check-answers/): group answers and provide a deliberate final check before submission. The proposal applies that idea to a sanitized configuration difference and impacts.
- [W3C Reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): preserve readable task content as space narrows. Here forms and differences stack, and status/recovery actions remain visible. Production must satisfy the PRD's full accessibility target.

## Visual inspection

All five PNGs were rendered from the local HTML using installed headless Chromium and inspected directly. Assessed hierarchy, grouping, legibility, status distinction, action prominence and the 390px reflow. The in-app Browser runtime reported its browser unavailable; its troubleshooting guidance was read before using a fresh isolated local headless renderer. Sandbox startup required approved narrow process escalation. This is visual proposal inspection, not browser integration or accessibility certification. No live app was tested.

Known omissions: no exhaustive screen set, authentication ceremony mock, complete policy editor, audit filter interaction, restore preview/re-authentication dialog, detailed role variants or screen-reader testing. Canonical synthesis after approval will specify those shared interaction rules and exceptions from the existing authoritative requirements. These omissions do not imply feature removal or release readiness.

## Review status

Pending UX-DESIGN-001. Explicit approval covers this direction, brief and representative visuals; it is not product implementation approval. Rejection/refinement remains ordinary draft iteration. No canonical revision exists yet.

Gate source: [Product UX Skill](/home/ha/.codex/skills/product-ux/SKILL.md): “Only after approval, synthesize or revise the canonical UX system, its manifest, the approved experience brief, and observable UX conformance checklist.” This initial substantial UI requires the Owner to approve the visible experience before it becomes authority.
