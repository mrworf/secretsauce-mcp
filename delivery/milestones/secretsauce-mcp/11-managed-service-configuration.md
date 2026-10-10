# Milestone 11: Configure and activate services safely

## Objective

Let administrators manage a complete ordinary service and write-only credentials using coherent drafts and immediate lifecycle actions.

## User/System Outcome

An Owner or Administrator creates a service, configures its destination/authentication and basic policy, reviews and activates it without a restart, and can rotate credentials or disable execution immediately.

## Scope

Service-first list/detail and five-step setup; full destination and credential-placement representation; encrypted write-only value operations; scoped draft/review/apply contract for service and instance settings; coherent runtime publication, current admission, explicit eligible assignments and service lifecycle.

## Explicit Exclusions

Milestone 13 adds advanced policy/catalog authoring, guided import and history UI. Milestone 12 adds user administration and more eligible users; 14 adds new multi-user MCP consent. Preserve advanced baseline values even before their authoring surfaces arrive; do not remove supported schema fields.

## Source Requirements

[PRD](../../../docs/web-console-prd.md) and normative contracts: `BASE-01`, `BASE-02`, `AUTHZ-01`, `AUTHZ-02`, `AUTHZ-04`, `CONFIG-01`, `CONFIG-02`, `CONFIG-03`, `CONFIG-05`, `POLICY-01`, `POLICY-04`, `SEC-01`, `SEC-02`, `SEC-03`, `UX-01`, `UX-02`, `UX-03`, `UX-04`, `CAP-CFG-01`, `CAP-CFG-02`, `CAP-CFG-03`, `STATE-01`, `STATE-02`.

[Journey audit](../../../docs/web-console-prd-user-journey-audit.md): J-OWNER-CONFIG, J-ADMIN-CONFIG, J-OWNER-CREDENTIAL, J-ADMIN-CREDENTIAL, J-OWNER-ACCESS, J-ADMIN-ACCESS, J-AUDITOR-CONFIG. Shared sources/revisions and preservation rules are in [index](index.md); exact coverage rows are in [traceability](traceability.md).

## Preconditions

10 supplies enrolled identity, current RBAC, encrypted state, durable audit and action status. Its existing Owner is an eligible assignment target, so setup and execution admission can be exercised before invitation management.


Readiness prerequisite IDs resolve to the [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).

- `PRE-001–005` — committed authority, existing regression/build baseline, declared Node/npm/packages, writable loopback test execution and an available browser; current facilities verified with the limitations in the readiness report.
- `PRE-007` — the earlier providers named above must be completed with committed acceptance evidence before this milestone begins; currently pending implementation.
- `PRE-014` — this milestone owns its specific positive/negative and failure fixtures; reuse earlier declared harnesses, never undeclared local packages.

## Readiness checks

- Inspect `delivery/milestones/secretsauce-mcp/status.yaml` and the committed planning handoff: this milestone is selected explicitly, source revisions still match, and all direct dependencies are completed with evidence. The legacy next-MVP selector targets the historical packet and must not select this work.
- Run `node --version` and `npm --version`; Node satisfies `package.json` (>=22). On a fresh checkout run `npm ci`; installed dependencies come from the lockfile. CI remains Node22. Use writable temp storage and loopback permissions; if `npm test` reports `listen EPERM`, rerun the identical suite with permission per AGENTS.md.
- Confirm `npm run build` and `npm test` remain the documented baseline commands (a newly executed result is required at milestone acceptance; readiness’s existing baseline is not feature evidence). Inspect previous milestone validation before modifying shared contracts.
- Inspect the browser procedure/harness and available browser before UI validation; it must load the implemented local page and support keyboard and 320px checks without depending on undeclared cached packages. New commands are recorded by the owning implementation, not invented here.

## Functional Requirements

- Services supports search, lifecycle filtering including Archived, separate active/draft indicators and visible exceptions; details use Overview, Configuration, Access and Activity. Stable identifiers, names/descriptions/documentation links remain supported.
- Add service follows Details → Destination → Authentication → Access & policy → Review, saves incomplete non-executing drafts and preserves safe Back navigation. An explicitly unauthenticated downstream service is supported. Ordinary setup requires no YAML/regex knowledge.
- Preserve multiple destinations, base URLs/schemes/ports, exact/suffix/regex host matchers, service TLS default and destination override/inheritance. Preserve multiple credential identities, placement/name/prefix/suffix and explicit default-off header ownership enforcement. Private downstreams remain possible.
- Credential creation/replacement/deletion are immediate authorized audited actions, with version/availability/last-change metadata and no reveal/copy-back. Rotate invalidates affected references. Dependency-bearing deletion fails with safe resolution guidance. Placement metadata remains a draft setting.
- Draft save has no runtime effect. Review names exact scope, base revision, sanitized differences, affected services, exceptions and client/reference disruption. Apply rechecks every changed field's current permission, base and current identity/grant/lifecycle/credential dependencies; validation/preparation/publication is atomic. Failure leaves the prior active revision. Concurrent change yields a sanitized compare/reload path, never partial application.
- Establish this reusable transaction for later Owner settings too. An Administrator cannot smuggle Owner-only changes in a mixed draft. Initial service review may atomically include explicitly reviewed new grants; stale grants cannot be resurrected. Grant/remove otherwise acts immediately on existing eligible identities.
- Draft/Disabled/Archived cannot execute. Disable/archive block new admission and revoke references immediately. Archive preserves history; unarchive returns Disabled. Re-enable reviews current dependencies; existing Active service with a draft keeps its applied state.
- Current identity, assignment, mode, lifecycle, reference, canonical destination/path, policy and audit are checked immediately before substitution/dispatch. Requests observe one coherent revision. Dispatched work retains its credential response-protection context; queued work rechecks eligibility; old completion never revives revoked references. Preserve unaffected state and capacity counters across apply.
- Explicit acknowledgement covers cleartext HTTP, disabled TLS, broad destinations, default allow and reduced scanning. Show active exceptions and trusted-administrator/best-effort scanning limitations. Add basic policy controls sufficient for a straightforward usable service while preserving evaluation semantics.

## UX Constraints

UX-IA02/03 define list, service tabs, wizard and grouped destination/authentication sections. UX-IN01–03 require one shared draft, safe unsaved-work prompts, full-page sanitized review, target-specific immediate confirmation and stale comparison. UX-IN04 distinguishes effective inheritance/exceptions. No typed phrase or approval chain for every action. UX-EX03 ensures discard/history cannot be mistaken for undo of rotation/disable/revoke.

All affected pages inherit [UX-R01–03](../../../product/ux/03-responsive-and-platform.md), [UX-V01–03](../../../product/ux/04-visual-system.md) and [UX-A01–04](../../../product/ux/05-accessibility.md): calm moderate-density service-first hierarchy, text/icon state, visible focus/labels/errors/status announcements, keyboard-only completion, no hover/drag-only action, accessible confirmation focus return, and routine reflow at 320 CSS px. Narrow layouts retain essential actions, My account and logout. Loading/empty/validation/forbidden/offline/expired/failed states preserve safe non-secret context and never fabricate success. The approved concepts guide composition, not missing-feature exemptions or exact pixels.

Required [observable checks](../../../product/ux/07-acceptance-checklist.md): UX-C02, UX-C03, UX-C05, UX-C06, UX-C07, UX-C08, UX-C10, UX-C15, UX-C20, UX-C21, UX-C22, UX-C25. IA and IN/EX references resolve to the canonical [UX manifest](../../../product/ux/manifest.yaml).

## Architecture / Security Constraints

STATE-01/02 order apply, immediate mutation and dispatch. Do not replace canonical path/policy/transport algorithms with a divergent browser implementation. Value projection for UI/history/export differs from runtime secrets. Owner/Administrator destination trust remains accepted; no absolute non-exfiltration promise. Audit gate from 10 applies to reads classified as exports and all new mutations.

## Interfaces and Compatibility

Adapt managed configuration to existing gateway semantics without changing five tool contracts, cookie restrictions, Base64/binary response behavior, tolerant JSON ranges or header enforcement. Activation requires no routine container edit/restart. Later settings editors consume this scoped transaction; later client flows consume current assignment/admission. Register audit events and operation status for every new command.

## Acceptance Criteria

- [ ] A first Owner creates and activates a usable service through five steps, while an incomplete service cannot execute; each destination and credential-placement capability is representable without loss.
- [ ] Rotation, removal and disable have immediate documented effects; dependency deletion, stale apply, role demotion and mixed Owner settings fail without partial mutation.
- [ ] Concurrent apply/rotation/revoke with queued and dispatched work yields one admitted revision and correct response protection; no revived reference or quota reset.
- [ ] Guided setup and applied/draft indicators match approved hierarchy and remain usable with keyboard and narrow reflow.

## Required Validation

Positive/negative management inputs and every supported destination/placement variant; explicit no-auth service; mixed-role draft, stale grants, interrupted candidate preparation and lost response/status reconciliation. Existing gateway regression suites including actual self-signed HTTPS with tls.verify:false, canonical percent/path rejection, tolerant JSON, binary/Base64, cookies and header ownership. Check rejected calls have no downstream I/O and credential bytes never enter console/history/errors/logs. Measure straightforward service setup against the 15-minute target.

For each new external input add positive and negative tests, plus concurrency/failure cases named here. Run focused/related checks while building; at milestone completion run `npm test` and `npm run build` plus the required browser/operational evidence. If full tests fail with loopback `listen EPERM`, rerun the same suite with appropriate permission, never weaken listener tests. User-facing work requires rendered browser, keyboard and narrow-width evidence for its listed UX checks. Full-suite repetition is warranted after new changes, not as ceremony. No application tests are required merely to compile this documentation.

## Known Risks / Deferred Work

Resource lifetime/publication coordination is the principal integration risk; preserve old in-flight protection without reusing stale authority. All advanced state remains lossless until milestone 13 exposes the remaining editors; no production release is claimed by this intermediate milestone.
