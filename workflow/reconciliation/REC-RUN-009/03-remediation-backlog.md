# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: docs/web-console-prd.md CONFIG-03/POLICY-04, product/ux/02-interaction-patterns.md UX-IN02/04; REC-CHANGE-035/036 applied after confirmed directives.
> Preservation baseline: 35e6226b5a734b46bbc4b291e93ec103d8eee77c; accepted M25–34 behavior.
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false — selective definition revalidation remains.

| Priority | Remediation | Outcome | Findings | Requirements | Dependencies | Validation |
|---|---|---|---|---|---|---|
| MEDIUM | REC-RM-027 | Grouped review is obscured by repeated full configuration output | REC-035 | CONFIG-03, UX-02/04 | Current authority | Browser and targeted positive/negative checks |
| MEDIUM | REC-RM-028 | Service approval interaction lacks the requested final confirmation dialog | REC-036 | CONFIG-03, POLICY-04, STATE-02 | Current authority | Browser and targeted positive/negative checks |
| MEDIUM | REC-RM-029 | TLS exception scope is expressed with an internal destination identifier | REC-037 | POLICY-04, UX-02, UX-IN02/04 | Current authority | Browser and targeted positive/negative checks |

### REC-RM-027: Grouped review is obscured by repeated full configuration output

Priority: MEDIUM
Source findings: REC-035
Product Owner feedback: PO-FEEDBACK-2026-10-18-001, PO-FB-125, PO-FB-126, PO-FB-127, PO-FB-128, PO-FB-129, PO-FB-130
Authoritative basis: docs/web-console-prd.md CONFIG-03, UX-02/04; UX-IN02/04 as corrected by REC-CHANGE-035/036, existing STATE-01/02.
Desired outcome: Service review has separate Changes and complete New settings views, grouped by section, readable comparison and labeled green/red/yellow distinctions where feasible.
Current behavior: renderReview emits Named changes followed by complete Current applied and Proposed configuration blocks. The owner reports this as a wall of text; visual reproduction was not performed in this transaction.
Required behavior: Service review has separate Changes and complete New settings views, grouped by section, readable comparison and labeled green/red/yellow distinctions where feasible.
Affected users/roles: Owner and Administrator service managers; read-only users gain no apply permission.
Affected interfaces and compatibility: Service review UI and exact review/acknowledgment binding; existing capability and literal round trips remain.
UX constraints: Existing UX4 general appearance, keyboard/dialog patterns, meaningful labels, narrow reflow, no color-only states; no wholesale redesign.
Architecture/security constraints: Existing STATE-02, POLICY-04, SEC-01/02/03, AUDIT-01/04; no secret disclosure, bypass or changed transport.

Acceptance criteria:
1. Changes groups only changed material by service configuration section; complete proposed settings remain reachable in the second tab.
2. No-current-baseline, no-change, added/removed/changed values and exact nested/custom options and ordered arrays remain truthful; comparison does not normalize away meaning.
3. Both tabs exclude credentials and secret-bearing values and retain affected scope, initial proposed grants and disruption context.
4. Actual HTTPS browser evidence checks tab keyboard operation, readable wide comparison, narrow reflow and 200% text enlargement against the current visual system.

Dependencies: Applied local authority; definition revalidation before planning.
Explicit exclusions: Global Settings/SMTP redesign, runtime TLS changes, new permissions, credential behavior, recovery or deployment changes.
Required implementation validation: Targeted positive, negative and stale/permission cases; actual HTTPS browser screenshots at desktop/narrow/200% with synthetic data; current full suite and build under repository bounded-worker guidance.

### REC-RM-028: Service approval interaction lacks the requested final confirmation dialog

Priority: MEDIUM
Source findings: REC-036
Product Owner feedback: PO-FEEDBACK-2026-10-18-001, PO-FB-131, PO-FB-132, PO-FB-133
Authoritative basis: docs/web-console-prd.md CONFIG-03, POLICY-04, STATE-02; UX-IN02/04 as corrected by REC-CHANGE-035/036, existing STATE-01/02.
Desired outcome: Approve changes opens Continue/Cancel confirmation. With exceptions, every individual acknowledgment is required before Continue; without exceptions a concise activation confirmation suffices.
Current behavior: renderReview currently places required exception checkboxes on the page and directly submits Apply reviewed changes. The server already enforces every exact reviewed exception.
Required behavior: Approve changes opens Continue/Cancel confirmation. With exceptions, every individual acknowledgment is required before Continue; without exceptions a concise activation confirmation suffices.
Affected users/roles: Owner and Administrator service managers; read-only users gain no apply permission.
Affected interfaces and compatibility: Service review UI and exact review/acknowledgment binding; existing capability and literal round trips remain.
UX constraints: Existing UX4 general appearance, keyboard/dialog patterns, meaningful labels, narrow reflow, no color-only states; no wholesale redesign.
Architecture/security constraints: Existing STATE-02, POLICY-04, SEC-01/02/03, AUDIT-01/04; no secret disclosure, bypass or changed transport.

Acceptance criteria:
1. Opening or cancelling the modal causes no activation; Continue without exceptions commits the exact reviewed proposal after existing checks.
2. With exceptions Continue is unavailable until all boxes are checked; forged/missing/extra acknowledgments are rejected server-side.
3. Role change, stale base/draft/dependency or credential mutation rejects old review and acknowledgments; no partial activation or false success.
4. Pending submission prevents duplicate apply; known failure and unknown completion use existing truthful recovery/status behavior. Keyboard focus is contained/restored and controls are accessible.

Dependencies: Applied local authority; definition revalidation before planning.
Explicit exclusions: Global Settings/SMTP redesign, runtime TLS changes, new permissions, credential behavior, recovery or deployment changes.
Required implementation validation: Targeted positive, negative and stale/permission cases; actual HTTPS browser screenshots at desktop/narrow/200% with synthetic data; current full suite and build under repository bounded-worker guidance.

### REC-RM-029: TLS exception scope is expressed with an internal destination identifier

Priority: MEDIUM
Source findings: REC-037
Product Owner feedback: PO-FEEDBACK-2026-10-18-001, PO-FB-134, PO-FB-135, PO-FB-136, PO-FB-137
Authoritative basis: docs/web-console-prd.md POLICY-04, UX-02, UX-IN02/04; UX-IN02/04 as corrected by REC-CHANGE-035/036, existing STATE-01/02.
Desired outcome: Security exceptions identify recognizable affected destinations and truthful effective TLS scope. A service-wide default is not described as applying to overridden destinations; retain every distinct risk and acknowledgment obligation.
Current behavior: exceptions emits Service TLS verification disabled plus TLS verification disabled: id/name for each effective false destination. An imported name primary is used as the main context. Destination override takes precedence over service default; an omitted destination setting inherits the service default.
Required behavior: Security exceptions identify recognizable affected destinations and truthful effective TLS scope. A service-wide default is not described as applying to overridden destinations; retain every distinct risk and acknowledgment obligation.
Affected users/roles: Owner and Administrator service managers; read-only users gain no apply permission.
Affected interfaces and compatibility: Service review UI and exact review/acknowledgment binding; existing capability and literal round trips remain.
UX constraints: Existing UX4 general appearance, keyboard/dialog patterns, meaningful labels, narrow reflow, no color-only states; no wholesale redesign.
Architecture/security constraints: Existing STATE-02, POLICY-04, SEC-01/02/03, AUDIT-01/04; no secret disclosure, bypass or changed transport.

Acceptance criteria:
1. Service default false with no overrides describes affected destinations; true override is not falsely described as disabled.
2. Service default true with destination false identifies only the overridden destination; omitted default stays true.
3. Duplicate/internal/missing display names remain distinguishable using safe recognizable destination context; never include credentials or secret-bearing URL components.
4. Cleartext HTTP, broad matching, reduced scanning, default allow and recovered-service acknowledgments remain accurate and independently required.

Dependencies: Applied local authority; definition revalidation before planning.
Explicit exclusions: Global Settings/SMTP redesign, runtime TLS changes, new permissions, credential behavior, recovery or deployment changes.
Required implementation validation: Targeted positive, negative and stale/permission cases; actual HTTPS browser screenshots at desktop/narrow/200% with synthetic data; current full suite and build under repository bounded-worker guidance.
