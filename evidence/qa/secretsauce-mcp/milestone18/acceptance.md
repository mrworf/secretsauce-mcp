# M18 acceptance evidence

Scope: M18 only, REC-RM-003 / SECRES-T08–11 plus retained invitation, existing-factor recovery and audit gates. Synthetic isolated local state; no running user instance or real mail recipient used. Evidence is implementation validation, not independent release approval.

## Acceptance mapping

| Milestone criterion | Direct evidence |
|---|---|
| Owner/Administrator eligible target matrix; no general administration expansion; hostile inputs | `test/console-assisted-resets.test.ts` role matrix and disabled/invited/unreviewed/external/contact/confirmation cases; `test/console-people-http.test.ts` four-role direct endpoint matrix; actual HTTPS browser Owner→Owner and Administrator→Administrator/Auditor/Member, both purposes; Auditor/Member controls absent |
| Password issuance leaves access intact; factor-confirmed single completion retains MFA and revokes access | Assisted-reset TOTP/recovery tests assert session remains at issuance, factor required, password changed, seed retained, used code consumed and replay denied; managed OAuth test checks old JWT remains usable after issuance then JWT/refresh/reference/in-flight response are denied after completion; browser normal login follows |
| MFA immediate restriction, new factor only, preserved password, both-lost sequence and abandoned restriction | Assisted-reset MFA tests assert empty old seed/codes and unchanged password, reject password input, require fresh enrollment, then new password proof; expiry/cancel/reissue tests; browser runs MFA then password for each eligible target, checks unchanged password and ordinary login; SMTP failure remains restricted |
| Current issuer/target authority, natural issuer session expiry and Owner continuity | Unit tests reject issuer role/generation drift, target promotion/generation drift and invalid lifecycle; session removal alone permits completion; concurrent Owner restriction test succeeds once and subsequent final Owner demotion fails; existing people last-Owner role-race tests retained |
| Wrong bindings, replay, audit/uncertain persistence and old authority cannot restore access | Existing recovery tests wrong purpose/target/instance/expiry/replay; added code/factor failures and completion replay; direct OAuth tests deny old JWT/refresh/reference/response completion and JWT signing race; real atomic before/after-rename injection for both reset purposes verifies restart fencing; first format-migration failure admits no reset; audit outage blocks mutation; audit text excludes proof/password/seed/factor |

## Commands and results

- Focused: `npx vitest run test/console-assisted-resets.test.ts test/console-assisted-reset-oauth.test.ts` — 21 tests passed.
- Related people/recovery/HTTP, restore-install and managed OAuth regressions passed; direct HTTP tests use authorized loopback permission.
- Canonical final suite: `npm test` — 69 files / 641 tests passed, 42.48 seconds; same full suite with authorized loopback permission.
- `npm run build` — passes (also canonical npm test pretest).
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-assisted-resets-browser.mjs` — 33 actual HTTPS Chromium checks passed; report `assisted-reset-browser-report.json`. Keyboard-only reset interactions, desktop/320 CSS px and 200% text with document plus text-range checks, both recipient flows, normal login, empty browser storage, immediate fragment removal, manual delivery and synthetic SMTP failure.
- Retained browser: `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers CONSOLE_BROWSER_EVIDENCE_DIR=/tmp/secretsauce-m18-people-browser node scripts/verify-console-people-browser.mjs` — 8 checks passed; invitations for all roles, same-tab capability capture, self-service factor/recovery-code flow, cancel-focus return, scoped shell and SMTP failure. Sanitized report copied here; older milestone evidence unchanged.

## Review and limitations

Masked screenshots `factor-enrollment.png` and `smtp-reset-failure.png` were visually inspected. Provisioning image, seed, recovery-code block and password fields are masked in screenshots; no raw credentials/proofs retained in this evidence. Local TLS uses `example.org` resolver mapping. Gateway downstream transport was not changed. Actual ChatGPT/Codex external connection remains the previously declared external exception and is not claimed as tested. No Docker change required. No product decisions or local acceptance blockers remain.

The local encrypted state format becomes v2 before reset authority is admitted. Old binaries fail closed; do not downgrade encrypted snapshots. An unpublished security write is resolved into restricted recovery on restart; already-published generations never roll back. Operator guidance and AGENTS.md document this invariant.
