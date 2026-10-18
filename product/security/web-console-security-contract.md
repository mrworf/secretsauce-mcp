# Web console security resolution contract

**Status:** Bounded delegated specification, ready for PRD-owner adoption; not a full security review or implementation assessment.
**Resolution:** RES-PRD-SEC-01. **Source findings:** F-PRD-001, F-PRD-002, F-PRD-003; shared boundary with F-PRD-004.
**Baseline:** `docs/web-console-prd.md`, SHA-256 `86d7ffa3c05907d559b942373b9d6828a3c07ee4d0833f9a7ada1fada7441e27`, at repository commit `9c4fcb28144efa0f39de91ff20660fbae4cd8de1`.
**Decisions preserved:** D-001 through D-012, particularly fail-closed sensitive operations (D-004), optional manual recovery delivery (D-006), fresh MFA after restore (D-007), and preserved gateway behavior (D-009).

These requirements derive security mechanics from settled intent. They add no SaaS control plane, SSO, approval chain, or remote backup service. The PRD remains the product authority; its owner incorporates the clarifications below. No CVSS score applies to future requirements without implemented vulnerability evidence.

## SECRES-01 — Secret exposure and narrow capability links

Passwords, managed credentials, MFA seeds, recovery codes, backup recovery material, browser session identifiers, and reusable access/refresh tokens must not appear in management URLs, analytics, browser persistent application storage, or logs. Stored business credentials remain write-only. Initial MFA enrollment may display its fresh seed/QR code only inside the authorized, non-cacheable enrollment step; the `otpauth` provisioning value is not a navigable management URL and must not reach telemetry or external resources.

Invitation and account-recovery URLs are an explicit exception for a purpose-bound, unpredictable, single-use proof. They cannot contain a password, MFA seed, business credential, or reusable login token. Invitation validity remains 72 hours; recovery validity remains 30 minutes. Proofs have at least 128 bits of cryptographic randomness, are stored only as non-reversible verifiers, and are bound to an instance security generation, a target identity or pending invitation, and exactly one operation. Reissue revokes the old proof; disabling the target, cancelling the operation, or restoring the instance invalidates outstanding proofs. Concurrent attempts cannot consume a proof twice.

Link origin comes from the configured trusted console origin, not an arbitrary request header. Delivery pages use HTTPS, suppress referrers and caching, contain no third-party content or analytics, and remove proof values from the address bar/history as soon as captured. They exchange proof only with the same origin, never put it in browser persistent storage, and never echo it in errors. Application and documented reverse-proxy logging must suppress the proof-bearing URL component; implementations may use a fragment-to-POST exchange to keep it out of HTTP request URLs. Opening a link or an email scanner's GET must not itself change credentials, activate a user, or consume the final proof; completion requires deliberate submission in the bound flow.

An invitation permits only enrollment into its predetermined identity/role; a password-reset proof permits only password replacement and cannot remove MFA. MFA recovery permits only fresh factor enrollment after the recovery checks in SECRES-03. No capability link directly grants ordinary management or MCP access.

Preserve the existing MCP OAuth authorization-code redirects. Authorization codes remain single-use, short-lived, client/redirect-bound and PKCE-protected; their URL presence is a protocol exception, not permission to put bearer/refresh tokens in URLs. Preserve downstream query credential substitution when the existing service contract permits it, after all authentication, access, destination, canonical-path policy and placement checks. Such substituted URLs exist only in the outbound request path: never display or log them in console diagnostics, previews, audit, or exports. The downstream server is an explicitly trusted destination and may observe its own request; response scanning is still best-effort.

## SECRES-02 — Bootstrap and restore authority

Bootstrap proof is a host-administrator-controlled one-time capability, unavailable through unauthenticated web discovery and never emitted to general application/container logs. Expose it through a deliberate host-local protected setup action. It is bound to the uninitialized instance, expires after 30 minutes, has at least 128 random bits, and is invalidated by use, replacement or completion of setup. A host administrator may issue another proof if it expires. Failed attempts are bounded. Possession permits only initial setup or the explicitly selected recovery operation; MFA/password enrollment and durable recording must complete before normal access.

| Context | Required authority and resulting scope |
| --- | --- |
| New instance | Host bootstrap proof creates the first Owner; fresh password and confirmed TOTP establish normal identity only after setup succeeds. |
| Clean replacement host | A newly issued host-local restore proof plus valid archive recovery material authorize preview/restore and nominate one Owner identity from the verified archive for recovery. Neither the archive alone nor an old password proves recovery authority. |
| Functioning instance | A current Owner reenters password and TOTP within five minutes, supplies archive recovery material, reviews the archive and nominates the recovery Owner. The authorization binds to this archive and operation and creates only a single-use recovery continuation. |
| Lost continuation or all Owners locked out | Host-local recovery explicitly authorizes one selected Owner identity for reenrollment. This is an operator break-glass action, recorded as such, never a public password-only fallback. |

The recovery continuation survives only the selected restore operation and allows only status and enrollment of the nominated Owner. It is not an old browser session and never grants MCP or general management access. It expires 30 minutes after the restore reaches the enrollment step; expiry or interruption leaves the instance in recovery mode, with host-local recovery available. A replacement continuation invalidates the previous one. It is excluded from backups and cannot be reused against another restore or instance.

The nominated identity must be an Owner in the verified archive; the initiating Owner need not exist in that historical archive. The review names both identities, and audit attribution records the actual initiator/operator separately from the recovered account. Recovery explicitly resets the nominated Owner's password and enrolls fresh TOTP and recovery codes; it never restores a factor from pre-restore application state. An archive without a recoverable Owner is invalid and cannot replace a functioning instance.

No existing session, grant, pending proof, recovery code, or bearer credential survives successful restoration. Restored users remain pending recovery; the nominated Owner is protected from removal while enrollment is incomplete. Fresh Owner MFA and durable audit recording unlock management review only. Each other user needs explicit Owner review plus a fresh, purpose-bound enrollment authorization before activation; services and external/legacy MCP access stay disabled until separately reviewed and reenabled. Merely logging in with a restored password must never allow factor self-enrollment.

## SECRES-03 — Account recovery verification

Normal password reset uses a purpose-bound proof delivered to the previously established contact channel; requests give non-enumerating responses and are rate-limited. Without SMTP, an authorized reset initiator under SECRES-05 issues a one-time recovery link only after authenticating recently and verifying the person through an existing trusted channel. Initiators confirm that verification and its channel category; no identity documents or secret conversation content are stored. No security questions or public email-change route are introduced.

Replacing MFA requires password plus a valid current TOTP, password plus one unused recovery code, or an explicitly authorized assisted MFA reset under SECRES-05 after the same identity verification. Assisted MFA reset revokes all target sessions/grants at authorization time and leaves the account restricted until fresh enrollment; current issuer authority is rechecked before activation. Password-only reset follows the distinct issuance/completion boundary in SECRES-05. A session alone cannot authorize factor replacement. Send a security notice through the established channel when available; failed email does not silently undo recovery or become authentication proof.

All enrollment/recovery proofs have bounded attempts, rate limits per target/operation and source, and global capacity limits. Small TOTP codes require per-account throttling and replay prevention, including concurrent submissions. Reaching a limit rejects further attempts for a bounded interval without deleting the account or permanently preventing host recovery. Challenges expire; only successful proof consumption authorizes the bound transition, and state must commit before reporting success. Failed or abandoned enrollment does not grant access. During a durable-audit outage, recovery issuance, proof consumption that changes identity, factor replacement, and account activation are blocked under SECRES-04.

## SECRES-04 — Audit outage and repair boundary

Fail-closed admission applies to every ordinary sensitive operation: drafts and apply, policy/service/access/identity changes (including revocation of other sessions), credential creation or rotation, invitation/recovery issuance or completion, OAuth grants/token issuance/refresh, gateway reference issuance, downstream requests, evidence export, backup creation/download and restore. This includes scheduled work. There is no role-based audit bypass and no web control to turn mandatory audit off.

Existing authenticated users may retain role-scoped read-only configuration, existing activity and non-secret diagnostics. Password plus existing TOTP may establish a restricted read-only diagnostic session if identity verification, throttling and TOTP replay state remain reliable. If those safety mechanisms are unavailable, new login fails closed; host diagnostics remain available. Such a session cannot silently gain write authority after repair: require fresh normal authentication. Public health shows only the bounded healthy/degraded state. Local logout may clear the current browser session, and automatic expiry remains effective; neither is an unaudited privilege grant.

The read-only login exception is explicit: its security events are attempted best-effort, with bounded sanitized buffering if available, without claiming durability. On repair, record the known outage interval, available buffered evidence, and any unknown/lost evidence; never synthesize successful event history. Ordinary failed requests must not generate unbounded retry or log queues. Read-only audit viewing is allowed; bulk evidence export waits for its required durable event.

Repair means host-administrator repair of storage availability, mount/permissions, capacity or process health. It does not mean a web filesystem browser, arbitrary-path write, unaudited retention deletion, privileged settings change, password/MFA bypass or application restore. If account recovery is needed during an outage, repair storage first. A host administrator's ability to alter files is an external trust boundary; the product must not misrepresent it as tamper-proof.

Before resuming sensitive admission, successfully test durable audit append and commit the outage/recovery record. An already-dispatched request may finish; if its result cannot be recorded, retain its durable start as an uncertain outcome. Do not automatically retry it or claim its external effect was rolled back. Persisted start records without completion remain investigable after a crash. All admission paths and restart paths enforce the same gate.

## Acceptance contract

| ID | Positive case | Negative and failure cases |
| --- | --- | --- |
| SECRES-T01 | Invitation and reset link complete the bound workflow over HTTPS without secrets in logs/history/telemetry. | Reject expired, cancelled, replayed, cross-identity, wrong-purpose and wrong-instance proofs; parallel completion succeeds once; link preview performs no mutation; untrusted Host cannot change delivery origin. |
| SECRES-T02 | Authorized initial enrollment displays fresh QR once; configured query substitution and OAuth code redirect retain their contracts. | Stored seed/business credential is never redisplayed; preview/audit/export never shows substituted URL; reusable OAuth token URL placement rejected. |
| SECRES-T03 | Host bootstrap initializes one Owner; clean-host restore works using proof and archive recovery material despite absent MFA/session state. | Reject web-only claiming, proof without archive key, archive/key without host proof, expired proof and archive without Owner; prove no old session/MFA/recovery code works. |
| SECRES-T04 | Recently authenticated Owner restores an archive even when their present identity is absent from it; nominated archived Owner reenrolls. | Wrong archive/identity cannot redeem continuation; continuation cannot call normal management/MCP; expiry/restart interruption stays recoverable but closed; no post-restore password-only enrollment. |
| SECRES-T05 | Existing-factor, recovery-code and verified Owner-assisted recovery complete and produce fresh MFA. | Reset link alone cannot remove MFA; code replay and concurrent code use rejected; disabled/revoked issuer cannot complete pending escalation; throttle abuse without eliminating host recovery. |
| SECRES-T06 | Audit outage preserves authenticated read-only diagnosis and host repair; fresh authentication resumes normal access after durable recovery event. | Every sensitive route and scheduled job rejects before mutation/downstream I/O; no backup/export/recovery exception; unsafe login state rejects; logout still works; restricted session never automatically upgrades. |
| SECRES-T07 | Durable request start survives loss of completion recording and is shown as uncertain. | Disk full, permission loss, process interruption and audit append failure cannot produce silent success, auto-retry downstream work, or fabricate completion evidence. |

## Precise PRD clarifications for the owner

- **SEC-01:** Scope the URL prohibition to ordinary management secrets and reusable credentials. Explicitly recognize bounded enrollment/recovery links, required OAuth code redirects and preserved downstream query substitution under SECRES-01; retain the logging/analytics/persistent-storage prohibition and write-only managed credentials.
- **IDENT-01/03/05/06:** Adopt purpose/identity/instance-bound proofs, protected host issuance, non-consuming link preview, recent-authenticated and verified Owner recovery, and the restricted enrollment state. No ordinary account access precedes required MFA.
- **BACKUP-03/05 and AUTHZ-03:** Define clean-host host-proof plus archive-material authority and in-place recent Owner authority; nominate an archived Owner, distinguish the actual initiator in evidence, require fresh password/MFA and keep other access disabled until explicit review. Recovery Owner designation satisfies continuity while all ordinary users remain inactive.
- **AUDIT-01/04:** Name restricted read-only authentication as the explicit best-effort audit exception, separate host storage repair from application mutation, and require durable outage/recovery evidence before normal work. Block all sensitive paths, including backups, exports, token issuance and account recovery.
- **SEC-03/CONFIG-03:** Immediate security actions bypass draft/apply delay, not authorization or mandatory-audit admission. The architecture state contract owns the complete transaction distinction.

No remaining product choice or incompatible authority was found within this delegated scope. These changes clarify the accepted requirements rather than changing the selected safety posture.

## Evidence and limitations

- [PRD](../../docs/web-console-prd.md): IDENT-01/03/05/06, SEC-01, AUDIT-01/04 and BACKUP-01/03/05 supply the governing intent. [Configuration reference](../../docs/config-reference.md) documents flexible query substitution; SHA-256 `8fc78c4876cd61d1cfa0315cf53e6a46c98432f8e7bd2b30d2565f5024bb9850`.
- [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), checked 2026-10-09: supports purpose-bound single-use random proofs, limited sessions, fixed trusted origins and referrer controls. [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) supports treating factor recovery as a separate high-risk authentication operation.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), checked 2026-10-09: supports secret exclusion, testing logging failures and explicit handling of unavailable logging. The fail-closed product policy and restricted diagnosis exception here derive from D-004, not a claim that OWASP mandates this exact product behavior.
- Exact proof entropy, 30-minute operator proof/continuation expiry and the recovery nomination semantics are delegated security choices, not quotations or assertions of regulatory mandates. Storage, atomicity and invalidation mechanisms belong to Architecture; UI interaction belongs to Product UX. This document does not validate implementation, host operations, compliance, or the later full security stage.


## SECRES-05 — Separate administrative password and Authenticator resets

**Resolution:** REC-DEC-001; confirmed directives PO-FB-002 and PO-FB-004; source findings REC-001 and REC-002. This amendment supersedes Owner-only assisted-reset wording in SECRES-03 and its older adoption summary. It does not expand invitation, role/contact change, disable/reactivation, restore review, SMTP configuration, or general session/grant administration beyond their existing Owner-only authority. Administrators receive only the minimum non-secret user list/detail needed to select an eligible reset target and see reset status.

### Initiator and target boundary

| Initiator | Permitted other-user targets for either reset | Excluded targets |
| --- | --- | --- |
| Owner | Owner, Administrator, Auditor, Member | Self through the assisted route; disabled, deleted, unaccepted invitations, restored users pending Owner review, external/legacy MCP-only identities |
| Administrator | Administrator, Auditor, Member | Every Owner; self through the assisted route; the same excluded lifecycle/identity categories |
| Auditor or Member | None | All assisted-reset targets |

Self-service password/factor changes keep their existing verification rules. An otherwise eligible user already restricted by an assisted MFA reset may receive a replacement MFA-reset proof; this is continuation of that reset, never reactivation of an Owner-disabled or unreviewed restored user. Password reset requires an enrolled factor and cannot activate a pending account.

Both assisted actions require the initiator's current active, enrolled identity, password and TOTP reauthentication within five minutes, confirmation of independent verification of the person through a previously established trusted channel, an explicit confirmation naming the target and operation, and durable audit admission. Record only the verification channel category, never documents or conversation contents. Deliver to the established contact through configured SMTP or show the one-time link for manual trusted-channel delivery; neither role may select a replacement contact through this action. The initiator never chooses or sees the target's new password or MFA secret.

An assisted MFA reset must leave at least one other active, enrolled Owner able to administer the instance. Recheck this invariant atomically with the restriction, including concurrent Owner resets or role changes. Do not count invited, recovering, disabled, or diagnostic-only users as continuity. Reject a final eligible Owner MFA reset with the existing host-local recovery route; no new approval chain or automatic Owner promotion is added. Password-only completion preserves enrolled MFA and does not remove Owner eligibility.

### Distinct transitions

**Password:** Issuance creates only a 30-minute password-reset proof and does not change the password, MFA, recovery codes, enrollment, or existing sessions. Deliberate completion requires the bound proof plus the target's current enrolled TOTP or one unused recovery code, and a new password meeting ordinary password policy. Atomically replace the password verifier, consume the proof and any used recovery code, advance target authorization generation, and revoke all target sessions, MCP grants and subject-bound references. Do not change the existing TOTP seed or other recovery codes, auto-login, or bypass subsequent ordinary password/MFA login. Public reset initiation remains non-enumerating and cannot be used to lock out an account.

**Authenticator MFA:** On confirmed issuance, atomically invalidate the old TOTP seed and recovery codes, revoke sessions/MCP grants/subject-bound references, advance target authorization generation and mark the target restricted with `enrolled: false`. Issue a 30-minute MFA-reset proof bound to that resulting generation. This proof permits only generation and confirmation of a fresh TOTP factor and fresh recovery codes, not password replacement or ordinary console/MCP access. The initiator's independent identity verification authorizes this recovery ceremony; the target need not supply the lost factor or forgotten password. Completion commits the new confirmed factor/codes, consumes the proof, advances target generation again, and returns the otherwise eligible account to enrolled state. The password is unchanged; normal login is required.

If both password and MFA are lost, complete assisted MFA recovery first and then issue a fresh password-reset proof. Never combine the two operations in one proof, silently upgrade a password link into factor recovery, or reuse a proof bound to a prior generation. Expiry, cancellation, SMTP failure or abandonment after MFA restriction leaves the target restricted; authorized reissue or existing host recovery can resume it. None restores old factors, grants or references. Notices use the previously established contact when available; delivery failure is visible to authorized administration but cannot roll back a committed security transition.

### Proof, issuer, revocation and evidence invariants

Use SECRES-01's verifier-only, unpredictable, single-use, purpose/target/instance-bound proof and safe fragment capture on initial load and `hashchange`. Additionally bind each assisted proof to issuer identity and authorization generation, target authorization generation and exactly one reset operation. Recheck live issuer enrollment, role/target permission, issuer generation, target lifecycle/generation, instance generation and audit readiness at issuance, sensitive proof processing and final commit. The target's role becoming Owner invalidates an Administrator-issued proof. Issuer disablement, demotion, recovery, revocation or generation change prevents completion; an expired browser session alone does not invalidate independently bound issuer authority. No issuer session needs to remain open while the target recovers. Reissue revokes the previous proof; target mutation never silently rebases outstanding proofs. Completion concurrency succeeds once.

All revocations are immediate security actions under STATE-01/02/03 and are excluded from reusable draft/history authority. Persist security generation and revocation intent with the identity transition; fence old JWTs, refresh grants, pending admissions and response completions. Uncertain completion never restores live references or produces an unaudited success. Retry/reissue must consult durable outcome and current state; no duplicate proof consumption or automatic reversal. Already-dispatched external work can finish under admitted protections, without reviving access.

Audit issuance, denial, reissue/cancellation, restriction, completion and notification outcome using initiator and target identifiers, operation, non-secret generation/correlation identifiers, verification category and bounded result/reason. Do not log proof values, password/MFA material, cookies, authorization headers or message bodies. Rate-limit target/operation/source and global recovery capacity, including recovery-code and TOTP attempts. Audit outage blocks issuance and all security mutations; existing restricted diagnosis never becomes reset authority.

### Acceptance additions

| ID | Positive case | Negative/failure case |
| --- | --- | --- |
| SECRES-T08 | Owner resets another Owner; Administrator resets another Administrator, Auditor or Member through each separate flow. | Reject Administrator-to-Owner, self through assisted endpoint, Member/Auditor initiator, disabled/invited/unreviewed restored/external targets, arbitrary contact override, stale reauthentication and direct endpoint bypass. |
| SECRES-T09 | Password proof plus current TOTP or unused recovery code changes only password and revokes prior access. | Link alone cannot replace password or MFA; invalid/replayed factor/code fails; old password fails after completion; issuance alone does not lock target out; no automatic login. |
| SECRES-T10 | MFA issuance immediately restricts access; bound proof enrolls fresh factor/codes while preserving password; both-lost sequence succeeds. | Old factor/codes, old JWT/refresh grants/references, password-only enrollment, cross-purpose proof, expired/cancelled flow, and final-Owner reset fail; concurrent Owner restrictions cannot remove continuity. |
| SECRES-T11 | Eligible issuer's proof works after their browser session naturally expires; current-state reissue resumes a restricted target. | Issuer revocation/demotion/generation change, target promotion or generation change, restore, wrong target, concurrent replay, audit failure and uncertain persistence cannot activate account or revive authority. |

### Precise PRD adoption text for REC-DEC-001

- **Role matrix / IDENT-05:** Split user invitation, disable/reactivation, role/contact changes and restore review (Owner only) from password-reset and Authenticator-reset initiation (Owner and Administrator with SECRES-05's target matrix). Provide only the target visibility needed for the latter to Administrators.
- **IDENT-04/05:** Authorized reset initiators may deliver their permitted one-time reset links through SMTP or a verified existing channel. SMTP configuration and invitations remain Owner-only. Require recent initiator password/TOTP and verified-person confirmation for assisted resets.
- **IDENT-05/06:** Define password-reset issuance as non-restricting, completion as proof plus preserved factor/recovery-code verification and password-only replacement with access revocation. Define MFA-reset issuance as immediate old-factor/code invalidation, access revocation and restricted enrollment; completion installs fresh factor/codes without changing password. Both-lost users complete MFA recovery before receiving a fresh password-reset link. Both flows require ordinary login afterward.
- **AUTHZ-02/03:** Enforce target hierarchy and current issuer/target authorization at commit, bind proofs to issuer and target generations, prevent concurrent removal of the last enrolled Owner through MFA restriction, and preserve host recovery. No configuration draft/history or incomplete/uncertain recovery may restore revoked authority.
- **AUDIT-01/04:** Record separate initiator/target/purpose/outcomes without secrets; block assisted issuance/completion during audit outage. Delivery failures are recorded and do not undo committed restriction or reset.

### Guidance and limitations for this amendment

OWASP recommends random single-use reset tokens, non-enumerating public requests, ordinary login after reset, session invalidation and separate MFA recovery controls. Its MFA guidance treats factor replacement as a high-risk operation and warns against trusting only an existing session. These sources support the safeguards, not the product-specific target hierarchy or exact transition choices: [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), verified 2026-10-11.

This bounded resolution supplies security semantics for PRD-owner adoption and reconciliation. It is not an implementation vulnerability assessment or a pass of the full security stage; no CVSS score or runtime-test claim applies.

## SECRES-06 — Account details and bounded Administrator management

**Resolution:** REC-DEC-004; confirmed PO-FB-025, with PO-FB-023/024/026/027. This amendment supersedes SECRES-05's restriction of Administrator visibility to reset selection and its prohibition of role/contact editing. SECRES-05's separate reset ceremonies and target matrix remain unchanged.

The existing account fields are email/contact, role and lifecycle status. Show immutable user ID, creation time and last successful browser login as information; do not invent editable profile fields, expose password/factor material or make recorded activity editable. Non-secret account visibility follows existing configuration visibility. Viewing a user does not grant permission to change that user.

| Operation | Owner | Administrator | Auditor / Member |
| --- | --- | --- | --- |
| Change another local user's email/contact | Yes, including another Owner | Other Administrator, Auditor or Member only | No |
| Change another local user's role | All fixed roles, subject to Owner continuity | Between Administrator, Auditor and Member; never grant Owner or target an Owner | No |
| Change own role through account administration | Existing Owner transfer/demotion only, with enrolled replacement and continuity | No | No |
| Change own email/contact through account administration | Yes, with the same sensitive-change checks | Yes, with the same sensitive-change checks | No new permission |
| Invite, disable/reactivate, delete, review restored users or administer another user's sessions/grants | Existing Owner authority | No expansion | No expansion |

Changes to contact or role require a currently active, enrolled authorized actor, password/TOTP reauthentication within five minutes, explicit confirmation naming the target and change, and durable audit admission. A contact change additionally requires the actor to confirm verification with the person through a previously established trusted channel. This is the same operator verification procedure used for assisted resets, not a new end-user verification workflow or approval chain; store the channel category only. Validate contact format and uniqueness using the existing account rules. Never accept a contact override within a reset operation.

Recheck actor, target, allowed resulting role and lifecycle at commit. Contact/role edits must not change active/enrolled state, password, MFA, immutable identity or restore-review eligibility. They may update a pending/disabled account's permitted fields, but cannot activate it or convert an old invitation/recovery proof into authority for the new contact/role. Explicit Owner invitation reissue or authorized recovery remains available where necessary. External/legacy MCP identities remain under their existing separate management contract.

Each successful role/contact change advances target authorization generation and immediately invalidates target sessions, MCP grants, subject-bound references and outstanding target proofs; issuer-bound proofs also cease to work when the changed user was their issuer. Changes take effect immediately, outside configuration drafts/history. Contact change preserves password and MFA; it does not enroll the account. For a self-contact change, explain that the current session ends and require ordinary login with the new contact. Recheck Owner continuity atomically, including concurrent role changes, disables and MFA resets. Never demote/remove/restrict the final active enrolled Owner or an incompletely enrolled nominated recovery Owner.

Audit actor, target, changed field names, non-secret role transition, generation/correlation and bounded outcome; do not add contact values or credentials to ordinary logs. Where SMTP is available, notify the old and new contact of a committed contact change without including a recovery capability. Notification failure does not undo the committed transition or grant access, and is visible as a separate delivery outcome. Existing durable revocation-intent and uncertainty safeguards apply across restart; a stale form cannot overwrite a newer target revision or revive authority.

### Acceptance additions

| ID | Positive case | Negative/failure case |
| --- | --- | --- |
| SECRES-T12 | Administrator edits another non-Owner contact and changes Member/Auditor/Administrator roles; Owner edits another Owner under continuity. | Reject Administrator-to-Owner edits, promotion to Owner, self-role edit, Member/Auditor writes, hidden-field lifecycle changes, direct request bypass, stale target revision and stale/revoked actor. |
| SECRES-T13 | Verified contact edit preserves password/MFA, changes login contact, invalidates old authority and reports notice outcome; self-edit ends current session. | Reject duplicate/invalid contact, missing recent authentication/verification, old proofs and old grants; no silent activation, enrollment or invitation rebind; audit or uncertain write failure never claims success or revives authority. |
| SECRES-T14 | Creation and last-login metadata are read-only within existing role visibility. | No secret-bearing account projection, forged metadata write, counting partial/MCP/recovery login as full browser login, or last-Owner removal through concurrent changes. |

### Precise PRD adoption text for REC-DEC-004

- **Role matrix / IDENT-05:** Separate role/contact editing under SECRES-06 from Owner-only invitations, lifecycle and restored-user review. Replace Administrator reset-only visibility and no-contact-change statements with the bounded account-detail authority above; preserve SECRES-05 reset target rules.
- **AUTHZ-02/03 / IDENT-06:** Apply immediate generation-bound revocation and stale-write protection to contact/role edits, require recent authentication, and preserve Owner continuity and lifecycle state. Existing other-user session administration remains Owner-only.
- **IDENT-04/05 / UX:** Explain account email/contact editing, verified-channel operator confirmation, old/new-contact notices, read-only creation/last-login metadata and current-role controls without inventing profile fields. No confirmation email approval dependency is added.

## SECRES-07 — Explicit unencrypted SMTP option

**Resolution:** Security portion of REC-DEC-005; confirmed PO-FB-031 and PO-FB-034. Align with Architecture's SMTP transport amendment. This is a supported, explicit Owner choice; it does not weaken browser HTTPS, at-rest encryption, audit, proof lifetime or reset verification.

Offer exactly the existing **TLS (encrypted)** mode and **None (unencrypted)**. Retain TLS as the default for new configuration and older records without a mode. TLS validates the server certificate and identity under the existing transport contract. A TLS failure never retries as unencrypted. A port change, absent field, server advertisement, import or restore cannot silently select None. Reject unknown explicit modes. STARTTLS is not required for this change. As STATE-08 specifies, restoring a recorded None setting preserves its proposal, but requires current Owner review and acknowledgment before unencrypted dispatch; an archived acknowledgment is not fresh authority.

An Owner may deliberately configure None, including on a relay requiring SMTP authentication. No additional host allowlist, SaaS approval process or ban on credentials makes the supported option unusable. Keep a plain-language inline warning: the connection to the mail server is unencrypted, so messages, invitation/reset links and any SMTP login credentials can be read or altered on that network. Recommend TLS or a trusted protected connection; do not describe an IP address or local network alone as proof of confidentiality.

Enabling None, switching to None, or changing the server/authentication destination while None remains selected requires the current Owner's recent password/TOTP authentication and explicit risk acknowledgement in the normal confirmation/review. Bind acknowledgment to the selected endpoint, mode and applicable credential/configuration version; stale confirmation cannot authorize changed settings. Existing operation-specific confirmation remains sufficient—no extra multi-step wizard. A test using None must visibly state the mode and require equivalent acknowledgment before sending; testing never bypasses normal authorization, audit or transport selection. Already-acknowledged unchanged settings need no repeat warning dialog on every email.

Mode and non-secret connection settings are prefilled from current authorized state. Saved passwords remain encrypted and write-only: show only whether a password is configured, retain it on unchanged submission, require deliberate replacement, and retain existing explicit deletion rules. Choosing None never deletes a password or silently switches authentication off. Audit mode changes, the acknowledgment and test/delivery outcome without passwords, proof-bearing links, message bodies or protocol credentials; classify expected connection/authentication errors without echoing server data containing secrets. Existing bounded delivery and current-revision admission remain mandatory.

This intentionally accepts loss of confidentiality/integrity on the SMTP hop when the Owner selects None. It is not a claim of secure email transport or regulatory compliance. The user has expressly authorized support for this mode; no further product decision is needed to implement the bounded exception.

### Acceptance additions

| ID | Positive case | Negative/failure case |
| --- | --- | --- |
| SECRES-T15 | Owner explicitly selects and acknowledges None; plaintext SMTP works with and without configured authentication; TLS remains default and works with valid certificate. | TLS failure never falls back; omitted legacy mode remains TLS; reject unauthorized/stale/unacknowledged insecure changes and certificate identity failure in TLS mode. |
| SECRES-T16 | Current non-secret fields prefill; blank unchanged password retains encrypted value; independent replacement/deletion remains explicit. | No saved password in GET/UI/log/audit/export, no mode-driven credential deletion or auth disabling, no test bypass, no raw SMTP body/proof leakage in failures. |

### Precise PRD adoption text for REC-DEC-005

- **IDENT-04 / SEC-01 / acceptance:** Add explicit TLS default and None transport choice, Owner recent-authenticated acknowledgment and no fallback. Support optional SMTP authentication under either selected mode with honest risk wording. Preserve encrypted storage, write-only credentials, disable-versus-delete semantics and mandatory audit.
- **CONFIG-03 / UX:** Persist selected transport through normal settings lifecycle; populate non-secret current values and retain unchanged password without redisplay. Align test messages with selected mode and current authorization.

### Evidence and review limits for SECRES-06/07

[OWASP Authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#changing-a-users-registered-email-address) treats contact changes as security-sensitive, recommends MFA verification and notice to the existing contact. The operator-assisted route here derives from this product's established trusted-channel reset procedure and optional SMTP; it is not a claim that OWASP mandates this exact administrative workflow. [RFC 8314](https://www.rfc-editor.org/rfc/rfc8314.html) recommends encrypted mail submission and prefers implicit TLS; None is an explicit product exception, not the recommended default. Sources checked 2026-10-12.

This is bounded definition resolution, not a runtime security assessment. No implemented vulnerability or CVSS claim is made. SEC-DEF-001's accepted best-effort response-scanning limitation and all existing reset/proof/audit controls remain intact.


## SECRES-08 — Referenced service credential clearing

**Resolution:** Security portion of REC-DEC-008; confirmed PO-FB-060/065/066/067. This independently derives security constraints for STATE-09. Referenced service credential Delete **clears its value and retains its key**, with that outcome explained before confirmation. Unreferenced keys may be deleted. This requirement is settled. It does not alter SMTP credential deletion, role authority, service lifecycle, or restore approval.

### Authority, dependencies and confirmation

Apply the existing Owner/Administrator service-credential permission and sensitive-operation checks to every Set, Replace, Clear and key Delete, including direct API calls. Recheck current enrolled actor authority at mutation; UI visibility is not authorization. Bind the confirmation to the current service, exact key incarnation/value generation and durable dependency revision. A changed target, replacement, restored state or dependency set requires fresh confirmation; do not switch a confirmed Clear into key Delete or vice versa. Preserve exact identifiers with own-property-safe lookup. Cancel performs no write.

Count applied and saved proposed dependencies, including Disabled/Archived configurations. A saved proposal that removes a placement cannot erase the current applied reference; a proposal-only placement also retains its key. Browser-only unsaved edits do not reserve keys and must be validated on save/review. History and archives are not current references. Clearly state whether clearing affects current execution or only a pending configuration. Do not change service access assignments, activate a draft or remove authentication to make missing credentials appear usable.

### Revocation and late work

A retained key with no value is a missing dependency, never an empty credential or an implicit no-auth mode. Clear removes current stored value copies, including persisted normalized runtime projections, and invalidates affected credential/reference authority and reviews. An applied configuration requiring the key cannot issue new usable references, substitute credentials or dispatch downstream requests until a deliberate Set supplies the value and all other current eligibility checks pass. A draft-only missing dependency prevents its activation without interrupting unrelated valid applied execution. Set cannot revive old references, enable Disabled/Archived services, bypass restored-service review or apply unrelated edits.

Recheck generation, availability, authorization, destinations and policy after waits and immediately before substitution/dispatch. Clear and admission must have a defined ordering; queued requests cannot use a previously captured value after revocation. Already-dispatched work cannot be undone and may complete with its admitted value and immutable response-protection context. Retain protection of that old value for the bounded lifetime of such work; do not discard its scanner context merely because the current value was cleared. Late completions cannot mint usable revoked references, restore values or report an undispatched request as completed. Preserve live broker/scanner/limiter instances and existing best-effort response-scanning limits. This is application-level removal of current values, not guaranteed forensic erasure of memory or media.

### Audit, durability and recovery

Require durable secret-free audit admission before mutation. Record actor, target, operation, relevant non-secret version/generation and attributable outcome; never record a secret, hash/fingerprint of the value, substituted header/URL, raw downstream body or credential-bearing error. A start without conclusive completion remains uncertain, not successful. Audit-admission failure leaves the value unchanged. After admission, persistence uncertainty fences affected execution and references until durable state is reconciled. Restart must process durable revocation/clear evidence before sensitive admission so an older readable snapshot cannot silently reopen use. Replay binds the original key incarnation/generation and cannot clear a later replacement. Preserve an explicitly rejected operation versus an uncertain operation; no automatic retry of remote effects.

Clear, missing-value state, generations and removal of normalized copies must form one coherent durable outcome. An unsupported older reader must fail closed instead of treating retained metadata as an available secret; upgrades preserve newer existing state formats. Draft discard, configuration history rollback, stale forms and pending review cannot resurrect cleared values. Backup validation must reject contradictory copies/generations rather than choose a convenient value.

Encrypted snapshots after a completed Clear preserve absence and contain no old value through another current projection. Older archives may contain prior values; do not promise retroactive erasure of existing backups. Only the existing explicit whole-instance restore may recover such archived data. All restored services remain Disabled pending review; missing values remain missing, and restored generations cannot authenticate old references or confirmations. Preserve existing bounded recovery and independent local audit ownership.

### Secret entry and change attribution

Set/Replace dialogs remain write-only. Opening or cancelling a dialog neither fetches a stored value nor mutates it. New input is sent only to the authorized mutation endpoint, excluded from persistent browser storage/URLs/telemetry and cleared from the temporary dialog after completion or cancellation. Validation errors do not echo submitted values. An unrelated wizard Continue does not submit or require a replacement secret.

Store the last **successful** Set/Replace/Clear actor's stable identity and server time with the mutation. Expose only authorized non-secret metadata, using safe escaped labels and existing identity visibility; avoid adding unrestricted contact disclosure. Preserve attribution after actor rename/removal through a stable former-account fallback. No-op clear, rejected or uncertain operation does not fabricate a successful last changer. An imported committed value may name its authenticated submitting actor; do not infer an actor for legacy values. Show Unknown when trustworthy attribution is absent instead of scanning historical audit or guessing from the viewer.

Restored actor metadata is historical, source-qualified attribution, not a new local mutation or proof of current authority. Do not rebind by email/name, credit the restoring Owner, or accept client-supplied actor/time as authoritative. Legacy archive attribution remains Unknown where absent. Preserve newer independent local audit outcomes and the distinct restore event.

### Acceptance additions

| ID | Positive case | Negative/failure case |
| --- | --- | --- |
| SECRES-T17 | Authorized referenced Delete clears only the value, retains exact key and explains current versus draft impact; unreferenced Delete removes key. | Reject unauthorized/direct-route mutation, stale actor/version/dependencies and wrong-key confirmation; no silent clear/delete switch, no-op attribution or mutation on cancel. |
| SECRES-T18 | Clear gates applied missing dependencies; deliberate Set restores only otherwise eligible current execution; pending draft remains separate. | Old references, queued work, stale reviews, draft discard and later callbacks cannot use or repopulate the cleared value; draft-only clear cannot disrupt unrelated current execution; late responses retain old-value protection without minting revoked references. |
| SECRES-T19 | Completed Clear survives restart; admitted uncertain mutations remain fenced until reconciled; later replacement survives old intent replay. | Inject failures before/after durable replacement and completion append; old snapshots/readers cannot reopen use; audit admission failure changes nothing; no uncertain success or stale normalized copy. |
| SECRES-T20 | Encrypted backup/restore preserves absence and historical actor attribution with disabled restored services; explicit older archive recovery remains available. | Reject mixed value/generation projections, old reference/confirmation reuse, attribution spoofing/remapping, leaked value/fingerprint and restore-driven automatic activation. |
| SECRES-T21 | Authorized detail shows last successful actor/time and Set/Replace dialog accepts a new write-only value. | No existing secret fetched or persisted in browser; cancel/no-op/failure does not change actor/time; removed/legacy actor handled honestly; unrelated wizard navigation does not submit secret input. |

### Cross-domain adoption

Adopt the clear-versus-delete distinction, current versus proposed dependency consequences, stale-confirmation rejection, missing-value execution state, immutable historical attribution and restore consistency into CONFIG-02/03, AUTHZ-02, AUDIT-01, BACKUP-01/05 and UX. Preserve existing SMTP deletion rules under SECRES-07; service clearing introduces no SMTP exception. No new user choice, role, approval chain, distributed vault or remote erasure promise is required.
