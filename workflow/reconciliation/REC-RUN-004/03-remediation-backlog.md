# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: product/ux/02-interaction-patterns.md UX-IN05; product/ux/01-information-architecture.md UX-IA06; docs/web-console-prd.md UX-02/03.
> Preservation baseline: bbbd9e329ad6b9ec3c4bec692c81b7d7d99db49d (delivered M18–21).
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| MEDIUM | REC-RM-007 | No undefined SMTP empty-state values | REC-015 | UX-02/03, UX-IN05/IA06 | None for this bounded correction | Configured/unconfigured/disabled state and write-only secret checks |

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

All other requested changes remain outside this eligible backlog until their detailed authority is resolved. This one-item backlog is not a ready handoff for the entire feedback package.
