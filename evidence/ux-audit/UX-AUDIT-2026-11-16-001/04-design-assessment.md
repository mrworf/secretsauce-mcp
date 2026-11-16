# Product UX assessment — proposed direction, not new authority

Baseline: implementation 6810fe32ab0c461946a78751be82b7c21fedecd7, approved web-console-ux-6, current PRD, and separately identified confirmed/unpublished PO-FEEDBACK-2026-10-18-003. Canonical authority is unchanged. Runtime observations and coverage limits are in the adjacent audit manifest; root independently inspected Settings review/health and incomplete-service error/authentication captures.

## Priority recommendations

1. **Make correction specific.** Highest priority is helping a person finish configuration: identify actual blockers, affected section and relevant action together. A missing credential must not result in a checklist of every possible section. Apply the existing UX-IN01/15 correction obligation across Services and Settings; yellow section markers are newer confirmed owner direction, not retrospective approved requirements.
2. **Use one progression model.** Adopt the confirmed four-section creation/editing direction, with Continue progressing through configuration and final Review & apply opening real review. Overview review shortcuts must actually review ready drafts; incomplete drafts should explain what remains. Preserve direct navigation, safe unsaved work and browser history.
3. **Make decision information visible.** Settings security effects, audit retention and search need deliberate prominence consistent with the newer owner direction. Do not indiscriminately expand every advanced option into a longer page. Evaluate Limits subtabs and a search dialog as proposed mechanisms, not previously approved requirements.
4. **Align credential task presentation while preserving timing.** Metadata and explicit Set/Replace/Clear entry points can provide consistency across service and SMTP credentials. Preserve UX-EX03: SMTP Set/Replace follows draft/review/apply; service value mutations and SMTP deletion are immediate. A consistent dialog must never imply those operations have identical activation timing.
5. **Make transfer and history match current intent.** Downloadable sanitized YAML should support the existing import journey, with missing credentials and identity mapping explicit. Hide the history interface as confirmed; retain history, audit and revision-reuse capability. Do not confuse this transfer with a secret-bearing backup.

## Preserve and qualify

Retain current service review's first/default New settings tab, visible exceptions, explicit acknowledgment dialog, neutral scanning-override labels and focused rule editor. These offer useful patterns, not proof that every sibling surface conforms. Keep exact values, authorization and distinct immediate/draft actions. Do not infer that valid downstream credentials were tested merely because a value exists.

The source-confirmed generic failures and runtime examples support prioritization, but Product Reconciliation must classify divergences and adopt current owner intent before authoritative revisions or delivery planning. The audit remains an evidence report, not release acceptance. Any uncovered role, mapping, accessibility or comparison state remains explicitly unverified in coverage; no blanket conformance claim is made.
