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
Console page/script fragments, existing relevant settings managers/HTTP and tests as needed. Existing shared validation/runtime publication must remain intact. Documentation/evidence accompany behavior.

## Validation and recovery
Positive authorized routes and changes; negative forbidden routes/malformed input; keyboard and focus; 320px/200% text; current state after errors. Slice 02 exercises all guard branches/no secret storage; slice 03 tests stale review, base/dependency/role changes and audit failures with zero partial configuration application. Run targeted vitest and actual HTTPS browser fixture. Full npm test and npm run build at milestone completion. Unknown completion requires status inspection before retry, never silent replay.

## Acceptance and commit boundary
All scope above demonstrably works end-to-end, existing action semantics retained, required tests pass. Commit behavior, tests, this plan and evidence together; exclude root status and test-results/. Record commit after successful commit without self-referential SHA.

## Execution evidence
Pending.
