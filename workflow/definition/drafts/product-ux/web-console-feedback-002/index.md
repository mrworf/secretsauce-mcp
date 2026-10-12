# Feedback 002: proposed console direction

**Awaiting UX-DESIGN-003 approval.** Revision feedback-002-draft-1. This is not active UX authority; UX2 remains the approved revision.

Recommended: populated forms, clearer current/pending/unsaved state, wider useful layouts, and a compact People list leading to full account detail. See [design contract](design-contract.md), [experience brief](experience-brief.yaml) and [primary-source research](research.md).

## Representative concepts

- [Email desktop](email-desktop.png) · [open concept](email.html): current non-secret fields already populated; blank replacement password; test uses applied settings.
- [Unencrypted SMTP](email-unencrypted-desktop.png) · [open concept](email-unencrypted.html): explicit None selection and visible risk before review.
- [Backup changes saved](backups-desktop.png) → [review all changes](review-desktop.png) → [applied result](applied-desktop.png): saved is not active; complete-scope review; successful activation separate from cleanup. [Open sequence](backups.html).
- [People list](people-desktop.png) → [account detail](person-desktop.png): one row per user and focused editing/recovery/metadata. [Open concept](people.html).
- [Add service](service-desktop.png) · [open concept](service.html): non-overlapping repeated destinations, required markers, field help and useful context panel.
- [Diagnostics](health-desktop.png) · [open concept](health.html): populated current value and separate live health status.
- [Narrow email](email-narrow.png), [narrow people](people-narrow.png): reflow without losing the account-detail path.

## Scope and limitations

The concepts use synthetic example.org data and Owner permissions. Administrator restrictions are specified in the design contract. Existing service wizard, recovery, audit, import, advanced configuration and role boundaries remain; this proposal does not remove those capabilities. Ordinary geometry/wording can be refined without reapproving every pixel. There is one consequential direction request, not multiple cosmetic variants.

These local HTML concepts demonstrate composition, not a working console. Navigation connects representative static states; form buttons are illustrative, and the review specimen shows backup/diagnostic changes rather than dynamically collecting the Email specimen. Production must disable no-op submission and use actual persisted/current values. No live instance was inspected or changed.

Local Chromium rendered the concepts. `render-checks.json` records document width and text-range checks at 320 CSS pixels with explicitly enlarged text; direct visual inspection checked layout, hierarchy and legibility. This is not implementation acceptance or complete WCAG certification.

## Review history

- 12 October 2026: feedback-002-draft-1 proposed after confirmed Administrator expansion and unencrypted SMTP direction. Approval pending; no canonical UX revision published.
