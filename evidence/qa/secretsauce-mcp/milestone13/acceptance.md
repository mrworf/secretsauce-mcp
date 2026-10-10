# M13 implementation acceptance evidence

Scope: exactly milestone13, single organization/four roles. Governing plan: [milestone_13_plan_01](../../../../delivery/plans/secretsauce-mcp/milestone_13_plan_01.md). Definition/planning authority was not edited. Root owns milestone status and final acceptance.

## Contract outcomes

| Milestone criterion | Evidence and result |
| --- | --- |
| All supported fields preserve semantics through guided/advanced/import/export | Shared JSON service draft preserves optional/advanced fields, imported regexes, destination/placement/scanning/binary settings. Strict unknown nested fields fail. Current globals export with units; inactive Owner proposals are explicitly separate; M14/M15 controls remain reserved. [Field coverage](../../../../docs/console-advanced-configuration.md), config/migration/advanced tests, rendered shared editor. |
| Preview/runtime parity with no credential substitution or downstream I/O | Shared canonical destination and policy functions run in bounded worker. Exact/prefix canonical edge paths, denied priority tie, stable same-effect ties, defaults, current eligibility/source and effective scanner/binary settings covered. Explicit fetch/substituteTokens spies remain zero. Pending draft-save/access-remove/disable forces fresh preview. |
| Explicit mapping/credential migration; no host reads | Legacy file/env metadata is never resolved. Deliberate write-only values create missing values only; existing rotations use Replace. Email inference rejected; known enrolled local and exact registered issuer/subject mappings succeed; disabled/wrong issuer fails. Missing mappings remain activation blockers after ordinary resave. Pure reserved-global validation rejects invalid URL/source/TTL/lockout/limits without host reads. Admin changed Owner proposals rejected. |
| Latest50 scoped sanitized revisions, safe Use as draft | Retention52→50, actor/revision/change, exclusion of access/lifecycle/users/sessions/grants/secrets; current assignment/value dependencies. Disabled/archived/missing dependencies and stale/demoted actors reject. Catalog-only scope works. Redacted structural snapshots cannot be restored as changed regex/catalog/destination syntax. Credential rotation invalidates history review. |

## Required UX evidence

Actual loopback HTTPS with synthetic example.org certificate/resolver, declared Playwright Chromium and secure console cookie; keyboard controls and320CSSpx checks. [Browser report](browser-report.json) records6 task groups and automation denial timing161ms, below2minutes. This is functional automation, **not** a human usability study; M15 repeats timing with full Activity.

| Checks | Rendered evidence |
| --- | --- |
| C04/C05 | [Same draft advanced/editor](advanced-shared-draft-320.png), [shared defaults/catalog editor](shared-scanner-settings-320.png); regex unchanged and active/saved distinction. Settings search matches actual nonsecret labels/help across sections and exposes no-match state. |
| C06/C15 | [Stale review](stale-review-320.png), [policy input error](policy-error-320.png), [field/source import error](import-field-error-320.png); current comparison and reload guidance, no partial-success claim. Existing M10–12 HTTP tests retain expired/forbidden/audit/uncertain-operation boundaries. |
| C09/C10/C25 | [Policy explanation](policy-explanation-320.png): eligibility/source, canonical target, winner/reason and concise effective protection; full catalog details behind a disclosure. No downstream request. |
| C23/C10 | [History](configuration-history-320.png), [export](sanitized-export-320.png), import error: current dependencies, no secret/access/lifecycle restoration; export explicitly missing material/not a backup. |
| C20/C21/C22 | All eight320px screenshots have no horizontal page overflow; keyboard navigation, labels, visible focus, disclosures, safe errors/status and account/logout remain reachable. Concise summaries precede advanced details and useful-size editors. |

Screenshots cover only nonsecret configuration; password/code/image controls are masked, fresh setup factors are never captured, and no browser storage/traces or reusable credential material are retained.

## Validation and important boundaries

- Full `npm test`:481 tests across48 files PASS with loopback permission; original sandbox full-suite listenEPERM was classified as environment and repeated unchanged with permission.
- `npm run build`: PASS; generated console script syntax and actual rendered UI pass.
- Final focused advanced/migration suite:20 tests PASS; broader history/canonical/HTTP boundary suites pass. New inputs have positive/negative validation and current-authorization coverage.
- Actual delayed downstream response preserves admitted sensitive-name catalog while shared settings change, with identical live scanner pool; existing rotation/revocation generation fences and self-signed TLS gateway tests pass.
- Sensitive-name response regexes retain source and scanner offsets. Name-only batch workers bound4 slots/10000 names/1second, early-filter overlength names and await termination before capacity release; pathological regex and batch/synchronous parity covered. Preview has corresponding bounded workers. M15 can expose these operating limits; M13 introduces no limit UI.
- Response scanning stays best-effort exact/pattern defense; no universal nonexfiltration claim. MCP tool contracts and managed builtin password-only OAuth issuance block remain unchanged. No external messaging, host inspection, service packs, later milestone activation or platform modification.

Commit provenance: slices01–03 are698b051634fb156679defbed85793296447ab2f3, b4a60344deccf11e8912b7de9a7ce442cfc157e1 and5e3f0eb6efe4edb1dc0131e4120f0de05db266e6. Slice04 is identified by its unique Git subject `delivery: M13 slice 04 safe configuration history and acceptance`; root records its exact SHA after commit. Preexisting untracked test-results/ remains excluded.
