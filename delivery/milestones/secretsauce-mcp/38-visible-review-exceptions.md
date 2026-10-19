# Milestone 38: See concrete security exceptions before approval

## Objective

Review a service with multiple actual security exceptions, read every safe scoped bullet before opening approval, then demonstrate that each independent modal acknowledgment is still required.

## User/System Outcome

Replace the rejected generic review disclaimer/count-only summary with a semantic list of actual safe exception descriptions, accessible from either review tab before Approve changes.

## Scope

Replace the rejected generic review disclaimer/count-only summary with a semantic list of actual safe exception descriptions, accessible from either review tab before Approve changes. All necessary local view-state, accessibility, compatibility and validation support belongs within this observable boundary.

## Explicit Exclusions

Only REC-RM-031 is new implementation scope. Other REC010 refinements have separate milestones. No optional slider, new numeric semantics, shared catalog redesign, blanket warning removal, new API/permissions/storage, service packs, runtime scanning/transport changes, unrelated Settings, backup/recovery or live deployment. Completed M10–36 remain the preservation baseline.

## Source Requirements

- REC-RM-031 from [REC010 resolved backlog](../../../workflow/reconciliation/REC-RUN-010/03-remediation-backlog.md), governed by CONFIG-03, POLICY-04; UX-IN17, UX-V08, UX-R08, UX-A09, UX-C56/57/60. Findings are provenance only.
- [Validated definition package](../../../workflow/definition/definition-package.yaml) and committed [effective next_handoff](../../../workflow/definition/state.yaml) satisfy REC010's immutable historical revalidation gate. [Status](status.yaml) pins source hashes and producer commits; do not reinterpret historical raw flags as a fresh gate.

## Preconditions

- `PRE-051` — Current committed UX6 definition and finalized parent planning handoff; verify recorded revisions/producer ancestry before implementation.
- `PRE-052` — Declared Node/npm/OpenSSL and locked packages available; documented clean-checkout setup needs no live instance.
- `PRE-053` — Disposable HTTPS/headless Chromium, writable temporary storage and permitted loopback available; use isolated synthetic fixtures.
- `PRE-054` — Completed M36 provide the affected behavior and safe integration contracts; accepted evidence and commits remain current. Other new refinement milestones are not functional prerequisites.
- `PRE-055` — This milestone owns its new focused, negative, boundary and actual-browser visual evidence during delivery; no feature acceptance is claimed by readiness.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml` and `status.yaml#compiled_from`: parent publication is finalized, source revisions match and commits exist in history. Inspect provider records/evidence for M36; each must remain completed.
- `node --version`, `npm --version`, `openssl version`, `npm ls --depth=0` — Node satisfies package.json >=22 and all declared packages/tooling are available. A clean checkout runs `npm ci`; this is setup, not a new product dependency.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` — install matching declared browser when missing; documented in `docs/console-operations.md`. Verify writable temporary storage and authorized loopback; do not use the running review instance or its mounts.
- Inspect `product/ux/manifest.yaml` and referenced assets: approved visual references resolve, with UX6's named delta taking precedence over superseded image details. Retain current M36 facility evidence where unchanged; run this milestone's actual comparison during acceptance.
- Inspect the applicable existing browser harness and test files before extending them; suppress transport request logs and retain synthetic fixtures. Final `npm test -- --maxWorkers=2` and `npm run build` run on frozen source without concurrent browser/Docker work.

## Functional Requirements

- Show every actual reviewed exception as a readable bullet in the existing bottom exception surface, above Approve changes. Do not hard-code three, hide in a disclosure, substitute a count or silently acknowledge. With zero show a neutral no-security-exceptions state.
- Use the same safe scope-specific meaning as existing acknowledgment labels. Preserve service-default versus destination override identities independently, inherited-off and explicit-off labels, explicit-on exclusions and mixed HTTP/HTTPS scope. Meaningful safe context/ordinals distinguish internal or duplicate names without URL userinfo/query secrets.
- Modal still starts with every exact required checkbox unchecked, gates Continue on all, and rejects missing/extra/forged/stale acknowledgments server-side. Reading bullets does not waive blockers, alter risk classification or persist acknowledgment. Preserve cancellation, pending duplicate prevention, known failures and unknown-outcome status verification.
- Only replace this rejected generic disclaimer; keep truthful best-effort limitations and destination trust guidance elsewhere. Preserve all non-TLS risks, recovered-service Owner-only approval and unchanged scope/grants/disruption information.

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

- [ ] Zero, one and many exception states show complete readable bullets or neutral none text before approval from either tab; no generic disclaimer/count-only substitute remains here.
- [ ] The list and modal agree on each actual risk and scope without changing exact acknowledgment identities. TLS default-off/override-on, default-on/override-off, inherited and mixed-protocol cases are correct.
- [ ] Bullets do not check or persist acknowledgment; partial, missing, extra, forged and stale acknowledgment requests cannot apply. Cancel/Escape, pending, success, known failure and unknown completion retain existing safe behavior.
- [ ] Secret-bearing or HTML-like labels cannot disclose credentials or execute markup; readable duplicate/internal-name scope remains distinct; other risks and recovered-service restriction are preserved.
- [ ] Actual desktop/narrow/text-enlarged screenshots show readable natural list growth in the approved exception surface, keyboard access and modal focus without clipping, overlap or page/text-range overflow.

## Required Validation

- Focused positive, negative and boundary tests for affected behavior and every new external input; include malformed/unauthorized/stale cases where applicable, exact literal/ordering preservation and secret-safe output.
- Real disposable HTTPS/headless-browser interaction plus desktop/narrow/200% text screenshots at matching manifest reference states. Record tested revision, viewport/state, reference and comparison outcome under evidence/qa and evidence/ux-acceptance. Use synthetic example.org fixtures; no running review-instance or live storage mutation. Generated fixtures qualify local behavior, not real ChatGPT/Codex connectivity.
- At milestone completion run `npm test -- --maxWorkers=2` and `npm run build` with source frozen and no concurrent browser/Docker workload. On loopback EPERM rerun the same command with narrow permission; preserve assertions/timeouts. Reuse current sufficient evidence rather than repeat full acceptance without reason.
- Preserve existing focused editor/navigation, policy, initial-grant, recovered-service and service-review regression expectations except the exact superseded UX detail. Existing external-LLM connection exception remains explicit; no new waiver. Presentation-only work requires no new Docker recovery drill; if implementation touches recovery/transport, the affected existing gates apply.

## Known Risks / Deferred Work

One risk visibility outcome, including its exact mapping to preserved acknowledgments. Default-tab placement is independently acceptable and not a dependency. Implementation mechanics are delegated without changing settled intent. No required work is deferred. Existing best-effort scanning limitation remains accepted; the optional slider is excluded, not promised.
