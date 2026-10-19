# M40 slice 01 — Identify explicit scanning overrides

## Outcome and boundary

Authenticated permitted service editor opens Access & policy: any rule with its own secretlint or binary_response configuration shows a neutral visible Scanning override badge within its existing description column. Inherited rules show none. Render-only classification does not save or approve changes. Add/Edit/Cancel, removal, Guided/Advanced and reopening derive markers from current draft without changing rule order, exact identifiers/custom methods/patterns/sizes or other settings.

Dependencies: M31 existing rule dialogs and M37–39 accepted; UX6 manifest and M40 contract govern. Non-scope: slider, scanner behavior, API, permissions, storage, deployment. Owner/Administrator existing writes and Auditor/Member restrictions remain unchanged; existing stale/uncertain/rejection paths retained. No new external input.

## Implementation surfaces

src/consoleServicePage.ts existing rule render; src/consolePresentation.ts neutral wrapped badge style. Extend scripts/verify-console-policy-dialogs-browser.mjs with presence variants, edit/cancel/remove assertions, exact preservation and safe errors; use current approval browser for joined flow. Investigation: inspect normalized explicit empty/default values and preserve source rather than infer risk. Existing error validation handles invalid/zero sizes; scan=false distinct from size.

## Positive, negative and boundary verification

Actual browser: secretlint-only, binary-only, both, default-equivalent, increased protection, empty explicit binary object, inherited absence; add/edit/cancel/removal marker changes; exact arbitrary size/unlimited/custom method order roundtrip. Existing invalid zero/nonsense input, stale writes, demotion, no autosave and lost response remain tested. Actual warnings/ack gates remain independently tested by review suite and approval browser; M37 default, M38 bullets and M39 five-section flow are integrated.

Desktop 1440, narrow390/320 and text200 at320 screenshots with document/text-range overflow checks; visible associated non-hover text uses existing neutral palette, no added column. Compare approved feedback003 policy rows and feedback004 review with UX6 delta precedence.

## Required timing and commit

Run focused affected tests and build before browser. Freeze all executable inputs before final browser evidence and final npm test -- --maxWorkers=2; run npm run build. Capture hashes and QA/UX evidence. Review complete diff, stage only owned production/harness/plans/evidence, then one commit. Root records exact commit and acceptance; no status.yaml mutation by slice.

Status: complete. Acceptance requires all five contract criteria PASS with durable evidence.

## Completed validation

25 focused tests PASS; both actual HTTPS browsers PASS; final frozen full suite 775 tests in 78 files PASS (127.94s), final build PASS. All 230 source/test/harness/lock inputs unchanged against tested-inputs.json. QA: evidence/qa/secretsauce-mcp/milestone40/acceptance.md and validation.json; UX: evidence/ux-acceptance/secretsauce-mcp/milestone40/visual-review.md. Root records exact slice commit in acceptance transaction.
