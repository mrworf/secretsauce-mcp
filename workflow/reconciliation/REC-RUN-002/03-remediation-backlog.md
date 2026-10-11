# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: docs/web-console-prd.md UX-01/04, MIGRATE-01–04; product/ux/01-information-architecture.md UX-IA01–04; product/ux/05-accessibility.md
> Additional implementation authority: PRD adoption of SECRES-05 and STATE-01/02/03 SMTP amendment.
> Preservation baseline: ca6be40d83df9c204f804904c018870b6becc31f
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

The following independent outcomes are resolved. Whole-feedback delivery remains blocked by REC-DEC-002 and definition revalidation; do not infer that this backlog covers the unresolved fixes.

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| MEDIUM | REC-RM-001 | Visible exclusive current navigation | REC-003 | UX-01/04, UX-IA01 | None | HTTPS browser, keyboard, narrow view |
| MEDIUM | REC-RM-002 | Discoverable lossless legacy YAML import | REC-007 | MIGRATE-01–04, UX-IA02–04 | None | Existing migration regressions, identifiers, role controls |
| HIGH | REC-RM-003 | Separate authorized resets | REC-001/002 | IDENT-05, SECRES-05 | Definition revalidation | SECRES-T08–11 and browser |
| HIGH | REC-RM-004 | Independent SMTP deletion | REC-006 | IDENT-04, STATE-01/02/03 | Definition revalidation | State/HTTP/browser concurrency |

## REC-RM-001: Visible exclusive current navigation

Source findings: REC-003. Product Owner feedback: PO-FEEDBACK-2026-10-11-001 / PO-FB-005, PO-FB-006.
Authoritative basis: UX-IA01 current location; accessibility current-navigation state; confirmed directive PO-FB-006.
Desired/current/required outcome: current source lacks visual selection and leaves stale peers selected; make the active primary area and applicable subnavigation visibly distinct and expose exactly one current item per navigation group.
Affected users/roles: all authorized console roles. Interfaces: primary menu, service detail/section menus, account and nested return paths; no API change implied.
UX constraints: maintain independent visible keyboard focus, readable contrast and non-color selected cue; preserve existing area labels, narrow wrapping, allowed routes and account/logout reachability.
Architecture/security constraints: no permission widening; current role-based destinations remain enforced.
Acceptance criteria:
1. Moving among every permitted area selects exactly that area visually and programmatically, including return to Services and My account.
2. Each service tab/section shows its own selection without losing parent-area context; no inactive peer remains current.
3. Keyboard focus and selection remain distinguishable; controls reflow at 320 CSS pixels and text enlargement.
4. Hidden unauthorized routes never gain affordances and direct denial behavior remains unchanged.
Dependencies: None. Explicit exclusions: global redesign, new routes, authentication changes.
Required implementation validation: browser-visible selection assertions/screenshots and semantic assertions across role-appropriate navigation sequences, keyboard and narrow layout.

## REC-RM-002: Discoverable lossless legacy YAML import

Source findings: REC-007. Product Owner feedback: PO-FEEDBACK-2026-10-11-001 / PO-FB-014.
Authoritative basis: MIGRATE-01–04 and UX-IA02–04 already require guided import and preserved identifiers.
Desired/current/required outcome: retain the existing raw YAML importer and explicit mapping/value resolution; add the promised direct Services import action and remove first-import rejection of valid legacy identifier shapes. Do not recreate migration as a new incompatible feature.
Affected users/roles: Owner and Administrator within existing service/catalog versus instance-setting boundaries; Auditor/Member remain read-only or denied. Interfaces: Services entry, Configuration tools, existing configuration/import API and legacy rawConfigSchema.
UX constraints: import creates drafts, explains unresolved mappings/credentials and permits review; direct Services action reaches the same existing flow. Settings JSON redesign is outside this independent item.
Architecture/security constraints: own-property-safe dictionaries; no implicit email mapping; imported env/file references never trigger arbitrary host reads; write-only deliberately provided values, current lifecycle/access/credential preservation, audit and stale-revision checks remain. Preserved global proposals require separate Owner review; managed committed configuration remains authoritative.
Acceptance criteria:
1. Owner/Administrator find Import configuration directly from Services and import valid old gateway YAML plus scanner catalogs into drafts without automatic activation.
2. Supported legacy IDs outside new-creation restrictions, including dictionary-edge names, preserve exact identity on first import, subsequent edits/export and lookup; unsupported fields fail explicitly.
3. Explicit eligible local or registered exact issuer/subject mapping works; unresolved mappings/credentials block activation, disabled identities and implicit emails are rejected.
4. Deliberate values can create missing credentials but cannot silently rotate existing values; referenced environment variables/files are not read. No raw values appear in diagnostics/export/audit.
5. Stale/demoted/unauthorized/oversize/malformed/alias input fails without partial accepted import. Existing assignments, disabled lifecycle and active configuration stay current until authorized review.
Dependencies: None. Explicit exclusions: arbitrary server file access, profile packs, automatic activation or bulk replacement of identity/permissions.
Required implementation validation: existing migration/advanced service suites plus positive/negative legacy identifier and direct-entry browser coverage; exercise a complete legacy configuration with env/file credential declarations using separately supplied values. Existing tests were inspected only, not rerun by reconciliation.

## REC-RM-003: Separate authorized password and Authenticator resets

Priority: HIGH. Source findings: REC-001, REC-002. Product Owner feedback: PO-FB-001–004 in PO-FEEDBACK-2026-10-11-001.
Authoritative basis: adopted PRD IDENT-04/05/06, AUTHZ-02/03, AUDIT-01 and normative SECRES-05. Desired outcome: both designated roles initiate separate resets within precise target hierarchy and bounded recovery authority. Current behavior: Owner-only combined recovery restricts at issuance and factor recovery also replaces password; change those transitions as specified.
Affected actors/interfaces: Owner; Administrator with minimum safe target visibility; permitted other users; protected reset initiation/reissue/completion UI/API and browser proof flow. Existing invitation/role/reactivation/SMTP management remains Owner-only; self-service existing-factor recovery remains available.
UX constraints: distinguish Reset password and Reset authenticator with target/consequence confirmation, recent initiator authentication and verified-channel acknowledgement; recipient sees only the purpose-bound continuation. Derived canonical UX adoption remains a definition gate, not license for a global redesign.
Security/architecture: SECRES-01/03/04/05 and STATE-01/02/03 are normative; preserve verifier-only proofs, immediate revocation, durable audit, generation fencing and no secret logging.
Acceptance criteria:
1. Owner initiates either reset for eligible other roles; Administrator can do so for Administrator/Auditor/Member, never Owner. Reject assisted self, forbidden lifecycle/identity classes, arbitrary contact and unauthorized direct API.
2. Password issuance does not restrict or revoke; proof plus existing TOTP/recovery code and new password completes once, preserving MFA and revoking old sessions/grants/references; ordinary login follows.
3. MFA issuance invalidates old factor/codes/access immediately; completion installs fresh factor/codes while preserving password. Both-lost path completes MFA first then a new password reset. Expiry/abandonment stays restricted.
4. Current issuer/target role, generation and lifecycle changes invalidate proof authority; natural issuer session expiry alone does not. Last enrolled Owner continuity survives concurrent restrictions and role changes.
5. Wrong purpose/target/instance, replay/concurrent completion, audit failure, uncertain persistence and old JWT/refresh/reference completion cannot restore access; no proof/password/seed appears in logs/history.
Dependencies: adopted normative contracts; complete definition revalidation before planning. Explicit exclusions: general Administrator user-management powers, MFA disabling, new approval chains or combined reset proof.
Required implementation validation: SECRES-T08–11 plus retained T01/T05/T06 and gateway revocation regression; actual HTTPS browser for each role/purpose, safe manual/SMTP delivery and narrow recovery.

## REC-RM-004: Independent confirmed SMTP credential deletion

Priority: HIGH. Source finding: REC-006. Product Owner feedback: PO-FB-012/013.
Authoritative basis: adopted PRD IDENT-04/06, CONFIG-03/04, STATE-01/02/03 SMTP amendment. Desired/current behavior: replace clear-on-apply checkbox with independent confirmed deletion of the current credential version; retain existing creation/replacement through draft/review/apply.
Affected actors/interfaces: current recently authenticated Owner; SMTP settings, credential state, delivery admission, pending draft/review/history. Administrator reset privilege does not grant this operation.
UX constraints: distinct Delete SMTP credential action; target/version and consequence confirmation; cancellation leaves state; enabled dependency denial names disable-and-review path; no implicit disable or anonymous fallback.
Security/architecture constraints: current authorization, recent authentication, audit, revision/version and dependency checks at mutation; delete live and pending secret copies atomically, invalidate reviews, retain non-secret drafts for refresh, version-fence old submissions, preserve admitted delivery outcome.
Acceptance criteria:
1. Enabled SMTP dependency blocks delete. Disable through review/apply retains secret; subsequent independent delete removes it without changing non-secret settings.
2. Wrong role, expired recent auth, stale confirm/version, concurrent replacement and audit failure reject before deletion. Missing secret reports already absent.
3. Delete removes pending copies; stale draft/history/blank input/browser submission cannot recreate deleted value. Fresh explicit value entry into a current draft and ordinary review/apply remains supported.
4. Queued delivery checks current dependency before dispatch; already-dispatched mail may finish with captured admitted context and cannot resurrect configuration. Manual links and gateway remain available under existing rules.
5. Restart selects coherent prior or completed deletion; uncertain persistence is not reported successful and fences new use. Encrypted historic backups retain their existing explicit restore semantics.
Dependencies: adopted state contract; complete definition revalidation before planning. Explicit exclusions: immediate SMTP creation/replacement, secret backup shredding, new mail queue/recovery UI or new approval chain.
Required implementation validation: positive/negative SMTP state/http/browser tests, concurrency/stale draft/history/restart/audit failures and queued-versus-dispatched transport behavior with no real outbound recipients.
