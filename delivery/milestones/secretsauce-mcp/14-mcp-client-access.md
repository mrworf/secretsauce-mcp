# Milestone 14: Connect and govern MCP clients

## Objective

Connect enrolled people through normal per-user MCP OAuth while preserving explicitly configured external and legacy access.

## User/System Outcome

Assigned eligible users connect ChatGPT and Codex, consent, call the five tools and revoke clients; restart and mode changes have clear safe recovery behavior.

## Scope

Multi-user built-in OAuth, per-user consent/grants and connected-client controls; Owner authentication settings, explicit external issuer/subject registrations and advanced legacy bearer; client setup instructions and restart/revocation integration.

## Explicit Exclusions

No browser SSO, SAML/OIDC/SCIM or service-specific tools. External and bearer modes never grant console access. No automatic private-instance publication or live-secret-bearing setup links.

## Source Requirements

[PRD](../../../docs/web-console-prd.md) and normative contracts: `BASE-01`, `AUTHZ-01`, `AUTHZ-02`, `IDENT-02`, `IDENT-06`, `MCP-01`, `MCP-02`, `MCP-03`, `MCP-04`, `CONFIG-03`, `SEC-01`, `SEC-02`, `SEC-03`, `CAP-CFG-06`, `MIGRATE-01`, `MIGRATE-04`, `SECRES-01`, `STATE-02`, `UX-01`, `UX-03`, `UX-04`.

[Journey audit](../../../docs/web-console-prd-user-journey-audit.md): J-OWNER-CLIENT, J-ADMIN-CLIENT, J-MEMBER-CLIENT, J-EXTERNAL-01, J-LEGACY-01, J-MCP-01, J-MCP-RESTART. Shared sources/revisions and preservation rules are in [index](index.md); exact coverage rows are in [traceability](traceability.md).

## Preconditions

12 provides human MFA enrollment, role lifecycle and account/grant revocation; 11 provides service assignment and current admission. 12 also provides the explicit external issuer/subject registry. This milestone is independent of 13's advanced editor; both consume that registry.


Readiness prerequisite IDs resolve to the [prerequisite manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md).

- `PRE-001–005` — committed authority, existing regression/build baseline, declared Node/npm/packages, writable loopback test execution and an available browser; current facilities verified with the limitations in the readiness report.
- `PRE-007`, `PRE-008`, `PRE-009` — the earlier providers named above must be completed with committed acceptance evidence before this milestone begins; currently pending implementation.
- `PRE-014` — this milestone owns its specific positive/negative and failure fixtures; reuse earlier declared harnesses, never undeclared local packages.
- `PRE-015` — Product Owner/authorized tester supplies real ChatGPT and Codex access/reachability and recorded client evidence at this milestone’s acceptance. This dependency is unverified and cannot be waived by protocol mocks.

## Readiness checks

- Inspect `delivery/milestones/secretsauce-mcp/status.yaml` and the committed planning handoff: this milestone is selected explicitly, source revisions still match, and all direct dependencies are completed with evidence. The legacy next-MVP selector targets the historical packet and must not select this work.
- Run `node --version` and `npm --version`; Node satisfies `package.json` (>=22). On a fresh checkout run `npm ci`; installed dependencies come from the lockfile. CI remains Node22. Use writable temp storage and loopback permissions; if `npm test` reports `listen EPERM`, rerun the identical suite with permission per AGENTS.md.
- Confirm `npm run build` and `npm test` remain the documented baseline commands (a newly executed result is required at milestone acceptance; readiness’s existing baseline is not feature evidence). Inspect previous milestone validation before modifying shared contracts.
- Inspect the browser procedure/harness and available browser before UI validation; it must load the implemented local page and support keyboard and 320px checks without depending on undeclared cached packages. New commands are recorded by the owning implementation, not invented here.
- Inspect the PRE-015 tester/reachability authorization record and, before completion, the real-client evidence listed in the manifest; missing evidence blocks acceptance. Do not request or log token values.

## Functional Requirements

- Built-in consent requires enrolled current user with password/MFA; show client, scopes and identity separately from service assignments. Preserve PKCE, client restrictions, scope/principal choices, token lifetimes, refresh rotation/replay detection and bounded secure metadata retrieval.
- Users inspect/revoke own connected clients; Owners revoke target sessions/grants. Consent does not assign a service. Owner/Administrator require explicit eligible assignments just like Member; Auditor cannot execute. Disabled accounts, removed grants/assignments and audit failure deny next admission, including existing references and queued work.
- Owner-only Settings supports built-in options and advanced external OAuth validation and legacy bearer mode through scoped review/apply with recent authentication. External identities are registered by issuer plus subject and assigned explicitly. Legacy bearer clearly has shared attribution. Neither external credentials nor bearer authorize console operations.
- Runtime authenticates every MCP POST independently and never issues/trusts mcp-session-id. Preserve all five tool formats, ownership-bound references and denials, error surfaces and request/response protections. OAuth metadata fetch remains public-address-only, DNS-pinned, redirect-free and bounded, independently of private downstream support.
- Persist committed configuration, encrypted secrets, stable signing material and atomic hash-only refresh snapshots across normal restart with one process owner. Gateway/response references stay ephemeral; reconnect/reacquire guidance distinguishes refresh continuity from lost references.
- Provide distinct ChatGPT and Codex flows with secret-free copy details. Display OAuth resource/issuer origin separately from complete MCP URL, e.g. https://mcp.example.org and https://mcp.example.org/mcp. Explain network reachability without requiring public console exposure.
- Finish external-identity import integration: deliberate registered issuer/subject mapping and assignment, unresolved or merely email-equal identities denied. Warn on endpoint/authentication changes and preserve immediate invalidation semantics. Document mode limitations and reconnect steps.

## UX Constraints

UX-IA04 separates own connected clients, Owner identity settings and assignment; UX-EX05 keeps advanced/shared-attribution modes secondary with no-console-access labels. UX-IN05 handles expired consent, client denial, unavailable metadata, unknown revoke outcome and restart guidance without raw tokens. UX-IN03 requires action-bound recent authentication for authentication-setting changes. Auditor has no execute/connect action.

All affected pages inherit [UX-R01–03](../../../product/ux/03-responsive-and-platform.md), [UX-V01–03](../../../product/ux/04-visual-system.md) and [UX-A01–04](../../../product/ux/05-accessibility.md): calm moderate-density service-first hierarchy, text/icon state, visible focus/labels/errors/status announcements, keyboard-only completion, no hover/drag-only action, accessible confirmation focus return, and routine reflow at 320 CSS px. Narrow layouts retain essential actions, My account and logout. Loading/empty/validation/forbidden/offline/expired/failed states preserve safe non-secret context and never fabricate success. The approved concepts guide composition, not missing-feature exemptions or exact pixels.

Required [observable checks](../../../product/ux/07-acceptance-checklist.md): UX-C01, UX-C07, UX-C13, UX-C15, UX-C20, UX-C21, UX-C22. IA and IN/EX references resolve to the canonical [UX manifest](../../../product/ux/manifest.yaml).

## Architecture / Security Constraints

SECRES-01 permits only required short-lived PKCE-bound authorization-code redirects; reusable tokens never enter management URLs/logs/browser persistent application storage. Current role/assignment checks are server enforced per operation. Keep exact gateway restrictions, secure metadata boundary and hash-only refresh state mandated by AGENTS.md; do not infer stronger isolation from scanning.

## Interfaces and Compatibility

Preserve ChatGPT and Codex MCP compatibility and five tools; replace single-admin built-in identity with enrolled multi-user authorization as BASE-02 permits. Retain external/bearer runtime modes through explicit registration. No transport sessions are introduced. Existing durable refresh format changes, if needed, require safe documented migration rather than raw-token persistence.

## Acceptance Criteria

- [ ] Real ChatGPT and Codex each demonstrate consent, discovery, reference issuance, request, denial explanation, revoke, normal restart and reconnect against a synthetic assigned service.
- [ ] Unassigned privileged user, Auditor, disabled identity, revoked grant and stale queued request cannot dispatch; external/bearer credentials cannot enter console.
- [ ] Valid refresh survives normal restart while replay and revoked state fail; ephemeral references must be reacquired.
- [ ] Advanced modes retain configuration and explicit attribution; origin/full-URL guidance is correct and no secret is copied into setup details.

## Required Validation

Positive/negative OAuth endpoints and client settings, PKCE/redirect/scope/replay, per-user grant ownership, registration pair mismatch, cross-service references, audit outage issuance/refresh, metadata DNS/redirect/private-address/size/time/cache/concurrency limits. Run existing MCP/OAuth regression suites. Real-client exercises require authorized test accounts/reachability and are recorded as implementation evidence, not replaced by protocol mocks; readiness classifies their environmental availability. Verify external import together with 13 when present.

For each new external input add positive and negative tests, plus concurrency/failure cases named here. Run focused/related checks while building; at milestone completion run `npm test` and `npm run build` plus the required browser/operational evidence. If full tests fail with loopback `listen EPERM`, rerun the same suite with appropriate permission, never weaken listener tests. User-facing work requires rendered browser, keyboard and narrow-width evidence for its listed UX checks. Full-suite repetition is warranted after new changes, not as ceremony. No application tests are required merely to compile this documentation.

## Known Risks / Deferred Work

Real client/account access may be an external execution prerequisite; do not claim interoperability from mocks or invent a production exposure requirement. Protocol/client behavior can evolve; implementation verifies current primary specifications while preserving settled behavior. No additional OAuth modes are authorized.
