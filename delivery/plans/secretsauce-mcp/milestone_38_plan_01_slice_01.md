# M38 slice01: Concrete security exceptions before approval

## Outcome and scope
Entering Review & apply shows a semantic bullet for each actual exception in the existing Security exceptions surface, on either tab. No exceptions shows neutral text. Replaces only the rejected generic disclaimer. Same serviceExceptionLabel supplies bullets and dialog, no changed exception identity or risk semantics. Depends on completed M36; preserves M37. Excludes guided steps, rule highlighting, slider, shared Settings, runtime and live deployment.

## Behavior and state
Review rendering reads the current immutable review only. It neither checks nor persists acknowledgments. Existing Owner/Administrator, Auditor restrictions, recovered Owner gate, stale/dependency checks and atomic activation remain server-owned. Dialog checkboxes start unchecked; Cancel/Escape, pending, known rejection and unknown status inspection unchanged. No new external input or state transition.

## Implementation surfaces
src/consoleServiceApproval.ts footer; src/consoleServiceReview.ts list spacing/wrapping; scripts/verify-console-approval-browser.mjs focused browser extension; test/console-service-approval.test.ts if necessary to qualify pure mapping. Existing label tests cover TLS inheritance/override/mixed HTTP, duplicate names, safe URLs, custom keys and forged acknowledgments.

## Acceptance and tests
- Zero/one/many complete readable bullets on both tabs, no count-only/disclaimer.
- Same labels and exact risk identities as modal; all checks unchecked after reading.
- Unsafe URL components absent, markup inert, no persistent browser state.
- Existing authorization/stale/partial/forged rejection and pending/unknown paths pass.
- Desktop/narrow/200% screenshots natural list growth and no text-range/document overflow match approved family under UX6.
Focused: npx vitest run test/console-service-approval.test.ts; actual isolated HTTPS harness using CONSOLE_BROWSER_EVIDENCE_DIR. Final frozen npm test -- --maxWorkers=2 and npm run build with no concurrent browser/Docker. Record hashes, criterion evidence and visual review.

## Commit boundary
One complete outcome with implementation, this plan, governing index, tests/harness and evidence. Exact SHA recorded by parent acceptance to avoid self-reference. Preserve unrelated work and root-owned tracker.

## Progress
Implementation and validation complete.

## Completion evidence
Focused 7 tests PASS; actual HTTPS browser PASS; final frozen full suite 772/77 PASS in 121.00s and build PASS. Eight source/dependency hashes verified unchanged. Evidence: evidence/qa/secretsauce-mcp/milestone38/acceptance.md, validation.json, tested-inputs.json; evidence/ux-acceptance/secretsauce-mcp/milestone38/visual-review.md and final/. Root independently accepted desktop visual direction. No blocker, no deployment. Exact implementation SHA recorded by parent acceptance.

Parent acceptance: implementation commit `b4038b7ac169b0db1bc0ec0ae2057dc211c0f6a1`; all M38 criteria verified and accepted.
