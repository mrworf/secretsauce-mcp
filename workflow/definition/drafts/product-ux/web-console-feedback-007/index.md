# Settings navigation proposal — UX-DESIGN-006

Status: **Approved by the Product Owner — UX-DESIGN-006, REC-DEC-011/012 (“Agreed, do both”, 2026-11-16)**. Proposal revision `feedback-007-draft-1`. This is a bounded extension of approved UX6, not replacement product authority. Confirmed feedback003 remains independently actionable.

Approve these two navigation refinements?

1. **Limits:** replace its expandable groups with five selectable categories, showing one category at a time: Requests & responses; References & retained state; HTTP & authentication; Scanner capacity; Regex workers. These map one-to-one to the existing groups in `src/consoleOperations.ts`; fixed safety boundaries remain readable in HTTP & authentication. Use ordinary location navigation styled like the service section selector, with a labeled select on narrow screens. Preserve unsaved changes, browser navigation, deep links and all-settings atomic review. Benefit: bounded forms; tradeoff: comparing categories takes navigation.
2. **Search:** put a persistent **Search settings** action above Settings navigation. It opens a focused search dialog; result selection closes it, honors the unsaved-change guard and opens/focuses the setting. Benefit: visible access without a persistent results panel; tradeoff: one click before typing.

These implement advisory suggestions PO-FB-183/201. The alternative is to retain a visible inline search field and use in-page Limits section navigation; that exposes more simultaneous content and creates a longer page. The rest of the confirmed corrections do not depend on this choice.

## Representative concepts

- [Limits, desktop](limits-desktop.png)
- [Search dialog, desktop](search-desktop.png)
- [Limits, narrow](limits-narrow.png)
- [Static prototype](settings.html)

Existing approved Feedback002 shell, spacing, cards and typography are reused. No new visual theme. Active categories use the existing warm selection accent. There is no duplicate selected-category heading. Desktop is 1440×1000; narrow is 390×844. Screenshots were rendered with local headless Chromium and inspected; the initial narrow navigation overlap was corrected before final captures. These are synthetic representative concepts, not runtime acceptance. Prototype category buttons and result links illustrate structure, not implemented navigation or validation. Full keyboard and assistive-technology qualification belongs to delivery.

Sample fields, values and units in the prototype illustrate layout only. They do not authorize new capacity settings, rounding, unit conversions, changed defaults or altered limit semantics; preserve the exact supported configuration values and capabilities.

## Required behavior if approved

A category/search transition never silently saves, applies or discards edits. Search is role-scoped and indexes non-secret labels/help/technical aliases only. Loading, empty results and errors are distinct. Keep queries entered during index loading. Search cancellation returns focus to its trigger; chosen results focus the destination field. Do not stack search and unsaved-change dialogs. Preserve all supported settings, exact values and direct correction links. Unknown outcomes, read-only roles and inaccessible settings retain current rules. These changes do not remove every advanced disclosure elsewhere in the product.

## Source and approval

Sources: approved `product/ux/manifest.yaml` UX6; PO-FEEDBACK-2026-10-18-003 items182–183/199–201; bounded audit UX-AUDIT-2026-11-16-001. Audit04 is recommendation only. Approval: recorded in workflow/definition/decisions.md; stable question UX-DESIGN-006 groups reconciliation choices REC-DEC-011 (Limits) and REC-DEC-012 (search), each independently answerable. The question is orchestrator-owned.
