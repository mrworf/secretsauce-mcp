# Source changes

| Change ID | Findings | PO feedback | Target | Kind | Status | Decision | Semantic impact |
|---|---|---|---|---|---|---|---|
| REC-CHANGE-035 | REC-035 | PO-FB-125, PO-FB-126, PO-FB-127, PO-FB-128, PO-FB-129, PO-FB-130 | docs/web-console-prd.md | Local review clarification | APPLIED_AFTER_DECISION | Confirmed directives | journeys, UX |
| REC-CHANGE-036 | REC-036 | PO-FB-131, PO-FB-132, PO-FB-133 | product/ux/02-interaction-patterns.md | Local review clarification | APPLIED_AFTER_DECISION | Confirmed directives | journeys, UX |
| REC-CHANGE-037 | REC-037 | PO-FB-134, PO-FB-135, PO-FB-136, PO-FB-137 | product/ux/02-interaction-patterns.md | Local review clarification | NO_SOURCE_MUTATION | Confirmed directives | None |

REC-CHANGE-035 and REC-CHANGE-036 jointly update CONFIG-03 and UX-IN02: formerly generic sanitized review and inline-unspecified acknowledgments, now sectioned Changes/New settings and the selected approval dialog. Mutation gate: explicit confirmed PO-FB-127/129/130/132/133/136 yields local testable behavior; no new roles, runtime TLS policy, persistence or security authority. Before/After columns and destination-name-only labeling remain exploratory; exact layout is not invented here. Existing non-color status rules establish feasibility of restrained semantic accents without changing meaning.

REC-CHANGE-037 records no source mutation for the pre-existing scope requirement. No architecture or security artifact changed.

Application evidence: both normative insertions verified in CONFIG-03 and UX-IN02; original content retained. Prior hashes: {"docs/web-console-prd.md": "48194cfbc4e55756649820a411aa0675c2a6be87c577bdd920b0aaf06e21b617", "product/ux/02-interaction-patterns.md": "49afe01f26e05cb51e1a0183283ff07f16fdc4cb238cedc1bb85b35e0c6b5539"}. New hashes are recorded in canonical result.
