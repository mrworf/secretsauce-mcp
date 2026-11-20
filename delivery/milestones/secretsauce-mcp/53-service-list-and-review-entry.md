# Milestone 53: Find services and enter review without a stale-revision detour

## Objective

Complete the ordinary Services→review journey with aligned lifecycle rows and a narrowly proven automatic revision refresh. These small related service-workflow repairs share browser and preservation gates and do not warrant separate milestones.

## User/System Outcome

Administrators can locate any lifecycle consistently and enter actual complete or incomplete review directly. Genuine conflicts and uncertain writes remain explicit and safe.

## Scope

Shared lifecycle row tracks; Overview/footer review parity; one-shot safe shared-revision refresh; exact missing-credential blockers; preservation of local work, current access and existing approval boundaries.

## Explicit Exclusions

No public-reference editing (M54), blind generation reload, last-writer-wins, automatic Apply, changed permissions, format redesign, or new lifecycle behavior. Preserve all completed M10–52 functionality and SEC-DEF-001.

## Source Requirements

Ready UX12 package payload428bae3/closeout077b71b; PRD CONFIG-01/03/05, UX-03/04; STATE-12 review refresh and SECRES-11; REC-RM-068/069 adopted from REC017 (REC-074/075 evidence only); PO-FB290–293. Coverage UX12-C01/02 and ACT-150/151.

## Preconditions

Completed M52 provides shared unsaved Configuration/Access and guarded history on existing M47 draft generations/review/discard. Consume that complete proposal contract, not separate snapshots. Environment readiness remains separate.

## Functional Requirements

1. Corresponding name/lifecycle/Draft/action columns align across Active/Inactive/Archived rows despite longer actions; preserve full labels, linked settings and separate authorized actions, with coherent narrow stacking.
2. Overview and editor/footer enter the same actual review. For stale shared revision, freshly authorized reads prove same managed identity/incarnation and exact saved-draft existence/generation/content/removal intent, or same applied baseline for unsaved work. Numeric generation alone is insufficient.
3. Retain local Guided/Advanced content, edits made during awaits, removal intent, selected tab and location-only history. Freshly inspect independent credential availability/current grants and reconcile grants without replaying snapshots. Their independent changes are not automatically proposal conflicts.
4. Only a proven unchanged eligible baseline may update the dependency baseline and retry ordinary save/inspect/review once. Changed/applied/discarded/deleted/recreated proposals, competing edits, lost permission, generic network failure and unknown writes preserve work and established recovery. Never retry approval/Apply or reuse acknowledgments.
5. Missing values show precise Authentication blockers/fix links in normal incomplete review; no activation authority until current dependencies validate. Correction then gets fresh review.

## UX Constraints

UX-G13, UX-IN28 safe-review clause, UX-R14 and UX-C94/95 govern shared list/review patterns. Preserve established modal/form/list family, service footer and focus-return rules. No intermediate reload click for the safe case; no hiding true conflicts to mimic success.

## Architecture / Security Constraints

STATE-12/SECRES-11 constrain baseline proof, ABA and independent authority. Existing authorization/CSRF/audit, incomplete-review token absence, cleanup intent and current-grant boundaries stay intact. No new approval authority from reads or safe refresh.

## Interfaces and Compatibility

Existing MCP/runtime behavior unchanged. Browser/API support needed for trustworthy baseline comparison may change only within current authorization and exact-proposal semantics. No storage format change assumed for this outcome.

## Acceptance Criteria

- [ ] Mixed lifecycle rows align at desktop and retain readable full actions and keyboard reachability at narrow/enlarged text.
- [ ] Both review entries recover an unrelated shared revision once and show normal review with local edits intact, including edits during the fresh read.
- [ ] Missing credentials yield exact actionable incomplete review with no usable approval; independent value/grant changes are freshly reflected.
- [ ] Apply/discard/recreate ABA, real competing edits, role loss, network and unknown mutation cannot trigger overwrite/retry or stale approval; history, Advanced and current grants remain coherent.

## Required Validation

Reuse and extend affected existing service/draft/navigation/review, API authorization and browser harnesses before adding tests. Every changed external input needs meaningful positive and negative evidence. Run focused checks and build per behavior; no full-suite-per-milestone rule or prose-presence test quota. Use disposable synthetic HTTPS and suppress request credential/header logs. Compare actual matching runtime screenshots to the UX12 manifest and retained approved service/modal references at1440,390 and320px with200% text; inspect images, keyboard/focus, document and text-range overflow, footer clearance, loading/error/read-only/unknown states. Source inspection or screenshot existence alone is not visual acceptance.

The separate **UX12-INTEGRATED** checkpoint covers M53/M54 before final acceptance/deployment: one clean frozen tracked-source `npm test -- --maxWorkers=2`, whose pretest build satisfies the build gate, with no concurrent Docker/browser workload. Final-source browser evidence from the existing source-in-Playwright harness may be reused when still current. After the stable suite, build one exact candidate application Docker image and reuse it for mandatory affected recovery/launcher drills and relevant restart/backup/restore qualification. Retain actual prior-reader checks at changed boundaries; avoid repeated image builds and broad reruns. Actual self-signed HTTPS is mandatory if downstream transport changes. First confirmed unexpected out-of-area regression expands focused scope; a second distinct regression or further spread requires full regression after focused repairs. Targeted completion leaves broader qualification pending until this checkpoint passes.

## Known Risks / Deferred Work

Primary risk is confusing a shared revision with a changed proposal; explicit identity/existence/content/generation proof is required. No deferred required work. M54 later adds routing semantics and must preserve this review contract.


## Readiness checks

- PRE-081: verify current definition-package artifact hashes and compiler PASS; no unresolved definition question.
- PRE-082: `node --version` satisfies package.json Node>=22; `npm ls --depth=0` succeeds; `openssl version` is available.
- PRE-083: `docker image inspect mcr.microsoft.com/playwright:v1.64.0-noble` and `docker version` succeed with authorized local Docker access; existing service browser and recovery harness paths are present. No containers are required merely to start implementation.
- PRE-084: inspect status.yaml completed M47–52 provider records and preserve their contracts.
