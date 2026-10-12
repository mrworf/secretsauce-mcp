# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: product/ux/02-interaction-patterns.md UX-IN05; product/ux/01-information-architecture.md UX-IA06; docs/web-console-prd.md UX-02/03.
> Preservation baseline: bbbd9e329ad6b9ec3c4bec692c81b7d7d99db49d (delivered M18–21).
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| MEDIUM | REC-RM-007 | No undefined SMTP empty-state values | REC-015 | UX-02/03, UX-IN05/IA06 | None for this bounded correction | Configured/unconfigured/disabled state and write-only secret checks |
| MEDIUM | REC-RM-008 | Readable wizard progress | REC-009 | UX-R01 | None | Six reproduced states, marker/text separation |
| HIGH | REC-RM-009 | Bounded account editing | REC-012 | IDENT-02B, SECRES-06 | Source commit/revalidation | Role matrix, contact verification and durable revocation |
| MEDIUM | REC-RM-010 | Truthful account dates | REC-013 | IDENT-02A, STATE-07 | Source commit/revalidation | Event exclusions, legacy/restore and persistence |
| HIGH | REC-RM-011 | Explicit SMTP modes | REC-014 | IDENT-04, SECRES-07, STATE-08 | Source commit/revalidation | TLS/None, no downgrade, acknowledgment and restore |

### REC-RM-007: Meaningful SMTP empty state

Priority: MEDIUM
Source findings: REC-015
Product Owner feedback: PO-FEEDBACK-2026-10-11-002 / PO-FB-032
Authoritative basis: existing UX-IN05 empty-state and UX-IA06 friendly-summary rules.
Desired outcome: Absent SMTP configuration reads as a meaningful unconfigured state.
Current behavior: Absent n.applied is stringified to undefined by readableValues.
Required behavior: Render an understandable empty state; render present non-secret values truthfully.
Affected users/roles: Authorized Owner/Administrator/Auditor inspection; only Owner edits SMTP.
Affected interfaces and compatibility: Console Email rendering; no API/persistence/transport change.
UX constraints: No raw object or undefined display. Preserve usable permitted next actions.
Architecture/security constraints: Keep saved SMTP password write-only and existing role/credential lifecycle rules.

Acceptance criteria:
1. Unconfigured Email displays meaningful empty/current-value state, no undefined sentinel.
2. Configured and disabled SMTP display the actual non-secret values without implying delivery is enabled.
3. Saved secret is absent from read/render payloads and never prefilled.
4. Unauthorized viewers acquire no edit control or secret; null/absent inputs do not crash rendering.

Dependencies: None for this independent defect. Whole feedback delivery waits for unresolved definition work.
Explicit exclusions: SMTP transport options, settings redesign, role expansion, and claims of a backup persistence bug.
Required implementation validation: Targeted positive/negative renderer checks and representative browser empty/configured states. No live account mutation.

Additional resolved scopes follow. Aggregate delivery still waits for design approval, source commit and definition revalidation; these items cannot be mistaken for full-scope readiness.

### REC-RM-008: Readable wizard progress

Priority: MEDIUM
Source findings: REC-009
Product Owner feedback: PO-FEEDBACK-2026-10-11-002 / PO-FB-018
Authoritative basis: UX-R01/UX-04; PRD and normative companion contracts; exact input hashes in canonical result.
Desired outcome / required behavior: All steps/current position remain readable without marker/text collision across supported layouts.
Current behavior: Numeric markers overlap labels in the shared Add service progress list.
Affected users/roles: Owner and Administrator service authors.
Affected interfaces and compatibility: Existing console/API/durable configuration and recovery boundaries only; preserve all unaffected features.
UX constraints: Existing accessible controls and safe status/error patterns; pending UX proposal not implementation authority.
Architecture/security constraints: Preserve audit admission, current authorization, state fencing and write-only secrets.

Acceptance criteria:
1. Recapture Details/Destination/Authentication at 1280 and 320 CSS px; inspect painted marker/text bounds, long labels, zoom and keyboard current-step semantics.
2. No clipped/hidden labels; wizard validation, next/back transitions and service values preserved.
3. Preserve current separate resets, execution assignments, atomic reviewed configuration and existing encrypted backup exclusions.

Dependencies: None; existing authority and reproduced evidence suffice.
Explicit exclusions: New roles, multi-tenant SaaS, service packs, unrelated redesign and automatic activation.
Required implementation validation: Targeted positive/negative tests for all new external inputs, permission/state/failure/restart cases above and applicable synthetic browser acceptance. No live instance mutation.

### REC-RM-009: Bounded account property and role editing

Priority: HIGH
Source findings: REC-012
Product Owner feedback: PO-FEEDBACK-2026-10-11-002 / PO-FB-025
Authoritative basis: IDENT-02B; AUTHZ-02/03; SECRES-06; PRD and normative companion contracts; exact input hashes in canonical result.
Desired outcome / required behavior: Follow SECRES-06 exact role/target matrix, contact verification, recent authentication, immutable fields, generation revocation, notices and concurrency.
Current behavior: Only Owner currently controls account role/lifecycle; Administrator lacks the approved property/role edit authority.
Affected users/roles: Owners, Administrators, selected local accounts.
Affected interfaces and compatibility: Existing console/API/durable configuration and recovery boundaries only; preserve all unaffected features.
UX constraints: Existing accessible controls and safe status/error patterns; pending UX proposal not implementation authority.
Architecture/security constraints: Preserve audit admission, current authorization, state fencing and write-only secrets.

Acceptance criteria:
1. Positive Administrator non-Owner role/contact edits and self-contact; Owner continuity. Reject Administrator-to-Owner, Owner promotion/self-role, unauthorized fields/roles, stale revisions, invalid contacts, stale recent auth and missing verification.
2. Proof/grant/reference invalidation survives uncertain writes/restart; no activation from pending/disabled edits; notification failure separate; no contact or credential logging.
3. Preserve current separate resets, execution assignments, atomic reviewed configuration and existing encrypted backup exclusions.

Dependencies: Root source commit and definition revalidation; UI expression must conform to approved subsequent UX, not current proposal.
Explicit exclusions: New roles, multi-tenant SaaS, service packs, unrelated redesign and automatic activation.
Required implementation validation: Targeted positive/negative tests for all new external inputs, permission/state/failure/restart cases above and applicable synthetic browser acceptance. No live instance mutation.

### REC-RM-010: Truthful durable account metadata

Priority: MEDIUM
Source findings: REC-013
Product Owner feedback: PO-FEEDBACK-2026-10-11-002 / PO-FB-026/027
Authoritative basis: IDENT-02A; BACKUP-01/05; STATE-07; PRD and normative companion contracts; exact input hashes in canonical result.
Desired outcome / required behavior: Follow STATE-07 creation and full-console-sign-in events, read-only fields, timezone and Never/Unknown/Not applicable/restored historical states.
Current behavior: Creation/last-sign-in metadata absent from current projection and invitation identity.
Affected users/roles: Authorized People viewers; local accounts and external mapping distinctions.
Affected interfaces and compatibility: Existing console/API/durable configuration and recovery boundaries only; preserve all unaffected features.
UX constraints: Existing accessible controls and safe status/error patterns; pending UX proposal not implementation authority.
Architecture/security constraints: Preserve audit admission, current authorization, state fencing and write-only secrets.

Acceptance criteria:
1. New invitation/bootstrap dates and successful password+factor or recovery-code login persist; exclude failed, restricted, OAuth, MCP, reauthentication, enrollment/recovery events.
2. Concurrent sign-ins cannot regress; legacy missing data stays Unknown; encrypted snapshot/restart/restore/rollback preserve truthful metadata without granting authority or reconstructing dates from audit.
3. Preserve current separate resets, execution assignments, atomic reviewed configuration and existing encrypted backup exclusions.

Dependencies: Root source commit and definition revalidation; eventual approved detail UI.
Explicit exclusions: New roles, multi-tenant SaaS, service packs, unrelated redesign and automatic activation.
Required implementation validation: Targeted positive/negative tests for all new external inputs, permission/state/failure/restart cases above and applicable synthetic browser acceptance. No live instance mutation.

### REC-RM-011: Explicit TLS or unencrypted SMTP

Priority: HIGH
Source findings: REC-014
Product Owner feedback: PO-FEEDBACK-2026-10-11-002 / PO-FB-030/031
Authoritative basis: IDENT-04; SEC-01; STATE-08; SECRES-07; PRD and normative companion contracts; exact input hashes in canonical result.
Desired outcome / required behavior: Follow exact TLS default/legacy migration or explicit None selection; authenticated or unauthenticated SMTP independently supported; reviewed mode, recent Owner risk acknowledgment and current dependency admission.
Current behavior: Implicit TLS only; one-option selector and no persisted mode.
Affected users/roles: Owner configuring SMTP; notification recipients.
Affected interfaces and compatibility: Existing console/API/durable configuration and recovery boundaries only; preserve all unaffected features.
UX constraints: Existing accessible controls and safe status/error patterns; pending UX proposal not implementation authority.
Architecture/security constraints: Preserve audit admission, current authorization, state fencing and write-only secrets.

Acceptance criteria:
1. Real local TLS and plaintext SMTP delivery/tests, with and without authentication; old missing modes TLS; explicit unknown values rejected; exact roundtrip through save/apply/restart/history/backup.
2. No certificate-failure fallback; no stale/unauthorized/unacknowledged None dispatch; restore None waits for fresh review; password never redisplayed; disable/delete/replacement semantics retained; sanitized errors/audit.
3. Preserve current separate resets, execution assignments, atomic reviewed configuration and existing encrypted backup exclusions.

Dependencies: Root source commit and definition revalidation; no STARTTLS expansion.
Explicit exclusions: New roles, multi-tenant SaaS, service packs, unrelated redesign and automatic activation.
Required implementation validation: Targeted positive/negative tests for all new external inputs, permission/state/failure/restart cases above and applicable synthetic browser acceptance. No live instance mutation.
