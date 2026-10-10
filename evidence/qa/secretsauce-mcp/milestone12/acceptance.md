# M12 acceptance evidence

Product: secretsauce-mcp. Scope: milestone 12 only. Implementation commits: slice 01 bb12810; slice 02 c30dc9e; slice 03 is the commit containing this evidence (resolve with git history; no self-referential SHA). M10/M11 provider behavior is preserved. No multi-user OAuth authentication activation, import, backup or restore is enabled here.

## Functional acceptance

| Criterion | Evidence |
| --- | --- |
| All four roles enroll and exercise permitted cells; forbidden direct management/MCP cells denied | console-people invitation test enrolls all four; console-people-http parameterized role matrix covers service list/detail, People, instance/SMTP reads, activity, invite/registry, role/disable/recovery/session+grant revoke/registry change, SMTP save/review/apply/test and service save/access; M11 console-services, console-service-runtime, console-services-http cover credential/lifecycle/access/config apply/Owner settings boundaries. Existing console-auth/http cover own password/session/factor restrictions. Administrator grants eligible local and external identities; Auditor execution denied, Member assigned reference issuance allowed/unassigned admission denied. Console cookie alone never authenticates MCP. Existing managed password-only OAuth remains blocked pending M14. Actual HTTPS browser enrolls all four and exercises role shell/account/activity. |
| Harmless invitation GET, one concurrent completion, invalid proofs denied, correct manual/SMTP state | console-people and console-people-http: unchanged preview GET, parallel completion succeeds once, wrong identity/purpose/instance generation, replay/expiry/reissue/revoke and lost material. Issuer authority is rechecked. console-notifications: actual local TLS SMTP with validated certificate, malicious reply and slow-drip deadline, sanitized failure, four-slot capacity and audit gate; disable/deletion and manual fallback. Browser manual issuance only shows proof once, immediately removes fragments on initial and same-document navigation; SMTP draft/apply/test failure never claims enrollment. |
| Self/Owner/host recovery; no password-only/stale issuer/outage bypass; prior sessions/grants invalid | console-recovery: positive current-TOTP and unused-code replacement, concurrent code consumption/replay denial, Owner channel verification and immediate restriction for both reset/factor, MFA-preserving password reset, self-assistance denial, stale issuer, malformed input/recent expiry/audit outage. console-people-http: current-session expiry during body wait; actual broker invalidation on committed password change with failed completion audit. Browser completes Owner-assisted and password-plus-code fresh MFA. host-recovery-report.json records protected interactive selection/issuance, noninteractive rejection, outage before mutation, repair, reissue and fresh Owner enrollment. |
| Enrolled replacement and last-Owner races; disable within one minute | console-people: pending replacement cannot activate; two independently authenticated Owners race to demote themselves and one enrolled Owner remains. Owner role and disable mutations revoke current target sessions/references. Browser measures keyboard disable including cancellation/focus return and recent password/TOTP confirmation in 246 ms (automation, not a human benchmark), below 60 seconds. |

## Required UX checks

| Check | Current rendered evidence |
| --- | --- |
| UX-C01 | Four role enrollment/account images, Owner People/Settings, Member assigned-service and own Activity observations in browser-report.json; Member global nav hidden and direct routes denied. |
| UX-C07 | disabled-account-320.png; cancellation returns focus, explicit immediate access/revocation and recent confirmation; domain/runtime tests prevent restored references. |
| UX-C08 | People explains second Owner; immediate action confirmation explains enrolled last-Owner protection; direct two-Owner race/pending-replacement negatives return safe reasons. M11 existing credential dependency evidence retained. |
| UX-C11 | owner-people.png, manual-issuance-320.png, owner-recovery-issuance-320.png, smtp-applied-320.png, smtp-failure-320.png; role and pending/recovery/delivery states distinct. |
| UX-C12 | Four fresh enrollment images mask seeds/codes/QR; browser keyboard completes password/fresh TOTP and Owner/code recovery; nonenumerating-reset-320.png/recovery-code-form-320.png; no stored factor redisplay. |
| UX-C15 | Nonenumerating reset and safe SMTP failure, explicit expired/reissue text, focusable alerts, operation-status reconciliation retained; negative HTTP/domain tests verify safe errors without proof/factor content. |
| UX-C20 | Every routine People/account/enrollment/recovery/settings/SMTP page checked at 320 CSS px with zero horizontal page overflow. |
| UX-C21 | All browser tasks use keyboard; labels, focusable errors/status, visible focus and Cancel dialog focus return checked; account/logout retained. |
| UX-C22 | Rendered Owner People, Member account and recovery-code views visually inspected: restrained branding, moderate-density cards, clear text status and concrete actions, consistent existing visual system. |
| UX-C25 | Browser disable 246 ms includes explicit confirmation and fresh proof; first-service and denial tasks remain M11/future activity acceptance providers. No safeguard bypass. |

## New external input coverage

| Input boundary | Positive and negative cases |
| --- | --- |
| Invite email/predetermined role/confirmation | All fixed roles complete; malformed email/unknown role/missing confirmation/duplicate email denied. |
| Invitation target/reissue/revoke | Current pending identity preserved; revoke/reissue invalidates proof; nonexistent/enrolled identity and unauthorized actors denied. |
| Link purpose/target/proof/password/code/saved | Fresh deliberate bound begin/complete; incorrect binding/generation, expiry/replay/concurrent consume, weak password, malformed/wrong code and missing saved confirmation denied. Stored seed/codes never redisplayed. |
| Role/active/target and revocation | Enrolled replacement/current Owner succeeds; missing recent proof, stale actor/session, last Owner, pending activation, malformed target/role/confirmation denied. Two sessions race safely. |
| External issuer/subject/label/active | Exact HTTPS issuer/subject registry and Admin assignment; duplicate pair, email-only linking, HTTP/userinfo/query/fragment, malformed subject/label denied. Disable rejects current admission and broker reference, reenable requires fresh reference; no auth mode or console access enabled. |
| Established-contact reset and bound password | Uniform known/unknown response including delayed delivery and injected first audit append failure; malformed contact/weak replacement, wrong-purpose/replayed link denied; retains MFA. Manual issuance requires verified recent Owner. |
| Owner assistance purpose/channel/verification | Existing trusted channel category with action-bound recent proof; unverified/unsupported channel/self assistance/stale issuer/expiry/disabled target denied. Immediate restriction and session/client revocation preserved on uncertain completion. |
| Existing password/factor/kind/code | Fresh current TOTP and unused recovery code with password succeed; password-only/wrong password/stale code/malformed kind/replay/code race rejected; account/source/global bounds preserve host route. |
| Host selection/proof | Protected terminal nonsecret bounded Owner selection, existing ID, repaired audit and fresh enrollment; noninteractive invocation, nonexistent ID, outage, old/reissued/expired/wrong-purpose proof denied. No public route or arbitrary host-path input. |
| SMTP host/port/sender/username/credential/clear/enable/base/generation/review/recipient | Valid scoped write-only draft/review/recent apply, replacement/deletion/disable/test; malformed address/header injection, host/path, out-of-range port, controls/unknown fields, stale review and non-Owner denied. Validated TLS synthetic SMTP, bad reply, absolute deadline, capacity and audit failures tested. |

## Security contracts and validation

SECRES-T01: hash-only purpose/target/instance-generation proofs; trusted-origin fragment URLs; no-store/no-referrer; initial/hashchange removal and parallel consumption. SECRES-T03 (M12 host portion): protected selected-Owner listing/issuance/reissue, no web/public claiming. SECRES-T05: existing-factor/code/verified-Owner recovery, stale issuer and concurrent code rejection. SECRES-T06: uniform audit gates and no mutation/transport on outage; restricted M10 diagnostic sessions retain their current invariant.

Final full-suite and build result is recorded in validation.json. Browser evidence: browser-report.json; protected CLI: host-recovery-report.json. Actual TLS SMTP is executable in console-notifications.test.ts. Standalone declared Playwright harness is the established fallback after earlier in-app browser bootstrap/discovery troubleshooting; no reinstall, external provider or real message was needed. Screenshots mask password/link fields, QR, seeds, codes and preformatted sensitive enrollment text. No trace/network body capture or browser persistent storage is used.

Durable revocation provider: per-user/external authorizationGeneration defaults absent to zero and increments atomically with target security mutations. M14 must bind/check current eligible identity plus generation for grants/tokens/refresh; retained live broker instances immediately revoke affected references even when completion audit is uncertain. No ordinary grant/token authority is introduced by this milestone.

Final closure: 452 tests in 45 files pass; TypeScript build passes. Final password-change verification also proves pending reset proofs are revoked with the committed password mutation, including completion uncertainty. Protected host selection has six operational checks. Browser has eight checks including SMTP draft/apply/test failure and completed recovery-code enrollment. No real SMTP provider or external recipient was contacted.
