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
