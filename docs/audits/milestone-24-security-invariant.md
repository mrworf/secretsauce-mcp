# Milestone 24 Security And Invariant Review

## Metadata

- **Project/repository:** SecretSauce (MCP)
- **Review baseline:** `3ca2158`
- **Review date/time:** 2026-07-24 UTC
- **Reviewer role:** senior application security reviewer
- **Scope reviewed:** public gateway and control routes, authentication and
  authorization, OAuth/OIDC/session/API-key state, service/destination/policy
  ordering, vault capabilities, response protection, audit/logging,
  backup/restore/migration, dependency lockfile, container/CI, documentation,
  and release tests
- **Limitations:** white-box and synthetic local validation only. No production
  proxy, DNS, identity provider, downstream, hosted Codex/ChatGPT client, or
  container runtime was available.

## Executive Summary

No open Critical or High source-level finding remains. The review discovered a
High production dependency advisory and fixed it by updating `fast-uri` from
3.1.3 to 3.1.4 (`755fb7c`), then added a CI gate that blocks future High or
Critical production advisories (`3ca2158`).

The review also found that the documented separate gateway/control startup
could not satisfy the exclusive SQLite writer invariant. The supported
composition now shares one persistence owner across two distinct listeners,
rolls back partial startup, and connects the control module only to the
runtime's aggregate/invalidation interface (`82d69ea`, `3ca2158`).

One known Medium structural limitation remains accepted: an approved
downstream can transform a substituted credential in a way that exact/pattern
response scanning cannot recognize. Endpoint and route selection remain part
of the credential boundary; documentation does not claim universal
non-exfiltration.

## Threat Model

- **Exposed interfaces:** MCP/OAuth listener, browser/control listener, health
  and metadata routes, local recovery/migration CLIs, and private vault socket.
- **Sensitive assets:** downstream credentials; identity/vault/archive keys;
  passwords, TOTP, sessions, OAuth/API keys and references; authorization
  state; audits; recovery material.
- **Trust boundaries:** public client to each private listener; authenticated
  subject to service; control role/API role to object scope; application to
  vault; application to approved downstream; archive/configuration to parsers;
  CI artifact to deployment.
- **Attacker profiles:** unauthenticated network client, malicious ordinary
  user, over-scoped administrator/API key, hostile downstream/archive/client
  metadata, local unprivileged user, and supply-chain actor.

## Commands And Evidence

- `npm audit --omit=dev --audit-level=moderate`
- `npm run audit:production`
- `npm test -- --run test/release-authorization-audit.test.ts
  test/persisted-gateway.test.ts test/auth.test.ts test/api-keys.test.ts
  test/release-compatibility.test.ts`
- `npm test -- --run test/release-artifact-scanner.test.ts`
- `node scripts/scan-release-artifacts.mjs`
- `npm test`

The authorization audit checks all 246 human/API role-capability cells, every
registered route's API eligibility, interactive-only denial, superadmin hard
denials, and parent-service placement for child resources. Runtime tests prove
authentication before parsing, current authorization and canonical destination
policy before substitution/downstream I/O, stateless MCP, bound ephemeral
references, least-privilege vault operations, hash-only durable OAuth/API
state, and atomic recovery.

The closed artifact scan covers tracked source/docs/examples, generated and
built artifacts, and designated synthetic output. It rejects internal hosts,
raw API-key forms, authorization/cookie values, private keys, opaque
references, and known canaries without returning matched values.

## Findings Summary

| ID | Severity | CVSS | Confidence | Title | Status |
| --- | --- | --- | --- | --- | --- |
| M24-SEC-001 | High | 7.5 | Confirmed | Vulnerable `fast-uri` production lockfile | Fixed |
| M24-SEC-002 | Medium | 5.3 | Confirmed | Invertible downstream transformations can bypass response recognition | Accepted risk |

## Detailed Findings

### M24-SEC-001: Vulnerable `fast-uri` production lockfile

- **CVSS v3.1:** 7.5
  `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N`
- **Evidence:** `npm audit --omit=dev` reported
  `GHSA-v2hh-gcrm-f6hx` against `fast-uri@3.1.3`, reachable through production
  AJV dependency paths.
- **Disposition:** fixed by the compatible 3.1.4 lockfile update. Focused
  MCP/OAuth tests and the full suite passed. CI now runs
  `npm run audit:production` before build/test.
- **Safe validation:** run `npm run audit:production`; it exits nonzero for a
  High/Critical production advisory and performs no application mutation.

### M24-SEC-002: Invertible downstream transformations

- **CVSS v3.1:** 5.3
  `CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:N/A:N`
- **Evidence:** exact credentials, configured patterns, sensitive names, and
  recognized structured values are scanned/tokenized, but an approved
  downstream may apply an arbitrary reversible transformation before egress.
- **Preconditions:** an authenticated subject must have service access and an
  allowed route capable of reflecting or transforming credential-bearing
  input/output.
- **Impact:** the caller may recover a downstream credential and use it outside
  gateway policy/audit controls.
- **Disposition:** accepted architectural risk. Operators must narrowly allow
  downstream destinations/methods/routes and avoid reflection, debugging,
  templating, proxying, or arbitrary transformation endpoints. Response
  scanning remains defense in depth.

## Exploit Chains

No new multi-finding chain remains after remediation. The accepted
transformation limitation is already the complete path; adding more decoders
would not create a universal containment boundary.

## Hardening Recommendations

- Track the remaining Moderate `@hono/node-server` advisory. The vulnerable
  Windows `serveStatic` helper is not imported or used by SecretSauce, and the
  supported image is Linux, so it is not a reachable product path. Upgrade
  when the MCP SDK permits a patched compatible dependency.
- The combined application necessarily holds distinct data/control/backup
  caller keys. The broker still enforces fixed operation sets and retains root
  keys/store in a separate process, but arbitrary application-process
  compromise crosses the logical data/control boundary. Preserve vault
  isolation and do not imply otherwise.
- Continue independent live proxy, IdP, downstream-route, and hosted-client
  validation per deployment.

## Positive Security Observations

- Public request handling enforces authentication and tool scopes before
  dispatch, and every MCP POST authenticates independently.
- Object scope is enforced after centralized role policy; child resources are
  authorized through their parent service.
- OAuth metadata fetching is redirect-free, public-address-only, DNS-pinned,
  size/time/concurrency bounded, and schema validated.
- Credentials remain write-only in control, resolve only through one-use bound
  data capabilities, and are excluded from ordinary backups/logs/audits.
- Restore and migration use bounded parsers, authenticated recovery state,
  atomic database transitions, compensation, and explicit remediation.

## Verdict

**Pass for source security invariants with one documented accepted Medium risk
and one contained unreachable Moderate dependency advisory.** Real container
and deployment/client gates remain outside this source-only verdict.
