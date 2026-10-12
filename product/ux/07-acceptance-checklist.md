# Observable UX conformance checklist

These criteria specify the approved experience; they are not release certification or proof that the future console exists. Later implementation/UX audit records reproducible evidence and any divergence. Stable IDs trace to shared rules and product requirements.

| ID | Observable check | Governing UX rules | Product trace |
| --- | --- | --- | --- |
| UX-C01 | Four-area service-first shell, visible location and account/logout access remain coherent for each fixed role; forbidden actions and private data do not appear. | UX-IA01, UX-A01 | UX-01, AUTHZ-01/02 |
| UX-C02 | Services supports search/status including Archived; runtime lifecycle, draft changes and exceptions are distinguishable without color alone. | UX-IA02, UX-V02 | CONFIG-05, UX-01/03 |
| UX-C03 | First-service wizard has the five required steps, preserves safe Back navigation, and explains incomplete activation dependencies. | UX-IA02, UX-IN01/02 | CONFIG-01/03 |
| UX-C04 | Every capability in the IA coverage table is discoverable in forms/advanced settings; switching editors and importing regexes never silently loses values. | UX-IA03, UX-IN01 | BASE-01, POLICY-02, MIGRATE-01 |
| UX-C05 | Existing active configuration remains visibly separate from saved/unsaved drafts; apply review shows exact sanitized changes, impact, exceptions and affected scope. | UX-IN01/02, UX-V02 | CONFIG-03, STATE-01/02 |
| UX-C06 | Stale dependency/role/base revision produces a safe comparison/review path; no partial apply or uncertain-success claim. | UX-IN02/05 | AUTHZ-02, STATE-02 |
| UX-C07 | Disable/revoke/grant/rotation/role actions have explicit immediate consequences and current authorization; cancelling/discarding a draft cannot masquerade as undo. | UX-IN03, UX-EX03 | CONFIG-02/05, SEC-03, STATE-01/03 |
| UX-C08 | Last-Owner protection, missing credential dependencies and disabled-service re-enable requirements have readable reasons and valid recovery actions. | UX-IN03 | AUTHZ-03, CONFIG-02/05 |
| UX-C09 | Policy order and defaults match the specified semantics; safe tester shows canonical target/winning rule and states no downstream call is sent. | UX-IN04 | POLICY-01/03, SEC-02 |
| UX-C10 | Write-only secrets never reappear in history/review/export/errors; effective TLS/scanner exceptions and trust limitations remain readable. | UX-IA03, UX-IN01/02/04, UX-V02 | AUTHZ-04, SEC-01, POLICY-04 |
| UX-C11 | People/invitation/recovery statuses and actual fixed-role powers are clear; SMTP failure and manual delivery never imply successful enrollment. | UX-IA04, UX-IN05/06 | IDENT-03/04/05, AUTHZ-02 |
| UX-C12 | Password/TOTP, accessible authenticator setup and recovery-code paths work as described without password-only MFA replacement or secret-bearing error content. | UX-IN06, UX-A04, UX-EX02 | IDENT-01/02/05/06, SECRES-01–03 |
| UX-C13 | ChatGPT/Codex setup distinguishes origin from full MCP URL, individual consent from service assignment, and own grants from global identity administration. | UX-IA04 | MCP-01/02/03, AUTHZ-01 |
| UX-C14 | Activity filters and sanitized details support denial investigation; role scope, admitted revision, uncertain outcomes and imported evidence provenance are clear. | UX-IA04, UX-IN05/07 | AUDIT-01/02/03, BACKUP-06 |
| UX-C15 | Empty/loading/failed/offline/expired/forbidden/capacity states preserve orientation and safe next steps; no blind replay or false completion. | UX-IN05 | UX-03, OPS-02/03 |
| UX-C16 | Audit outage preserves scoped reads, visibly blocks ordinary sensitive tasks and points to host repair; restricted sessions need normal authentication after repair. | UX-EX01 | AUDIT-04, SECRES-04 |
| UX-C17 | Backups distinguish recovery/completion points and incomplete archives, explain off-host responsibility, and show scope/retention/download authentication. | UX-IN07 | BACKUP-01/02, OPS-04, STATE-04 |
| UX-C18 | Restore preview names initiator and archived recovery Owner, validates before replacement, shows maintenance/failure outcomes and never exposes archive recovery material. | UX-IN07, UX-EX04 | BACKUP-03/04, SECRES-02, STATE-05 |
| UX-C19 | Post-restore enrollment and management review keep users/services/access restricted until explicit allowed reactivation; no resume-everything action. | UX-IN07, UX-EX02/04 | BACKUP-05, STATE-06 |
| UX-C20 | Narrow/zoomed views preserve content/status/actions and account/logout; lists/diffs stack with labels; routine tasks reflow at 320 CSS px. | UX-R01/02, UX-A03 | UX-04 |
| UX-C21 | Keyboard, skip/focus order, dialog return, errors, disclosure, current navigation and status announcements remain coherent without hover/drag dependence. | UX-A01/02/03, UX-R02 | UX-04 |
| UX-C22 | Readable hierarchy, moderate density, restrained brand, concrete action labels and text/icon status match approved concepts across new surfaces. | UX-G02, UX-V01/02/03 | UX-01/02/03 |
| UX-C23 | Configuration import/history reports missing fields/credentials/mappings and uses a fresh permitted draft; history never claims to restore secrets or revoked access. | UX-IA04, UX-IN02/03 | MIGRATE-01–04, CONFIG-04, STATE-03 |
| UX-C24 | Health/limits/retention use units, consumption, consequence and impact; role permissions and inherited-source labels remain clear. | UX-IA03, UX-IN05/07 | OPS-02/03/04 |
| UX-C25 | Representative task evaluation measures first straightforward service within 15 minutes, denial investigation within 2 minutes and user disable within 1 minute without bypassing safeguards. | UX-IA02/04, UX-IN02/03/04 | PRD usability targets |

Definition validation confirms these criteria trace to approved rules and requirements; it does not mark them runtime-passed. Full-suite gateway preservation, operational recovery drills, platform support, cryptographic assurance and release ownership belong to implementation/security/operations validation rather than this UX checklist.


## Bounded feedback conformance additions

| ID | Observable check | Governing UX rules | Product trace |
| --- | --- | --- | --- |
| UX-C26 | One of six named Settings destinations is visible, selection is clear globally and locally, and the narrow selector preserves section/account/action reachability. | UX-IA01/05, UX-R04, UX-V04, UX-A05 | UX-01/02/04 |
| UX-C27 | Authorized search reaches advanced fields; section/search/error navigation protects unsaved input; saved changes across sections remain visible in exact full-scope review without partial apply. | UX-IA05, UX-IN01/02, UX-A05 | CONFIG-03, UX-02/03 |
| UX-C28 | Every UX-IA06 capability has friendly edit controls and readable effective summaries; advanced editor/import round trips preserve exact values, regexes, nested rule options, IDs and role scopes. | UX-IA03/06, UX-IN01/04 | BASE-01, CONFIG-01, POLICY-02, MIGRATE-01 |
| UX-C29 | Owner and Administrator see separate permitted reset actions with role-permitted target visibility; prohibited targets and unrelated administration stay unavailable; final enrolled Owner protection remains explained. | UX-IA04, UX-IN08 | AUTHZ-02/03, IDENT-05, SECRES-05 |
| UX-C30 | Password issuance preserves access; proof-plus-factor completion changes password only and revokes access. MFA issuance restricts immediately; fresh factor completion preserves password. Both require ordinary login; both-lost sequence is explicit. | UX-IN08, UX-A04/05, UX-EX02 | IDENT-05/06, SECRES-05 |
| UX-C31 | Reset expiry/replay, revoked issuer, target change, audit outage, failed delivery and uncertainty expose safe outcomes/reissue without secret disclosure, false activation or requiring an open issuer browser. | UX-IN05/08 | AUDIT-04, SECRES-01/05 |
| UX-C32 | SMTP deletion is independently confirmed and recent-authenticated; enabled dependency blocks with a disable/apply path; creation/replacement stay draft-based; stale drafts/history cannot restore deleted values. | UX-IN09, UX-EX03 | IDENT-04/06, CONFIG-03/04, STATE-01/02/03 |
| UX-C33 | Legacy gateway YAML and both scanner catalogs enter a permitted draft with field/source errors and explicit credential/identity resolution; no silent dropping, arbitrary host read or activation. | UX-IA04/06, UX-IN02 | MIGRATE-01–04, BASE-03 |

These additions supplement stable UX-C01–25 and inherit their authorization, error, accessibility and evidence boundaries. Canonical synthesis validates requirements; it does not claim runtime passage.

## Feedback 002 conformance additions

| ID | Observable check | Governing UX rules | Product trace |
| --- | --- | --- | --- |
| UX-C34 | Authorized Settings opens populated current non-secret forms without extra Edit step; loading/absence/read errors never appear as undefined or made-up values; read-only actors have appropriate views. | UX-IA05/08, UX-IN10 | UX-02/03, CONFIG-03 |
| UX-C35 | Unsaved, Saved for later · Not in use yet, and In use are distinct; Review saves then opens complete scope, Save for later never activates, and successful Apply refreshes actual current values. No-op submission is unavailable. | UX-IN10, UX-V02 | CONFIG-03, STATE-02 |
| UX-C36 | Backup and diagnostics values persist/reload with the same state model; cleanup is separately reported after atomic activation; uncertainty never becomes a success claim. | UX-IN10 | BACKUP-02, OPS-03/04, UX-03 |
| UX-C37 | Every mandatory field has symbol/legend and programmatic indication; non-obvious fields have associated concise help; service stepper and repeatable items do not overlap during add/remove/errors/expanded help or text enlargement. | UX-IN11, UX-A06, UX-R05 | UX-02/04, CONFIG-01 |
| UX-C38 | One account row opens a full detail page with permitted contact/role edits and read-only creation/last-console-sign-in; forbidden target/result roles and unrelated Administrator lifecycle powers stay unavailable. | UX-IA07, UX-IN12 | IDENT-02A/05, AUTHZ-02/03, SECRES-06 |
| UX-C39 | Known Never, legacy Unknown, external Not applicable and restored historical dates are distinguished with timezone; contact/role confirmations explain immediate revocation and preserve factor/lifecycle state. | UX-IN12 | IDENT-02A/05/06, STATE-07, SECRES-06 |
| UX-C40 | SMTP prefill never redisplays saved password; TLS/None selection, clear risk and acknowledgment, applied-state test, no fallback, restore review and independent deletion remain truthful and usable. | UX-IN09/13 | IDENT-04/06, SECRES-07, STATE-08 |
| UX-C41 | Secret detection explains which returned data is checked and the best-effort boundary; ordinary labels/help/errors/outcomes use consistent concrete language and preserve technical aliases/advanced capabilities. | UX-IA08, UX-V02 | UX-02/03, AUTHZ-04, POLICY-04 |
| UX-C42 | Matching-state/viewport implementation screenshots are directly compared with approved manifest-hashed mockups for composition, width, density, typography, spacing, controls, colors/hierarchy, rails and responsive layouts. Meaningful discrepancies are fixed or explicitly accepted and scoped; functional tests alone cannot satisfy visual conformance. | UX-G04, UX-V05, UX-R05 | UX-02/04, UX-DESIGN-003 |

UX-C42 requires visual implementation evidence, not new release or platform certification. Record reference image, actual screenshot, viewport, state/role, observed differences and resolution. Prototype sample values and inert controls are not production fixtures; preserved capabilities and accessibility remain required.
