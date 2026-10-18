# M34 slice 01 — Coherent encrypted credential recovery

Outcome: a post-clear snapshot restores absence and historical actor metadata, with all services Disabled pending review. Earlier archives can restore earlier values only via explicit recovery.

Scope: backup schema/projection, restore historical metadata and directly coupled tests. Excludes scheduling, recovery UX redesign, SMTP and new permissions. Depends on completed M29/30 and existing M17 provider.

Entry: authorized Owner creates encrypted archive through bounded worker; validated restore preview/installation keeps credentials coherent and replaces live authority. Investigate generation consistency and actor source handling in existing implementation before changes. Existing Owner/recent-auth/maintenance admission remains mandatory; Auditor cannot mutate, Member cannot inspect privileged recovery.

State: current missing value has no executable normalized copy; generation and manifest agree. Restored actor is historical source, never recovering Owner/email mapped. Invalid mixed availability/generation/projection rejects before installation. Unknown writes retain existing restart reconciliation and prior/new atomic outcome. Old clear intents must not erase later values.

Surfaces: src/consoleBackupSchema.ts, consoleBackup*.ts, consoleRestore*.ts as needed; test/console-backups.test.ts, console-recovery.test.ts and credential tests. Preserve exact identifier shapes and old archive compatibility.

Validation: positive encrypted present/absent/legacy archive round trips and historical attribution; negative mixed copies/generations, stale authority, corrupt archive, restored execution blocked. Focused Vitest affected backup/recovery/credential tests. Final full suite belongs slice 02. Commit all coherent production changes/tests/plan together once focused checks pass.

Acceptance: every new input has positive/negative evidence; no secret metadata output; bounded worker and explicit restore retained. Record commands/outcomes below. Commit SHA recorded by root after commit.

Delivered: archive manifests now opt into explicit credential generation/absence dependencies, while legacy manifests retain their earlier validation shape. Owned schema rejects missing generation, future generation and contradictory clear/present metadata. Existing historical restore projection remains unchanged.

Validation: `npm test -- --maxWorkers=2 test/console-credential-recovery.test.ts test/console-credential-clearing.test.ts test/console-backups.test.ts test/console-restore-recovery.test.ts` PASS, 61 tests/4 files, 59.34s, including build. Initial restricted run hit subprocess EPERM; identical permitted command passed. Tests cover actual encrypted worker restoration, legacy present recovery after current clear, Unknown/historical attribution, mixed generation/projection rejection and existing uncertain-intent replay/fault/rollback/permission paths. Final source production files tested; no production edits afterward.

## Root acceptance

Accepted commit: `9323aa76862a791384298b7a60ddd3f6eaedbda6`. Subsequent integrated recovery corrections and final qualification recorded in slice 2.
