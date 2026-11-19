# Milestone 52: Configure service access in one consistent place

## Objective

Make the existing service setup and maintenance journey consistent across never-activated and applied services. Consolidate its small form-width, policy-help and quoted-deletion presentation repairs with the shared Access relocation; no new authorization or lifecycle model.

## User/System Outcome

An administrator finds assignments in Access, understands whether they are proposed or current, and can move between configuration and access without losing work. Authentication uses the normal editor width; policy help and permanent-delete instructions are clear.

## Scope

Dedicated Access for initial and current assignments; shared complete unsaved/saved proposal and action bar; Request rules section without duplicate access controls; relocated nonblocking advisory; service Authentication geometry isolated from compact identity forms; redundant Allow/Deny helper removal; exact quoted typed-deletion challenge.

## Explicit Exclusions

No new grants, roles, authentication, automatic persistence, mapping flow, state format, storage redesign, permanent-delete semantics, credential cleanup semantics, SMTP timing changes, transport changes or deployment. Completed M10–51 remain preservation scope. Accepted SEC-DEF-001 remains; do not claim universal secret non-exfiltration.

## Source Requirements

Current validated UX11 package `workflow/definition/definition-package.yaml` (payload681b718, closeoutf6443a5) and its exact indexed sources govern. PRD CONFIG-01/02/03/05, AUTHZ-01/02, MIGRATE-01, POLICY-01, UX-02/03/04. Adopted REC016 report outcomes REC-RM-064–067 cover all PO-FB-282–289; findings REC-070–073 are provenance only. UX11 supersedes only the specified presentation/placement rules, not prior timing or access invariants.

## Preconditions

M47 provides shared service draft/review/discard and guarded history; M48 provides independent empty-access imports; M49 provides compact identity form and shared form presentation; M51 provides the current typed Archived deletion. These completed contracts are consumed, not reimplemented. Current UX11 package and accepted risk remain available; environment readiness is a separate audit.

## Functional Requirements

1. Configuration has Details, Destinations, Authentication and Request rules. Remove its Access card, selectors and redirect to the parent Access tab, including read-only grouping. Preserve all policy functionality and exact Advanced fields.
2. Never-activated Access shows Proposed access using eligible identities and the shared Discard/Save for later/Review changes bar. New unsaved setup can open it without a durable record. Configuration and Access share one proposal; tabs, mode changes, review/back and browser history preserve fields and selections. Invalid Advanced text remains recoverable; no lossy mode conversion. Existing dirty guards and location-only history remain.
3. Initial grants become effective only with successful reviewed first Apply under current eligibility/dependency checks. Empty access is valid and grants nobody execution. Imports remain initially empty with no mapping task; any legacy pending-selection reset explanation is in Access. Save validates the complete draft without requiring every tab to be visited.
4. Services with applied configuration, including Inactive services, display actual assignments and retain immediate separately confirmed Give access/Remove access. Configuration drafts and historical/Advanced snapshots cannot replay or undo assignments. Archived, restricted and read-only behavior remains unchanged.
5. Put the distinct accessible no-access advisory on Access, reflecting initial proposed selection or actual current assignments. It is not a Configuration/Request rules error, activation blocker or extra acknowledgment. Actual invalid configuration retains precise error markers/fix links. Review summarizes rather than edits assignments.
6. Service Authentication occupies the available sibling editor column for no-auth, missing-value, populated and multiple-credential states. Preserve compact sign-in and Replace authenticator, credential dialogs/cards and footer clearance.
7. Quote the exact displayed permanent-deletion challenge and clarify that surrounding delimiters are not input. Preserve literal punctuation, embedded quotes, case and whitespace; no trim/normalization or matching change. Keep target/session/Archived gates, Cancel and unknown/stale outcomes.
8. Remove Choose Allow or Deny beneath Default policy and equivalent Add/Edit controls only where that redundant helper appears. Retain label/options, fallback/mixed-effect/priority explanations, overrides and tester.

## UX Constraints

Use `product/ux/00-overview.md` UX-G12, `01-information-architecture.md` UX-IA09/10, `02-interaction-patterns.md` UX-IN25/27, `03-responsive-and-platform.md` UX-R05/R11/R12/R13, existing visual system and accessibility dialog/focus rules, UX-EX03, checklist UX-C90–93. Preserve the approved service/tab/card/modal family and manifest references. Actual matching1440px,390px,320px with200% text must show readable labels, useful width, no text-range overflow and focused controls above the footer. Compare Authentication edges to sibling panels, not merely screenshot existence. Preserve compact identity forms at ultrawide width. Loading, failure, empty, read-only, stale and unknown states must retain truthful context and safe work.

## Architecture / Security Constraints

STATE-01/02/10/11 and SECRES-09/10 remain unchanged. Current authorization and CSRF apply to every mutation; no UI-only permission control. Initial reviewed grants and immediate existing access are separate ownership boundaries. Recheck eligibility and stale dependencies; maintain revocation/reference invalidation, audit admission and uncertain-state handling. Never log secrets, headers or opaque tokens. Direct unauthorized/invalid calls must remain rejected.

## Interfaces and Compatibility

Preserve existing service draft/import/review/access/deletion API and stored semantics. Browser navigation may change presentation locations without forced saves. Existing valid imported identifiers/literals and Advanced access behavior remain lossless. No format upgrade is assumed; any necessary persistence/recovery change requires explicit compatibility validation under existing authority rather than an unplanned semantics change.

## Acceptance Criteria

- [ ] New unsaved, saved initial and imported services use one dedicated Access editor; tabs/modes/review/history retain all safe work, including invalid Advanced text, without forced creation.
- [ ] Initial selected access is reviewed and activated atomically; valid empty access applies but execution remains denied. Current applied Active/Inactive access changes immediately and is not reversed by draft Apply/discard.
- [ ] Role/read-only/Archived, stale identity/dependency, audit failure, guard Cancel/Save/Discard and unknown outcomes preserve existing safety and recovery behavior.
- [ ] Configuration/read-only Request rules has no duplicate Access controls or redirect; advisory is nonblocking and reflects the correct access source.
- [ ] Service Authentication matches sibling editor width across required states/viewports while compact login/replacement is preserved; footer and keyboard focus remain reachable.
- [ ] Quoted challenge is unambiguous for exact, embedded-quote and long values without changing server comparison or deletion gates; redundant policy helper is absent with meaningful help intact.

## Required Validation

Reuse/extend affected console-services, services-http, service-navigation, service-review/approval, migration/import and permanent-deletion coverage; select files by actual changes. Existing focused service/editor/help/shared-task browser harnesses cover disposable HTTPS journeys. Add meaningful positive/negative cases for any new external input; no test-count or prose-presence quota. Run build and focused checks per behavior; use authorized loopback permissions rather than weakening listener tests.

Capture and inspect actual browser states against UX11 plus retained approved references: new→Access→Configuration→Advanced→Access→review→first Apply, empty import, applied immediate assignment while a draft exists, read-only, quoted deletion, matching width states and compact identity forms. Exercise keyboard, Back/Forward, guard outcomes, enlarged text and document/text-range overflow.

Separate **UX11-INTEGRATED** checkpoint covers M52 before deployment/final acceptance: frozen tracked-source full suite with maxWorkers2 and build, no concurrent browser/Docker workload; joined service Access/review/current-action and visual qualification may reuse final-source focused evidence. Changed transport requires actual self-signed HTTPS; changed storage/recovery/launcher boundaries require existing compatibility/backup/restart/Docker gates. Do not rerun unaffected recovery merely for UI changes. First unexpected out-of-area regression expands focused checks; a second distinct regression or spread requires full regression after repairs. Targeted acceptance is not release qualification.

## Known Risks / Deferred Work

Risk is losing unsaved proposal state while moving the first-activation controls or accidentally treating current grants as draft fields; test those boundaries explicitly. Shared CSS must not spread short-task constraints to service editors. No deferred required scope, product question or new approval. Implementation decomposition remains the delivery companion's responsibility.

## Readiness checks

Preconditions PRE-076–080 in `delivery/readiness/secretsauce-mcp/prerequisite-manifest.md` apply: published source and completed M47/48/49/51, Node>=22 with locked dependencies/OpenSSL, disposable browser facilities and consuming-milestone qualification.

- Inspect the current package/source hashes and completed dependency records in status.yaml; require equality to the published UX11 source and no unresolved product decision.
- `node --version`, `npm --version`, `npm ls --depth=0`, `openssl version` — Node meets package.json and declared dependencies/OpenSSL are available. Fresh provisioning uses `npm ci` from the lockfile.
- `docker image inspect mcr.microsoft.com/playwright:v1.64.0-noble --format '{{.Id}}'` — declared existing image available; no container/service is started by this check. A clean host explicitly provisions this image or the documented matching browser installation, not an undeclared cache.
- Inspect existing service/browser harness paths and the UX11-INTEGRATED checkpoint; require disposable synthetic HTTPS, writable temporary evidence, authorized loopback and no real credentials/live state mounts. Implementation owns new behavior assertions and visual comparison, not readiness.
