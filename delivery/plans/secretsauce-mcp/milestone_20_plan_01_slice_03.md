# M20 slice 03: Exact atomic Settings review

## Outcome and scope
Collect all role-permitted saved Settings drafts, review exact named scope, prevalidate all current dependencies before one durable configuration commit; publish runtime afterward; reject stale/demotion/dependency without partial apply.

## Exclusions
No M21 capability expansion/import changes, authority redesign, service-specific packs or live-instance mutation.

## Dependencies
Earlier indexed slices; preserve M18 assisted reset and M19 independent SMTP deletion.

## Behavior and state
User enters authorized navigation, sees current applied state, explicitly edits/saves/reviews. Navigation never applies. Server remains authority; Member has no Settings, Administrator edits protection only, Auditor reads only, backups Owner-only. Preserve draft revisions, immediate-action invalidation, uncertain outcomes and recovery paths.

## Implementation surfaces
Add src/consoleSettings.ts with settings/review and settings/apply endpoints routed in consoleHttp.ts. Reuse exported existing schemas and expose bounded candidate preparation/publication from consoleAuthentication.ts and backup validation from consoleBackups.ts. Coordinator snapshots authorized saved drafts and dependency fingerprint, validates candidates before single store.commit, then publishes retained runtime instances; postcommit retention remains separately attributed and explicitly reports unknown/failure. consoleSettingsPage.ts replaces section review affordances with exact all-section review. New test/console-settings.test.ts and expanded HTTPS fixture exercise atomic success and stale/base/demotion/audit/prepare failures.

## Validation and recovery
Positive authorized routes and changes; negative forbidden routes/malformed input; keyboard and focus; 320px/200% text; current state after errors. Slice 02 exercises all guard branches/no secret storage; slice 03 tests stale review, base/dependency/role changes and audit failures with zero partial configuration application. Run targeted vitest and actual HTTPS browser fixture. Full npm test and npm run build at milestone completion. Unknown completion requires status inspection before retry, never silent replay.

## Acceptance and commit boundary
All scope above demonstrably works end-to-end, existing action semantics retained, required tests pass. Commit behavior, tests, this plan and evidence together; exclude root status and test-results/. Record commit after successful commit without self-referential SHA.

## Execution evidence
PASS: npm run build and final npm test (71 files / 662 tests), 11 direct atomic-settings tests, actual HTTPS focused Settings fixture and retained SMTP, backup, operations/health, recovery, preview, client/authentication, advanced/scanner and assisted-reset regressions. See evidence/qa/secretsauce-mcp/milestone20/acceptance.md for all nine acceptance mappings, reports and limitations. Final commit SHA supplied to the orchestrator checkpoint.

## Resolved engineering details
The coordinator uses a bounded in-memory actor/session-bound review (invalid after restart) and a hashed dependency snapshot; no raw secret leaves server. Recent authentication uses settings.apply when a reviewed domain requires it. Owner includes all six saved domains; Administrator includes protection only. Ordinary service drafts are excluded. Shared scanner limit fields from Limits and Response protection merge only when non-conflicting, otherwise review rejects with a section-specific correction. All validation precedes one encrypted commit; runtime publication follows persisted outcome, including completion uncertainty.

Retention draft baseDays is an additive validated non-secret snapshot of applied days, allowing unrelated saved sections without silently rebasing changed retention. Portable archive schema includes the optional field; full recovery tests pass. Review holds no durable live authority. Ordinary field error links open disclosures and preserve safe input; stale asynchronous read results cannot append into a replacement view.
