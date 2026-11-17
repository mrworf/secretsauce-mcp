# M44 focused acceptance

PASS for SMTP credential tasks. Starting revision249a044, current UX7/M44 and UX-EX03. No deployment or whole-packet release claim.

## Delivered behavior and evidence
Current username/password availability and pending metadata are visible beside Set/Replace and Clear. Authentication is visible without a one-field disclosure. Missing mail setup has yellow Not configured status. Disabled delivery is explicitly named; its retained-password sentence is conditional so cleared credentials never claim a saved value remains.

Set/Replace opens the shared credential dialog pattern with username prefilled, blank password, Save/Cancel/close and focus handling. Absent Set requires a password locally. Blank Replace—including username-only changes—retains the existing pending/applied password under unchanged server credential-version checks. Save explicitly stages the current Email settings and credential; it never applies. Cancel/Escape clears entries and preserves unrelated safe form input. Secret entry is removed before the request; no browser storage or secret status display.

Clear remains separate immediate deletion with recent authentication. Enabled password-auth delivery shows the blocking dependency and Go to email delivery route, without pretending a deletion can succeed. Disable/save/review/apply retains credentials; allowed Clear removes pending/current copies and keeps non-secret settings. Test delivery still uses applied settings. No SMTP transport/backend/schema changes.

## Validation
- Build PASS.
- Focused notifications/deletion/modes/settings Vitest:32 tests PASS. Initial two localhost-listener EPERM failures passed when the identical command was rerun with loopback permission. Existing coverage includes stale version, demotion, unavailable audit, pending resurrection prevention, actual synthetic TLS/plaintext SMTP, exact current binding and full atomic Settings review.
- SMTP deletion/dialog browser PASS: absent local error, blank prefill, username-only retention, pending-not-active Save, Cancel/Escape/focus, preservation of other safe edits, response-loss followed by durable lookup with disabled Save/no blind retry, enabled Clear blocked, disable/apply then immediate Clear, empty browser storage. Report smtp-deletion-browser-report.json.
- SMTP modes browser PASS: TLS/None review acknowledgment and applied test semantics. Report modes/smtp-modes-browser-report.json.
- Populated Settings browser PASS: cross-form save/review/apply, partial save retry, stale/unknown dependency behavior and read-only/absent states with dialog entry. Report populated/populated-settings-browser-report.json.

## Reproduction
Build first. Working directory /home/ha/projects/secretsauce. The same isolated command works for each script below, changing only evidence directory and script:

```sh
docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone44 mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-smtp-deletion-browser.mjs
```

For modes use `scripts/verify-console-smtp-modes-browser.mjs` and evidence suffix `/modes`; for populated use `scripts/verify-console-populated-settings-browser.mjs` and suffix `/populated`. All create disposable encrypted stores and synthetic HTTPS; no live instance mounts. Browser failure reporting suppresses request call logs. Modes/populated passed before final dialog-only shared styling and accurate disabled copy correction; their transport/atomic paths were unchanged. Final dialog run passed on final source.

## Visual qualification
Opened actual desktop/390px/320px200% text dialog images and compared approved feedback003 replace-dialog pattern. Reused its dialog width, close action and right-aligned footer after inspecting initial difference. Username is an additional SMTP field; staged timing text is the explicit UX-EX03 exception to service immediate value mutation. Final dialog wraps on narrow screens, uses bounded vertical scrolling under enlarged text, and preserves keyboard/Escape focus. Password areas are deliberately masked in screenshots, including blank fields. Document/text-range reflow checks pass. Parent inspected dialog/current/cleared states; inaccurate retained-password wording was corrected and evidence regenerated. No material unresolved scoped visual difference.

## Boundary
M44 complete; final full-suite/joined import-correct-review checkpoint remains outer-owned UX7-INTEGRATED. No real external LLM qualification, SMTP deployment or live test-instance update is claimed. No confirmed out-of-area regression.
