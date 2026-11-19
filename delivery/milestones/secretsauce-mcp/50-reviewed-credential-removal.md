# Milestone 50: Remove credential configuration and eligible saved values on Apply

## Objective

Deliver one complete proposed credential-removal journey whose reviewed Apply coherently removes only the eligible intended value.

## User/System Outcome

An editor confirms removal, saves or discards safely, sees exact non-secret cleanup effects in review, and applies configuration plus eligible value deletion together.

## Scope

REC-RM-058: named Remove credential button/modal, plain where/how-sent copy, durable scoped removal intent, exact review and atomic cleanup, dependency/incarnation/uncertainty/compatibility/recovery safeguards.

## Explicit Exclusions

No orphan sweeper, immediate cleanup on draft save, SMTP timing change, permanent service deletion (M51), backup destruction or silent no-auth conversion.

## Source Requirements

CONFIG-02/03/04, STATE-11, SECRES-10, D10-01/02/04/05 and UX-IN20/25/26, UX-C85. PO-FB-266–270 provenance maps to adopted REC-RM-058, not findings alone.

## Preconditions

M49 shared copy/task presentation and completed M29/34 current credential generation/restore semantics, M47 proposal discard/review. Current UX10 package and readiness approval.

## Functional Requirements

Confirm named Remove credential in a modal; Cancel changes nothing and return focus appropriately. Confirmation changes proposal only. Preserve scoped removal intent through repeated save/reopen including credentials existing only in a saved draft; Guided/Advanced parity and remove/re-add cancel eligibility. Cancel/discard do not undo independent secret actions. Review exact non-secret keys/values scheduled for deletion against resulting durable references; consume own prior applied/draft references, retain remaining references (including Disabled/Archived), and never sweep unrelated orphans. Bind actor/session, service/key incarnation, configuration/proposal/value generations and availability; current changes force fresh review. One admitted encrypted commit publishes configuration and deletes eligible intended keys/all current projections, consumes review/intent and advances dependencies. Preserve explicit auth-mode validity and missing-value rejection. Audit failure has no effect; admitted unknown completion fences affected work until coherent old/new transaction reconciliation. Never replay standalone cleanup over unchanged active configuration. Establish durable incarnation/dependency fencing needed for stale intents and reuse; unsupported old readers fail closed before admitting new semantics. Explicit restore uses fresh local generations and retains Disabled/review gates.

## Interfaces and Compatibility

Preserve exact credential identifiers/placement syntax, current direct immediate Set/Replace/Clear/Delete and SMTP exception. Extend bounded proposal/review/state schemas only as necessary; old-reader and owned backup/restore projections must agree. Runtime broker/scanner/limiter instances remain; admitted responses retain bounded protection without reviving revoked references. Existing archives remain unchanged.

## Acceptance Criteria

- [ ] Applied-key and saved-draft-only removal survive save/reopen and Guided/Advanced editing; values remain before Apply and after cancel/discard.
- [ ] Remove/re-add and surviving references retain values; unrelated orphan entries and other services are never collected.
- [ ] Review names exact eligible effects, no contents/fingerprints; concurrent replacement/clear/reference/restore/recreation invalidates it.
- [ ] Apply and cleanup publish coherently, retain required authentication validation, current grants/lifecycle and all unaffected values.
- [ ] Unauthorized/restricted/CSRF/malformed/stale inputs reject; audit/persistence faults, restart and old intent replay cannot split Apply or delete newer values.
- [ ] Generation fences, backup current-projection absence, old-reader rejection and explicit older-snapshot restore with fresh generations have positive/negative evidence.
- [ ] Modal/proposal/review/cancel/error states meet UX10 visual and keyboard constraints; immediate value/SMTP controls remain distinct.

## Known Risks / Deferred Work

Atomic cleanup and saved-draft-only provenance are material risks requiring focused fault/recovery tests. Storage mechanism remains delegated; no product semantics or required acceptance deferred. M51 consumes the established incarnation/fence contract rather than redefining it.

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
