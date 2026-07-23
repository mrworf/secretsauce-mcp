# Threat Model

## Scope, assets, and assumptions

Assets are downstream credentials; identity root/vault/archive keys; password,
TOTP, session, OAuth, API-key, and reference material; authorization/configuration;
audits; backups; and availability of the single instance. Adversaries include an
unauthenticated network client, malicious authenticated user, compromised browser,
over-scoped admin/API key, malicious downstream service, archive author, local
unprivileged user, and a compromise of one application process.

TLS termination, host key files, the container/host kernel, operator root access,
and the external OIDC provider are trusted within their stated roles. Root or
kernel compromise can defeat OS separation and is outside the containment claim.
Allowed downstream endpoints remain part of the credential boundary; response
scanning is exact/pattern defense, not universal exfiltration prevention.

## Trust-boundary abuse cases

Every boundary has an allowed and denied path that later tests must exercise.

| Boundary | Allowed path | Denied/abuse path and control | Test milestone |
| --- | --- | --- | --- |
| Internet → MCP listener | Valid OAuth token, eligible user, valid MCP request | Missing/replayed/wrong audience token, admin identity, oversized body; uniform auth, independent POST auth, limits | 14 |
| Internet → control listener | Same-origin browser session or permitted API key | CSRF, wrong Host/Origin, cross-service IDOR, API-key hard denial; middleware ordering | 02, 05, 16 |
| Browser → secret input | Bounded credential write or one-time key display | URL/cache/DOM/log/error reflection; schema-tagged redaction and `no-store` | 06, 11, 16 |
| Data plane → authorization DB | Current grant/user/generation lookup | Stale cached role/assignment or DB unavailable; fail closed before vault/I/O | 13–15 |
| Control → SQLite | Authorized mutation plus audit in one unit-of-work | Stale write, audit failure, second writer, injection; bound statements and transaction ownership | 01–02 |
| Data plane → vault | One-use request-bound resolve capability | Control caller asks resolve, replay, altered digest, cross-service credential; OS identity + caller MAC + allowlist | 03, 13 |
| Control → vault | Create/replace/delete metadata | Read/export plaintext or forged caller; operation absence and separate key | 03, 11 |
| Backup → vault | Stepped-up one-use encrypted export/import | API key, expired authorization, plaintext temp file, resource-exhausting KDF; capability and streaming bounds | 03, 21–22 |
| Data plane → downstream | Canonical allowed target after policy/capacity/substitution | SSRF, encoded path ambiguity, redirect, self-API-key, timeout/oversize, transformed reflection; canonical checks and response defense | 13, 17 |
| OIDC provider → identity | Exact issuer, signature, audience, nonce/PKCE/state and configured MFA | Discovery SSRF/redirect, email auto-link, missing assurance, algorithm confusion | 08 |
| Archive → restore/migration | Bounded valid archive/YAML staged before mutation | Traversal, links/devices, bomb, bad checksum/schema/ref, partial write, secret source output | 22–23 |
| Host user → break glass | Direct socket, interactive target selection, once-only temp password | Remote call, password argv, superadmin loss, missing audit; host authority and invariant transaction | 06 |
| Jobs → identity/audit | Bounded retention/inactivity transition | Last-superadmin loss, unbounded lock/disk, silent event; predicate, batch/time limits, audit | 18–20 |

## Privileged operation traces

| Operation family | Authentication → authorization/step-up → mutation/use → invalidation → audit |
| --- | --- |
| User/profile/role/status/authenticator | Session or permitted static API role → role/service relationship, last-superadmin, browser step-up where required → one transaction → user security epoch, sessions/grants/references as matrix requires → denormalized actor/target and safe diff |
| Service/group/assignment/policy | Session/API key → service access before child object, static matrix, ETag → publish transaction → service/credential generation and affected references → service-scoped safe diff |
| Credential value | Browser/API key → service/credential authority; self-key special workflow requires interactive superadmin step-up → vault write then metadata transaction with compensation on failure → vault/publication generation → status/hint only |
| MCP runtime request | OAuth access hash → active eligible user, grant, service, every credential, destination, policy, capacity → one-use vault resolve and downstream request → dynamic generations on next use → sanitized outcome/category, never request/response body |
| API-key lifecycle | Browser session → admin/superadmin scope plus step-up → one-time raw key and slow verifier transaction → independent system principal; revoke immediate → nickname/UUID/suffix/role/scope only |
| Backup | Browser superadmin step-up or `system` key for credential-less only → rate/free-space/content rules → stream archive; optional broker encrypted export → no runtime state change → archive ID/checksum/counts |
| Restore | Browser superadmin + step-up + destructive confirmation/justification → validate/stage/snapshot → atomic portable replacement → revoke keys/sessions/grants/references, global epoch, remediation → safe preview/counts/outcome |
| Migration | Local host authority + bootstrap superadmin → dry run and explicit commit → import config, optional broker writes → invalidate v1 state; no identities/ACLs → counts and safe diagnostics |
| Global security/vault key | Interactive superadmin step-up only → last-superadmin and operation-specific checks → epoch/authenticator or key-journal transaction → global state or generation → key IDs/counts, never material |

## Threats and required mitigations

| Threat | Mitigation and residual risk |
| --- | --- |
| Credential disclosure | Vault OS boundary, write-only control API, prohibited-field sinks, envelope encryption, no secret history/backup by default. Approved downstream computation may transform a credential; constrain endpoints. |
| Privilege escalation/IDOR | Immutable IDs, centralized static role matrix, service-before-child checks, same-service constraints, table-driven cross-role tests. Logic defects remain possible; denial tests cover every cell. |
| Session/token theft | Secure cookies, opaque hashes, short access tokens, refresh rotation/replay family revocation, epochs. A stolen live token works until detected/expired. |
| CSRF/XSS/clickjacking | Same-origin checks, CSRF token, strict CSP, output encoding, frame denial, no permissive CORS. Dependency/browser defects remain. |
| SSRF and routing ambiguity | Configured origins, DNS pinning where remote metadata is fetched, redirect rejection, special-use rejection, canonical path policy, percent-encoding rejection. Operator-approved private downstreams are intentional. |
| Database tampering/races | One writer, constraints, transactions, ETags, checksums, integrity/readiness. Host root can tamper or replace keys. |
| Audit evasion/data leak | Mutation/audit atomicity, allowlisted canonical FTS, sink redaction, fail-closed control writes, bounded retention. Disk exhaustion causes readiness/privileged failure, not silent success. |
| Denial of service | Per-source/principal limits, request/query/archive bounds, worker concurrency, job budgets, SQLite busy timeout. One instance remains a deliberate availability limit. |
| Backup/restore compromise | Minimal portable scope, checksums, safe extraction, KDF/AEAD, staging, encrypted recovery snapshot, maintenance mode. Operator loss of passphrase/root keys is unrecoverable. |
| Vault confused deputy | Caller-specific keys/OS users, fixed operation capabilities, one-use bound digest, nonce replay cache, no general read. Data-plane compromise can use authorized resolve rights while active. |
| API-key recursion | Recognizable key verification on write/runtime, dedicated approval workflow, exact structural checks. Arbitrary encoding/fragmentation cannot be detected universally. |

## Security review conclusion

The design preserves the small single-instance target and does not claim isolation
against host root or arbitrary transformations by an approved downstream. No
critical trust-boundary ambiguity remains for Milestone 01. Later milestones must
implement both paths in the boundary table and retain the exact authorization
order.
