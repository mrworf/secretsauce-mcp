# SecretSauce v2.1 PRD Loose-Ends Review

## Metadata

- **Project/repository:** SecretSauce (MCP)
- **Git SHA baseline:** `3f9dc00798476e2776aed2c92b9b167014022bc4`
- **Review date/time:** 2026-07-28T05:15:23Z
- **Reviewer roles:** senior application security reviewer and software architect
- **Primary scope:** `docs/prd/secretsauce-v2.1-prd.md`
- **Supporting architecture:** `docs/architecture/v2.1/provisioning.md`,
  `docs/architecture/v2.1/vault-rest-api.md`, and `docs/architecture/v2/*`
- **Implementation evidence:** `src/vault/*`, `docker-compose.example.yaml`, and
  the related vault deployment, protocol, broker, and record-store tests
- **Prior reviews:** the v2.1 security/architecture, key-manifest, final-readiness,
  final-closure, and REST-transport reviews dated 2026-07-27
- **Commands used:** `git status --short`, `git rev-parse HEAD`, `git log`,
  `date -u`, `rg`, `sed`, `nl`, and a requirement-definition consistency check
- **Limitations:** this is primarily a product and architecture contract review.
  V2.1 provisioning and REST transport are not implemented, so projected
  implementation risks are distinguished from deployed vulnerabilities.

## Scope

This review re-evaluates the complete v2.1 PRD rather than only the previously
reported provisioning blockers. It checks:

- consistency with behavior that v2.1 says it preserves;
- fresh, interrupted, adopted, configured, recovery, and post-configuration
  key lifecycles;
- private vault REST reachability, authentication, authorization, response
  trust, replay, and transport portability;
- public setup, enrollment, login, suspension, recovery, session, and
  revocation behavior;
- deployment ownership, privilege transition, persistence, observability, and
  failure handling;
- requirement, acceptance, test, traceability, and readiness consistency; and
- whether remaining questions are truly internal implementation choices.

## Executive Summary

All four loose ends are now resolved in the governing contract:

- `LOOSE-001`: every fresh v2.1 installation provisions a fixed,
  release-versioned superset of SecretSauce-owned application key identities,
  so feature toggles never amend the manifest. Preserved identity/vault
  envelope-root rotation occurs only through exact host-local maintenance
  startup arguments, with one writer, durable journaling, conditional resumable
  rewrap, old-root retention through verified commit, and no REST trigger.

- `LOOSE-002`: v2.1 retains Unix sockets, requires vault-owned non-rebindable
  socket parents and read-only client mounts, and authenticates credential
  responses against the request and current vault boot identifier.
- `LOOSE-003`: every vault restart creates a new boot identifier and invalidates
  prior outstanding requests, nonces, capabilities, and in-memory transfers.
- `LOOSE-004`: host-local environment variables have explicit defaults and
  bounds for global login, unauthenticated concurrency, and password-verification
  concurrency. Reverse-proxy limits are supplementary.

The retained-state matrix, explicit adoption gate, setup-only application phase,
single provisioning writer, no-network vault, HMAC caller separation, conditional
administrative revocation, accepted forwarding-header mode, and honest logout
failure behavior remain sound.

**Readiness verdict:**

- **Product-behavior ready for downstream review:** yes
- **Implementation-ready:** no
- **Milestone-breakdown ready:** yes

Detailed UX/accessibility and data/API artifacts, implementation plans, and
executable validation remain required before implementation approval.

## Threat Model

- **Exposed interfaces:** public setup/health, browser login/enrollment/control,
  OAuth/MCP, private status REST over a Unix socket, and authenticated credential
  REST over a separate Unix socket.
- **Sensitive assets:** application encryption and hashing keys, vault root and
  caller keys, downstream credentials, TOTP seeds, browser/OAuth token material,
  retained database/vault/audit state, and the manifest commitment.
- **Trust boundaries:** public client to application; application to private
  vault sockets; caller identity to fixed vault operation allowlist; capability
  to one bounded operation; privileged setup entrypoint to key/setup/state
  volumes; setup identity to reduced runtime identity; and replaceable
  containers to durable volumes.
- **Likely attacker/failure profiles:** remote unauthenticated or authenticated
  client, compromised application caller, unrelated local workload with
  accidental or malicious socket-volume access, compromised vault runtime,
  interrupted key lifecycle, partial restore, lost volume, and operator
  configuration error.

## Findings Summary

| ID | Category | Priority | CVSS | Confidence | Title | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `LOOSE-001` | Architecture / security lifecycle | Former blocker | N/A | Confirmed | Configured key rotation and key-set evolution have no valid owner or transition | Resolved in contract |
| `LOOSE-002` | Security / private API | Former blocker | 7.8 conditional | High | REST requests are authenticated, but vault endpoint and response trust were unspecified | Resolved in contract |
| `LOOSE-003` | Security contract | Required before implementation | N/A | Confirmed | Replay and one-use behavior across vault restart was undefined | Resolved in contract |
| `LOOSE-004` | Abuse controls | Required before implementation | N/A | Confirmed | Global and concurrency limit bounds were missing | Resolved in contract |

No deployed v2.1 vulnerability is claimed. The conditional CVSS score for
`LOOSE-002` describes the result if the new design is implemented with a
caller-writable or replaceable socket endpoint and unauthenticated responses.
The amended contract prohibits that deployment.

## Detailed Findings

### LOOSE-001: Configured key rotation and key-set evolution have no valid owner or transition

- **Priority:** Former blocker
- **Category:** resolved product/architecture conflict
- **CVSS v3.1:** N/A; this is an unimplemented lifecycle contradiction
- **Affected components:** PRD sections 3.1, 11.1, 13.1, 18.2, 25, and 28;
  `docs/architecture/v2/vault.md`;
  `docs/architecture/v2/decisions.md`; and
  `docs/architecture/v2.1/vault-rest-api.md`
- **Status:** Resolved in the PRD and v2.1 architecture contract

#### Disposition

The product owner selected option 1 from the required change:

- the v2.1 key registry is a fixed, release-versioned superset independent of
  enabled features;
- feature changes alter only which assigned existing keys are consumed;
- future logical key identities require an explicitly reviewed later-version
  migration and cannot be inferred as fresh provisioning;
- identity and vault envelope-root rotation is requested only through
  `--rotate-root-key identity` or `--rotate-root-key vault` plus a fresh
  canonical UUID in `--rotation-request-id` at vault restart;
- the vault stays setup-only with no credential listener, validates all state
  before writes, holds exclusive maintenance authority, journals one operation,
  conditionally rewraps only expected-old-version records, retains the old root
  until zero-reference verification and atomic manifest commit, and resumes a
  valid interrupted journal before ordinary startup; and
- neither REST socket nor any browser, control, OAuth, MCP, database-managed, or
  remote CLI input can initiate rotation.

This closes the original contradiction without adding a service, broadening the
runtime caller table, weakening automatic no-replacement provisioning, or
coupling the product requirement to SQL.

#### Evidence

At the reviewed baseline, the PRD said existing behavior outside v2.1 scope
remained unchanged (`docs/prd/secretsauce-v2.1-prd.md:16`). It determined the
required key set from enabled services and features (`:561` and `:570`).

At the same time:

- a configured installation with a newly required missing key enters
  `configuration_error` and cannot generate it (`:585`);
- the provisioning entrypoint is the only generator, while runtime components
  may never generate or replace keys (`:604`);
- the entrypoint irreversibly loses setup-only key-directory access before the
  credential listener opens (`:671`);
- the configured-state matrix contains only exact-match success and
  missing/mismatch failure (`:1292`); and
- the settled decisions repeat both sole generation and no configured reset
  (`:1673` and `:1717`).

That conflicts with the preserved v2 root-key lifecycle:

- `docs/architecture/v2/vault.md:58` defines install, activate, resumable rewrap,
  verify, inventory, and retire;
- `docs/architecture/v2/decisions.md:42` makes envelope rotation an accepted
  architecture decision; and
- `docs/architecture/v2.1/vault-rest-api.md:111` still gives local key
  administration host-authorized lifecycle operations.

The same gap appears when a configuration change enables a feature that needs a
previously unnecessary key. Disabling a feature is also undefined: the PRD does
not say whether old manifest entries and keys remain a permanent superset or
whether a safe removal transition exists.

#### Realistic failure scenario

An operator enables a feature after initial setup, or begins a scheduled or
compromise-driven vault root-key rotation. The next startup computes a different
required key set. Under the current matrix it must enter `configuration_error`;
the only authorized generator no longer has write access, adoption is available
only when the whole manifest is absent, and runtime key administration cannot
update the configured commitment.

An implementation can proceed only by silently disabling rotation, bypassing
the manifest, regaining setup privilege, or inventing an unreviewed transition.
Each option contradicts a settled requirement.

#### Impact

- Scheduled and compromise-driven root-key rotation can become impossible.
- A feature toggle can permanently prevent startup.
- Different key adapters may invent incompatible manifest-update behavior.
- A recovery procedure may mistake an authorized rotation for key corruption or
  permit an unsafe replacement under the label of rotation.

#### Required change

The PRD should separate **automatic startup provisioning** from **explicit
host-authorized key lifecycle administration**.

It must then choose and document one coherent key-set policy:

1. Provision a stable superset of SecretSauce-owned application keys so feature
   toggles never add or remove manifest identities, while defining a separate
   authorized root-key rotation transition; or
2. Define an atomic, resumable manifest-amendment lifecycle for key addition,
   activation, rewrap, verification, retirement, and any allowed feature-driven
   key-set change.

Either choice must retain one writer at a time, prohibit automatic replacement,
bind every manifest transition to the authorized operation, keep old keys until
inventory proves they are unused, update the aggregate commitment atomically,
and fail closed on interruption or ambiguity. “No initialization CLI” must not
be interpreted as removing the preserved host-local maintenance authority.

#### Verification

The amended contract adds positive and negative acceptance cases for:

- enabling and disabling every conditionally keyed feature after configuration;
- installing, activating, rewrapping, verifying, and retiring identity and vault
  root keys;
- interruption and restart at every lifecycle transition;
- missing old/new key, stale aggregate, incomplete inventory, concurrent
  lifecycle attempt, and unauthorized caller;
- compromise rotation and invalidation of affected runtime references; and
- startup while an authorized key transition is in progress.

### LOOSE-002: REST requests are authenticated, but vault endpoint and response trust are unspecified

- **Priority:** Blocker
- **Category:** likely vulnerability if implemented literally
- **CVSS v3.1:** 7.8
  `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H`
- **Confidence:** High for the contract gap; exploitability is conditional on
  socket-directory or endpoint replacement access
- **Affected components:** `VAULTAPI-001` through `VAULTAPI-008`,
  `docs/architecture/v2.1/vault-rest-api.md`, and the official Compose socket
  volume
- **Status:** Resolved in the PRD and v2.1 architecture contract

#### Disposition

The product owner selected REST over Unix sockets for v2.1. The amended contract
requires vault-owned non-rebindable socket parents, read-only client mounts,
endpoint metadata validation before request transmission, credential-response
HMAC binding, and negative endpoint-replacement tests. HTTPS/mTLS remains
deferred until a version introduces a network transport.

#### Evidence

`VAULTAPI-003` authenticates the caller's request and binds method, target,
headers, body digest, UUID, time, and nonce
(`docs/prd/secretsauce-v2.1-prd.md:982`). The PRD and v2.1 REST architecture do
not require the client to:

- validate that the connected server is the vault identity;
- reject a socket path or parent directory that another workload can replace;
  or
- authenticate and request-bind the HTTP status, selected response headers, and
  exact response body.

This loses an explicit property of the current protocol. The broker signs
responses with the caller key and binds caller, operation, and request ID
(`src/vault/broker.ts:523`); the client verifies that authenticator and binding
before accepting the result (`src/vault/client.ts:108`). The current deployment
also gives the application a read-only socket-volume mount
(`test/vault-deployment.test.ts:19`), and the broker validates a non-writable,
owned socket parent (`src/vault/broker.ts:613`). Those controls are not carried
into the v2.1 requirements or acceptance criteria.

#### Preconditions

The attacker needs local execution and the ability to create, replace, or race
the expected socket endpoint, such as through an incorrectly writable shared
socket volume. There is no remote network path in the v2.1 design. A correctly
owned non-rebindable socket directory and read-only client mount materially
reduce this risk.

#### Exploit scenario

An unrelated local workload binds an impostor credential socket before a client
connects. A control-plane create/replace request then sends a downstream
credential to the impostor. A data-plane request can receive attacker-selected
credential bytes or a forged success/error. Request HMAC proves the client to
the impostor; it does not prove the server to the client or keep the request
body confidential from that endpoint.

Spoofing only the status listener has lower impact because the application still
validates keys and performs the credential handshake, but it can cause false
setup progress or denial of service.

#### Impact

The conditional impact is disclosure of submitted credentials, forged resolved
credentials or administrative outcomes, and denial of vault service. It does not
create a remote exploit and does not bypass a correctly enforced
vault-owned/non-rebindable socket boundary.

#### CVSS rationale

The conditional vector is local (`AV:L`) and assumes a low-privilege workload
has been given unsafe write/rebind access (`PR:L`). No victim interaction is
required. An impostor endpoint can affect confidentiality, integrity, and
availability of secret-bearing vault operations. If the supported deployment
proves that only the vault can create or replace the endpoint, the scenario is
blocked and the score no longer describes the deployment.

#### Remediation

Define an invariant that every first-party vault client authenticates the vault
endpoint and accepts a response only when its integrity and request binding are
proven.

For v2.1 Unix sockets, the minimum contract should require:

- a vault-owned, non-symlink, non-group/world-writable socket parent;
- no client identity with directory write, unlink, rename, or bind authority;
- read-only client mounts for the socket volume where the platform supports
  them;
- startup and connection-time ownership/type/mode validation without unsafe
  stale-socket deletion; and
- either an HMAC-authenticated response bound to logical audience, API version,
  caller, request UUID, status, selected response headers, and exact body digest,
  or an equivalently reviewed server-identity and channel-integrity mechanism.

This does not require HTTPS in v2.1. A future mutually authenticated HTTPS
adapter can satisfy the endpoint and channel requirements through TLS while
preserving the same application-level response correlation and schemas.

#### Verification

Add tests that:

- reject writable, symlinked, wrongly owned, replaced, and non-socket parents or
  endpoints;
- prove application/data/control/backup identities cannot bind, unlink, rename,
  or replace either socket;
- reject forged, replayed, cross-request, wrong-caller, wrong-status,
  header-tampered, and body-tampered credential responses;
- fail closed if the endpoint changes during connection; and
- confirm secret-bearing requests are never sent after endpoint-authentication
  failure.

### LOOSE-003: Replay and one-use behavior across vault restart is undefined

- **Priority:** Required before implementation
- **Category:** confirmed security-contract ambiguity
- **CVSS v3.1:** N/A; no v2.1 mechanism is implemented
- **Affected components:** `VAULTAPI-003`, `VAULTAPI-004`, acceptance 21.7, and
  private vault API security tests
- **Status:** Resolved in the PRD and v2.1 architecture contract

#### Disposition

Every credential-API process start creates a new unpredictable boot identifier.
Requests and capabilities bind it. A vault-only restart invalidates prior
outstanding authority, while credential-API durable journaled work requires a
new handshake and fresh authorization. The separately host-authorized,
pre-listener root-maintenance journal is bound to its durable request UUID and
does not accept prior credential-process authority.

#### Evidence

The PRD requires stale/replayed requests to fail and resolution capabilities to
be one-use (`docs/prd/secretsauce-v2.1-prd.md:982` and `:991`). Acceptance and
testing mention nonce replay, but do not state behavior across a vault-only
restart (`:1514` and `:1575`).

This cannot safely remain implicit because the current protocol and capability
authority use in-memory replay caches (`src/vault/protocol.ts:137` and
`src/vault/capabilities.ts:94`). A restart clears those caches while stable key
files can still validate an unexpired signed request or capability.

#### Required change

State one of these equivalent outcomes:

- consumed request UUIDs/nonces and one-use capabilities remain consumed across
  a vault-only restart for their full validity window; or
- every outstanding request and capability is cryptographically invalidated by
  a new vault boot epoch, with issuers obtaining that epoch before minting new
  work.

The exact storage or epoch mechanism may remain an architecture choice.

#### Verification

Test a consumed request and capability before and after a vault-only restart,
plus outstanding-work invalidation, clock-boundary, and interrupted-operation
cases.

### LOOSE-004: Global and concurrency limit bounds are missing

- **Priority:** Required before implementation
- **Category:** confirmed product/data-contract omission
- **CVSS v3.1:** N/A
- **Affected components:** `ABUSE-001`, `ABUSE-002`, acceptance 21.3, and
  deployment configuration
- **Status:** Resolved in the PRD

#### Disposition

The PRD now defines host-local environment names, safe defaults, allowed ranges,
cross-field validation, sanitized startup failure, and application enforcement
when a reverse proxy is absent or more permissive.

#### Evidence

`ABUSE-001` requires bounded account, direct-source, global, password, TOTP, and
expensive-work concurrency controls (`docs/prd/secretsauce-v2.1-prd.md:767`).
`ABUSE-002` then says the defaults and configurable bounds “must be” the values
in its table, but the table contains no global or concurrency rows (`:770`).
Acceptance still requires both controls (`:1433`).

Current implementation defaults exist for some related settings, but the PRD
does not explicitly preserve them or set safe v2.1 configuration ranges.

#### Required change

Add global and per-source/global expensive-work concurrency defaults and allowed
ranges, or explicitly reference the preserved authoritative v2 settings. Reject
out-of-range values rather than clamping them.

#### Verification

Add configuration-boundary tests, aggregate-load tests, and negative cases
showing that source spoofing in accepted-risk `always` mode cannot bypass global
or expensive-work limits.

## Exploit Chains

No independent remote exploit chain was identified.

An implementation must not add an ad hoc key-maintenance listener. That would
expand key-write authority and private API exposure outside the reviewed
contract. The settled lifecycle uses an explicit host-authorized startup
transition, not a general maintenance endpoint.

## What Is Good

- **Good: retained-state freshness is genuinely fail-closed.** Fresh generation
  requires every required inventory to be definitively absent or empty.
- **Good: adoption is explicit and non-generating.** A complete key set, a
  host-local flag, and adapter-owned compatibility validation are all required.
- **Good: the setup topology has one writer.** The vault entrypoint owns
  provisioning and the manifest; the application has a real setup-only phase.
- **Good: the privileged vault has no network attachment.** Unix sockets and
  caller-specific authorization remain separate controls.
- **Good: the REST request boundary is otherwise strong.** It binds semantic
  request fields, rejects HTTP ambiguity, preserves caller allowlists and
  capabilities, and prohibits secret-bearing diagnostics.
- **Good: public authentication behavior is unusually precise.** Enumeration
  resistance, suspension counting, recovery, session revocation, conditional
  admin authority, and logout failure are testable and fail closed.
- **Good: accepted risks are explicit.** Bootstrap-log authority and forwarding
  `always` mode state their operator assumptions and residual risks.

## What Is Bad Or Risky

- **Risky: root maintenance is intentionally high authority.** It temporarily
  writes the selected root and affected encrypted store, so journal integrity,
  exclusive access, conditional rewrap, old-root retention, and zero-reference
  verification are milestone-critical.
- **Risky: the REST review considered caller authentication but not the reverse
  trust direction.** A private socket does not by itself prove which process is
  listening.
- **Risky: restart semantics are hidden behind the word “one-use.”** An
  in-memory-only interpretation is weaker than the stated property.
- **Risky: global abuse controls are required but not bounded.** Extremely high
  or low operator values can respectively weaken protection or create avoidable
  denial of service.

## What Should Change

1. Implement and verify all four settled loose-end contracts in their
   respective milestones.
2. Treat the exact rotation arguments and every environment setting as external
   inputs with positive and negative tests.
3. Complete the detailed UX/accessibility and data/API artifacts before
   declaring implementation readiness.

## What I Would Not Change Yet

- Do not add HTTPS, mTLS lifecycle, a Docker network, or remote vault discovery
  to solve `LOOSE-002`; the Unix transport can meet the invariant.
- Do not add a third provisioning service or remotely invokable setup endpoint.
- Do not add root rotation to either REST caller table; it remains an explicit
  host-local maintenance startup.
- Do not add feature-driven key-set amendment in v2.1; the fixed superset is the
  settled policy.
- Do not weaken the retained-state matrix, explicit adoption flag, no-replace
  automatic provisioning, or configured missing-key failure.
- Do not generalize the closed key/store adapters into a plugin system.
- Do not reopen the accepted bootstrap-log or `always` forwarding-header
  decisions without new evidence.
- Do not redesign the session, suspension, conditional revocation, or logout
  contracts; no material loose end was found there.

## Positive Security Observations

- Provisioning preflight precedes every authorized fresh write.
- Manifest fingerprints and aggregate commitments contain no raw secrets.
- Setup, status, health, logs, and audits have explicit secret exclusions.
- The credential API remains closed until configured commit and privilege drop.
- Authentication, destination validation, policy, and capacity remain ahead of
  credential substitution and downstream I/O.
- Browser/OAuth/MCP operations remain gated and independently authenticated.
- Every new external-input family has positive and negative test requirements.

## Overall Opinion

The PRD has no remaining security or architecture product-contract blocker and
is ready for milestone breakdown.

The fixed v2.1 key superset makes feature toggles lifecycle-neutral. The
explicit, journaled maintenance startup preserves identity/vault root rotation
without adding a service, REST capability, or configured automatic-replacement
path. REST endpoint/response trust, restart invalidation, retained-state
freshness, adoption, and application-owned protective limits remain coherent.

Implementation readiness remains intentionally separate: detailed interface
artifacts, implementation, and executable proof of the documented boundaries
are still outstanding.

## Validation

This was a documentation-only audit. No executable tests were run because the
review changes no executable behavior and the v2.1 design is not implemented.

Validation confirmed:

- 122 unique, contiguous requirement definitions across 11 domains;
- the retained-state startup matrix, acceptance criteria, tests, traceability,
  and settled decisions agree;
- the old custom framing is removed from the v2.1 contract;
- the current protocol authenticates responses and checks a safe socket parent,
  providing concrete evidence for the REST equivalence gap;
- the fixed v2.1 key registry and explicit identity/vault root-maintenance
  lifecycle now agree across the PRD and both v2.1 architecture records;
- root maintenance is absent from the REST caller table and retains one writer,
  fail-closed resume, old-root retention, and atomic aggregate commitment; and
- no material security or architecture product decision remains open.
