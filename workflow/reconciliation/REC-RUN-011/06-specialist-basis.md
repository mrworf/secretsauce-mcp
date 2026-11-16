# Bounded Product UX interpretation consumed

Product UX supplied workflow/definition/results/feedback7-ux-assessment.md and feedback7-ux-resolution.yaml; exact consumed content revisions are in the canonical result. Their original publication belongs to the enclosing definition transaction. This record preserves the conclusions needed by this producer without adopting unapproved navigation. UX-DESIGN-006 proposal is not authority.

The specialist reviewed siblings: new/imported/existing service validation and navigation; Settings local field errors; service versus Settings comparisons; service versus SMTP credential dialogs; account/security immediate actions; writable/read-only Settings; backup status and health/retention. Same-task presentation follows shared patterns, with explicit UX-EX03 exception: service Set/Replace is immediate, SMTP Set/Replace stages reviewed activation, SMTP Clear is independently confirmed and dependency-blocked. Blank replacement retains existing password; Set without a required value gives local error. Temporary secret entry is not persisted in browser state, and unknown saves require status resolution.

The settled presentation corrections fit existing approved intent: exact field warnings, four guided sections, visible short decision blocks, identical comparison formatting, valid UTC-hour select, useful scope help and one meaningful page heading. No whole Settings redesign or elimination of advanced capabilities follows. Product UX specifically leaves Limits navigation and search modal unapproved.

## SMTP research

Sources researched by Product UX on 2026-11-16:

- [IBM Carbon modal guidance](https://www.carbondesignsystem.com/building-blocks/core/components/modal/guidelines): supports focused short management tasks with clear outcomes and Cancel.
- [GOV.UK password input](https://design-system.service.gov.uk/components/password-input/): supports labels, local error text and usable fresh password entry. No stored secret retrieval or redundant confirmation field is added.
- [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): supports named dialog, contained focus, Escape before admission and focus restoration.

These sources justify interaction mechanics only; they do not override SecretSauce activation/audit/dependency requirements. The dialog is two fields, not a whole Settings editor. Save visibly produces pending changes; test email still uses applied settings. Cancel leaves pending/current credentials unchanged. Safe unrelated edits survive modal transitions.

Implementation conformance remains unproven until targeted browser acceptance; the audit did not inspect every state or assistive mode.
