# M37 acceptance

Source: delivery/milestones/secretsauce-mcp/37-default-proposed-settings-review.md. REC-RM-030 only. Parent f6f0817bcff64d1b8a2ae1d7bb41fd9a62a39a44. No new external inputs, schema, permissions, APIs, runtime scanning or transport changes.

| Criterion | Concrete evidence | Result |
|---|---|---|
| First/default New settings, matching keyboard, identical reviewed data | Approval browser first entry and re-entry checks; ordered tabs; ArrowLeft/Right/Home/End; managed-state equality across switching | PASS |
| Representative exact proposal/comparison; no-baseline/no-change | Browser literal multiset equals server candidate including custom method/regex/binary config; typed boundary own keys, false/zero/null/empty/ordered arrays;8 diff unit tests | PASS |
| Read-only tabs/cancel; stale and role rejection | Browser state equality/no persistent storage/no false dirty; Changes Escape/Cancel and New settings Cancel; stale review and role-loss rejection; pending and unknown-response regression | PASS |
| Actual matching composition, focus, responsive/text reflow | final screenshots at1440/390/320 and320 text200, visual-review.md, document and text range overflow checks; root visual acceptance | PASS |

Browser report: evidence/ux-acceptance/secretsauce-mcp/milestone37/final/browser-report.json. Focused8 tests PASS. Final full suite/build recorded in validation.json after frozen run. No live instance or external ChatGPT/Codex connection claims; existing external qualification exception unchanged. M38–40 intentionally untouched. No blocker, waiver or new durable lesson.
