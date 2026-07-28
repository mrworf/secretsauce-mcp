# SecretSauce v2.1 Private Vault REST Transport Review

## Metadata

- **Project/repository:** SecretSauce (MCP)
- **Git SHA reviewed:** `9a37868ced0b33f79529e5607407d821060ebd77`
- **Review date/time:** 2026-07-28T03:56:25Z
- **Reviewer roles:** application security reviewer and software architect
- **Scope reviewed:** `docs/prd/secretsauce-v2.1-prd.md`,
  `docs/architecture/v2.1/provisioning.md`, and
  `docs/architecture/v2.1/vault-rest-api.md`
- **Commands used:** `git status --short`, `git rev-parse HEAD`, `date -u`,
  `rg`, `sed`, requirement-definition consistency checks, and
  `git diff --check`
- **Limitations:** documentation and architecture-contract review only; the
  v2.1 REST transport is not implemented

## Executive Summary

The REST-over-Unix-sockets decision is acceptable and does not reopen milestone
readiness.

The previous custom binary frame is replaced in v2.1 by a versioned
OpenAPI-described HTTP/1.1 resource API. Unix sockets remain the supported
same-host transport, while HTTP parsing, request authentication, caller
authorization, and vault domain handlers are separate interfaces.

The user's security concern is correct: a compromised authorized service has
substantially the same operation risk whether it reaches the vault over a Unix
socket or a private network. Unix socket permissions reduce reachability from
unrelated processes; they do not establish that an authorized caller remains
trustworthy. The design therefore preserves caller-specific HMAC
authentication, fixed operation allowlists, one-use capabilities, and
server-side authorization independently of transport.

No open security or architecture blocker was found. No CVSS score applies
because this review reports no implemented vulnerability.

## Scope And Methodology

The review checked:

- whether REST replaces only framing rather than weakening caller controls;
- HTTP parsing and request-smuggling boundaries;
- authentication binding and replay resistance;
- compromised-caller containment;
- secret-bearing request/response logging;
- pre-key status behavior;
- separation between status and credential listener lifecycles;
- future HTTPS portability without dormant v2.1 network behavior; and
- PRD requirements, acceptance criteria, tests, traceability, and settled
  decisions.

## Threat Model

- **Exposed interfaces:** private status HTTP server over one Unix socket and
  authenticated credential HTTP server over another.
- **Sensitive assets:** vault credentials, root/caller keys, operation-bound
  capabilities, backup authorization, and non-secret provisioning state.
- **Trust boundaries:** filesystem socket reachability; service-to-vault
  authentication; authenticated caller to operation allowlist; capability to
  bound credential resolution; HTTP adapter to vault domain handler; and future
  HTTPS adapter to the same caller context.
- **Likely attacker profiles:** unrelated local/container process, compromised
  data/control/backup caller, malicious HTTP client with socket access, replaying
  caller, and future network-adjacent client if HTTPS is introduced.

## Findings Summary

| ID | Severity | CVSS | Confidence | Title | Status |
| --- | --- | --- | --- | --- | --- |
| None | — | — | — | No open specification or architecture vulnerability | Closed |

One issue was identified and resolved during review: signatures now bind a
stable logical vault audience that is independent of Unix socket path and
deployment hostname. This keeps authentication transport-neutral and prevents a
valid signed vault request from being repurposed for another logical service.

## Security Review

### What Is Good

- **Good: reachability and authority are separate.** Filesystem permissions
  restrict connection, while caller HMAC, allowlists, and capabilities determine
  permitted work.
- **Good: authentication covers semantic mutation.** Audience, API version,
  caller, method, canonical target, representation headers, raw body digest,
  request UUID, timestamp, and nonce are bound before store access.
- **Good: HTTP ambiguity is treated as hostile input.** Duplicate security
  headers, conflicting framing, non-canonical targets, upgrades, unknown fields,
  and oversized inputs are explicitly rejected.
- **Good: pre-key status stays low authority.** It is bodyless, queryless,
  parameterless, read-only, non-secret, and on a separate listener.
- **Good: secret-free diagnostics are explicit.** Raw authorization values,
  secret-bearing headers, and request/response bodies remain excluded from
  errors, logs, traces, and examples.

### What Is Bad Or Risky

- **Risky: HTTP parsers have broader behavior than the fixed frame.** The
  implementation must inspect the raw header list before normalized header maps
  can hide duplicates and must test parser-level rejection behavior.
- **Risky: HMAC profiles can drift between clients.** One canonical signature
  profile and shared conformance vectors are required; OpenAPI alone does not
  define byte-level signing.
- **Risky: a compromised caller still has its legitimate authority.** Transport
  replacement cannot prevent a compromised control caller from writing or a
  correctly authorized data caller from resolving its bound credential.

### What Should Change

No further PRD change is required. The implementation milestone must:

1. publish canonical positive and negative signature vectors;
2. test raw duplicate headers and ambiguous message framing at the actual HTTP
   parser boundary;
3. prove every failure occurs before domain/store access;
4. retain per-caller allowlist and capability tests from the existing vault;
5. verify secret absence from all HTTP diagnostics; and
6. prove no TCP/HTTPS listener or remote-vault configuration ships in v2.1.

### What I Would Not Change Yet

- Do not add HTTPS, mTLS certificate management, Docker networks, or remote-vault
  discovery in v2.1.
- Do not rely only on socket permissions or remove caller-specific HMAC.
- Do not expose the private OpenAPI service to browsers or MCP clients.

## Architecture Review

### What Is Good

- **Good: standard protocol, narrow deployment.** HTTP/OpenAPI improves tooling
  and contract review while Unix sockets preserve the supported same-host
  topology.
- **Good: future HTTPS is a transport adapter.** Domain handlers accept an
  authenticated caller context rather than HTTP, socket, or TLS objects.
- **Good: no speculative network implementation.** V2.1 designs the seam but
  does not ship dormant TCP behavior or an untested support promise.
- **Good: status and credential lifecycles remain distinct.** Adopting REST does
  not cause the credential API to exist before provisioning completes.

### What Is Bad Or Risky

- **Risky: REST can become RPC with HTTP labels.** The OpenAPI milestone should
  keep stable resources, methods, media types, status codes, and idempotency
  semantics rather than exposing one generic operation endpoint.
- **Risky: generated clients can obscure security behavior.** Authentication,
  raw-body hashing, bounds, and secret handling require explicit adapters and
  contract tests even if schemas or clients are generated.

### What Should Change

No additional architecture decision blocks milestone planning. The vault API
milestone should deliver the OpenAPI contract, strict Unix HTTP adapters,
transport-independent handlers, caller authentication/authorization, and
positive/negative conformance tests as one vertical slice.

### What I Would Not Change Yet

- Keep the two Unix listeners rather than combining pre-key status and
  credential operations on one lifecycle.
- Keep the v2.1 no-network vault deployment.
- Defer TLS identity, certificate lifecycle, service discovery, remote
  availability, and network policy to the version that actually introduces
  HTTPS.

## Overall Opinion

REST over Unix sockets is a better architecture for v2.1 than custom binary
framing. It improves maintainability and prepares a clean HTTPS seam without
claiming that REST, sockets, or private networks make compromised callers safe.

- **Product-behavior ready for downstream review: yes**
- **Implementation-ready: no**
- **Milestone-breakdown ready: yes**

## Validation

This was a documentation-only review; no executable tests were run. Validation
confirmed:

- 117 unique, contiguous requirement definitions across 11 domains;
- no stale v2.1 custom-frame requirement;
- REST requirements have positive and negative acceptance coverage;
- future HTTPS is structurally supported but not enabled; and
- Markdown whitespace checks pass.
