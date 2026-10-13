# Milestone 22: Readable forms and service configuration

## Objective

Deliver the shared plain-language, wide and accessible console composition through usable existing forms and the complete Add service journey.

## User/System Outcome

Users can understand settings and required inputs, use available horizontal space, and add services without overlapping step labels or repeated controls.

## Scope

Shared navigation/copy, form/help/required conventions and responsive layout across existing console surfaces; service wizard progress and repeatable rows; retained capability discoverability and search aliases. This is an observable authoring outcome, not a CSS scaffolding milestone.

## Explicit Exclusions

Account editing/metadata and list/detail conversion are M23; populated Settings lifecycle and SMTP transport are M24. No removed advanced options, new service packs, custom roles, SaaS tenancy or unrelated redesign.

## Source Requirements

- REC-RM-008 and REC-RM-012: adopted PRD UX-02/03/04, CONFIG-01 and UX-IA08/IN11/R05/A06/V05; UX-C37/41/42.
- Provenance only: REC-008/009/010; PO-FB-015–022/029. Detailed resolved backlog and revisions are in the packet manifest.

## Preconditions

- `21` — Completed friendly configuration controls and lossless import provide the existing forms, search and preserved field coverage.
- Current approved UX3 package and reference images pinned by compiled_from.


Readiness IDs resolve to the [active prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md#active-feedback-002-prerequisites).

- `PRE-027–032` — current committed authority and approved mockup assets, locked tools, actual browser/screenshot support, permitted isolated local validation, container facilities where needed and completed M10–21 providers. No live user state or external SMTP account is needed.
- `PRE-034` — this milestone owns its new positive/negative, migration/failure and browser comparison evidence; existing harnesses are providers, not proof that new behavior passes.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml` and this packet's `status.yaml`: parent planning commit/provenance is finalized, source revisions match, selected milestone is pending and direct predecessors have committed acceptance. The old completed delivery goal and legacy selector do not select this delta.
- Run `node --version`, `npm --version`, `openssl version`; Node satisfies `package.json` >=22 (CI/Docker use22). Fresh checkout uses `npm ci` then `npm run build`. The canonical milestone acceptance suite remains `npm test`; rerun the identical command with loopback permission if listener EPERM occurs.
- Provision matching Chromium using `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium`; retain the same variable for existing/adapted `scripts/verify-console-*-browser.mjs`. Inspect actual HTTPS synthetic setup and distinct output directories before running; no live owner instance, real credentials or recipients. Browser installation/cache alone does not establish rendered evidence.
- Verify named approved reference files still match `product/ux/manifest.yaml`. Inspect the slice validation plan for actual/reference pairs at matching state, role and viewport, with recorded differences/resolution for UX-V05/C42, plus keyboard, 320 CSS px, 200% text, document width and text-range checks. Missing visual comparison cannot be replaced by functional tests.
- Before required Docker recovery/restart checks, run `docker version` and `docker compose version`; require server access and inspect disposable fixture mounts/names plus existing launcher/leases. Never target the current review instance or reuse its storage. Feature-specific SMTP/identity/archive fixtures and safe rollback verification belong to this outcome's slices.

## Functional Requirements

1. Replace ordinary Response protection wording with **Secret detection** and short explanation of returned-data checking and best-effort limits. Use consistent concrete action/help/error/status language; preserve technical aliases including old search terms and advanced capabilities.
2. Show visible asterisk, adjacent '* Required' legend and programmatic required status for every mandatory field; conditional fields follow the chosen mode. Give concise associated purpose/unit/format/effect help for non-obvious inputs. Labels persist; placeholders never replace them or current values.
3. Reflow wide working canvas with paired short fields and full-width URLs/patterns where useful. Related help/status panels supplement real content, move below at narrow widths and never add filler or stretch short fields indiscriminately.
4. Keep the five-step wizard and existing values/validation/Back/Next paths. Numeric markers, labels, long text, added/removed destination/credential/policy rows, errors and expanded help remain in normal flow without collisions or clipping.
5. Retain all ordinary/advanced field capabilities, exact IDs/regexes/nested values, authorization and safe unsaved navigation; no unsupported defaults or silent field loss during presentation changes.

## UX Constraints

Use approved `web-console-ux-3` in [UX manifest](../../../product/ux/manifest.yaml), especially UX-V01–05, UX-R01/02/05, UX-A01–06 and relevant rules below. Keep the service-first shell, clear current location, permitted account/logout controls, calm neutral surfaces, dark navy text, warm orange selection/primary accents, moderate density, useful desktop width and grouped cards. Preserve keyboard operation, semantic labels/links/current-page state, linked errors, focus return and readable status announcements. Loading, empty, forbidden, stale, offline/unknown and success states must remain distinct and preserve safe work. Existing UX-EX01–04 audit/recovery/immediate-action exceptions remain.

**Visual acceptance is mandatory:** compare actual synthetic-data browser screenshots directly with manifest-hashed feedback-002 references at matching state, role and viewport (1440px desktop and 390px narrow where provided). Record reference path/hash, actual image, viewport, state/role, differences and resolution under `evidence/ux-acceptance/secretsauce-mcp/`. Verify composition, width, density, typography, spacing, cards, controls, colors, hierarchy, rails and responsive transformation. Fix material differences or obtain explicit scoped approval under UX-V05/UX-C42 before acceptance. Do not alter mockups to hide drift. General fidelity, not pixel-perfect samples, is required; functional tests do not substitute. Also inspect 320 CSS px, enlarged text, document scroll width and text ranges, not component boxes alone.

Relevant rules: UX-IA08, UX-IN11, UX-R05 and UX-A06. Compare `service-desktop.png` and shared shell/form composition in `email-desktop.png`/`email-narrow.png` under the approved feedback-002 directory; populated-settings behavior itself remains M24. Preserve visual authority for unaffected recovery/service flows.

## Architecture / Security Constraints

Preserve current authorization before sensitive work, durable audit admission, encrypted managed state, actor/session/dependency fencing, own-property-safe dictionaries, exact literals and current live gateway protections. Never log credentials, proof/token values, cookies, authorization headers or downstream/mail bodies. Preserve separate reset ceremonies, explicit execution assignments, pending/restored restrictions, immediate revocation, atomic reviewed activation and history that cannot restore authority or secrets. Do not rebuild unaffected gateway algorithms or claim universal credential non-exfiltration (accepted SEC-DEF-001).

## Interfaces and Compatibility

Presentation changes preserve existing console/API schemas, configuration persistence, old search aliases, imports, stable service/credential identifiers and MCP behavior. Existing saved state loads without a migration merely for wording/layout. No old-client behavior is removed.

## Acceptance Criteria

- [ ] Secret detection wording/help/search aliases are consistent across ordinary surfaces and never promise complete exfiltration prevention.
- [ ] Mandatory and conditional inputs have visible/programmatic indicators and associated usable help/errors.
- [ ] Details, Destination and Authentication at 1280 and 320 CSS px show distinct marker/text bounds; all five steps and repeatable controls work with keyboard and enlarged text.
- [ ] Exact capability/ID/value round trips and safe navigation remain intact.
- [ ] Wide/narrow visual evidence meets UX-C42; material drift is fixed or explicitly scoped and approved.

## Required Validation

At milestone completion run `npm test` and `npm run build`, focused affected unit/integration checks, actual HTTPS browser and keyboard/reflow checks. Every new external input requires positive and negative tests. Use synthetic identities/services and isolated state, never the owner's running instance. Retain gateway/MCP/security regression coverage; actual self-signed HTTPS testing remains mandatory if downstream transport changes. Use existing browser scripts where applicable and extend their evidence for new behavior; passing historical scripts alone is insufficient. Record exact revision, commands and sanitized outcomes. Actual external ChatGPT/Codex checks remain governed by the existing narrowly scoped local-validation exception; it does not exempt any feasible local browser, transport, Docker or recovery checks.
Specifically extend service/friendly-form/focused-settings browser coverage for required modes, search aliases, add/remove/error/help collisions, long strings and permission-safe form views. Capture all six reproduced wizard states (three steps at two widths) plus matching mockup state, keyboard and enlarged-text evidence.

## Known Risks / Deferred Work

Shared styles can regress unrelated recovery and review screens: include representative regression captures. No required source work deferred; M23/M24 adopt the delivered shared presentation contract for their new workflows.
