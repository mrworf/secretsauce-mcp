# M38 visual acceptance

PASS against manifest UX6 / UX-G07, UX-V08/R08/A09/C60/C63. Actual isolated HTTPS Chromium; synthetic example.org data. Input hashes recorded in QA tested-inputs.json.

Compared final/new-desktop.png and changes-desktop.png (1440×1000), new-390.png and changes-390.png (390×844), plus 320px and 320px/200% text captures, against approved feedback-004 new-desktop/new-narrow and changes-desktop/changes-narrow. Exception/no-exception dialogs preserve approved feedback-004 dialog family. UX6 intentionally replaces the count/disclaimer with complete bullets and M37 swaps the tab order; those superseded reference details are not defects.

Existing wide content, white bordered grouped cards, warm primary accent and pale exception surface remain. List grows naturally within the bottom surface; each risk retains its own bullet, with readable spacing and wrapping. No hover/disclosure required. None, one and three exception states are captured. Narrow layout stacks existing groups; all list text remains available. Browser checked document scroll width and visible text-range overflow at 320px with 200% text; no overflow. Heading focus, focus trap, Escape/Cancel and selected tab restoration pass. No additional visual exception or new design family.

Source renderer uses text nodes for bullet labels; hostile HTML-like explanations remain inert and safe URL labels omit userinfo/query/fragment. Exact independent modal checkboxes remain unchecked after reading. Runtime screenshots do not establish real external ChatGPT/Codex connectivity; existing external-client qualification exception remains.

Root independently inspected the desktop screenshot, production diff and persisted plans: visual direction and readable exception bullets match approved styling; no issue found.
