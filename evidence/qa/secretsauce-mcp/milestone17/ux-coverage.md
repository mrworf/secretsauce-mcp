# M17 current local UX observations

Actual declared Chromium headless browser over synthetic HTTPS with example.org resolver
and certificate; desktop1280px and320CSSpx, keyboard tasks and focused errors/dialogs.
Masked PNGs exclude password/TOTP/QR/codes. No HAR, auth trace, cookie/storage snapshot
or local/session storage. Reports under [current](current/) are current source observations;
committed previous-milestone evidence remains byte-identical. Parent owns final acceptance. Text enlargement is a real CSS font-enlargement check, not a claim of native browser-chrome zoom automation.

| Check | Current task/report evidence |
| --- | --- |
|UX-C01 | [bootstrap](current/bootstrap/browser-report.json), [People](current/people/browser-report.json), [clients](current/clients/browser-report.json):fixed-role navigation, own account and explicit logout remain reachable. |
|UX-C02 | [services](current/services/browser-report.json): searchable list/lifecycle and exception states. |
|UX-C03 | services: five guided steps, Owner assignment, draft/review/apply; keyboardBack preserves fields. |
|UX-C04 | [advanced](current/advanced/browser-report.json): inherited semantics/defaults, advanced destination/TLS/policy context. |
|UX-C05 | services/advanced: applied versus draft state, sanitized exact review and scope. |
|UX-C06 | services: concurrent disable yields focused stale comparison/reload/review without false completion. |
|UX-C07 | services/People/clients: explicit immediate disable/revoke/assignment/authentication consequences and confirmation. |
|UX-C08 | services/People/[recovery](current/recovery/browser-report.json): safe blocked reason, nominee/lastOwner safeguards and individually reviewed service reactivation; backend negative tests separately verify invariants. |
|UX-C09 | advanced: applied canonical policy denial/winning rule and safe preview with no downstream call. |
|UX-C10 | services/advanced/clients: write-only inputs, sanitized reviews and readable TLS/scanner/legacy bearer exceptions. |
|UX-C11 | People: fixed roles, manual enrollment delivery, fresh invitation/recovery and account/external status. |
|UX-C12 | bootstrap/People/recovery: actual password+TOTP, restricted fresh enrollment/QR/codes and account recovery paths. |
|UX-C13 | clients: ChatGPT/Codex disclosures, origin versus full MCP URL, consent versus service assignment, own client scope and reconnect. Actual local HTTPS consent succeeds; no real external client claim. |
|UX-C14 | [operations](current/operations/browser-report.json): scoped Activity/filters/uncertain outcomes/details; actual restored cleanhost API additionally verifies imported source and unavailable interval. |
|UX-C15 | all current reports: empty/failed/expired/forbidden/stale/capacity/audit outage states maintain orientation; recovery invalid material and restricted enrollment focus safe errors. |
|UX-C16 | bootstrap/operations/[backups](current/backups/browser-report.json): blocked sensitive action with host repair and scoped reads, no diagnostic-session auto-upgrade. Actual cleanhost audit-key outage blocks enrollment. |
|UX-C17 | backups: source scope, recovery/completion points, last-good/unknown archives, off-host responsibility, retention, independent material and recent download. |
|UX-C18 | recovery: validation→review→explicitreplacement; source, actual namedinitiator and archivednominee separately; current authorization/capacity and unchanged malformed material. |
|UX-C19 | recovery: fresh nominatedOwner then persistent management checklist with people/external/auth counts; servicesDisabled/no resumeall. Actual cleanhost drill explicitly enables one current-reviewed service while99Disabled. |
|UX-C20 | each current report/screens: desktop and320px no horizontal overflow; focused recovery enrollment/management/account additionally checks200% root/body/form text enlargement at320px, list/diff labels stacked and account/logout accessible when authorized. Each enlarged recovery state keyboard-focuses its critical action; headings wrap, with geometry-only initial failure recorded in the focused report directory. |
|UX-C21 | each current report: keyboard order, disclosure/dialog cancel focus, errors/current navigation; recovery enrollment entirely keyboard controlled. |
|UX-C22 | masked rendered PNGs: coherent readable hierarchy, moderate density, restrained brand and explicit text/icon statuses across current preserved/recovered surfaces. |
|UX-C23 | advanced: import missing mappings/credentials and history correction/fresh draft, no secret or revoked access replay. |
|UX-C24 | operations/backups: units/consumption/inherited source, capacity/impact and explicit review/retention consequence. |
|UX-C25 | independent measured automation below; safeguards kept, no human-study claim. |

Representative automated task timings:

| Task | Threshold | Observed | Report |
| --- | --- | --- | --- |
|First straightforward guided service with current Owner assignment and reviewed apply|15min|1029ms|services|
|Investigate applied policy denial/canonical target/winning rule safely|2min|155ms|advanced|
|Disable an account through explicit confirmation and recent password/TOTP|1min|243ms|People|

These values measure representative scripted interactions in the declared local browser;
they are not evidence of unassisted human learning or broad usability research. The new
recovery browser has4groups; current preserved bootstrap7,services7,People8,advanced6,
clients5,operations6,backups7 groups. Every browser report states actual local transport.
Application/server fake clocks advance between TOTP uses only; UX timing uses the original
real clock. Docker recovery timing uses actual host TOTP waits and a separate operational
clock through one usable reviewed service.

[Platform criterion/fault mapping](../../../platform/secretsauce-mcp/milestone17/acceptance-coverage.md)
and [operational report](../../../platform/secretsauce-mcp/milestone17/docker-cleanhost-report.json)
cover backend authorization, failure injection, source provenance and local client protocol.
Real ChatGPT/Codex remainNOT RUN under the user-authorized local validation exception.
