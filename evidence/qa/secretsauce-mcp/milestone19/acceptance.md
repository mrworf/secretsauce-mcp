# M19 independent SMTP deletion evidence

Status: validation complete (2026-10-11). Synthetic isolated state only; no live instance or real recipients used.

| M19 acceptance | Concrete evidence |
|---|---|
| Enabled dependency rejects; disable retains value/config; separate delete | `test/console-smtp-deletion.test.ts` independent lifecycle; actual HTTPS browser save/review/apply/disable/delete |
| Role, recent-auth, stale version/revision, concurrent replacement, invalid input, audit denial, already absent | SMTP deletion negative test and direct role HTTP matrix in `test/console-people-http.test.ts`; HTTPS enabled-denial and cancel/focus |
| Pending copies and reviews invalidated; blank/stale/legacy input cannot revive value; fresh entry works | SMTP lifecycle and legacy-clear tests; current draft binding; no SMTP history replay entry exists |
| Queued dispatch rechecked; admitted send allowed to finish without config mutation; manual links/gateway preserved | SMTP dispatch interleaving test and recorded admitted revision/version; disabled public-reset test; existing notifications gateway regression and full suite |
| Atomic prior/completed restart; uncertainty not success and no new use; archives unchanged | Before/after rename, successful restart and audit-completion uncertainty tests; encrypted archives before/after deletion roundtrip through worker |

Validation: targeted deletion suite 10 passing tests; related SMTP/people HTTP tests passed with local listener permission. Final `npm test` includes build and all tests; 70 files / 651 tests passed. `npm run build` passed. Browser command: `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-smtp-deletion-browser.mjs` passed. See [browser report](smtp-deletion-browser-report.json) and masked screenshots. Browser uses keyboard interaction and inspects both document width and text ranges at 1280/320 CSS px with 100%/200% text. Confirmation screenshot visually reviewed: target/version/consequences, dependency message, cancel and recent-auth confirmation visible.

Implementation decisions: retain disabled applied SMTP instead of removing its settings; every caller checks enabled explicitly. No mail queue introduced. Legacy versionless drafts require refreshed save, cannot execute historical clear intent. Pre-rename uncertain failure may restart at coherent prior disabled state; post-rename selects completed deletion. Encrypted historic backups retain explicit whole-instance restore behavior. Existing ChatGPT/Codex external validation exception remains unchanged; no external integration is represented as newly tested.
