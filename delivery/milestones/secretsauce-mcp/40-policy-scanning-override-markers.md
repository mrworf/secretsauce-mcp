# Milestone 40: Identify every explicit policy scanning override

## Objective

View policy rules with inherited, secret-detection, reduced/increased and default-equivalent binary overrides; edit a rule and verify neutral markers track explicit configuration while actual risk warnings remain separate.

## User/System Outcome

Identify every rule with an explicit secret-detection or binary-scanning override using a neutral readable marker in existing compact rule rows.

## Scope

Identify every rule with an explicit secret-detection or binary-scanning override using a neutral readable marker in existing compact rule rows. All necessary local view-state, accessibility, compatibility and validation support belongs within this observable boundary.

## Explicit Exclusions

Only REC-RM-033 is new implementation scope. Other REC010 refinements have separate milestones. No optional slider, new numeric semantics, shared catalog redesign, blanket warning removal, new API/permissions/storage, service packs, runtime scanning/transport changes, unrelated Settings, backup/recovery or live deployment. Completed M10–36 remain the preservation baseline.

## Source Requirements

- REC-RM-033 from [REC010 resolved backlog](../../../workflow/reconciliation/REC-RUN-010/03-remediation-backlog.md), governed by POLICY-02/04; UX-IN16, UX-V08, UX-A09, UX-C62. Findings are provenance only.
- [Validated definition package](../../../workflow/definition/definition-package.yaml) and committed [effective next_handoff](../../../workflow/definition/state.yaml) satisfy REC010's immutable historical revalidation gate. [Status](status.yaml) pins source hashes and producer commits; do not reinterpret historical raw flags as a fresh gate.

## Preconditions

- `PRE-051` — Current committed UX6 definition and finalized parent planning handoff; verify recorded revisions/producer ancestry before implementation.
- `PRE-052` — Declared Node/npm/OpenSSL and locked packages available; documented clean-checkout setup needs no live instance.
- `PRE-053` — Disposable HTTPS/headless Chromium, writable temporary storage and permitted loopback available; use isolated synthetic fixtures.
- `PRE-054` — Completed M31 provide the affected behavior and safe integration contracts; accepted evidence and commits remain current. Other new refinement milestones are not functional prerequisites.
- `PRE-055` — This milestone owns its new focused, negative, boundary and actual-browser visual evidence during delivery; no feature acceptance is claimed by readiness.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml` and `status.yaml#compiled_from`: parent publication is finalized, source revisions match and commits exist in history. Inspect provider records/evidence for M31; each must remain completed.
- `node --version`, `npm --version`, `openssl version`, `npm ls --depth=0` — Node satisfies package.json >=22 and all declared packages/tooling are available. A clean checkout runs `npm ci`; this is setup, not a new product dependency.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` — install matching declared browser when missing; documented in `docs/console-operations.md`. Verify writable temporary storage and authorized loopback; do not use the running review instance or its mounts.
- Inspect `product/ux/manifest.yaml` and referenced assets: approved visual references resolve, with UX6's named delta taking precedence over superseded image details. Retain current M36 facility evidence where unchanged; run this milestone's actual comparison during acceptance.
- Inspect the applicable existing browser harness and test files before extending them; suppress transport request logs and retain synthetic fixtures. Final `npm test -- --maxWorkers=2` and `npm run build` run on frozen source without concurrent browser/Docker work.

## Functional Requirements

- Mark any explicit rule-specific secret-detection or binary-scanning override, including protection-increasing overrides and explicit binary values equal to the current default. Rules without an override have no marker; classify presence, not reduced-risk status.
- Use a neutral visible textual marker such as Scanning override associated with the rule. Do not use a full-row danger tint, urgent alert or hover-only explanation; do not squeeze existing criteria/actions into an unnecessary new column.
- Keep actual reduced-protection warnings separate and unchanged under POLICY-04; marker presence grants no new risk, permission or acknowledgment behavior. Rule Add/Edit/Cancel, imports and Guided/Advanced changes retain exact values, custom options, identifiers, priority and order.
- Preserve existing supported size/value/unit/unlimited interaction and validation. Do not implement the optional slider, round imported sizes, introduce a maximum, reinterpret zero as scan-disabled or conflate scan=false with a size.

## UX Constraints

- Canonical [UX6 manifest](../../../product/ux/manifest.yaml) and [UX-G07](../../../product/ux/00-overview.md), [interaction patterns](../../../product/ux/02-interaction-patterns.md), UX-R08/V08/A09 and [UX-C63](../../../product/ux/07-acceptance-checklist.md) apply alongside the milestone-specific references above.
- Compare actual HTTPS screenshots at matching states/viewports to manifest-routed approved feedback 003/004 references for layout, horizontal use, spacing, density, typography, controls, colors and hierarchy. UX-G07 supersedes only the named refinements; unchanged approved image bytes do not require restoring superseded details. Do not invent a new visual family or rewrite references to hide drift.
- Preserve warm primary accent, pale neutral background, white bordered groups, readable typography and compact domain-specific rows/cards. Narrow layout and 200% text retain every value and action; inspect document scroll width and overflowing text ranges as well as boxes. Keyboard focus, semantic labels and existing modal focus/Escape behavior remain intact.
- Retain existing loading, empty, validation, known rejection, success and uncertain-outcome behavior; local navigation never acts as mutation or approval. Functional tests alone cannot establish visual acceptance.

## Architecture / Security Constraints

Preserve STATE-01/02/03 and SECRES-01, existing enrolled Owner/Administrator eligibility, permission-appropriate Auditor reads, Member restrictions, recovered-service Owner-only approval, actor/session/base/draft/credential/dependency binding, audit admission and atomic publication. No new permissions or runtime scanning/transport behavior. Never expose credentials, opaque tokens/proofs, Authorization, cookies or downstream bodies in views, logs, browser storage or evidence. Preserve exact sanitization and own-property-safe keys. Browser harnesses suppress Playwright request call logs on failure; synthetic fixtures do not justify secret-bearing diagnostics.

## Interfaces and Compatibility

Presentation and existing navigation only. Preserve all public MCP/API/configuration contracts, custom methods/regex/options, typed values and ordered arrays, exact identifiers and five-tool ChatGPT/Codex behavior. No persistent migration, new schema or cross-version storage change is required; rollback restores only prior presentation, never rewrites saved configuration. Active/draft separation, shared Settings and service grant semantics remain unchanged.

## Acceptance Criteria

- [ ] Both override families show a neutral readable marker for every explicit override, including increased protection and default-equivalent binary configuration; truly inherited rules have none.
- [ ] Adding, editing, canceling and removing overrides accurately reflects the current draft without automatic saving/applying, mutation of other fields or loss of exact imported/custom values and rule order.
- [ ] Actual reduced-protection warnings, exception classification and exact acknowledgment gates remain separate and unchanged; unauthorized/stale writes stay rejected.
- [ ] Existing arbitrary supported size literals and unlimited survive unchanged; invalid and zero sizes retain existing validation rejection and scan-disabled semantics stay separate.
- [ ] Desktop/narrow/text-enlarged real-browser rule rows preserve approved density/actions with accessible visible marker text and no hover dependency, clipping, overlap or document/text-range overflow.

## Required Validation

- Focused positive, negative and boundary tests for affected behavior and every new external input; include malformed/unauthorized/stale cases where applicable, exact literal/ordering preservation and secret-safe output.
- Real disposable HTTPS/headless-browser interaction plus desktop/narrow/200% text screenshots at matching manifest reference states. Record tested revision, viewport/state, reference and comparison outcome under evidence/qa and evidence/ux-acceptance. Use synthetic example.org fixtures; no running review-instance or live storage mutation. Generated fixtures qualify local behavior, not real ChatGPT/Codex connectivity.
- At milestone completion run `npm test -- --maxWorkers=2` and `npm run build` with source frozen and no concurrent browser/Docker workload. On loopback EPERM rerun the same command with narrow permission; preserve assertions/timeouts. Reuse current sufficient evidence rather than repeat full acceptance without reason.
- Preserve existing focused editor/navigation, policy, initial-grant, recovered-service and service-review regression expectations except the exact superseded UX detail. Existing external-LLM connection exception remains explicit; no new waiver. Presentation-only work requires no new Docker recovery drill; if implementation touches recovery/transport, the affected existing gates apply.

## Known Risks / Deferred Work

One rule scope-identification outcome. Existing rule editing supplies its inputs; removing the unrelated guided destination and review changes can be accepted separately. Implementation mechanics are delegated without changing settled intent. No required work is deferred. Existing best-effort scanning limitation remains accepted; the optional slider is excluded, not promised.
