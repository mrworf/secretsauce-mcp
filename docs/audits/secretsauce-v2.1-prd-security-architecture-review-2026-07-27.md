# SecretSauce v2.1 PRD Security and Architecture Review

## Metadata

- **Project/repository:** SecretSauce (MCP)
- **Git SHA:** `16b6034c97caaee85c06083f52022575f02dc06a`
- **Review date/time:** 2026-07-27T22:51:03Z
- **Reviewer roles:** senior application security reviewer and senior software
  architect
- **Primary scope:** `docs/prd/secretsauce-v2.1-prd.md`
- **Context inspected:** current application composition, OAuth token responses,
  browser-session/CSRF contracts, v2 architecture documents, example Compose
  topology, persistence ownership, and representative tests
- **Review type:** design and requirements review; no v2.1 implementation exists
  to penetration-test
- **Decision update:** On 2026-07-27, the product owner accepted `PRD-004` for
  the supported single-operator deployment and required its trust assumption to
  be stated explicitly in the PRD.

## Scope

This review asks whether the proposed v2.1 product contract has concerns that
must be resolved before architecture approval, data/API review, or milestone
planning. It evaluates the PRD against the implemented v2 foundations and the
document's own security, lifecycle, failure, and acceptance contracts.

The review is intentionally not a full re-audit of the existing v2
implementation. No production deployment, reverse proxy, log platform, or
container runtime was available. Because the findings are specification and
architecture defects rather than deployed vulnerabilities, CVSS v3.1 is not
applicable. A future implementation that weakens a security boundary while
resolving one of these defects must be reviewed and scored on its actual code
and deployment assumptions.

## Executive Summary

The PRD is unusually strong on fail-closed setup, atomic first-user creation,
uniform authentication failures, restricted enrollment sessions, immediate
revocation, bounded abuse controls, and secret-free observability. Those
decisions should be preserved.

It is not yet implementation-ready. Three issues block architecture approval:

1. `SESSION-006` and acceptance criterion 21.5.2 prohibit OAuth tokens and CSRF
   values from all API response bodies, while OAuth requires token responses and
   the current SPA requires a synchronizer CSRF proof from the control API.
2. The current two-container topology cannot perform the proposed browser-first
   key bootstrap as written: the application waits for a healthy vault, while
   the vault starts only after its manually provisioned read-only key files
   exist.
3. The contract does not completely define when an installation is safe to
   treat as fresh. A missing configured flag plus retained encrypted or identity
   state must never authorize replacement key generation.

The product owner accepts the bootstrap-log exposure for the supported
single-operator deployment: readers of the current line are in the same trust
domain as infrastructure administrators, and the secret is invalid after
successful enrollment or restart. Four additional decisions should be made
before milestone planning: require transaction-snapshot authorization for
scoped grant revocation, define trusted proxy/source derivation, define logout
behavior when durable revocation or audit fails, and correct the document's
premature readiness declaration.

No confirmed vulnerability exists merely because these requirements are
unimplemented. Implementing the current text literally would, however, either
break required OAuth/browser behavior or leave security-critical choices to
individual implementers.

## Threat Model

- **Exposed interfaces:** public setup status, login and enrollment, OIDC
  initiation/callback, OAuth authorization/token endpoints, control API, MCP,
  liveness/readiness, and container logs.
- **Sensitive assets:** bootstrap and temporary credentials, password/TOTP
  material, browser and restricted sessions, CSRF proofs, OAuth codes/tokens,
  vault/application keys, identity and grant state, and immutable audit
  evidence.
- **Trust boundaries:** unauthenticated browser to application; model/agent to
  OAuth and MCP; application to SQLite; application to the separate vault
  process; replaceable containers to durable storage; reverse proxy to
  application; container log stream to operator or log platform.
- **Likely attacker profiles:** unauthenticated remote user, authenticated user,
  scoped regular admin, stolen-session holder, compromised OAuth client, and a
  lower-trust operator or service with access to forwarded container logs.
- **Privileged operations:** first-superadmin enrollment, key generation,
  password/TOTP reset, suspension/reactivation, session/grant revocation, global
  revocation, and host-local break glass.

## Findings Summary

| ID | Priority | Area | Concern | Disposition |
| --- | --- | --- | --- | --- |
| PRD-001 | Blocker | Security / API | Bearer-value ban contradicts required OAuth and CSRF delivery | Amend PRD before API review |
| PRD-002 | Blocker | Architecture / Operations | Current vault dependency graph cannot auto-provision keys | Select and document startup ownership |
| PRD-003 | Blocker | Security / Data safety | Fresh-versus-retained-state decision is incomplete | Add authoritative state matrix and tests |
| PRD-004 | Accepted risk | Security / Operations | Bootstrap log access delegates initial-enrollment authority | Accepted and documented |
| PRD-005 | Required | Authorization | Scoped grant revocation lacks transaction-snapshot semantics | Add invariant and race tests |
| PRD-006 | Required | Security / Operations | Source identity is undefined behind a reverse proxy | Define trusted-proxy contract |
| PRD-007 | Required | Security / UX | Logout failure behavior is externally observable but unsettled | Make a product decision |
| PRD-008 | Required | Governance | “Implementation-ready” conflicts with unresolved mandatory gates | Change readiness declaration |

## Detailed Findings

### PRD-001: Bearer-value ban contradicts required protocol and browser contracts

- **Category:** confirmed specification contradiction
- **Priority:** blocker
- **CVSS v3.1:** not applicable; this is not a deployed vulnerability
- **Affected requirements:** `SESSION-006`, acceptance criterion 21.5.2

#### Evidence

The PRD says CSRF, OAuth access-token, and refresh-token values must not appear
in API response bodies (`docs/prd/secretsauce-v2.1-prd.md:655-656`) and repeats
that session and token values must be absent from API response bodies
(`docs/prd/secretsauce-v2.1-prd.md:1023-1026`).

The OAuth token endpoint necessarily returns `access_token` and `refresh_token`;
the existing implementation does so in
`src/builtinOAuth.ts:995-1002` and `src/builtinOAuth.ts:1089-1096`. The current
synchronizer-token design also returns `csrf_token` from login and session
responses (`src/control/identityRoutes.ts:137-145`,
`src/control/identityRoutes.ts:265-271`), with behavior proved by
`test/browser-sessions.test.ts:133-186`.

#### Risk

Literal compliance makes OAuth and the existing SPA unusable. Ignoring the
requirement makes security tests and reviews subjective. An implementer might
also move CSRF material into a less safe location, such as persistent web
storage, merely to satisfy the wording.

#### Required change

Limit the prohibition to management, diagnostic, audit, log, telemetry, URL,
and persistent-browser-storage surfaces that are not the designated secret
delivery channel. Explicitly allow:

- OAuth authorization codes in their protocol-defined redirect parameter and
  access/refresh tokens in successful no-store OAuth token responses.
- Synchronizer CSRF proofs in no-store authenticated/restricted control
  responses, held only in page memory and sent back in the required header.

Continue to prohibit these values from unrelated APIs, resource
representations, errors, logs, audits, URLs other than the OAuth authorization
code redirect, and durable browser storage.

#### Safe validation

Keep the existing no-store token and CSRF tests, then add negative tests proving
the values never appear in unrelated responses, errors, logs, audits, or web
storage. This validation uses generated test values only.

### PRD-002: The current vault dependency graph cannot auto-provision keys

- **Category:** confirmed architecture gap
- **Priority:** blocker
- **CVSS v3.1:** not applicable
- **Affected requirements:** `SETUP-001` through `SETUP-007`, sections 18.1 and
  24

#### Evidence

The existing architecture gives the separate `secretsauce-vault` process
ownership of the encrypted store and vault root keys
(`docs/architecture/v2/system-architecture.md:21-28`). The example Compose file
starts the vault with pre-provisioned, read-only key mounts
(`docker-compose.example.yaml:7-18`) and prevents the application from starting
until the vault is healthy (`docker-compose.example.yaml:25-35`). The
application receives the same caller/capability keys through read-only mounts
(`docker-compose.example.yaml:45-63`).

The v2.1 PRD instead requires automatic generation of vault root, caller, and
capability keys before ordinary product use
(`docs/prd/secretsauce-v2.1-prd.md:486-505`) with no initialization CLI
(`docs/prd/secretsauce-v2.1-prd.md:898-907`).

#### Risk

There is a startup cycle: the application cannot coordinate with the vault
because Compose has not started it, while the vault cannot become healthy
without keys that the new flow expects to generate automatically. Giving both
containers write access to the same key directory without one owner would add
races, mode/ownership drift, and unclear failure responsibility.

#### Required change

Choose one key-provisioning owner and update the architecture before milestone
planning. Viable shapes include a narrowly scoped one-shot provisioner that
finishes before both services, or vault self-provisioning plus a coordinator
protocol for the remaining application-owned keys. The chosen design must:

- have exactly one writer per key identity;
- use per-key atomic create, restrictive ownership/mode, `fsync`, and
  no-follow/path safety;
- expose only non-secret inventory and validation status across processes;
- support idempotent recovery from a partial fresh provisioning attempt;
- preserve the vault process boundary and the application's single SQLite
  writer;
- remove the current manual `vault:key` prerequisite from the supported Compose
  path.

“Atomically generate every missing key” should mean atomic creation of each key
plus idempotent convergence of the set. Only the configured-state commit is an
all-or-nothing database transaction; a cross-filesystem all-key transaction
cannot be promised.

### PRD-003: Fresh-versus-retained-state key behavior is incomplete

- **Category:** security and data-safety design gap
- **Priority:** blocker
- **CVSS v3.1:** not applicable; exploitability depends on an implementation and
  storage-loss scenario
- **Affected requirements:** `SETUP-002`, `SETUP-005`, `SETUP-007`,
  `SETUP-011`, section 18.2

#### Evidence

`SETUP-002` authorizes generation whenever the configured flag is absent
(`docs/prd/secretsauce-v2.1-prd.md:489-491`). Section 18.2 separately says
retained database or installation state demonstrating a missing or mismatched
key must fail closed (`docs/prd/secretsauce-v2.1-prd.md:918-921`).

The document does not define which retained stores are authoritative, what
marker each store carries, or what happens when the configured flag alone is
lost while users, encrypted TOTP data, vault ciphertext, audit state, or
partially generated keys remain.

#### Risk

An implementation that treats “flag absent” as “fresh” can generate replacement
keys over a damaged or partially restored installation. The result may be
permanent loss of decryptability, split installation identity, invalid token
verification, or misleading re-enrollment into a store that still contains old
state.

#### Required change

Add an authoritative startup decision table. At minimum:

1. Generate only when all durable stores are either absent/empty or belong to
   the same recognized incomplete provisioning generation.
2. Reuse and validate keys from that same incomplete generation.
3. Fail closed when any durable identity, authenticator, grant, vault record,
   audit lineage, or installation marker indicates a prior configured
   installation but a required key or primary marker is absent/mismatched.
4. Never infer freshness solely from zero users or a missing configured flag.
5. Define recovery as restoration of the matching key/state set, not key
   replacement.

Process and Compose tests must cover loss of each volume independently, partial
restore combinations, partial initial provisioning, and container restart at
every provisioning phase.

### PRD-004: Bootstrap logging is accepted delegated authority

- **Category:** explicit accepted design risk
- **Priority:** resolved by explicit acceptance and documentation
- **CVSS v3.1:** not applicable; the PRD intentionally trusts the initial
  operator and no concrete unauthorized log-reader role is defined
- **Affected requirements:** `ENROLL-001` through `ENROLL-004`, sections 14.1,
  16.3, and 18.3

#### Evidence

At review time, the PRD called the bootstrap secret “held only in memory” while
also requiring it to be printed to container logs. It prohibited other
persistence while correctly warning that Docker/platform logs may be retained
or forwarded. The PRD now distinguishes application retention from the
intentional operator-controlled log copy.

#### Risk

Once emitted, the current secret exists in the container runtime or external log
sink, not only in process memory. Any principal or integration that can read the
current line before enrollment/restart has first-superadmin enrollment authority
and can win the enrollment race. Historical copies become invalid after
restart, but retention extends the exposure window of the current copy.

#### Product-owner decision

The behavior is accepted for the supported single-operator deployment because
the operator controls both the system and its container logs. A party that can
read the current line is intentionally treated as an infrastructure
administrator; loss of that trust boundary is already loss of the deployment's
security. Successful enrollment or process restart invalidates the secret.

The PRD distinguishes application retention from the intentional log copy and
states this trust assumption. No runtime redesign, special process-generation
identifier, or additional log-forwarding restriction is required by this
finding.

Preserve the 128-bit secret, constant-time comparison, process lifetime,
single successful consumption, rate limits, uniform failures, and atomic
first-user commit.

### PRD-005: Scoped grant revocation needs same-snapshot authorization

- **Category:** likely authorization vulnerability if implemented naively
- **Priority:** required before API/data design
- **CVSS v3.1:** not scored without implementation; the impact depends on
  whether stale authorization can revoke an out-of-scope grant
- **Affected requirements:** `ACCESS-005`, `ACCESS-006`, `ACCESS-010`, security
  requirements in section 15

#### Evidence

A regular admin may manage another ordinary user's connection only when every
currently reachable service is within that admin's scope
(`docs/prd/secretsauce-v2.1-prd.md:272-279`,
`docs/prd/secretsauce-v2.1-prd.md:674-679`). The PRD requires scope enforcement
before returning target existence (`docs/prd/secretsauce-v2.1-prd.md:796-797`)
but does not explicitly require reauthorization from the same database snapshot
that performs revocation.

#### Risk

A list-then-revoke flow can race a service-assignment, service-lifecycle, grant,
or admin-scope change. Reusing a prior UI/list decision may let an admin revoke
an agent connection after it becomes partly or wholly out of scope. Physical
deletion also makes authorized no-change behavior difficult unless ownership
and scope evidence remain durably resolvable.

#### Required change

Require the mutation transaction to resolve the target, compute every currently
reachable service, evaluate actor role and current service scope, revoke, and
append audit as one serialized snapshot. A cursor, cached projection, or prior
list response must never serve as mutation authority. Keep a bounded durable
tombstone or equivalent scoped result reference long enough to provide
idempotent no-change results without leaking target existence.

Add a negative concurrency test that removes the admin's service scope between
list and revoke; revocation must be denied and target existence must remain
uniform.

### PRD-006: Direct-source identity is undefined behind reverse proxies

- **Category:** security and operations contract gap
- **Priority:** required before deployment/API design
- **CVSS v3.1:** not applicable without a deployment configuration
- **Affected requirements:** `ABUSE-001`, `ABUSE-002`, browser-session metadata

#### Evidence

The PRD relies on direct-source rate limits and coarse source-network metadata
(`docs/prd/secretsauce-v2.1-prd.md:580-590`,
`docs/prd/secretsauce-v2.1-prd.md:724-741`). The v2 architecture permits the
listeners to run behind reverse proxies
(`docs/architecture/v2/system-architecture.md:36-41`), while the current control
server deliberately sets `trustProxy: false`
(`src/control/server.ts:263-269`).

#### Risk

With the current setting, all clients behind a proxy can collapse to the proxy
address, producing shared throttling and misleading session metadata. Blindly
trusting forwarding headers would instead let remote clients spoof source
identity and evade per-source controls.

#### Required change

Define whether the supported Compose path receives client traffic directly or
through an enumerated trusted proxy. If proxies are supported, specify trusted
proxy identities/hops, canonical address selection, malformed/multiple-header
rejection, IPv4-mapped IPv6 handling, and the exact source used for both limits
and display metadata. Keep caller-supplied forwarding headers untrusted unless
the immediate peer is configured as trusted. Add positive and negative proxy
chain tests.

### PRD-007: Logout behavior under audit/persistence failure is unsettled

- **Category:** product failure-behavior ambiguity
- **Priority:** required before implementation
- **CVSS v3.1:** not applicable
- **Affected requirements:** `LOGOUT-002`, section 12.5

#### Evidence

The PRD requires logout to revoke and audit before clearing the cookie
(`docs/prd/secretsauce-v2.1-prd.md:573-576`) but does not state what the browser
does if durable revocation or audit fails. The current implementation returns
503 and leaves the cookie intact on repository failure
(`src/control/identityRoutes.ts:297-304`).

#### Risk

This is externally observable product behavior, not an internal architecture
choice. During database/audit degradation, the user may be unable to end the
local browser session. Conversely, clearing only the browser cookie can create a
false assurance because a stolen copy of the server-valid cookie remains usable.

#### Required change

Choose and document the failure contract. A safe minimum is to distinguish
“local cookie cleared” from “server revocation confirmed,” never claim successful
revocation when the transaction failed, and provide an operator-visible
degraded-security signal. The chosen behavior needs a browser test with injected
audit and persistence failures.

### PRD-008: The readiness declaration is premature

- **Category:** architecture governance concern
- **Priority:** required before milestone planning
- **CVSS v3.1:** not applicable

#### Evidence

Section 27 makes security, architecture, UX, and data/API approval prerequisites
and requires architecture questions to be resolved before milestones
(`docs/prd/secretsauce-v2.1-prd.md:1223-1230`). Section 28 nevertheless declares
“Implementation-ready: yes” while listing those reviews as still required
(`docs/prd/secretsauce-v2.1-prd.md:1232-1247`).

#### Risk

Teams can reasonably interpret the final declaration as authority to plan or
implement before the blocking protocol, startup, and state-safety questions are
resolved. The architecture questions also cannot be guaranteed to leave the
product contract unchanged: PRD-002 and PRD-003 show mechanisms that directly
determine observable failure and recovery behavior.

#### Required change

Use two gates:

- **Product-behavior ready for downstream review:** yes.
- **Implementation/milestone ready:** no, until blocking security and
  architecture findings are resolved and UX plus data/API reviews approve their
  contracts.

Permit downstream reviews to reopen a settled decision when they demonstrate a
security, correctness, or feasibility conflict.

## What Is Good

### Good: setup gating is ordered before dangerous work

The PRD explicitly places setup gating before authentication handlers, OAuth
issuance, MCP parsing that can cause work, credential substitution, and
downstream I/O (`docs/prd/secretsauce-v2.1-prd.md:779-783`).

**Justification:** This preserves the repository's most important structural
security invariant and avoids exposing a partially initialized credential
gateway.

### Good: first-superadmin enrollment is transactionally narrow

The bootstrap secret grants only provisional enrollment, provisional state is
not a user, and the complete identity plus immutable audit must commit together
(`docs/prd/secretsauce-v2.1-prd.md:540-551`).

**Justification:** This prevents half-created privileged identities and avoids
turning an enrollment session into ordinary authorization.

### Good: authentication disclosure and abuse controls are explicit

Uniform public failures cover nonexistent, suspended, incomplete, and
credential-invalid accounts. Expensive work has account, source, global, stage,
and concurrency bounds (`docs/prd/secretsauce-v2.1-prd.md:556-619`).

**Justification:** The requirements address enumeration, brute force, resource
exhaustion, and suspension races as one system instead of isolated endpoint
checks.

### Good: revocation semantics are precise

The PRD defines the commit boundary, permits already-dispatched requests to
finish, forbids cache grace, and requires epoch/grant/reference invalidation
(`docs/prd/secretsauce-v2.1-prd.md:338-348`,
`docs/prd/secretsauce-v2.1-prd.md:680-690`).

**Justification:** This gives implementation and tests a realistic, strong
meaning of “immediate” without promising impossible cancellation.

### Good: testing is proportional to risk

The document requires positive and negative contract tests for every new
external input plus process, persistence, concurrency, browser, security,
Compose, Codex, and ChatGPT coverage
(`docs/prd/secretsauce-v2.1-prd.md:1046-1071`).

**Justification:** The test plan targets trust boundaries and failure modes, not
only happy-path UI behavior.

## What Is Bad Or Risky

- **Risky:** the bootstrap log line is the only intentional raw-secret logging
  exception. It is acceptable only if log readers are explicitly treated as
  bootstrap authorities and the supported deployment keeps that audience
  narrow.
- **Risky:** “atomic” is used for filesystem key generation, database commits,
  and potentially high-cardinality revocation without distinguishing their
  achievable transaction boundaries.
- **Risky:** `last activity` can become a write-amplification hotspot on the
  single SQLite writer if updated on every request. Architecture should use
  bounded/coalesced updates because the PRD does not require second-level
  precision.
- **Risky:** physical removal of session/grant rows conflicts with durable
  idempotent no-change behavior unless a scoped tombstone or equivalent durable
  result mapping survives.

## What Should Change

1. **Change before API review:** fix `SESSION-006` and acceptance 21.5.2 so
   designated OAuth and CSRF delivery channels are explicit.
2. **Change before architecture approval:** select the provisioning owner,
   remove the vault/application startup cycle, and define per-key versus
   configured-state atomicity.
3. **Change before data-model review:** define the installation identity and
   retained-state matrix across database, vault, key, and audit stores.
4. **Change before security approval:** record the accepted bootstrap-log trust
   assumption, and make transaction-snapshot revocation and trusted-proxy source
   derivation explicit.
5. **Change before UX approval:** settle logout failure behavior and wording.
6. **Change before milestone planning:** mark implementation readiness as
   conditional on all mandatory reviews and blocker closure.

## What I Would Not Change Yet

### Do not change yet: the four public/internal setup phases

The distinction among provisioning, enrollment-required, operational, and fatal
configured error is clear and supports safe health behavior. The missing work is
durable representation and transition ownership, not another state.

### Do not change yet: one neutral enrollment entry

Uniform bootstrap and temporary-password entry reduces setup-state and account
enumeration. Keep the shared ceremony while implementing separate,
domain-separated credential verifiers behind it.

### Do not change yet: server-side opaque browser sessions

The existing random cookie, keyed server-side hashes, CSRF binding, rotation,
expiry, epoch, and revocation model is appropriate. The response wording should
be fixed; the session model should not be replaced with browser-stored bearer
state.

### Do not change yet: the single-instance SQLite composition

The supported deployment explicitly excludes multiple active application
instances. A shared database, queue, or distributed transaction system would not
solve the immediate provisioning and state-definition problems.

### Do not change yet: the separate vault process boundary

Automatic provisioning should not collapse the vault into the application.
Resolve startup ownership while preserving the OS/process boundary around
downstream credential plaintext.

## Positive Security Observations

- Key generation is limited to SecretSauce-owned material; TLS, external OIDC,
  database, downstream, and backup secrets remain operator-owned.
- A configured installation fails closed on missing or invalid required keys and
  has no remote key-regeneration/reset operation.
- Bootstrap verification is high-entropy, constant-time, rate-limited,
  process-bound, and consumed only by the successful atomic first-user commit.
- Restricted enrollment sessions cannot authorize control, OAuth, or MCP.
- Suspension invalidates sessions, grants, tokens, references, and security
  epochs in one audited transition.
- Session and connection metadata are bounded, sanitized, and explicitly
  informational.
- MCP remains stateless at the HTTP transport layer and authenticates each
  request independently.

## Overall Opinion

The v2.1 product direction is sound and most high-value security decisions are
already explicit. I would approve the PRD as a strong draft ready for focused
revision, not as an implementation-ready contract.

Resolve PRD-001 through PRD-003 before architecture or data/API approval.
PRD-004 is accepted and documented. Resolve PRD-005 through PRD-008 before
milestone planning. After those changes, the existing setup states, enrollment
model, opaque sessions, revocation semantics, and single-instance deployment
are suitable foundations; they do not need broad redesign.

## Assumptions and Limitations

- The review assumes the official v2.1 target remains one application process
  plus one separate vault process under Docker Compose.
- It assumes OAuth protocol compatibility with Codex and ChatGPT remains
  mandatory.
- It does not score speculative implementation vulnerabilities.
- It does not validate a production proxy, filesystem, container log driver, or
  external logging platform.
- UX/accessibility and detailed OpenAPI/data-model reviews remain required.

## Appendix: Commands and Evidence

Representative read-only commands:

```text
git rev-parse HEAD
date -u +"%Y-%m-%dT%H:%M:%SZ"
git status --short
rg -n '^#{1,4} ' docs/prd/secretsauce-v2.1-prd.md
nl -ba docs/prd/secretsauce-v2.1-prd.md
rg --files src web test docs
rg -n 'access_token|refresh_token|csrf|trustProxy|PersistenceWorker' src test docs
nl -ba docker-compose.example.yaml
nl -ba src/application.ts
nl -ba src/builtinOAuth.ts
nl -ba src/control/identityRoutes.ts
nl -ba src/control/server.ts
nl -ba docs/architecture/v2/system-architecture.md
nl -ba docs/architecture/v2/identity-oauth.md
```

This was a documentation-only review slice. No executable behavior changed, so
implementation tests were not applicable.
