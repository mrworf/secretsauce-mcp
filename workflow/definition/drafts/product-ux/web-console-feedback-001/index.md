# Settings direction for review

**Proposal:** feedback-draft-1. **Approval:** pending UX-DESIGN-002. **Scope:** REC-DEC-002, PO-FB-008/009/011. This is not active UX authority.

Recommended: keep the approved visual language and four global areas; show six named Settings destinations in a secondary rail with one section visible at a time. Use a labeled selector on narrow screens. Provide readable applied summaries and friendly controls, with exact advanced capabilities one disclosure away. Preserve one draft and make every changed section visible before review/apply.

Review [Settings desktop](settings-desktop.png), [Email desktop](email-desktop.png), [narrow Settings](settings-narrow.png), and [review scope](settings-review.png). Open [interactive layout concept](settings.html) to switch sections; only Response protection and Email have representative fields. Other destinations are labeled placeholders, not proposed empty screens. Search/save/review use explicit demos; no production API or data is accessed.

The [experience brief](experience-brief.yaml) distinguishes settled owner feedback from the proposed arrangement. The [design contract and complete capability map](design-contract.md) specifies navigation, search, draft transitions, friendly controls, read summaries and implementation validation obligations.

## Consequential choice

Approve the compact section navigation and summary-first, form-based direction. An alternative, if desired, is horizontal section tabs with wrapping/overflow handling; it preserves the same scopes but is less legible for the six long section labels. This alternative is not necessary for function and is not a competing visual redesign. The Product Owner's “probably sub tabs” remains an exploratory suggestion.

The existing UX-DESIGN-001 approval establishes visual character; it does not explicitly approve this new Settings navigation and cross-section review composition. Product UX requires: “Seek Product Owner direction when a choice materially affects comprehension, task structure, navigation, information priority ... consequential interaction.” One approval covers these representative concepts and the bounded brief; routine control labels and spacing remain designer discretion.

## Inspection

Rendered the local HTML with installed Chromium in a headless browser and inspected desktop and narrow screenshots directly. Desktop preserves restrained accent, clear active navigation, grouped hierarchy, readable applied/draft distinction and subordinate expert editor. Narrow view retains all six destinations via a labeled selector, account/logout, content and actions with wrapping. Response protection is one focused page; it does not include all other Settings groups. A section may still scroll when its content warrants it.

No production UX conformance, assistive-technology certification or implementation correctness is claimed. Existing implementation, PRD, canonical UX, package and workflow state are not modified by this proposal. Final reset/deletion authority integration belongs to the later canonical UX pass after reconciliation and this direction decision.
