# M13 slice 01: Lossless service policy authoring and safe explanation

Status: completed. Parent: 4793f72a41f1ca6d51d00b623ffe2e7dc63bb564. Commit: resolve from history by unique slice subject.

## Goal and behavior

Extend the shared draft with exact/prefix/regex helpers, editable rule order/priorities/methods/hosts/reasons/exceptions/binary controls and an advanced JSON editor. Preview calls the shared destination and policy functions inside a bounded worker, validates the caller role and current identity eligibility, and reports canonical target and effective response protection without credential resolution or HTTP.

## Scope and ordering

Own only this behavior and required validation/docs. Depends on accepted M12. No later milestone activation or upstream authority mutation.

## Entry points, transitions and authorization

Console same-origin authenticated/CSRF API and corresponding UI. Every write rechecks current Owner/Administrator authority and durable audit. Reads use existing role scopes. Draft saves do not alter applied state. Review binds actor, base, generation and dependencies; apply prepares candidate then atomically installs and publishes committed state even uncertain completion. Invalid/stale input preserves current state and gives sanitized correction/reload guidance. History/import never recreate access or secrets.

## Investigation and implementation surfaces

src/basicPolicy.ts, src/config.ts, src/consoleServices.ts, src/consoleServicePage.ts, src/consoleHttp.ts, new bounded preview module and tests. Reuse existing schema/normalizers and runtime semantics; inspect constructor/publication seams before editing. Resource bounds must reject oversized work rather than silently alter expressions.

## Validation and acceptance

Round-trip every service field; positive/negative method/path/URL/identity inputs; canonical ambiguous encoding rejection; priority/deny/stable ties; malicious labels, oversized inputs and worker regex deadline; assert no credentials or downstream I/O.

Focused command: npx vitest run test/console-advanced.test.ts (and affected subsystem tests as added). Build: npm run build. Final slice: npm test and actual browser harness, with exact outcomes recorded here. Acceptance requires all named positive/negative boundaries and contract outcomes.

## Commit boundary

One explicit owned-path commit including this plan, governing index, behavior, tests and direct docs/evidence. Subject: delivery: M13 slice 01 lossless service policy authoring and safe explanation. Never stage test-results/. Exact previous SHA recorded in next slice; own SHA resolved through Git history/root checkpoint.

Validation: build passed; advanced/services/basic-policy/policy focused suite passed 18 tests across 4 files. Worker uses built shared modules; canonical npm test pretest builds them so clean-checkout execution is reproducible. Worker receives no saved values and has 4 slots/1-second deadline/32MiB old-generation bound. Current source fingerprint and permissions are rechecked after await. Effective catalog details follow slice02.
