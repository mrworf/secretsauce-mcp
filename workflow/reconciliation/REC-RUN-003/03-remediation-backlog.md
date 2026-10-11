# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: docs/web-console-prd.md UX-01/04, MIGRATE-01–04; product/ux/01-information-architecture.md UX-IA01–04; product/ux/05-accessibility.md
> Additional implementation authority: Approved web-console-ux-2 UX-IA05/06, UX-IN08/09 and UX-C26–33;
> Previously adopted authority: PRD adoption of SECRES-05 and STATE-01/02/03 SMTP amendment.
> Preservation baseline: ca6be40d83df9c204f804904c018870b6becc31f
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

All seven feedback directives now have resolved implementation outcomes. Desired-state implementation_ready is true; delivery planning remains gated on bounded definition validation and enclosing provenance closeout. Six coherent remediation items cover all findings.

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| MEDIUM | REC-RM-001 | Visible exclusive current navigation | REC-003 | UX-01/04, UX-IA01 | None | HTTPS browser, keyboard, narrow view |
| MEDIUM | REC-RM-002 | Discoverable lossless legacy YAML import | REC-007 | MIGRATE-01–04, UX-IA02–04 | None | Existing migration regressions, identifiers, role controls |
| HIGH | REC-RM-003 | Separate authorized resets | REC-001/002 | IDENT-05, SECRES-05 | Definition revalidation | SECRES-T08–11 and browser |
| HIGH | REC-RM-004 | Independent SMTP deletion | REC-006 | IDENT-04, STATE-01/02/03 | Definition revalidation | State/HTTP/browser concurrency |
| MEDIUM | REC-RM-005 | Focused Settings navigation and exact draft review | REC-004 | UX-IA05 | Definition validation | Search/navigation/draft role and browser checks |
| MEDIUM | REC-RM-006 | Friendly complete configuration forms and summaries | REC-005 | UX-IA06 | REC-RM-005 | Capability round trips and browser checks |

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
UX constraints: import creates drafts, explains unresolved mappings/credentials and permits review; direct Services action reaches the same existing flow. Friendly mapping/value and readable import summary controls follow UX-IA06; existing raw YAML remains the deliberate source input.
Architecture/security constraints: own-property-safe dictionaries; no implicit email mapping; imported env/file references never trigger arbitrary host reads; write-only deliberately provided values, current lifecycle/access/credential preservation, audit and stale-revision checks remain. Preserved global proposals require separate Owner review; managed committed configuration remains authoritative.
Acceptance criteria:
1. Owner/Administrator find Import configuration directly from Services and Configuration tools. Guided main YAML and optional scanner-catalog uploads, field/source validation, explicit identity selectors and write-only credential fields produce drafts without automatic activation; show a readable result and unresolved needs under UX-IA04/06/C33. Preserve supported input methods and role boundaries.
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
UX constraints: distinguish Reset password and Reset authenticator with target/consequence confirmation, recent initiator authentication and verified-channel acknowledgement; recipient sees only the purpose-bound continuation. Approved UX-IN08 governs the flow; no global redesign is implied.
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

## REC-RM-005: Focused Settings navigation and exact draft review

Priority: MEDIUM. Source finding: REC-004. Feedback: PO-FB-007/008/009; PO-FB-009 remains exploratory historically. Authority: approved UX-DESIGN-002; UX-IA05, UX-R04, UX-V04, UX-A05, UX-C26/27 and PRD UX-02/CONFIG-03.
Current behavior: all Settings groups appended into a long page. Required outcome: six ordered destinations—Response protection, MCP authentication, Limits, Email, Backups & restore, Health & retention—with only selected content visible. Initial entry selects Response protection; links/back retain selected destination. Desktop secondary navigation uses current-page links; narrow layout a labeled ordinary select. Applied readable summary precedes authorized Edit.
Affected actors/interfaces: Owner full scope, Administrator editable response protection and authorized non-secret inspection, Auditor read-only, Member no Settings; existing account/logout and backup Owner boundaries remain. Navigation/search/error links and settings draft/review interfaces change coherently.
UX/state constraints: all editable sections use the permitted settings draft; section changes do not apply/discard it. Persistent draft summary distinguishes saved versus unsaved sections. Exact full-scope review lists all changed sections and applies the reviewed set atomically, without per-section partial apply or unrelated settings. Current permissions/dependencies/base revisions remain enforced. Immediate security/value actions can stale draft authority.
Acceptance criteria:
1. Each of six authorized destinations renders only its own content; clear global/local selection, parent context, browser back/link entry and narrow selector preserve reachable actions.
2. Section/search navigation with unsaved input offers Stay, Save draft and continue, Discard unsaved edits and continue; discard does not erase another section's saved draft. No secret browser storage or hidden autosave.
3. Search indexes authorized non-secret labels/help/technical aliases; selecting a result opens containing section/disclosure and focuses field/value. No result leaks forbidden settings or secret data. Clearing search preserves selected section.
4. Error-summary navigation reaches failures across sections without losing safe edits. Review names every changed section, preserves role scope, supports return to selected section, and rejects stale base/dependency/demotion without partial application.
5. Settings work at 320 CSS pixels and 200% text enlargement; inspect document width, component and text-range overflow, keyboard/focus and accessible current-selection semantics. Offline/expiry/audit/unknown completion retains only safe context and requires current status before retry.
Dependencies: current approved authority; final bounded definition validation. Explicit exclusions: new settings capabilities, ARIA tabs for page navigation, reduced mobile permissions, per-section partial apply or global redesign.
Validation: UX-C26/27 plus retained form/error/security regressions; actual HTTPS browser role/task sequences and complete atomic reviewed-scope state tests.

## REC-RM-006: Friendly complete configuration forms and summaries

Priority: MEDIUM. Source finding: REC-005. Feedback PO-FB-010/011. Authority: PRD UX-02 and approved UX-IA06, UX-IN01/04, UX-C28.
Current behavior: shared scanner catalog editing requires JSON and ordinary Settings/read/review surfaces expose raw structure. Required outcome: every preserved supported capability in UX-IA06 has labeled controls and readable effective summaries; raw JSON/YAML remains optional expert tooling, not the sole editing path. Technical literals such as regexes/URLs/claims remain labeled inputs with help and original semantics.
Affected actors/interfaces: all role-permitted configuration forms/read-only views/review/import summaries, same-draft advanced editor, settings and service inheritance links; do not broaden permissions or introduce host filesystem/key controls.
Capability coverage: repeatable destinations; credential metadata/no-auth; placement/header ownership; ordered policy rules and binary/scanning exceptions; Secretlint/sensitive-name Extend/Replace catalogs, pattern/exclusion/allow rows and bounded typed key/value/list rule options; OAuth client/scope/lifetime/throttle controls; limits with units/capacity; email, backup/retention and health summaries; guided import/export/history. The exact normative table UX-IA06 governs, preserving every supported field.
Acceptance criteria:
1. Each UX-IA06 row is operable using its specified friendly controls; Auditor gets readable effective values without mutation; ordinary reviews summarize named differences instead of forcing raw JSON reading.
2. Forms, expert editor and import round-trip supported values without loss, including regex sources, nested options, legacy IDs, ordering, inheritance and exceptions. No implicit matcher simplification or flattening; unknown imports fail explicitly.
3. Add/remove/reorder or value edits obey existing validation, assignment and priority semantics; unauthorized/direct inputs, invalid regex/limits/options and stale changes fail with field-linked safe recovery and no partial application.
4. Write-only values never reappear in summaries/history/errors/browser storage. Effective inherited values identify defining scope and authorized links; no competing copies of shared defaults. Missing usage metrics are not fabricated.
5. New structured external inputs have positive/negative tests, bounded sizes/depth/work, and current policy/audit checks; preserve supported advanced options even when unusual. All row controls/search/error focus work via keyboard and narrow reflow.
Dependencies: REC-RM-005 section structure for Settings presentation; approved UX-IA06 and unchanged domain semantics. Explicit exclusions: new plugin/service packs, removal of expert tooling, host-only startup knobs, lossy simplification or novel policy behavior.
Validation: capability-to-control coverage checklist mapped to UX-IA06, positive/negative structured-input and round-trip tests, service/scanner regressions, real browser ordinary/advanced/read-only tasks, search/errors and 320px/200% text checks.
