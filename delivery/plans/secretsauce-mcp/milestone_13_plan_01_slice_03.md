# M13 slice 03: Explicit legacy migration and sanitized export

Status: planned. Parent: prior slice commit (record before implementation). Commit: resolve from history by unique slice subject.

## Goal and behavior

Accept gateway YAML and both catalogs with bounded parsing and field/source errors. Preserve supported global configuration in migration metadata for M14/M15 controls; never activate imported authentication/limits now. Explicit map imported subjects to known local IDs or registered exact issuer/subject; missing values/mappings remain inactive drafts. Deliberate write-only values only, no host file/env reads. Existing-service assignments/lifecycle and values remain current; no bulk activation. Export sanitized supported configuration/catalogs with missing-secret indication and reconnection warnings.

## Scope and ordering

Own only this behavior and required validation/docs. Depends on completed slice 02. No later milestone activation or upstream authority mutation.

## Entry points, transitions and authorization

Console same-origin authenticated/CSRF API and corresponding UI. Every write rechecks current Owner/Administrator authority and durable audit. Reads use existing role scopes. Draft saves do not alter applied state. Review binds actor, base, generation and dependencies; apply prepares candidate then atomically installs and publishes committed state even uncertain completion. Invalid/stale input preserves current state and gives sanitized correction/reload guidance. History/import never recreate access or secrets.

## Investigation and implementation surfaces

new migration module, src/config.ts, src/consoleServices.ts, src/consoleHttp.ts, console configuration tools and migration tests. Reuse existing schema/normalizers and runtime semantics; inspect constructor/publication seams before editing. Resource bounds must reject oversized work rather than silently alter expressions.

## Validation and acceptance

Positive full field/catalog import-export; negative unknown/malformed/oversized YAML/aliases/regex, email inference, file/env sourcing and prototype IDs; current eligible mappings, stale generation/rotation/disable/demotion fail; missing credentials block review and no live grants/auth activation.

Focused command: npx vitest run test/console-advanced.test.ts (and affected subsystem tests as added). Build: npm run build. Final slice: npm test and actual browser harness, with exact outcomes recorded here. Acceptance requires all named positive/negative boundaries and contract outcomes.

## Commit boundary

One explicit owned-path commit including this plan, governing index, behavior, tests and direct docs/evidence. Subject: delivery: M13 slice 03 explicit legacy migration and sanitized export. Never stage test-results/. Exact previous SHA recorded in next slice; own SHA resolved through Git history/root checkpoint.
