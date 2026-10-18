# M25 import recovery visual acceptance

Authority: UX4 / UX-IA10 / UX-C51, UX-V05/V06, UX-A07/R06 and UX-C42/C53. References remain unchanged at `workflow/definition/drafts/product-ux/web-console-feedback-003/import-recovery-{desktop,narrow}.png` and corresponding HTML. Reviewed actual screenshots against both reference images after browser execution.

The matching state is DNS manager, Draft with one remaining `admin` mapping, no live configuration, Owner, empty eligible-account selector. The representative journey initially imports two services and two subjects, corrects one, then captures this matching state. The extra affected-service line is necessary real context; it is not a new workflow. Screenshots contain synthetic identities and URLs only.

| Dimension | Comparison and outcome |
|---|---|
| Desktop 1440 CSS px | Same broad workspace, left navigation, full available content width, service tabs, amber warning, two-column mapping card, source box, action divider and remaining-setup card. Cards use the reference's 22px padding, 20px field gap, 9px radius, muted helper copy and warm primary control. Corrected initial back-link/title order, missing status chips and source-value box after visual inspection. |
| Narrow 390 CSS px | Fields stack, controls remain usable, callout and source field wrap, service tabs remain distinct. Approved horizontal spacing and card treatment retained. Shell uses the existing production header/rail order, without the prototype-only proposal banner; the focused import surface retains the approved hierarchy. |
| 320 CSS px and 200% text | Actual computed text sizes doubled for every element. Document width, component boxes and text ranges checked; no horizontal overflow or clipped headings/source text. Native select opens its option list for full choice text. The image is tall because enlarged text reflows, not because ordinary settings were expanded. |
| Keyboard | Tab/Enter reaches each mapping action and selector; partial mapping returns focus to the view heading. Stale result offers focused refresh; review reached without pointer use for the mapping operations. Focus outlines retained. |
| State and permission | Two unresolved rows reduce to one then none; no implicit mapping from assignment selection. Auditor sees named source context and a read-only message, no Save action. Archived drafts explain restoration to Disabled and expose no mapping mutation. Saving one mapping retains other deliberate unsaved mapping selections. |

Actual images: `import-recovery-desktop.png`, `import-recovery-narrow.png`, `import-recovery-text200.png`. Browser assertions and outcomes: `browser-report.json`. No material unapproved focused-view drift remains. General service overview/editor redesign is outside M25 and remains assigned to later milestones.
