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
