# Milestone 44: Manage SMTP credentials through a clear focused task

## Objective

An Owner sees current SMTP credential status and stages Set/Replace in a focused dialog, while independent Clear preserves its existing immediate dependency-checked contract.

## User/System Outcome

An Owner sees current SMTP credential status and stages Set/Replace in a focused dialog, while independent Clear preserves its existing immediate dependency-checked contract.

## Scope

Complete the necessary UI, validation/error routing and existing API integration for this bounded journey, with focused regression and actual browser evidence. No implementation slices are prescribed.

## Explicit Exclusions

No SMTP protocol/transport change, new auth modes, service credential timing change, anonymous fallback, blank-password clearing or bypass of enabled dependencies.

## Source Requirements

- Current validated workflow/definition/definition-package.yaml and its canonical UX7/PRD sources govern implementation.
- IDENT-04, CONFIG-03, UX-IN09, UX-IN13, UX-EX03, UX-C71.
- Traceable resolved scope: REC-RM-043 in workflow/reconciliation/REC-RUN-011/03-remediation-backlog.md and REC-RUN-012/report.md. These are adopted provenance; current package authority supersedes historical pending-revalidation flags.

## Preconditions

- Completed providers: M19, M24, M30. Their current contracts and runtime behavior are consumed, not rebuilt.
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

- Always-visible credential area shows current username, availability and pending status separately. Set credential when absent and Replace when present open a named username/password dialog with Save/Cancel.
- Prefill username; password starts blank, never fetched. Blank Replace retains existing password under version checks, including username-only edits; absent required value is local error. Save stages credential changes for normal Settings review/apply and says Not in use yet.
- Clear credential remains separate confirmed immediate deletion; when enabled delivery depends on value, explain and link to disabling/applying first. Preserve recent authentication, current version/dependency/audit and unknown-outcome behavior.
- Cancel leaves current/pending state unchanged and clears temporary entry. Preserve unrelated safe edits, focus and no secret browser persistence/log/error echo. Test email continues using applied state.
- Show yellow plus Not configured for absent mail setup, distinct from Disabled; optional unconfigured SMTP is not a deployment failure.

## UX Constraints

Use current product/ux/manifest.yaml UX7 and UX-G08 precedence: approved feedback007 Limits/search concepts supplement unchanged feedback002/003/004 visual references. Relevant shared rules UX-R09, UX-V09, UX-A10, UX-V05/UX-C42 preserve warm accent, shell width, whitespace, density, readable typography and exact values. Compare actual equivalent desktop/narrow browser states, not merely screenshots existing or functional PASS. Test keyboard, accessible names, focus restoration, 200% text, document width and overflowing text ranges. Loading, absent, read-only, error, success and uncertain outcomes remain distinct. Never rewrite approved references to hide drift.

## Architecture / Security Constraints

Preserve STATE-01/03/09, SECRES-07/08 and UX-EX03. Current role/session/dependency checks and mandatory durable audit remain server-enforced; no new permission, grant, secret reveal or activation path. SMTP Set/Replace remains reviewed draft, SMTP Clear independent immediate deletion, service value mutation immediate. Never log credentials, opaque tokens/proofs, Authorization, cookies or downstream bodies. Keep auth/destination/policy before substitution/I/O. Preserve ChatGPT and Codex stateless MCP contracts.

## Interfaces and Compatibility

Preserve current public configuration/MCP schemas, exact imported identifiers, regex/options and order, secret sanitization and active/draft separation. Change presentation and precise safe diagnostics only where needed for the stated outcome. No persisted migration is required by this contract. Rollback must not rewrite data, resurrect credentials or restore authority; retained backend capabilities stay supported.

## Acceptance Criteria

- [ ] Missing/current/pending and clear-blocked states have clear actions; absent setup is yellow textual attention, not green success.
- [ ] Set/Replace Save does not activate credentials; Cancel and blank Replace do not clear them. Required missing password has safe local error; no saved secret is revealed.
- [ ] Clear rejects enabled dependency, stale version, demoted actor and unavailable audit; after allowed deletion pending copies cannot resurrect value.
- [ ] Keyboard/Escape/focus and desktop/narrow dialog layout match approved shared pattern; response-loss handling resolves durable status without blind retry or secret-bearing request logs.

## Required Validation

- Reuse/extend test/console-notifications.test.ts, test/console-smtp-deletion.test.ts, test/console-smtp-modes.test.ts, test/console-settings.test.ts. Run focused Vitest files through `npx vitest run <affected files> --maxWorkers=2` after build; every new external input has meaningful positive/negative tests.
- Reuse/extend scripts/verify-console-smtp-deletion-browser.mjs, scripts/verify-console-smtp-modes-browser.mjs, scripts/verify-console-populated-settings-browser.mjs. Disposable HTTPS synthetic fixtures only; do not mutate local review-instance mounts. Cover absent/unconfigured/import-mapping/accessibility gaps where this milestone touches them; suppress Playwright request call logs.
- `npm run build`; matching-state browser comparison and relevant responsive/keyboard checks. Full regression is scheduled at `UX7-INTEGRATED` in status.yaml, not automatically repeated for each milestone. A bounded stop records broader qualification pending.
- First confirmed out-of-area regression expands focused scope; a second distinct regression or further spread triggers full suite after focused repairs. On loopback EPERM rerun the same command with permission; preserve assertions/timeouts. No prose-presence tests.

## Known Risks / Deferred Work

Preserve unknown-completion and multi-form edit guards while changing presentation. Mechanisms are delegated within the authoritative contract. No required product work is deferred. Existing external real-LLM qualification limits remain explicit; local fixtures do not claim real ChatGPT/Codex connectivity. Transport/recovery changes are excluded, but if necessary downstream changes reach those boundaries, the existing self-signed TLS or Docker recovery tests become mandatory.
