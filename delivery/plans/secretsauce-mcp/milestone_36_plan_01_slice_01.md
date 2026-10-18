# M36 slice01: Confirm exact reviewed changes

## Goal and entry
From service Changes/New settings, Approve changes opens a modal naming service and reviewed revision. Open/cancel has no mutation; Continue activates exactly the reviewed proposal after each original exception is checked.

## Dependencies / scope
Accepted M35 and M28; REC-RM-028/029, approved UX5 and milestone36 govern. Preserve service review and risk identities, sanitized read model, actor/session/dependency checks, recovered Owner restriction, atomic audit publication. No global settings, transport, credential lifecycle, live deployment or schema changes.

## State and permissions
Closed → open with unchecked risks → pending with duplicate/cancel blocked → success/current revision, known rejection/re-review, or unknown/status inspection. Cancel/Escape before submit returns focus and retains tab/scroll. Stale/reopened approvals reset checks. No client-only authorization. Read-only users remain excluded.

## Implementation investigation
Inspect current API error/status contract before classifying rejection vs unknown; use durable operation status and current service reads before any renewed review, never automatically resend. Preserve independent service-default and destination exception identities while deriving safe labels from sanitized proposal, distinguishing inherited/override and HTTP/HTTPS. Existing renderer textContent prevents HTML execution.

## Surfaces
consoleServicePage.ts, a focused service approval presentation module, narrow API error metadata if needed, service tests and synthetic HTTPS harness. Do not edit root status.yaml.

## Tests and acceptance
Positive/negative cases: no exceptions; each exact risk with partial/missing/extra/forged acknowledgments; TLS default false/true/omitted and overrides, mixed HTTP+HTTPS, duplicate/missing/internal identifiers, hostile/sensitive URLs; preserved rule/default/recovered risks; unchanged server role/base/draft/credential constraints. Actual browser open/cancel/Escape/focus/keyboard, tab retention, all-checkbox gating/reopen, pending duplicate, rejection and unknown with status read, successful active revision, joined exact custom-data review, sanitizer/storage checks. Compare desktop/narrow/text200 screenshots with feedback004. Final bounded-worker full suite plus build after freeze; record hashes and evidence. Commit only owned code/tests/harness/plans/evidence after current passing validation.

## Delivered and validated
Completed: helper uses independent original risk keys and safe ordinal/address labels filtered to affected destinations; modal provides exact per-risk checks, pending guard, renewed review after rejection, status inspection after unknown outcome and exact active revision on success. Narrow API HTTP-status metadata supports conservative error classification; server apply/audit/storage/transport unchanged. Renewed review retains original editor return section. Unknown in-memory state prevents opening a fresh approval until inspection or a new current-state view.

Final validation: cumulative disposable HTTPS browser PASS, full suite772 tests/77files115.05s and build PASS; input hashes verified unchanged. Evidence: evidence/qa/secretsauce-mcp/milestone36/{acceptance.md,validation.json,tested-inputs.json}; evidence/ux-acceptance/secretsauce-mcp/milestone36/visual-review.md. Earlier full-suite pass predates return-section correction and is explicitly superseded. Initial browser fixture failures and listener permission requirement are resolved and recorded. Root independently accepted modal visual direction. git diff --check and both changed browser script syntax checks pass. Slice complete; exact commit SHA is recorded by root's subsequent acceptance transaction to avoid self-reference.

Accepted implementation commit: `c7b2a1dd9c9542f922d49549907d7f62be5c29d0`.
