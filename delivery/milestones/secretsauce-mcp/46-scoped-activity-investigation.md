# Milestone 46: Investigate scoped Activity with reusable filters and relevant exports

## Objective

Deliver the complete shared Activity query-to-detail-to-export journey, with bounded expressive filters and unchanged evidence confidentiality/permissions.

## User/System Outcome

An evidence reader can combine literal inclusions/exclusions, use a fixed editable time range, inspect matching events and export the successful searched scope. Members can narrow only their own activity. Other evidence reports are discoverable with their subject.

## Scope

Shared main/per-service filter editor, server predicate validation/evaluation, scoped detail and export parity, time presets, duplicate modal, searched-versus-edited state, pagination and bounded export; relocate the existing three unrelated evidence exports to agreed destinations.

## Explicit Exclusions

No regex/query language, saved searches, autocomplete, new persistence/index, frozen result store/retention hold, event-card redesign, new roles or export formats. No changes to event retention, gateway transport, recovery or configuration transfer schema. No seventh top-level Settings section; Configuration tools is a task in the existing shell. Editing actions belong to M45.

## Source Requirements

Current validated UX8 package; PRD AUDIT-02.a/b, AUDIT-03/04, AUTHZ-02 and OPS-06; UX-IA12/IN22/R10/V10/A11. REC-RM-051/052 are adopted trace, REC-057/058 evidence. All PO-FB-216–237 dispositions preserved; 220 silent duplicates and223 all-filter AND are superseded. AF01–06 basis is provenance; canonical PRD governs semantics.

## Preconditions

Completed M15 evidence/roles, M42 existing configuration transfer tools and M43 guarded Settings navigation are consumed. No dependency on M45 is required; shared source files do not create one. Published current definition and readiness-approved planning precede implementation.

- PRE-061 — Current UX8 definition and approved visual references are available.
- PRE-062/063 — Declared runtime, installed packages and synthetic HTTPS browser facilities are available.
- PRE-064 — Listed dependency milestones are completed in the current checkout.
- PRE-065 — Focused and UX8-INTEGRATED acceptance remains owned by delivery, not readiness.

## Readiness checks

- Inspect `workflow/definition/definition-package.yaml` and current UX manifest revisions against the planning handoff; they must match.
- `node --version`, `npm ls --depth=0`, `openssl version` must resolve the declared runtime/dependencies and HTTPS certificate tooling.
- Inspect the named test/browser paths below and completed dependency records; all must exist. Use documented `npm ci` and `npx playwright install chromium` when provisioning a fresh checkout, or the pinned Playwright 1.64.0 Docker route recorded in readiness. No live credentials or review-instance mounts are needed.

## Functional Requirements

- Field/Comparison/Value/Add creates individually removable service, actor, action, requestID and recorded-result chips. All four comparisons supported. OR positive alternatives perfield, AND every exclusion veto, AND fields/time/hard scope; order irrelevant. Exact case-sensitive literal equality/substrings; no normalization or regex. Missing fields fail positives/pass negatives. Contradiction returns no matches.
- Reject duplicate field+exactvalue regardless of comparison, preserving existing chips/attempted input with small explanatory modal. Server also rejects; case-distinct and differentfield pairs remain distinct. Retain nonempty1024-code-unit/control bounds, at most32chips, strict field/operator validation, exactresult rules, legacy equals compatibility and reject conflicting legacy/chip representations.
- Presets fill explicit editable UTC endpoints once; inclusive/open bounds remain, invalid/reversed dates rejected. Search validates and resets paging. Clear removes userchips/time and refreshes from beginning without removing hard scope. Keep existing event cards/details, provenance, integrity and uncertain outcomes.
- Maintain successful searched criteria/count/results separately from edits. Show Filters changed — Search to update results and used criteria if different. Failed search never relabels prior results; page/export use successful criteria while preserving or guarding edits. Bounded-work failure is distinct from no matches.
- Per-service exact context stays visible and intersects query/detail/page/export; only explicit global navigation leaves it. Member own-actor scope remains outside Boolean logic; retain direct exact foreignactor/unassignedservice denials. Exclusions/substrings never enumerate or widen unauthorized data. Reauthorize every operation.
- Export activity by matching count uses successful searched criteria/context/offset against one current authorized snapshot, not frozen earlier rows. Label current retained matching events, startoffset,500row/2MiB cap and actual truncation; preserve page50/max100, offset100000 and scan100000/2s bounds. Sanitize nested filter metadata as well as rows; do not log rawchips. Audit/restricted/Member denials remain.
- Move Access inventory to People & Access, Configuration and exceptions to Settings Configuration tools, Software/job status to Health & retention. Preserve all existing evidence-role reachability, guards, data and formats; no new Settings write rights. Keep gateway YAML export clearly distinct and unrelated reports independent of Activity chips.

## Interfaces and Compatibility

Extend evidence input contracts compatibly with existing one-value equals clients. Shared selection semantics cover list/detail/export without unbounded work. No configuration/storage migration is required. Preserve sanitization and current audit/role gates on direct APIs, not only UI. Legacy inputs retain validation; mixed representations fail rather than silently merge. Existing download schemas remain except the necessary bounded criteria representation.

## Acceptance Criteria

- [ ] Truth-table fixtures prove positiveOR, negativeAND/veto, crossfieldAND, missing fields, literal case/metacharacters, contradictory queries and order invariance.
- [ ] Empty/control/oversize/unsupported/duplicate/33chip and mixed-representation requests fail safely;32valid and legacy equals work. UTC boundaries/presets/reversed/open intervals follow contract.
- [ ] Main/service/Member list,detail,Clear,paging and export share exact predicate/scope; role loss, forged context/detail, foreign exact selections and denied export cannot widen visibility.
- [ ] Edited/failed searches cannot retarget count or export; current-snapshot/offset/cap/truncation semantics are visible and nested secret-like input is sanitized.
- [ ] Three relocated reports remain reachable by Owner/Administrator/Auditor without mutation permission, absent from Activity, and retain audited download/denial behavior.
- [ ] Keyboard duplicate-modal/chip removal, focus return, loading/empty/errors and desktop/narrow/enlarged-text appearance satisfy UX8 while existing event cards remain.

Focused validation: reuse test/console-evidence.test.ts and console-evidence-http.test.ts plus directly affected navigation/Settings tests. Extend existing operations/advanced browser harness or a bounded shared Activity scenario using synthetic events. Cover positive and negative server inputs, authorization, nested metadata sanitization, exportbytes/caps and successful-search state; no real credentials or downstream bodies.

## UX Constraints

Canonical UX8 manifest and UX-G09 precedence govern the bounded change within the existing approved visual family. Use UX-IA12, UX-IN20–22 as applicable; UX-R10/V10/A11 and UX-C72–78 specify reflow, appearance, keyboard/focus and acceptance. Preserve unchanged UX7 shell, warm accent, white bordered surfaces, readable density and exact literals. Compare actual populated, empty/error, read-only and recovery states against the applicable approved references listed by the manifest; functional PASS or merely saving screenshots is insufficient. Inspect desktop1440px, narrow390px and320CSSpx with enlarged text, document width and text-range overflow. No new visual family, nested modal stack, clipped literal or focus-obscuring footer.

## Architecture / Security Constraints

Use current REC013 targeted architecture/security review sections and retained STATE-01/02/03/09, SECRES-07/08 and UX-EX03. Keep current server authorization, mandatory audit, exact-value sanitization, secret-free logs, coherent atomic application and current dependency checks. Service credential value actions remain immediate; SMTP Set/Replace remains pending review/apply and Clear independently dependency-blocked. Never expose/log raw credentials, Authorization, cookies, opaque tokens/proofs or downstream bodies. Preserve stateless per-POST MCP and ChatGPT/Codex contracts. SEC-DEF-001 remains an accepted limitation, not new work or a universal non-exfiltration claim.

## Required Validation

Reuse and extend existing focused tests/harnesses cited below; no new-test quota. Every new external input needs meaningful positive/negative tests. Run `npm run build` and focused `npx vitest run <affected files> --maxWorkers=2`; browser/visual evidence uses disposable synthetic HTTPS fixtures, never local review-instance mounts. Suppress Playwright request call logs and inspect images rather than only existence. No acceptance execution occurs during compilation.

Full regression is due at `status.yaml#regression_checkpoints.UX8-INTEGRATED` after M45/M46, before deployment/final packet acceptance. Focused completion is not broad qualification. First confirmed unexpected out-of-area regression expands focused scope; a second distinct regression or spread requires full regression after repairs. Preserve test assertions/timeouts; loopback EPERM requires rerun with permission. Conditional transport changes require real self-signed HTTPS and recovery changes require existing Docker recovery gates, although neither is in this scope. Do not add prose-presence tests.

## Known Risks / Deferred Work

Do not accidentally conflate draft persistence, active application and independent immediate operations. Existing authorized evidence entry points must survive role-specific navigation. No required outcome is deferred; implementation mechanisms remain delegated. External real-LLM qualification remains outside these presentation/evidence changes; local synthetic tests cannot certify remote ChatGPT/Codex connectivity.
