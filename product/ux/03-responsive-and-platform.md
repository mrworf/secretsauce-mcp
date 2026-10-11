# Responsive and platform behavior

## UX-R01 — Reflow and priority

Desktop uses a persistent side navigation and spacious main working column. Service edit may use a secondary section/help rail. On narrow screens, reflow to one main column; move navigation into a compact wrapping menu or keyboard-operable menu while keeping current location, My account and logout reachable. Keep heading, status and task action before secondary explanations. The 390px approved recovery concept demonstrates the intended reading order and risk prominence; its omitted account control must be supplied in implementation.

Service rows become labeled stacked records retaining name, lifecycle, draft/exception state and next action. Full details remain accessible. Before/after comparisons stack with explicit Current and Proposed labels; never rely on column position or color after reflow. Fields stack without clipping long URLs; advanced editor and intrinsically two-dimensional content may use their own labeled scroll area without causing whole-page horizontal scrolling.

At 320 CSS pixels (including equivalent zoom) routine text/forms/navigation reflow without horizontal page scrolling or clipped actions. Essential monitoring, disable/revoke, password/MFA and restore/recovery remain usable at narrow widths with the same checks. Advanced authoring can require more scrolling, not hidden or removed capabilities. Do not create a reduced-permission mobile role.

## UX-R02 — Input and control placement

Use appropriate URL/email/numeric input affordances while preserving paste and password-manager behavior. Touch targets meet WCAG 2.2 target-size or spacing rules; primary controls aim for roughly 44px usable height as demonstrated. No operation depends on hover, precision drag, swipe, or pointer-only menus. Actions wrap or stack in logical order; focused fields/actions must remain visible above virtual keyboards. Sticky bars, if used, cannot obscure content/focus or displace final review text.

## UX-R03 — Platform invariants

Browser refresh/back cannot repeat an apply, consume enrollment proof by GET, reveal stale secrets, or restart an in-flight restore. Navigate back through safe non-secret state; after authentication/recovery transitions reload current permissions. No offline execution or local secret persistence. Across desktop and narrow layout, status, review scope, audit restrictions and auth requirements are identical. Standalone client instructions distinguish console origin from the full MCP URL and explain network reachability without assuming public hosting.


## UX-R04 — Focused Settings reflow

Use the approved secondary section rail on desktop and an ordinary labeled Settings section selector on narrow layouts. Preserve the same six destinations, selected scope, search, draft summary and full-scope review action. Only current-section content is rendered; section content may scroll as needed. Do not make navigation require horizontal scrolling or clip headings/actions. Labels, status badges and long technical text wrap; verify document scroll width and visible text ranges at 320 CSS px and enlarged text, not component bounds alone. Review groups stack without losing section/current/proposed labels. All fields and advanced disclosures retain keyboard reachability and the same safety checks.
