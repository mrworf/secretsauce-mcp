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
| MEDIUM | REC-RM-012 | Plain copy, width and required-field guidance | REC-008/010 | UX-IA08/IN11/R05/V05 | Derived validation | Matched visuals and accessible forms |
| MEDIUM | REC-RM-013 | People rows and full detail | REC-011 | UX-IA07/IN12 | REC-RM-009/010 integration | Role-aware navigation and matched visuals |
| MEDIUM | REC-RM-014 | Populated settings and truthful states | REC-016 | UX-IN10/13 | REC-RM-007/011 integration | Save/apply/error states and matched visuals |

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

Dependencies: None for this independent defect. Whole feedback delivery waits for source commit and derived definition validation.
Explicit exclusions: SMTP transport options, settings redesign, role expansion, and claims of a backup persistence bug.
Required implementation validation: Targeted positive/negative renderer checks and representative browser empty/configured states. No live account mutation.

Additional resolved scopes follow. Aggregate delivery still waits for root source commit and definition revalidation; resolved item readiness is distinct from delivery planning readiness.

### REC-RM-008: Readable wizard progress

Priority: MEDIUM
Source findings: REC-009
Product Owner feedback: PO-FEEDBACK-2026-10-11-002 / PO-FB-018
Authoritative basis: UX-R01/UX-04; PRD and normative companion contracts; exact input hashes in canonical result.
Desired outcome / required behavior: All steps/current position remain readable without marker/text collision across supported layouts.
Current behavior: Numeric markers overlap labels in the shared Add service progress list.
Affected users/roles: Owner and Administrator service authors.
Affected interfaces and compatibility: Existing console/API/durable configuration and recovery boundaries only; preserve all unaffected features.
UX constraints: Existing accessible controls and safe status/error patterns; approved UX3 is presentation authority.
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
UX constraints: Existing accessible controls and safe status/error patterns; approved UX3 is presentation authority.
Architecture/security constraints: Preserve audit admission, current authorization, state fencing and write-only secrets.

Acceptance criteria:
1. Positive Administrator non-Owner role/contact edits and self-contact; Owner continuity. Reject Administrator-to-Owner, Owner promotion/self-role, unauthorized fields/roles, stale revisions, invalid contacts, stale recent auth and missing verification.
2. Proof/grant/reference invalidation survives uncertain writes/restart; no activation from pending/disabled edits; notification failure separate; no contact or credential logging.
3. Preserve current separate resets, execution assignments, atomic reviewed configuration and existing encrypted backup exclusions.

Dependencies: Root source commit and definition revalidation; UI expression follows approved UX3.
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
UX constraints: Existing accessible controls and safe status/error patterns; approved UX3 is presentation authority.
Architecture/security constraints: Preserve audit admission, current authorization, state fencing and write-only secrets.

Acceptance criteria:
1. New invitation/bootstrap dates and successful password+factor or recovery-code login persist; exclude failed, restricted, OAuth, MCP, reauthentication, enrollment/recovery events.
2. Concurrent sign-ins cannot regress; legacy missing data stays Unknown; encrypted snapshot/restart/restore/rollback preserve truthful metadata without granting authority or reconstructing dates from audit.
3. Preserve current separate resets, execution assignments, atomic reviewed configuration and existing encrypted backup exclusions.

Dependencies: Root source commit and definition revalidation; approved UX-IA07 detail UI.
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
UX constraints: Existing accessible controls and safe status/error patterns; approved UX3 is presentation authority.
Architecture/security constraints: Preserve audit admission, current authorization, state fencing and write-only secrets.

Acceptance criteria:
1. Real local TLS and plaintext SMTP delivery/tests, with and without authentication; old missing modes TLS; explicit unknown values rejected; exact roundtrip through save/apply/restart/history/backup.
2. No certificate-failure fallback; no stale/unauthorized/unacknowledged None dispatch; restore None waits for fresh review; password never redisplayed; disable/delete/replacement semantics retained; sanitized errors/audit.
3. Preserve current separate resets, execution assignments, atomic reviewed configuration and existing encrypted backup exclusions.

Dependencies: Root source commit and definition revalidation; no STARTTLS expansion.
Explicit exclusions: New roles, multi-tenant SaaS, service packs, unrelated redesign and automatic activation.
Required implementation validation: Targeted positive/negative tests for all new external inputs, permission/state/failure/restart cases above and applicable synthetic browser acceptance. No live instance mutation.

### REC-RM-012: Plain language, useful width and understandable fields

Priority: MEDIUM
Source findings: REC-008, REC-010
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-015, PO-FB-016, PO-FB-017, PO-FB-019, PO-FB-020, PO-FB-021, PO-FB-022, PO-FB-029.
Authoritative basis: approved web-console-ux-3 / UX-DESIGN-003; UX-IA08, UX-IN11, UX-R05, UX-A06, UX-V05; UX-C37/41/42; PRD UX-02/03/04.
Desired outcome / required behavior: Use approved Secret detection terminology/explanation and consistent copy; wider form composition; mandatory symbol/legend/programmatic semantics and concise associated help.
Current behavior: Old Response protection labels, narrow main width and unmarked required fields persist in baseline.
Affected users/roles: authorized console editors/readers; Member restrictions preserved.
Affected interfaces and compatibility: existing console navigation/forms and management API/state behavior; no removed configuration capability.
UX constraints: Search old terms and technical aliases; preserve all advanced fields, literals, client semantics and honest best-effort limits. Conditional mandatory controls follow mode; no color-only cue.
Architecture/security constraints: STATE-01/02/03, SECRES-05/06/07; current permissions, atomic reviewed activation, audit and write-only/version-fenced credentials remain mandatory.

Acceptance criteria:
1. Use approved Secret detection terminology/explanation and consistent copy; wider form composition; mandatory symbol/legend/programmatic semantics and concise associated help.
2. Search old terms and technical aliases; preserve all advanced fields, literals, client semantics and honest best-effort limits. Conditional mandatory controls follow mode; no color-only cue.
3. Services/Add service, populated Email and narrow fields; visible legend/help and keyboard/error association; 1440/390 reference comparison plus 320 and text enlargement.
4. UX-V05 / UX-C42 visual fidelity evidence must pass, as defined below; passing functional tests alone is insufficient.

Dependencies: root definition source commit and remaining derived validation; REC-RM-013 integrates REC-RM-009/010, REC-RM-014 integrates REC-RM-007/011. REC-RM-012 shares field/reflow rules with REC-RM-008.
Explicit exclusions: new roles, removed advanced options, service packs, autosave/partial apply, pixel-perfect sample content and unrelated redesign.
Required implementation validation: positive/negative external input, permission/state/error and preservation tests plus synthetic browser interaction and matched visual comparisons.

### REC-RM-013: Compact People list and full account detail

Priority: MEDIUM
Source findings: REC-011
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-023, PO-FB-024.
Authoritative basis: approved web-console-ux-3 / UX-DESIGN-003; UX-IA07, UX-IN12, UX-R05, UX-V05; UX-C38/39/42; PRD UX-02/03/04.
Desired outcome / required behavior: One row per human account opens full detail via accessible link/row, preserving return/filter context. Group permitted contact/role edits, metadata, recovery and access actions.
Current behavior: Baseline embeds each user’s actions in separate cards.
Affected users/roles: authorized console editors/readers; Member restrictions preserved.
Affected interfaces and compatibility: existing console navigation/forms and management API/state behavior; no removed configuration capability.
UX constraints: Use REC-RM-009/010 role and metadata contracts. No bulk actions, invented profile fields or new permissions; My account retains own password/MFA. Narrow list retains Account/Role and reachable detail.
Architecture/security constraints: STATE-01/02/03, SECRES-05/06/07; current permissions, atomic reviewed activation, audit and write-only/version-fenced credentials remain mandatory.

Acceptance criteria:
1. One row per human account opens full detail via accessible link/row, preserving return/filter context. Group permitted contact/role edits, metadata, recovery and access actions.
2. Use REC-RM-009/010 role and metadata contracts. No bulk actions, invented profile fields or new permissions; My account retains own password/MFA. Narrow list retains Account/Role and reachable detail.
3. Owner/Administrator/Auditor projections and forbidden targets; keyboard link/back/filter behavior; People list/detail at matching desktop/narrow reference states.
4. UX-V05 / UX-C42 visual fidelity evidence must pass, as defined below; passing functional tests alone is insufficient.

Dependencies: root definition source commit and remaining derived validation; REC-RM-013 integrates REC-RM-009/010, REC-RM-014 integrates REC-RM-007/011. REC-RM-012 shares field/reflow rules with REC-RM-008.
Explicit exclusions: new roles, removed advanced options, service packs, autosave/partial apply, pixel-perfect sample content and unrelated redesign.
Required implementation validation: positive/negative external input, permission/state/error and preservation tests plus synthetic browser interaction and matched visual comparisons.

### REC-RM-014: Populated Settings with truthful save and activation

Priority: MEDIUM
Source findings: REC-016
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-033, PO-FB-035, PO-FB-036, PO-FB-037, PO-FB-038, PO-FB-039, PO-FB-041.
Authoritative basis: approved web-console-ux-3 / UX-DESIGN-003; UX-IA05/08, UX-IN10/13, UX-V05; UX-C34/35/36/40/42; PRD UX-02/03/04.
Desired outcome / required behavior: Authorized section entry opens populated non-secret form with exact In use, Saved for later · Not in use yet, or Unsaved changes. Review changes validates/saves then full-scope review; Apply commits reviewed set atomically and refreshes real values.
Current behavior: Baseline duplicates applied summaries/edit affordances; backup and diagnostics draft/current distinction is confusing. No data-loss diagnosis is invented.
Affected users/roles: authorized console editors/readers; Member restrictions preserved.
Affected interfaces and compatibility: existing console navigation/forms and management API/state behavior; no removed configuration capability.
UX constraints: Save for later never applies; no hidden autosave, no-op submission or silent unrelated discard. Navigation guards safe work. Distinguish loading/absence/error/uncertainty; password never prefills. Diagnostics Standard(info)/Detailed(debug) uses same revision; health refresh/time independent, retention cleanup separately reported. SMTP tests applied state only; pending values need apply.
Architecture/security constraints: STATE-01/02/03, SECRES-05/06/07; current permissions, atomic reviewed activation, audit and write-only/version-fenced credentials remain mandatory.

Acceptance criteria:
1. Authorized section entry opens populated non-secret form with exact In use, Saved for later · Not in use yet, or Unsaved changes. Review changes validates/saves then full-scope review; Apply commits reviewed set atomically and refreshes real values.
2. Save for later never applies; no hidden autosave, no-op submission or silent unrelated discard. Navigation guards safe work. Distinguish loading/absence/error/uncertainty; password never prefills. Diagnostics Standard(info)/Detailed(debug) uses same revision; health refresh/time independent, retention cleanup separately reported. SMTP tests applied state only; pending values need apply.
3. Email TLS/None and saved password, backup saved/review/applied, diagnostics/health; positive save/reload/apply plus stale/failed/unknown/unauthorized cases; screenshots matching approved states.
4. UX-V05 / UX-C42 visual fidelity evidence must pass, as defined below; passing functional tests alone is insufficient.

Dependencies: root definition source commit and remaining derived validation; REC-RM-013 integrates REC-RM-009/010, REC-RM-014 integrates REC-RM-007/011. REC-RM-012 shares field/reflow rules with REC-RM-008.
Explicit exclusions: new roles, removed advanced options, service packs, autosave/partial apply, pixel-perfect sample content and unrelated redesign.
Required implementation validation: positive/negative external input, permission/state/error and preservation tests plus synthetic browser interaction and matched visual comparisons.

## Shared visual acceptance contract for REC-RM-007–014

UX-V05 / UX-C42 is mandatory for the affected implementation, including the earlier resolved remediation. Use the immutable concept files and hashes in product/ux/manifest.yaml. Capture actual implementation with equivalent synthetic state, role and viewport and compare directly against reference screenshots for populated Email, None warning, backup saved/full-review/applied result, People list/detail, Add service destinations, diagnostics and narrow Email/People. Verify representative 1440px desktop and 390px narrow composition plus 320 CSS px and enlarged text. Preserve all fields and accessible reading/focus order.

Record reference path/hash, actual screenshot, viewport, state/role, observed visual differences and resolution. Check composition, useful width, density, type hierarchy, spacing, grouped cards/surfaces, dark text, orange accents, controls/action hierarchy, rails and responsive transformation. Fix material divergence before claiming UX conformance, or obtain an explicit scoped acceptance with rationale. Never modify reference concepts to disguise drift. Functional equivalence alone is insufficient. Sample data, antialiasing and minor rendering differences do not require pixel matching. Accessibility and security remain mandatory; material necessary deviations require explicit acceptance.

The same contract prevents the old service marker overlap from disappearing behind element-box-only checks: visually inspect painted markers, text ranges, document width and headings under enlargement. Existing recovery and unrelated flows retain prior approved appearance and behavior.
