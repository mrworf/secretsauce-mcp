# Shared interaction patterns

## UX-IN01 — Forms and progressive disclosure

Use visible field labels, concise purpose/help text and explicit units. Group related settings into named sections; optional advanced details retain a visible effective summary. Keep one primary next action for the task. Editable forms support keyboard/paste/password managers; credentials are not repopulated after save. Existing credential cards show metadata and **Replace value…**, never a reveal action. Explicit **No downstream authentication** avoids treating an empty credential as an accidental omission.

Save draft preserves non-secret input and returns a clear saved state; it does not say Applied. Warn before discarding unsaved work or navigating away; offer Stay, Save draft where allowed, or Discard. Never persist entered secrets in browser storage or reproduce them in recovery notices. Distinguish saved drafts from browser-unsaved edits. A validation failure preserves permitted non-secret input, places the error beside the field, and provides an error summary with focusable links. A secret needing re-entry is labeled explicitly. Global/backend failures use a task-level notice and retry path.

## UX-IN02 — Draft review and concurrency

**Review & apply** opens a full page with the exact reviewed service/settings scope, base revision, sanitized before/after groups, effective policy changes, security exceptions, affected services and expected reconnection/reference effects. Returning to edit preserves the draft. Do not silently include unrelated settings. A stale base/dependency or role change rejects apply with no partial-success claim: explain what changed, show the sanitized comparison, and offer reload/review of the new state while retaining authorized non-secret draft work.

Security-exception acknowledgements identify the specific exception and effect; never bury them in a generic checkbox. Use the policy tester where uncertainty is about matching, without suggesting the test proves credential safety. Apply success names the new active revision and links to activity. Apply failure states that the prior active revision remains, only when that outcome is known. Unknown completion uses status lookup/reconciliation guidance rather than an unsafe repeated operation or false rollback claim.

## UX-IN03 — Immediate and consequential actions

Identity, role and service grants/removals, disable/archive, grant/session revocation and credential value actions use a concise explicit confirmation with target, consequence and action verb. Label that they take effect immediately on success and do not wait for draft application. Destructive controls are visually subordinate to routine edit/save until invoked; the confirmation then makes the consequential action unambiguous. Cancel leaves the target unchanged. Do not require typed phrases for every action or introduce approval chains.

Request recent authentication only for the high-risk actions specified by IDENT-06/security contracts. Reauthentication states the bound action and requests required password/TOTP, preserves allowed non-secret task context, and returns to its review after success. Expiry, denial or cancellation does not perform the action. Do not offer password-only MFA replacement or MFA-disable convenience.

The last active Owner protection is explained beside the unavailable operation; name the need for another enrolled Owner. Removing access or disabling a service states that newly admitted requests stop, while already-dispatched work may complete. Archive returns to Disabled when restored. Re-enable explicitly reviews the current service/dependencies. Credential replacement states affected references will be invalidated; credential deletion lists safe dependency labels and resolution links, never secret values. History cannot undo these operations.

## UX-IN04 — Policy and effective state

Display actual evaluation order: highest priority first, deny before allow at a tied priority, stable same-effect ties; unmatched requests use the default. No decorative dragging silently changes order. Exact/prefix/regex labels stay explicit. Effective TLS/scanning inheritance and any override are readable before editing.

Safe policy preview takes identity, service, destination, method and path/URL, then shows assignment eligibility, canonical target, winning rule/default, effective response protection and denial/allow reason. Prominently state **No downstream request is sent**. Invalid input shows field errors; blocked identity or destination shows a negative result with a permissible reason. Never substitute/display credentials or a secret-bearing outbound URL. Preview is informative, not a saved grant or proof that later dispatch will still be allowed.

## UX-IN05 — Feedback and operation states

| State | Observable response and recovery |
| --- | --- |
| Empty | Explain the scope; offer the actor's valid next action (add/import, clear filters, or contact an existing administrator) |
| Loading | Retain page context, label the region busy, and prevent duplicate task submission; avoid endless unlabeled spinners |
| Saved / applied / completed | Use exact status, target and revision/job identity where relevant; do not conflate saved draft, email delivery or enrollment with completed activation |
| Validation failure | Inline error plus linked summary; preserve non-secret work; reveal a collapsed invalid section |
| Forbidden / role changed | Remove stale mutation capability and show safe return; do not leak unavailable object data |
| Offline / request lost | State that the result may be unknown; reload operation state before allowing retry of a consequential action; never queue secret mutations offline |
| Degraded dependency | Describe impacted capability and corrective step; SMTP failure does not claim invitation acceptance or stop otherwise permitted gateway work |
| Partial workflow progress | Separate completed actions from remaining steps (for example restore installed versus users/services reviewed); never call atomic apply partially applied |
| Limit reached | Show relevant non-secret limit/unit and recovery condition; do not silently evict active state or suggest raising a limit without permission |
| Session expired | Explain sign-in is required, preserve only safe non-secret context and return after authentication; all changes still need current checks |

Status notices use words and icon/shape in addition to color. Success may use a transient notification only when persistent page state also confirms it. Failures requiring action remain visible. Long jobs show stage, start time and known progress; never fabricate a percentage when the work cannot be measured. Auto-refresh must not steal focus or repeatedly announce unchanged state.

## UX-IN06 — Enrollment, accounts and connection

Initial setup first proves host authorization, then collects instance/Owner details, password, authenticator enrollment and independently stored backup recovery material. Invitations show predetermined identity/role and expiry. Display fresh authenticator QR plus accessible manual seed only inside the authorized enrollment step; allow code paste, explain clock mismatch without exposing seed in errors, and confirm a valid code before ordinary access. Show recovery codes once with a deliberate save acknowledgement; never later reveal stored codes. Fresh factor enrollment invalidates prior recovery authority according to the security flow.

Login uses password then TOTP with recovery-code access clearly discoverable. Password reset and MFA recovery are distinct: resetting a password does not remove MFA. Expired/used links offer authorized reissue/contact guidance and never expose secret proof. A link preview/GET performs no enrollment. Owner-assisted recovery shows identity-verification and consequence acknowledgement and a safe manual delivery path when SMTP is absent. Manual capability links are visible only in the authorized issuance step, with copy action and expiry; never include them in general history or diagnostics.

Own sessions/client grants show recognisable client/time information permitted by the product, current-session marking and revoke controls. Own password/MFA changes follow the normative checks and announce resulting session invalidation. Read-only diagnostic sessions and restricted recovery use the exceptions in UX-EX01/02.

## UX-IN07 — Backup and restore

Backups show encrypted status, recovery-point and completion times, scope, format/software compatibility, size, job status and retention. Distinguish an in-progress/failed output from a valid archive. Daily scheduling and 30-day default retention are editable Owner settings. State that off-host copying is the operator's responsibility; do not imply a local mount protects against host loss. Download requires recent authentication. Changing retention displays deletion impact before review/apply.

Restore is a full-page sequence: select/upload archive and recovery material → validate → review source/recovery point, contents, current-state replacement, compatibility/capacity, actual initiator and nominated archived Owner → recently authenticate where required → explicitly start restore. Validation failure prevents replacement and gives a safe correct/retry path. Never display recovery material in preview. Clean-host host proof and in-place current-Owner proof remain distinct.

During restore show maintenance and progress stages; stop presenting ordinary write controls. Explain draining work and uncertain downstream outcomes without promising remote rollback. Show pre-restore backup/installation readiness before replacement; failed installation reports whether the prior installation was recovered, fresh login is required, or host recovery is needed. Do not offer arbitrary cancellation after installation begins.

After installation the restricted continuation permits only status and fresh nominated-Owner password/MFA enrollment. Lost/expired continuation gives the protected host-recovery path. After enrollment and healthy audit, show the approved management-review checklist: review people and authorize fresh enrollment; review each disabled service/credentials/policy/access; reactivate external/legacy modes explicitly if wanted; reconnect clients. No **Resume everything** action. Preserve progress across navigation, indicate pending counts, and distinguish this usable management state from an executing service. Re-enabling one reviewed service need not wait for every other service to be reviewed.

Audit history after restore preserves origin/provenance and unavailable intervals. Audit failure at any restore/enrollment stage invokes the outage boundary and blocks ordinary activation.
