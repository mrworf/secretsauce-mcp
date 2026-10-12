# Feedback 002 experience proposal

Status: proposed, awaiting UX-DESIGN-003. This document does not amend UX2. It resolves the design recommendation for REC-DEC-006; role/SMTP/metadata constraints come from SECRES-06/07 and STATE-07/08 and require normal cross-artifact adoption.

## Recommended direction

Use populated forms as the normal Settings surface for authorized editors. Remove the redundant summary-then-Edit step for ordinary configuration. Use available desktop width for useful related groups and context, with readable input lengths and one-column reflow. Keep current primary navigation and focused Settings sections. Rename the user-facing **Response protection** section to **Secret detection**, with immediate description: “Checks data returned by services for credentials before sending it to your MCP client.” Retain technical names in searchable help and preserve the documented best-effort limitations.

The consequential choice is this combined editing/state model and account list/detail composition. The meaningful alternative is retaining summary-first pages with a separate Edit entry, which favors read-only scanning but retains the extra step the feedback identified. The recommendation reduces routine navigation while preserving deliberate activation. No alternative autosave model is recommended because it would conflict with the established atomic configuration contract.

## Populated fields and truthful state

- With no pending changes, forms contain current non-secret values, clearly labeled **In use**. No literal `undefined`, artificial sample defaults, or duplicate stale summary. Initial loading, absence and read failure are separate states; do not render empty controls as though values were loaded.
- Existing saved pending changes reopen as **Saved for later · Not in use yet**. Show current values beside changed controls and in review, not a second full read-only form. Browser edits become **Unsaved changes**, visibly distinct from persisted pending changes.
- Primary **Review changes** validates and durably saves authorized pending edits, then opens the existing full-scope review. It never applies on navigation or field change. Secondary **Save for later** preserves the existing save-only capability, using concrete acknowledgment: “Saved. Not in use yet. Review and apply to update the running instance.” This renames existing draft persistence, not a new workflow. Do not offer a review/apply action for an unchanged form; disable it with the explanatory no-change state.
- Review names all changed Settings sections, exact sanitized before/after values, security effects and required acknowledgments. **Apply N changes** updates the complete reviewed set atomically. No partial per-section apply, silent inclusion of unavailable sections, or bypass of stale-review checks.
- Backups and diagnostics use this same model. After apply, refreshed values are labeled **In use**, with a durable success state and revision. Backup cleanup has a separately reported outcome; applied settings cannot be called failed merely because cleanup fails. Never report applied after save alone. Unknown completion requires state lookup before retry.
- Navigating away from browser-unsaved edits offers Stay, Save for later and continue, or Discard unsaved edits and continue. Already-saved changes persist across sections. Explicit discard of saved changes identifies exact scope, requires confirmation and cannot discard another section silently.
- Account property/role changes remain immediate confirmed security operations, not Settings drafts. Label **Review account changes** then confirm exact target/effect and perform required recent authentication. No invented shared queue for account edits.
- Read-only actors get readable labeled values with the same grouping and current-state semantics, without fake editable controls. Current permissions, stale-state failure, outage, session expiry, and preservation of safe non-secret input follow UX2.

## Fields, language and layout

Mark mandatory fields with a visible red asterisk, a nearby “* Required” legend, and programmatic required semantics. Color alone is insufficient. Conditional required states follow actual chosen configuration. Keep labels visible; concise helper text beneath each non-obvious field explains purpose, units or effect and is associated accessibly. No placeholder-as-label. Short plain-language labels and action verbs are the rule; retain necessary exact terms with explanations, not renamed underlying values. Audit common navigation, field hints, confirmation, validation and success/error copy together.

Use the desktop canvas instead of a narrow centered form. Group compatible short inputs in columns; long URLs/patterns may span width. Auxiliary panels carry useful health/status/help, not filler. Service destinations/rules/credentials use normal-flow repeatable cards/rows; adding, removing, validation, long text and expanded help must not overlap siblings or actions. Preserve all guided and advanced capability coverage from UX-IA06. No feature removal or forced JSON.

## People & Access

Show one row per human account, with account link, role, status and last console sign-in. Clicking the row opens a full account detail page; the account link provides keyboard and new-tab semantics. Keep selection independent from nested actions. Detail separates editable email/role, read-only metadata and recovery actions. Preserve return/filter context. A full detail page gives space for explanations and errors without introducing a modal stack. No bulk edit or new profile fields.

The representative detail is Owner view. Administrator receives the same structure with SECRES-06 target restrictions: no Owner target editing, no Owner role option, no self-role change, no invitation/disable/restore-review powers. Read-only viewers get no mutation controls. Contact/role review states immediate sign-out/revocation consequences; contact changes include trusted-channel verification. Existing separate password and Authenticator reset ceremonies stay intact. No secret material in detail.

Metadata labels: **Created** and **Last console sign-in**, exact timezone visible. Last sign-in excludes MCP/OAuth traffic, failed/partial login, reauthentication and restricted recovery. Show Never for known new accounts without login, Unknown for unrecorded legacy dates, Not applicable for external identities, and backup provenance for restored historic values until a new qualifying local login. Values are immutable through this UI.

On narrow screens keep one row per account with Account and Role; secondary status/date remain in reachable detail. All existing role-permitted account actions remain reachable there. Do not turn each row into an oversized inline edit card.

## Email and health

SMTP fields prefill current authorized non-secret settings. Password field is always blank; say **Password saved. Leave blank to keep it.** Absence says **No password saved**. Replacement requires deliberate input. Deletion remains separate and confirmed under its existing dependency rules. Explicit authentication choice and all existing fields remain supported though the concept shows one populated authentication case.

Encryption offers **TLS (encrypted)** and **None (unencrypted)**, TLS default; no STARTTLS, inferred mode from port or downgrade. Selecting None immediately shows the plain-language risk to messages, recovery links and login credentials. Required acknowledgment and recent authentication occur in normal review before dispatch. Test uses currently applied settings and displays that scope; no silent test of browser-unsaved values. Mode changes do not delete credentials. Preserve manual fallback.

Diagnostics is an ordinary populated select with **Standard (info)** and **Detailed (debug)**. The same loaded value drives form and current-state label. Live health is separate, with last-checked time and refresh. No static “applied diagnostics” value that contradicts the form.

## Accessibility and state coverage

Retain semantic navigation/current-page markers, visible focus, associated labels/help/errors, linked validation summary, keyboard-operable rows/actions, status announcements and no color-only meaning. Announce only changed status. No sticky bar obscures errors or focused controls. At narrow widths and 200% enlarged text, labels/headings/actions wrap; no clipping or text-range overflow. Loading does not destroy context; denied operations explain permitted return paths without leaking unavailable data. Failure retains permitted non-secret values. Secrets never enter browser storage.

These are observable requirements proposed for later canonical synthesis. Static concepts show representative composition, not proof of implementation, live data correctness, complete accessibility or security enforcement.
