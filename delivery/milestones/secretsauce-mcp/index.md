# SecretSauce web console delivery packet

**Mode:** PRODUCT_BUILD. **Product:** `secretsauce-mcp`. **State:** compiled contracts, all implementation pending; readiness is a separate downstream audit. This packet delivers the approved single-organization self-hosted console while preserving the existing gateway. It does not restore the earlier superseded multi-tenant SaaS direction.

## Authority and provenance

The [definition package](../../../workflow/definition/definition-package.yaml) is `ready_for_delivery_planning`, revision `sha256:44c2c2338ed74a26867fdd374988bb73c4bd6ed1179e99a7a329b26acf59f6e1`, producer commit `06dd0ee59defd1a75db121f1d8133c7100238b80` (provenance closeout `bb6f29cd318b77c2cf70efa5b1f9adaf25fdf2cb`). Its six passed definition stages are consumed, not rerun. [Status](status.yaml) pins all detailed source revisions under `compiled_from`; the package remains the authoritative locator.

| Source class | Sources and use |
| --- | --- |
| Implementation required | PRD BASE/AUTHZ/IDENT/CONFIG/POLICY/MCP/UX/AUDIT/SEC/BACKUP/OPS/MIGRATE requirements and configuration/acceptance tables; normative SECRES-01–04 and STATE-01–06; approved UX rules/checklist. |
| Governing constraints | Security/state contracts, accepted D-001–D-012 and UX-DESIGN-001, approved UX manifest `web-console-ux-1`, architecture/security review interpretations, AGENTS.md gateway invariants. |
| Context/evidence | Coverage and journey audits organize traceability; review observations and source samples establish risks/preservation baseline. They do not independently authorize new features. |
| Excluded | Explicit non-goals, accepted trust limitations and optional technology recommendations; see traceability dispositions. |
| Blocked | No unresolved authoritative product/UX/security/architecture decision. Environment readiness remains unassessed here. |

## Milestones and dependency contracts

IDs continue after the existing completed 00–09 to avoid ambiguity. The historical packet `docs/milestones/status.yaml` remains unchanged. No active web-console packet existed, so this new scope uses canonical `delivery/milestones/secretsauce-mcp/`. The project-local next-MVP selector is hard-coded to the historical packet; use the explicit new manifest through milestone-delivery-orchestrator after readiness. Do not retarget or rewrite completed history merely to select this scope.

| ID | Outcome / contract | Direct prerequisites | Status |
| --- | --- | --- | --- |
| 10 | [Establish secure audited console access](10-secure-audited-setup.md) | Existing gateway baseline | pending |
| 11 | [Configure and activate services safely](11-managed-service-configuration.md) | 10 | pending |
| 12 | [Manage people and recover accounts](12-people-and-account-recovery.md) | 11 | pending |
| 13 | [Author advanced policy and migrate configuration](13-advanced-policy-and-migration.md) | 12 | pending |
| 14 | [Connect and govern MCP clients](14-mcp-client-access.md) | 12 | pending |
| 15 | [Operate and inspect the managed instance](15-operating-evidence-and-limits.md) | 13, 14 | pending |
| 16 | [Create recoverable encrypted instance backups](16-encrypted-instance-backups.md) | 15 | pending |
| 17 | [Restore and resume an instance safely](17-safe-instance-recovery.md) | 16 | pending |

The dependency graph is **10 → 11 → 12 → {13, 14} → 15 → 16 → 17**. Secure durable admission precedes mutations; the shared configuration transaction precedes SMTP/authentication settings; people/assignments precede complete migration and client flows. Policy/import (13) and MCP clients (14) are independent after 12; each consumes the explicit identity registry from 12; their combined imported-client integration is checked once both exist. Operations (15) consumes all configuration/client state before backups capture the complete persisted product (16), then restore consumes that archive contract (17).

Each milestone is a usable vertical outcome including persistence, authorization, UI/interfaces, failure states and evidence. Shared foundations are observable setup/admission and live configuration, not generic infrastructure phases. Closely related findings are folded into their owning outcome; no standalone database, API, UI, technology-choice, M0 or implementation-slice milestone is introduced.

## Shared preservation and delivery rules

1. Preserve the five MCP tools and supported schemas; per-POST authentication; subject/service-bound ephemeral references; no trusted transport session ID; cookies, Base64/binary, tolerant JSON source-range replacement and header enforcement. Keep destination/current authorization/canonical policy before substitution or downstream I/O. Actual self-signed TLS regression is mandatory when transport changes.
2. Role permissions, explicit execution assignments, current admission and mandatory durable audit apply on server interfaces, background jobs, imports/history and UI. No permission solely enforced by hiding controls. Every new event excludes raw credentials/tokens/headers/cookies/proofs/seeds and bodies by default.
3. Draft/apply, immediate value/access/lifecycle actions and recovery are separate state transitions. Sanitized history cannot resurrect access, lifecycle or secrets. Already-dispatched work may complete under its admitted protection context; no remote rollback or universal non-exfiltration promise.
4. One active instance, durable encrypted state/keys/audit, atomic hash-only refresh snapshots, ephemeral references and UI-managed routine settings. Preserve working gateway modules rather than rebuild algorithms to fit a frontend choice. No mandatory external database, identity provider, broker or Kubernetes.
5. Approved UX sources are linked in each contract with relevant rules and observable criteria. Four-area service-first navigation, safe operation-status reconciliation, accessible moderate density, progressive disclosure, secret-safe forms and full-page review/recovery apply across views. No inert prototype control counts as delivered behavior.
6. Every new external input has positive and negative tests. At milestone completion run `npm test`, `npm run build`, applicable browser/accessibility and named operational/client evidence. Per-slice planning/commits belong to subsequent minimal-slice-delivery, not this packet. Documentation generation is not runtime validation or release acceptance.
7. Finish relevant runbook/docs with each outcome; use `example.org` examples. Separate OAuth origin from full ChatGPT MCP URL. Keep Docker metadata generation local and tested. Operator responsibilities include off-host copies, patching, access review, incident response and host security; software does not establish SOC 2 compliance.

## Coverage and handoff

[Traceability](traceability.md) maps 53 PRD IDs, 10 companion contracts, seven derived families (97 detailed coverage rows), 47 actor journeys and all 25 UX checks. Repeated audit/authorization/UX IDs are consuming-boundary requirements, not duplicate independent features. There is no unmapped or deferred required source work and no source blocker.

Compilation validation checks current committed source provenance, schema/paths, all mandatory milestone sections, backward dependencies, exact traceability, approved UX propagation, local links and preservation of historical milestones. No application code or configuration changes here; no application test/build is run for this planning-only packet. The compiler result in `workflow/delivery-planning/results/compiler.yaml` records exact checks and artifact revisions.

**Next:** milestone-readiness audits prerequisites and clean-environment executability, performs authorized local readiness work and records any external dependencies. Delivery Planning owns the combined commit/handoff. Do not start implementation from this compilation checkpoint alone. No M0 is presumed; only readiness may justify one.
