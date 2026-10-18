# M25 slice 01 — Explicit imported identity recovery

## Goal and boundary
Complete the saved-import recovery journey: named blockers, source context, eligible explicit mapping, partial progress, retained safe edits and fresh review. One independently testable commit; exclude general service visual redesign, activation, lifecycle, credential operations and all later milestones.

## Dependencies and entry
M21 importer/managed console; approved M25 requirements and UX4. Entry from imported result, service detail and blocked review. A focused mapping page uses existing shell, service tabs, warning, mapping card and remaining-setup card matching approved reference.

## State and authorization
Persist bounded original subject/index metadata at import; retain it across draft saves and portable snapshots. Correction accepts selected service, managed revision, draft generation, dependency fingerprint and explicit subject/target pairs. Reject duplicates, unknown subjects, malformed/stale/ineligible targets and wrong exact external issuer/subject. Owner/Administrator writes; Auditor reads; Member denied. Existing assignments/lifecycle/values do not change. New drafts propose selected targets for later explicit review/apply. Unresolved subjects remain blockers independently of proposed assignments; resolved targets are rechecked on review. Reconcile uncertain results by reading state before retry.

## Surfaces
consoleMigration, consoleServices, consoleHttp, consoleServicePage, scoped console CSS, consoleBackupSchema; migration/services HTTP tests; isolated browser harness and operator help. Existing fixture patterns and current immutable snapshots retained.

## Validation
Positive: multi-service import, two unresolved subjects, partial local then exact external correction, preservation of advanced regex/typed settings and unrelated draft edits, review reached without execution; Auditor read. Negative: assignment-only resave does not clear blockers; unauthorized/malformed/unknown/duplicate/wrong-target inputs; stale draft and changed identity generation; audit admission and uncertain commit; revoked target before review. Legacy missing-only metadata gets honest source field fallback. Backup validation retains new bounded metadata. Real browser keyboard recovery and state, narrow and 200% overflow/text checks, approved visual screenshot comparison; no raw credentials in metadata/errors/evidence.

Commands: focused vitest migration/services/HTTP/backup-schema affected tests during iteration; npm test and npm run build at completed milestone; PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-import-recovery-browser.mjs. Rerun permission failures with loopback permission, never weaken tests.

## Acceptance and commit
Every M25 criterion must have direct evidence before commit. Commit implementation, tests, operator notes, sanitized screenshots/report and plans together; preserve pre-existing test-results/. Root records completion after inspecting evidence. Status: completed.

## Execution and validation
Implemented the complete recovery journey, including current-target eligibility, source metadata, HTTP permissions, independent pending blockers, partial corrections, preserved edits/selections, archived/read-only views and uncertain-result inspection. No later milestone behavior implemented.

- Focused initial migration/services: 22 tests passed; expanded migration/HTTP/backup domains: 25 passed, then migration expansion passed 18 tests.
- Backup/gateway isolated timing diagnosis: 57 tests passed with two workers and original timeouts.
- Final full suite `npm test -- --maxWorkers=2`: 728 tests, 73 files passed in 105.59s; pretest TypeScript build passed. Separate `npm run build` passed.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-import-recovery-browser.mjs`: PASS after final UI changes; actual HTTPS, keyboard, source/context, partial/stale/review/no-execution, Auditor/Archived denial and reflow assertions. Compared actual desktop/narrow images with unchanged approved reference images; report under evidence/ux-acceptance/secretsauce-mcp/milestone25.
- Full-suite default concurrency failures were environmental scheduling failures reproduced in unchanged backup/gateway timing tests, resolved by bounded workers without changing timeouts/assertions. Loopback tests/browser required authorized local network permission.
- Final source hashes in evidence/qa/secretsauce-mcp/milestone25/validation.json. No production changes after this final validation. Documentation-only closeout does not invalidate evidence.

This plan, implementation and evidence belong to the containing slice commit. Root records its exact SHA during milestone acceptance; no separate implementation commit is needed for bookkeeping.
