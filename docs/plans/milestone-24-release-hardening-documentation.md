# Milestone 24 Release Hardening And Documentation Plan

## Release outcome and evidence boundary

Milestone 24 closes the V2 release as one supported small-instance product. It
does not add service-specific tools, multi-replica coordination, enterprise IAM,
or a new runtime architecture. The release candidate is the exact repository
commit that passes the production build, generated OpenAPI check, full test
suite, container smoke, protocol-compatibility journeys, scale workloads,
artifact/privacy scan, and the final UX/security/architecture/documentation
reviews recorded in the acceptance artifact.

All automated compatibility uses synthetic local identities, tokens, endpoints,
and credential values. It exercises the same OAuth discovery, authorization,
token, stateless MCP initialize/tools/call, restart, and revocation protocols
used by Codex and ChatGPT, with two independently named client fixtures. It
cannot assert behavior inside an unavailable hosted client UI. The operator
guide therefore includes an exact live Codex and ChatGPT verification procedure,
the `/mcp` versus origin distinction, evidence to retain, and a rule that a
failed live deployment check blocks that deployment rather than being explained
away by the synthetic suite.

## Release matrix and blocking policy

The checked-in release matrix records an owner, automated/manual evidence,
environment, latest result, and remediation link for:

- build, unit/integration/browser/security regression, and OpenAPI currency;
- account-role/API-role/cross-service authorization;
- wide/narrow keyboard, focus, semantics, confirmation, secret-clearing, and
  branding behavior;
- database/vault/audit/jobs/activation/key readiness and degraded components;
- local and assured-OIDC enrollment through OAuth/MCP, both named client
  fixtures, restart, revocation, backup, restore, and migration;
- 1,000 users, 500 services, 5,000 credentials, 20,000 policy rules, 10,000
  grants/tokens, retained audit search, and bounded background work;
- image build/start/health/stateless MCP smoke and restart persistence;
- installation, administration, recovery, migration, API, proxy, compatibility,
  threat-model, and non-goal documentation.

Critical/High security findings, possible credential disclosure, authorization
or cross-service failure, data-loss/rollback failure, stale OpenAPI, a failed
required journey, image/start/readiness failure, scale budget regression, or
any full-suite failure is release-blocking. Medium findings block when they
violate a settled PRD invariant or lack a safe documented containment. Lower
findings may remain only when the final review records concrete impact, owner,
and rationale and no acceptance criterion depends on them. This milestone does
not waive a red gate; it fixes it or leaves the milestone incomplete.

## Recovery remediation and complete navigation

The existing durable `migration_remediations` and `restore_remediations` tables
must no longer be write-only operational records. Add one bounded, read-only
recovery-remediation projection and strict superadmin-browser API that reports:

- migration/restore kind and safe operation UUID;
- task UUID, service UUID/resulting service slug, fixed task kind, optional
  target UUID, state, and timestamps;
- aggregate open/completed counts and the completed migration/restore outcome;
- no source path/key, ACL identity, credential value/source, vault locator,
  archive path, opaque stage/reference, or local error.

The recovery workspace replaces the “Migration status” placeholder and displays
open tasks grouped by service with direct links to the existing service,
credential, policy, group/access, and publication workspaces. Task completion is
derived from current durable state where it can be proven; otherwise the task
remains visible. No generic “dismiss” operation is introduced for required
security work. Restore and migration history remains visible after restart.

Replace the OpenAPI placeholder with a real authenticated documentation page
that explains browser versus API-key versus CLI authentication, no-store secret
inputs, errors, pagination, ETags, idempotency, and links to the generated JSON
contract. Navigation and router tests must prove that every visible item renders
an implemented page or intentional safe error, never a milestone placeholder.

## UX and accessibility review

Use the existing Testing Library/jsdom browser layer plus source-contract checks;
do not add a network-fetched accessibility dependency solely for this milestone.
A product-wide audit renders every authorized route for `user`, `admin`, and
`superadmin` in wide and 320px-equivalent narrow contracts and checks:

- one page heading, labeled landmark/section structure, unique IDs, associated
  labels, named controls/links, live error/status output, and no positive
  `tabindex`;
- route-change and multi-step focus, skip link, logical keyboard order, visible
  `:focus-visible`, reduced motion, 44px target contracts, overflow-safe grids,
  and persistent essential actions on narrow layouts;
- exact-target destructive dialogs, non-default destructive actions, high-
  friction restore/global/key/delete confirmations, and write-only inputs that
  clear after all outcomes;
- loading, empty, error, unauthorized, and retry states without secret,
  credential, token, cookie, opaque-reference, or local-path rendering;
- SecretSauce names/assets/alternative text in source and built output.

Any issue found is fixed in the owning component and receives a positive and
negative regression. Static checks complement component behavior; they are not
presented as a substitute for assistive-technology testing.

## Authorization, privacy, and invariant audit

Generate one table-driven contract from the centralized permission matrix for
every human role, API role, capability, service scope, cross-service target, and
superadmin target. Verify route registrations cannot broaden those outcomes,
API keys never acquire step-up or interactive-only operations, and service
children are authorized only after their parent service.

Add a repository-owned release artifact scanner with a closed input set:
tracked source/docs/examples, built server/web assets, generated OpenAPI, test
fixtures designated for safe publication, and synthetic captured log/audit/API/
backup/report output. It rejects real/internal hostnames, recognizable raw API
keys, bearer/cookie/authorization examples, private-key blocks, opaque `gref_`
or `sec_` examples, and known synthetic canaries where they are prohibited.
Tests prove both clean acceptance and each finding class. Test-only adversarial
fixtures may contain clearly synthetic values and are excluded by an explicit
reviewed manifest rather than an unbounded ignore.

The final threat-model pass rechecks authentication before parsing, destination
and canonical path policy before substitution/I/O, least-privilege vault roles,
response-scanning limitations, hash-only OAuth/API state, atomic recovery, and
single-instance ownership. Accepted response-transformation risk stays stated
as defense in depth, never universal non-exfiltration.

## Scale and performance gates

Add deterministic release workloads using SQLite and production repositories,
with a seeded fixed clock and synthetic `example.org` data. Run serially to
reduce CI noise and record elapsed time and row counts without user or secret
content. Workloads cover the settled targets:

- create/read authorization at 1,000 users and 500 services;
- status/configuration projections at 5,000 credential definitions;
- canonical policy evaluation/publication validation at 20,000 rules;
- OAuth lookup/cleanup at 10,000 active grant/token records;
- first-page administrative/runtime audit search over 10,000 retained events;
- activity rebuild/retention batches capped at their configured per-run limit.

Budgets on the CI class are 1 second for ordinary first-page/control reads and 2
seconds for retained audit search, each measured after fixture setup and a warm
read. Algorithmic boundary tests separately prove bounded batch sizes. Fixture
construction is outside response budgets but the entire scale file has a
bounded test timeout. A budget failure blocks release; the target is revised
only through an explicit architecture/PRD decision, not by silently increasing
the assertion.

## Container, persistence, and proxy deployment

Harden the production image and Compose example around one unprivileged
instance. The release smoke builds the image, starts a YAML-authority fixture,
waits for sanitized health, performs independent authenticated stateless MCP
initialize/tool-list calls, restarts the container, and repeats health/MCP. A
database/vault fixture additionally proves stable SQLite, vault store, OAuth
signing/HMAC keys, audit, and recovery mounts while `gref_`/`sec_` values remain
ephemeral. CI runs an amd64 smoke before the existing multi-architecture
publish build; image publication remains dependent on all quality gates.

Add separate public examples:

- MCP/OAuth proxy: `mcp.example.org`, forwards `/mcp` and OAuth discovery/
  authorize/token paths, uses origin-only `server.resource` and issuer values,
  and documents the client URL `https://mcp.example.org/mcp`;
- web/control proxy: `control.example.org`, forwards `/control` and `/api/v2`,
  preserves same-origin cookie/CSRF behavior, has a distinct control public
  origin, and does not expose the vault socket or direct backend listener.

Both examples terminate TLS, bound request/header/timeouts and body sizes, avoid
trusting arbitrary forwarding headers, preserve no-store responses, and use only
`example.org`. Documentation states which database, vault, audit, OAuth,
recovery, and key mounts must survive restart and which opaque references must
not.

## Documentation ownership and final reviews

Create a release/operator index that owns installation, first bootstrap,
administration, health/degradation, backups, restore, migration, key custody,
upgrade/restart, troubleshooting, and safe MCP use. Existing focused guides
remain canonical and are linked rather than duplicated. Complete or verify:

- human and static API-role matrix and hard denials;
- local enrollment/recovery, NIST SP 800-63B-4 password guidance, TOTP
  phishing-resistance limits, sessions, and exact step-up;
- generic OIDC trust/linking and assurance;
- groups/direct assignments and deterministic policy algorithm/examples;
- vault threat model and write-only control limitation;
- audit content/retention, backup exclusions, restore consequences, migration
  identity loss, and response-protection limitations;
- OpenAPI authentication/errors/pagination/ETag/idempotency/secret-input usage;
- one-instance topology and separate web/MCP proxy examples;
- Codex/ChatGPT live verification and evidence checklist.

Produce four final artifacts: UX/accessibility review, security/invariant review,
architecture/operations review, and milestone acceptance/release matrix. Each
states commands, evidence, limitations, findings, disposition, and residual
risks. Documentation tests check links, example hosts, origin/path distinctions,
secret-free examples, and consistency with runtime route/permission registries.

## Minimal delivery slices

1. Decision-complete release plan, matrix skeleton, blocking policy, and
   milestone in-progress state.
2. Durable recovery-remediation projection/API plus implemented migration
   workspace and OpenAPI help page, with scope/leak/restart/UI tests.
3. Product-wide navigation, semantic accessibility, focus, narrow-layout,
   destructive-confirmation, state, branding, and built-artifact review/fixes.
4. Exhaustive role/API-role/cross-service route audit and closed release
   artifact/privacy scanner with positive and negative tests.
5. Deterministic PRD-scale workloads and response/batch budgets.
6. Unprivileged image/Compose persistence hardening, local container smoke
   runner, and CI smoke-before-publish integration.
7. Separate MCP/OAuth and web proxy examples, release/operator/API reference,
   and exact Codex/ChatGPT live plus synthetic compatibility procedure.
8. Composite OAuth/MCP restart/revocation/degraded/backup/restore/migration
   release journeys and final UX/security/architecture/documentation reviews.
9. Production build, OpenAPI currency, container smoke, full regression,
   acceptance matrix closure, and milestone status.

Each completed slice receives focused positive and negative tests, the full
regression suite, and one concise commit. Durable implementation lessons are
added to `AGENTS.md` only when they apply beyond this milestone.

## Acceptance matrix

- Product completeness: no authorized navigation placeholder; durable restore
  and migration work is visible; all earlier milestone status entries complete.
- UX: every authorized route and critical state meets the semantic/focus/narrow/
  confirmation/write-only checks with no rendered protected values.
- Authorization: every matrix cell, cross-service child, superadmin hard denial,
  API role, and interactive-only boundary matches centralized policy.
- Privacy: tracked examples, build output, OpenAPI, reports, synthetic logs/
  audits/backups, and rendered states pass the closed prohibited-data scan.
- Scale: all seven workloads meet exact counts, bounded batches, and response
  budgets on the release environment.
- Deployment: unprivileged image, one-instance Compose, stable durable mounts,
  ephemeral references, sanitized health, restart, and proxy examples pass.
- Compatibility: independently named Codex/ChatGPT protocol fixtures complete
  OAuth and stateless MCP; restart and revocation behave as documented; live
  client procedure is exact and deployment-blocking on failure.
- Operations: installation through recovery/migration and safe-use guidance is
  sufficient without source reading; OpenAPI and examples match runtime.
- Closure: production builds, OpenAPI check, full tests, container smoke, and
  all four final reviews pass with no release-blocking finding.
