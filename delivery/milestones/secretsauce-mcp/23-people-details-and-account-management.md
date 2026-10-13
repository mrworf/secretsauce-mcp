# Milestone 23: Manage accounts through clear People details

## Objective

Deliver one coherent People list/detail journey with approved bounded account administration and truthful durable dates.

## User/System Outcome

An authorized user opens one account row to inspect details; permitted administrators edit contact/role with clear security consequences and reliable creation/sign-in information.

## Scope

Compact People list, full detail, target-aware contact/role mutations, durable read-only timestamps, notices, revocation and preservation through restart/backup/restore. UI, API, identity state and security evidence ship together.

## Explicit Exclusions

No bulk operations, invented profile fields, new roles or Administrator invitation/lifecycle/session/grant/restore-review authority. Password/MFA self-service remains My account; existing assisted resets remain separate. No activity analytics or historical audit reconstruction.

## Source Requirements

- REC-RM-009/010/013: IDENT-02A/02B, AUTHZ-02/03, IDENT-06, BACKUP-01/05; SECRES-06/T12–14, STATE-07; UX-IA07/IN12/R05/A06/V05 and UX-C38/39/42.
- Preserve SECRES-05 and STATE-01/02/03. Provenance REC-011/012/013; PO-FB-023–028.

## Preconditions

- `22` — Shared readable form, width, accessibility and visual treatment consumed by People list/detail.
- `18` — Existing purpose/issuer/target-generation-bound assisted reset and durable revocation behavior retained during new identity mutations.


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

1. One row per human account, with real named account link plus safe row clicking, opens a full detail page. Preserve list filter/return context. Show immutable ID, lifecycle, Created and Last console sign-in, permitted role/contact controls, recovery/access actions. Narrow list retains Account/Role and reaches secondary data in detail; external mappings retain their distinct contract.
2. Enforce SECRES-06 on server and UI: Owner may edit allowed contacts/roles including Owners under continuity; Administrator may edit other non-Owner contacts and switch Administrator/Auditor/Member roles, never target/promote Owner or edit own role. Owner/Administrator may edit own contact with sensitive checks. Auditor/Member gain no writes. Owner self-demotion/transfer requires an enrolled replacement.
3. Require active enrolled actor, password/TOTP within five minutes, target/change confirmation, durable audit, current actor/target/lifecycle and target revision. Contact additionally requires operator confirmation of person verification over an established trusted channel, recording category only; validate existing format/uniqueness. No new end-user email approval chain.
4. Contact/role change is immediate, outside drafts/history: advance target authorization generation, revoke sessions/grants/references and target/issuer-bound proofs durably, preserve password/MFA/identity/enrollment/lifecycle/restore eligibility. Pending/disabled edits never activate or rebind invitations. Explain self-contact sign-out and normal login at new contact. Preserve final active enrolled Owner under concurrent role, disable and MFA actions. Reject stale or forbidden changes without partial mutation.
5. Where SMTP is available notify old/new contact after committed change without capability links. Notification failure is separate from committed outcome. Audit changed field names/role/generation/category and sanitized outcome, never contact values. Persistence uncertainty fences old authority through restart and does not claim success.
6. Creation records durable invitation/initial Owner creation, never resets on enrollment/reissue/edit/recovery/restore. Last console sign-in updates with successful full password+factor or recovery-code console admission and audit, atomically with identity transition; concurrent events cannot regress. Exclude failed/restricted/recent-auth/OAuth/MCP/session-refresh/enrollment/reset events.
7. Display timezone; new tracked no-login accounts Never; legacy missing values Unknown; external sign-in Not applicable. No synthetic upgrade dates or audit backfill. Snapshot metadata is included consistently in encrypted backups; restored historical sign-in stays visibly historical until qualifying new sign-in. Legacy archives remain Unknown, rollback preserves prior metadata, and no metadata grants authority.

## UX Constraints

Use approved `web-console-ux-3` in [UX manifest](../../../product/ux/manifest.yaml), especially UX-V01–05, UX-R01/02/05, UX-A01–06 and relevant rules below. Keep the service-first shell, clear current location, permitted account/logout controls, calm neutral surfaces, dark navy text, warm orange selection/primary accents, moderate density, useful desktop width and grouped cards. Preserve keyboard operation, semantic labels/links/current-page state, linked errors, focus return and readable status announcements. Loading, empty, forbidden, stale, offline/unknown and success states must remain distinct and preserve safe work. Existing UX-EX01–04 audit/recovery/immediate-action exceptions remain.

**Visual acceptance is mandatory:** compare actual synthetic-data browser screenshots directly with manifest-hashed feedback-002 references at matching state, role and viewport (1440px desktop and 390px narrow where provided). Record reference path/hash, actual image, viewport, state/role, differences and resolution under `evidence/ux-acceptance/secretsauce-mcp/`. Verify composition, width, density, typography, spacing, cards, controls, colors, hierarchy, rails and responsive transformation. Fix material differences or obtain explicit scoped approval under UX-V05/UX-C42 before acceptance. Do not alter mockups to hide drift. General fidelity, not pixel-perfect samples, is required; functional tests do not substitute. Also inspect 320 CSS px, enlarged text, document scroll width and text ranges, not component boxes alone.

Relevant rules: UX-IA07, UX-IN12, UX-A06; list/detail navigation preserves safe focus and permissions, clear unavailable reasons, recent-auth/verification confirmation and independent notices. Compare `people-desktop.png`, `people-narrow.png`, `person-desktop.png`; include full-detail narrow reflow. Audit-outage, restricted and restored states obey existing feature exceptions.

## Architecture / Security Constraints

Preserve current authorization before sensitive work, durable audit admission, encrypted managed state, actor/session/dependency fencing, own-property-safe dictionaries, exact literals and current live gateway protections. Never log credentials, proof/token values, cookies, authorization headers or downstream/mail bodies. Preserve separate reset ceremonies, explicit execution assignments, pending/restored restrictions, immediate revocation, atomic reviewed activation and history that cannot restore authority or secrets. Do not rebuild unaffected gateway algorithms or claim universal credential non-exfiltration (accepted SEC-DEF-001).
SECRES-06 and STATE-07 are normative for exact target matrix, metadata event definition, uncertainty and archive semantics. Use existing durable revocation-intent protections across uncertain pre-rename writes/restart; live-process invalidation alone is insufficient.

## Interfaces and Compatibility

Extend existing authorized account projection and mutation endpoints without expanding external/legacy identity powers. Reject attempts to write immutable metadata or lifecycle through property editing. Preserve old identity/archive records with Unknown metadata, encrypted portable exclusions and newer local audit evidence. Document format compatibility and safe rollback; old binaries must fail closed if they cannot honor new authority/state, rather than erase security generations or metadata.

## Acceptance Criteria

- [ ] All SECRES-T12–14 allowed/denied role-target-result combinations hold on direct API and browser paths, including self-contact sign-out and final-Owner concurrency.
- [ ] Invalid/duplicate/unverified contacts, forbidden fields, stale target/actor/recent authentication, audit failure and uncertain writes cannot grant access or overwrite newer state.
- [ ] Old sessions/JWTs/refresh grants/references/proofs stay revoked across restart; password/MFA and pending/disabled lifecycle remain unchanged.
- [ ] Created and Last console sign-in reflect exact qualifying events, distinguish Never/Unknown/Not applicable and timezone, and remain monotonic.
- [ ] Backup/restart/restore/rollback preserve truthful historical metadata and existing excluded authority/material.
- [ ] One-row/full-detail keyboard and return/filter workflows and matching reference screenshots satisfy UX-C38/39/42.

## Required Validation

At milestone completion run `npm test` and `npm run build`, focused affected unit/integration checks, actual HTTPS browser and keyboard/reflow checks. Every new external input requires positive and negative tests. Use synthetic identities/services and isolated state, never the owner's running instance. Retain gateway/MCP/security regression coverage; actual self-signed HTTPS testing remains mandatory if downstream transport changes. Use existing browser scripts where applicable and extend their evidence for new behavior; passing historical scripts alone is insufficient. Record exact revision, commands and sanitized outcomes. Actual external ChatGPT/Codex checks remain governed by the existing narrowly scoped local-validation exception; it does not exempt any feasible local browser, transport, Docker or recovery checks.
Run complete role/contact +/- matrix and authorization-revocation races, stale forms, concurrency, notification failure and uncertain-write restart tests. Test every excluded login event, valid recovery-code login, monotonic concurrent sign-ins and read-only metadata tampering. Exercise isolated encrypted archive/legacy restore and installation rollback metadata, retaining bounded-worker, launcher/lease and audit invariants. Extend People/assisted-reset/client browser regressions and direct endpoint tests; no live identities mutated.

## Known Risks / Deferred Work

Identity edits intersect all existing grant/proof paths and backup projections; durable fail-closed behavior and rollback evidence are mandatory. No required work deferred. M24's new SMTP mode is not needed for account notices: this milestone uses existing SMTP/manual-delivery behavior.
