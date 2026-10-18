# Milestone 36: Confirm reviewed changes with understandable security exceptions

## Objective

From the grouped review, open and cancel confirmation, then acknowledge every effective exception and apply exactly the reviewed service; stale or unauthorized attempts remain rejected.

## User/System Outcome

The confirmation and readable exception scope are one approval decision: each visible risk must map to its existing exact acknowledgment identity. TLS transport and independent comparison rendering are not rebuilt.

## Scope

- Deliver final service confirmation and accurate meaningful exception labels together, using the M35 reviewed scope and preserving each existing risk identity. Include known success/failure/uncertainty behavior and final combined review acceptance.

## Explicit Exclusions

No unrelated Settings/SMTP redesign, new roles, tenancy, service packs, credential/recovery behavior, transport/policy redesign or live deployment. Preserve completed M10–34 outcomes; only REC-RM-028, REC-RM-029 is implementation scope.

## Source Requirements

- REC-RM-028, REC-RM-029 — resolved required delta from REC-RUN-009. Findings REC-035–037 and feedback PO-FB-125–137 are provenance, not independent scope.
- [Validated package](../../../workflow/definition/definition-package.yaml), committed [effective handoff](../../../workflow/definition/state.yaml#next_handoff) and [resolved REC009 backlog](../../../workflow/reconciliation/REC-RUN-009/03-remediation-backlog.md). Exact hashes and producer commits are pinned in [status](status.yaml).
- Approved UX5 / UX-DESIGN-005, CONFIG-03, POLICY-04, BASE-01, STATE-01/02 and SEC-01/02/03, AUDIT-01/04 govern the delta. REC009 historical revalidation-required flag is satisfied by the later committed definition handoff; prototype draft banners are historical, not a new approval gate.

## Preconditions

- PRE-045 — committed approved UX5 package and finalized planning handoff remain current; parent planning publication is required before delivery.
- PRE-046/PRE-047 — declared Node/npm/OpenSSL, installed locked dependencies, disposable writable state and authorized local HTTPS/Chromium facilities are available.
- PRE-048/PRE-049 — M35 completed with current committed acceptance, and completed M28 destination semantics. Existing server authorization, exact review binding and sanitized configuration providers remain intact.
- PRE-050 — consuming milestone owns new positive/negative, boundary and actual visual acceptance fixtures; feature evidence is not a bootstrap prerequisite.

## Readiness checks

- Inspect `status.yaml` and the finalized `workflow/delivery-planning/handoff.yaml`: source hashes/producers match, named providers are completed, and no later authoritative change invalidates this packet.
- `node --version`, `npm --version`, `openssl version`, `npm ls --depth=0` — Node meets `package.json` (>=22), declared packages resolve and fixture certificate tooling exists. A fresh checkout uses `npm ci` followed by `npm run build` as in CI.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` — provision the declared matching browser if absent. Use the same environment variable for actual HTTPS fixture runs; temporary cache presence is not assumed on a clean checkout.
- Inspect `scripts/verify-console-navigation-browser.mjs` and `docs/console-operations.md:23` for disposable HTTPS/browser setup. Run synthetic localhost tests with permitted loopback; on EPERM repeat the same test with narrow permission. Never use the running review instance or live storage.
- Inspect approved feedback004 reference paths from `product/ux/manifest.yaml` and compare actual screenshots at matching state/viewport during acceptance. Run final `npm test -- --maxWorkers=2` and build separately from browser/Docker workloads; preserve all assertions and timeouts.

## Functional Requirements

- Keep a concise exception summary and bottom “Approve changes” action. It opens a named modal and does not activate. State “This will apply changes and make this the active configuration”, service and reviewed revision. Without exceptions Continue is available only under existing valid-review prerequisites; Cancel remains available before submission.
- With exceptions state “Before changes can be applied, please review and acknowledge the following:” and show one initially unchecked checkbox per existing required exception. No acknowledge-all. Continue remains disabled until all boxes are selected; show remaining count. Reopening or stale review never retains acknowledgments.
- Cancel/Escape before submission applies nothing and restores review tab/scroll/focus. Pending submission prevents duplicate Continue and announces Applying; do not offer cancellation implying an admitted operation can be undone. Success identifies the new active revision, rejection explains correction while preserving safe work, unknown completion requires durable status verification before retry. Existing readiness blockers cannot be acknowledged away.
- Preserve service-default and destination exception identities independently. Explain TLS inheritance vs override and list only actually affected destinations: default false with override true must not label that server off; default true/omitted with override false identifies that destination only. For HTTP+HTTPS distinguish HTTPS certificate verification from separate cleartext HTTP. Never imply all servers unless accurate.
- Use meaningful configured context or sanitized host/base address, plus ordinal if duplicate/missing/internal names require disambiguation. Do not fabricate a display-name field, expose secret-bearing URL userinfo/query, or show primary/secondary as sole context. Preserve default-allow, broad matching, reduced scanning, cleartext and recovered-service risks independently.
- Continue submits the exact current review and every required original acknowledgment; no client-only enforcement. Missing/extra/forged acknowledgments and role/base/draft/dependency/credential changes fail safely with no partial activation or false success.

## UX Constraints

- Canonical [UX-IN17](../../../product/ux/02-interaction-patterns.md#ux-in17--service-review-comparison-and-approval), UX-R07, UX-V07, UX-A08 and [UX-C54–58](../../../product/ux/07-acceptance-checklist.md), with existing UX-V05/UX-C42, govern this service-only change.
- Preserve approved warm accent, pale neutral background, white bordered cards, horizontal space, readable typography and restrained colored states. Use [feedback004 references](../../../workflow/definition/drafts/product-ux/web-console-feedback-004/index.md) at matching states/viewports; compare actual HTTPS browser screenshots for width, spacing, density, typography, controls, color and hierarchy. Repair material drift; functional tests alone cannot establish visual acceptance.
- At narrow width stack each Before/After pair together; New settings cards become one column. Test keyboard operation, visible focus, accessible names and 200% text; inspect document scroll width and overflowing text ranges as well as component boxes. Preserve exact readable literals, not clipped distinguishing text.

## Architecture / Security Constraints

Preserve existing server-side Owner/Administrator eligibility, recovered-service Owner restriction, enrolled identity and actor/session/dependency review binding. Read-only roles gain no apply capability. Authorization, durable audit admission, atomic publication and generation invalidation remain unchanged. Do not add credentials, opaque proofs, tokens, cookies, Authorization or downstream bodies to review output, browser storage, logs or evidence. Existing sanitizer and own-property-safe keys apply before rendering. No normalization/reordering may change configuration semantics. No client-only acknowledgment or stale-review bypass; preserve live broker/scanner/limiter instances and current transport.

## Interfaces and Compatibility

Service review presentation only; admitted API/read-model extensions, if strictly necessary, preserve existing review identity, exact exception identities and input compatibility. No new configuration schema, feature removal, storage migration or public MCP protocol change is required. Preserve all supported YAML, custom methods/regex, typed nested options, ordered arrays, exact identifiers and five-tool ChatGPT/Codex behavior. No global Settings/SMTP, credential lifecycle, backup/restore or deployment change. Use synthetic example.org fixtures; never mutate the running review instance or live volumes.

## Acceptance Criteria

- [ ] No-exception and multi-exception dialog paths activate only on valid Continue; opening/Cancel/Escape apply nothing, preserve context and return focus.
- [ ] Partial checks cannot submit; server rejects missing/extra/forged acknowledgments. Reopen/stale review clears checks, concurrent dependencies/credential changes and permission loss invalidate old approval.
- [ ] TLS combinations (default false with true override, default true/omitted with false override, all inherited, mixed HTTP+HTTPS) show exact effective scope without changing transport or merging exception obligations.
- [ ] Duplicate/internal/missing destination names have safe distinguishable context; secret-bearing labels/HTML are not disclosed or executed. Other risk classes and recovered-service Owner-only review remain intact.
- [ ] Pending duplicate submission, known rejection, definite success and unknown completion produce truthful recovery and no hidden activation.
- [ ] Both actual dialog variants match approved exception-dialog-desktop/narrow.png and no-exception-dialog-desktop.png; keyboard focus, Escape, narrow and 200% text checks pass.
- [ ] Joined edit → save → Changes/New settings → approval → current active revision flow passes with representative exact custom options, full scope/grants/disruption, negative stale/permission and secret non-disclosure checks. M35 remains conforming.

## Required Validation

- Focused positive/negative and boundary tests for each new external input and affected state; malformed, unauthorized, stale, secret-bearing and own-property edge cases. Demonstrate preserved supported literal configurations with representative synthetic advanced data.
- Actual HTTPS headless-browser evidence at desktop/narrow/200% text, keyboard controls and matching approved screenshots. Evidence must identify tested revision, state, viewport and source reference. Store sanitized results under evidence/qa and evidence/ux-acceptance; do not rewrite approved references to mask drift.
- At each milestone completion run `npm test -- --maxWorkers=2` and `npm run build`; run the full suite without concurrent browser/Docker workloads. On loopback EPERM rerun the same command with narrow loopback permission, never weaken assertions/timeouts. Reuse existing synthetic HTTPS harness patterns. Documentation compilation itself runs no application tests.
- Final combined M35/M36 review journey and regression checks of existing focused editor/navigation, initial grants, enable/recovered review and current service apply contract. Broader Docker recovery drills are not newly required by this presentation-only delta; if implementation changes a recovery/transport boundary, run the affected existing gates (actual self-signed HTTPS for transport). No real external client connection is claimed; its existing exception remains.

## Known Risks / Deferred Work

The confirmation and readable exception scope are one approval decision: each visible risk must map to its existing exact acknowledgment identity. TLS transport and independent comparison rendering are not rebuilt. Implementation mechanisms remain delegated without changing settled semantics. No required behavior is deferred outside this packet. Existing response-scanning limitation and external-client validation exception remain; no new waiver.
