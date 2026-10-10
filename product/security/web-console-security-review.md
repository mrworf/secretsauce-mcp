# Web console product-definition security review

## Metadata and verdict

- Product: `secretsauce-mcp`, self-hosted single-organization web console.
- Review time: 2026-10-10T01:43:54Z; repository HEAD: `9889bfe1d17a5c326046421e40367077c4e45bf3`.
- Reviewer role: application security specialist in Product Definition.
- Verdict: **PASS for definition readiness**. No unresolved material security contradiction or missing product decision was identified in the reviewed definition.
- Exact reviewed revisions: [security stage result](../../workflow/definition/results/security.yaml), `validated_inputs`. The approved UX is `web-console-ux-1`, under accepted UX-DESIGN-001.

The definition separates human administration, MCP execution, host recovery and downstream destination trust. Mandatory TOTP, current role and assignment checks, restricted recovery, explicit secret handling and fail-closed audit admission provide a coherent initial security model. The approved UX preserves these boundaries rather than offering convenience bypasses. The report adds no product scope or prerequisite approval.

This is not an implementation security acceptance, penetration test, dependency-vulnerability audit, cryptographic assurance result or SOC 2 certification. Future console code is not evaluated as if it already exists. The existing gateway's optional audit behavior is an explicitly identified replacement obligation, not evidence that the future audit requirement is already satisfied.

## Scope and method

Reviewed the PRD and both normative companion contracts, the coverage and journey artifacts with focused inspection of security-bearing journeys, and all ten canonical UX artifacts including the manifest. Decisions D-001–D-012 and UX-DESIGN-001 establish scope. No multi-tenant boundary exists in the accepted initial release; object/identity/service authorization remains essential within the one organization.

Read-only baseline source samples were `src/gateway.ts` (`executeServiceRequest`), `src/audit.ts` (`AuditSink.record`, `writeRecord`), `src/urlValidation.ts` (canonical pathname handling), `src/policy.ts` (`evaluatePolicy`) and `src/oauthClientMetadata.ts` (bounded metadata retrieval and validated-address connection). These establish preservation and intentional-change boundaries, not a full code audit. Commands used were `git rev-parse HEAD`, `git status --short`, UTC time collection, scoped `rg`/source reads and SHA-256 validation of the declared definition inputs. No application tests or exploit requests were run for this documentation-only stage.

## Threat model and data flows

| Interface or boundary | Attacker-controlled data / asset | Required security transition |
| --- | --- | --- |
| Unauthenticated browser → enrollment/login | Passwords, TOTP, capability links, Host/proxy headers | Trusted origin and protected host proof or bound invitation; no normal access before complete enrollment; bounded attempts and replay protection |
| Enrolled person → management | Object IDs, roles, drafts, settings, values, action requests | Current server-side role and object permission; recent authentication where specified; durable audit before sensitive action |
| MCP client → gateway | Auth token, tool arguments, target, opaque reference, body and headers | Authenticate every POST; eligible identity plus explicit service assignment; canonical destination/policy/reference checks before substitution and I/O |
| Configuration author → downstream | Destinations, policies, scanning exceptions, placement | Owner/Administrator is a trusted destination author; explicit reviewed exceptions; assigned caller does not choose an unrestricted credential destination |
| Downstream → MCP client | Response headers/body, reflected/transformed data | Preserved response defenses and safe bounded handling; exact/pattern scanning is not a universal non-exfiltration boundary |
| Operator/Owner → restore | Encrypted archive, recovery material, target Owner, host proof | Validate before replacement, preserve rollback/evidence, then fresh restricted enrollment and reviewed activation |
| Product → audit/backup storage | Sanitized events, encrypted snapshots, key dependencies | Durable admission, consistent snapshot and provenance; host administrator remains outside product tamper resistance |
| Product → SMTP / OAuth metadata | Owner SMTP configuration; client metadata URL/content | Credentials excluded from status/logs; SMTP delivery is not authentication evidence; metadata retains its separate strict public-address retrieval policy |

Likely adversaries are unauthenticated internet clients, a compromised Member or MCP client, a revoked identity retaining old references, a malicious downstream response, an attacker delivering a crafted import/archive, and a compromised administrative browser. A hostile host administrator or malicious destination-authoring administrator has powers explicitly outside the claimed secrecy boundary. An archive and its recovery material expose the included data to their holder even though the application requires fresh host/Owner proof to activate a restore; reenrollment does not revoke that offline possession.

## Findings summary

No confirmed or likely vulnerability in future console implementation is asserted. No material definition defect remains open. CVSS v3.1 is **not applicable** to the following documented trust boundaries and design observations; assigning an exploit score without an implemented vulnerable path would be misleading.

| ID | Classification | Evidence / existing disposition | Outcome |
| --- | --- | --- | --- |
| SEC-DEF-001 | Accepted trust limitation | D-012; AUTHZ-04, BASE-01, SEC-02; UX-V02 and UX-C10 | Destination-authoring administrators and approved downstreams must be trusted; write-only fields and response scanning are not universal non-exfiltration controls. Preserve the disclosure. |
| SEC-DEF-002 | Observation: operator boundary | D-001/D-005; AUDIT-03, OPS-05/06, BACKUP-02 | Host access can alter local evidence/state; local backup storage does not protect against host loss. Independent copies and host security remain documented operator responsibilities. |
| SEC-DEF-003 | Observation: intentional availability tradeoff | D-004; AUDIT-04, SECRES-04; UX-EX01 | Audit-storage failure stops sensitive work. Restricted diagnostic login is an explicit bounded exception and never an automatic write privilege. |
| SEC-DEF-004 | Observation: implementation validation remains | PRD acceptance table; coverage's 194 unverified backend/test cells; UX implementation status | Specification coverage is not runtime proof. Preserve the listed positive/negative tests through delivery and acceptance. |

SEC-DEF-001 is already settled product intent, not a new risk acceptance request. The other observations do not require an exception, source change, or reconciliation.

## Security review by domain

| Domain | Reviewed requirement and UX evidence | Assessment and implementation evidence to retain |
| --- | --- | --- |
| Bootstrap and identity | IDENT-01–06; SECRES-01–03; J-HOST-01/J-OWNER-ENROLL/J-OWNER-RECOVERY; UX-IN06/EX02 | No first-visitor claim, public self-registration, password-reset MFA removal, or session-only factor replacement. Verify expired/replayed/wrong-purpose proofs, concurrent consumption, recovery issuer revocation and non-enumerating failures. |
| MFA and browser sessions | IDENT-02/05/06; SEC-01; UX-IN03/06 and UX-A04 | TOTP is required and explicitly not phishing-resistant. Password-manager support and accessible setup do not weaken proof checks. Session theft/forgery and cross-site protection require implementation review of secure cookie/session handling, CSRF and output encoding; those mechanisms remain engineering choices under SEC-01. |
| Authorization | Four-role matrix; AUTHZ-01–03; STATE-01–03; UX-IA01/04 | Owner/Administrator do not implicitly execute. Auditor cannot execute or mutate; Member cannot enumerate global configuration/evidence. Test direct object/API requests, bulk/import/history paths and each role-matrix denial, not merely hidden controls. Concurrent last-Owner changes and late demotion must not bypass current checks. |
| Configuration and credential lifecycle | CONFIG-02–05; STATE-01–03; UX-IN01–04/EX03 | Draft/apply and immediate security actions are distinct. Apply rechecks actor, scope, base and dependencies; history cannot restore secrets, grants or disabled state. Test mixed Owner-only/Admin changes, stale initial grants, concurrent rotation/revoke and already-dispatched response protection. |
| Data protection and cryptography | SEC-01; SECRES-01; CONFIG-02; BACKUP-01–03 | Write-only credentials, encrypted sensitive storage and verifiers are required. Cryptographic algorithms, key wrapping and storage are implementation choices. Demonstrate that a clean host can decrypt all included dependencies using independently held recovery material, that missing/wrong material fails closed, and that exports never carry excluded factors or live authentication state. |
| Imports, archives and browser output | BASE-03; MIGRATE-01–03; BACKUP-03; AUDIT-03; PRD external-input acceptance | Unknown configuration fields fail explicitly; importing cannot read arbitrary host environment/files. Treat archive paths, links, labels, regex/catalog content, YAML and error strings as hostile input. Positive/negative bounded-input tests must cover malformed input, unsafe archive entries, resource exhaustion and safe rendered/logged output. No plugin execution or host file browser is implied. |
| Outbound calls and preview | BASE-01; POLICY-01–04; SEC-02; UX-IN04 | Preserve private destinations without conflating them with OAuth metadata fetch policy. Preview cannot substitute or issue HTTP. Source sampling shows access/destination/policy before substitution in `src/gateway.ts:69`; new mutable admission must retain current authority at dispatch. Verify real self-signed TLS behavior, canonical path consistency and denied-call no-I/O evidence. |
| MCP identity and client continuity | MCP-01–04; SECRES-01; UX-IA04/EX05 | Built-in grants require enrolled users; external/legacy modes provide no console access. Explicit issuer/subject registration avoids email-only linking. Preserve PKCE, scopes, refresh replay defense, validated metadata fetching and subject/service-bound references. Real ChatGPT and Codex grant/revoke/restart/reconnect checks remain required. |
| Audit and outage | AUDIT-01–04; SECRES-04; STATE-02/06; UX-EX01 | Every sensitive entry and scheduled job shares durable admission. Existing `AuditSink.record` can return after degradation; it must not be treated as the future admission guarantee. Verify start durability before dispatch, uncertain completion, outage restart and fresh authentication after restricted diagnosis. No fabricated completion or automatic retry of remote side effects. |
| Backup/restore | BACKUP-01–06; STATE-04–06; J-OWNER-RESTORE/J-HOST-RESTORE/J-OWNER-RESUME; UX-IN07/EX04 | Authority and data integrity precede replacement. Local installation rollback is temporary/non-downloadable and separate from export backups that omit MFA. Crash tests must reach one coherent state, preserve audit tail, reject all old access after success, and keep services/users restricted until explicit review. No resume-everything convenience bypass. |
| Limits, deployment and operational evidence | OPS-01–06; IDENT-04; UX-IA03/IN05 | One active instance, bounded public health, explicitly trusted proxies and finite inputs fit the accepted scale. SMTP failure neither activates accounts nor stops otherwise permitted operation. Capacity and storage failure cannot silently shorten retention or evict active state. Patching, off-host copies and restore drills remain operator duties. |

These verification details instantiate existing requirements; they are not additional features or a new compliance checklist. No database, cryptographic library, frontend framework, API path or deployment provider is prescribed by this review.

## Attack-chain review

- **Stolen old reference → revoked account → queued downstream call:** AUTHZ-02/STATE-02 require current admission checks immediately before substitution/dispatch. A successful earlier check or retained opaque handle cannot retain authority. Already-dispatched work may complete under its original protection context; the product does not promise remote rollback.
- **Historic draft/archive → removed grant or old MFA → recovered privilege:** STATE-03 excludes live access/secret values from history. BACKUP-05/SECRES-02 invalidate old authentication and require fresh bounded enrollment plus independent service/user review. Installation failure rollback is a different transition from successful restore.
- **Poisoned recovery link origin → proof theft → account takeover:** SECRES-01 fixes trusted origin, bounds proof purpose and lifetime, prevents GET consumption and suppresses referrer/cache/telemetry leakage. Password reset alone cannot remove MFA. Application and proxy behavior both need implementation evidence.
- **Audit failure → recovery/export bypass → unrecorded sensitive work:** SECRES-04 explicitly blocks sensitive recovery/export/backup/token operations and allows only constrained diagnostic access with reliable verification. Host repair precedes durable recovery and normal reauthentication.
- **Destination-authoring administrator → credential-bearing endpoint → transformed response:** This is the already accepted SEC-DEF-001 trust limitation. Assignment/RBAC still constrain ordinary members, but response scanning cannot make a malicious trusted destination safe.

No additional exploitable chain is established by the definition evidence. Non-destructive local tests using synthetic credentials are appropriate for later implementation verification; no exploit PoC was warranted in this stage.

## Positive observations and scope discipline

The four fixed roles are comprehensible and current permission checks are explicit at both management and execution boundaries. Secret migration does not grant web access to arbitrary host files. Clean-host restoration has an independent authority path without requiring unavailable old MFA. Backup contents and installation rollback are distinguished correctly. Audit outage behavior names its availability cost and diagnostic exception. The approved UX exposes consequences and avoids false success or rollback claims.

No new SSO, SCIM, custom roles, external vault, hosted control plane, approval chain or remote backup integration is needed to resolve this review. Stronger factors and independent infrastructure controls may exist outside this release but are not prerequisites invented here.

## Research and limitations

Consulted 2026-10-10: OWASP recommends reauthentication for sensitive operations and bounded authentication controls; this supports the existing recent-authentication and session requirements. [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

Factor recovery must preserve authentication assurance; OTP-based MFA has phishing limitations. These considerations are already reflected in the PRD's recovery gates and explicit TOTP boundary. [OWASP Multifactor Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)

Secret exclusion, sanitization and testing logging failures support the required audit verification. The specific fail-closed policy and diagnostic exception are this product's accepted choices, not a claim that OWASP mandates the exact availability tradeoff. [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

Runtime browser security, cryptographic implementation, crash consistency, dependency freshness, actual reverse-proxy logging, host controls and real-client interoperability remain unverified until implementation. The precise source revisions in the adapter delimit this pass; a material change to authorization, recovery, secret exposure, destination trust, audit admission or restore semantics requires affected-boundary revalidation.
