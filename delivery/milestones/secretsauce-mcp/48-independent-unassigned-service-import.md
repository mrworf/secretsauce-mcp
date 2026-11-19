# Milestone 48: Import separate unassigned services and retire legacy mappings safely

## Objective

An import creates independent clearly named service drafts without touching existing services. Administrators use ordinary access selection, can activate with nobody assigned, and can recover old unresolved imports without reupload or accidental grants.

## User/System Outcome

An import creates independent clearly named service drafts without touching existing services. Administrators use ordinary access selection, can activate with nobody assigned, and can recover old unresolved imports without reupload or accidental grants.

## Scope

Fresh import ID/name allocation, source-to-target credentials, empty access, source mapping retirement, old pending-import transition and the complete import/edit/review/apply journey.

## Explicit Exclusions

No retrospective clone/rename of old records, implicit grants, identity-mapping replacement wizard, unrelated scanner/import-format redesign, credential cleanup or overwrite option. Preserve current global/catalog proposal permissions.

## Source Requirements

MIGRATE-01/02/03/04, AUTHZ-02, CONFIG-01/03/05; REC-RM-057; S9-03/04/05, STATE-10, SECRES-09; UX-IN24/C83. Feedback250/251/253–255/263–264;251 mandatory-mapping idea is superseded.

## Preconditions

M47, M42 supplies the existing review/navigation/footer/transfer contract consumed here. Current validated UX9 package and readiness-approved planning must precede implementation. `PRE-066` supplies current source authority; `PRE-067/068` supply locked runtime and synthetic HTTPS facilities; `PRE-069` requires the listed provider milestones completed before entry. `PRE-070` remains consuming-milestone acceptance work, not a prerequisite to beginning implementation.

## Functional Requirements

- Every source service imports as a separate managed identity; never choose existing active/inactive/archived/draft by ID or name. Validated unused source ID may be retained; otherwise allocate a new stable local ID. Preserve exact credential IDs/policies/destinations and source-created correspondence.
- Free display name stays; collision uses Imported <source name>, then (2), (3), first available suffix against all retained services and batch. Bound name/ID allocation; atomically recheck current revision/reservations. Stale/concurrent/invalid input cannot partially replace existing services.
- Deliberately supplied values attach only to allocated targets. Imported source users/mapping targets create no grants; no host file/env reads. Initial proposed/current access is empty. Ordinary eligible selection is optional and fresh first activation review binds it; none is valid and nobody executes.
- Remove mapping UI/repeated warnings and prevent old mapping API inputs granting access. Existing unresolved imports remain editable/saveable without reupload; retire import-derived proposed authority at audited current mutation or controlled upgrade, never a mutating read.
- Never-active legacy proposals clear import-derived selections; ambiguous provenance resets only pending access to empty with visible notice. Preserve provable post-import selections subject to fresh eligibility/review. Applied records retain exact live assignments; preserve unrelated draft fields/values and historical identity, invalidate old reviews/generations coherently.
- Lost import response reconciles durable outcome before retry; no invented idempotent creation guarantee. Restore/old snapshot/readers cannot replay mapping authority or bypass existing recovery review. Preserve old-reader boundaries if representation changes.

## UX Constraints

Canonical UX9 manifest, UX-G10 delta precedence, UX-IN23/24, UX-R11/A12 and UX-C79–83 govern. Reuse approved warm-accent shell, white bordered cards, shared header and Settings persistent footer appearance. Preserve prior approved images unchanged; exact superseded controls/mapping/lifecycle text is governed by UX9 prose. Compare actual corresponding populated, incomplete, read-only, failure and recovery states at desktop1440, narrow390 and320CSSpx/200% text. Inspect document/text overflow, focused control/error clearance above footer, readable whole-word actions, modal focus return, direct sections and browser history. Functional PASS or screenshot existence alone is insufficient. No new theme, modal stack or broad Settings/Activity redesign. Preserve service-immediate values/access versus staged SMTP Set/Replace and independent guarded Clear.

## Architecture / Security Constraints

STATE-10 and SECRES-09 plus retained STATE-01/02/09 govern. Current authorization, target/base/generation checks and durable audit bind sensitive changes; fail closed on stale/uncertain authority and inspect durable outcome before retry. Never alter current live assignments, independent values/attribution, applied configuration or lifecycle through a proposal-only action. Never log/reveal raw credentials, Authorization, cookies, opaque proofs or downstream bodies. Own-property-safe exact identifiers and bounded imported input remain. Role alone never grants execution; preserve auth/destination/policy before substitution and stateless per-POST MCP for ChatGPT/Codex. SEC-DEF-001 remains an accepted best-effort scanner limitation.

## Interfaces and Compatibility

Existing gateway/catalog format semantics and Owner/Administrator global permissions stay. Source service ID remapping is intentional only for new independent imports. Retired mapping write requests cannot grant; reject explicitly. Carry bounded compatibility for old saved drafts/archives through exact owned paths and newer formats; changed storage readers must fail closed rather than silently revive mappings.

## Acceptance Criteria

- [ ] Same-ID/name collisions across every retained state and batch create separate named targets with independent supplied values; no existing draft/current grant/value modified.
- [ ] Fresh imports have empty access/no mapping; ordinary selection and zero-assignment apply are valid, yet unassigned identities cannot execute.
- [ ] Legacy unresolved proposals become usable without reimport; ambiguous pending reset is visible, explicit proved selections and all current live grants preserved.
- [ ] Stale/replayed/unauthorized/retired mapping/audit outage and uncertain writes fail safely; old reviews/snapshots cannot replay grant authority.
- [ ] Complete imported correction→review→apply and discard/navigation paths use M47 controls with actual matching visual/focus/reflow evidence.

## Required Validation

Reuse test/console-migration.test.ts, console-services.test.ts, console-services-http.test.ts and existing advanced/transfer/import-recovery browser fixtures; inspect actual repository names before execution. Cover boundary sizes, collision batches, typed mapping rejection, ordinary assignment eligibility, restart/restore when changed and exact independent-value preservation.

Run `npm run build` and focused `npx vitest run <affected files> --maxWorkers=2`; extend existing meaningful tests instead of creating a quota. Every new external input has positive and negative cases. Reuse isolated synthetic HTTPS browser harnesses; no live-instance stores or real secrets, suppress Playwright request call logs. Inspect rendered captures against current approved references and delta, including roles, exact issue navigation, focus/reflow and uncertain failure.

Full suite `npm test -- --maxWorkers=2`, build and joined UX9 browser qualification are due once at status.yaml#regression_checkpoints.UX9-INTEGRATED after both milestones before deployment/final packet acceptance. Run full suite with frozen sources and no concurrent browser/Docker work. First confirmed unexpected out-of-area regression broadens focused checks; second distinct regression/spread requires full regression after repairs. Preserve assertions/timeouts and rerun listen-EPERM with loopback permission. Conditional downstream transport changes require actual self-signed HTTPS; changed recovery/launcher boundaries require existing Docker/recovery gates. No external LLM integration change is planned. Do not add prose-presence tests.

## Known Risks / Deferred Work

Current/live state must not be confused with proposed settings; independently changed values and assignments survive discard/import retirement. Durable compatibility mechanisms are delegated only where representation actually changes. No required outcome deferred; remote client qualification remains outside this bounded delta.

## Readiness checks

- `PRE-066` — Current validated UX9 package/source hashes and approved UX manifest match; verify before creating the milestone plan.
- `PRE-067` — Node >=22, OpenSSL and locked packages are available; clean setup uses `npm ci`. Verify `node --version`, `openssl version` and `npm ls --depth=0`.
- `PRE-068` — Existing synthetic HTTPS browser harnesses and declared Chromium or pinned Playwright 1.64 Docker image provide disposable local qualification; build before browser execution. No real accounts or deployment stores required.
- `PRE-069` — Status dependencies are complete before starting this outcome; M42 verified complete; M47 is the earlier provider and must pass before M48 starts.
- `PRE-070` — Focused assertions and rendered visual evidence are produced by this milestone; UX9-INTEGRATED owns the final frozen-source bounded-worker full suite/build and joined qualification. These acceptance checks have not run during readiness.

Preconditions are the authority/runtime/browser facilities above and the declared completed providers. No bootstrap feature or Milestone 0 is required.
