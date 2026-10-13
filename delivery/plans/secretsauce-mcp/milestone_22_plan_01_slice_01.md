# M22 slice 01: Shared plain-language shell and accessible field conventions
## Goal and scope
Shared plain-language shell and accessible field conventions. Product secretsauce-mcp. Governing contract: delivery/milestones/secretsauce-mcp/22-readable-forms-and-services.md; UX3 UX-IA08/IN11/R05/A06/V05/C37/C41/C42; docs/web-console-prd.md UX-02/03/04 CONFIG-01; AGENTS.md. Parent 6f4cb32; unrelated test-results/ excluded. Autonomous M22 only within root goal M22–24. No schema, authorization, stored-state or gateway changes; preserve exact literals and existing save/review behavior. Never touch running review instance.

Excludes account editing and populated Settings lifecycle/SMTP. Dependencies: none.
## Entry and behavior
Existing console routes and form controls retain their handlers, state and permissions. Present current labels, required cues and short help; preserve values and guards across navigation. Normal-flow responsive composition, no clipped capabilities.
## State and authorization
Presentation-only. Existing API authority, draft review and immediate secret actions unchanged. Errors preserve safe work and clear secret inputs where current contract requires.
## Implementation surfaces
src/consolePage.ts, src/consoleServicePage.ts helpers, relevant ordinary-copy/search sites, focused tests.
## Validation and recovery
Verify required and optional/conditional fields, labels/help association, no secret values in generated help, old search aliases and permission behavior; build and focused unit/browser checks. No tests weakened. Listener EPERM requires same-command permission rerun. Required indicators must not alter optional validation. Capture sanitized synthetic evidence only.
## Acceptance
Every scoped observable behavior passes positive and negative checks; retained functionality reachable; no material approved visual drift remains. Required tests pass.
## Commit boundary
One coherent commit including implementation, focused tests, this plan and evidence. Status completed; commit is the introducing Git commit for this completed slice (exact SHA is recorded in the next slice/root checkpoint).

## Evidence
`npm run build` passed; `npx vitest run test/console-settings.test.ts` passed 12 tests. Actual isolated HTTPS `verify-console-focused-settings-browser.mjs` passed including required/optional controls, old alias search, roles, safe navigation, document and text-range reflow at 320px and 200% text. Report: evidence/qa/secretsauce-mcp/milestone22/shared/focused-settings-browser-report.json. No new input schema or state migration.
