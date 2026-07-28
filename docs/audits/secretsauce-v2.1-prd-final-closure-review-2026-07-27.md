# SecretSauce v2.1 PRD Final Closure Review

## Metadata

- **Project/repository:** SecretSauce (MCP)
- **Git SHA reviewed:** `60007fafa017b96b516922276a727afe5e7a35e7`
- **Review date/time:** 2026-07-28T03:42:07Z
- **Reviewer roles:** application security reviewer and software architect
- **Primary scope:** `docs/prd/secretsauce-v2.1-prd.md`
- **Architecture scope:** `docs/architecture/v2.1/provisioning.md`
- **Prior findings:** `FINAL-001` and `FINAL-002` in
  `docs/audits/secretsauce-v2.1-prd-final-readiness-review-2026-07-27.md`
- **Commands used:** `git status --short`, `git rev-parse HEAD`, `git log`,
  `date -u`, `rg`, `sed`, `nl`, requirement-definition uniqueness searches,
  and `git diff --check`
- **Limitations:** product-contract and architecture-baseline review only; v2.1
  behavior is not implemented, so implementation security and runtime
  correctness are not claimed

## Scope

This focused review determines whether the retained-state and provisioning
topology changes close the two blockers from the prior final-readiness review,
whether they introduce a new material security or architecture conflict, and
whether the PRD can advance to milestone breakdown.

The review covers:

- manifest/key/retained-state startup decisions;
- vault setup authority and runtime privilege separation;
- manifest ownership and storage;
- private provisioning status and public projection;
- Compose startup ordering and network isolation;
- failure, retry, adoption, and recovery behavior; and
- requirement, acceptance, test, and decision-ledger consistency.

## Executive Summary

Both blockers are resolved.

`FINAL-001` is closed because fresh generation now requires the manifest and all
required keys to be absent **and** every recognized retained-state inventory to
be definitively absent or empty. Retained vault ciphertext, application data,
identity/authenticator state, OAuth state, audit lineage, installation markers,
or an unavailable/indeterminate inventory enter `configuration_error` without
creating a key or manifest.

`FINAL-002` is closed because the v2.1 architecture now selects the existing
vault service's startup entrypoint as the sole coordinator, key generator, and
manifest writer. The application starts concurrently in explicit setup-only
mode, consumes a bounded read-only status operation over a dedicated Unix
socket, and enables ordinary behavior only after vault readiness plus its own
runtime checks. The vault has no network attachment, and its authenticated
broker opens only after configured commit and irreversible setup-privilege
drop.

Security verdict: **ready for milestone breakdown**. No open product-contract
security blocker remains.

Architecture verdict: **ready for milestone breakdown**. Coordinator ownership,
manifest placement, startup order, status propagation, and failure visibility
are selected.

Implementation-ready remains **no**. The design still requires milestone plans,
detailed UX/accessibility and data/API review, implementation, and executable
validation.

No CVSS score is assigned because no deployed v2.1 vulnerability is being
reported.

## Threat Model

- **Exposed interfaces:** public setup/health, login/enrollment, control API,
  OAuth/MCP, private provisioning-status Unix socket, and authenticated vault
  broker Unix socket.
- **Sensitive assets:** generated identity/session/OAuth/vault/caller keys,
  retained application and vault data, bootstrap credentials, tokens, grants,
  audit evidence, and the configured manifest commitment.
- **Trust boundaries:** public client to application; application setup-only
  process to status socket; application runtime to authenticated vault broker;
  privileged vault setup entrypoint to key/setup/state volumes; replaceable
  containers to durable volumes; and setup identity to reduced runtime vault
  identity.
- **Likely attacker/failure profiles:** remote unauthenticated or authenticated
  client, compromised application process, compromised vault runtime, malicious
  dependency in the privileged setup phase, partial restore, lost volume,
  interrupted provisioning, and operator configuration error.

## Findings Summary And Closure

| ID | Prior status | Final status | Evidence |
| --- | --- | --- | --- |
| `FINAL-001` | Blocker | Resolved | `SETUP-017` and `SETUP-020` require definitive retained-state emptiness for fresh provisioning and fail closed on present or indeterminate state. The authoritative matrix at PRD lines 1225-1244 and acceptance 21.1.17-19 prohibit writes when retained application or vault state remains. |
| `FINAL-002` | Blocker | Resolved | `SETUP-013`-`SETUP-025`, PRD section 18.1, and the approved v2.1 provisioning architecture select one vault-owned coordinator, dedicated setup-state volume, concurrent setup-only application, private status socket, privilege transition, and no-network vault deployment. |

The eight original PRD concerns are now resolved or explicitly accepted:

| Original ID | Final status |
| --- | --- |
| `PRD-001` designated secret delivery channels | Resolved |
| `PRD-002` provisioning ownership/topology | Resolved by `FINAL-002` closure |
| `PRD-003` destructive partial-restore ambiguity | Resolved by `FINAL-001` closure |
| `PRD-004` bootstrap log authority | Accepted risk, documented |
| `PRD-005` scoped revocation race | Resolved |
| `PRD-006` forwarding-header trust | Resolved with explicit accepted-risk `always` mode |
| `PRD-007` logout failure behavior | Resolved |
| `PRD-008` premature readiness declaration | Resolved |

## Security Review

### What Is Good

- **Good: freshness is fail-closed.** The vault performs manifest, key, retained
  store, storage, and adoption preflight before writes. Only a definitively
  empty installation can enter fresh generation.
- **Good: the most privileged phase has no network attachment.** Omitting ports
  alone would not prevent egress; `SETUP-025` requires the vault to have no
  network attachment during provisioning, status-only error, and runtime.
- **Good: bootstrap status is narrow.** The status socket is local, read-only,
  input-free, closed-schema, non-secret, and separate from the authenticated
  credential protocol. Browser, OAuth, and MCP clients cannot reach it directly.
- **Good: runtime authority is reduced before the broker opens.** Application
  key directories become inaccessible to the runtime vault, while consumers
  receive only assigned read-only keys.

### What Is Bad Or Risky

- **Risky: provisioning remains an installation-wide authority.** The vault
  setup entrypoint temporarily generates every SecretSauce-owned key. A defect
  in adapter selection, file targeting, or privilege transition can affect the
  whole installation.
- **Risky: filesystem permissions authenticate pre-key status.** This is
  acceptable for a bounded non-secret, read-only operation, but implementation
  must validate socket directory ownership, mode, peer access, response bounds,
  timeout, and malformed-state handling.
- **Risky: liveness during fatal configuration error can be misunderstood.**
  This is controlled by operational readiness remaining 503, a distinct bounded
  `not_ready` projection, absent broker socket, and required operator
  documentation.

### What Should Change

No further PRD change is required before milestone breakdown. Milestones must:

1. prove that complete preflight precedes every key or manifest write;
2. test no-replace atomic writes and every interruption boundary;
3. prove the runtime vault cannot regain application-key setup access;
4. verify no network attachment in Compose rather than merely no published
   port;
5. test socket ownership, response bounds, timeout, unknown state, and
   unavailable status; and
6. scan setup logs, status, manifest, and errors for secret absence.

### What I Would Not Change Yet

- Do not add a network setup API or remote provisioning trigger.
- Do not add a third deployed setup service.
- Do not generalize closed adapters into a runtime plugin system.
- Do not weaken retained-state classification to “directory exists” or
  “database file exists”; each supported store requires an authoritative,
  bounded classifier.

## Architecture Review

### What Is Good

- **Good: ownership is singular.** One entrypoint owns the manifest and all
  generation, eliminating cross-process key races and a distributed manifest
  commit.
- **Good: startup has no dependency cycle.** The application can serve bounded
  setup health while the vault prepares keys, without taking the SQLite writer
  lock or pretending to be operational.
- **Good: status and credential protocols remain separate.** Bootstrap
  coordination does not weaken the established authenticated vault capability
  protocol.
- **Good: the v2.1 record explicitly supersedes manual v2 key setup.** Current
  Compose behavior is an implementation baseline to change, not an unresolved
  architecture choice.

### What Is Bad Or Risky

- **Risky: setup-only mode must be a real composition-root phase.** Scattered
  per-route checks would risk partially initialized jobs, persistence, OAuth,
  or MCP behavior.
- **Risky: the privilege transition is platform-sensitive.** The milestone must
  choose and validate a concrete OS mechanism that works in the supported
  container image and cannot be reversed by the runtime vault.
- **Risky: adapters couple provisioning to all supported key and store
  formats.** This is appropriate for the single product image, but adapter
  registration must be closed, versioned, exhaustive for enabled features, and
  covered by contract tests.

### What Should Change

No additional architecture decision blocks breakdown. The provisioning
milestone plan must keep these as one vertical slice:

- Compose volume/identity/network layout;
- vault preflight and adapter registries;
- durable manifest transitions;
- private status socket;
- setup-only application composition;
- privilege transition and broker start; and
- positive, negative, interruption, partial-restore, and container-recreation
  tests.

### What I Would Not Change Yet

- Keep the normal OS-separated vault broker.
- Keep the application's single SQLite writer and combined application
  composition root.
- Keep public setup and health schemas stable.
- Keep exact scheduler, privilege-drop mechanism, and manifest storage library
  as milestone implementation choices, subject to the settled contracts.

## Readiness-Gate Assessment

| Gate | Result | Justification |
| --- | --- | --- |
| Product purpose | Pass | Goals, users, non-goals, and measurable outcomes remain explicit. |
| Existing-product baseline | Pass | Preserved behavior, intentional v2.1 changes, and the limited adoption path are explicit. |
| Actors and authorization | Pass | Human, proxy, provisioning, runtime, and external-provider authority is defined. |
| Domain and lifecycle | Pass | Provisioning, retained-state, configuration-error, enrollment, and operational transitions are authoritative. |
| Security and privacy | Pass for milestone breakdown | Trust boundaries, secret channels, accepted risks, fail-closed startup, and negative tests are explicit. |
| Primary and negative workflows | Pass | Fresh, interrupted, adopted, partial-restore, fatal, retry, logout, revocation, and recovery paths are testable. |
| Data and interfaces | Pass for milestone breakdown | Stable requirements and bounded public/private status contracts exist; detailed schemas remain a milestone review. |
| Integrations and compatibility | Pass | Compose, vault, OIDC, OAuth/MCP, proxy, Codex, and ChatGPT boundaries are covered. |
| Operations and rollout | Pass | Coordinator, volume ownership, startup order, liveness/readiness, recovery, and no-network vault behavior are selected. |
| UX acceptance | Pass for milestone breakdown | Setup privacy, exact critical failure behavior, accessibility, responsive behavior, and retry paths are testable. |
| Acceptance and traceability | Pass | Requirements, acceptance criteria, negative tests, and review focus are traceable. |
| Decision closure | Pass | Remaining section 24 questions are internal mechanism selections and do not change product behavior. |

## Overall Opinion

The v2.1 PRD is ready for milestone breakdown.

- **Product-behavior ready for downstream review: yes**
- **Implementation-ready: no**
- **Milestone-breakdown ready: yes**

The implementation-ready declaration must remain `no` until the milestone plans,
detailed UX/accessibility and data/API contracts, implementation, and executable
validation satisfy their respective gates. This does not prevent
`prd-to-milestones` from producing dependency-ordered implementation milestones
from the now-settled product and architecture baseline.

## Validation

This was a documentation-only review. No executable tests were run because v2.1
provisioning is not implemented. Validation consisted of:

- diff and Markdown whitespace checks;
- requirement-definition uniqueness and range checks;
- stale provisioning-owner and nonzero-exit wording searches;
- cross-checking requirements, lifecycle, authoritative matrix, acceptance,
  tests, operations, settled decisions, and architecture record; and
- focused security and architecture review against both prior blockers.
