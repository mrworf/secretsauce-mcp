# M31 slice 01 — Shared rule authoring dialog

## Outcome and boundary
Owner/Administrator opens Add or contextual Edit from a compact rule list, changes a cloned rule in a focused dialog, and keeps it in the service draft. Cancel/Escape leave contents and prior dirty state unchanged. Delete confirms draft-only removal. List shows effective order and restricts movement to same-priority/same-effect peers without priority renumbering.

## State and permissions
No server mutation occurs on opening/closing/keeping a dialog. Save draft continues existing enrolled role checks, generation/revision comparison, durable audit admission and uncertain-state recovery. Auditor sees read-only configuration; Member cannot author. Existing service and full Advanced editor stay lossless. No value handling changes.

## Inputs and errors
Common methods are selected; custom methods, literal host/path regexes, exact/prefix builder, preserved rule references and scanner/binary controls remain reachable in an Advanced rule tab. Generate unique new rule IDs, preserve imported IDs unchanged unless explicitly edited. Local field errors identify invalid HTTP tokens, patterns, priority and options; Keep does not alter the source until valid. Both effects remain available under either default. No new server route.

## Implementation surfaces
src/consoleServicePage.ts, consolePresentation.ts, consolePage.ts; focused pure rule helpers/tests if needed; browser harness and affected existing selector updates; operator guide and evidence. Existing own-property-safe typed options retained; no schema/algorithm widening.

## Validation
Positive: Add/Edit parity, common/custom methods, exact/prefix/regex and literal IDs, reasons, hosts, scanner/binary settings, ordering and ties, keep/save/advanced roundtrip. Negative: blank/invalid methods/regex/priority/options, cancel and Escape, forbidden and stale save, uncertain save outcome inspection. Actual HTTPS keyboard focus trap/return, 1440/390/320 and all-text 200% ranges; compare approved policy desktop/narrow and rule-dialog. Focused tests while iterating; final complete suite `npm test -- --maxWorkers=2` and `npm run build` without concurrent browsers. Sequential affected browser regressions.

## Acceptance / commit
All M31 checklist items mapped in evidence/qa/secretsauce-mcp/milestone31/acceptance.md before one `delivery: M31 slice 01 focus policy rule authoring` commit. Exact final SHA recorded by parent after acceptance. No later milestone needed to demonstrate this outcome.

## Delivered validation
Shared authoring dialog and effective-order list delivered. Focused 32 tests passed; final full suite 749/749 across 74 files and build passed. HTTPS M31 authoring browser and affected service/friendly-form regressions pass. Final narrow CSS correction separately covered by final browser/build; no unrelated retest. See [acceptance](../../../evidence/qa/secretsauce-mcp/milestone31/acceptance.md), final source hashes and visual comparison. No new durable AGENTS lesson; existing browser-concurrency and text-range checks followed. Commit SHA is recorded by the parent after this single slice commit.

Accepted commit provenance: `af876cd48c10c497bcf4e436f8a60a0d53178b4a`.
