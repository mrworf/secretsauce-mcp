# PO-FEEDBACK-2026-10-11-001

Product: `secretsauce-mcp`. Source: product_owner / prompt. Status: **CONFIRMED**.

## Captured items

| ID | Classification | Confirmation | Normalized meaning |
| --- | --- | --- | --- |
| PO-FB-001 | OBSERVATION | CONFIRMED | The Product Owner could not reset passwords through admin controls. |
| PO-FB-002 | DIRECTIVE | CONFIRMED | Owner and Administrator can initiate password resets for other users. |
| PO-FB-003 | OBSERVATION | CONFIRMED | The Product Owner could not reset Authenticator MFA through admin controls. |
| PO-FB-004 | DIRECTIVE | CONFIRMED | Owner and Administrator can initiate Authenticator MFA resets for other users. |
| PO-FB-005 | OBSERVATION | CONFIRMED | The active tab is not highlighted in the menu bar. |
| PO-FB-006 | DIRECTIVE | CONFIRMED | Highlight the active tab in the menu bar. |
| PO-FB-007 | OBSERVATION | CONFIRMED | The Settings page is too long. |
| PO-FB-008 | DIRECTIVE | CONFIRMED | Group settings into focused sections instead of one long scrolling page containing all settings. |
| PO-FB-009 | IDEA_OR_QUESTION | CONFIRMED | Sub tabs are a possible way to organize Settings sections. |
| PO-FB-010 | OBSERVATION | CONFIRMED | Settings expose too much JSON and technical configuration detail. |
| PO-FB-011 | DIRECTIVE | CONFIRMED | Provide user-friendly configuration controls that hide technical configuration detail. |
| PO-FB-012 | OBSERVATION | CONFIRMED | The Product Owner finds the "Delete X on apply" behavior odd and inconsistent with best practices. |
| PO-FB-013 | DIRECTIVE | CONFIRMED | Use an explicit, confirmed delete action independent of applying configuration edits. |
| PO-FB-014 | DIRECTIVE | CONFIRMED | Support importing legacy YAML configuration into the new system. |

## Clarifications

- Which console roles should be able to initiate password and Authenticator MFA resets for other users? **Owner and Administrator (Recommended)** — Both roles need reset controls; detailed safeguards and target restrictions remain for downstream review. Applies to PO-FB-002, PO-FB-004.
- For “Delete X on apply,” what change are you directing? **Separate delete action (Recommended)** — Deletion should be an explicit, confirmed action independent of applying configuration edits. Applies to PO-FB-013.

## Suggestions and unresolved questions

- PO-FB-009: Sub tabs are a possible way to organize Settings sections.
- No unresolved questions.

## Authority and handoff

- DIRECTIVE: confirmed product intent is authoritative.
- PREFERENCE: advisory quality or direction.
- OBSERVATION: evidence of reported experience or inference.
- IDEA_OR_QUESTION: exploratory option; not selected product intent.

Reconciliation ready: **false**.
Transaction parent: `8ce4a80413f21f472af8ece8906d1b64eea3aee6`.
Payload commit: pending producer transaction closeout.
