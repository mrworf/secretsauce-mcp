# M45: Consistent editing actions

## Outcome and delivery context

Exactly M45 of fixed outer goal45–46; parent owns delivery status/goal. Start c7cbc03af18f4df7871017b5b552d149fd97923a. Current UX8 definition payload80edc3f and readiness-approved packet govern; contract delivery/milestones/secretsauce-mcp/45-consistent-editing-actions.md. No deployment or M46 work. Preserve unrelated untracked passwd/session/test-results without reading.

## Governing contracts and current findings

PRD CONFIG-02/03, POLICY-01, AUTHZ-02, UX-02/03/04; UX-IN20/21, R10/V10/A11/C72–74/78, retained UX-EX03; AGENTS and STATE/security contracts. Shared Settings currently renders both pending top bar and bottom footer; footer lacks always-present Discard. Service fieldsets exist but removal/status copy and boundary styling are unclear; policy help is duplicated. Existing backend mutations already separate draft placement and immediate stored values. No new external input/API/schema needed.

## Scope and decisions

Reuse existing guards, multi-form snapshots, dialog and style conventions. One coherent slice changes shared editing hierarchy and validates the combined user task; this avoids separate cosmetic commits without independent behavior. Discard exposes precise choices for unsaved versus saved work using existing backend deletion/confirmation, never reverses immediate actions. Service cards get scoped text removal and existing Add focus. Exclude Activity/export, data migration, permissions, policy evaluation, SMTP timing/protocol and broad refactors.

## Slice index

| Slice | Outcome | Dependencies | Status | Commit | Evidence |
|---|---|---|---|---|---|
| 01 | Clear consistent Settings/service editing with preserved state semantics | Completed M31/32/41/43/44 | complete | This slice commit | evidence/ux-acceptance/secretsauce-mcp/milestone45/acceptance.md |

### Slice01 contract

Implement in consoleSettingsPage, consoleServicePage and consolePresentation; extend existing populated-Settings and service browser harnesses where necessary. Acceptance: one persistent bottombar across editable Settings; unchanged/read-only/unsaved/saved/error states truthful; scoped discard preserves current settings and separate values; named bordered credential cards, exact metadata language, draft-only configuration removal; concise complete policy box and access wording; no loss of guided/history behavior. Reuse focused settings/service/HTTP/policy tests; actual synthetic HTTPS browser evidence for positive, cancel/invalid/read-only and multiple-form/card states. No source-text test quota.

## Cross-slice constraints and validation

No new schema or persistence. Current role/audit/dependency and unknown-state recovery retained. SMTP Set/Replace staged and Clear dependency-blocked; service values immediate. Never log secrets, headers, cookies or downstream bodies. Browser uses existing pinned Playwright1.64 Docker synthetic harness, no live mounts. Inspect screenshots desktop1440,390,320+200% text against applicable approved references; check document/text overflow, focus and footer obstruction. Build and focused Vitest only; parent owns full UX8-INTEGRATED after M46. First distinct out-of-area regression expands scope, second escalates full regression; current count0.

## Completion, rollback and execution

Finish all M45 criteria, record commands/results and image inspection, review owned diff and publish slice commit. Revert presentation code if required without rewriting managed state or reviving values/grants. No required M45 obligation deferred; final integrated qualification remains parent-owned. Plan persisted before production edits; execution evidence is recorded in the M45 acceptance report. Focused 40-test run, build and three synthetic browser scenarios pass. Narrow visual action squeezing was corrected before acceptance; no out-of-area regression.
