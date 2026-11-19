# Milestone 47: Edit and discard service proposals through one coherent flow

## Objective

Owners/Administrators can inspect incomplete configuration, correct exact blockers, save or explicitly discard the right proposal, and navigate without losing work. Service viewers distinguish lifecycle from saved Draft on all four tabs.

## User/System Outcome

Owners/Administrators can inspect incomplete configuration, correct exact blockers, save or explicitly discard the right proposal, and navigate without losing work. Service viewers distinguish lifecycle from saved Draft on all four tabs.

## Scope

Shared service header/list status, Guided/Advanced footer and direct sections, incomplete actual review, scoped browser/saved-draft discard including never-active retained identities, and reliable guard-save navigation. Include necessary API/state/audit/concurrency and compatible retained-name handling.

## Explicit Exclusions

Independent fresh import allocation and legacy mapping retirement belong to M48. No general persistence redesign, service deletion/purge, automatic credential cleanup, new roles or unrelated Settings/Activity behavior.

## Source Requirements

CONFIG-01/03/05, UX-01/02/03/04; REC-RM-053/054/055/056 as adopted trace; S9-01/02/05, STATE-10, SECRES-09; UX-G10/IN23/C79–82. Feedback238–249,252,256–262; observations explain defects, directives establish requirements.

## Preconditions

M35, M41, M45, M46 supplies the existing review/navigation/footer/transfer contract consumed here. Current validated UX9 package and readiness-approved planning must precede implementation. `PRE-066` supplies current source authority; `PRE-067/068` supply locked runtime and synthetic HTTPS facilities; `PRE-069` requires the listed provider milestones completed before entry. `PRE-070` remains consuming-milestone acceptance work, not a prerequisite to beginning implementation.

## Functional Requirements

- All Overview/Configuration/Access/Activity headers share readable name, Active/Inactive/Archived lifecycle and separate saved Draft. Internal Draft/Disabled representations may remain. Never misrepresent Active as reachable; list-only Needs configuration remains, with parent Configuration and affected section indicators inside.
- Remove Back to Services throughout these tabs/editor; main Services navigation uses the same dirty/history guard. Direct sections replace Continue/Back. Guided and Advanced share one persistent status/Discard/Save for later/Review changes bar with permitted disabled/read-only states.
- Actual grouped review opens incomplete proposals, keeps New settings default/Changes, lists precise issue links, and prevents approval authority until complete. Malformed Advanced input remains locally correctable. Empty access is valid and explicitly means nobody can execute; valid apply retains current complete checks/acknowledgments.
- Browser-unsaved discard reverts to saved/applied; never-saved abandon creates no record. Saved-draft removal requires separate named confirmation including browser changes if affected; cancels preserve both. Saved never-active service retains human name/stable identity, independent values/evidence, Inactive and no Draft, with fresh setup that does not resurrect discarded content. Active/applied/Archived discard preserves current configuration, assignments and lifecycle.
- Durable discard invalidates old reviews and binds authorization/current revision/generation/audit; stale, outage and uncertain completion never report success. Define minimal compatible retained-name state only if needed, preserving newer formats and old-reader rejection at actual changed boundaries.
- Guard Save persists first then navigates; Stay retains work and Discard loses only named scope. Failure preserves input and a useful error without endless guard loops. Reopening confirms saved Access & policy selections. Preserve the three tested baseline fixes: export confirmation on its originating screen, current email beside the Activity actor ID, and the coherent shared service header. Guard-save correctness remains required work in this milestone.

## UX Constraints

Canonical UX9 manifest, UX-G10 delta precedence, UX-IN23/24, UX-R11/A12 and UX-C79–83 govern. Reuse approved warm-accent shell, white bordered cards, shared header and Settings persistent footer appearance. Preserve prior approved images unchanged; exact superseded controls/mapping/lifecycle text is governed by UX9 prose. Compare actual corresponding populated, incomplete, read-only, failure and recovery states at desktop1440, narrow390 and320CSSpx/200% text. Inspect document/text overflow, focused control/error clearance above footer, readable whole-word actions, modal focus return, direct sections and browser history. Functional PASS or screenshot existence alone is insufficient. No new theme, modal stack or broad Settings/Activity redesign. Preserve service-immediate values/access versus staged SMTP Set/Replace and independent guarded Clear.

## Architecture / Security Constraints

STATE-10 and SECRES-09 plus retained STATE-01/02/09 govern. Current authorization, target/base/generation checks and durable audit bind sensitive changes; fail closed on stale/uncertain authority and inspect durable outcome before retry. Never alter current live assignments, independent values/attribution, applied configuration or lifecycle through a proposal-only action. Never log/reveal raw credentials, Authorization, cookies, opaque proofs or downstream bodies. Own-property-safe exact identifiers and bounded imported input remain. Role alone never grants execution; preserve auth/destination/policy before substitution and stateless per-POST MCP for ChatGPT/Codex. SEC-DEF-001 remains an accepted best-effort scanner limitation.

## Interfaces and Compatibility

No MCP API change. New discard/inspection management contracts must distinguish read-only incomplete projection from usable review. Preserve supported exact configuration/literals and independent current authority. Any changed durable representation needs targeted previous-reader/restart/archive compatibility under STATE-10; labels alone require no enum migration.

## Acceptance Criteria

- [ ] All four tabs/list have correct lifecycle/Draft/readiness; no redundant Back or Continue actions; permission-aware footer and navigation work.
- [ ] Incomplete review has exact fix links but no usable approval; zero-access complete configuration applies without execution grants.
- [ ] Unsaved/saved/new/applied/Archived discard, cancel/stale/unauthorized/audit-uncertain states retain precisely the required identity/values/current authority.
- [ ] Successful guard save navigates once and survives reopening; failure keeps safe work and no false success.
- [ ] Actual desktop/narrow/enlarged screenshots, focus/error clearance, keyboard/history and current Settings/SMTP patterns remain conformant.

## Required Validation

Reuse test/console-services.test.ts, console-services-http.test.ts, console-settings.test.ts and service/readiness/navigation/review browser harnesses. Extend direct API negatives and restart/storage fixtures only where changed. Preserve prior originating-screen export confirmations, Activity actor email and shared-header behavior; qualify the required guard-save repair.

Run `npm run build` and focused `npx vitest run <affected files> --maxWorkers=2`; extend existing meaningful tests instead of creating a quota. Every new external input has positive and negative cases. Reuse isolated synthetic HTTPS browser harnesses; no live-instance stores or real secrets, suppress Playwright request call logs. Inspect rendered captures against current approved references and delta, including roles, exact issue navigation, focus/reflow and uncertain failure.

Full suite `npm test -- --maxWorkers=2`, build and joined UX9 browser qualification are due once at status.yaml#regression_checkpoints.UX9-INTEGRATED after both milestones before deployment/final packet acceptance. Run full suite with frozen sources and no concurrent browser/Docker work. First confirmed unexpected out-of-area regression broadens focused checks; second distinct regression/spread requires full regression after repairs. Preserve assertions/timeouts and rerun listen-EPERM with loopback permission. Conditional downstream transport changes require actual self-signed HTTPS; changed recovery/launcher boundaries require existing Docker/recovery gates. No external LLM integration change is planned. Do not add prose-presence tests.

## Known Risks / Deferred Work

Current/live state must not be confused with proposed settings; independently changed values and assignments survive discard/import retirement. Durable compatibility mechanisms are delegated only where representation actually changes. No required outcome deferred; remote client qualification remains outside this bounded delta.

## Readiness checks

- `PRE-066` — Current validated UX9 package/source hashes and approved UX manifest match; verify before creating the milestone plan.
- `PRE-067` — Node >=22, OpenSSL and locked packages are available; clean setup uses `npm ci`. Verify `node --version`, `openssl version` and `npm ls --depth=0`.
- `PRE-068` — Existing synthetic HTTPS browser harnesses and declared Chromium or pinned Playwright 1.64 Docker image provide disposable local qualification; build before browser execution. No real accounts or deployment stores required.
- `PRE-069` — Status dependencies are complete before starting this outcome; M35/41/45/46 verified complete.
- `PRE-070` — Focused assertions and rendered visual evidence are produced by this milestone; UX9-INTEGRATED owns the final frozen-source bounded-worker full suite/build and joined qualification. These acceptance checks have not run during readiness.

Preconditions are the authority/runtime/browser facilities above and the declared completed providers. No bootstrap feature or Milestone 0 is required.
