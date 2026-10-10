# Milestone 15: Operate and inspect the managed instance

## Objective

Give authorized operators usable evidence, effective limits and deployment health for the now-complete configuration and client surfaces.

## User/System Outcome

Owners control capacity and retention; administrators/auditors investigate authorized evidence; Members inspect only their own activity; a documented Docker deployment preserves state and separates public MCP from private administration.

## Scope

Activity search/details/export and operational inventories; tamper checks/retention; all existing limits with consumption and capacity behavior; authenticated/public health; one-instance Docker/proxy/key/storage guidance; 50-user/100-service operating-envelope and task validation.

## Explicit Exclusions

No billing tiers, arbitrary 50/100 hard cap, distributed deployment, compliance workflow engine or SOC 2 certification badge. Backup job health and archive retention are integrated by 16; recovery evidence by 17.

## Source Requirements

[PRD](../../../docs/web-console-prd.md) and normative contracts: `AUTHZ-02`, `AUDIT-01`, `AUDIT-02`, `AUDIT-03`, `AUDIT-04`, `OPS-01`, `OPS-02`, `OPS-03`, `OPS-04`, `OPS-05`, `OPS-06`, `CONFIG-03`, `CAP-CFG-06`, `CAP-ACCEPT-01`, `SEC-01`, `SEC-03`, `MCP-04`, `UX-01`, `UX-02`, `UX-03`, `UX-04`, `SECRES-04`.

[Journey audit](../../../docs/web-console-prd-user-journey-audit.md): J-OWNER-ACTIVITY, J-ADMIN-ACTIVITY, J-AUDITOR-ACTIVITY, J-MEMBER-ACTIVITY, J-OWNER-SETTINGS, J-SYSTEM-ADMISSION, J-PUBLIC-01, J-HOST-01. Shared sources/revisions and preservation rules are in [index](index.md); exact coverage rows are in [traceability](traceability.md).

## Preconditions

13 supplies complete policy/catalog configuration and import/export; 14 supplies client/identity inventories and authentication limits. Their transitive audit events, operation states and shared settings transaction are the authoritative source for these views and controls.


Readiness prerequisite IDs resolve to the [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).

- `PRE-001–005` — committed authority, existing regression/build baseline, declared Node/npm/packages, writable loopback test execution and an available browser; current facilities verified with the limitations in the readiness report.
- `PRE-007`, `PRE-008`, `PRE-009`, `PRE-010`, `PRE-011` — the earlier providers named above must be completed with committed acceptance evidence before this milestone begins; currently pending implementation.
- `PRE-014` — this milestone owns its specific positive/negative and failure fixtures; reuse earlier declared harnesses, never undeclared local packages.
- `PRE-016` — host operator/CI maintainer supplies permitted Docker and isolated persistent/disposable storage before operational validation. Current sandbox daemon access is denied; record the manifest’s completion evidence before acceptance.

## Readiness checks

- Inspect `delivery/milestones/secretsauce-mcp/status.yaml` and the committed planning handoff: this milestone is selected explicitly, source revisions still match, and all direct dependencies are completed with evidence. The legacy next-MVP selector targets the historical packet and must not select this work.
- Run `node --version` and `npm --version`; Node satisfies `package.json` (>=22). On a fresh checkout run `npm ci`; installed dependencies come from the lockfile. CI remains Node22. Use writable temp storage and loopback permissions; if `npm test` reports `listen EPERM`, rerun the identical suite with permission per AGENTS.md.
- Confirm `npm run build` and `npm test` remain the documented baseline commands (a newly executed result is required at milestone acceptance; readiness’s existing baseline is not feature evidence). Inspect previous milestone validation before modifying shared contracts.
- Inspect the browser procedure/harness and available browser before UI validation; it must load the implemented local page and support keyboard and 320px checks without depending on undeclared cached packages. New commands are recorded by the owning implementation, not invented here.
- On the authorized test host run `docker version` and `docker compose version`; both must succeed with server access. Inspect writable independent mounts and disposable target capacity before using the owning milestone’s smoke/drill instructions. Missing host access blocks those validation steps.

## Functional Requirements

- Activity filters time/actor/service/action/result/request ID, shows sanitized detail, admitted revision, denial reason and uncertain recorded outcome. Service Activity reuses the same view. Owner/Administrator/Auditor search/export authorized instance evidence; Member sees only own permitted activity without global export.
- Provide exportable access inventory, configuration/security-exception report, audit history, version and available backup/restore outcomes. Filtered export enforces identical current scope and sanitization, bounded work and mandatory audit. Product interfaces cannot edit individual events; verify tamper evidence and preserve attributed retention deletion.
- Owner retention defaults to 365 days for audit. Review deletion impact before applying shorter retention; exhaustion never silently overrides policy. Retention background work shares durable admission. Explain external copies are needed against hostile host alteration and host loss.
- Expose all existing request/response/concurrency/reference/denial/authentication/scanning limits with units, effective value, consumption and capacity result. Preserve defaults including global/subject/service concurrency 32/4/8, body 1 MiB, response 5 MiB and downstream timeout 30 seconds. Lowering below usage blocks new allocation without evicting/resetting active state; reject invalid combinations atomically.
- Display gateway/storage/audit/scanner/SMTP/backup health and actionable missing-key/degraded/capacity notices. Until backup jobs exist, state unavailable/pending capability honestly, not healthy. Public health exposes bounded status only. Audit-outage views use 10's restricted behavior; repair never becomes a web bypass.
- Support one active application instance with persistent app/audit mounts, backup mount and stable encryption/signing material. Docker defaults keep opaque references ephemeral. Trusted forwarded headers only from configured proxies; remote browser/MCP uses HTTPS while administrative UI may stay private. Routine management needs no container edit/restart.
- Document deployment/proxy, role boundaries, client setup, migration, audit, credential rotation, off-host copying, patching/access review/incident/host responsibilities; no compliance claim. Run full configuration-surface coverage and realistic 50-user/100-service workload including retained audit, quotas and bounded background work.

## UX Constraints

UX-IA03/04 places Activity, limits, inherited settings and health coherently. UX-IN05 shows unknown outcomes/limit recovery and persistent degradation; UX-EX01 labels read-only audit outage. UX-C14/24 requires units, scope, admitted revision and retention deletion impact. All permitted non-secret read-only settings remain available to Auditor; Owner-only writes do not accidentally hide Administrator scanner editing.

All affected pages inherit [UX-R01–03](../../../product/ux/03-responsive-and-platform.md), [UX-V01–03](../../../product/ux/04-visual-system.md) and [UX-A01–04](../../../product/ux/05-accessibility.md): calm moderate-density service-first hierarchy, text/icon state, visible focus/labels/errors/status announcements, keyboard-only completion, no hover/drag-only action, accessible confirmation focus return, and routine reflow at 320 CSS px. Narrow layouts retain essential actions, My account and logout. Loading/empty/validation/forbidden/offline/expired/failed states preserve safe non-secret context and never fabricate success. The approved concepts guide composition, not missing-feature exemptions or exact pixels.

Required [observable checks](../../../product/ux/07-acceptance-checklist.md): UX-C01, UX-C04, UX-C14, UX-C15, UX-C16, UX-C20, UX-C21, UX-C22, UX-C24, UX-C25. IA and IN/EX references resolve to the canonical [UX manifest](../../../product/ux/manifest.yaml).

## Architecture / Security Constraints

Sanitize caller-controlled labels/paths/reasons and exclude raw credentials, tokens, headers/cookies, recovery links/seeds and request/response bodies from audit and reports. Bound pagination/export/regex/background processing. Fail-closed policy includes evidence exports and retention. Database, tamper-evidence mechanism and metrics implementation are engineering choices, not independent product milestones.

## Interfaces and Compatibility

Expose role-scoped queries and exports over current managed state without adding a separate analytics store or compliance service. Docker/reverse-proxy examples use example.org. Preserve existing gateway defaults and local Docker metadata generation; no docker/metadata-action reintroduction. Audit projection leaves room for original/imported provenance consumed by 17.

## Acceptance Criteria

- [ ] Each authorized actor can investigate correct evidence and export only allowed scope; direct foreign-object/filter requests and secret-bearing labels cannot escape sanitization.
- [ ] All existing limits are editable/visible, invalid settings fail atomically and lowering capacity preserves active usage while blocking new allocations.
- [ ] Disk-full/tamper/SMTP/key/capacity cases have truthful role-safe health and mandatory audit behavior; public status leaks no configuration.
- [ ] A one-instance persistent Docker/proxy deployment and restart work; 50 users/100 services are validated without arbitrary tier caps; denial investigation meets two minutes and user disable one minute.

## Required Validation

Audit filters/export malformed/boundary inputs, member/global access negatives, log injection, integrity verification, retained record deletion evidence, long/large export bounds, disk/permission failures. Limit edges and concurrent apply without counter reset, noisy-user containment, scan/regex resource limits, untrusted proxy headers, missing mount/key and second writer. Docker smoke and restart with retained configuration/refresh/audit and ephemeral references. Browser complete field coverage plus UX task timings and 320px/keyboard states. Record operating-envelope workload and observed resource behavior without inventing throughput guarantees.

For each new external input add positive and negative tests, plus concurrency/failure cases named here. Run focused/related checks while building; at milestone completion run `npm test` and `npm run build` plus the required browser/operational evidence. If full tests fail with loopback `listen EPERM`, rerun the same suite with appropriate permission, never weaken listener tests. User-facing work requires rendered browser, keyboard and narrow-width evidence for its listed UX checks. Full-suite repetition is warranted after new changes, not as ceremony. No application tests are required merely to compile this documentation.

## Known Risks / Deferred Work

365-day audit volume depends on workload, not only user/service count; validate bounded storage/search and explicit exhaustion. Local tamper evidence cannot defend against a hostile host administrator. Real deployment tooling availability is for readiness to classify, not grounds to weaken required evidence.
