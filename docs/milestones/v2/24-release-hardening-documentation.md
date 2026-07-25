# Milestone 24: Release Hardening And Documentation

## Purpose and why

Validate SecretSauce v2 as one coherent, operable small-instance product and close documentation, accessibility, deployment, compatibility, and performance gaps that cannot be proven by isolated feature milestones.

## Dependencies

- Milestones 00–23.

## PRD traceability

- Sections 3–5: product principles, goals, and non-goals.
- Sections 21, 32–38, and 41–42: UX, deployment, acceptance, scale, testing, documentation, rollout, traceability, and standards.
- Section 43: readiness and review completion.

## Scope

- Complete product-wide responsive, keyboard, focus, semantic-label, destructive-action, confirmation, and SecretSauce branding review.
- Verify every role/API-role navigation item, editor, warning, quick link, empty/error/loading state, and unauthorized route.
- Validate OpenAPI against runtime schemas and document browser/API-key/CLI authentication, errors, pagination, ETags, idempotency, and secret inputs.
- Run performance/scale validation for users, services, credentials, rules, grants, control-plane reads, audit search, and bounded background work.
- Finalize Docker image/Compose deployment for one instance with durable database, vault, signing/encryption keys, and audit storage and with ephemeral opaque gateway references.
- Add separate MCP/OAuth and web reverse-proxy examples using `example.org`, clearly distinguishing OAuth origins from ChatGPT's MCP URL containing `/mcp`.
- Complete role/permissions, enrollment/recovery, OIDC MFA, NIST password, TOTP limitation, sessions/step-up, groups, policy algorithm, API-key matrix, vault threat model, audits, backup/restore, migration, operations, and single-instance documentation.
- Run end-to-end ChatGPT and Codex OAuth/MCP compatibility, restart/revocation, degraded-component, backup/restore, and migration journeys.
- Review security invariants and non-goals for accidental scope expansion.

## Not in scope

- New product capabilities, service-specific tools/profile packs, multi-replica support, enterprise IAM, SaaS operations, or opportunistic architecture rewrites.
- Waiving failed security, compatibility, performance, or full-suite gates.
- Marketing response scanning as universal exfiltration prevention.

## Required behavior and interfaces

- Deployment starts privileged service operation only when database schema, vault, required keys, audit, jobs, and activation state are ready.
- MCP remains stateless and compatible with both ChatGPT and Codex using the documented public URLs.
- All supported management API behavior appears accurately in OpenAPI and product documentation.
- Wide and narrow UX meets approved accessibility/responsive criteria and never renders secret/reference values.
- Operator documentation states backup exclusions, restore consequences, migration identity loss, topology limitations, and response-protection limitations plainly.

## Security, authorization, invalidation, and audit

- Perform a final table-driven role/API-role and cross-service authorization audit.
- Search built artifacts, examples, logs, audits, backups, rendered pages, and test output for prohibited credential/token/reference/internal-host data.
- Exercise all global and targeted invalidation paths across restart and degraded dependencies.
- Confirm secure defaults for headers, cookies, origins, proxy trust, TLS, filesystem permissions, rate limits, and one-instance deployment.

## Tests

- Positive: complete local/OIDC enrollment-to-MCP journeys, each administrative role, each API role, policy explanation/runtime parity, backup/restore/migration, Docker restart continuity, and documented proxy examples.
- Negative: unauthorized routes/actions, cross-service leakage, secret retrieval, stale mutations, invalid archives/migration, component degradation, OAuth ineligibility, self-key misuse, and all hard-denied API-key operations.
- Boundary: PRD scale targets, supported viewport/accessibility checks, lifetime/retention cutoffs, storage exhaustion warnings, process restart, and single-instance lock.
- Integration: production build, full unit/integration/browser/security suites, container smoke tests, ChatGPT/Codex compatibility tests, OpenAPI conformance, and documentation examples.

## Acceptance criteria

- All earlier milestones are completed with no unresolved blocker or remediation item required for release.
- Build, full tests, browser/security suites, container smoke, compatibility, and performance gates pass.
- UX, security, architecture, operations, and documentation reviews approve the v2 release.
- Documentation is sufficient for installation, administration, recovery, migration, and safe MCP use without reading source code.

## Planning handoff

Specify the release matrix, environments/fixtures, browser/accessibility tools, performance workloads/budgets, Docker persistence/permissions, reverse-proxy configurations, ChatGPT/Codex test procedure, documentation ownership, final threat-model review, and release-blocking severity policy.
