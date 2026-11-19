# M46 scoped Activity investigation

Parent commit fb88e6373bdaa50d8e5d04058b744ebeb3168198. Fixed goal45–46; parent owns status and final regression. Preserve unrelated untracked passwd, session Markdown and test-results without reading. No deployment. Governing M46 contract and UX8 AUDIT-02.a/b, UX-IN22 apply.

## Slice contracts

1. **Bounded query/detail/export predicates** (in progress): extend existing evidence filters compatibly with legacy exact fields; strict32-chip validation and duplicate rejection, OR inclusions/AND exclusions perfield, AND field/time/role/service scope. Preserve single snapshot/export bounds and sanitize nested criteria. Own consoleEvidence, console HTTP query adapter and evidence tests. Observable through existing APIs; validate truth tables, malformed inputs, role/context/detail denial, bounds and export metadata. Commit independently.
2. **Shared investigation journey and report destinations** (pending): shared main/service Activity editor with UTC presets, chips, duplicate modal and distinct successful-search state; pagination/export retain searched scope. Relocate existing reports to subject destinations with evidence-role access. Own evidence/presentation/navigation pages and browser harness/evidence. Validate actual authorized synthetic HTTPS workflow at1440/390/320+200%, keyboard/error/role/changed-filter states and joined Settings→service→Activity→export. Commit independently after slice1.

## Preservation and qualification

No persistence migration, new roles, event redesign, retention change or transport work. Hard Member actor and per-service context intersect user logic; no raw chips in logs. M45 footer and guards retained. No new product choices. Positive/negative tests required for new external chip/context inputs. Focused evidence/HTTP tests + build per affected slice; directly affected navigation tests as needed. Parent owns clean-source full suite and UX8-INTEGRATED after M46; no concurrent browser during that run. First out-of-area regression expands focused coverage; second triggers full regression after correction. Current count0.

## Acceptance and rollback

All six M46 acceptance rows required; record exact focused results and runtime evidence before publication. Revert code without changing stored evidence if needed. Final role/export availability and all source bounds remain. Plan persisted before code; slice progress/commits/evidence below.

## Slice01 result

Complete: strict bounded chips and independent context now apply to query/detail/export; legacy exact filters remain. New authenticated CSRF-protected POST `activity/search` avoids chip-bearing URL transport; existing 131072-byte body cap accommodates32×1024 code units of worst-case3-byte BMP UTF-8, verified by HTTP fixture. No log additions. One deadline includes projection, sorting and predicate scan. Nested chip export metadata is sanitized. Focused evidence/HTTP17tests PASS, build PASS. Existing sanitizer/export500row/single-snapshot and audit/role tests retained; added truth-table, boundaries, Member/context, offset and deadline cases. Slice02 remains pending; no browser/full-product acceptance claimed yet.
