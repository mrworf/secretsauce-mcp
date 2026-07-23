# Architecture Validation Matrix

This is the approved mapping from architecture scenarios to implementation
milestones. Each named milestone must add both the positive and negative cases;
failure injection is mandatory where listed.

| Concern | Positive scenario | Negative/failure scenario | Milestone |
| --- | --- | --- | --- |
| Persistence/migration | First schema applies and reopens | Changed checksum, future schema, lock contention, audit insert failure rollback | 01 |
| Control API | Session/API-key route allowed by exact role/scope | Unknown fields, CSRF/Origin, cross-service IDOR, stale ETag, reused idempotency key/different body | 02 |
| Vault | Each caller performs only its allowlisted operation | Forged/replayed capability, wrong caller/op/digest, corrupted envelope, unavailable broker | 03 |
| Bootstrap identity | Creates first active TOTP superadmin | Duplicate normalized email, weak/common password, missing key, second bootstrap | 04 |
| Login/session/step-up | Valid login and exact step-up transaction | Enumeration, TOTP replay, expired/shortened session, nonce used on changed body | 05 |
| Enrollment/recovery | Temporary flow activates once | Expired/reused temp password, missing confirmation, remote break glass | 06 |
| User lifecycle | Authorized transitions and deletion preserve audit | Last-superadmin loss, admin cross-scope/self edit, deleted operational row remains | 07 |
| OIDC | Exact issuer/subject with configured MFA links invited user | Discovery SSRF/redirect, email linking, missing MFA, nonce/PKCE/signature failure | 08 |
| Service lifecycle | Draft validates/publishes with version history | Invalid destination, stale publish, archive leaves usable reference | 09 |
| Groups/assignments | Same-service group/direct/all access | Cross-service group, empty selector, final removal deactivates user | 10 |
| Credentials | Write/replace/delete exposes metadata only | Read/clone secret, unconfigured reference, wrong assignment, compensation failure | 11 |
| Policy | Shared evaluator chooses highest priority/deny tie | Service deny overridden, canonical path drift, simulator/runtime divergence | 12 |
| Runtime auth | Full order reaches allowed downstream | Each precondition fails before vault/I/O; generation invalidation race | 13 |
| MCP OAuth | Eligible user completes both clients | Admin/nonexistent distinguishability, refresh replay, stale epoch, wrong audience | 14 |
| Access/grants | Scoped visibility and revocation | Admin revokes unrelated multi-service grant, full reference shown | 15 |
| API keys | Static role action succeeds and raw shown once | Every hard denial, scope expansion, expiry extension, verifier/raw leakage | 16 |
| Self-key defense | Explicit browser approval permits gref use | General save/raw structural runtime use/API-key approval caller | 17 |
| Settings/jobs | Values at min/max and bounded transition | Below/above range, untrusted forwarding identity, last-superadmin automation | 18 |
| Audit/search | Sanitized row and FTS commit/search/delete together | Prohibited term absent, FTS failure rolls mutation back, inclusive bound errors | 19 |
| Activity/status | Bounded categories and scoped counts | Raw/high-cardinality path, unauthorized user count, degraded health detail leak | 20 |
| Backup | Credential-less and stepped-up encrypted streams | Wrong passphrase, API-key secret request, excluded-domain leak, size/KDF limit | 21 |
| Restore | Valid staged replacement and health gate | Traversal/link/bomb/checksum/ref failure, commit failure rollback, identity overwrite | 22 |
| V1 migration | Dry run/commit safe config and optional vault values | ACL/user import, source value in diagnostics, partial commit, dual authority | 23 |
| Release | Codex and ChatGPT OAuth/MCP and documented deployment | Wrong Server URL/origin, restart/key/audit/upgrade recovery failure | 24 |

## Cross-artifact review checks

- User deletion, restore, API-key revocation, global security events, and service
  publication were walked through in `data-model.md` and agree with invalidation.
- Ordinary, validation, authorization, step-up, stale-write, and secret-input API
  cases were exercised in `management-api.md`.
- Every public/private trust boundary has an allowed and denied abuse case in
  `threat-model.md`.
- ADR-001 through ADR-010 answer all ten Section 39 questions.
- UX flows identify exact destructive targets, secret-free clone/copy behavior,
  responsive rules, and accessible interaction.
- Milestone 01 has selected libraries, schema version, composition root,
  persistence owner, audit coupling, test harness, and failure cases.
