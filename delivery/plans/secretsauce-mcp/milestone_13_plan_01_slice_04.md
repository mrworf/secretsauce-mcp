# M13 slice 04: Last-50 configuration history and rendered acceptance

Status: completed. Parent: 5e3f0eb6efe4edb1dc0131e4120f0de05db266e6. Commit: resolve from history by unique slice subject.

## Goal and behavior

Capture sanitized applied configuration revisions with actor/time/change. Use as draft copies only permitted configuration and resolves current values/access/dependencies; reject missing credentials or removed services, preserve disabled lifecycle and require ordinary review. Finish field-coverage/migration/export/precedence docs and actual HTTPS browser keyboard/320px acceptance evidence for every required UX criterion.

## Scope and ordering

Own only this behavior and required validation/docs. Depends on completed slice 03. No later milestone activation or upstream authority mutation.

## Entry points, transitions and authorization

Console same-origin authenticated/CSRF API and corresponding UI. Every write rechecks current Owner/Administrator authority and durable audit. Reads use existing role scopes. Draft saves do not alter applied state. Review binds actor, base, generation and dependencies; apply prepares candidate then atomically installs and publishes committed state even uncertain completion. Invalid/stale input preserves current state and gives sanitized correction/reload guidance. History/import never recreate access or secrets.

## Investigation and implementation surfaces

src/consoleServices.ts, new configuration tools module/script, tests, docs, scripts/verify-console-advanced-browser.mjs, evidence/qa/secretsauce-mcp/milestone13. Reuse existing schema/normalizers and runtime semantics; inspect constructor/publication seams before editing. Resource bounds must reject oversized work rather than silently alter expressions.

## Validation and acceptance

Retention 50; secret/access/lifecycle/identity exclusions; Admin current scope, demotion/rotation/disable/deleted dependency races; full npm test and npm run build; rendered advanced-editor/search/preview/import/history/error keyboard and 320px checks; automated denied-request explanation under two minutes (not human study).

Focused command: npx vitest run test/console-advanced.test.ts (and affected subsystem tests as added). Build: npm run build. Final slice: npm test and actual browser harness, with exact outcomes recorded here. Acceptance requires all named positive/negative boundaries and contract outcomes.

## Commit boundary

One explicit owned-path commit including this plan, governing index, behavior, tests and direct docs/evidence. Subject: delivery: M13 slice 04 last-50 configuration history and rendered acceptance. Never stage test-results/. Exact previous SHA recorded in next slice; own SHA resolved through Git history/root checkpoint.

Delivered history retention50 and scoped current-dependency drafts; catalog-only history, redacted structural snapshot rejection, identity/credential generation races. Added guided canonical exact/prefix input guards, advanced HTTP authorization fixtures, and bounded asynchronous sensitive-name batches while preserving tolerant source offsets. Actual delayed-response admission and restart authority remain covered. Global Settings search matches nonsecret DOM labels/help and opens containing disclosures.

Validation: full npm test481tests/48files passed with loopback permission after original same-command EPERM; npm run build passed. Actual HTTPS Playwright6 task groups/eight320px screenshots pass; denial161ms (functional automation, not human study). Full acceptance mapping: evidence/qa/secretsauce-mcp/milestone13/acceptance.md. Field coverage and migration/export/precedence guide: docs/console-advanced-configuration.md.
