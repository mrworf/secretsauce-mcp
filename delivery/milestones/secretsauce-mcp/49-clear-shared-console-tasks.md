# Milestone 49: Use clear shared sign-in, Settings and service tasks

## Objective

Remove ambiguity and transient layout disruption across the existing shared task shell without changing authentication, permission or configuration semantics.

## User/System Outcome

Users recognize advisory versus blocking service state, distinguish sign-in from authenticator replacement, and navigate stable Settings/service screens with concise controls.

## Scope

RM060–063: distinct no-access advisory, compact sign-in, shared password-helper/plain task language, stable asynchronous Settings content placement, and removal of Overview actions that merely duplicate Configuration navigation.

## Explicit Exclusions

No credential-removal transaction (M50), permanent deletion (M51), new recovery flow, Settings redesign or completed milestone reimplementation.

## Source Requirements

Adopted PRD UX-01/02/03, IDENT-02/05, AUTHZ-01/02; UX-IN23/26, UX-R05/R12; REC-RM-060–063. PO-FB-265,271–278 are trace provenance; observational/advisory inputs create no independent scope beyond adopted shared patterns.

## Preconditions

Completed M43 shared Settings shell, M45 shared form/actions and M48 valid zero-assignment services. Published UX10 definition and subsequent packet readiness approval.

## Functional Requirements

Show an accessible distinct warning on Access & policy when nobody is assigned, separate from missing-information exclamations; valid zero-grant review/Apply still works and gives nobody execution. Remove quoted generic saved-value help across equivalent forms, retaining useful requirements and write-only/blank secret behavior. Constrain short sign-in inputs on wide screens while preserving wide administrative workspaces. Keep Recovery code in normal sign-in factor selection; label the existing separate task Replace authenticator with concise actual enrollment/session consequence. Preserve all existing proofs and restricted enrollment. Render Settings loading/loaded/error content in its reserved region from first frame; preserve dirty guards, target focus and stale-read cancellation. Remove only Overview controls that switch to Configuration; retain actual review and precise issue-fix actions.

## Interfaces and Compatibility

Existing authentication, mutation and role contracts remain unchanged. No storage migration, new factor method or password-prefill behavior. Preserve service direct tabs, incomplete review, history and safe unsaved work.

## Acceptance Criteria

- [ ] Zero access has distinct nonblocking meaning; missing required credentials remain blocking; neither state grants execution.
- [ ] Both recovery-code login and separate authenticator replacement remain reachable with correct existing proofs; compact desktop and readable narrow forms pass visual checks.
- [ ] Generic saved-value sentence is absent from shared equivalent forms without removing task-specific validation or fetching secrets.
- [ ] Delayed/failed/rapid Settings section navigation never briefly places content below the rail or loses dirty forms/focus.
- [ ] Overview has no redundant Configuration-only action; actual review/fix navigation and read-only roles remain correct.

## Known Risks / Deferred Work

Shared decoration/loading changes can affect sibling forms; focused sibling regressions and UX10-INTEGRATED cover this. No required outcome deferred.

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
