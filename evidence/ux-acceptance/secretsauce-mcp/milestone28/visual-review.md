# M28 visual and interaction review

Result: PASS for REC-RM-019 / UX-IN15, C46, V05/V06, A07, R06, C42/C53. References are the approved UX4 `destinations-desktop.png`, `destinations-narrow.png`, `destinations.html` and `destination-options.html`, under `workflow/definition/drafts/product-ux/web-console-feedback-003/`. Hashes are recorded by the browser report. Reference HTML was rendered at the same 1440×1031 viewport; original full-page PNGs and 390px narrow reference were also inspected. Screenshots are full page, not crops.

## Comparison

- **Width/hierarchy:** same 200px main rail, full horizontal workspace, service tabs, one Guided/Advanced switch and selected section rail. Allowed servers and visible Certificate verification are separate cards. Exact matching uses one ordinary selector; matching literals are exposed when relevant and in the focused advanced Host matching view.
- **Typography/spacing/color:** system text, 29px title, 20px card headings, muted short help, thin cool borders, white cards on pale background, rust primary action/selected location. Desktop paired fields and narrow stacked fields retain reference hierarchy. Active chip is green with text. No repeated global advanced links or nested fold-outs.
- **Options:** same selected-host title, return link, two-column connection fields, certificate choice and destination reference, Cancel/Keep action footer. Initial generic array rows made the view too tall; corrected to compact domain rows with inline remove/reorder and concise Add controls. Host matching is a separate focused pane. The extra array/default controls preserve supported capabilities omitted from the concept's static inputs; they do not flatten all configuration into one page.
- **Honest differences:** fixture is Assigned example / Active revision 0 rather than Container manager / revision 4 with a pending draft. Existing accepted shell places account context above narrow navigation and retains existing footer labels Save draft/Review & apply plus Back to Services. Required legend and actionable errors are implemented production behavior. Historical proposal banners/notes are absent. Complete-page captures retain these differences for review; no scoped visual waiver is claimed.

## Interaction and responsive evidence

`destinations-desktop.png`, `destination-options-desktop.png`, `host-matching-desktop.png` and each corresponding `-390`, `-320`, `-320-text200` cover ordinary, connection and host views. The 200% test doubles every computed text size and checks document width and visible text ranges, not only component boxes. No horizontal overflow/clipping found.

Keyboard reaches advanced settings; title receives focus on entry, Keep/Cancel returns focus to the selected server action, repeated server/host/port additions focus the new control. Text status distinguishes inheritance/override and HTTP without relying on color. Invalid fields link to labels; required controls have native semantics and visible cues. Auditor has read-only scope; unknown save outcome offers durable-state inspection. Browser-report.json records functional outcomes and hashes.
