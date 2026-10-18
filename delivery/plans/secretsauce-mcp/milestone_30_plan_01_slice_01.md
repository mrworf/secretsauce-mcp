# M30 slice 01 — Shared immediate value dialogs

## Goal and scope

Configuration Authentication and creation Authentication offer Set value or Replace value beside each key’s truthful version/time/actor metadata. Only the named dialog contains a password input. Save is an explicit immediate command; Cancel/Escape erases temporary entry and returns focus. Add credential preserves safe fields and focuses/announces the new item. Orphan registry entries use the same dialog. Existing M29 Clear/Delete semantics remain.

## Dependencies and boundaries

M27 focused editor and M29 current confirmation/clear/attribution are accepted. No persistence/API authority change, no SMTP changes, no M31 rule or M32 broad help redesign. Existing backend Owner/Administrator checks remain authoritative; Auditor is read-only and Member cannot mutate. Parent 688c16f; preserve untracked test-results/.

## Behavior and state

Opening never requests a secret; metadata supplies availability only. A new service must explicitly save its draft before its immediate value command. The dialog discloses that prerequisite. Preserve in-memory safe placement work on existing services. Clear input before awaiting command; refresh metadata after success. Definite rejection permits re-entry with fresh confirmation. Unknown outcome blocks retry until metadata lookup succeeds, reports uncertainty and never claims success from closure. No values in storage, URL, errors or screenshots. Delete reads current dependency metadata before confirmation and preserves unsaved safe fields.

## Implementation investigation

Inspect shared dialog lifecycle, existing API error operation metadata, editor revision updates and service-save new-service behavior. Expected surfaces consoleServicePage.ts, consolePresentation.ts, browser harnesses, directly affected tests and operator guidance.

## Validation and acceptance

Positive: create/replace from both contexts; version/actor update; Clear and deliberate Set; draft edits survive; Add focuses and scrolls. Negative: blank/invalid values, Cancel/Escape, stale confirmation, demoted mutation, connection loss followed by lookup, no secret echo or persistent state. Browser keyboard focus remains bounded and returns; desktop matches approved authentication and dialog references, 390/320/200% text remain usable. Existing capability roundtrips remain. Focused tests during work; final full suite with two workers plus build; sequential browser regressions. All eight M30 acceptance criteria receive evidence before commit.

## Commit boundary

One commit contains shared UI, focused tests/harness, operator guidance, plans and evidence. Root records exact SHA after acceptance. Do not commit until required validation passes.

## Completion and evidence

Shared dialog, metadata, unknown-state lookup and new-row focus delivered. All eight M30 criteria mapped in [acceptance](../../../evidence/qa/secretsauce-mcp/milestone30/acceptance.md); matching approved-surface review in [visual review](../../../evidence/ux-acceptance/secretsauce-mcp/milestone30/visual-review.md). Full suite: 748/748 tests, 74 files, 106.48s; build PASS. New credential dialog browser and affected existing clear/services journeys PASS. No source change after full-suite validation; final hashes are in tested-inputs.json. Remaining background placement help belongs M32; M30 dialogs and metadata are complete. Root records exact slice commit in acceptance closeout.

Accepted commit provenance: `dede1136853e32456878dbc2c59f35e8afb73e54`.
