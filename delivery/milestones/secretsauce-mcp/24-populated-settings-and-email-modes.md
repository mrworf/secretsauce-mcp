# Milestone 24: Use populated Settings with explicit email transport

## Objective

Deliver current-value Settings with an understandable save/review/apply lifecycle and supported explicit encrypted or unencrypted SMTP.

## User/System Outcome

Users edit known non-secret values directly, understand which changes are running, and configure/test the deliberately selected email transport without hidden password disclosure or accidental activation.

## Scope

All six Settings sections use populated forms/read-only equivalents; full-scope review and accurate status, SMTP absent/configured/disabled states, TLS/None selection, backup/diagnostics consistency, compatible mode persistence and restore admission. Consolidates related rendering/lifecycle/transport remediation into one verifiable settings journey.

## Explicit Exclusions

No autosave, partial apply, silent unrelated discard, STARTTLS, opportunistic downgrade, new delivery queue, account redesign or removal of advanced capabilities. Owner-reported backup behavior is an observed confusing state, not assumed proven data loss.

## Source Requirements

- REC-RM-007/011/014: IDENT-04/06, SEC-01, CONFIG-03/04, BACKUP-02, OPS-03/04, UX-02/03/04; STATE-01/02/03/08; SECRES-07/T15–16; UX-IA05/08, UX-IN09/10/13 and UX-C34–36/40/42.
- Provenance REC-014/015/016 and PO-FB-030–041; PO-FB-034 saved-password prohibition is binding.

## Preconditions

- `22` — Shared plain copy, wide forms, required/help and responsive visual contract.
- `19` — Independent SMTP credential deletion/version fencing retained.
- `20` — Atomic all-section Settings review, unsaved navigation/search and coherent runtime publication retained.


Readiness IDs resolve to the [active prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md#active-feedback-002-prerequisites).

- `PRE-027–032` — current committed authority and approved mockup assets, locked tools, actual browser/screenshot support, permitted isolated local validation, container facilities where needed and completed M10–21 providers. No live user state or external SMTP account is needed.
- `PRE-034` — this milestone owns its new positive/negative, migration/failure and browser comparison evidence; existing harnesses are providers, not proof that new behavior passes.
- `PRE-033` — M22 must be completed with committed form/layout/copy and matching-reference browser evidence before this milestone starts.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml` and this packet's `status.yaml`: parent planning commit/provenance is finalized, source revisions match, selected milestone is pending and direct predecessors have committed acceptance. The old completed delivery goal and legacy selector do not select this delta.
- Run `node --version`, `npm --version`, `openssl version`; Node satisfies `package.json` >=22 (CI/Docker use22). Fresh checkout uses `npm ci` then `npm run build`. The canonical milestone acceptance suite remains `npm test`; rerun the identical command with loopback permission if listener EPERM occurs.
- Provision matching Chromium using `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium`; retain the same variable for existing/adapted `scripts/verify-console-*-browser.mjs`. Inspect actual HTTPS synthetic setup and distinct output directories before running; no live owner instance, real credentials or recipients. Browser installation/cache alone does not establish rendered evidence.
- Verify named approved reference files still match `product/ux/manifest.yaml`. Inspect the slice validation plan for actual/reference pairs at matching state, role and viewport, with recorded differences/resolution for UX-V05/C42, plus keyboard, 320 CSS px, 200% text, document width and text-range checks. Missing visual comparison cannot be replaced by functional tests.
- Before required Docker recovery/restart checks, run `docker version` and `docker compose version`; require server access and inspect disposable fixture mounts/names plus existing launcher/leases. Never target the current review instance or reuse its storage. Feature-specific SMTP/identity/archive fixtures and safe rollback verification belong to this outcome's slices.

## Functional Requirements

1. Authorized section entry opens populated current non-secret form without Edit step; read-only actors see correctly scoped values. No saved password prefill. Show loading/absence/failure distinctly; unconfigured Email is meaningful, never undefined or invented current values. Disabled Email retains settings/password and clearly cannot deliver.
2. Exact form states: In use; Saved for later · Not in use yet; Unsaved changes. Show changed fields' in-use values locally and in review without duplicate full display form. Unchanged submission is unavailable. Review changes validates and durably saves authorized pending work then opens complete Settings review; Save for later never activates. No hidden autosave.
3. Review shows all changed sections, sanitized before/after and exact scope. Apply N changes atomically activates reviewed set, refreshes real values/revision and links activity. Safe returning edits retain context. Unsaved navigation offers Stay, Save for later and continue, Discard unsaved edits and continue; saved discard explicitly confirms named scope. A failed save preserves safe work, unknown outcome looks up state, stale reviews reload/compare; never silent cross-section apply/discard.
4. Backup schedule/retention follows same durable save/reload/review/apply model; separately report post-commit cleanup pending/failure. Diagnostics Standard(info)/Detailed(debug) uses same loaded revision as current state. Live health last-checked/refresh is independent. Failure/uncertainty never becomes false active status or rollback claim.
5. Offer TLS (encrypted) and None (unencrypted), exact mode preserved through draft/review/apply/history/restart/backup. New and missing-mode legacy records/drafts/archives mean existing implicit TLS; reject unknown explicit mode, never infer from port. Preserve custom ports. SMTP authentication stays independently explicit with/without either mode. No TLS certificate/identity failure fallback to None.
6. None gives clear warning that messages, links and credentials can be read/altered on the network. Current Owner enabling/switching None or changing endpoint/authentication while None requires recent password/TOTP and explicit risk acknowledgment bound to endpoint/mode and credential/config version within normal review. Changed/stale acknowledgment cannot authorize dispatch; unchanged acknowledged mail requires no repeated dialog.
7. Test uses current applied settings; pending values must apply first. None test visibly names mode and requires equivalent acknowledgment/current audit/authorization. Normal/test dispatch rechecks enabled current revision/mode/credential dependency. Already-dispatched bounded work may finish attributed to admitted state and cannot resurrect settings.
8. Blank replacement input displays Password saved. Leave blank to keep it. or No password saved and preserves value only under existing version fencing. Mode/port changes never delete password or disable authentication. Separate deletion and disable/replace remain intact. Sanitize SMTP errors/audit without server replies, credentials, message bodies or capability links.
9. Legacy archive restores TLS. Explicit None survives only as a proposal pending current Owner review/acknowledgment before unencrypted dispatch; archived acknowledgment is not fresh authority. Preserve whole-instance recovery restrictions and immutable admitted state.

## UX Constraints

Use approved `web-console-ux-3` in [UX manifest](../../../product/ux/manifest.yaml), especially UX-V01–05, UX-R01/02/05, UX-A01–06 and relevant rules below. Keep the service-first shell, clear current location, permitted account/logout controls, calm neutral surfaces, dark navy text, warm orange selection/primary accents, moderate density, useful desktop width and grouped cards. Preserve keyboard operation, semantic labels/links/current-page state, linked errors, focus return and readable status announcements. Loading, empty, forbidden, stale, offline/unknown and success states must remain distinct and preserve safe work. Existing UX-EX01–04 audit/recovery/immediate-action exceptions remain.

**Visual acceptance is mandatory:** compare actual synthetic-data browser screenshots directly with manifest-hashed feedback-002 references at matching state, role and viewport (1440px desktop and 390px narrow where provided). Record reference path/hash, actual image, viewport, state/role, differences and resolution under `evidence/ux-acceptance/secretsauce-mcp/`. Verify composition, width, density, typography, spacing, cards, controls, colors, hierarchy, rails and responsive transformation. Fix material differences or obtain explicit scoped approval under UX-V05/UX-C42 before acceptance. Do not alter mockups to hide drift. General fidelity, not pixel-perfect samples, is required; functional tests do not substitute. Also inspect 320 CSS px, enlarged text, document scroll width and text ranges, not component boxes alone.

Relevant rules: UX-IA05/08, UX-IN09/10/13 and UX-A05; section links use current-page semantics, narrow selector/search protect unsaved work and focus. Compare `email-desktop.png`, `email-narrow.png`, `email-unencrypted-desktop.png`, `backups-desktop.png`, `review-desktop.png`, `applied-desktop.png`, `health-desktop.png`. Include read-only, unconfigured and saved-secret states as functional/accessibility complements.

## Architecture / Security Constraints

Preserve current authorization before sensitive work, durable audit admission, encrypted managed state, actor/session/dependency fencing, own-property-safe dictionaries, exact literals and current live gateway protections. Never log credentials, proof/token values, cookies, authorization headers or downstream/mail bodies. Preserve separate reset ceremonies, explicit execution assignments, pending/restored restrictions, immediate revocation, atomic reviewed activation and history that cannot restore authority or secrets. Do not rebuild unaffected gateway algorithms or claim universal credential non-exfiltration (accepted SEC-DEF-001).
STATE-02 requires preparation of every section before one encrypted commit and publication of retained runtime instances even with audit-completion uncertainty. Retention cleanup is separate post-commit work. STATE-08/SECRES-07 govern transport, migration and acknowledgment; browser HTTPS and at-rest encryption remain mandatory. No SMTP-specific host allowlist or credentials ban may silently negate the approved None option.

## Interfaces and Compatibility

Extend existing revisioned SMTP settings/mode and admission contracts with legacy missing-mode TLS mapping; unknown values reject. Preserve draft compatibility, credential-version deletion fences, sanitized history, backup format validation and recovery state. Document safe downgrade/rollback when an older binary cannot represent None: it must reject incompatible state rather than silently reinterpret active transport. Keep all existing configuration/advanced import capabilities and MCP public behavior.

## Acceptance Criteria

- [ ] All six authorized Settings sections open truthful current forms; read-only/absent/loading/error states stay distinct and saved secrets never render.
- [ ] Positive save/reload/review/apply and stale/failed/unknown/forbidden/no-op/navigation scenarios preserve exact values/scope and no partial activation.
- [ ] Backup schedule/retention and diagnostics values agree with loaded/applied revisions; cleanup and health-refresh outcomes remain separate.
- [ ] Real local TLS and plaintext SMTP send/test with and without authentication; default/legacy TLS and explicit None round-trip exactly, unknown modes fail, certificate failure never downgrades.
- [ ] Unauthorized/stale/unacknowledged None and changed queued dependencies cannot dispatch; restored None waits for fresh Owner review.
- [ ] Password blank-retain/replacement/deletion, disabled delivery, legacy drafts/history and failures do not disclose or resurrect credentials.
- [ ] Matching-state/reference screenshots satisfy UX-C34–36/40/42 at desktop/narrow and retain accessibility/reflow.

## Required Validation

At milestone completion run `npm test` and `npm run build`, focused affected unit/integration checks, actual HTTPS browser and keyboard/reflow checks. Every new external input requires positive and negative tests. Use synthetic identities/services and isolated state, never the owner's running instance. Retain gateway/MCP/security regression coverage; actual self-signed HTTPS testing remains mandatory if downstream transport changes. Use existing browser scripts where applicable and extend their evidence for new behavior; passing historical scripts alone is insufficient. Record exact revision, commands and sanitized outcomes. Actual external ChatGPT/Codex checks remain governed by the existing narrowly scoped local-validation exception; it does not exempt any feasible local browser, transport, Docker or recovery checks.
Extend focused Settings, operations, backups, SMTP deletion and friendly forms browser tests with current/pending/unsaved/apply transitions and screenshot comparisons. Verify direct API +/- inputs, cross-section atomicity, changed role/base/credential dependencies, audit/persistence uncertainty and retained runtime behavior. Use isolated real TLS SMTP with valid and invalid certificate/identity plus plaintext server and both auth modes; test mode migration, history, restart, backup/restore and no stale queued dispatch. Preserve disabled-email public reset semantics and uniform admission responses.

## Known Risks / Deferred Work

Settings display simplification must not weaken atomic commit or credential fences; transport choice introduces an explicitly accepted plaintext-hop risk documented in SECRES-07. No required work deferred; no further approval for the supported None choice is needed.
