# Milestone 43: Find and review operational settings clearly

## Objective

An administrator finds a setting, edits a focused populated group, corrects an error and reviews the exact full change set without losing work or hiding decision information.

## User/System Outcome

An administrator finds a setting, edits a focused populated group, corrects an error and reviews the exact full change set without losing work or hiding decision information.

## Scope

Complete the necessary UI, validation/error routing and existing API integration for this bounded journey, with focused regression and actual browser evidence. No implementation slices are prescribed.

## Explicit Exclusions

No backup scheduler/recovery redesign, limit semantics/default changes, capacity migration, new global search, whole Settings approval redesign or blanket disclosure ban; SMTP credential task belongs to M44.

## Source Requirements

- Current validated workflow/definition/definition-package.yaml and its canonical UX7/PRD sources govern implementation.
- UX-02, UX-03, CONFIG-03, UX-IA11, UX-IN18, UX-IN19, UX-C67, UX-C68, UX-C69, UX-C70.
- Traceable resolved scope: REC-RM-040, REC-RM-044, REC-RM-045, REC-RM-046, REC-RM-047 in workflow/reconciliation/REC-RUN-011/03-remediation-backlog.md and REC-RUN-012/report.md. These are adopted provenance; current package authority supersedes historical pending-revalidation flags.

## Preconditions

- Completed providers: M20, M24. Their current contracts and runtime behavior are consumed, not rebuilt.
- Planning publication and milestone-readiness approval must be complete before implementation; known source semantics are settled. No new M0.

- `PRE-056` — Current committed UX7 definition package and approved references are available; provider: repository, verified.
- `PRE-057` — Declared Node/npm/OpenSSL and locked dependencies can run existing build/tests; provider: repository setup, verified.
- `PRE-058` — Disposable HTTPS browser harness and matching Playwright Chromium are available through documented installation or pinned Docker image; provider: repository/local tooling, verified.
- `PRE-059` — Declared completed providers remain accepted in the status manifest; provider: completed milestones, verified.
- `PRE-060` — This milestone owns its focused positive/negative, browser and visual qualification; final `UX7-INTEGRATED` checkpoint remains due before deployment/final acceptance.

## Readiness checks

- Inspect `workflow/definition/definition-package.yaml` and its indexed UX7 sources against the recorded content hashes; all paths/revisions must match and no unresolved decision may affect this work.
- `node --version`, `npm --version`, `openssl version`, `npm ls --depth=0` — supported runtime and installed locked dependencies. Clean checkout first follows `npm ci` and browser provisioning in `docs/console-operations.md`; build is milestone validation, not pre-existing generated state.
- Inspect the declared provider IDs in `delivery/milestones/secretsauce-mcp/status.yaml` — each remains completed.
- `python /home/ha/.codex/skills/delivery-milestone-compiler/scripts/validate_milestones.py delivery/milestones/secretsauce-mcp/status.yaml --allow-existing-status completed` — current skill validator reports structurally valid contracts. On another workstation use the installed skill path; this is planning validation, not a production dependency.
- Confirm the selected existing browser harness and its approved image references exist. Provision Chromium with `npx playwright install chromium` under the documented writable browser path, or use the pinned Playwright `v1.64.0-noble` Docker route recorded in the readiness report. Use synthetic disposable stores, never review-instance mounts.

## Functional Requirements

- Limits uses five ordinary navigation categories: Requests & responses; References & retained state; HTTP & authentication; Scanner capacity; Regex workers. One visible category, labeled narrow-screen select; preserve exact existing fields and safety boundaries.
- Persistent Search settings above navigation opens focused role-scoped dialog. Preserve query while index loads; distinguish loading/empty/error. Selection closes dialog, honors unsaved guard, opens containing category and focuses field/read-only value. Cancel returns focus. Do not stack dialogs.
- Settings review shows Security and operational effect without disclosure; equal values use identical formatting, units, ordering and aligned Before/After labels. Preserve exact literals and current full-scope atomic review; do not copy service-only tabs/approval semantics.
- Use daily UTC-hour select 00:00–23:00 and Keep backups for (days). Invalid imported/stored values remain explicit errors, not silent clamping; retain server validation.
- Show organized health details and audit retention directly with diagnostics context. Keep one meaningful heading; explain MCP required scopes and impact without changing editability/defaults/protocol semantics.
- Guard every unsaved form across category/search/review navigation and preserve current dependency metadata after saves. Read-only users get same hierarchy without mutation controls; no widening public health or secret index.

## UX Constraints

Use current product/ux/manifest.yaml UX7 and UX-G08 precedence: approved feedback007 Limits/search concepts supplement unchanged feedback002/003/004 visual references. Relevant shared rules UX-R09, UX-V09, UX-A10, UX-V05/UX-C42 preserve warm accent, shell width, whitespace, density, readable typography and exact values. Compare actual equivalent desktop/narrow browser states, not merely screenshots existing or functional PASS. Test keyboard, accessible names, focus restoration, 200% text, document width and overflowing text ranges. Loading, absent, read-only, error, success and uncertain outcomes remain distinct. Never rewrite approved references to hide drift.

## Architecture / Security Constraints

Preserve STATE-01/03/09, SECRES-07/08 and UX-EX03. Current role/session/dependency checks and mandatory durable audit remain server-enforced; no new permission, grant, secret reveal or activation path. SMTP Set/Replace remains reviewed draft, SMTP Clear independent immediate deletion, service value mutation immediate. Never log credentials, opaque tokens/proofs, Authorization, cookies or downstream bodies. Keep auth/destination/policy before substitution/I/O. Preserve ChatGPT and Codex stateless MCP contracts.

## Interfaces and Compatibility

Preserve current public configuration/MCP schemas, exact imported identifiers, regex/options and order, secret sanitization and active/draft separation. Change presentation and precise safe diagnostics only where needed for the stated outcome. No persisted migration is required by this contract. Rollback must not rewrite data, resurrect credentials or restore authority; retained backend capabilities stay supported.

## Acceptance Criteria

- [ ] All five categories expose every pre-existing supported field and direct errors/search results focus the correct control; old links remain safely routed without dropping edits.
- [ ] Queries entered before index load are executed once ready; unauthorized fields/secrets never appear. Cancel/Stay/Save/Discard and browser history preserve exact intended work.
- [ ] Equivalent comparison values align identically, effects/health/retention are directly visible, UTC hour cannot select24, retention unit is clear and scopes help matches actual behavior.
- [ ] Cross-section saves and review remain one exact atomic activation with stale/unknown outcomes handled safely; read-only roles cannot mutate.
- [ ] Actual desktop/narrow screenshots match approved feedback007 Limits/search concepts and retained Settings references; keyboard, focus and enlarged-text reflow pass.

## Required Validation

- Reuse/extend test/console-settings.test.ts, test/console-operations.test.ts, test/console-backups-http.test.ts, test/console-authentication.test.ts. Run focused Vitest files through `npx vitest run <affected files> --maxWorkers=2` after build; every new external input has meaningful positive/negative tests.
- Reuse/extend scripts/verify-console-populated-settings-browser.mjs, scripts/verify-console-focused-settings-browser.mjs, scripts/verify-console-operations-browser.mjs. Disposable HTTPS synthetic fixtures only; do not mutate local review-instance mounts. Cover absent/unconfigured/import-mapping/accessibility gaps where this milestone touches them; suppress Playwright request call logs.
- `npm run build`; matching-state browser comparison and relevant responsive/keyboard checks. Full regression is scheduled at `UX7-INTEGRATED` in status.yaml, not automatically repeated for each milestone. A bounded stop records broader qualification pending.
- First confirmed out-of-area regression expands focused scope; a second distinct regression or further spread triggers full suite after focused repairs. On loopback EPERM rerun the same command with permission; preserve assertions/timeouts. No prose-presence tests.

## Known Risks / Deferred Work

Preserve unknown-completion and multi-form edit guards while changing presentation. Mechanisms are delegated within the authoritative contract. No required product work is deferred. Existing external real-LLM qualification limits remain explicit; local fixtures do not claim real ChatGPT/Codex connectivity. Transport/recovery changes are excluded, but if necessary downstream changes reach those boundaries, the existing self-signed TLS or Docker recovery tests become mandatory.
