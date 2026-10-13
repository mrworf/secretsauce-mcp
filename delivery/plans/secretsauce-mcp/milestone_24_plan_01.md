# M24: Populated Settings and explicit email transport

## Outcome
All six Settings sections open truthful current forms and use explicit save/review/apply. Email supports deliberately acknowledged None as well as validated TLS, retaining independent authentication and write-only passwords.

## Delivery-goal context
- Product: secretsauce-mcp; goal: delivery/milestones/secretsauce-mcp/status.yaml.
- Fixed goal M22–M24; this transaction only M24, new invocation.
- Parent: c5a7f449be08dc97e309075558c478095901c930.
- Packet: delivery/milestones/secretsauce-mcp/24-populated-settings-and-email-modes.md; revision sha256:b0c9723dbc11aee6523ef42b684a312055f7283439bc81eb963940a2064f3e73.
- Definition 653ac14f771dc1da7d1d650c577ff439e9b99bce; planning 1569b93e0dc5461f18c09386c6095279db91a222.

## Governing contracts
M24 functional requirements 1–9 and all seven acceptance clauses; docs/web-console-prd.md IDENT-04/06, CONFIG-03/04, BACKUP-02, OPS-03/04, UX-02/03/04; product/architecture/web-console-state-contract.md STATE-02/08; product/security/web-console-security-contract.md SECRES-07; product/ux/manifest.yaml web-console-ux-3 and UX-V05/C42. AGENTS.md and minimal-slice-delivery apply.

## Current findings and decisions
Existing SMTP uses bounded implicit TLS and encrypted revisioned drafts; existing global Settings applies every prepared section atomically. Preserve these providers. Two independently reviewable vertical slices: explicit transport and email controls/security first, then common populated Settings lifecycle and visual composition. Existing form renderers already load current/draft data but hide them behind Edit and duplicate summaries. Diagnostic editing currently shares operating settings; preserve atomic handling while presenting it in Health. No production edits before this plan and both slice files.

## Scope
Includes all M24 requirements, retained advanced controls and M22/M23 behavior. Excludes STARTTLS, autosave, partial apply, new queue, upstream authority changes and live review instance deployment. Pre-existing untracked test-results/ is excluded from all commits.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit | Evidence |
|---|---|---|---|---|---|---|
| 01 | [slice 01](milestone_24_plan_01_slice_01.md) | Explicit secure/default and acknowledged unencrypted email end to end | M22/M19/M20 | completed | slice commit (recorded by root closeout) | evidence/qa/secretsauce-mcp/milestone24/ |
| 02 | [slice 02](milestone_24_plan_01_slice_02.md) | Populated Settings and truthful complete review lifecycle | 01 | pending | | evidence/ux-acceptance/secretsauce-mcp/milestone24/ |

## Cross-slice concerns
Legacy missing mode means TLS; unknown rejects. New state format must make older readers reject explicit None. Restore excludes live acknowledgment and retains proposal. All changes preserve current permission/revision/credential/audit fences. No credentials or bodies in evidence. Browser fixtures synthetic HTTPS; Docker fixtures isolated and launcher-leased. Full-suite runs after browsers to avoid resource contention.

## Completion gate
All M24 clauses mapped to focused +/- tests, real TLS valid/invalid identity and plaintext with/without auth, migration/restart/archive/restore and Docker recovery, retained browser suites, required seven matched screenshot comparisons, keyboard and 320/200% text-range/document reflow. Run npm test and npm run build. Root independently reviews visuals and acceptance; commit each validated slice, retain exact source hashes.

## Rollback
Older binaries cannot read the new format. Restore compatible prior coherent state only through existing quiescent recovery procedures; never reinterpret None as TLS or inherit archived acknowledgment. Do not touch live review storage.

## Execution notes
Planning inspection found no product ambiguity. No tests run or production files edited at plan creation.
