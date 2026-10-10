# M13 slice 02: Shared inherited response protection settings

Status: completed. Parent: 698b051634fb156679defbed85793296447ab2f3. Commit: resolve from history by unique slice subject.

## Goal and behavior

Author both scanner catalogs in a single Settings location through a base/generation/actor/dependency-bound draft/review/apply transaction. Prepare validated immutable catalogs before commit; keep live pool identity and capture tokenizer configuration at admission. Persist managed catalogs and prefer them over host environment on restart. Admin can edit scanning; Member cannot read global configuration.

## Scope and ordering

Own only this behavior and required validation/docs. Depends on completed slice 01. No later milestone activation or upstream authority mutation.

## Entry points, transitions and authorization

Console same-origin authenticated/CSRF API and corresponding UI. Every write rechecks current Owner/Administrator authority and durable audit. Reads use existing role scopes. Draft saves do not alter applied state. Review binds actor, base, generation and dependencies; apply prepares candidate then atomically installs and publishes committed state even uncertain completion. Invalid/stale input preserves current state and gives sanitized correction/reload guidance. History/import never recreate access or secrets.

## Investigation and implementation surfaces

src/secretRuntime.ts, src/responseTokenizer.ts, src/consoleServices.ts, src/consoleStore.ts, src/consoleHttp.ts, src/consolePeoplePage.ts, src/types.ts, new configuration module and tests. Reuse existing schema/normalizers and runtime semantics; inspect constructor/publication seams before editing. Resource bounds must reject oversized work rather than silently alter expressions.

## Validation and acceptance

Positive/negative catalog extend/replace/options/pattern/exclusion/allow inputs; unknown fields, malformed/oversized/deep inputs, invalid regex; Admin allowed, Auditor read-only, Member denied; stale base/demotion/failure and admitted scanner preservation.

Focused command: npx vitest run test/console-advanced.test.ts (and affected subsystem tests as added). Build: npm run build. Final slice: npm test and actual browser harness, with exact outcomes recorded here. Acceptance requires all named positive/negative boundaries and contract outcomes.

## Commit boundary

One explicit owned-path commit including this plan, governing index, behavior, tests and direct docs/evidence. Subject: delivery: M13 slice 02 shared inherited response protection settings. Never stage test-results/. Exact previous SHA recorded in next slice; own SHA resolved through Git history/root checkpoint.

Validation: build passed; 43 tests/5 affected files passed with loopback permission after same-suite EPERM. Added actual dispatched-response test: changing global sensitive-name matcher retained old response protection and pool identity. Pending preview draft-save/access-remove/disable tests reject changed source. Effective preview contains resolved catalogs/source and rule exceptions.
