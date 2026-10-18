# Milestone 33: Navigate service history and test policy without losing work

## Objective

Use actual browser Back/Forward and a deep link, run no-I/O policy testing in context, return with focus/scroll and safe edits intact.

## User/System Outcome

Back/Forward and tool return preserve real service/section/step context and safe edits. Policy tester is the approved focused dialog, with no stacked dialogs or false dirty state; shared-settings links identify wider scope.

## Scope

Deliver REC-RM-025 through the existing managed console, admitted commands and directly necessary persistence/runtime support. History, tool return and dirty guards share the same editing-context contract; no router-wide rewrite or global Settings redesign. Include operator help and regression evidence needed for this outcome.

## Explicit Exclusions

All other REC-RM-015–026 outcomes remain in their mapped milestones; shared governing constraints still apply. No permanent service purge, auto-grants, hidden apply, unsupported feature removal, service-specific packs, SMTP clearing exception, new roles, SaaS expansion or unrelated Settings/account redesign. Do not replace working gateway algorithms or rebuild the whole console.

## Source Requirements

- REC-RM-025 — UX-IN15/16, POLICY-01/03, UX-IA10; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes. Feedback provenance: PO-FEEDBACK-2026-10-17-001 / PO-FB-111, PO-FB-112, PO-FB-113, PO-FB-114, PO-FB-115, PO-FB-120; findings REC-031, REC-033 are evidence, not independent authority.
- [Validated definition package](../../../workflow/definition/definition-package.yaml), [effective handoff](../../../workflow/definition/state.yaml#next_handoff), [resolved backlog](../../../workflow/reconciliation/REC-RUN-008/03-remediation-backlog.md); exact source hashes/producer commits are pinned in [status](status.yaml). UX4/UX-DESIGN-004 approval is authoritative; historical prototype draft labels are not an unresolved approval gate.

## Preconditions

- `PRE-035–040` — committed approved authority, locked tooling, actual browser/loopback facilities and completed console foundations; see [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).
- `PRE-044` — this milestone owns its new positive/negative, fault/boundary and actual matching-reference visual evidence; existing fixtures are available, acceptance is not yet run.
- `PRE-041` — M27 focused sections must be completed; M33 additionally requires M31 rule editing.
- `27` — completed provider contract consumed; see [index](index.md) for its outcome.
- `31` — completed provider contract consumed; see [index](index.md) for its outcome.
- Current committed definition handoff and readiness approval for this packet; no open product decisions. This compiler records known dependencies only; milestone-readiness owns environment prerequisite auditing.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml`, the current definition source hashes and this manifest: parent planning commit/provenance must be finalized; named provider milestones must be completed with committed evidence.
- `node --version`, `npm --version`, `openssl version`, `npm ls --depth=0` — declared Node >=22 and complete locked dependencies; from a clean checkout run `npm ci` then `npm run build` (CI/Docker use Node22).
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` when absent; retain the same variable for actual browser harnesses. Inspect approved UX4 reference hashes and matching states/viewports. Installation/probe is facility readiness, not product visual acceptance.
- Inspect the existing `scripts/verify-console-*-browser.mjs` synthetic HTTPS/temp-state harnesses and `test/setupAudit.ts`; ensure permitted local loopback and writable disposable paths. Run required tests with narrow local permission on sandbox EPERM rather than weakening assertions.
- For operational checks, `docker version` and `docker compose version` must succeed; build current test images and record immutable IDs. Inspect isolated mounts and actual launcher/lease use. Existing script image variables, fixed legacy tag and historical-output caveats are documented in the prerequisite manifest. Never use the live review instance or its volumes.

## Functional Requirements

- Back/Forward and tool return preserve real service/section/step context and safe edits. Policy tester is the approved focused dialog, with no stacked dialogs or false dirty state; shared-settings links identify wider scope.
- Enforce existing Owner/Administrator mutation permissions server-side, authorized Auditor read-only views and Member-only permitted discovery/execution. Current enrollment/role/dependency checks and durable audit admission apply to direct routes as well as UI.
- Preserve precise success, definite failure, stale state and uncertain outcome. Keep authorized non-secret work, name the affected field/dependency with a corrective route, and reconcile durable state before retry after an unknown mutation outcome. Never infer save/apply success from a closed dialog.

## UX Constraints

- Canonical [information architecture](../../../product/ux/01-information-architecture.md), [interaction patterns](../../../product/ux/02-interaction-patterns.md), [responsive](../../../product/ux/03-responsive-and-platform.md), [visual system](../../../product/ux/04-visual-system.md), [accessibility](../../../product/ux/05-accessibility.md) and [acceptance checklist](../../../product/ux/07-acceptance-checklist.md): applicable rules **UX-IA10; UX-IN04/15/16; UX-C45/50/52**, plus UX-V05/V06, UX-A07, UX-R06 and UX-C42/C53.
- Matching-state references: [policy.html](../../../workflow/definition/drafts/product-ux/web-console-feedback-003/policy.html); [rule-dialog.png](../../../workflow/definition/drafts/product-ux/web-console-feedback-003/rule-dialog.png); [detection.html](../../../workflow/definition/drafts/product-ux/web-console-feedback-003/detection.html). Use approved HTML for states not captured in PNG; compare actual browser screenshots at equivalent desktop/narrow viewport and state. Record width, spacing, density, typography, controls, colors and hierarchy; functional checks alone cannot pass. Correct material drift or obtain explicit scoped exception; never rewrite references to mask drift.
- Maintain approved shell and horizontal space, one focused ordinary task, local labels/help/required cues, textual state indicators and meaningful empty/loading/error/read-only states. Unknown loading state is not empty success. Preserve all exact identifiers and supported advanced options; ordinary views need not expose system-only details but technical access remains reachable.
- Real links/current-location semantics, distinct row action targets, keyboard operability and focus indication; named dialogs with Cancel/Escape, bounded focus and return. No stacked dialogs, secret entry in persistent browser state, or navigation-triggered mutation. New repeated fields receive focus/scroll/announcement. At narrow width and 200% text inspect document width and text ranges as well as component boxes; no clipped distinguishing literals.

## Architecture / Security Constraints

- [STATE-01/02/03/09](../../../product/architecture/web-console-state-contract.md) and [SECRES-08](../../../product/security/web-console-security-contract.md) govern affected behavior. Preserve current authorization/destination/canonical policy before substitution or dispatch, stateless MCP, admitted immutable response protection and live broker/scanner/limiter instances.
- Values are write-only; never log/echo/store raw credentials, fingerprints, tokens, Authorization, cookies, opaque proofs or downstream bodies in ordinary metadata/errors/history. Keep secret-free audit attribution, own-property-safe maps, exact imported literals and generation-bound stale rejection. Do not promise forensic/retroactive archive erasure or universal non-exfiltration.
- Service draft save/activation, immediate values, execution grants and lifecycle remain distinct. Configuration history/discard cannot restore revoked authority or values. SMTP rules, backup permissions and explicit reviewed restore restrictions are unchanged.

## Interfaces and Compatibility

Preserve supported YAML/configuration/MCP capabilities and five tools for ChatGPT and Codex. Extend admitted console commands/read models only as this outcome requires, with backward-compatible legacy input handling or explicit fail-closed format protection under STATE-09. Never silently drop custom methods, typed options, imported key shapes or regex literals. No deployment, live-data migration or production mutation is authorized by compilation. Use example.org in committed examples.

## Acceptance Criteria

- [ ] Browser Back/Forward/deep link/refresh identify the permitted destination without resetting safe in-memory draft or manufacturing edits; guards offer accurate stay/save/discard behavior.
- [ ] Tester opens from the current context and returns focus/scroll there without marking draft dirty; rule dialog must close/keep/cancel first.
- [ ] Preview keeps identity/service/destination/method/path/source and reports canonical target, eligibility, rule/default and effective protection; no downstream call, substitution or execution grant.
- [ ] Shared secret detection link explicitly opens wider Settings and guards unsaved work; no hidden local duplicate or unauthorized navigation.
- [ ] Errors/session loss/stale state retain only permitted safe work and never claim activation or definite failure for unknown mutation outcome.
- [ ] Every affected permission/state path is exercised with positive and negative evidence; unchanged supported capability round-trips and no secret-bearing output are demonstrated.
- [ ] Actual browser visual comparison and keyboard/narrow/200%-text evidence meet the named approved UX references and state contract; no material unapproved drift remains.
- [ ] The observable checkpoint can be demonstrated without any later milestone being implemented; later specialized redesign does not substitute for missing promised behavior.

## Required Validation

- Actual browser history/dirty-state/dialog journey plus no-downstream preview assertion and unauthorized/stale context tests. New inputs require positive and negative tests.
- During implementation use focused tests for changed domains and representative integration first. New external inputs require positive and negative cases, including malformed, unauthorized, stale and boundary inputs. Fixtures are synthetic and representative, not proof of every deployment or real LLM integration.
- At milestone completion run `npm test` and `npm run build`, applicable actual headless-browser journey/accessibility/screenshot checks and the operational tests named above. Reuse existing `scripts/verify-console-*.mjs` harnesses where appropriate; passing old evidence alone does not prove new behavior. Rerun full suite with permitted loopback if sandbox reports listen EPERM rather than weakening tests. Actual self-signed HTTPS validation is mandatory if downstream transport changes.
- M34 is the final integrated local checkpoint: revalidate the complete import → mapping → guided/advanced configuration → credential/policy → review/apply → lifecycle and backup/recovery journey using representative advanced fixtures and all new browser suites, plus required Docker crash/restart/recovery checks. This does not defer any earlier milestone acceptance. The existing recorded exception for actual external ChatGPT/Codex connection remains; local protocol coverage is required and is not claimed as real-client evidence.
- Store sanitized outcome/command and matching-reference screenshot evidence under evidence/ with requirement links. Update relevant operator guidance with no internal deployment identifiers. No application tests are run by documentation compilation itself.

## Known Risks / Deferred Work

History, tool return and dirty guards share the same editing-context contract; no router-wide rewrite or global Settings redesign. Implementation mechanisms remain delegated within the settled contracts. No required source behavior is deferred out of this packet. Existing accepted response-scanning limitation and external-client validation exception remain explicit; no new waiver is created.
