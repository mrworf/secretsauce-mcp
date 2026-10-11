# M19 slice 01: Delete the current SMTP credential separately

## Goal / scope / dependency
Owner can disable SMTP through review/apply, then explicitly confirm deletion of the displayed current credential. M12 and existing atomic persistence are prerequisites. Governing M19 plan excludes M20/M21 and archive destruction.

## Behavior and state
Retain settings and credential on disable. Remove clear-on-apply. Add strict revision/version/confirmed delete input with current Owner, recent authentication, audit and enabled-dependency checks. Atomic deletion clears applied and pending credentials, increments version/revision, invalidates review; nonsecret drafts remain stale until refreshed. Draft save binds current version; legacy drafts cannot apply until refreshed. Blank input never recovers old values. Already absent is an explicit nonmutation. Delivery rechecks enabled/current state at dispatch and records captured revision/version without configuration writes on completion.

## Surfaces / investigation
consoleNotifications, consoleHttp, consolePeoplePage, backup schema and relevant operations view; SMTP domain/HTTP tests and actual HTTPS browser harness. Inspect commit failure semantics before implementing; use existing bounded atomic store, no new infrastructure.

## Authorization and errors
Owner only, action-scoped recent authentication. Reject Administrator/Auditor/Member, malformed/unconfirmed input, stale revision/version/review, enabled dependency and audit failure. Cancellation returns focus and makes no request. Unknown completion instructs reload, never success or automatic retry.

## Validation
Positive: disable retains all fields, delete removes live/pending copies, refresh/new deliberate replacement works, restart preserves completed state, admitted send finishes without resurrection. Negative: each external input, roles, stale/concurrent replacement, expired auth, missing value, audit/state fault pre/post rename, legacy clear intent, stale browser draft, queued dispatch. Actual HTTPS keyboard cancel/confirm, unauthorized control absence, 320px and 200% document/text range reflow. Full npm test and npm run build after focused regressions.

## Acceptance / commit
All five M19 acceptance clauses require concrete evidence. Single commit contains implementation, tests, docs and these plans after checks pass; no milestone status or unrelated test-results. Status: planning complete; self-check finds one coherent vertical slice with settled authority.

## Delivered evidence
Complete: API/UI, retained disabled settings, strict current draft version, stale/legacy rejection, captured delivery metadata, backup schema and manual-reset callers. Ten focused tests passed plus related SMTP/HTTP tests; HTTPS keyboard/reflow browser passed; build passed. See milestone19 acceptance evidence and governing plan for final full-suite total. Commit reference recorded by root after this single slice commit.
