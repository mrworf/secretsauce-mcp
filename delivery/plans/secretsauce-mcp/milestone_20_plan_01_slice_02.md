# M20 slice 02: Guarded edits, search and error focus

## Outcome and scope
Track only current unsaved edits in memory; Stay, save draft and continue, discard unsaved only; persistent saved-section summary; authorized label/help/alias search and focus, cross-section error links and safe failure handling.

## Exclusions
No M21 capability expansion/import changes, authority redesign, service-specific packs or live-instance mutation.

## Dependencies
Earlier indexed slices; preserve M18 assisted reset and M19 independent SMTP deletion.

## Behavior and state
User enters authorized navigation, sees current applied state, explicitly edits/saves/reviews. Navigation never applies. Server remains authority; Member has no Settings, Administrator edits protection only, Auditor reads only, backups Owner-only. Preserve draft revisions, immediate-action invalidation, uncertain outcomes and recovery paths.

## Implementation surfaces
src/consoleSettingsPage.ts owns in-memory dirty form state, authorized static label/alias index plus limits metadata, saved section summary and guard. consolePage.ts/form and API helpers clear secret fields on failures and notify guard on successful saves. consoleServicePage.ts leaveEditor delegates Settings guard. Extend actual HTTPS script to exercise Stay/Save/Discard, search, disclosure and focus; no API authority change.

## Validation and recovery
Positive authorized routes and changes; negative forbidden routes/malformed input; keyboard and focus; 320px/200% text; current state after errors. Slice 02 exercises all guard branches/no secret storage; slice 03 tests stale review, base/dependency/role changes and audit failures with zero partial configuration application. Run targeted vitest and actual HTTPS browser fixture. Full npm test and npm run build at milestone completion. Unknown completion requires status inspection before retry, never silent replay.

## Acceptance and commit boundary
All scope above demonstrably works end-to-end, existing action semantics retained, required tests pass. Commit behavior, tests, this plan and evidence together; exclude root status and test-results/. Record commit after successful commit without self-referential SHA.

## Execution evidence
PASS: npm run build; focused-settings-browser HTTPS fixture exercises all three guard branches, persisted Email survives discard, search focus opens advanced limit disclosure, no-match/clear preserves destination, no browser persistence, existing role/navigation/reflow matrix. Report: evidence/qa/secretsauce-mcp/milestone20/focused-settings-browser-report.json.
