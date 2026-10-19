# Milestone 39: Navigate guided editing without a redundant detection section

## Objective

Create and edit a service through the remaining guided sections, follow an old Secret detection section entry, then navigate Back/Forward with unsaved input preserved and reach policy overrides and shared Settings normally.

## User/System Outcome

Remove the standalone Secret detection guided destination and close its navigation gap without removing scanning settings, review content or existing fields.

## Scope

Remove the standalone Secret detection guided destination and close its navigation gap without removing scanning settings, review content or existing fields. All necessary local view-state, accessibility, compatibility and validation support belongs within this observable boundary.

## Explicit Exclusions

Only REC-RM-032 is new implementation scope. Other REC010 refinements have separate milestones. No optional slider, new numeric semantics, shared catalog redesign, blanket warning removal, new API/permissions/storage, service packs, runtime scanning/transport changes, unrelated Settings, backup/recovery or live deployment. Completed M10–36 remain the preservation baseline.

## Source Requirements

- REC-RM-032 from [REC010 resolved backlog](../../../workflow/reconciliation/REC-RUN-010/03-remediation-backlog.md), governed by POLICY-02; UX-IA09/10, UX-IN15, UX-G07, UX-V08, UX-A09, UX-C61. Findings are provenance only.
- [Validated definition package](../../../workflow/definition/definition-package.yaml) and committed [effective next_handoff](../../../workflow/definition/state.yaml) satisfy REC010's immutable historical revalidation gate. [Status](status.yaml) pins source hashes and producer commits; do not reinterpret historical raw flags as a fresh gate.

## Preconditions

- `PRE-051` — Current committed UX6 definition and finalized parent planning handoff; verify recorded revisions/producer ancestry before implementation.
- `PRE-052` — Declared Node/npm/OpenSSL and locked packages available; documented clean-checkout setup needs no live instance.
- `PRE-053` — Disposable HTTPS/headless Chromium, writable temporary storage and permitted loopback available; use isolated synthetic fixtures.
- `PRE-054` — Completed M27, M33 provide the affected behavior and safe integration contracts; accepted evidence and commits remain current. Other new refinement milestones are not functional prerequisites.
- `PRE-055` — This milestone owns its new focused, negative, boundary and actual-browser visual evidence during delivery; no feature acceptance is claimed by readiness.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml` and `status.yaml#compiled_from`: parent publication is finalized, source revisions match and commits exist in history. Inspect provider records/evidence for M27, M33; each must remain completed.
- `node --version`, `npm --version`, `openssl version`, `npm ls --depth=0` — Node satisfies package.json >=22 and all declared packages/tooling are available. A clean checkout runs `npm ci`; this is setup, not a new product dependency.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` — install matching declared browser when missing; documented in `docs/console-operations.md`. Verify writable temporary storage and authorized loopback; do not use the running review instance or its mounts.
- Inspect `product/ux/manifest.yaml` and referenced assets: approved visual references resolve, with UX6's named delta taking precedence over superseded image details. Retain current M36 facility evidence where unchanged; run this milestone's actual comparison during acceptance.
- Inspect the applicable existing browser harness and test files before extending them; suppress transport request logs and retain synthetic fixtures. Final `npm test -- --maxWorkers=2` and `npm run build` run on frozen source without concurrent browser/Docker work.

## Functional Requirements

- Guided service create/edit omit the standalone Secret detection section and its empty global-settings diversion. Retain coherent remaining section navigation and sequence; do not introduce a replacement redundant review step.
- Old section entry and Back/Forward resolve safely to a remaining relevant section under existing navigation guards. Never strand focus, lose unsaved input, rewrite historical location incorrectly or create false dirty state. Keep drafts and return-focus state in memory; route reads cannot overwrite a later destination.
- Rule-specific secret-detection and binary controls remain in policy editing; shared defaults/catalogs remain reachable in Settings under existing permissions. Keep relevant complete review values and exact saved/imported fields through Guided/Advanced transitions, save and apply.
- Any remaining shared-settings link names destination and wider impact and guards unsaved work. Preserve create/edit authorization, actionable validation, policy tester, rule dialogs and existing apply outcomes.

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

- [ ] Actual create and edit guided navigation omit the standalone Secret detection section with no gap or orphaned step; remaining sections and review are reachable.
- [ ] Direct/old section entry, Back/Forward and dirty Stay/Save/Discard navigation preserve work and focus under existing guards; delayed old reads cannot replace the chosen location.
- [ ] Rule scanning controls, shared Settings and complete review remain available under their original roles; exact imported/custom scanning configuration survives view changes and save/apply.
- [ ] Unauthorized mutations and stale apply remain rejected, with no new permissions or hidden application; removing the destination performs no data deletion.
- [ ] Matching desktop/narrow/text-enlarged browser evidence preserves the approved guided composition except the intentional removed destination; no overlap, clipping, focus loss or document/text-range overflow.

## Required Validation

- Focused positive, negative and boundary tests for affected behavior and every new external input; include malformed/unauthorized/stale cases where applicable, exact literal/ordering preservation and secret-safe output.
- Real disposable HTTPS/headless-browser interaction plus desktop/narrow/200% text screenshots at matching manifest reference states. Record tested revision, viewport/state, reference and comparison outcome under evidence/qa and evidence/ux-acceptance. Use synthetic example.org fixtures; no running review-instance or live storage mutation. Generated fixtures qualify local behavior, not real ChatGPT/Codex connectivity.
- At milestone completion run `npm test -- --maxWorkers=2` and `npm run build` with source frozen and no concurrent browser/Docker workload. On loopback EPERM rerun the same command with narrow permission; preserve assertions/timeouts. Reuse current sufficient evidence rather than repeat full acceptance without reason.
- Preserve existing focused editor/navigation, policy, initial-grant, recovered-service and service-review regression expectations except the exact superseded UX detail. Existing external-LLM connection exception remains explicit; no new waiver. Presentation-only work requires no new Docker recovery drill; if implementation touches recovery/transport, the affected existing gates apply.

## Known Risks / Deferred Work

One section-removal/navigation outcome includes necessary history and lossless-data compatibility; it does not depend on new rule markers or review presentation. Implementation mechanics are delegated without changing settled intent. No required work is deferred. Existing best-effort scanning limitation remains accepted; the optional slider is excluded, not promised.
