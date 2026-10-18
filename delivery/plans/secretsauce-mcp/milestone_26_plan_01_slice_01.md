# M26 slice 01: Linked lifecycle/readiness rows

## Goal and scope
Expose independent lifecycle, pending draft and configuration attention without claiming network health. Real service links and full-row hit area excluding actions; preserve search/filter on return; Member sees assigned discovery only, Auditor readable no mutation. Read model excludes secrets and keeps exact IDs.

Non-scope: credential clearing implementation, service editor redesign, global navigation/history, network health, permanent purge, live deployment. Dependencies: M22 complete; none within this milestone. Preserve current encrypted store, runtime instances, grants, audit and authorization.

## Flow and state
Services entry → current authorized read model → row state and links. No navigation mutation. No raw credential data in views or evidence. Existing Member permissions and Owner/Administrator writes remain server enforced; Auditor readonly. Errors must preserve context and provide refresh/corrective route, not infer success.

## Expected surfaces
src/consoleServices.ts, src/consoleServicePage.ts, src/consolePresentation.ts; focused service tests; browser harness; operator docs; evidence/plans. Investigate existing helpers before edits; no speculative new subsystem.

## Validation and acceptance
Active+draft, missing applied value, incomplete/mapping-blocked draft; Member negative discovery, Auditor readonly; matching browser rows and search-return.
Positive and negative external input tests. Required commands: npx vitest run test/console-services.test.ts test/console-services-http.test.ts --maxWorkers=2. Browser against isolated HTTPS synthetic state. Every described outcome must pass; screenshot acceptance includes layout, density, spacing, typography, controls, color and hierarchy; text enlargement includes document and text ranges.

## Commit boundary
One coherent behavior commit with supporting tests/docs and this plan. Status: complete. Commit reference supplied by orchestrator closeout. Full-suite required only at milestone completion.

Evidence: focused service/API 11 tests passed with loopback permission; npm run build passed. Isolated HTTPS lifecycle browser passes actual links, keyboard/search return and independent state. Initial browser found heading removal on subsequent navigation; fixed before completion. Matching screenshots recorded; final action-inclusive comparison belongs slice 02.

Final slice commit: `288809e1e0f35367d4449e87ae8b1d011513d080`.
