# M20 slice 01: Selected navigation and focused sections

## Outcome and scope
Exclusive primary and service selections; six ordered authorized Settings sections, desktop links/narrow select, non-secret deep links/back, existing action reachability and applied summary before Edit.

## Exclusions
No M21 capability expansion/import changes, authority redesign, service-specific packs or live-instance mutation.

## Dependencies
None; preserve M18 assisted reset and M19 independent SMTP deletion.

## Behavior and state
User enters authorized navigation, sees current applied state, explicitly edits/saves/reviews. Navigation never applies. Server remains authority; Member has no Settings, Administrator edits protection only, Auditor reads only, backups Owner-only. Preserve draft revisions, immediate-action invalidation, uncertain outcomes and recovery paths.

## Implementation surfaces
src/consoleSettingsPage.ts provides the new section shell; src/consolePeoplePage.ts splits Email and external registry rendering; src/consolePage.ts supplies CSS/deep-link startup and exclusive account selection; consoleServicePage.ts and consoleEvidencePage.ts retain parent context. scripts/verify-console-focused-settings-browser.mjs uses actual isolated HTTPS. No backend API changes.

## Validation and recovery
Positive authorized routes and changes; negative forbidden routes/malformed input; keyboard and focus; 320px/200% text; current state after errors. Slice 02 exercises all guard branches/no secret storage; slice 03 tests stale review, base/dependency/role changes and audit failures with zero partial configuration application. Run targeted vitest and actual HTTPS browser fixture. Full npm test and npm run build at milestone completion. Unknown completion requires status inspection before retry, never silent replay.

## Acceptance and commit boundary
All scope above demonstrably works end-to-end, existing action semantics retained, required tests pass. Commit behavior, tests, this plan and evidence together; exclude root status and test-results/. Record commit after successful commit without self-referential SHA.

## Execution evidence
PASS: npm run build; actual HTTPS `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-focused-settings-browser.mjs`. Report: evidence/qa/secretsauce-mcp/milestone20/focused-settings-browser-report.json. Role matrix, direct backup denial, invalid destination, exclusive selection, focused content, deep link/back and document/text-range reflow passed. Loopback EPERM rerun with authorized network permission. Commit recorded by following checkpoint.
