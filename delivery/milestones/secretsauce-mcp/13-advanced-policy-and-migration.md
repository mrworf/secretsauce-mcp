# Milestone 13: Author advanced policy and migrate configuration

## Objective

Finish lossless advanced configuration, policy explanation and migration into managed authority using the same safe draft transaction.

## User/System Outcome

Administrators can represent every existing gateway setting, predict policy without downstream I/O, import legacy configuration safely, and reuse permitted history without restoring access or secrets.

## Scope

Advanced policy/scanner catalog editing and effective settings; safe policy preview; all supported configuration round trips; existing YAML/catalog import and explicit identity/credential resolution; last-50 sanitized revisions, rollback-as-draft and sanitized export.

## Explicit Exclusions

No service packs, visual workflow engine, arbitrary host file browser or automatic downstream rotation. Import is configuration migration, not a merge restore or alternative secret-backup format. Advanced MCP-mode controls belong to 14 and operating limits to 15.

## Source Requirements

[PRD](../../../docs/web-console-prd.md) and normative contracts: `BASE-01`, `BASE-03`, `CONFIG-03`, `CONFIG-04`, `POLICY-01`, `POLICY-02`, `POLICY-03`, `POLICY-04`, `SEC-01`, `SEC-02`, `MIGRATE-01`, `MIGRATE-02`, `MIGRATE-03`, `MIGRATE-04`, `CAP-CFG-04`, `CAP-CFG-05`, `STATE-01`, `STATE-02`, `STATE-03`, `UX-02`, `UX-03`, `UX-04`.

[Journey audit](../../../docs/web-console-prd-user-journey-audit.md): J-OWNER-POLICY, J-ADMIN-POLICY, J-OWNER-HISTORY, J-ADMIN-HISTORY, J-OWNER-CONFIG, J-ADMIN-CONFIG. Shared sources/revisions and preservation rules are in [index](index.md); exact coverage rows are in [traceability](traceability.md).

## Preconditions

12 provides enrolled/mapped human identities and current lifecycle; 11's transitive shared schema/draft/apply/runtime contracts preserve advanced fields and allow safe atomic activation. External identity mapping consumes the explicit issuer/subject registry delivered by 12; unknown external identities remain unresolved/inactive until registered, never inferred by email.


Readiness prerequisite IDs resolve to the [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).

- `PRE-001–005` — committed authority, existing regression/build baseline, declared Node/npm/packages, writable loopback test execution and an available browser; current facilities verified with the limitations in the readiness report.
- `PRE-007`, `PRE-008`, `PRE-009` — the earlier providers named above must be completed with committed acceptance evidence before this milestone begins; currently pending implementation.
- `PRE-014` — this milestone owns its specific positive/negative and failure fixtures; reuse earlier declared harnesses, never undeclared local packages.

## Readiness checks

- Inspect `delivery/milestones/secretsauce-mcp/status.yaml` and the committed planning handoff: this milestone is selected explicitly, source revisions still match, and all direct dependencies are completed with evidence. The legacy next-MVP selector targets the historical packet and must not select this work.
- Run `node --version` and `npm --version`; Node satisfies `package.json` (>=22). On a fresh checkout run `npm ci`; installed dependencies come from the lockfile. CI remains Node22. Use writable temp storage and loopback permissions; if `npm test` reports `listen EPERM`, rerun the identical suite with permission per AGENTS.md.
- Confirm `npm run build` and `npm test` remain the documented baseline commands (a newly executed result is required at milestone acceptance; readiness’s existing baseline is not feature evidence). Inspect previous milestone validation before modifying shared contracts.
- Inspect the browser procedure/harness and available browser before UI validation; it must load the implemented local page and support keyboard and 320px checks without depending on undeclared cached packages. New commands are recorded by the owning implementation, not invented here.

## Functional Requirements

- Policy editing preserves priority order: highest wins, deny wins equal allow/deny priority, stable same-effect ties, default applies if no match. Expose methods, hosts/paths, reasons and explicit priorities. Exact/prefix conveniences have unambiguous canonical matching; imported regex source remains lossless. No silent semantics from dragging.
- Forms and advanced editor share one draft; switching preserves every supported value. Settings search finds non-secret labels/help and reveals the containing section. Author Secretlint catalog extend/replace, options, custom patterns/exclusions, sensitive-name catalog/allow patterns, per-rule scanning exceptions and binary-response controls. Shared defaults have one Settings location with effective inherited service summaries; Administrators retain permitted scanning edits.
- Safe tester accepts identity/service/destination/method/path or URL and returns eligibility, canonical target, winning rule/default, effective response protection and reason. It never substitutes credentials, emits secret-bearing outbound URLs or contacts a downstream. A preview is not a grant and does not bypass current checks on later execution.
- Import gateway YAML and both scanner catalogs into a draft with exact supported semantics and field/source errors. Unknown fields are errors, not discarded. Explicitly map subjects to known local users or registered issuer/subjects; matching an email is insufficient. Missing identity mappings/credentials prevent affected activation.
- Resolve only deliberately supplied migration credentials, otherwise request write-only values. No imported path/environment name grants browser authority to inspect the host. Sanitize validation/error output and bound parsing, regex/catalog sizes and resource work.
- Keep latest 50 applied configuration revisions; expose actor/revision/sanitized change and Use as draft scoped to current role. Exclude live identities, assignments, lifecycle, sessions/grants and secret values. Missing dependencies fail; old destination/policy choices require ordinary impact/exception review. History cannot enable a service, restore removed access or recover an old secret.
- Managed configuration becomes authoritative after migration. Old YAML/environment never silently overrides later UI changes. Export sanitized configuration only, retaining advanced semantics and indicating missing secret material; encrypted backups later carry recovery data. Warn before endpoint/authentication identity changes requiring reconnection.
- Document field coverage, migration procedure, export limitations, precedence and policy investigation without claiming response scanning is universally non-exfiltrating.

## UX Constraints

UX-IA03's coverage table is a completion checklist for all settings. UX-IN01/02 requires shared lossless draft, field-linked import errors and full review; UX-IN04 visibly orders rules and labels No downstream request is sent. UX-IA04/EX03 labels history as Use as draft and excludes secret/access recovery. Apply inherited-source labels and visible exceptions; advanced editors retain keyboard/error/reflow support.

All affected pages inherit [UX-R01–03](../../../product/ux/03-responsive-and-platform.md), [UX-V01–03](../../../product/ux/04-visual-system.md) and [UX-A01–04](../../../product/ux/05-accessibility.md): calm moderate-density service-first hierarchy, text/icon state, visible focus/labels/errors/status announcements, keyboard-only completion, no hover/drag-only action, accessible confirmation focus return, and routine reflow at 320 CSS px. Narrow layouts retain essential actions, My account and logout. Loading/empty/validation/forbidden/offline/expired/failed states preserve safe non-secret context and never fabricate success. The approved concepts guide composition, not missing-feature exemptions or exact pixels.

Required [observable checks](../../../product/ux/07-acceptance-checklist.md): UX-C04, UX-C05, UX-C06, UX-C09, UX-C10, UX-C15, UX-C23, UX-C20, UX-C21, UX-C22, UX-C25. IA and IN/EX references resolve to the canonical [UX manifest](../../../product/ux/manifest.yaml).

## Architecture / Security Constraints

Reuse backend canonical destination/policy logic; never deserialize/reserialize sensitive-name JSON in gateway preservation work. Bounded hostile YAML/regex/catalog inputs and secret-free rendering/logs are necessary. STATE-03 current permissions and dependencies govern history, even if an older revision was created by an Owner. Import never directly activates grants or services outside reviewed transaction.

## Interfaces and Compatibility

Preserve existing configuration fields from docs/config-reference.md and src/types.ts, including unillustrated advanced fields. No change to MCP tool contracts. A sanitized export is not a restore archive. External mappings use 12's explicit registry and can be validated without active external OAuth; 14 adds runtime authentication integration.

## Acceptance Criteria

- [ ] Each supported configuration capability round-trips forms → advanced editor → import/export without silent loss; unknown fields produce precise failures.
- [ ] Preview matches runtime canonical target/order/default/exception outcome while downstream/substitution counters remain zero.
- [ ] Import requires explicit mappings and deliberately supplied credentials; unresolved sources stay inactive and cannot read host data.
- [ ] Fifty-revision history is scoped and sanitized; using older configuration never restores a revoked assignment, disabled service or previous credential value.

## Required Validation

Generate positive/negative fixtures from all configuration fields and both catalogs; test malformed/oversized YAML and regex, exact/prefix edge paths, tied rules, settings search and inherited controls. Race history/import apply against demotion, rotation, disable and mapping changes. Compare preview/runtime decisions with no-I/O assertions. Test malicious labels/log payloads and reject implicit email mapping. Browser task: explain a denied request within two minutes using available event/denial context; repeat final timing in 15 with full Activity UI.

For each new external input add positive and negative tests, plus concurrency/failure cases named here. Run focused/related checks while building; at milestone completion run `npm test` and `npm run build` plus the required browser/operational evidence. If full tests fail with loopback `listen EPERM`, rerun the same suite with appropriate permission, never weaken listener tests. User-facing work requires rendered browser, keyboard and narrow-width evidence for its listed UX checks. Full-suite repetition is warranted after new changes, not as ceremony. No application tests are required merely to compile this documentation.

## Known Risks / Deferred Work

Untrusted regex/import processing must be bounded without removing supported expressions; mechanisms remain implementation choices. External identities are mapped against the existing registry from 12; full configuration coverage is checked again in 15, not silently marked complete before later settings surfaces exist.
