# Decisions required

All three entries are initially specialist-owned; no settled Product Owner direction is reopened. A concrete UX design may require approval under its governing workflow. Any product choice genuinely remaining after lifecycle derivation must be surfaced rather than guessed.

## REC-DEC-008
Type/owner: SPECIALIST_RESOLUTION; domain architecture.
Source findings: REC-022, REC-024.
Product Owner feedback: PO-FB-060, PO-FB-063, PO-FB-064, PO-FB-065, PO-FB-066, PO-FB-067.
Affected requirements: CONFIG-02/03/04; STATE-01/02/03; AUDIT-01.
Question: What safe durable credential state and attribution contract realizes clear-value/retain-key deletion and last-changed-by display?
Reason: The Product Owner has settled clearing an in-use value and retaining its key. Existing authority blocks referenced deletion; current storage conflates value presence with metadata. Derive current authorization/version/dependency checks, immediate reference/admission effects, failure/restart, restore/history, missing-value behavior and honest legacy actor attribution without reopening that intent. Security and architecture boundaries both need resolution.
Affected actors: Owner/Administrator service editors, read-only authorized viewers and MCP users whose service dependencies change. Affected artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, docs/web-console-prd-coverage.md.
Consequence of deferral: dependent desired-state specification and implementation stay unready; existing resolved import correction remains separately described.
implementation_ready: false
Candidate authority: none adopted by this transaction.

## REC-DEC-009
Type/owner: SPECIALIST_RESOLUTION; domain ux.
Source findings: REC-020, REC-021, REC-023, REC-025, REC-026, REC-027, REC-028, REC-029, REC-030, REC-031, REC-034.
Product Owner feedback: PO-FB-043, PO-FB-044, PO-FB-045, PO-FB-046, PO-FB-047, PO-FB-048, PO-FB-049, PO-FB-050, PO-FB-051, PO-FB-052, PO-FB-053, PO-FB-054, PO-FB-055, PO-FB-056, PO-FB-057, PO-FB-058, PO-FB-059, PO-FB-061, PO-FB-062, PO-FB-096, PO-FB-097, PO-FB-098, PO-FB-068, PO-FB-101, PO-FB-071, PO-FB-072, PO-FB-073, PO-FB-074, PO-FB-075, PO-FB-076, PO-FB-077, PO-FB-087, PO-FB-124, PO-FB-078, PO-FB-079, PO-FB-080, PO-FB-089, PO-FB-090, PO-FB-091, PO-FB-092, PO-FB-093, PO-FB-094, PO-FB-095, PO-FB-102, PO-FB-103, PO-FB-105, PO-FB-082, PO-FB-083, PO-FB-084, PO-FB-085, PO-FB-086, PO-FB-099, PO-FB-100, PO-FB-104, PO-FB-106, PO-FB-107, PO-FB-108, PO-FB-109, PO-FB-110, PO-FB-117, PO-FB-118, PO-FB-111, PO-FB-112, PO-FB-115, PO-FB-120, PO-FB-123.
Affected requirements: CONFIG-01/02/05; POLICY-01/02/03; UX-01/02/03/04; MIGRATE-01.
Question: What coherent researched service configuration design realizes the confirmed directives while preserving existing capabilities, current versus draft state and safe navigation?
Reason: Individual directives settle interaction outcomes but not the full layout, responsive states, composition or approved mockups. Existing authority needs selective service UX refinement. Color bars, tester modal and speculative identifier hiding remain advisory/exploratory. Any required approval is for a concrete design, not reauthorization of the directives.
Affected actors: Owner/Administrator service editors, read-only authorized viewers and MCP users whose service dependencies change. Affected artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, docs/web-console-prd-coverage.md.
Consequence of deferral: dependent desired-state specification and implementation stay unready; existing resolved import correction remains separately described.
implementation_ready: false
Candidate authority: none adopted by this transaction.

## REC-DEC-010
Type/owner: SPECIALIST_RESOLUTION; domain product.
Source findings: REC-020.
Product Owner feedback: PO-FB-048, PO-FB-049.
Affected requirements: CONFIG-05; STATE-01; AUDIT-01.
Question: How should the requested row-level Delete action map to existing retained-history Archive lifecycle without silently inventing permanent deletion or misleading the operator?
Reason: The feedback confirms a Delete action and confirmation, but existing authority specifies archive/restore-to-Disabled and retained audit/history. First derive the smallest faithful lifecycle contract; only a remaining material retention/destruction tradeoff requires a Product Owner choice. Do not infer purge or erase audit from a label.
Affected actors: Owner/Administrator service editors, read-only authorized viewers and MCP users whose service dependencies change. Affected artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, docs/web-console-prd-user-journey-audit.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, docs/web-console-prd-coverage.md.
Consequence of deferral: dependent desired-state specification and implementation stay unready; existing resolved import correction remains separately described.
implementation_ready: false
Candidate authority: none adopted by this transaction.
