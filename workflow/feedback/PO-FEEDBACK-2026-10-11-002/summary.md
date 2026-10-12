# PO-FEEDBACK-2026-10-11-002

Source: Product Owner prompt. Status: NEEDS_CONFIRMATION.

| ID | Class | Confirmation | Meaning |
| --- | --- | --- | --- |
| PO-FB-015 | OBSERVATION | CONFIRMED | Much of the product language is difficult to understand. |
| PO-FB-016 | PREFERENCE | CONFIRMED | Favor simpler, easier-to-understand product language. |
| PO-FB-017 | PREFERENCE | CONFIRMED | Make greater use of available horizontal screen space. |
| PO-FB-018 | OBSERVATION | CONFIRMED | List items overlap visually while adding a service. |
| PO-FB-019 | OBSERVATION | CONFIRMED | Mandatory fields lack a visible indication that input is required. |
| PO-FB-020 | DIRECTIVE | CONFIRMED | Visually indicate mandatory fields. |
| PO-FB-021 | IDEA_OR_QUESTION | CONFIRMED | A red asterisk is a suggested required-field indicator. |
| PO-FB-022 | IDEA_OR_QUESTION | CONFIRMED | Add short descriptions beneath field labels to help explain the inputs. |
| PO-FB-023 | DIRECTIVE | CONFIRMED | Show one row per user in People & Access. |
| PO-FB-024 | DIRECTIVE | CONFIRMED | Clicking a user opens that user’s account information. |
| PO-FB-025 | DIRECTIVE | NEEDS_CONFIRMATION | Provide account-property and role editing in the user detail view; clarify whether “admin” means existing authorized roles or expansion of the named Administrator role. |
| PO-FB-026 | DIRECTIVE | CONFIRMED | Show the user’s creation date. |
| PO-FB-027 | DIRECTIVE | CONFIRMED | Show the user’s last login. |
| PO-FB-028 | DIRECTIVE | CONFIRMED | Draw inspiration from established SaaS user-management experiences. |
| PO-FB-029 | OBSERVATION | CONFIRMED | The label Response protection does not explain its meaning to an uninitiated user. |
| PO-FB-030 | OBSERVATION | CONFIRMED | SMTP configuration appears incomplete and offers an encryption dropdown without a way to disable encryption. |
| PO-FB-031 | IDEA_OR_QUESTION | NEEDS_CONFIRMATION | Clarify whether the encryption comment asks for unencrypted SMTP support or questions a misleading single-choice control. |
| PO-FB-032 | OBSERVATION | CONFIRMED | SMTP settings display undefined values. |
| PO-FB-033 | IDEA_OR_QUESTION | CONFIRMED | Consider omitting the separate SMTP settings display and prefilling editable fields with current values. |
| PO-FB-034 | DIRECTIVE | CONFIRMED | Do not prefill the SMTP password with its saved value. |
| PO-FB-035 | PREFERENCE | CONFIRMED | Avoid unnecessary separate show and edit steps where a form showing current values is suitable. |
| PO-FB-036 | OBSERVATION | CONFIRMED | Backup configuration repeatedly refers to drafts. |
| PO-FB-037 | OBSERVATION | CONFIRMED | Changes to backup settings do not appear to save. |
| PO-FB-038 | OBSERVATION | CONFIRMED | Applied diagnostics appears static while the edit view appears to show the current value. |
| PO-FB-039 | PREFERENCE | CONFIRMED | Use consistent settings displays and editing behavior informed by established practices. |
| PO-FB-040 | DIRECTIVE | CONFIRMED | Research best practices and common patterns for settings, viewing current values, and editing. |
| PO-FB-041 | PREFERENCE | CONFIRMED | Favor showing current values in editable forms where it reduces unnecessary steps. |

## Suggestions and open questions

Suggested mechanisms remain exploratory: red asterisk (PO-FB-021), short field descriptions (PO-FB-022), and replacing the separate SMTP display with populated edit fields (PO-FB-033).

- PO-UNRESOLVED-002: Does admin mean the roles already authorized to manage account properties/roles, or should the named Administrator role gain those powers?
- PO-UNRESOLVED-003: Is unencrypted SMTP a required capability, or is this feedback about a confusing encryption control?

## Authority and handoff

DIRECTIVE + CONFIRMED = authoritative intent. PREFERENCE = advisory direction. OBSERVATION = reported evidence. IDEA_OR_QUESTION = exploratory, not a selected requirement.

Reconciliation ready: false. Pending answers must be applied consistently to the YAML before final handoff. Prior feedback remains unchanged. Supporting research is linked from the YAML; it establishes no product authority.
