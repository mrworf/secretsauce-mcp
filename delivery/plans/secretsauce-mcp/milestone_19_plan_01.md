# M19: Independent SMTP credential deletion

## Outcome and contracts
Deliver only [M19](../../milestones/secretsauce-mcp/19-independent-smtp-deletion.md), REC-RM-004, STATE-01/02/03 SMTP amendment and UX-IN09/C32. Product `secretsauce-mcp`; fixed goal M18–M21 in milestone status, current M19. Parent transaction `3aea6ccc429964025530954abba51f0f72f63c0c`. Source transaction `4d46db3fa08a25df52b8d7b0aa2357cf8446b2fd`; planning transaction `84445451c18c5e32f92dc0978beed635d4d5edbf`; packet revision `sha256:6379e6627db6d1b723948386f90b01c421229fad5b3f77af8586a5379e47a36c`. Approved packet and source remain those recorded in delivery-planning handoff. Autonomous new transaction; root owns milestone status. Preserve unrelated `test-results/` and live instance.

## Findings and decisions
Existing SMTP disable deletes applied settings; clearCredential is a deferred destructive checkbox. Replace both with retained disabled configuration and explicit version-bound deletion. Existing synchronous encrypted atomic commit and audit admission supply serialization and fail-closed uncertainty. No mail queue is introduced; recheck dispatch after admission. Legacy drafts without credential-version binding require refresh and cannot apply old clear intent.

## Scope
Include API, confirmation UI, version-bound drafts, captured delivery metadata, restart and failure tests, documentation and actual HTTPS browser evidence. Exclude Settings redesign, YAML import, SMTP immediate creation/replacement and historical backup shredding.

## Slice index
| Slice | Plan | Outcome | Dependency | Status | Commit |
|---|---|---|---|---|---|
| 01 | [Plan](milestone_19_plan_01_slice_01.md) | Independent SMTP deletion and complete lifecycle | M12 complete | complete | 1ac1697c744ac27883bb0eddabd0ac51bc537ef7 |

One slice is the smallest reversible end-to-end behavior; separating persistence from its UI/security fence would leave unsafe partial behavior.

## Completion and recovery
Run focused SMTP/HTTP tests, actual HTTPS browser at desktop/320px/200% text, full npm test and npm run build. Record sanitized evidence under evidence/qa/secretsauce-mcp/milestone19. Commit slice-owned paths only. Storage uncertainty blocks affected use; restart selects atomic prior/completed state. Archived backups retain explicit restore semantics. No upstream authority changes or deferred in-scope work.

## Execution evidence
One slice completed; 10 focused deletion tests and related SMTP/HTTP tests passed, actual HTTPS browser passed, build passed. Final `npm test`: 70 files, 651 tests passed (44.15s), including pretest build. [Acceptance mapping](../../../evidence/qa/secretsauce-mcp/milestone19/acceptance.md). Planning was persisted before production changes. Disabled-email callers and backup schema compatibility are directly necessary support. No out-of-scope work.
