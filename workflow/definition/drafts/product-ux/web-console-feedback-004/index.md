# Service review visual proposal

Proposal revision: feedback-004-draft-1. Awaiting UX-DESIGN-005. Synthetic data only; no production changes.

Recommended direction: Changes uses aligned Before/After groups and labeled change colors; New settings uses a complete section-card view. On narrow screens each comparison pair stacks. Approve changes opens a short confirmation, with individual security acknowledgments when required. Preserve the approved UX4 appearance throughout.

- [Interactive prototype](review.html) — switch tabs and open/cancel confirmation; `?noexceptions` demonstrates the no-exception dialog.
- [Changes, desktop](changes-desktop.png) / [narrow](changes-narrow.png)
- [New settings, desktop](new-desktop.png) / [narrow](new-narrow.png)
- [Security acknowledgment, desktop](exception-dialog-desktop.png) / [narrow](exception-dialog-narrow.png)
- [No-exception confirmation](no-exception-dialog-desktop.png)
- [Exact interaction and state contract](design-contract.md)

Sources: confirmed feedback PO-FB-125–137; resolved REC-RUN-009 findings035–037; current CONFIG-03/POLICY-04 and UX-IN02; approved UX-DESIGN-004 visual system. No competing cosmetic variants are needed. No new capability, permission or activation semantics are proposed. Pending approval covers comparison composition, responsive stacking and confirmation presentation; routine geometry and accessibility mechanics are designer discretion.

Visual review: inspected desktop comparison, full-settings and desktop/narrow dialog renders directly. Existing warm accent, pale neutral background, white bordered cards and readable dark typography are retained. Distinct section headings and low-saturation change cells separate content. Browser checks found no horizontal page overflow at 1440/390px, no document or text-range overflow in the 200% text sample, gated Continue until both required exceptions were checked, enabled Continue without exceptions, and restored focus after Escape. These are proposal-only checks, not implementation acceptance.

Known omissions: screenshots use one short synthetic configuration and two required TLS exceptions, not every supported option or failure. The design contract specifies complete values, list order, absent baseline, no-change, multiple exceptions, stale/unknown outcomes and safe TLS labels. No production code or backend interaction is included.

Research (accessed 2026-10-18): [W3C tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) informs selected-state and keyboard mechanics; [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) informs modality, initial focus and return focus. These conventions inform mechanics, not Product Owner approval of composition.

Review history: proposed under Product Definition targeted revalidation; no Product Owner review of these renders yet. UX-DESIGN-005 is the sole outstanding visual direction approval.
