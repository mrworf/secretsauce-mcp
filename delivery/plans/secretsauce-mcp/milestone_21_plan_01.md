# M21: Friendly configuration and lossless import

## Outcome and authority
All UX-IA06 capabilities use labeled controls and readable effective/review summaries, preserving exact same-draft semantics and existing advanced tooling. Governing contract: ../../milestones/secretsauce-mcp/21-friendly-configuration-and-import.md; product/ux/01-information-architecture.md UX-IA06; state/security contracts; AGENTS.md.

## Delivery goal
Product secretsauce-mcp; fixed M18–M21 goal, this transaction M21 only. Source/planning identity is pinned by workflow/delivery-planning/handoff.yaml and milestone status. Parent 631f866. M18–20 complete. Preexisting untracked test-results/ excluded. Root alone owns milestone status.

## Current state and decisions
Existing encrypted drafts, bounded schemas, importer and reviews remain authoritative. Service forms already cover many basic fields; catalog/rule options and mappings still require JSON. Reuse API contracts and create bounded typed controls rather than change semantic schemas. Import preserves supported legacy identifiers while new manual creation keeps restrictions. Read summaries show every supported value without exposing credentials. No new gateway features or upstream authority changes.

## Slice index
| Slice | Plan | Outcome | Dependencies | Status | Commit |
| --- | --- | --- | --- | --- | --- |
| 01 | milestone_21_plan_01_slice_01.md | Guided lossless import | M20 | complete | a2f42ab |
| 02 | milestone_21_plan_01_slice_02.md | Catalog and policy friendly editors | 01 | complete | c4eb4dc |
| 03 | milestone_21_plan_01_slice_03.md | Remaining capability summaries and browser acceptance | 02 | complete | pending final slice SHA |

## Cross-slice concerns
Preserve authorization, generation/revision/audit checks, write-only immediate actions, M20 atomic full-settings review, inheritance, exact regex/order/options and safe dictionary keys. No browser persistence. Host file/environment references never read. Bound recursive form construction and inputs to existing server constraints. Secret fields cleared after submission. No production deployment or user-instance access.

## Completion gate
Targeted positive/negative tests each slice, capability-level HTTPS browser tasks at desktop/320px/200% text with document/text-range checks, full npm test and npm run build. Evidence under evidence/qa/secretsauce-mcp/milestone21/. Record every UX-IA06 row. Existing gateway and security regressions stay passing.

## Rollback
UI changes retain compatible schemas and advanced tooling; imported drafts use existing persisted structure. Reverting UI must not revert users' configuration state.

## Execution notes
Planning self-check: three independently testable vertical outcomes; all slice plans persisted before production changes. No unresolved product questions.

### Acceptance reconciliation
All 20 UX-IA06 rows map to real control tasks, readable values and persistence/negative evidence in `evidence/qa/secretsauce-mcp/milestone21/capability-coverage.md`. M21's ten acceptance bullets map as follows: (1) guided import browser; (2) legacy ID import/edit/export/lookup tests; (3) exact local/external and disabled/email tests; (4) explicit env/file values/no rotation/no reveal tests and import browser; (5) strict malformed/alias/oversize/stale/role tests; (6) capability matrix and read-only browser; (7) exact regex/nested option/expert round-trip browser and direct tests; (8) bounded policy/option/limit negatives and prior atomic-settings tests; (9) write-only review/browser-storage assertions and inherited/effective summaries; (10) existing bounded server schemas plus typed-option bounds, keyboard/reflow/search/error evidence. No acceptance requirement deferred.

Implementation details: diagnostic info/debug stays inside the existing operating draft with an optional compatibility field; live logger configuration object and scanner pool retained. A dedicated guarded editor prevents its save from discarding unsaved audit-retention work. Search replays input entered before the async index completes. Legacy __proto__ was unsupported by raw schema and now fails explicitly; supported edge IDs remain exact. No downstream transport, host credentials, authority, deployment or running-user instance changes.

Final slice includes minor corrective refinements from real browser findings: destination disclosure preservation on add, number/unit-aware existing browser tests, source-safe readable labels and diff lookup, spacing for error links. Browser harnesses synchronize save completion before inspecting persisted state. Historical milestone evidence remains untouched; test-results/ excluded.

Final validation: 668/668 tests across 71 files and build pass. Nine real HTTPS browser scenarios pass; exact source/report hashes and environment-resolution notes are recorded in milestone21/validation.json. Ready for root milestone acceptance; final slice SHA is recorded by the orchestrator's existing checkpoint convention.
