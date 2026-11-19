# PO-FEEDBACK-2026-11-19-001

Source: latest-version review. Status: NEEDS_CONFIRMATION.

| ID | Classification | Confirmation | Meaning |
|---|---|---|---|
| PO-FB-265 | DIRECTIVE | CONFIRMED | Show a distinct warning symbol on Access & Policy when nobody has access. Distinguish it from missing-information indicators. |
| PO-FB-266 | DIRECTIVE | CONFIRMED | Provide a button and modal confirmation for removing a credential configuration. |
| PO-FB-267 | OBSERVATION | CONFIRMED | The removal help text is confusing. |
| PO-FB-268 | DIRECTIVE | CONFIRMED | Explain the consequence of credential removal in plain language. |
| PO-FB-269 | IDEA_OR_QUESTION | NEEDS_CONFIRMATION | Clarify whether applying the removal should also delete the saved value when it is no longer used. |
| PO-FB-270 | DIRECTIVE | CONFIRMED | Replace “Placement” with plain language that explains where the credential is sent. |
| PO-FB-271 | OBSERVATION | CONFIRMED | The sign-in form stretches too wide on an ultrawide display. |
| PO-FB-272 | PREFERENCE | CONFIRMED | Prefer a narrower sign-in layout on wide displays. |
| PO-FB-273 | OBSERVATION | CONFIRMED | The sign-in dropdown already offers a recovery code, so the similarly named secondary action appears redundant. |
| PO-FB-274 | IDEA_OR_QUESTION | CONFIRMED | Clarify how the separate authenticator replacement action differs from using a recovery code to sign in. |
| PO-FB-275 | DIRECTIVE | CONFIRMED | Remove the quoted helper text. |
| PO-FB-276 | OBSERVATION | CONFIRMED | Switching Settings subtabs briefly places the content below the menu before reflowing to the right. |
| PO-FB-277 | DIRECTIVE | CONFIRMED | Prevent the transient layout jump when switching Settings subtabs. |
| PO-FB-278 | DIRECTIVE | CONFIRMED | Remove Overview actions whose only effect is to open Configuration. |
| PO-FB-279 | DIRECTIVE | CONFIRMED | Provide a permanent deletion action for an archived service. |
| PO-FB-280 | DIRECTIVE | CONFIRMED | Require typing the displayed confirmation value in a dialog before deleting the archived service. |
| PO-FB-281 | IDEA_OR_QUESTION | NEEDS_CONFIRMATION | Clarify which service data is deleted and how retained history and backups are treated. |

## Decisions to confirm

- **PO-UNRESOLVED-001** When an administrator applies removal of a credential, should the saved secret be deleted if nothing still uses it? A. Delete the saved value on Apply if nothing still uses it. Draft removal alone leaves the secret in place. B. Retain the saved value after Apply. Clearing or deleting it remains a separate action.
- **PO-UNRESOLVED-002** Should permanent deletion remove the archived service record, configuration, draft, and saved secrets from the current instance while retaining audit events and existing backups under their retention rules? A. Delete the service and its stored configuration, draft, and secrets from the current instance. Keep retained audit events and existing backups under their regular retention rules. B. Use another deletion scope specified by the Product Owner.

Reconciliation ready: false. Confirmed directives establish product intent. Preferences guide quality. Observations record evidence. Ideas and questions record exploration.
