# Milestone 45: Configure services and Settings with clear consistent actions

## Objective

Complete one consistent editing experience across shared Settings actions and the service credential/policy/access editor, preserving all existing state semantics.

## User/System Outcome

An authorized editor can recognize current/pending state, change a named credential configuration, understand policy and grant access, then save/review through unambiguous controls. Read-only viewers see the same grouping without mutation rights.

## Scope

Shared Settings bottom bar and every equivalent editable section; service credential cards and summaries; policy explanation/default layout; plain access assignment wording. Include needed responsive/focus/error integration with existing forms and dialogs.

## Explicit Exclusions

Activity predicates/export relocation belong to M46. No credential lifecycle, SMTP transport, policy evaluation, grant authority, persistence format, new roles or Settings section redesign. No broad refactor or redo of M41–44.

## Source Requirements

Current validated UX8 definition package and indexed PRD CONFIG-02/03, POLICY-01, AUTHZ-02, UX-02/03/04; UX-IN20/21. REC-RM-048/049/050 in REC013/report.md provide adopted trace; REC-054–056 are provenance, not independent authority. PO-FB-202–215 preserve their original classes.

## Preconditions

Completed M31/32 supply policy/access; M41 supplies precise guided service flow; M43/44 supply Settings guards and SMTP exception. Current published definition and readiness-approved planning must precede implementation. No additional foundation or M0 is required by the known graph.

- PRE-061 — Current UX8 definition and approved visual references are available.
- PRE-062/063 — Declared runtime, installed packages and synthetic HTTPS browser facilities are available.
- PRE-064 — Listed dependency milestones are completed in the current checkout.
- PRE-065 — Focused and UX8-INTEGRATED acceptance remains owned by delivery, not readiness.

## Readiness checks

- Inspect `workflow/definition/definition-package.yaml` and current UX manifest revisions against the planning handoff; they must match.
- `node --version`, `npm ls --depth=0`, `openssl version` must resolve the declared runtime/dependencies and HTTPS certificate tooling.
- Inspect the named test/browser paths below and completed dependency records; all must exist. Use documented `npm ci` and `npx playwright install chromium` when provisioning a fresh checkout, or the pinned Playwright 1.64.0 Docker route recorded in readiness. No live credentials or review-instance mounts are needed.

## Functional Requirements

- One persistent white bottom bar shows status, Discard, Save for later and primary Review changes; remove duplicate top global draft bar. Preserve local errors/security notices, per-field state and exceptional audit/recovery banners. Unavailable actions remain visibly disabled. Keep all-form dirty/save/review and scoped confirmed discard semantics.
- Each service credential has a bordered card with exact configuration, Credential value set/not set, version and last successful actor/time. Apply wording to equivalent Overview/value summaries. Use contextual text Remove credential configuration in the card, naming the credential accessibly; explain proposed reference removal is applied later and does not clear stored value. Add credential follows all cards and focuses new content.
- Keep immediate stored-value Set/Replace/Clear/Delete separately grouped, write-only and generation/dependency checked. Read-only cards omit mutations; no-auth and imported identifiers retain all supported behavior. SMTP timing remains distinct.
- Default policy left and one explanation box right, stacked logically when narrow. Bullets cover fallback, mixed effects, priority, Deny ties and listed same-effect ties. Reorder help is exactly the requested single sentence; actual unavailable directions remain disabled. Give access and Choose a user or client retain eligibility/confirmation and initial-versus-current grants.

## Interfaces and Compatibility

No new API schema or persisted state is required. Preserve exact supported values, safe non-secret drafts across navigation, current authorization, failed/unknown outcome recovery and atomic full Settings review. Rollback must not revive cleared values or grants.

## Acceptance Criteria

- [ ] Every editable Settings section has one shared persistent status/action bar; no duplicate global bar or hidden focused field/error at narrow/enlarged text. Read-only roles gain no mutation.
- [ ] Unsaved, saved pending, unchanged, invalid, stale and unknown states preserve all forms; Discard states and confirms scope without reversing immediate operations.
- [ ] Multiple/imported credentials have unmistakable named cards and status; removal affects only draft configuration, while stored-value actions retain existing independent consequences and metadata.
- [ ] Policy explanations are complete once, controls preserve tie/default/order semantics and access wording changes no grant eligibility.
- [ ] Keyboard, modal return focus and actual responsive screenshots conform to approved shared appearance; existing guided flow and Settings navigation still work.

Focused validation: reuse test/console-settings.test.ts, console-services.test.ts, console-services-http.test.ts and policy tests; reuse populated-Settings/service-configuration browser harnesses. Include direct read-only/stale negatives and SMTP timing regression where the shared footer intersects its pending state.

## UX Constraints

Canonical UX8 manifest and UX-G09 precedence govern the bounded change within the existing approved visual family. Use UX-IA12, UX-IN20–22 as applicable; UX-R10/V10/A11 and UX-C72–78 specify reflow, appearance, keyboard/focus and acceptance. Preserve unchanged UX7 shell, warm accent, white bordered surfaces, readable density and exact literals. Compare actual populated, empty/error, read-only and recovery states against the applicable approved references listed by the manifest; functional PASS or merely saving screenshots is insufficient. Inspect desktop1440px, narrow390px and320CSSpx with enlarged text, document width and text-range overflow. No new visual family, nested modal stack, clipped literal or focus-obscuring footer.

## Architecture / Security Constraints

Use current REC013 targeted architecture/security review sections and retained STATE-01/02/03/09, SECRES-07/08 and UX-EX03. Keep current server authorization, mandatory audit, exact-value sanitization, secret-free logs, coherent atomic application and current dependency checks. Service credential value actions remain immediate; SMTP Set/Replace remains pending review/apply and Clear independently dependency-blocked. Never expose/log raw credentials, Authorization, cookies, opaque tokens/proofs or downstream bodies. Preserve stateless per-POST MCP and ChatGPT/Codex contracts. SEC-DEF-001 remains an accepted limitation, not new work or a universal non-exfiltration claim.

## Required Validation

Reuse and extend existing focused tests/harnesses cited below; no new-test quota. Every new external input needs meaningful positive/negative tests. Run `npm run build` and focused `npx vitest run <affected files> --maxWorkers=2`; browser/visual evidence uses disposable synthetic HTTPS fixtures, never local review-instance mounts. Suppress Playwright request call logs and inspect images rather than only existence. No acceptance execution occurs during compilation.

Full regression is due at `status.yaml#regression_checkpoints.UX8-INTEGRATED` after M45/M46, before deployment/final packet acceptance. Focused completion is not broad qualification. First confirmed unexpected out-of-area regression expands focused scope; a second distinct regression or spread requires full regression after repairs. Preserve test assertions/timeouts; loopback EPERM requires rerun with permission. Conditional transport changes require real self-signed HTTPS and recovery changes require existing Docker recovery gates, although neither is in this scope. Do not add prose-presence tests.

## Known Risks / Deferred Work

Do not accidentally conflate draft persistence, active application and independent immediate operations. Existing authorized evidence entry points must survive role-specific navigation. No required outcome is deferred; implementation mechanisms remain delegated. External real-LLM qualification remains outside these presentation/evidence changes; local synthetic tests cannot certify remote ChatGPT/Codex connectivity.
