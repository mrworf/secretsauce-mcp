# M16: Create recoverable encrypted instance backups

This plan governs exactly M16.

## Outcome
Owners create and download complete portable encrypted recovery points, configure daily mounted-directory backups and reviewed retention, and see truthful bounded job health. Independent saved material decrypts every included dependency on a clean host. Installation and reenrollment are M17.

## Delivery-goal context
- Goal status: delivery/milestones/secretsauce-mcp/status.yaml → delivery_goal (root-owned)
- Product ID: secretsauce-mcp
- Packet: delivery/milestones/secretsauce-mcp; planning payload 865aa5710bcb9ff6c4641e177452ab9c50619a19
- Definition payload: 06dd0ee59defd1a75db121f1d8133c7100238b80
- Fixed goal scope: M10–M17; current scope M16 only; new companion transaction
- Parent commit: 9dbdda74a44eb7a93b6184d055a0159f28ba2ac5
- Pre-existing dirty paths: untracked test-results/; excluded and preserved

## Governing contracts
- docs/web-console-prd.md BACKUP-01/02, OPS-03/04/06, IDENT-04/06, CONFIG-03, SEC-01, AUDIT-01/03/04
- product/architecture/web-console-state-contract.md STATE-04
- product/security/web-console-security-contract.md SECRES-01/02/04
- delivery/milestones/secretsauce-mcp/16-encrypted-instance-backups.md (all acceptance and validation clauses)
- product/ux/{01-information-architecture,02-interaction-patterns,03-responsive-and-platform,04-visual-system,05-accessibility,07-acceptance-checklist}.md; UX-C10/15/17/20/21/22/24
- AGENTS.md; package.json; .github/workflows/ci.yml

## Current-state findings
ConsoleStore atomically encrypts a single managed state; synchronous commits and synchronous durable audit permit a bounded coherent in-process snapshot. Existing setup retains only a hash of independent recovery material. Audit has authenticated chain/head with separate protected gateway key. Notifications provide bounded synthetic TLS SMTP. No current backup provider; health/evidence truthfully say pending. Node >=22, declared Vitest/Playwright, actual Docker and HTTPS harnesses exist. Existing production dependency advisories remain documented M15 follow-up.

## Decisions
Use deterministic X25519 private recovery key derived with domain separation from setup's 256-bit independent material, retaining only its public key plus existing verifier. Ephemeral X25519 DH/HKDF and AES-GCM encrypt archives; scheduling requires no raw material. Existing setup before M16 can initialize public wrapping metadata using saved material after recent authentication. Archive is a strict bounded JSON envelope, not a filesystem extraction format. Semantic projection explicitly includes configuration/history/secrets/identities/settings and verified audit evidence with cryptographic dependencies; factors and all live authority are excluded. Synchronous capture prevents mixed rotation/apply points, with a finite capture budget. A shared per-store job coordinator is the M17 interface. Fixed archive/storage/history bounds reject exhaustion instead of overriding retention. Partial ciphertext stays unpublished; durable running state becomes unknown at restart. Daily UTC schedule and explicit mounted path are validated Owner settings; no remote connector.

## Scope
Included: complete archive provider, manual creation/download, bounded verification/decryption, setup/public-key lifecycle, daily schedule, retention review/deletion audit, restart/failure states, optional backup alerts, Settings UX, real health and evidence, runbooks and local drills.
Excluded: M17 installation/reenrollment/maintenance, remote/cloud storage, selective export, downstream data, images/proxy configuration, live browser/OAuth/reference/factor/proof state; upstream authority/status edits.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit | Evidence |
|---|---|---|---|---|---|---|
| 01 | milestone_16_plan_01_slice_01.md | Portable complete archive/manual job/download provider | M10–15 | completed | 1fca06a6ce0362e027cf241ad6be95ac6f16f43b | QA browser-report.json; 41 tests/5 files |
| 02 | milestone_16_plan_01_slice_02.md | Daily backups, reviewed retention and material lifecycle | 01 | completed | ee29ef90afc8c6842c81aa6ad8b6928f2f4beb29 | 27 tests/3 files; HTTPS browser5 groups |
| 03 | milestone_16_plan_01_slice_03.md | Backups UX, health/evidence and isolated operational validation | 01,02 | completed | 87a87f2fab8d5b5ea6e38c731414f78263e826c6 |585tests/61files/build; HTTPS7+preservation17groups; Docker11groups; acceptance-coverage.md |

## Cross-slice concerns
Preserve live gateway/scanner/broker objects and mandatory audit. Recheck current Owner/session/security generation before asynchronous final publication/download. Never log or write plaintext secrets. Backup directory writes are constrained to validated mounted directory with fixed UUID filenames, no arbitrary extraction. Archive holders can decrypt included secrets; save material independently and copy ciphertext off-host. One active process with launcher leases remains mandatory. Bound jobs, snapshot, archive size, directory consumption and history. Retention never removes last good archive. Progress stages have no invented percentage.

## Milestone completion gate
Focused and related Vitest tests per slice; final npm test and npm run build after production changes; actual HTTPS Playwright keyboard/320px evidence; actual isolated Docker clean-host verification using archive/material alone, wrong-material/corruption/storage/restart drills. Evidence below evidence/qa/secretsauce-mcp/milestone16 and evidence/platform/secretsauce-mcp/milestone16. Real ChatGPT/Codex integration remains explicitly deferred by the user exception, not claimed run.

## Rollback and recovery
Revert code only after quiescing the active process; retain existing protected app/audit mounts and archive ciphertext/material. Never steal leases or weaken ESRCH ownership. Interrupted jobs remain unknown and require a new deliberate job; failed output never replaces previous completed archive. Public-key rotation leaves retained archives bound to old material and displays that obligation.

## Execution notes
Plans persisted before production edits. Root owns authoritative freshness, goal/status and final acceptance.

## Deferred follow-ups
M17 restore installation and recovery activation; inherited dependency triage in evidence/platform/secretsauce-mcp/milestone15/dependency-triage.md; real LLM integrations deferred by explicit user exception.

Final slice payload records current test/build/browser/Docker evidence and requirement coverage. Root receives exact final commit SHA externally and owns milestone acceptance/status. All three indexed slices are complete; no M17 installation or actual LLM verification is claimed.
