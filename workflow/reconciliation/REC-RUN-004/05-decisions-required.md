# Decisions required

All decisions are specialist semantics, not requests to reconfirm the already approved Administrator expansion or unencrypted SMTP support. Candidate design remains non-authoritative.

## REC-DEC-004 — security

Type: SPECIALIST_RESOLUTION
Authority: existing confirmed Product Owner direction plus affected domain authority.
Source findings: REC-012
Product Owner feedback: PO-FB-025
Question: What precise property, target-role, self-management and security-consequence rules realize approved Administrator account management?
Reason: Expansion is settled; older Owner-only rules are stale, but field/contact and escalation boundaries need security/product semantics.
Affected requirements: AUTHZ-02/03; IDENT-04/05
Affected artifacts: docs/web-console-prd.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md
Affected users: permitted management roles and selected account targets; SMTP notifications also affect enrollment/recovery recipients.
Consequence of deferral: dependent behavior cannot become implementation-ready.
implementation_ready: false

## REC-DEC-005 — security

Type: SPECIALIST_RESOLUTION
Authority: existing confirmed Product Owner direction plus affected domain authority.
Source findings: REC-014
Product Owner feedback: PO-FB-030, PO-FB-031
Question: What explicit transport-mode, credential-use and acknowledgement rules support unencrypted SMTP while retaining secure defaults and no silent downgrade?
Reason: Unencrypted support is settled; persisted modes, transport/auth behavior, compatibility and warning semantics are undefined.
Affected requirements: IDENT-04
Affected artifacts: docs/web-console-prd.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md
Affected users: permitted management roles and selected account targets; SMTP notifications also affect enrollment/recovery recipients.
Consequence of deferral: dependent behavior cannot become implementation-ready.
implementation_ready: false

## REC-DEC-006 — ux

Type: SPECIALIST_RESOLUTION
Authority: existing confirmed Product Owner direction plus affected domain authority.
Source findings: REC-008, REC-010, REC-011, REC-016
Product Owner feedback: PO-FB-015, PO-FB-016, PO-FB-017, PO-FB-019, PO-FB-020, PO-FB-021, PO-FB-022, PO-FB-023, PO-FB-024, PO-FB-029, PO-FB-033, PO-FB-035, PO-FB-036, PO-FB-037, PO-FB-038, PO-FB-039, PO-FB-041
Question: What coherent language, layout, required-field, People detail and current-value settings pattern addresses this feedback while preserving review and permission safeguards?
Reason: Existing explicit labels and applied-summary/edit patterns need design reconsideration; preferences and exploratory mechanisms do not select the final design.
Affected requirements: UX-02/03/04; CONFIG-03
Affected artifacts: docs/web-console-prd.md, product/architecture/web-console-state-contract.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/ux/03-responsive-and-platform.md, product/ux/04-visual-system.md, product/ux/05-accessibility.md
Affected users: permitted management roles and selected account targets; SMTP notifications also affect enrollment/recovery recipients.
Consequence of deferral: dependent behavior cannot become implementation-ready.
implementation_ready: false

## REC-DEC-007 — architecture

Type: SPECIALIST_RESOLUTION
Authority: existing confirmed Product Owner direction plus affected domain authority.
Source findings: REC-013
Product Owner feedback: PO-FB-026, PO-FB-027
Question: Which creation and last-login events and unknown/never/restore semantics govern the requested account timestamps?
Reason: Metadata display is settled; historical truth, authenticated event boundaries and portable recovery projection are not defined.
Affected requirements: IDENT-02/03
Affected artifacts: docs/web-console-prd.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md
Affected users: permitted management roles and selected account targets; SMTP notifications also affect enrollment/recovery recipients.
Consequence of deferral: dependent behavior cannot become implementation-ready.
implementation_ready: false

Evidence blocker REC-009 separately needs service-creation reproduction; no design choice or user interview is presumed necessary. Backup persistence and diagnostic staleness remain reported observations with a plausible draft/applied explanation, not a proven loss or hard-coded value.
