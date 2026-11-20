# Milestone 54: Change the public MCP service reference without changing managed identity

## Objective

Deliver real public-reference editing as one vertical state, runtime, UI and recovery outcome. Its substantial routing/revocation/compatibility risk is separate from M53's ordinary review repair; no unusable persistence-only foundation.

## User/System Outcome

Owners/Administrators can review and apply a new MCP reference while credentials, assignments and history remain attached to the same managed service. Clients receive clear disruption guidance and old authority cannot survive rename or name reuse.

## Scope

Details purpose/origin/current-versus-proposed copy; Active warning/unlock and Inactive editing; draft namespace claims; reviewed atomic publication; stable internal identity and reference invalidation; compatible migration/history/delete/import/export/backup/restore and unknown-outcome handling.

## Explicit Exclusions

No alias, automatic client migration, display-name-only substitute, permanent name reservation/unbounded ledger, authentication redesign, changed destination/rule/credential IDs, orphan cleanup, broad lifecycle redesign, SMTP timing change, live instance deployment or new tools. Preserve independent value/current access actions and accepted SEC-DEF-001.

## Source Requirements

Ready UX12 package payload428bae3/closeout077b71b; full PRD CONFIG-06 plus CONFIG-01/03/05, BASE-01, AUTHZ-02, MIGRATE-01/03/04, BACKUP-01/05, AUDIT-01; full STATE-12/SECRES-11 and inherited STATE-11/SECRES-10 deletion fences. REC-RM-070 adopted from REC017; REC-076 provenance only; PO-FB294–298. Coverage UX12-C03–06 and ACT-152–154.

## Preconditions

M53's safe review-entry contract is consumed by the new reference proposal. Existing M48 independent imports, M50 removal intent, M51 permanent deletion and M52 shared Access remain mandatory preservation boundaries. Published UX12 source and existing recovery facilities must be available.

## Functional Requirements

1. Separate real case-sensitive public routing key from stable managed identity/incarnation owning management routes, credentials, grants and historical attribution. Explain manual user-chosen origin and imported YAML key/collision allocation accurately; distinguish current/proposed copy.
2. Inactive editable targets show a field. Active targets start locked; adjacent Change reference opens an accessible warning naming client breakage and invalidated service/credential/response references. Confirm only unlocks; Cancel changes nothing. Archived/read-only restrictions and Guided/Advanced/direct-call parity apply.
3. Save stages the complete proposal and reserves only accepted pending claims; typing reserves nothing and never changes routing. Review shows exact old/new key and disruption. Cancel/discard preserves current binding and releases only pending claims. Apply publishes atomically. Already-published Inactive reference-only Apply stays Inactive; never-published first Apply activates under existing gates. Other changes retain existing lifecycle rules.
4. Preserve unchanged valid legacy keys exactly. New/edited keys use existing 1–80 ASCII alphanumeric/dot/underscore/hyphen syntax starting alphanumeric; no trim/case-fold/truncation. Own-property-safe uniqueness includes all retained current lifecycles and accepted saved proposals. Recheck save/review/Apply and concurrent/batch collisions; never overwrite.
5. Successful rename releases old key without alias. Deliberate released-key selection including explicit YAML key is fresh routing with client-impact disclosure; automatic suffix allocation skips retired keys known in bounded retained history. No permanent reservation; revocation fences survive history expiry.
6. Bind acknowledgment/review to actor/session, stable incarnation, exact old/new key, proposal generation/content, namespace/dependency revision, lifecycle and security exceptions. Publish old-route removal/new binding plus settings in one admitted transaction preserving values, live grants and cleanup intent. Inactive publication creates no executable route. Audit stable target and non-secret old/new keys.
7. Resolve current public key to stable identity and eligibility before destination/policy/substitution. Revoke configured service/credential and response references, fence both binding generations, recheck queued calls before dispatch. Captured in-flight protection remains but cannot mint usable revoked references. Reuse cannot inherit tokens/grants/queued or response authority; preserve live broker/scanner/limiter ownership.
8. Audit admission failure changes nothing. Admitted uncertain publication fences affected execution; inspect/reconcile coherent old/new state against original incarnation, never independently replay rename onto replacement. Stale delete/archive/history/editor actions cannot resurrect old routing or mutate replacement.
9. Introduce monotonic reader boundary before new durable semantics; deterministic legacy migration preserves existing public keys/values/grants without activation. All writers and restore preserve newer formats. Owned encrypted recovery preserves identity/reference relationship, excludes local replay authority, assigns fresh incarnations and recovered-Inactive/review gates. Ordinary history-as-draft checks current namespace and review.
10. Sanitized YAML exports applied public keys only, not pending edits/internal authority. Reimport remains independent collision-safe identities with no reused target credentials/grants. Current service detail/access/activity/export/delete remain reachable through stable identity after rename; retained audit labels stay historical.

## UX Constraints

UX-G13, UX-IN28, UX-C96/97 and inherited accessibility/dialog/visual rules govern. Preserve shared Details width, grouped exact review and typed destructive tasks. Active warning is an unlock step, not immediate Apply; incomplete, stale, collision, read-only, empty and unknown states remain explicit. Use inherited approved appearance references, not historical screenshots as proof of newly editable behavior.

## Architecture / Security Constraints

Full STATE-12 and SECRES-11 are mandatory, including current role/CSRF/audit on direct calls, namespace/incarnation/uncertainty/reuse fences, exact independent action timing and old-reader/recovery safeguards. A public name is not a grant. No raw credential, opaque token, cookie or header logging. Preserve existing immutable identity/history-scope and deletion/cleanup protections.

## Interfaces and Compatibility

All five MCP tools retain their contracts while service key resolution changes coherently. Existing valid keys work unchanged after migration. Document client reacquisition/disruption with example.org only. Current owned configuration schemas, encrypted portable projection, imported independent allocation, applied-key YAML, history, management/API selectors and restart readers must agree. Unsupported old binaries fail closed before new semantics, not silently misroute. No routine container restart to activate a rename.

## Acceptance Criteria

- [ ] Active warning/cancel/unlock and direct Inactive edit stage the actual reference; Guided/Advanced and readonly negatives agree; exact before/after and current/proposed copy are clear.
- [ ] Save/cancel/discard do not change routing; atomic Apply preserves stable identity/values/current grants/removal intent; Inactive reference-only Apply stays Inactive and first activation remains intact.
- [ ] Exact valid/invalid/legacy/own-property keys, retained/pending/batch/concurrent collisions and released-name reuse obey namespace rules without overwrite or alias.
- [ ] Actual MCP discovery/request/policy/reference flows use the new binding; old configured/response/queued authority stays revoked through reuse, restart and history expiry; current eligibility enforced.
- [ ] Audit failure/uncertain publication reconcile coherent old/new target state without replay onto replacement; delete/archive/history and current management routes remain safe.
- [ ] Legacy upgrade/all writers/actual old-reader rejection, current backup projection and explicit newer-incarnation restore preserve relationships and recovery gates; applied-key YAML reimports independently.
- [ ] Actual full edit→review→Apply and client reacquisition plus stale/invalid/role/cancel/unknown paths satisfy visual/accessibility constraints and documented client impact.

## Required Validation

Reuse and extend affected existing service/draft/navigation/review, API authorization and browser harnesses before adding tests. Every changed external input needs meaningful positive and negative evidence. Run focused checks and build per behavior; no full-suite-per-milestone rule or prose-presence test quota. Use disposable synthetic HTTPS and suppress request credential/header logs. Compare actual matching runtime screenshots to the UX12 manifest and retained approved service/modal references at1440,390 and320px with200% text; inspect images, keyboard/focus, document and text-range overflow, footer clearance, loading/error/read-only/unknown states. Source inspection or screenshot existence alone is not visual acceptance.

The separate **UX12-INTEGRATED** checkpoint covers M53/M54 before final acceptance/deployment: one clean frozen tracked-source `npm test -- --maxWorkers=2`, whose pretest build satisfies the build gate, with no concurrent Docker/browser workload. Final-source browser evidence from the existing source-in-Playwright harness may be reused when still current. After the stable suite, build one exact candidate application Docker image and reuse it for mandatory affected recovery/launcher drills and relevant restart/backup/restore qualification. Retain actual prior-reader checks at changed boundaries; avoid repeated image builds and broad reruns. Actual self-signed HTTPS is mandatory if downstream transport changes. First confirmed unexpected out-of-area regression expands focused scope; a second distinct regression or further spread requires full regression after focused repairs. Targeted completion leaves broader qualification pending until this checkpoint passes.

M54 focused qualification must additionally cover changed storage versions/all writers, actual pinned prior-reader rejection, uncertain persistence/restart, queued/in-flight revocation, backup owned-schema projection and explicit restore. Reuse existing Docker launcher/recovery crash/clean-host harnesses at the affected boundaries on the final candidate image; no real downstream or LLM credentials required. Do not defer these safety obligations as optional merely because the visible change is a text field.

## Known Risks / Deferred Work

Public strings currently participate in runtime lookup, tokens and managed ownership; incomplete separation can misbind old authority or lose values. Compatibility/recovery and Inactive lifecycle are acceptance boundaries, not future work. No unresolved product decision or deferred required scope; mechanism/decomposition belongs to delivery.


## Readiness checks

- PRE-081: verify current definition-package artifact hashes and compiler PASS; no unresolved definition question.
- PRE-082: `node --version` satisfies package.json Node>=22; `npm ls --depth=0` succeeds; `openssl version` is available.
- PRE-083: `docker image inspect mcr.microsoft.com/playwright:v1.64.0-noble` and `docker version` succeed with authorized local Docker access; existing service browser and recovery harness paths are present. No containers are required merely to start implementation.
- PRE-084: inspect status.yaml completed M47–52 provider records and preserve their contracts.
- PRE-085/086: M53 accepted before M54; changed-format runtime/old-reader/recovery work and UX12-INTEGRATED remain consuming-milestone acceptance, not bootstrap prerequisites already passed.
