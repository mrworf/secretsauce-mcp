# Web console architecture review

## Scope

**Result: PASS for Product Definition.** Reviewed 2026-10-09 for `secretsauce-mcp`, at transaction baseline `9889bfe1d17a5c326046421e40367077c4e45bf3`. This evaluates the feasibility and internal consistency of the initial single-organization, self-hosted console. It is not implementation acceptance, a performance measurement, a security certification, or permission to start implementation.

Authority is the [PRD](../../docs/web-console-prd.md), its [state contract](web-console-state-contract.md) and [security contract](../security/web-console-security-contract.md), the [coverage matrix](../../docs/web-console-prd-coverage.md), [journey audit](../../docs/web-console-prd-user-journey-audit.md), and approved [UX manifest](../ux/manifest.yaml) with all nine declared artifacts. Exact validated revisions are in [the stage result](../../workflow/definition/results/architecture.yaml). D-001–D-012 and UX-DESIGN-001 remain settled. Historical wording in the bounded companion reports describes their original resolution stage; the current PRD adopts their contracts as normative.

Selective source inspection covered the gateway entry point, runtime ownership, configuration validation, policy/registry functions, audit sink, OAuth refresh persistence, request limits, and relevant regression tests. It establishes concrete integration risks, not exhaustive code correctness. Future console implementation cells correctly remain unverified in coverage and journeys.

## Executive Summary

The definition is feasible without a distributed platform. One active application instance, a durable transactional state boundary, immutable applied configuration, explicit immediate security actions, and a recoverable restore state machine are sufficient at the specified 50-user/100-service validation envelope. The approved UX reflects these boundaries: drafts differ from active settings, access changes are immediate, and recovery has a dedicated restricted flow.

The existing gateway is a useful execution core but is not already the console backend. It captures configuration at startup, currently tolerates audit failure, and implements a single built-in administrative OAuth identity. Those are planned changes under BASE-02, not newly discovered product-definition gaps. Preserve its proven destination/policy/substitution and response-protection behavior while introducing management state around it.

No unresolved material contradiction, additional product decision, or required source correction was found. The recommendations below guide implementation choices within existing requirements. Database, frontend framework, API wire format and cryptographic library selection remain delivery decisions; this review does not make those choices prerequisites for definition readiness.

## What Is Good

- **Good — Bounded deployment.** OPS-05 explicitly allows one active instance and separates operator storage/key responsibilities. `src/runtime.ts:24` owns the runtime resources and `src/builtinOAuth.ts:909` loads process-owned refresh state. A local state owner fits both this baseline and the target audience; a service mesh or shared cache would add coordination without satisfying an unmet requirement.
- **Good — Execution remains independent of management privilege.** AUTHZ-01/02, explicit identity mappings and four fixed roles avoid making every administrator an agent executor. The registry already checks service access (`src/registry.ts:90`); preserving a single current-authorization decision path is practical. The UX keeps invitation/identity management distinct from eligible-identity assignment (UX-IA04).
- **Good — Review is a configuration transaction, not delayed revocation.** STATE-01–03 specify what is draftable, what is immediate, and what history excludes. UX-IN02/03 makes those effects observable. This resolves a frequent console failure mode: an old draft or rollback silently recreating removed access.
- **Good — Recovery has a defined authority and failure outcome.** SECRES-02 and STATE-05/06 cover clean-host authority, historical Owner nomination, installation rollback, fresh enrollment, and disabled restored services. J-HOST-RESTORE and J-OWNER-RESUME provide reachable operator and browser paths. The archive is useful after host loss without becoming a bearer credential for general management.
- **Good — Advanced compatibility is explicit.** The configuration coverage table, unknown-field rejection, non-lossy form/editor switching and safe policy preview protect the gateway's existing value. `src/policy.ts:13` is already a reusable evaluation boundary; building a second browser-only policy engine would create avoidable drift.

## What Is Bad Or Risky

These are implementation risks already governed by the definition, not unresolved product gaps.

| ID | Risk and concrete evidence | Existing resolution and implication |
| --- | --- | --- |
| ARCH-OBS-01 | Static runtime capture can become mixed-revision execution when settings become editable. `src/server.ts:34` constructs one runtime, handlers use the captured config, and `src/runtime.ts:26` initializes scanners, capabilities and OAuth from it. | CONFIG-03 and STATE-02 require coherent activation and current admission. An apply must prepare a complete candidate and deliberately retire old resources after admitted work finishes; merely changing one object field is insufficient. |
| ARCH-OBS-02 | Existing audit completion is not proof of durability. `src/audit.ts:110` records in memory and returns on unavailable/degraded output; its file operations use writes without a durable-commit acknowledgement. `test/audit.test.ts:222` deliberately expects execution to continue on append failure. | BASE-02, AUDIT-04 and SECRES-04 intentionally change this behavior. The new sensitive-operation boundary needs a durable success/failure contract, including before dispatch. Existing sanitization should remain; the old fail-open assertion must be replaced as part of that behavior change. |
| ARCH-OBS-03 | Live identity, references, drafts and backups have different lifetimes. `src/tokens.ts:73` owns live references, `src/builtinOAuth.ts:909` owns persisted refresh state, and `src/config.ts:233` resolves configured sources into runtime data. Treating these as one serializable object risks leaking secrets or restoring access. | BACKUP-01, STATE-03/04/06 and SECRES-01 define inclusion, exclusion and invalidation. Maintain explicit data projections for management reads, history, exports, runtime execution and encrypted recovery. |
| ARCH-OBS-04 | Restore spans storage, keys, audit history and authentication state. A successful archive decrypt does not prove a crash-safe installation; reverting to the archive also cannot restore excluded MFA after a failed install. | STATE-05 requires a protected local rollback source distinct from export backup, a recoverable installation boundary and failure evidence. STATE-06 preserves the local audit tail independently. Test each interruption boundary, rather than only a successful restore. |
| ARCH-OBS-05 | Years of audit data, archive processing and configurable regexes may cost more than the small user/service count suggests. Existing policy matching executes regular expressions (`src/policy.ts:48`), while request limits are runtime-owned (`src/serviceRequestLimiter.ts:4`). | OPS-01–04, existing scanner limits and the external-input acceptance contract require bounded processing and capacity behavior. Benchmark the complete workload; do not equate 100 services with a maximum audit volume or silently reset live counters on apply. |

The accepted trust boundaries remain unchanged: configuring credential destinations is a trusted administrative capability (AUTHZ-04/D-012), response scanning is best-effort (BASE-01/D-012), and host administrators can defeat local evidence protection (AUDIT-03). Legacy bearer use retains shared attribution (MCP-02/D-011). This review neither expands those accepted risks nor proposes them as new approvals.

## What Should Change

### Keep one application with clear internal responsibilities

Use a small number of internal boundaries within the supported application: management commands and queries; identity/current permission evaluation; versioned configuration preparation and activation; gateway execution; durable audit; and backup/recovery coordination. Separate modules and interfaces are enough. Browser, MCP and scheduled jobs must invoke the same underlying permissions and operation-state rules, so a hidden button is never the enforcement point.

This is a recommendation about maintainability, not a mandate for separate services. It follows AUTHZ-02, SECRES-04 and STATE-02. Existing gateway and scanner modules should remain usable behind these boundaries rather than being rewritten to match the console framework.

### Establish durable state and failure semantics before exposing mutations

The persistence design must support atomic changes, uniqueness and dependency checks, schema/version compatibility, and recoverable interruption. A local transactional store is a reasonable default candidate. For example, SQLite documents atomic transactions and a consistent snapshot backup API; those support feasibility, but neither alone provides encrypted application archives or the required multi-component restore workflow. Storage durability also depends on the underlying filesystem and flush behavior. [SQLite atomic commit](https://www.sqlite.org/atomiccommit.html), [SQLite backup API](https://www.sqlite.org/backup.html) (checked 2026-10-09).

Keep durable identities and grants, encrypted secret material, draft/applied configuration, and audit provenance logically distinct even if they share storage infrastructure. Enforce one writable application instance. Keep live references ephemeral and refresh-token persistence hash-only as required by repository policy; UI-created managed credentials do not justify persisting raw transport tokens. Restart should reload only committed compatible state or enter a restricted recoverable state, never silently fall back to stale YAML.

Document how storage commit, audit admission and runtime publication are ordered. A durable operation identity/status lets the UI resolve a lost response without blindly replaying an apply, invitation, credential change or restore. This realizes UX-IN05 and AUDIT-01; it does not require a message broker or exactly-once downstream effects. A recorded start without a completion is uncertain evidence, not proof that a remote call can be repeated.

### Preserve one policy model and one coherent execution context

Create managed configuration schemas that retain all supported advanced values, then adapt them to the existing gateway model. Separate structural validation from environment/file resolution: `validateConfig` currently accepts ambient environment and file credential sources, which must not become a web-accessible host file reader (BASE-03). Migration should resolve only explicit operator-provided sources and turn identity strings into deliberately approved mappings.

Forms, advanced editor, import and preview should share these schemas and existing canonical target/policy logic. Compile exact/prefix conveniences into unambiguous runtime matching; preserve imported regex source and stable priority ties. A preview reports policy under its inspected revision, not permission to execute later.

Prepare candidate scanners, destinations and other resources before activation. Current permissions, dependencies and audit readiness must be checked at the ordered admission boundary. Keep the admitted revision and credential-response protection context alive until each dispatched operation finishes; release obsolete resources afterward. Preserve unaffected references, enforce invalidation for affected references, and never allow an old completion to revive access. Live capacity accounting must survive configuration changes without resetting active usage or permitting a second quota allocation.

### Make recovery and key dependencies explicit implementation contracts

Choose established cryptographic mechanisms under the security review, and document which protected material is needed for normal startup versus clean-host recovery. BACKUP-02 requires recovery material independent of the lost installation. This means an archive cannot depend solely on a missing host master key. Conversely, shipping an archive must not expose a plaintext master key. Changing recovery material must have an understandable relationship to already-created archives and their required recovery material; do not silently invalidate recovery of retained backups.

Backup capture must establish the consistent point, selected audit boundary and included dependencies before publishing a completed archive. Bound archive input size, extracted size, object counts, processing time and temporary disk consumption; reject unsafe entries before replacement. These are concrete ways to satisfy BACKUP-03 and the all-external-input test contract, not another backup product.

The restore coordinator should own the durable maintenance/install/recovery progress, the protected prior installation and the archive-bound continuation. Keep pre-restore failure evidence outside the replaceable snapshot and distinguish imported provenance. A local rollback can restore the previous coherent credential/MFA store after a failed installation while still requiring fresh login and refusing invalidated sessions/references. After successful installation, only the new recovery path can unlock management. Test both paths as separate states.

### Keep deployment, background work and UI practical

Serve the console from the existing application or a comparably small deployment unit; do not require extra infrastructure for routine configuration. Document separate administrative reachability and public MCP/OAuth endpoint exposure. Trusted proxy handling must be explicit and must not derive capability-link origin from arbitrary request headers (OPS-05/SECRES-01). Real ChatGPT and Codex exercises remain necessary; internal HTTP tests cannot prove those clients' consent/reconnect behavior.

Use bounded local background jobs for backups, retention and SMTP, with durable observable job outcomes where required. SMTP failures must not roll back already-recorded enrollment state or imply acceptance. Backup retention cannot delete the last good archive because a replacement is incomplete; storage exhaustion must degrade explicitly rather than override retention. Audit search/export should use bounded page/stream processing and current access scope. None of this needs a general workflow engine.

The approved service-first UX, reusable role-sensitive views, grouped editor and full-page recovery are consistent with these boundaries. Share form/diff/status components so all paths show the same field meanings and operation state. Routine responsive and keyboard behavior can be delivered with the same browser application; no second mobile backend is justified.

### Carry the existing acceptance obligations into delivery

| Boundary | Required evidence before implementation acceptance |
| --- | --- |
| Identity and RBAC | All permission-matrix cells, direct unauthorized requests, last-Owner races, MFA/recovery replay and disabled identity/grant admission |
| Configuration and gateway | Advanced round trips; unknown fields; stale apply/dependency/role changes; atomic activation failure; no mixed revisions; existing five-tool regressions including real self-signed TLS, tolerant JSON, binary and Base64 |
| Durable audit | Positive durable start/commit; disk-full, permission, interrupted write and restart cases; uncertain completion; every sensitive route/job blocks before effects; restricted diagnostic sessions never auto-upgrade |
| Recovery | Concurrent apply/rotation during snapshot; archive corruption/wrong key/unsafe entries; interruption at installation boundaries; local rollback retains prior store and newer evidence; clean-host recovery with missing original host; old authentication rejected |
| Capacity and operations | 50 users/100 services with representative audit workload; limit lowering preserves active usage; bounded regex/archive/import/export/background work; actionable degraded health; practical RPO/RTO exercises |
| Browser/client behavior | UX-C01–25, keyboard/reflow and task timings; lost response yields status reconciliation; real ChatGPT/Codex consent, request, revocation, restart and reconnect |

This table consolidates already-required evidence; it is not a new milestone packet. Mechanism-specific tests belong beside the later implementation that chooses the mechanism.

## What I Would Not Change Yet

- **Do not change yet — Deployment topology.** No tenancy substrate, active-active gateway, distributed cache, external database service or job broker is justified by the accepted operating envelope. Revisit only with measured demand and a new product decision.
- **Do not change yet — Role and integration model.** Keep four fixed roles, explicit assignments, generic tools and minimal MCP OAuth. Custom roles, groups, SSO and service packs would increase migration and authorization complexity beyond this release.
- **Do not change yet — Working gateway algorithms.** Preserve destination checks, canonical-path evaluation, tolerant source-range JSON protection, header enforcement and scanner behavior unless the new state boundary requires a narrow adapter. Broad refactoring would dilute preservation evidence.
- **Do not change yet — Recovery scope.** Whole-instance replacement and operator-managed off-host copying satisfy the accepted intent. Selective restore, cross-instance merge and remote-storage integrations would create new reconciliation and authority cases.
- **Do not change yet — Exact UI/framework/storage selection.** The approved behavior and architecture constraints are sufficient to plan delivery. Choose supported mechanisms during implementation planning; do not turn vendor selection into a speculative product-approval cycle.

## Overall Opinion

The combined definition has adequate behavioral precision and a credible simple implementation shape. Architecture passes with no blocking questions, reconciliation requirement, or change to upstream authority. The remaining risks are implementation obligations already identified by the PRD and contracts; they must be proven through delivery, not silently treated as completed by this review.

Validation for this documentation-only stage checks exact input hashes, result structure, report links, and whitespace/diff integrity. No application code or executable configuration changed, and no application test/build was run. Existing test references are inspected evidence only. The parent orchestrator owns the coherent definition commit and downstream handoff.
