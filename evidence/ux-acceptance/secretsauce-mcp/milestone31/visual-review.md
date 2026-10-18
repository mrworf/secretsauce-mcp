# M31 visual and interaction review

Authority: UX4 / UX-DESIGN-004, UX-IN16/C49, V05/V06, A07, R06, C42/C53. Approved references: `workflow/definition/drafts/product-ux/web-console-feedback-003/policy-desktop.png`, `policy-narrow.png`, `rule-dialog.png` and `policy.html`. Historical proposal banners are not product UI.

Actual evidence comes from the production console script served by an isolated self-signed HTTPS gateway and driven by Chromium. No mock UI or production deployment is used. `scripts/verify-console-policy-dialogs-browser.mjs` reproduces the captured states. The list screenshot uses three representative rules, matching the reference count; the interaction fixture adds a fourth tied Allow rule to verify actual evaluation order. Extra host/regex/custom-method details are intentional fixture data.

| Aspect | Comparison / outcome |
| --- | --- |
| Shell / width | Retains approved light gray workspace, 200px main navigation, full horizontal content, section rail and Guided/Advanced control. No new shell or duplicate configuration heading. |
| Grouping / hierarchy | Separate white Who can use / Request rules cards, default policy and order help, Add above distinct rows, description then criteria/methods, effect/priority, concise contextual Edit/Delete. Three-rule desktop and 390px states visually reviewed. |
| Controls / typography / color | System type scale, dark slate copy, muted help, rust primary actions, outlined secondary actions and green/red state chips remain consistent. Required priority cue and field-local help present. |
| Rule dialog | 640px bounded white modal, two-column desktop fields, selected common methods, Cancel and primary Keep footer, close action, backdrop. Same Add/Edit component. Advanced settings tab supplies the approved reachable full options without extending the main page. Extra tab/HEAD/OPTIONS/custom-method explanation makes the implemented dialog taller than the illustrative base form; one focused task remains visible at desktop. |
| Narrow | Description, effect/priority and actions stack in the approved order; Edit/Delete share width. Movement controls explain actual peer boundaries. 390px/320px captures, no horizontal document overflow. |
| 200% text | Every computed text size doubled at 320px. Document width and visible text ranges checked, not only boxes. No clipping/overflow; modal footer can be focused and scrolled into view. |
| Keyboard | Initial focus on Explanation, bounded Tab/Shift-Tab, linked local errors, Escape/Cancel restores invoking Edit/Add focus and prior dirty badge; Keep returns to the edited row. |

Movement controls and the Advanced tab implement explicit requirements not fully illustrated in the static reference. Current Safe policy tester keeps its existing route; its modal conversion belongs to M33. Existing service header and footer wording are retained from M27. These are scoped implementation/data differences, not new product exceptions. No material unapproved visual drift remains in the M31 authoring surfaces.
