# Milestone 29: Clear in-use credential values with durable attribution

## Objective

Clear an applied key through confirmed UI, observe blocked new execution with unchanged lifecycle, deliberately Set it, and verify stable last-successful attribution after restart.

## User/System Outcome

Delete clears only an in-use value and retains the key; unreferenced Delete removes the key. Apply saved/applied dependency checks, monotonic mutation identity, current confirmation and immediate admission/restart fencing.; Persist and display stable last-successful Set/Replace/Clear actor/time without leaking values or inventing legacy attribution.

## Scope

Deliver REC-RM-020 and REC-RM-021 through the existing managed console, admitted commands and directly necessary persistence/runtime support. Clear, generation fencing, current projection coherence and successful actor/time persistence form one atomic mutation outcome. Splitting attribution storage would create newly written records without required attribution. Full entry-dialog redesign and archive qualification are separate. Include operator help and regression evidence needed for this outcome.

## Explicit Exclusions

All other REC-RM-015–026 outcomes remain in their mapped milestones; shared governing constraints still apply. No permanent service purge, auto-grants, hidden apply, unsupported feature removal, service-specific packs, SMTP clearing exception, new roles, SaaS expansion or unrelated Settings/account redesign. Do not replace working gateway algorithms or rebuild the whole console. Full archive compatibility acceptance belongs to M34; entry-dialog redesign belongs to M30.

## Source Requirements

- REC-RM-020 — CONFIG-02/03, STATE-09, SECRES-08; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes. Feedback provenance: PO-FEEDBACK-2026-10-17-001 / PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067; findings REC-024 are evidence, not independent authority.
- REC-RM-021 — CONFIG-02, AUDIT-01, STATE-09, SECRES-T21; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes. Feedback provenance: PO-FEEDBACK-2026-10-17-001 / PO-FB-060; findings REC-022 are evidence, not independent authority.
- [Validated definition package](../../../workflow/definition/definition-package.yaml), [effective handoff](../../../workflow/definition/state.yaml#next_handoff), [resolved backlog](../../../workflow/reconciliation/REC-RUN-008/03-remediation-backlog.md); exact source hashes/producer commits are pinned in [status](status.yaml). UX4/UX-DESIGN-004 approval is authoritative; historical prototype draft labels are not an unresolved approval gate.

## Preconditions

- `PRE-035–040` — committed approved authority, locked tooling, actual browser/loopback facilities and completed console foundations; see [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).
- `PRE-044` — this milestone owns its new positive/negative, fault/boundary and actual matching-reference visual evidence; existing fixtures are available, acceptance is not yet run.
- `11` — completed provider contract consumed; see [index](index.md) for its outcome.
- Current committed definition handoff and readiness approval for this packet; no open product decisions. This compiler records known dependencies only; milestone-readiness owns environment prerequisite auditing.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml`, the current definition source hashes and this manifest: parent planning commit/provenance must be finalized; named provider milestones must be completed with committed evidence.
- `node --version`, `npm --version`, `openssl version`, `npm ls --depth=0` — declared Node >=22 and complete locked dependencies; from a clean checkout run `npm ci` then `npm run build` (CI/Docker use Node22).
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` when absent; retain the same variable for actual browser harnesses. Inspect approved UX4 reference hashes and matching states/viewports. Installation/probe is facility readiness, not product visual acceptance.
- Inspect the existing `scripts/verify-console-*-browser.mjs` synthetic HTTPS/temp-state harnesses and `test/setupAudit.ts`; ensure permitted local loopback and writable disposable paths. Run required tests with narrow local permission on sandbox EPERM rather than weakening assertions.
- For operational checks, `docker version` and `docker compose version` must succeed; build current test images and record immutable IDs. Inspect isolated mounts and actual launcher/lease use. Existing script image variables, fixed legacy tag and historical-output caveats are documented in the prerequisite manifest. Never use the live review instance or its volumes.

## Functional Requirements

- Delete clears only an in-use value and retains the key; unreferenced Delete removes the key. Apply saved/applied dependency checks, monotonic mutation identity, current confirmation and immediate admission/restart fencing.
- Persist and display stable last-successful Set/Replace/Clear actor/time without leaking values or inventing legacy attribution.
- Enforce existing Owner/Administrator mutation permissions server-side, authorized Auditor read-only views and Member-only permitted discovery/execution. Current enrollment/role/dependency checks and durable audit admission apply to direct routes as well as UI.
- Preserve precise success, definite failure, stale state and uncertain outcome. Keep authorized non-secret work, name the affected field/dependency with a corrective route, and reconcile durable state before retry after an unknown mutation outcome. Never infer save/apply success from a closed dialog.

- Apply all STATE-09 current-state rules: include saved and applied references of Disabled/Archived services; exclude browser-only edits/history/archives from live dependency checks. Remove normalized current value copies atomically, preserve monotonic incarnation/generation across delete/recreate, and fail closed for unsupported old readers. Persist actor/server time with successful mutations; already-cleared/no-op, rejected and uncertain actions never manufacture a changer. Preserve existing backup safety: current snapshots must not contain contradictory copies. M34 owns exhaustive old/new archive recovery qualification, not permission to weaken snapshot consistency.
- Prove actual queued versus dispatched behavior with synthetic downstream integration. Reconcile secret-free durable intents on restart before sensitive admission; a later replacement survives old-intent replay. Test prior reader itself, not an import failure in new helper code.
## UX Constraints

- Canonical [information architecture](../../../product/ux/01-information-architecture.md), [interaction patterns](../../../product/ux/02-interaction-patterns.md), [responsive](../../../product/ux/03-responsive-and-platform.md), [visual system](../../../product/ux/04-visual-system.md), [accessibility](../../../product/ux/05-accessibility.md) and [acceptance checklist](../../../product/ux/07-acceptance-checklist.md): applicable rules **UX-IN14; UX-C47/48; STATE-09; SECRES-T17–T19/T21**, plus UX-V05/V06, UX-A07, UX-R06 and UX-C42/C53.
- Matching-state references: [clear-dialog.png](../../../workflow/definition/drafts/product-ux/web-console-feedback-003/clear-dialog.png); [authentication-desktop.png](../../../workflow/definition/drafts/product-ux/web-console-feedback-003/authentication-desktop.png). Use approved HTML for states not captured in PNG; compare actual browser screenshots at equivalent desktop/narrow viewport and state. Record width, spacing, density, typography, controls, colors and hierarchy; functional checks alone cannot pass. Correct material drift or obtain explicit scoped exception; never rewrite references to mask drift.
- Maintain approved shell and horizontal space, one focused ordinary task, local labels/help/required cues, textual state indicators and meaningful empty/loading/error/read-only states. Unknown loading state is not empty success. Preserve all exact identifiers and supported advanced options; ordinary views need not expose system-only details but technical access remains reachable.
- Real links/current-location semantics, distinct row action targets, keyboard operability and focus indication; named dialogs with Cancel/Escape, bounded focus and return. No stacked dialogs, secret entry in persistent browser state, or navigation-triggered mutation. New repeated fields receive focus/scroll/announcement. At narrow width and 200% text inspect document width and text ranges as well as component boxes; no clipped distinguishing literals.

## Architecture / Security Constraints

- [STATE-01/02/03/09](../../../product/architecture/web-console-state-contract.md) and [SECRES-08](../../../product/security/web-console-security-contract.md) govern affected behavior. Preserve current authorization/destination/canonical policy before substitution or dispatch, stateless MCP, admitted immutable response protection and live broker/scanner/limiter instances.
- Values are write-only; never log/echo/store raw credentials, fingerprints, tokens, Authorization, cookies, opaque proofs or downstream bodies in ordinary metadata/errors/history. Keep secret-free audit attribution, own-property-safe maps, exact imported literals and generation-bound stale rejection. Do not promise forensic/retroactive archive erasure or universal non-exfiltration.
- Service draft save/activation, immediate values, execution grants and lifecycle remain distinct. Configuration history/discard cannot restore revoked authority or values. SMTP rules, backup permissions and explicit reviewed restore restrictions are unchanged.

## Interfaces and Compatibility

Preserve supported YAML/configuration/MCP capabilities and five tools for ChatGPT and Codex. Extend admitted console commands/read models only as this outcome requires, with backward-compatible legacy input handling or explicit fail-closed format protection under STATE-09. Never silently drop custom methods, typed options, imported key shapes or regex literals. No deployment, live-data migration or production mutation is authorized by compilation. Use example.org in committed examples.

## Acceptance Criteria

- [ ] Applied and saved-draft dependencies, including Disabled/Archived configurations, retain the exact key; empty referenced key reports no-op and empty unreferenced key can be deleted.
- [ ] Bind confirmed target/incarnation/version/revision/dependencies; stale replacement/reference change rejects and cannot switch clear/delete outcome. Cancel/audit-admission failure changes nothing.
- [ ] Cleared applied dependency blocks new references/substitution/dispatch including queued work; draft-only missing value does not interrupt valid applied execution. Set restores only eligible current execution without activating drafts or enabling disabled/recovered services.
- [ ] Invalidate affected reviews/references; preserve admitted old-value response protection and live broker/scanner/limiter instances; late completion cannot repopulate secrets or mint revoked authority.
- [ ] Durable secret-free intent and generation reconciliation fence uncertainty across pre/post-replacement failures/restart; old replay cannot clear a later replacement and unsupported older readers fail closed.
- [ ] Owner/Administrator permission only; SMTP creation/replacement/deletion semantics unchanged; no secret/value fingerprint in reads, errors, audit or logs.
- [ ] Successful mutations record authenticated stable actor/server time; imported supplied committed value credits its submitting actor.
- [ ] Renamed/disabled/removed actor retains safe authorized attribution; absent legacy metadata displays Unknown rather than current viewer/import mapping.
- [ ] Cancel/no-op/rejected/uncertain mutation does not fabricate last-successful metadata; client-supplied actor/time cannot spoof it.
- [ ] Stored values/fingerprints never appear in UI/GET/log/history/export; current identity visibility remains enforced.
- [ ] Every affected permission/state path is exercised with positive and negative evidence; unchanged supported capability round-trips and no secret-bearing output are demonstrated.
- [ ] Actual browser visual comparison and keyboard/narrow/200%-text evidence meet the named approved UX references and state contract; no material unapproved drift remains.
- [ ] The observable checkpoint can be demonstrated without any later milestone being implemented; later specialized redesign does not substitute for missing promised behavior.

## Required Validation

- STATE-09 acceptance and SECRES-T17–T19: positive/negative direct API, actual dispatch races, fault injection, restart and prior-reader compatibility tests. New inputs require positive and negative tests.
- Metadata positive/negative persistence/rename/removal/legacy tests and read-permission browser evidence. New inputs require positive and negative tests.
- During implementation use focused tests for changed domains and representative integration first. New external inputs require positive and negative cases, including malformed, unauthorized, stale and boundary inputs. Fixtures are synthetic and representative, not proof of every deployment or real LLM integration.
- At milestone completion run `npm test` and `npm run build`, applicable actual headless-browser journey/accessibility/screenshot checks and the operational tests named above. Reuse existing `scripts/verify-console-*.mjs` harnesses where appropriate; passing old evidence alone does not prove new behavior. Rerun full suite with permitted loopback if sandbox reports listen EPERM rather than weakening tests. Actual self-signed HTTPS validation is mandatory if downstream transport changes.
- M34 is the final integrated local checkpoint: revalidate the complete import → mapping → guided/advanced configuration → credential/policy → review/apply → lifecycle and backup/recovery journey using representative advanced fixtures and all new browser suites, plus required Docker crash/restart/recovery checks. This does not defer any earlier milestone acceptance. The existing recorded exception for actual external ChatGPT/Codex connection remains; local protocol coverage is required and is not claimed as real-client evidence.
- Store sanitized outcome/command and matching-reference screenshot evidence under evidence/ with requirement links. Update relevant operator guidance with no internal deployment identifiers. No application tests are run by documentation compilation itself.

## Known Risks / Deferred Work

Clear, generation fencing, current projection coherence and successful actor/time persistence form one atomic mutation outcome. Splitting attribution storage would create newly written records without required attribution. Full entry-dialog redesign and archive qualification are separate. Implementation mechanisms remain delegated within the settled contracts. No required source behavior is deferred out of this packet. Existing accepted response-scanning limitation and external-client validation exception remain explicit; no new waiver is created.
