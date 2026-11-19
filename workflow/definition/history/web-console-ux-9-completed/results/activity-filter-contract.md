# Activity filters — scoped product contract

Status: specialist resolution supplied for reconciliation adoption; no canonical PRD edit. Scope: AUDIT-02 and confirmed PO-FB-216–232 in PO-FEEDBACK-2026-11-18-001. PO-FB-224 supersedes global-AND PO-FB-223; PO-FB-221/222 supersede silent-duplicate PO-FB-220. The owner delegated mixed comparisons and clarified that negative comparisons exclude specified values. No material owner choice remains in this contract.

## AF-01 — One predictable matching rule

For each field, collect positive chips (`equals`, `contains`) and exclusion chips (`does not equal`, `does not contain`). A record satisfies that field when:

`(no positives OR any positive matches) AND every exclusion is satisfied`.

All field groups, the time interval and the authorized view scope combine with AND. Equivalently, any negative chip whose corresponding positive predicate matches vetoes the record. No positive match overrides an exclusion. Chip order changes neither matching nor authorization.

| Chips on one field | Result |
|---|---|
| action equals read; action equals list | read OR list |
| action does not equal read; action does not equal list | neither read nor list |
| action contains api; action does not contain admin | contains api AND does not contain admin |
| action equals read; action does not contain read | no records; valid contradictory query, not automatic chip removal |
| actor equals A; service equals S | actor A AND service S |

This preserves the selected OR-alternatives/AND-fields direction while making exclusions actually exclude. Literal OR of two exclusions would return almost everything and contradict that clarified intent.

## AF-02 — Fields, literals and missing values

Supported fields are the existing recorded actor, service, action, request ID and recorded result. Matching uses stored event field values, never display names or decorated/translatable labels. `equals` is exact case-sensitive equality, preserving current behavior. `contains` is case-sensitive literal substring matching with the same character semantics; no regular expression, wildcard, locale folding or implicit Unicode normalization. Negative comparisons are the logical inverse of their corresponding positive predicate. All four comparisons are available for these fields. Retain current recognized result values for exact result comparisons; contains comparisons can use a literal substring. Preserve existing result labels separately from recorded values.

A missing/null field is absent: neither equals nor contains matches a nonempty value; both negative comparisons therefore succeed. Existing empty recorded strings behave the same for valid nonempty filter input. This means excluding a request ID retains management events without request IDs; it does not create a new “has field” operator. Do not turn the display label “Instance” or “Gateway event” into a stored service/request ID. Preserve imported/local provenance and current event sanitization.

Values are nonempty, preserve leading/trailing spaces and case, and retain the existing maximum 1,024 string code units and rejection of control characters U+0000–001F/U+007F. Empty value or unsupported field/comparison is a local validation error and server rejection, not an implicit match-all or dropped chip. Do not silently trim, normalize or alter an existing identifier. Legacy one-value filters remain compatible as positive equals predicates with their existing validation.

## AF-03 — Duplicate and bounded-input behavior

A duplicate is the same field plus exactly the same literal value, irrespective of comparison. Reject adding it, show the requested small explanatory modal, retain existing chips and the proposed input, and explain that the existing chip must be removed first. Case-distinct values are distinct because matching is case-sensitive. Different fields may reuse a value. Reject duplicate pairs server-side as well; malformed direct requests cannot bypass the UI. Simultaneous legacy and chip forms targeting the same field must not be silently merged or overwritten: reject the conflicting representation with a bounded explanation.

Bound the new chip list to 32 entries; retain the per-value bound and existing HTTP input limits. This is a specialist-derived bounded-work limit, not owner-requested capability expansion: it permits repeated filters while keeping evaluation finite. Exceeding the bound rejects the attempted change with “Use 32 filters or fewer”, preserving the accepted query. Existing scan bounds (100,000 retained rows and 2 seconds), query offset 0–100,000, page default 50/max100, export max500 rows and 2 MiB remain unchanged. Do not truncate filter lists or relax work limits to make a query succeed. A bounded-work failure is distinct from zero matches. Implementation may use any representation that meets the contract and existing HTTP bounds; no query language or persisted saved-search capability is introduced.

## AF-04 — Time and searched versus edited state

Presets fill editable From/To values in UTC. Compute both endpoints once at preset selection; then they are ordinary explicit values, not a continually moving relative query. Preserve inclusive bounds (`time >= From`, `time <= To`), optional open ends and nonnegative integer timestamp validation; reject invalid dates or From after To without running a broadened query. Labels identify UTC. Preset examples remain design guidance: relative periods are elapsed durations; year-to-date begins January 1 at 00:00 UTC. Do not reinterpret existing stored event timestamps or local/imported clock provenance.

Search submits the current validated chips/time and resets pagination to the beginning. Keep a separate last-successful-search criteria snapshot associated with its matching-event count and displayed results. Adding/removing/editing inputs does not silently retarget the displayed count or Export activity; expose that Search is needed to refresh. Failed search retains or clearly separates the prior successful results and cannot label them as the failed criteria. Clear filters removes user chips and time bounds; it does not remove hard view/authorization scope. Preserve the current Clear action’s immediate refresh: it returns pagination to the beginning and performs the cleared query inside that hard scope; replace the successful-search snapshot only if this request succeeds. Retain the current result/event presentation under PO-FB-231.

## AF-05 — Shared view scope and permissions

Main and per-service Activity use the same chip editor, evaluator, time controls, pagination, event-detail matching and export criteria. Current implementation only prepopulates a service filter and Clear currently loses that context; that is the implementation gap, not an already-enforced fence. To fulfill the existing per-service Activity promise consistently, per-service Activity must have an immutable contextual exact service constraint in addition to user chips: removing chips or Clear filters cannot broaden it. A conflicting service chip returns no matches rather than silently switching service context. Switching intentionally to global Activity changes the view context explicitly.

Authorization is a hard predicate outside user Boolean logic. Preserve current Owner/Administrator/Auditor instance evidence access, Member own-actor scope and prohibition on Member exports; restricted sessions and audit outages retain existing read-only/sensitive-operation boundaries. Preserve existing denial of a Member's direct exact foreign-actor or unassigned-service selection. New substring/exclusion queries only filter the already authorized record universe; they do not enumerate other users/services or widen a Member's own history. A user's exclusions may yield an empty own view but never a foreign view. Detail lookup applies the same scope plus query, with no unrestricted ID lookup. Reauthorize on every query/detail/export and preserve current role-change rejection. Do not add suggestions/autocomplete that disclose unauthorized identifiers.

## AF-06 — Export parity and snapshot boundary

Only filtered activity export remains in Activity, beside the count. Export uses the last successful Search criteria and context, never an unsubmitted chip or time edit. Preserve the searched page offset as the current export starting position and existing up-to-500 row behavior; label the starting position, cap and truncation so page50 does not imply export50 or entire-history export. Bind the request to that criteria/context copy; recheck current role/session/audit authorization when exporting.

Preserve the current one-snapshot-per-export behavior: the export evaluates the submitted searched criteria against one current authorized retained-evidence snapshot. It is not an immutable copy of previously displayed events. New audit records or retention changes may alter matching records since Search; state that the file contains currently retained events matching the last search, and report actual truncation. No durable search snapshot store or retention hold is introduced. Required export admission itself remains audited; the exported snapshot may include that event if it matches, as today. UI/detail/export use the same positive/exclusion predicate, time semantics and service scope. Sanitize both exported rows and nested filter metadata before output, including synthetic secret-like user input; never log raw chip values as a new default. Preserve 500-row/2MiB limits, current download format and bounded failures. Moving the other three evidence exports is UX navigation work, not removal or permission expansion.

## Acceptance and specialist boundaries

1. Prove positive alternatives, all-exclusion AND, mixed veto, cross-field AND, chip-order invariance and valid contradictory queries with a small truth-table fixture.
2. Positive and negative tests cover literal metacharacters, case differences, absent request ID, empty/control/oversize input, unsupported fields/comparisons, duplicate pair across comparison, 32/33 chips, legacy equals compatibility and mixed-representation rejection.
3. Exact From/To boundaries, malformed/reversed/open time intervals, fixed preset timestamps and year-to-date UTC are testable without changing event timestamps.
4. Main/per-service list, detail and export agree on matching; Clear cannot escape a service or Member scope. Current denied Member actor/service selection, forbidden exports, role changes and audit outages stay denied.
5. Unsubmitted edits and failed searches never change the export target. Offset/cap/truncation and current-snapshot behavior are explicit; late events/retention do not create a false frozen-results promise. Nested filter metadata cannot leak secret-like input.
6. Duplicate modal has a clear dismissal/return path without losing input; chips individually remove; Search/Clear filters and count-associated Export activity have the shared UX. Existing result cards and sanitized detail remain.

Implementation-ready: yes for this bounded contract after reconciliation adoption. No open product decision or material assumption. Security/architecture should verify bounded evaluation, authorization-first selection, sanitization of nested new input, query parity and current export snapshot integrity. UX owns layout/focus/error mechanics under settled chips/modal directions, not Boolean policy. This result neither rewrites the whole PRD nor declares implementation acceptance.
