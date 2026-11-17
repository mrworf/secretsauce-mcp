# Milestone 41: Complete service setup through precise guidance

## Objective

Import or create a service, see exactly what is missing, correct it, and reach the actual review through one consistent four-section flow.

## User/System Outcome

Import or create a service, see exactly what is missing, correct it, and reach the actual review through one consistent four-section flow.

## Scope

Complete the necessary UI, validation/error routing and existing API integration for this bounded journey, with focused regression and actual browser evidence. No implementation slices are prescribed.

## Explicit Exclusions

No service health polling, credential-storage redesign, rule/editor redesign, new grants or automatic activation; transfer tools and Settings are separate.

## Source Requirements

- Current validated workflow/definition/definition-package.yaml and its canonical UX7/PRD sources govern implementation.
- CONFIG-01, CONFIG-05, UX-03, UX-IA02, UX-IA09, UX-IN15, UX-C64, UX-C65.
- Traceable resolved scope: REC-RM-034, REC-RM-035, REC-RM-036, REC-RM-037 in workflow/reconciliation/REC-RUN-011/03-remediation-backlog.md and REC-RUN-012/report.md. These are adopted provenance; current package authority supersedes historical pending-revalidation flags.

## Preconditions

- Completed providers: M25, M26, M33, M38, M39. Their current contracts and runtime behavior are consumed, not rebuilt.
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

- Keep service rows concise as Needs configuration, preserving independent runtime lifecycle and pending-draft state; put specific missing values/mappings in Overview. Top-align Find a service and Status controls.
- Identify only actual missing/invalid fields and affected sections. Show yellow circled exclamation plus accessible text after affected section names and prominent local missing-value guidance with the correct action. Revalidate clear indicators after real correction, not on visiting a section.
- New and edited/imported guided forms use Details, Destination, Authentication, Access & policy. Continue advances the first three; Review & apply on the last opens actual existing review. Remove fifth placeholder; keep navigable section headers and whole-draft Advanced mode.
- Overview distinguishes incomplete from ready drafts. Ready Review draft changes opens actual review; unavailable shortcut while known blockers remain gives exact corrections. Check readiness again for unvisited sections and current dependencies.
- Preserve New settings default, Changes comparison, visible actual exceptions and exact modal acknowledgments. Preserve dirty guards, browser Back/Forward, safe work and import mapping recovery. An available value is not a downstream connectivity test.

## UX Constraints

Use current product/ux/manifest.yaml UX7 and UX-G08 precedence: approved feedback007 Limits/search concepts supplement unchanged feedback002/003/004 visual references. Relevant shared rules UX-R09, UX-V09, UX-A10, UX-V05/UX-C42 preserve warm accent, shell width, whitespace, density, readable typography and exact values. Compare actual equivalent desktop/narrow browser states, not merely screenshots existing or functional PASS. Test keyboard, accessible names, focus restoration, 200% text, document width and overflowing text ranges. Loading, absent, read-only, error, success and uncertain outcomes remain distinct. Never rewrite approved references to hide drift.

## Architecture / Security Constraints

Preserve STATE-01/03/09, SECRES-07/08 and UX-EX03. Current role/session/dependency checks and mandatory durable audit remain server-enforced; no new permission, grant, secret reveal or activation path. SMTP Set/Replace remains reviewed draft, SMTP Clear independent immediate deletion, service value mutation immediate. Never log credentials, opaque tokens/proofs, Authorization, cookies or downstream bodies. Keep auth/destination/policy before substitution/I/O. Preserve ChatGPT and Codex stateless MCP contracts.

## Interfaces and Compatibility

Preserve current public configuration/MCP schemas, exact imported identifiers, regex/options and order, secret sanitization and active/draft separation. Change presentation and precise safe diagnostics only where needed for the stated outcome. No persisted migration is required by this contract. Rollback must not rewrite data, resurrect credentials or restore authority; retained backend capabilities stay supported.

## Acceptance Criteria

- [ ] Missing credential only highlights Authentication; malformed destination/policy and unresolved imported identity each identify their actual target without flagging unaffected sections.
- [ ] Create and edit follow the same four-section path; no fifth placeholder or fake review shortcut remains. Real review is reachable immediately from a ready Overview.
- [ ] Active configuration keeps running with an incomplete draft; missing applied dependency remains truthfully blocked. Role/stale/audit failures remain safe and actionable.
- [ ] Keyboard, narrow/200% text and Back/Forward preserve visible context, input and focus with no overlaps or color-only status.

## Required Validation

- Reuse/extend test/console-services.test.ts, test/console-service-navigation.test.ts, test/console-service-review.test.ts, test/console-migration.test.ts. Run focused Vitest files through `npx vitest run <affected files> --maxWorkers=2` after build; every new external input has meaningful positive/negative tests.
- Reuse/extend scripts/verify-console-navigation-browser.mjs, scripts/verify-console-approval-browser.mjs. Disposable HTTPS synthetic fixtures only; do not mutate local review-instance mounts. Cover absent/unconfigured/import-mapping/accessibility gaps where this milestone touches them; suppress Playwright request call logs.
- `npm run build`; matching-state browser comparison and relevant responsive/keyboard checks. Full regression is scheduled at `UX7-INTEGRATED` in status.yaml, not automatically repeated for each milestone. A bounded stop records broader qualification pending.
- First confirmed out-of-area regression expands focused scope; a second distinct regression or further spread triggers full suite after focused repairs. On loopback EPERM rerun the same command with permission; preserve assertions/timeouts. No prose-presence tests.

## Known Risks / Deferred Work

Preserve unknown-completion and multi-form edit guards while changing presentation. Mechanisms are delegated within the authoritative contract. No required product work is deferred. Existing external real-LLM qualification limits remain explicit; local fixtures do not claim real ChatGPT/Codex connectivity. Transport/recovery changes are excluded, but if necessary downstream changes reach those boundaries, the existing self-signed TLS or Docker recovery tests become mandatory.
