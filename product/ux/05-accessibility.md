# Accessibility intent

## UX-A01 — Semantics and reading order

Target WCAG 2.2 AA under UX-04. Use landmark navigation/main, one meaningful page heading, ordered section hierarchy, associated visible labels/help/errors and descriptive link names. Service tables expose row/column relationships; stacked presentation retains label/value association. Controls retain standard button/link/input semantics. Current navigation and selected tabs expose their state programmatically. Include skip navigation. Icons have accessible names when actionable and are hidden from assistive technology when redundant.

## UX-A02 — Keyboard and focus

All tasks work with keyboard alone, including disclosure, filters, policy editing/testing, reviewing differences, reauthentication and recovery. Focus order follows reading order. On page navigation focus the main heading appropriately; return from a dialog to the invoking control or a sensible successor if removed. Modal confirmations trap focus, offer explicit cancel, and close on Escape where cancellation is safe. Full-page installation/recovery is not an inescapable modal. Do not nest dialogs.

Reveal invalid collapsed fields and focus the error summary on failed submission. A stale-draft notice links to changed settings/review without losing the user's position. Visible focus meets contrast and remains unobscured by sticky UI or virtual keyboards. Reordering, if later offered, has keyboard controls and explicit priority semantics; drag-only operation is insufficient.

## UX-A03 — Perception and announcements

Meet contrast for text and interface states; disabled explanatory text remains readable. Do not rely on color, animation or tooltip-only instructions. Announce meaningful completion/error/progress through appropriate status/alert regions, without repeated unchanged announcements or focus theft. Maintain persistent visual results alongside transient notifications. Unknown operation results are announced as unknown, not success.

Support text resize/zoom and reflow, reduced-motion preferences, readable long identifiers, and screen magnification. Do not use unnecessary animation; if progress animates, its text still communicates state. Captchas or cognitive puzzles are not part of the approved authentication design. Password managers, paste and recovery-code entry remain supported.

## UX-A04 — Authentication and time bounds

Authenticator setup provides a manual seed alternative to the QR code in the same protected enrollment step; clear accessible instructions explain code confirmation and recovery-code storage. Never require QR scanning as the only setup route. Inputs support appropriate autocomplete and code paste while security controls remain authoritative. Warn of an approaching session/action expiry when it is known and actionable; do not silently extend security lifetimes. Expiry messages preserve safe task context and give the authorized sign-in/reissue/recovery route. Secret proof, codes and seeds never enter announcements, error logs or general notifications.

These are observable requirements for implementation and later audit. Static prototypes and this definition pass do not certify assistive-technology or WCAG conformance.


## UX-A05 — Settings and assisted-reset focus

Settings destinations are navigation links with current-page semantics, not ARIA tabs for separate pages. The narrow selector has a visible label and current value. Search results name section/field; selection follows the unsaved-work guard, opens the required disclosure and focuses the target field or readable value. Linked cross-section error summaries follow the same safe transition. Preserve focus and safe draft work after stale-state errors. Distinct password/factor reset confirmations and restricted enrollment announce the correct consequence and status without secret proof/factor contents. Return cancelled confirmations to their invoking control; forbidden or removed targets use a safe successor.

## UX-A06 — Required input and account-list semantics

Mandatory indicators include visible symbol and legend plus required semantics; help and errors are associated with their controls. Account rows have real named account links and keyboard access, with table relationships and unambiguous focus; row clicking cannot consume nested control actions. No hover-only discovery. Narrow omission of secondary columns preserves their values and actions in linked detail. Populated-form state announcements distinguish unsaved, saved pending and applied without repeating unchanged status or exposing secrets. Screenshot comparison supplements, never replaces, keyboard, reflow and accessibility evidence.


## UX-A07 — Service rows, dialogs and recovery focus

Service row links and action buttons are independent focus targets; full-row clicking cannot trigger a nested lifecycle action. Selected configuration destinations and creation steps expose current location with navigation semantics. Required cues apply to the task actually being submitted; a secret dialog’s required field cannot mislabel the unrelated wizard Continue task. Each repeated control uses its own local label/help/error association.

Set/Replace, Clear/Delete, rule editing and policy test dialogs have an accessible name, bounded keyboard focus, safe Escape/Cancel and return to the originating control or a sensible successor. Do not persist secrets on cancellation or announce their content. New repeated items receive visible focus, scroll into view and a concise announcement. Import configuration errors link from a focused summary to the affected field; unavailable actions explain how to proceed. Status and operation uncertainty always have words, not color alone. Preserve existing skip navigation, contrast, zoom and touch requirements.


## UX-A08 — Review tabs, comparisons and confirmation

Use semantic tabs with selected state, associated panels and one tab stop. ArrowLeft/Right and Home/End move among the two tabs; preloaded panels may activate with focus. Give each comparison a field/item label and Before/After reading order. Change labels/symbols supplement tint. Preserve exact values at text enlargement and test both document and text-range overflow.

Use a named modal with inert background and trapped focus. Initially focus the heading so consequence and risk text precede the action. Cancel/Escape before submission restores the invoking control and context. Required checkboxes have associated specific risk/scope labels; announce remaining acknowledgments and submission outcomes. Every required acknowledgment must be checked before Continue is enabled. A pending operation cannot be dismissed with wording that implies cancellation or rollback of an admitted request. UX-IN17 governs stale/unknown outcomes.


## UX-A09 — Refinement semantics

New settings is the first selected semantic tab on review entry; UX-A08 keyboard behavior remains unchanged. Render actual review exceptions as a semantic list with readable risk/scope text. Reading these bullets does not check any modal acknowledgment. The override badge is visible text associated with its rule, available without hover or color interpretation, and is not an urgent alert merely because an override exists. Removed-section navigation must not strand keyboard focus or discard safe draft input; return to a remaining relevant section under the existing navigation guard.

## UX-A10 — Precise attention, category navigation and search

Associate field warnings with their local controls and provide a focusable summary linking only actual issues. Circled exclamation markers have accessible Needs attention text; do not rely on yellow or repeatedly announce unchanged validation. A missing credential links to its authorized Set value task. After correction, update status without forcing focus away from the user's work.

Use named navigation/current-location semantics for Limits categories and native labeled selects on narrow layouts. Search uses a named modal with initial query focus, contained keyboard focus and inert background. Escape/Cancel closes before submission and returns focus to its trigger; result selection focuses the destination after any unsaved-work decision. Results have meaningful section/category/field names, loading and errors are announced concisely, and no secret text is announced. Never stack modal tasks. SMTP dialogs share this keyboard/focus model while explicitly describing their different save timing.

## UX-A11 — Persistent actions and removable filters

Expose Settings footer status once without duplicate live announcements. Disabled controls have semantic state; focus is never obscured by the footer, including at zoom or with a virtual keyboard. Credential cards are named groups; configuration removal and stored-value actions have distinct target-specific accessible names. Chip remove buttons name field, comparison and value and never depend on a tiny unlabeled icon. Removal sends focus to a sensible neighboring chip or Add control and announces the change without leaking secret-like input.

Associate Field/Comparison/Value labels/help/errors locally. Duplicate modal uses the existing named-dialog, inert-background, contained-focus and Escape/Close pattern; restore focus to the retained Add task without losing input. Do not stack it with another modal. Query loading/error/empty states and previous-results context are readable and announced concisely. Matching count and Export activity are programmatically associated with the successful query, not only proximity. Time inputs identify UTC. Main/per-service/own scope remains explicit to assistive technology.


## UX-A12 — Service corrections and discard focus

Parent Configuration and section issue markers have meaningful accessible labels and text alternatives, not color alone; announce changing blockers concisely. Direct sections retain current-location semantics. Incomplete review fix links focus the actual field/action. Scoped discard uses the shared named modal, contained focus, Escape/Cancel and return-focus behavior; after abandoning creation, focus Services heading. Saved never-active discard announces retained Inactive identity without claiming deletion. Do not announce hidden values or legacy subject details unnecessarily. Shared footer focus never obscures input/errors at enlarged text.


## UX-A13 — Advisory, deletion and recovery clarity

No-access symbols have **No access assigned** text alternatives and are distinguishable from blocking validation independently of color. Do not announce valid zero-access state as invalid or disable activation. Named credential-removal and permanent-delete dialogs use contained keyboard focus, an explicit labeled confirmation input where required, accessible disabled-state explanation, Cancel/Escape and predictable return focus. Completion announces removal without exposing values; after permanent deletion focus the Services heading. Loading status is announced politely in the stable Settings panel without moving keyboard focus. Recovery-code sign-in and Replace authenticator have distinct accessible names and purposes. Apply text-range and focus-clearance checks at 320px/200%, not merely screenshot or component-width checks.
