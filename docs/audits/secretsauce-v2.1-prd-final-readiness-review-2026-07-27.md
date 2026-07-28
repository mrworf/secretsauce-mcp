# SecretSauce v2.1 PRD Final Security and Architecture Readiness Review

## Metadata

- **Project/repository:** SecretSauce (MCP)
- **Git SHA reviewed:** `acd1b4ef725565573239d17d893ca5350650a226`
- **Review date/time:** 2026-07-28T03:20:10Z
- **Reviewer roles:** senior application security reviewer and senior software
  architect
- **Primary scope:** `docs/prd/secretsauce-v2.1-prd.md`
- **Supporting scope:** the original v2.1 PRD audit, focused key-manifest review,
  v2 system/vault/data/identity architecture, example Compose topology,
  application composition root, proxy handling, logout route, and representative
  tests
- **Review type:** product-contract and architecture-readiness review; no v2.1
  implementation exists to penetration-test
- **Commands used:** `rg --files`, `rg -n`, `sed -n`, `nl -ba`,
  `git rev-parse HEAD`, `git status --short`, and a requirement-ID consistency
  script

## Scope

This review answers two questions:

1. Did the revised PRD close all eight concerns in
   `docs/audits/secretsauce-v2.1-prd-security-architecture-review-2026-07-27.md`?
2. Is the product contract and architecture baseline ready for milestone
   breakdown?

The review checks the revised requirements against the current v2 composition,
the separate vault boundary, the single SQLite writer, security and privacy
invariants, negative behavior, acceptance criteria, and the twelve PRD readiness
gates.

It does not claim that unimplemented v2.1 behavior is secure in production.
Implementation milestones still require code review, positive and negative
tests, browser validation, Compose validation, and both Codex and ChatGPT
interoperability tests.

## Executive Summary

The revision materially improves the PRD. Six of the eight original concerns are
now resolved or explicitly accepted:

- designated OAuth/CSRF delivery channels are unambiguous;
- bootstrap-log authority is an explicit accepted risk;
- scoped grant revocation uses current conditional authorization;
- proxy source derivation has safe defaults plus an explicit accepted-risk
  trust-all mode;
- logout fails honestly and remains retryable; and
- the readiness declaration no longer authorizes implementation prematurely.

Two original blockers remain:

1. The authoritative startup matrix still permits key generation when the
   manifest and all keys are absent without conditioning that decision on
   retained database, vault, identity, grant, or audit state. This leaves the
   original destructive partial-restore case unresolved.
2. The PRD requires automatic owner-local key provisioning, but the current
   architecture and Compose topology still require manually provisioned
   read-only vault keys and start the application only after the vault is
   healthy. Section 24 still asks who coordinates provisioning and how the
   startup cycle is removed.

Security verdict: **not ready for milestone breakdown** because retained state
can still be misclassified as fresh by a literal implementation.

Architecture verdict: **not ready for milestone breakdown** until one
provisioning composition is selected and recorded. A viable incremental
composition is provided below.

No CVSS score is assigned. These are specification and architecture blockers,
not confirmed vulnerabilities in deployed v2.1 code.

## Threat Model

- **Exposed interfaces:** setup status, login and enrollment, OIDC,
  OAuth authorization/token endpoints, control API, MCP, health, reverse-proxy
  headers, and the intentional bootstrap log line.
- **Sensitive assets:** application and vault keys, bootstrap and temporary
  credentials, password/TOTP state, browser/restricted sessions, CSRF proofs,
  OAuth codes/tokens, grants, gateway references, and audit evidence.
- **Trust boundaries:** browser to application; Codex/ChatGPT to OAuth and MCP;
  reverse proxy to listeners; application to SQLite; application/provisioner to
  key storage; application to the OS-separated vault; replaceable containers to
  durable volumes; and container logs to the infrastructure operator.
- **Likely attacker/failure profiles:** unauthenticated remote client,
  authenticated user, scoped admin, stolen-session holder, spoofed proxy-header
  sender, lower-trust log reader, interrupted provisioning, lost volume, and
  partial restore.

## Original Concern Closure

| Original ID | Final status | Evidence and justification |
| --- | --- | --- |
| `PRD-001` | Resolved | `SESSION-006` now permits CSRF proofs and OAuth values only through protocol-defined, no-store delivery channels while prohibiting unrelated exposure. Acceptance 21.5.2 tests the same contract. |
| `PRD-002` | Open architecture blocker | `SETUP-013`–`SETUP-015` define ownership and per-key/configured atomicity, but section 24 still leaves the coordinator/startup composition open. Current Compose still mounts manual vault keys read-only and waits for vault health before starting the application. |
| `PRD-003` | Open security/data-safety blocker | The manifest/key/adoption cases are much stronger, but `SETUP-017` and the authoritative matrix do not condition the no-manifest/no-key generation path on all retained key-bound state being absent or empty. |
| `PRD-004` | Accepted risk, documented | Current bootstrap-log readers are explicitly trusted as infrastructure administrators; successful enrollment or restart invalidates the secret. |
| `PRD-005` | Resolved | `ACCESS-012` makes current role, target eligibility, and complete service scope part of the mutation authorization boundary and rejects stale list/cached authority. |
| `PRD-006` | Resolved with accepted-risk mode | `SOURCE-001`–`SOURCE-009` define direct, enumerated trusted-proxy, and explicit trust-all behavior, canonicalization, bounds, warnings, and negative tests. |
| `PRD-007` | Resolved | `LOGOUT-002`–`LOGOUT-006` keep the cookie/session active on transaction failure, return retryable 503, avoid false success, emit a sanitized signal, and test retry. |
| `PRD-008` | Resolved | Section 28 now says product behavior is ready for downstream review while implementation and milestone breakdown remain `no`. |

## Findings Summary

| ID | Type | Priority | Confidence | Title | Status |
| --- | --- | --- | --- | --- | --- |
| `FINAL-001` | Security / data safety | Blocker | Confirmed | Freshness ignores retained state when manifest and keys are absent | Open |
| `FINAL-002` | Architecture / operations | Blocker | Confirmed | Provisioning topology and coordinator remain unselected | Open |

## Detailed Findings

### FINAL-001: Freshness ignores retained state when manifest and keys are absent

- **Type:** confirmed product-contract gap
- **Priority:** blocker before milestone breakdown
- **CVSS v3.1:** not applicable; no v2.1 implementation exists
- **Affected requirements:** `SETUP-011`, `SETUP-017`, section 18.2, acceptance
  21.1

#### Evidence

`SETUP-017` permits fresh provisioning when no manifest and no required key are
present. The authoritative matrix repeats that rule:

```text
Absent manifest + no keys + adoption false/absent
  -> create provisioning manifest and generate keys
```

Neither rule requires the user database, identity/authenticator envelopes, OAuth
grants, vault ciphertext/store identity, audit lineage, or other key-bound state
to be absent or empty.

Section 18.2 then says retained application data does not authorize key
replacement, but this narrative sentence does not resolve the contradictory
authoritative row.

#### Realistic failure scenario

An operator restores or retains the database, vault store, or audit volume but
loses both the setup-manifest and key volumes. A literal implementation observes
no manifest and no keys, classifies the installation as fresh, and generates a
new set. Existing encrypted or integrity-bound records then become unreadable or
split across installation identities.

This needs no attacker. Ordinary volume loss or a partial restore is sufficient.

#### Required product decision

Add retained-state presence as an input to the startup matrix:

- true fresh generation is allowed only with no manifest, no required key, and
  no retained key-bound/security state;
- any retained database, identity, authenticator, grant, vault, audit-lineage,
  or installation state with no manifest and no keys causes
  `configuration_error` without writing a manifest or key;
- an unavailable or indeterminate retained-state inventory fails closed;
- recovery restores the matching state/key/manifest set rather than generating
  replacements.

Add process/Compose tests that independently remove the key and manifest volumes
while retaining each database, vault, and audit volume, plus partial-restore
combinations.

#### Verification

A matrix test must prove that only the fully empty state reaches fresh
generation. Every retained or indeterminate state must exit nonzero without
creating a key or manifest.

### FINAL-002: Provisioning topology and coordinator remain unselected

- **Type:** confirmed architecture gap
- **Priority:** blocker before milestone breakdown
- **CVSS v3.1:** not applicable
- **Affected requirements:** `SETUP-001`–`SETUP-016`, sections 18 and 24

#### Evidence

The current deployment:

- mounts vault root/caller keys read-only after a manual `vault:key` command
  (`docker-compose.example.yaml:7-17`);
- starts the application only after `secretsauce-vault` is healthy
  (`docker-compose.example.yaml:25-35`); and
- documents that the vault refuses startup until its root/caller keys already
  exist (`docs/architecture/v2/vault.md:58-63`).

The v2.1 PRD instead requires automatic key creation, a visible blocked setup
state, and no initialization CLI. Section 24 still asks which component
coordinates owner adapters and how the cycle is removed.

#### Why the product requirements alone are insufficient

`SETUP-013` correctly requires one writer per key identity, but it does not
select the process and volume topology that makes this true. Giving both runtime
containers writable key mounts would weaken ownership. Making the application
wait for vault health preserves the existing startup cycle. Using only a
one-shot provisioner without a concurrently reachable setup-only application
would violate the browser status and healthy blocked-provisioning contract.

#### Recommended architecture resolution

Adopt this composition for milestone planning:

1. Add a no-network `secretsauce-setup` Compose service as the only writer of a
   dedicated durable setup-manifest store and generated-key directories.
2. Keep key format, generation, canonical fingerprint, and compatibility logic
   in closed owner-supplied provisioning adapters. The setup coordinator invokes
   those adapters; it does not implement service-specific key formats itself.
3. Give the setup service write access only to the manifest and generated-key
   directories. Give it read access to retained database/vault/audit state only
   for compatibility inventory. Runtime application and vault containers mount
   generated keys read-only.
4. Start the application concurrently in a structural-config/setup-only mode.
   It reads bounded manifest status and serves only liveness, readiness, setup
   status, and safe static assets while the setup service retries.
5. Start the vault after the setup service reaches configured completion. The
   application enables enrollment/login and later ordinary listeners only after
   configured manifest validation and a successful vault handshake.
6. The setup service performs per-key atomic no-replace creation and durable
   per-entry progress. It is the sole manifest writer. The application is a
   reader until ordinary runtime starts.
7. Remove the manual `vault:key` prerequisite from the supported v2.1 Compose
   path. Retain the command only for explicitly out-of-scope repair/rotation
   workflows if later architecture allows it.

This shape preserves the vault runtime boundary and single application SQLite
writer. The setup service is deliberately privileged during provisioning, so it
must expose no listener, log no secret/path content, drop unnecessary
capabilities, and exit after configured validation.

#### Verification

Compose tests must cover clean start, blocked write with live setup status,
per-key interruption, setup-service restart, application restart during setup,
vault start only after key completion, container recreation, and the retained
state cases from `FINAL-001`.

## Architecture Question Assessment

| Section 24 question | Review resolution or status |
| --- | --- |
| Manifest and commitment location | Use a dedicated durable setup-manifest store with one setup-service writer and read-only status access by the application. The exact storage library is a milestone mechanism choice. |
| Coordinator and startup cycle | Use the no-network setup service plus owner adapters and concurrent setup-only application described in `FINAL-002`. This must be accepted and recorded before breakdown. |
| Provisional initial enrollment | A bounded process-lifetime provisional store is consistent with restart invalidation and avoids a premature user. Persist only keyed restricted-session/CSRF hashes if persistence is required; final identity/audit remains one transaction. |
| Owner key inventory API | Use a closed adapter contract returning key identity, owner, format/version, status, canonical fingerprint, compatibility result, and sanitized error category—never raw key bytes. |
| Retry and status propagation | The setup service owns bounded retry/backoff; the manifest exposes bounded non-secret phase/status read by the setup-only application. |
| User-agent derivation | Select a maintained bounded parser during the session-metadata milestone; parser choice does not change the settled informational-only contract. |
| Revoked-row removal | Retain enough revoked ownership/scope metadata for the documented idempotency period. After physical deletion, the target is unknown/inaccessible as required by `ACCESS-012`. |
| High-cardinality global revocation | Commit a logical epoch/generation transition plus audit atomically; projections and authentication treat older rows as revoked immediately, while bounded physical cleanup follows later. |
| Shared client-source resolver | Implement one bounded resolver at the shared request boundary and invoke it from both listener stacks before authentication/rate-limit work. |

Questions 3 through 9 are internal mechanism choices with viable answers and do
not block milestone breakdown. Questions 1 and 2 remain blocked only because the
recommended provisioning composition has not yet been accepted and recorded.

## Readiness-Gate Assessment

| Gate | Result | Justification |
| --- | --- | --- |
| Product purpose | Pass | Problem, target users, goals, non-goals, and success measures are explicit. |
| Existing-product baseline | Pass | Preserved/changed behavior and the fresh-only compatibility boundary are explicit. |
| Actors and authorization | Pass | Roles, hard denials, dynamic grant scope, and mutation-boundary authorization are defined. |
| Domain and lifecycle | Fail | The no-manifest/no-key transition remains ambiguous when retained state exists. |
| Security and privacy | Fail | `FINAL-001` can cause destructive key replacement after partial storage loss. Accepted bootstrap/proxy risks are otherwise explicit and bounded. |
| Primary and negative workflows | Fail | Partial restore with retained state and no key/manifest set lacks an authoritative outcome. |
| Data and interfaces | Pass for milestone review | Stable requirement IDs, limits, designated secret channels, failure behavior, pagination, and idempotency contracts are present. Detailed route schemas remain implementation review work. |
| Integrations and compatibility | Pass | OIDC, OAuth/MCP, proxy, vault, Compose, Codex, and ChatGPT boundaries are identified. |
| Operations and rollout | Fail | `FINAL-002` leaves the supported automatic provisioning topology unresolved. |
| UX acceptance | Pass for milestone review | Primary flows, safe status, exact critical messages, accessibility, responsive behavior, and destructive-action behavior are testable. |
| Acceptance and traceability | Pass with blocker coverage missing | IDs are complete and unique, but the retained-state negative cases must be added. |
| Decision closure | Fail | Two material blockers remain. |

## What Is Good

- **Good: designated delivery channels are precise.** CSRF and OAuth values have
  necessary no-store channels without weakening the prohibition on unrelated
  APIs, logs, audits, telemetry, or durable browser storage.
- **Good: key state is fail-closed after verification.** A missing/mismatched
  verified or configured key is never regenerated, and partial no-manifest key
  sets always fail.
- **Good: accepted risks are honest.** Bootstrap-log authority and proxy
  `always` mode identify who is trusted, what can be spoofed, and which
  independent controls remain.
- **Good: mutation races have product contracts.** Grant revocation, suspension,
  first-user creation, bulk revocation, TOTP replay, and logout/audit failure
  have explicit atomic or conditional outcomes.
- **Good: scope remains pragmatic.** The PRD preserves one application instance,
  the separate vault boundary, server-side opaque sessions, and the generic MCP
  tool surface instead of proposing unrelated refactors.

## What Is Bad Or Risky

- **Risky: retained-state inventory is not authoritative yet.** This is the only
  remaining product-level data-loss blocker.
- **Risky: the setup provisioner is necessarily privileged.** The recommended
  service can write all generated key directories and inspect retained state.
  Its no-network, no-secret-log, short-lived boundary must be a first-class
  milestone invariant.
- **Risky but accepted: bootstrap logs delegate enrollment authority.** This is
  acceptable only under the recorded infrastructure-admin trust model.
- **Risky but accepted: `client_source.mode: always` permits spoofing.** It must
  remain explicit, default-off, warned, and backed by independent account/global
  controls.
- **Risky but manageable: revoked metadata retention and activity writes can
  increase SQLite load.** Coalesced activity updates, epoch-based logical
  revocation, keyset pagination, and bounded cleanup are suitable incremental
  controls.

## What Should Change

1. **Change the PRD:** add retained-state absence/emptiness to the true-fresh
   precondition and all corresponding negative tests.
2. **Select the architecture:** accept or replace the no-network setup-service
   composition, then record the chosen coordinator, manifest ownership, volume
   access, and startup order.
3. **Then re-run this closure check:** if both changes remain consistent with the
   existing security contracts, set `Milestone-breakdown ready: yes`.
4. **Do not set `Implementation-ready: yes` yet:** UX/accessibility and detailed
   data/API reviews, implementation plans, and executable validation remain
   required.

## What I Would Not Change Yet

- **Do not change yet: the separate vault process.** The startup cycle can be
  solved without collapsing the credential-plaintext boundary.
- **Do not change yet: the single SQLite writer.** The deployment excludes
  multiple active application instances; a distributed store would add cost
  without solving either blocker.
- **Do not change yet: opaque server-side sessions and tokens.** Their immediate
  invalidation and secret-handling contracts are appropriate.
- **Do not change yet: the four setup states or neutral enrollment route.** Both
  are coherent once the retained-state and startup-owner decisions close.
- **Do not change yet: detailed milestone slicing.** The product and architecture
  blockers should close before `prd-to-milestones` is used.

## Security Findings and Exploit Chains

No confirmed v2.1 implementation vulnerability or exploit chain is reported
because the reviewed behavior is not implemented. `FINAL-001` is a confirmed
specification gap with a realistic data-loss failure path, not a CVSS-scored
deployed vulnerability.

The two accepted risks are not chained into a higher finding:

- bootstrap-log access already implies infrastructure-administrator trust; and
- trust-all proxy spoofing affects source-derived limits/metadata while
  account, password, TOTP, global, and concurrency controls remain enforced.

## Overall Opinion

The PRD is a strong, substantially repaired product contract and is correctly
marked:

- **Product-behavior ready for downstream review: yes**
- **Implementation-ready: no**
- **Milestone-breakdown ready: no**

Do not mark it ready for milestone breakdown yet. Close `FINAL-001` and
`FINAL-002`, update the PRD and architecture record, then perform a focused
verification rather than another broad redesign.

## Assumptions and Limitations

- The supported target remains one application instance, one separate vault
  process, and official Docker Compose.
- The provisioner composition above is a review recommendation, not yet an
  accepted architecture decision.
- The review did not run or inspect a v2.1 implementation because none exists.
- No production reverse proxy, log platform, filesystem, or container runtime
  was exercised.
- UX and data/API were assessed for milestone-level contract completeness, not
  given specialist implementation approval.
- Documentation-only review work does not require executable product tests.
