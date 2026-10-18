# Milestone 35: Compare service changes and inspect complete new settings

## Objective

Edit a representative imported service, save and open review; compare changed section pairs, inspect the complete proposal, then return to edit without mutation.

## User/System Outcome

Comparison and complete-proposal tabs share one immutable reviewed scope and must agree; confirmation and exception wording remain a separate independently acceptable outcome.

## Scope

- Deliver only the grouped comparison/complete proposal views and their read-only navigation. Preserve existing working approval controls until M36 replaces their presentation; M35 must be demonstrable independently.

## Explicit Exclusions

No unrelated Settings/SMTP redesign, new roles, tenancy, service packs, credential/recovery behavior, transport/policy redesign or live deployment. Preserve completed M10–34 outcomes; only REC-RM-027 is implementation scope.

## Source Requirements

- REC-RM-027 — resolved required delta from REC-RUN-009. Findings REC-035–037 and feedback PO-FB-125–137 are provenance, not independent scope.
- [Validated package](../../../workflow/definition/definition-package.yaml), committed [effective handoff](../../../workflow/definition/state.yaml#next_handoff) and [resolved REC009 backlog](../../../workflow/reconciliation/REC-RUN-009/03-remediation-backlog.md). Exact hashes and producer commits are pinned in [status](status.yaml).
- Approved UX5 / UX-DESIGN-005, CONFIG-03, POLICY-04, BASE-01, STATE-01/02 and SEC-01/02/03, AUDIT-01/04 govern the delta. REC009 historical revalidation-required flag is satisfied by the later committed definition handoff; prototype draft banners are historical, not a new approval gate.

## Preconditions

- PRE-045 — committed approved UX5 package and finalized planning handoff remain current; parent planning publication is required before delivery.
- PRE-046/PRE-047 — declared Node/npm/OpenSSL, installed locked dependencies, disposable writable state and authorized local HTTPS/Chromium facilities are available.
- PRE-048 — M27 and M33 completed with committed evidence. Existing server authorization, exact review binding and sanitized configuration providers remain intact.
- PRE-050 — consuming milestone owns new positive/negative, boundary and actual visual acceptance fixtures; feature evidence is not a bootstrap prerequisite.

## Readiness checks

- Inspect `status.yaml` and the finalized `workflow/delivery-planning/handoff.yaml`: source hashes/producers match, named providers are completed, and no later authoritative change invalidates this packet.
- `node --version`, `npm --version`, `openssl version`, `npm ls --depth=0` — Node meets `package.json` (>=22), declared packages resolve and fixture certificate tooling exists. A fresh checkout uses `npm ci` followed by `npm run build` as in CI.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` — provision the declared matching browser if absent. Use the same environment variable for actual HTTPS fixture runs; temporary cache presence is not assumed on a clean checkout.
- Inspect `scripts/verify-console-navigation-browser.mjs` and `docs/console-operations.md:23` for disposable HTTPS/browser setup. Run synthetic localhost tests with permitted loopback; on EPERM repeat the same test with narrow permission. Never use the running review instance or live storage.
- Inspect approved feedback004 reference paths from `product/ux/manifest.yaml` and compare actual screenshots at matching state/viewport during acceptance. Run final `npm test -- --maxWorkers=2` and build separately from browser/Docker workloads; preserve all assertions and timeouts.

## Functional Requirements

- Changes is selected initially and lists only changed material in Details, Allowed servers, Authentication, Request rules, Secret detection and Additional configuration as needed. Align equal Before/After columns per field/item at wide width. Show labeled + Added / − Removed / ~ Changed with restrained green/red/amber accents, never color alone.
- Retain exact typed values: absent differs from empty string, false, zero, null and empty collections. Added Before is “Not configured”; removed After is “Removed”; markers cannot masquerade as literal values. Stable identity matches may compare fields; identity replacement remains removal plus addition. Surface order changes and never sort arrays to hide differences.
- No baseline says “No active configuration yet” and presents additions. No changes says “No configuration changes”; keep New settings reachable and preserve the actual existing enable/review consequence rather than inventing no-op Apply.
- New settings presents every supported sanitized proposal value in named section cards, two columns wide / one narrow, with bounded readable substructure for custom options. No full-object dump or nested accordion tree. Credential availability metadata remains distinct from values; immediate credential/access changes are not pending draft changes.
- Both tabs retain the exact review target/base/dependencies, service identity, affected scope, initial proposed grants, disruption and return-to-edit context. Tab switching is local/read-only: no save/apply, dirty flag, reset or persistent secret-bearing state. Loading, missing, error and permission-denied states must remain truthful.

## UX Constraints

- Canonical [UX-IN17](../../../product/ux/02-interaction-patterns.md#ux-in17--service-review-comparison-and-approval), UX-R07, UX-V07, UX-A08 and [UX-C54–58](../../../product/ux/07-acceptance-checklist.md), with existing UX-V05/UX-C42, govern this service-only change.
- Preserve approved warm accent, pale neutral background, white bordered cards, horizontal space, readable typography and restrained colored states. Use [feedback004 references](../../../workflow/definition/drafts/product-ux/web-console-feedback-004/index.md) at matching states/viewports; compare actual HTTPS browser screenshots for width, spacing, density, typography, controls, color and hierarchy. Repair material drift; functional tests alone cannot establish visual acceptance.
- At narrow width stack each Before/After pair together; New settings cards become one column. Test keyboard operation, visible focus, accessible names and 200% text; inspect document scroll width and overflowing text ranges as well as component boxes. Preserve exact readable literals, not clipped distinguishing text.

## Architecture / Security Constraints

Preserve existing server-side Owner/Administrator eligibility, recovered-service Owner restriction, enrolled identity and actor/session/dependency review binding. Read-only roles gain no apply capability. Authorization, durable audit admission, atomic publication and generation invalidation remain unchanged. Do not add credentials, opaque proofs, tokens, cookies, Authorization or downstream bodies to review output, browser storage, logs or evidence. Existing sanitizer and own-property-safe keys apply before rendering. No normalization/reordering may change configuration semantics. No client-only acknowledgment or stale-review bypass; preserve live broker/scanner/limiter instances and current transport.

## Interfaces and Compatibility

Service review presentation only; admitted API/read-model extensions, if strictly necessary, preserve existing review identity, exact exception identities and input compatibility. No new configuration schema, feature removal, storage migration or public MCP protocol change is required. Preserve all supported YAML, custom methods/regex, typed nested options, ordered arrays, exact identifiers and five-tool ChatGPT/Codex behavior. No global Settings/SMTP, credential lifecycle, backup/restore or deployment change. Use synthetic example.org fixtures; never mutate the running review instance or live volumes.

## Acceptance Criteria

- [ ] A representative imported service edited through Guided and Advanced modes reaches grouped comparison and a complete proposal with no dropped supported value.
- [ ] Add/remove/change, nested typed values, no baseline/no change, stable identity replacement and array reordering render truthfully; comparison never invents equal or renamed items.
- [ ] Both tabs preserve review binding, scope/grants/disruption and contain no secret-bearing content; switching and returning to edit cause no mutation or false dirty state.
- [ ] Actual desktop/narrow Changes and New settings screenshots match approved changes-desktop/narrow.png and new-desktop/narrow.png; tabs are keyboard accessible and 200% text preserves every value.
- [ ] Existing approval, server-side stale/permission rejection and supported configuration round trips still pass. This outcome does not depend on M36.

## Required Validation

- Focused positive/negative and boundary tests for each new external input and affected state; malformed, unauthorized, stale, secret-bearing and own-property edge cases. Demonstrate preserved supported literal configurations with representative synthetic advanced data.
- Actual HTTPS headless-browser evidence at desktop/narrow/200% text, keyboard controls and matching approved screenshots. Evidence must identify tested revision, state, viewport and source reference. Store sanitized results under evidence/qa and evidence/ux-acceptance; do not rewrite approved references to mask drift.
- At each milestone completion run `npm test -- --maxWorkers=2` and `npm run build`; run the full suite without concurrent browser/Docker workloads. On loopback EPERM rerun the same command with narrow loopback permission, never weaken assertions/timeouts. Reuse existing synthetic HTTPS harness patterns. Documentation compilation itself runs no application tests.

## Known Risks / Deferred Work

Comparison and complete-proposal tabs share one immutable reviewed scope and must agree; confirmation and exception wording remain a separate independently acceptable outcome. Implementation mechanisms remain delegated without changing settled semantics. No required behavior is deferred outside this packet. Existing response-scanning limitation and external-client validation exception remain; no new waiver.
