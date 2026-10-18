# M26 slice 02: Confirmed lifecycle actions

## Goal and scope
Right-side Enable/Disable/Delete/Restore with consequence dialogs. Delete archives, restore Disabled. Fingerprint-bound UI confirmations reject changed dependencies; legacy input remains compatible. Enable routes to explicit existing review/edit and cannot bypass blockers or apply a draft silently. Cancel/Escape no mutation, stale/unknown requires refresh.

Non-scope: credential clearing implementation, service editor redesign, global navigation/history, network health, permanent purge, live deployment. Dependencies: M22 complete; slice 01 rows. Preserve current encrypted store, runtime instances, grants, audit and authorization.

## Flow and state
Services entry → current authorized read model → row state and links → explicit confirmation → admitted lifecycle command → refreshed durable list. No navigation mutation. No raw credential data in views or evidence. Existing Member permissions and Owner/Administrator writes remain server enforced; Auditor readonly. Errors must preserve context and provide refresh/corrective route, not infer success.

## Expected surfaces
src/consoleServices.ts, src/consoleServicePage.ts, src/consolePresentation.ts; focused service tests; browser harness; operator docs; evidence/plans. Investigate existing helpers before edits; no speculative new subsystem.

## Validation and acceptance
Disable/archive/restore, cancel/Escape, stale dependencies, malformed fingerprints, denied roles, explicit enable review, no implicit activation; full suite/build and actual browser visual/accessibility acceptance.
Positive and negative external input tests. Required commands: npx vitest run test/console-services.test.ts test/console-services-http.test.ts --maxWorkers=2. Browser against isolated HTTPS synthetic state. Every described outcome must pass; screenshot acceptance includes layout, density, spacing, typography, controls, color and hierarchy; text enlargement includes document and text ranges.

## Commit boundary
One coherent behavior commit with supporting tests/docs and this plan. Status: complete. Commit reference supplied by orchestrator closeout. Full-suite required only at milestone completion.

## Final evidence
Focused 27 service/API/runtime tests pass; npm run build passes. Final full npm test -- --maxWorkers=2: 730/730 tests, 73 files, 105.77s; pretest build passes. Actual lifecycle browser plus predecessor import-recovery and existing services journey pass. Screenshot comparison and all criteria mapping: evidence/qa/secretsauce-mcp/milestone26/acceptance.md and evidence/ux-acceptance/secretsauce-mcp/milestone26/visual-review.md. No material unapproved drift. Review-only Enable preserves existing explicit save/review semantics; lifecycle optional fingerprint preserves legacy callers while all authorization/current lifecycle checks remain. New UI binds confirmation to fingerprint including draft generation. A direct service link required removing its query on return to list; broader browser-history behavior stays M32. Prior browser selectors were updated to link roles.
