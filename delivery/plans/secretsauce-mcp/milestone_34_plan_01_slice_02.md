# M34 slice 02 — Integrated browser and supported Docker acceptance

Outcome: complete M25–34 local journey and supported recovery are demonstrably usable and durable.

Depends on slice 01 and all accepted M25–33. Scope: extend isolated fixtures, fix stale selectors without weakening assertions, operator guidance and evidence; production repairs only for observed contract defects. No live review deployment/volumes or external client claims.

Entry/state: import→explicit mapping→Guided/Advanced→credential/policy→review/apply→lifecycle; archive post-clear then explicit restore retains missing/historical metadata and Disabled state. Owner authorization and negative Member/Auditor/stale inputs remain checked. Docker uses current immutable image and managed launcher with isolated mounts; SIGKILL and competing writer reject/recover under kernel leases. Faults preserve coherent prior or new state and local audit. No secret-bearing outputs.

Surfaces: scripts/verify-console-*-browser.mjs and recovery Docker fixtures as necessary; evidence/qa, evidence/platform, evidence/ux-acceptance/secretsauce-mcp/milestone34; docs/console-operations.md.

Validation: all new M25–33 actual browser suites, recovery state desktop/narrow/200% text/keyboard compared with approved UX4 authentication; encrypted current/legacy recovery Docker plus restart and competing writer; existing complete installer fault boundary checks. Finally npm test -- --maxWorkers=2 and npm run build without concurrent browser/Docker. Preserve local MCP protocol tests and documented external-client exception.

Acceptance: milestone criteria mapped to reproducible sanitized evidence, tested input hashes and immutable image ID; screenshots inspect width, hierarchy, density, spacing, typography and controls. No material unapproved drift. Commit fixture/docs/evidence/plan only after gates pass; root records final SHA and updates status.

Investigation added two necessary recovery corrections: missing availability can retain previous successful Set attribution after uncertain Clear reconciliation (including restored historical state); and restoration must mint a newer local dependency generation rather than reuse archived generation. A same-host archive→clear→unresolved intent→explicit earlier-value restore→restart regression reproduced a failed startup before the generation fence. Both repairs stay within STATE-09/SECRES-T20; historical actor/time/value version remain unchanged. Final image and affected recovery/browser evidence must be refreshed after these corrections.

The recovered credential browser now performs one joined actual UI journey from YAML import and explicit mapping through Guided/Advanced, value and policy dialogs, save/review/apply, Disable/Clear, encrypted backup/restore and fresh enrollment. CUSTOM methods, exact regex and binary options survive the complete chain. The separate nine earlier suites remain required and passed.

Operational validation PASS on final immutable image `sha256:89c15ec2d582bd20ce97872bce07b8dfe9f9d8be780e0da0d4737573c1f57fac`: clean-host 7 groups, launcher 9 cases, actual SIGKILL install/rollback 94 boundaries. Joined actual HTTPS browser passed on final production source; nine earlier browser suites remain current (no affected UI source changed). Matching reference/reflow review is recorded under evidence/ux-acceptance/secretsauce-mcp/milestone34. All Docker/browser workloads ended before final full-suite admission.

Full-suite fixture correction: existing backup-domain exact dependency assertion expected only service/id/version. Added the now-required marker and exact generation expectation. Focused file: 4/4 PASS; full rerun required. Production/image/browser evidence is unchanged by this test-only correction. No assertion/timeout weakened.

Final validation: PASS — `npm test -- --maxWorkers=2`, 757 tests across 75 files, 113.66 seconds; then `npm run build` PASS. No concurrent browser or Docker workload. Tested inputs and summarized results are recorded in `evidence/qa/secretsauce-mcp/milestone34/{tested-inputs.json,validation.json}`. All M34 criteria are satisfied; no new waiver, external action or deployment.

## Root acceptance

Accepted commit: `ff20d0e773bab4e84ef5e98db2c8d44767ab6f1e`. Root verified evidence and exact current source/image hashes; final acceptance completes M34 and the fixed M25–34 goal.
