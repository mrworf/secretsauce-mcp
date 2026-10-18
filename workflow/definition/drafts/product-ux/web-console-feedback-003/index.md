# Service configuration proposal — Feedback 003

**Awaiting approval (UX-DESIGN-004).** This is a focused extension of the approved UX3 appearance, not active product authority. Recommended direction: compact status rows, one configuration section at a time, a global Guided/Advanced switch, and focused credential/rule dialogs.

## Review these representative views

| View | Visual | Interactive concept | What to judge |
| --- | --- | --- | --- |
| Service list | [Desktop](services-desktop.png) / [Narrow](services-narrow.png) | [Open](services.html) | Active + draft visibility, row hit area and lifecycle actions |
| Current configuration | [Desktop](overview-desktop.png) | [Open](overview.html) | Readable groups and current-versus-pending distinction |
| Configuration editing | [Desktop](destinations-desktop.png) / [Narrow](destinations-narrow.png) | [Open](destinations.html) | Focused sections, wide forms, visible certificate default and destination override route |
| Add service | [Desktop](create-desktop.png) | [Open](create.html) | Retained guide with clickable steps |
| Authentication | [Desktop](authentication-desktop.png) | [Open](authentication.html) | Placement explanation, credential metadata and separate immediate actions |
| Credential actions | [Replace](replace-dialog.png) / [Clear in-use value](clear-dialog.png) | Open Authentication and click Replace/Delete | Specific action, consequence and return context |
| Rules | [Desktop](policy-desktop.png) / [Rule dialog](rule-dialog.png) | [Open](policy.html) | Compact list, consistent add/edit, selected methods and clear default policy |
| Import recovery | [Desktop](import-recovery-desktop.png) / [Narrow](import-recovery-narrow.png) | [Open](import-recovery.html) | Name the unresolved identity, map it locally and retain draft work |

Additional linked concepts illustrate Details, Access, Advanced destination settings, Secret detection, full-service Advanced editing and Review. They extend the same direction; they do not introduce separate designs requiring separate approval.

Read the [experience brief](experience-brief.yaml), [interaction contract](design-contract.md), and [primary-source research](research.md). Source constraints include PO-FB-042–124, UX3, CONFIG-01–05, POLICY-01–04, MIGRATE-01–04, STATE-09 and SECRES-08. Service Delete retains archive semantics under REC-DEC-010.

## Review and validation record

- Proposal revision: feedback-003-draft-1. No alternatives manufactured; established directives constrain the recommendation.
- Product Owner review: pending. No approval inferred from the earlier UX3 approval or feedback confirmation.
- Current canonical revision remains web-console-ux-3; no canonical artifacts changed by this proposal.
- Rendered at 1440 × 1000 and 390 × 1000, full-page output. Programmatic checks cover document and text-range overflow plus native dialog Escape. Direct visual inspection covers service list, destinations desktop/narrow, policy, import recovery and clear dialog; white card grouping, warm accents, shell, spacing, hierarchy and legibility match the inherited visual family. Repeated draft chrome was reduced during review.
- Prototype-only checks are in [render-checks.json](render-checks.json). No implementation acceptance or WCAG certification is claimed. A production review must verify all semantic, keyboard, zoom, state and concurrency requirements.
- Omitted from mockups: exhaustive advanced scanner/rule fields, every lifecycle/failure state, actual saves and server validation. These remain explicitly required in the design contract; omission does not remove features.

Approve the experience direction shown here, or identify what should change. Approval would authorize canonical UX synthesis and targeted definition validation; it does not waive security constraints or approve implementation conformance in advance.
