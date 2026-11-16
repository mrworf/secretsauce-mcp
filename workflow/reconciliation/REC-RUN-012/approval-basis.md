# Accepted design decision — immutable producer record

Source: Product Owner reply supplied by product-definition-orchestrator on 2026-11-16: **“Agreed, do both”**.

Resolves UX-DESIGN-006 and both REC-DEC-011 (Limits categories), REC-DEC-012 (Settings search). Accepted scope: feedback-007-draft-1; source proposal `workflow/definition/drafts/product-ux/web-console-feedback-007/index.md`, consumed revision `sha256:e89c3ea6d65f27b0bb6a291ee16459e54d44a2bdbdeeca7148a63620d4ac74ba`. The original proposal's “awaiting approval” marker is historical at capture; this newer explicit answer settles both choices. The central definition ledger records the same answer. No further approval is requested.

## Accepted bounded contract

Limits replaces repeated expandable groups with five selectable categories, one shown at a time: Requests & responses; References & retained state; HTTP & authentication; Scanner capacity; Regex workers. Categories map to existing supported groups, with fixed safety boundaries visible in HTTP & authentication. Use ordinary location navigation styled with the existing service section pattern, with a labeled select on narrow screens. Preserve exact values, all current capabilities, browser/deep-link navigation and all-settings atomic review.

A persistent Search settings action above Settings navigation opens a focused search dialog. Results display authorized labels/help/technical aliases only, never secrets. Preserve queries entered during asynchronous indexing; distinguish loading, no results and failure. Cancel returns focus to the search trigger; result selection closes the dialog, honors the unsaved-change guard, navigates to the containing section/category and focuses its field/read-only value. Do not stack search and unsaved-change dialogs.

Neither transition silently saves, applies or discards edits. Preserve permission boundaries, safe non-secret work, exact values and status uncertainty. No theme replacement, capacity semantics, new knobs, rounding, defaults or protocol changes. Other advanced disclosures are not prohibited merely by these scoped changes.

This note records already accepted intent and scope; the canonical UX synthesis belongs to the separate definition transaction. This producer changes no canonical UX source. Its result requires semantic definition revalidation before delivery planning.
