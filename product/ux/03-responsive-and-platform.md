# Responsive and platform behavior

## UX-R01 — Reflow and priority

Desktop uses a persistent side navigation and fluid working canvas with useful related columns. Service edit may use a secondary section/help rail. On narrow screens, reflow to one main column; move navigation into a compact wrapping menu or keyboard-operable menu while keeping current location, My account and logout reachable. Keep heading, status and task action before secondary explanations. The 390px approved recovery concept demonstrates the intended reading order and risk prominence; its omitted account control must be supplied in implementation.

Service rows become labeled stacked records retaining name, lifecycle, draft/exception state and next action. Full details remain accessible. Before/after comparisons stack with explicit Current and Proposed labels; never rely on column position or color after reflow. Fields stack without clipping long URLs; advanced editor and intrinsically two-dimensional content may use their own labeled scroll area without causing whole-page horizontal scrolling.

At 320 CSS pixels (including equivalent zoom) routine text/forms/navigation reflow without horizontal page scrolling or clipped actions. Essential monitoring, disable/revoke, password/MFA and restore/recovery remain usable at narrow widths with the same checks. Advanced authoring can require more scrolling, not hidden or removed capabilities. Do not create a reduced-permission mobile role.

## UX-R02 — Input and control placement

Use appropriate URL/email/numeric input affordances while preserving paste and password-manager behavior. Touch targets meet WCAG 2.2 target-size or spacing rules; primary controls aim for roughly 44px usable height as demonstrated. No operation depends on hover, precision drag, swipe, or pointer-only menus. Actions wrap or stack in logical order; focused fields/actions must remain visible above virtual keyboards. Sticky bars, if used, cannot obscure content/focus or displace final review text.

## UX-R03 — Platform invariants

Browser refresh/back cannot repeat an apply, consume enrollment proof by GET, reveal stale secrets, or restart an in-flight restore. Navigate back through safe non-secret state; after authentication/recovery transitions reload current permissions. No offline execution or local secret persistence. Across desktop and narrow layout, status, review scope, audit restrictions and auth requirements are identical. Standalone client instructions distinguish console origin from the full MCP URL and explain network reachability without assuming public hosting.


## UX-R04 — Focused Settings reflow

Use the approved secondary section rail on desktop and an ordinary labeled Settings section selector on narrow layouts. Preserve the same six destinations, selected scope, search, change-state summary and full-scope review action. Only current-section content is rendered; section content may scroll as needed. Do not make navigation require horizontal scrolling or clip headings/actions. Labels, status badges and long technical text wrap; verify document scroll width and visible text ranges at 320 CSS px and enlarged text, not component bounds alone. Review groups stack without losing section/current/proposed labels. All fields and advanced disclosures retain keyboard reachability and the same safety checks.

## UX-R05 — Approved wider forms and compact account rows

Use the desktop width like feedback 002: persistent primary rail, Settings section rail when relevant, then substantial form content with related status/help alongside where useful. Avoid an unnecessarily narrow centered column, stretched short inputs or empty filler panels. At reduced width move related panels below forms, then stack fields; account detail remains a full page. On narrow screens preserve one row per account with Account and Role, keeping secondary status/date in reachable detail rather than expanding each list row into an edit card. All role-permitted actions stay reachable.

Match representative 1440px desktop and 390px narrow concepts in composition; also verify 320 CSS px and enlarged text using both document width and visible text ranges. Headings, action groups, step labels and help must wrap without clipping or overlap. Review before/after labels remain unambiguous when stacked.


## UX-R06 — Service sections and focused tasks

Feedback 003 extends the approved wide shell: compact full-width service rows, secondary Configuration navigation and paired related fields. At narrow width use wrapping section navigation and stacked field groups; preserve identity, independent status, all permitted row actions and import recovery. Dialogs fit the viewport and scroll within usable bounds, keeping their title, action context and focused inputs accessible. No nested fold-outs or stacked modal tasks. Verify 320 CSS px, 390px and desktop concepts plus enlarged text; inspect both element boxes and text ranges, not only document width. Keep literal hosts/patterns inspectable without losing distinguishing content.


## UX-R07 — Service comparison reflow

Changes uses aligned Before/After columns at wide widths. At narrow widths stack Before then After within each field/item pair; never collect all Before values separately from all After values. Repeat labels so scope remains clear. New settings uses two columns of named section cards when space permits and one column otherwise. Retain complete values, section headings, review identity, exception summary and action bar; wrap exact unbroken literals without clipping or horizontal page scrolling. Compare 1440px and 390px representative states and enlarged text against approved feedback 004 concepts.

Confirmation fits the viewport with reachable Cancel and Continue. A long list may scroll inside the bounded dialog; every exception remains individually visible/reachable without nested accordions or hidden acknowledgment controls. Narrow layout does not remove supported settings or weaken acknowledgment requirements.


## UX-R08 — Refinement reflow

At every width, New settings precedes Changes in reading and focus order. Review exception bullets wrap in the existing full-width exception surface; do not hide, clip or collapse them on narrow screens. The neutral scanning-override badge wraps within its own rule row and remains distinguishable from risk warnings without displacing Edit/Delete. Removing the guided destination preserves direct navigation and safe Back/Forward under UX-IN15. Retain 320 CSS px, 390px and enlarged-text checks for both document and text-range overflow.

## UX-R09 — Settings category and search reflow

At wide widths retain the Settings rail, visible search action and a wrapping row of the five Limits category links above a substantial form canvas. Use related field columns only where readable. On narrow screens keep Search settings directly before the existing labeled Settings section select, and use a second labeled Limit category select within Limits. Do not squeeze either navigation into clipped horizontal tabs or repeat the category title. Search dialog fits the viewport, scrolls when needed and keeps the input, result context and Cancel reachable. Every category/field and permission boundary remains available; no reduced mobile capability.

Compare approved feedback 007 desktop 1440px and narrow 390px states, plus 320 CSS px and enlarged text. Inspect document width and text-range overflow, keyboard focus visibility, wrapped category labels and action groups. New validation markers remain attached to their section names and do not overlap adjacent navigation.

## UX-R10 — Footer, credential cards and Activity reflow

Settings footer stays visible while editing without covering the final field, errors, dialogs or keyboard focus. Reserve layout space; at narrow widths wrap status/actions in logical reading order rather than clipping labels or reducing reachable actions. White footer, existing border/spacing and restrained primary button remain consistent across Settings; exceptional audit/recovery notices stay visible independently.

Credential cards stack vertically with their own removal/value controls; Add follows the last card. Policy default/explanation use two useful columns when space permits and stack control then explanation on narrow screens. Activity Field/Comparison/Value/Add align as a compact form on desktop and stack in the same order when narrow; chips wrap, long literals remain inspectable and each removal target is reachable. Time fields/presets and Search/Clear wrap without overlap. Count and Export activity remain visually associated. Duplicate modal fits the viewport with clear return focus. Verify 320 CSS px, 390px, desktop and enlarged text using document and text-range overflow checks.
