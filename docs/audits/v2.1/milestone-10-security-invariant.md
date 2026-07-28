# v2.1 Milestone 10 Security And Invariant Review

## Metadata

- **Project/repository:** SecretSauce (MCP)
- **Executable baseline:** `7e3a2fd`
- **Review date/time:** 2026-07-28 UTC
- **Reviewer role:** project-authored application security review
- **Assurance boundary:** this is a white-box implementation review by the
  delivery agent. It is not an independent security approval or a human
  release sign-off.

## Executive Summary

No open Critical, High, or invariant-breaking Medium source finding was
confirmed in the reviewed v2.1 candidate. The review did find one settled
architecture requirement that M09 had not implemented: global access
revocation had neither the approved 100,000-record preflight limit nor an exact
boundary fixture. That issue was fixed in `b780201`. The candidate now revokes
exactly 100,000 active records atomically and rejects 100,001 before mutation,
idempotency, success-audit, or step-up consumption commits.

The existing response-protection limitation remains accepted: a permitted
downstream can apply an arbitrary invertible transformation that exact and
pattern scanners cannot universally recognize. Route, destination, credential
placement, and policy constraints remain the structural containment boundary.

The production dependency advisory gate is still pending because the public
registry query was not authorized in this environment. This review therefore
does not approve release.

## Scope / Methodology

The review covered the v2.1 changes and their integration with authentication,
authorization, sessions, OAuth grants, setup/provisioning, source trust,
recovery, vault transport and capabilities, persistence transactions, audit,
Compose configuration, generated contracts, and release documentation.

Methods included source and schema inspection, comparison with the PRD,
threat model, ADRs, validation matrix, and milestone evidence, plus:

- a 12-file/192-test focused security suite;
- a 4-file/45-test access and persistence remediation suite;
- the complete 168-file/1,090-test suite;
- current generated OpenAPI and all 14 readiness artifacts;
- `npm ls --omit=dev --all`; and
- the 662-file closed-scope artifact/privacy scan including this staged review
  packet.

## Threat Model

- **Exposed interfaces:** separate MCP/OAuth and browser/control listeners,
  bounded setup/health routes, local maintenance CLIs, and the private vault
  Unix socket.
- **Sensitive assets:** downstream credentials; identity, setup, vault, and
  archive keys; password/TOTP material; browser sessions; OAuth tokens, grants,
  and references; recovery state; and audit records.
- **Trust boundaries:** unauthenticated client to public listener;
  authenticated subject to role/service scope; application to persistence;
  application caller roles to vault operations; application to approved
  downstream; and container/configuration input to startup authority.
- **Attacker profiles:** unauthenticated network client, malicious ordinary
  user, over-scoped administrator, hostile client metadata or source address,
  malicious downstream, local unprivileged user, and supply-chain actor.

## Findings Summary

| ID | Severity | CVSS v3.1 | Confidence | Title | Status |
| --- | --- | --- | --- | --- | --- |
| V21-SEC-001 | Low | 2.9 | Confirmed | Global revocation exceeded its approved transactional boundary | Fixed |
| V21-SEC-002 | Medium | 5.3 | Confirmed | Invertible downstream transformations can bypass response recognition | Accepted risk |

## Detailed Findings

### V21-SEC-001: Global revocation exceeded its approved boundary

- **CVSS v3.1:** 2.9
  `CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:N/A:L`
- **Evidence:** ADR-2.1-05 requires atomic global revocation up to 100,000
  selected active records and preflight rejection above that limit. The
  accepted M09 fixture exercised only 252 records and production had no cap.
- **Impact:** a superadmin could initiate work beyond the supported bound,
  increasing exclusive-writer hold time and availability risk. The action
  still required current superadmin authorization, exact confirmation,
  idempotency, step-up, and audit.
- **Disposition:** fixed in `b780201`. Bounded preflight runs inside the same
  transaction before mutation. Exactly 100,000 active grants revoke atomically
  within the operation budget; a 100,001-session request returns the uniform
  invalid-request contract and leaves domain, idempotency, audit, and step-up
  state uncommitted.
- **Safe reproduction:** run
  `npx vitest run test/access-management.test.ts`. The test creates only
  disposable local SQLite fixtures and contains both boundary cases.

### V21-SEC-002: Invertible downstream transformations

- **CVSS v3.1:** 5.3
  `CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:N/A:N`
- **Evidence:** exact credentials, configured patterns, sensitive names, and
  recognized structured values are scanned or tokenized, but no finite scanner
  can recognize every arbitrary reversible transform produced by an approved
  downstream.
- **Preconditions:** an authenticated subject must have service access and an
  allowed destination, method, and path capable of reflecting or transforming
  credential-bearing data.
- **Disposition:** accepted architectural risk, unchanged by v2.1. Operators
  must not authorize reflection, debugging, arbitrary templating, generic
  proxy, or transformation routes for credential-bearing services.

## Exploit Chains

No new multi-finding exploit chain remains after V21-SEC-001 remediation. The
accepted transformation limitation is already an end-to-end risk and is
contained through route and destination design rather than claims of universal
egress scanning.

## Hardening Recommendations

- Run `npm run audit:production` under the organization's approved registry
  disclosure policy and block the candidate on any High or Critical production
  advisory.
- Execute the exact official Compose and hosted-client runbook on the final
  candidate. Synthetic process and protocol tests do not prove deployment
  proxy, filesystem, engine, or hosted-platform behavior.
- Preserve the global revocation cap and exact/limit-plus-one fixtures whenever
  session or OAuth storage changes.

## Positive Observations

- Authentication, destination validation, current authorization, policy, and
  admission precede credential substitution and downstream I/O.
- Every MCP POST authenticates independently; durable identity is not tied to
  `mcp-session-id`.
- Browser sessions, OAuth state, idempotency, revocation, cleanup evidence, and
  success audit are transactionally coupled.
- Vault operations use fixed caller roles and one-use capabilities over a
  private Unix socket; the official Compose topology gives the vault no
  network.
- Setup, enrollment, login, abuse, recovery, rotation, and access inputs have
  positive and negative executable coverage.

## Assumptions / Limitations

A rootless Docker-compatible runtime proved the clean pre-enrollment topology,
vault isolation, and generated-file recreation. No deployed reverse proxy,
external identity provider, real downstream, hosted Codex/ChatGPT session,
manual penetration test, or independent reviewer was available. The public
production advisory query and remaining operational Compose journey were not
run. These are release gates, not implied passes.

## Appendix

Primary evidence is recorded in
`docs/audits/v2.1/milestone-10-automated-qualification.md`,
`docs/audits/v2.1/milestone-09-acceptance.md`, and
`docs/release-matrix.md`. No raw credential, token, cookie, request/response
body, opaque reference, or internal hostname was used as review evidence.
