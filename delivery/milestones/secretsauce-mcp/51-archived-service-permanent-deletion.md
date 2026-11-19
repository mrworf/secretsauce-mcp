# Milestone 51: Permanently delete an Archived service with retained evidence

## Objective

Deliver a distinct confirmed Archived deletion that removes current service authority and secrets without deleting retained evidence or targeting a later incarnation.

## User/System Outcome

An Owner/Administrator types a displayed confirmation, deletes the current Archived service, and sees truthful retention, cancel/stale/unknown outcomes.

## Scope

REC-RM-059: Archived-only permanent Delete UI/API and atomic current-object cleanup, typed current confirmation, durable revocation/reuse/replay fencing, audited uncertainty and backup/restore compatibility.

## Explicit Exclusions

No direct Active/Inactive permanent deletion, bulk purge, retroactive archive/audit erasure, new roles, approval chain or authentication ceremony. Do not redo M50 credential cleanup.

## Source Requirements

CONFIG-05/04, AUTHZ-02, AUDIT-01, BACKUP-01/05, STATE-11, SECRES-10; D10-03–05; UX-IN25, UX-C86. PO-FB-279–281 and REC-RM-059 govern the accepted delta.

## Preconditions

M50's durable service/key incarnation/dependency and restore/replay fences, coherent audit/unknown handling and current projections. Completed lifecycle/history/backup capabilities remain baseline. Current UX10/readiness approved.

## Functional Requirements

Only a current eligible Owner/Administrator on a current Archived target may invoke Permanently delete. Dialog names the service, displays the required typed value, explains current settings/draft/value deletion and retained audit/backups; final control disabled until matching, Cancel/Escape safe. Direct endpoint independently validates role, same-origin/CSRF, audit, typed challenge and current target/incarnation/label/dependencies/Archived state. Delete current record, applied/draft/reviews/removal intents, assignments, credential records/values and current runtime projections coherently. Preserve other services/global configuration/identities. Confirmed success returns to Services and absent current reads. Wrong/missing text, role/lifecycle/target changes reject; absent never authorizes replacement deletion. Durable fences outlive deletion and prevent stale saves/reviews/queued work/references/history/replay from targeting reused IDs/names. Fresh deliberate creation/import has fresh authority. Audit failure prevents effect; admitted unknowns fence retries/execution until durable reconciliation. Retain current runtime objects and only existing bounded in-flight protection; old completions cannot repopulate state/references. Retained non-secret evidence/backups follow normal policy. Only explicit authorized whole-instance restore can recover an older snapshot under fresh local generations and Disabled/review/enrollment gates.

## Interfaces and Compatibility

Existing non-Archived Delete-to-archive and unarchive-to-Inactive behavior remains. New bounded destructive input cannot become authentication. Reuse M50 fencing/compatibility contract, extending validators at owned schema paths as necessary; older binaries cannot ignore new authority boundaries. No current secret survives in alternate projection after success; previous backups intentionally remain.

## Acceptance Criteria

- [ ] Correct typed Archived confirmation removes current target/configuration/draft/reviews/grants/values and returns to Services; Cancel unchanged.
- [ ] Wrong/missing text, Active/Inactive, denied/restricted roles, CSRF and changed/deleted/recreated targets reject without affecting another record.
- [ ] Exact retained audit/history/backup consequences are visible; current reads omit deleted objects and unrelated objects remain identical.
- [ ] Stale saves, history reuse, queued work, old references and unresolved intents cannot delete or revive a replacement; fresh creation/import inherits no old authority.
- [ ] Audit/storage fault and restart outcomes remain truthful/fenced; old-reader and backup projection validation pass; explicit restore uses fresh generations.
- [ ] Matching-state desktop/narrow/enlarged dialogs, keyboard/typed entry/focus and stale/unknown recovery satisfy UX10.

## Known Risks / Deferred Work

Identity reuse, admitted unknown deletion and recovery are the principal risks. Required negative tests are part of this milestone, while broad joined qualification remains due at UX10-INTEGRATED. No required behavior deferred.

## UX Constraints

Use approved `product/ux/manifest.yaml` UX10 and its referenced representative states; UX-G11 narrows precedence without replacing prior visual families. Relevant rules are UX-IN23/25/26, UX-R12, UX-V11, UX-A13 and UX-C84–88 (only each outcome's applicable rows). Preserve UX-EX03 SMTP timing and UX-EX04 explicit recovery. Compare actual equivalent desktop1440, narrow390 and320/200%-text states against the approved shared forms/dialog/Settings/service patterns, inspecting screenshots rather than certifying file existence. Keep labels readable, keyboard focus/return/announcement correct, all controls above persistent bars, and non-color meanings. Exercise loading/empty/error/cancel/success/stale/unknown states relevant to this contract. New settings stays the default review tab.

## Architecture / Security Constraints

Preserve current Owner/Administrator authorization and read-only roles, no implicit execution grants, same-origin/CSRF, audit admission, write-only values and no raw secret/header/cookie/body logging. STATE-11 and SECRES-10 govern destructive work; STATE-09/10 and SECRES-07/08/09 remain unless explicitly superseded. SEC-DEF-001 stays accepted. No bulk purge, new vault, new role or new recovery/authentication ceremony.

## Required Validation

Extend existing directly affected console tests/harnesses first; every changed external input needs meaningful valid/invalid/role/stale cases, not a new-test quota. Run focused affected suites and `npm run build`, then isolated synthetic HTTPS browser checks and actual matching-state visual review. No automatic full-suite-per-milestone run. Checkpoint **UX10-INTEGRATED** runs the complete bounded-worker suite/build and joined/recovery/visual qualification on final frozen source before deployment/final acceptance. First confirmed out-of-area regression widens focused coverage; a second distinct regression or spread triggers full regression after focused repairs. Never weaken assertions for environment errors; rerun listener EPERM with loopback permission. Preserve existing conditional self-signed TLS, launcher and recovery gates when those boundaries change. No prose-presence tests except branding or correspondence to actual behavior.

## Readiness checks

- PRE-071 — current published UX10 definition/compiler source digests and approved UX manifest match; inspect the current readiness adapter before starting.
- PRE-072 — `node --version` is >=22, `npm ls --depth=0` succeeds after locked `npm ci`, and `openssl version` succeeds.
- PRE-073 — declared Playwright Chromium is provisioned, or `docker image inspect mcr.microsoft.com/playwright:v1.64.0-noble` succeeds; synthetic HTTPS harnesses and isolated recovery fixtures exist. No live service or real credentials are prerequisites.
- PRE-074 — status dependencies above are completed before this milestone starts; new predecessor behavior is verified by its own acceptance, never assumed from readiness.
- PRE-075 — focused suites/browser qualification and UX10-INTEGRATED remain scheduled. Changed recovery must exercise the actual isolated Docker/backup/restore path; full suite runs on final frozen source with bounded workers and no concurrent browser workload.
