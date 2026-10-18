# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: corrected docs/web-console-prd.md; approved canonical UX4 / UX-DESIGN-004; STATE-09 and SECRES-08.
> Preservation baseline: 9351c2d39124f9c40d4884ca51b2db2a19db2d3e; all supported gateway/configuration/MCP capabilities, fixed roles, reviewed activation, mandatory audit, SMTP and backup restrictions.
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

All outcomes below are semantically resolved. Planning waits for selective definition validation and parent-owned UX4/definition commit provenance. These are independently testable outcomes, not prescribed milestones or slices.

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| HIGH | REC-RM-015 | Resolve imported identities from the draft | REC-032 | MIGRATE-01/02, UX-IA10 | None | Mapping integration and browser import-to-review journey, including stale/permission/error paths. |
| HIGH | REC-RM-016 | Service rows and honest lifecycle actions | REC-020 | CONFIG-05, UX-IA09, UX-IN03 | None | Role/state matrix browser test, lifecycle integration, desktop/narrow screenshot comparison. |
| HIGH | REC-RM-017 | Focused service configuration and truthful overview | REC-021 | CONFIG-01/03, UX-IA09, UX-IN15 | None | Populated/empty/error/read-only browser cases and UX4 matching-state visual comparison. |
| HIGH | REC-RM-018 | Global editing modes and direct guided navigation | REC-026 | CONFIG-01, POLICY-02, UX-IA09, UX-IN15 | REC-RM-017 | Round-trip advanced/guided positive/negative tests and keyboard/browser step traversal. |
| HIGH | REC-RM-019 | Destination scope and advanced controls | REC-028 | BASE-01, POLICY-04, UX-IN15 | REC-RM-017, REC-RM-018 | All matching modes/TLS inheritance round-trip tests; actual self-signed transport test if transport changes; responsive keyboard visual cases. |
| HIGH | REC-RM-020 | Immediate service credential clearing and admission durability | REC-024 | CONFIG-02/03, STATE-09, SECRES-08 | None | STATE-09 acceptance and SECRES-T17–T19: positive/negative direct API, actual dispatch races, fault injection, restart and prior-reader compatibility tests. |
| HIGH | REC-RM-021 | Last successful credential actor metadata | REC-022 | CONFIG-02, AUDIT-01, STATE-09, SECRES-T21 | REC-RM-020 | Metadata positive/negative persistence/rename/removal/legacy tests and read-permission browser evidence. |
| HIGH | REC-RM-022 | Write-only credential dialogs and insertion behavior | REC-023, REC-029 | CONFIG-02, UX-IN14, SECRES-T21 | REC-RM-020, REC-RM-021 | Dialog keyboard/focus/required-input positive/negative tests, secret-leak checks, add-row viewport test and visual comparison. |
| HIGH | REC-RM-023 | Policy rule list and coherent rule dialogs | REC-030 | POLICY-01/02, UX-IN16 | REC-RM-017, REC-RM-018 | Rule positive/negative round-trips, ordering/priority/tie tests and modal keyboard/responsive visual checks. |
| HIGH | REC-RM-024 | Plain service help and execution access context | REC-025, REC-027 | AUTHZ-01, POLICY-01, UX-IA10, UX-IN15/16 | REC-RM-017 | Copy/behavior contract tests, role/access positive/negative checks and browser helper/required/focus validation. |
| HIGH | REC-RM-025 | Browser history and focused safe policy testing | REC-031, REC-033 | UX-IN15/16, POLICY-01/03, UX-IA10 | REC-RM-018, REC-RM-023 | Actual browser history/dirty-state/dialog journey plus no-downstream preview assertion and unauthorized/stale context tests. |
| HIGH | REC-RM-026 | Coherent credential absence and attribution in recovery | REC-024, REC-022 | BACKUP-01/05, CONFIG-04, STATE-09, SECRES-T20 | REC-RM-020, REC-RM-021 | Encrypted backup/restore positive/negative fixtures and supported Docker recovery/restart checks; old archive compatibility, schema contradictions and leak assertions. |

## REC-RM-015: Resolve imported identities from the draft

Priority: HIGH
Source findings: REC-032
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-116, PO-FB-119, PO-FB-121, PO-FB-122
Authoritative basis: MIGRATE-01/02, UX-IA10; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Identify each unresolved legacy subject, source context and affected service; provide explicit eligible mapping correction without reupload or losing unrelated work. Correction does not grant execution or activate a service.
Current behavior: Import stores missingMappings; ordinary draft save retains it, review rejects generically and requires reimport; import result exposes only count. Selecting an account changes proposed grants but cannot resolve stored legacy subjects. UX-IA04 expressly permits correction in a draft.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. An imported blocked draft exposes each unresolved subject and a reachable eligible local/exact external mapping action; after all mappings are deliberately corrected, fresh review is reachable.
2. Choosing an account as a proposed assignment cannot silently clear unrelated mapping blockers; partial correction shows remaining issues.
3. Reject unknown/duplicate/ineligible, stale, unauthorized or wrong issuer/subject targets; recheck eligibility and audit at commit/review.
4. Preserve exact imported configuration and unrelated safe edits; no inferred email grants, host reads or secret leaks.

Dependencies: No other remediation prerequisite; existing authority applies. Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Mapping integration and browser import-to-review journey, including stale/permission/error paths. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-016: Service rows and honest lifecycle actions

Priority: HIGH
Source findings: REC-020
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-043, PO-FB-044, PO-FB-045, PO-FB-046, PO-FB-047, PO-FB-048, PO-FB-049
Authoritative basis: CONFIG-05, UX-IA09, UX-IN03; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Clickable rows have separate lifecycle, draft and effective readiness indicators, right-side permitted Enable/Disable/Delete actions and consequence confirmations. Delete uses retained-history archive; restore returns Disabled.
Current behavior: List renders lifecycle and draft as plain text and an Open action. It lacks whole-row navigation and right-side requested lifecycle actions. Existing archive retains history; requested Delete is not yet specified against that lifecycle.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Active plus draft is visible independently; missing applied credential shows unavailability without fabricated network health or silently changing lifecycle.
2. Real row link supports keyboard; action controls do not accidentally open the service; return preserves search/filter.
3. Confirm Delete explains retained configuration/history/audit and restore-to-Disabled; confirm Disable/Enable; Cancel has no mutation.
4. Unauthorized actions fail server-side; enable reviews current dependencies; no stale confirmation, history or restored service bypass.

Dependencies: No other remediation prerequisite; existing authority applies. Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Role/state matrix browser test, lifecycle integration, desktop/narrow screenshot comparison. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-017: Focused service configuration and truthful overview

Priority: HIGH
Source findings: REC-021
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-050, PO-FB-051, PO-FB-052, PO-FB-053, PO-FB-054, PO-FB-055, PO-FB-056, PO-FB-057, PO-FB-058, PO-FB-059
Authoritative basis: CONFIG-01/03, UX-IA09, UX-IN15; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Replace flattened duplicate configuration summaries with selected focused sections and an applied Overview. Show current/saved/unsaved state once and preserve every supported field.
Current behavior: Owner reports cryptic empty overview, redundant bars, one long configuration and visually merged rules. Code renders applied and draft summaries plus repeated controls; source inspection cannot establish exact visual severity.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Overview shows actual applied configuration or clear no-current-configuration/non-running guidance, separate pending draft and exceptions.
2. Only selected Details/Destinations/Authentication/Access & policy/Secret detection/Review section appears; grouped values are readable and no long nested page is required for ordinary work.
3. Read-only authorized actors get equivalent grouping without mutation affordances; loading/failure never masquerades as empty success.
4. Save remains draft-only, review is full scoped activation and errors preserve safe fields; hidden advanced fields/literals survive all round trips.

Dependencies: No other remediation prerequisite; existing authority applies. Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Populated/empty/error/read-only browser cases and UX4 matching-state visual comparison. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-018: Global editing modes and direct guided navigation

Priority: HIGH
Source findings: REC-026
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-071, PO-FB-072, PO-FB-073, PO-FB-074, PO-FB-075, PO-FB-076, PO-FB-077, PO-FB-087, PO-FB-124
Authoritative basis: CONFIG-01, POLICY-02, UX-IA09, UX-IN15; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: One global Guided/Advanced switch edits the same full service draft. Creation step headers are directly navigable; existing services use focused sections and no redundant step-heading repetition.
Current behavior: renderEditor repeats Advanced editor (same draft) and heading; initial step list is inert. Existing-section tabs work but initial Back requires footer. Advanced editing covers the complete service.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Mode switching round-trips every supported field including imported regex/custom options and retains safe unsaved work; no repeated full editor links per section.
2. Each creation step can be reached directly with truthful incomplete validation; incomplete draft may save but cannot activate.
3. Details labels and Guided wording are respectful and nonredundant; mode switch is globally scoped rather than falsely section-local.
4. Browser navigation/unsaved guards do not silently save, discard or apply; invalid advanced JSON retains edit context and does not corrupt the guided draft.

Dependencies: REC-RM-017 Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Round-trip advanced/guided positive/negative tests and keyboard/browser step traversal. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-019: Destination scope and advanced controls

Priority: HIGH
Source findings: REC-028
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-082, PO-FB-083, PO-FB-084, PO-FB-085, PO-FB-086
Authoritative basis: BASE-01, POLICY-04, UX-IN15; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Visible service TLS default and explicit per-destination inherit/override accompany explained exact/suffix/regex matching. A focused advanced destination view replaces nested disclosures, preserving exact identifiers/schemes/ports.
Current behavior: Current authority preserves service-default TLS and destination overrides, and stable identifiers. Nested advanced disclosure and ordinary identifier fields conflict with the requested simpler conditional exposure.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Service certificate default is always visible and states its scope; destination overrides display effective value and source.
2. No nested accordion is needed; advanced destination action opens the selected destination and returns safely with exact fields preserved.
3. Service MCP reference remains discoverable/copyable; preserve imported destination/rule IDs and expose advanced system references without demanding irrelevant ordinary input.
4. Invalid URL/matcher/ports receive linked errors; TLS false/HTTP/broad exceptions remain explicit acknowledged capabilities, not removed or silently enabled.

Dependencies: REC-RM-017, REC-RM-018 Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: All matching modes/TLS inheritance round-trip tests; actual self-signed transport test if transport changes; responsive keyboard visual cases. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-020: Immediate service credential clearing and admission durability

Priority: HIGH
Source findings: REC-024
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067
Authoritative basis: CONFIG-02/03, STATE-09, SECRES-08; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Delete clears only an in-use value and retains the key; unreferenced Delete removes the key. Apply saved/applied dependency checks, monotonic mutation identity, current confirmation and immediate admission/restart fencing.
Current behavior: CONFIG-02 forbids referenced credential deletion; credential() rejects applied or draft dependencies. New confirmed PO-FB-065/066 instead requires Delete to clear only the value while retaining an in-use key, and explain that consequence.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Applied and saved-draft dependencies, including Disabled/Archived configurations, retain the exact key; empty referenced key reports no-op and empty unreferenced key can be deleted.
2. Bind confirmed target/incarnation/version/revision/dependencies; stale replacement/reference change rejects and cannot switch clear/delete outcome. Cancel/audit-admission failure changes nothing.
3. Cleared applied dependency blocks new references/substitution/dispatch including queued work; draft-only missing value does not interrupt valid applied execution. Set restores only eligible current execution without activating drafts or enabling disabled/recovered services.
4. Invalidate affected reviews/references; preserve admitted old-value response protection and live broker/scanner/limiter instances; late completion cannot repopulate secrets or mint revoked authority.
5. Durable secret-free intent and generation reconciliation fence uncertainty across pre/post-replacement failures/restart; old replay cannot clear a later replacement and unsupported older readers fail closed.
6. Owner/Administrator permission only; SMTP creation/replacement/deletion semantics unchanged; no secret/value fingerprint in reads, errors, audit or logs.

Dependencies: No other remediation prerequisite; existing authority applies. Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: STATE-09 acceptance and SECRES-T17–T19: positive/negative direct API, actual dispatch races, fault injection, restart and prior-reader compatibility tests. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-021: Last successful credential actor metadata

Priority: HIGH
Source findings: REC-022
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-060
Authoritative basis: CONFIG-02, AUDIT-01, STATE-09, SECRES-T21; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Persist and display stable last-successful Set/Replace/Clear actor/time without leaking values or inventing legacy attribution.
Current behavior: ManagedCredential stores value/version/changed but no last-change actor; detail exposes time/version only. Current last-change metadata requirement does not settle legacy/restore actor display.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Successful mutations record authenticated stable actor/server time; imported supplied committed value credits its submitting actor.
2. Renamed/disabled/removed actor retains safe authorized attribution; absent legacy metadata displays Unknown rather than current viewer/import mapping.
3. Cancel/no-op/rejected/uncertain mutation does not fabricate last-successful metadata; client-supplied actor/time cannot spoof it.
4. Stored values/fingerprints never appear in UI/GET/log/history/export; current identity visibility remains enforced.

Dependencies: REC-RM-020 Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Metadata positive/negative persistence/rename/removal/legacy tests and read-permission browser evidence. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-022: Write-only credential dialogs and insertion behavior

Priority: HIGH
Source findings: REC-023, REC-029
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-061, PO-FB-062, PO-FB-096, PO-FB-097, PO-FB-098, PO-FB-099, PO-FB-100
Authoritative basis: CONFIG-02, UX-IN14, SECRES-T21; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Use shared Set/Replace Save/Cancel dialogs in service detail and guided authentication, metadata attached to the key, and focus/scroll to a newly added credential.
Current behavior: Both configuration and wizard render password inputs inline and separate immediate buttons. Required-field context is confusing; the canonical credential card rule does not fully specify shared entry dialog state. Add credential mutates draft then rebuilds editor with no insertion-focus/scroll step. Exact rendered jump is reported, not independently reproduced.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. No inline secret field; opening dialog never fetches saved secret. Save makes the explicit immediate action and shows precise availability/version/actor outcome.
2. Cancel/Escape clears temporary input and restores focus with no mutation; completion clears input; validation never echoes the value or persists it in URL/browser storage.
3. Unrelated Continue neither submits nor requires a replacement secret; placement remains draft state and immediate value change cannot be undone by discard.
4. Delete explains referenced Clear versus unreferenced removal and current-versus-draft consequences; unknown outcomes use state lookup before retry.
5. Add credential scrolls/focuses/announces the new item without losing existing safe fields; keyboard and text enlargement remain usable.

Dependencies: REC-RM-020, REC-RM-021 Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Dialog keyboard/focus/required-input positive/negative tests, secret-leak checks, add-row viewport test and visual comparison. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-023: Policy rule list and coherent rule dialogs

Priority: HIGH
Source findings: REC-030
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-104, PO-FB-106, PO-FB-107, PO-FB-108, PO-FB-109, PO-FB-110, PO-FB-117, PO-FB-118
Authoritative basis: POLICY-01/02, UX-IN16; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Render a distinct rule list with Add and contextual Edit/Delete. Add/Edit share a focused dialog; common method selection replaces comma text while custom supported values and advanced matching/scanning remain editable.
Current behavior: Always-visible Basic request rule precedes paragraph rules and repeated action labels; add methods are comma text while edit uses row list. Add and edit differ materially.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. No always-empty Basic rule form; Add opens dialog, Edit prepopulates exact literal rule, cancel restores prior rule and focus.
2. Common methods are selectable; imported/custom methods remain preserved and editable through advanced options.
3. Priority, both effects, exact/prefix/regex, hosts, reasons, scanner/binary exceptions and typed options survive add/edit/advanced switching.
4. Effective order remains highest priority, deny tie then stable same-effect ordering; reorder bounds explain impact and never silently renumber priority.
5. Invalid methods/matching/options receive actionable local errors; rule action labels use row context without removing accessible identity.

Dependencies: REC-RM-017, REC-RM-018 Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Rule positive/negative round-trips, ordering/priority/tie tests and modal keyboard/responsive visual checks. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-024: Plain service help and execution access context

Priority: HIGH
Source findings: REC-025, REC-027
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-068, PO-FB-078, PO-FB-079, PO-FB-080, PO-FB-089, PO-FB-090, PO-FB-091, PO-FB-092, PO-FB-093, PO-FB-094, PO-FB-095, PO-FB-101, PO-FB-102, PO-FB-103, PO-FB-105
Authoritative basis: AUTHZ-01, POLICY-01, UX-IA10, UX-IN15/16; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Explain docs links for LLM use, allowed destination/matcher meanings, prefix-placeholder-suffix, header ownership, default policy/rule reason and assignment effects using accurate concise help.
Current behavior: Access shows assignments and grants only for an applied service; new-service checkboxes propose grants. Neither role ownership nor selecting oneself can resolve an import subject mapping. Owner reports that distinction is unclear. Labels/help exist in consolePresentation but Owner cannot understand prefix/suffix, generic placement, header ownership, host matching and policy reason/default. Existing help promises do not settle the refreshed composition and wording.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Help states API documentation can help an LLM understand the service; matcher exact/suffix/regex explanations correspond to actual semantics.
2. Placement names depend on header/query/body context; prefix/suffix preview uses placeholder only; single placement hint is visible and generic capabilities remain.
3. Default allow/deny is fallback, not restriction on rule effects; reason describes that rule decision; current execution access differs from role status and imported mapping.
4. Existing Access exposes permitted current add/remove with immediate confirmation; initial proposed grants await review; read-only actors see safe summaries.
5. Help/labels are locally associated, required cues are action-specific, and no technical alias needed for advanced capability is lost.

Dependencies: REC-RM-017 Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Copy/behavior contract tests, role/access positive/negative checks and browser helper/required/focus validation. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-025: Browser history and focused safe policy testing

Priority: HIGH
Source findings: REC-031, REC-033
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-111, PO-FB-112, PO-FB-113, PO-FB-114, PO-FB-115, PO-FB-120
Authoritative basis: UX-IN15/16, POLICY-01/03, UX-IA10; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Back/Forward and tool return preserve real service/section/step context and safe edits. Policy tester is the approved focused dialog, with no stacked dialogs or false dirty state; shared-settings links identify wider scope.
Current behavior: Service views do not update URL state; shared settings and tester leave editing context. Move earlier uses source index although display is priority sorted. User reports surprise unsaved prompt; no fresh browser reproduction was performed. Owner likes the tester; code presents no-downstream-request notice and preview inputs/results. A modal is suggested, not selected.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Browser Back/Forward/deep link/refresh identify the permitted destination without resetting safe in-memory draft or manufacturing edits; guards offer accurate stay/save/discard behavior.
2. Tester opens from the current context and returns focus/scroll there without marking draft dirty; rule dialog must close/keep/cancel first.
3. Preview keeps identity/service/destination/method/path/source and reports canonical target, eligibility, rule/default and effective protection; no downstream call, substitution or execution grant.
4. Shared secret detection link explicitly opens wider Settings and guards unsaved work; no hidden local duplicate or unauthorized navigation.
5. Errors/session loss/stale state retain only permitted safe work and never claim activation or definite failure for unknown mutation outcome.

Dependencies: REC-RM-018, REC-RM-023 Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Actual browser history/dirty-state/dialog journey plus no-downstream preview assertion and unauthorized/stale context tests. New inputs require positive and negative tests. No test was run by this definition-only transaction.

## REC-RM-026: Coherent credential absence and attribution in recovery

Priority: HIGH
Source findings: REC-024, REC-022
Product Owner feedback: PO-FEEDBACK-2026-10-17-001 / PO-FB-060, PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067
Authoritative basis: BACKUP-01/05, CONFIG-04, STATE-09, SECRES-T20; corrected PRD, approved UX4, STATE-09/SECRES-08; see exact source hashes.
Desired outcome / Required behavior: Encrypted backup/recovery carries coherent absent/present values, generations and historical actor metadata without stale normalized copies, preserving existing explicit restore restrictions.
Current behavior: ManagedCredential stores value/version/changed but no last-change actor; detail exposes time/version only. Current last-change metadata requirement does not settle legacy/restore actor display. CONFIG-02 forbids referenced credential deletion; credential() rejects applied or draft dependencies. New confirmed PO-FB-065/066 instead requires Delete to clear only the value while retaining an in-use key, and explain that consequence.
Affected users/roles: Owner/Administrator service editors; authorized Auditor read-only; Member own permitted service discovery/execution only. Existing Owner-only recovery/settings restrictions remain.
Affected interfaces/compatibility: service list/detail/editor and corresponding admitted commands; preserve ChatGPT and Codex MCP contracts, exact imported literals and supported fields. No service-specific templates or new permissions.
UX constraints: UX4 approved composition and complete accessibility/state rules; compare actual matching-state/viewport screenshots under UX-C42, not functional checks alone.
Architecture/security constraints: STATE-01/02/03/09 and SECRES-08; every mutation enforces current authority/audit and safe stale/uncertain outcomes. Never log/reveal values or credential-bearing output.

Acceptance criteria:
1. Post-clear archive has no old value in current normalized projections, contains coherent missing state/generation/actor data; mixed copies/generations are rejected.
2. Restore keeps absent values absent, actor source-qualified historical or legacy Unknown, and all services Disabled pending review.
3. Old archives may recover earlier values only through explicit whole-instance restore; no current references/confirmations survive and restore does not credit recovering Owner as value changer.
4. History rollback/draft discard never recovers secrets; current local audit evidence and bounded recovery worker/lease contracts remain intact.
5. Fault/restart/rollback tests retain coherent prior or new recovery state without replaying old clear over later replacement.

Dependencies: REC-RM-020, REC-RM-021 Final definition validity/provenance is required for all delivery.
Explicit exclusions: unrelated Settings/identity redesign, permanent service purge, SMTP clearing exception, auto-grants, hidden apply, feature removal and speculative changes not adopted by approved UX4.
Required implementation validation: Encrypted backup/restore positive/negative fixtures and supported Docker recovery/restart checks; old archive compatibility, schema contradictions and leak assertions. New inputs require positive and negative tests. No test was run by this definition-only transaction.
