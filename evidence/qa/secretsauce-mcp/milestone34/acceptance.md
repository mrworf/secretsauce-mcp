# M34 acceptance — coherent credential recovery and integrated local checkpoint

Source baseline: M25–33 accepted at `7ddc5eba461c04852741b3fd90b658de71536471`. Slice 1: `9323aa7`. Final tested-file hashes are recorded in `tested-inputs.json`; root records final slice SHA.

## Criterion coverage

| M34 criterion | Current evidence |
|---|---|
| Post-clear absence, consistent generation/actor, no normalized value; reject contradictions | New `test/console-credential-recovery.test.ts`: real encrypted worker backup/restore for present and missing values, mismatched manifest generation, future/missing generation, stale normalized copy, contradictory completed Clear. Explicit marker binds new dependencies; old manifests remain readable. |
| Restored values stay absent, historical/Unknown actor, services Disabled | New encrypted tests, `credential-recovery/browser-report.json`, post-clear clean-host Docker report. Historical account ID is not email remapped; no new credit to recovery Owner. |
| Explicit old archive recovery only, revoked live authority | Legacy present archive restored after current clear, before install still missing; whole-instance restore clears sessions and disables every service. Existing recovery tests reject old authority and require fresh enrollment. |
| History/discard never restores secret; independent audit and worker/lease contracts | Existing credential clearing/state tests and final full suite; Docker clean-host original key removed, new local audit identity, retained source provenance, competing writer rejected; shared job slot/fault tests retained. |
| Fault/restart/rollback coherent, old clear cannot erase replacement | Existing M29 tests retained; new uncertain-clear restart→encrypted backup test keeps previous successful Set attribution while value is missing. A same-host unresolved old clear cannot replay after explicit earlier-value restoration: the new installation gives every value a newer local dependency generation while retaining snapshot value version and historical attribution. Installer actual SIGKILL boundary and launcher reports qualify current image. |
| Permission/state positive and negative, compatibility/no secret-bearing output | Backup/recovery Owner/recent-auth/audit/stale/corrupt input tests; all service browser suites cover Owner/Administrator/Auditor/Member; literal/typed/custom-policy round trips; ciphertext and safe metadata checks; local protocol tests and fresh recovered MCP dispatch. |
| Actual matching visual, keyboard/narrow/200% | `evidence/ux-acceptance/secretsauce-mcp/milestone34/visual-review.md` plus ten fresh browser suites and restored credential screenshots. |
| Standalone final checkpoint, no later provider needed | All M25–33 providers already accepted. Complete suite, ten sequential browser suites and isolated current-image recovery gates run at M34. No deferred feature or new waiver. |

## Commands and outcomes

- Focused credential clearing/backup/restore: `npm test -- --maxWorkers=2 test/console-credential-recovery.test.ts test/console-credential-clearing.test.ts test/console-backups.test.ts test/console-restore-recovery.test.ts`: 61 PASS before review correction; corrected new recovery file: 5 PASS. Initial restricted subprocess EPERM resolved by identical permitted execution.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-service-integration.mjs`: all ten PASS, sequential synthetic HTTPS fixtures, plus a single joined actual-browser import→mapping→Guided/Advanced→credential/policy dialogs→review/apply→Disable/Clear→encrypted backup/restore→fresh enrollment journey. Covers import and explicit identity correction; full-draft Guided/Advanced preservation; destinations; immediate values; rule authoring; access/help; history/policy tester; reviewed activation/lifecycle; encrypted restore and fresh recovery UI. See per-suite reports for assertions.
- `docker build -t secretsauce-m34-local:acceptance .`: current source; immutable ID and operational outcomes in platform reports. Only owned disposable containers and mounts; no review deployment touched.
- With `CONSOLE_PLATFORM_EVIDENCE_DIR=evidence/platform/secretsauce-mcp/milestone34`, `M17_DOCKER_IMAGE=secretsauce-m34-local:acceptance`: `M34_CREDENTIAL_RECOVERY=1 node scripts/verify-console-recovery-cleanhost-docker.mjs`; `node scripts/verify-console-recovery-launcher-docker.mjs`; `node scripts/verify-console-recovery-crashes-docker.mjs`.

## Investigation and fixes

Manifest dependencies previously omitted explicit missing state and mutation generation. New archives bind both, while old manifests remain compatible. Review found that uncertain Clear reconciliation intentionally preserves the previous successful Set action; schema must not infer last-successful action from current missing availability. The focused new restart/archive test now proves this distinction. A second regression reproduced failed startup when a pre-restore unresolved clear met an older archived generation; restored generation fencing now prevents that replay while services remain Disabled. Test harness corrections used current recovery-checklist landing, case-correct Value missing label, and persisted synthetic recovery material before a fault; no assertion or timeout weakened.

The existing external real ChatGPT/Codex connection exception remains. Actual local five-tool/stateless protocol tests and recovered reference/downstream dispatch are evidence, not a claim of real external client interoperability. No production deployment or live-data migration performed.

Operational result: PASS on immutable image `sha256:89c15ec2d582bd20ce97872bce07b8dfe9f9d8be780e0da0d4737573c1f57fac`: 7 clean-host groups (100 services / 10,000 retained gateway events), 9 launcher cases, all 94 actual SIGKILL install/rollback boundaries. Final reports replace only M34 evidence. Earlier-image exploratory results are not used for acceptance.

The first final full-suite run passed 756/757 tests. Its sole failure was an existing exact manifest-shape assertion in `console-backup-domains.test.ts` that omitted the newly required generation field. The fixture now asserts `credentialStateVersion: 1` and the exact current credential generation; its 4 tests passed before the full rerun. No production behavior, assertion strength or timeout was changed for this correction, so final-image and browser evidence remain current.

Final validation: PASS — `npm test -- --maxWorkers=2`, 757 tests across 75 files, 113.66 seconds; then `npm run build` PASS. No concurrent browser or Docker workload. Tested inputs and summarized results are recorded in `evidence/qa/secretsauce-mcp/milestone34/{tested-inputs.json,validation.json}`. All M34 criteria are satisfied; no new waiver, external action or deployment.
