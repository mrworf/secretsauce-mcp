# M20 acceptance evidence

Actual isolated HTTPS Chromium used synthetic example.org certificates and loopback mapping. No user instance, real SMTP recipient or external LLM integration was used. Protected browser fields were masked in screenshots; no browser storage was used.

| Milestone criterion | Concrete evidence |
|---|---|
| 1 Exclusive global current location including Services/account | focused-settings-browser-report.json: Owner routes plus role matrix; one current primary element and visible non-color cue |
| 2 Service tab/section selection retains parent | focused fixture: every detail tab and configuration section current selection; Services parent retained; advanced regression preserves editor workflows |
| 3 Focus distinct from selection; 320px/enlargement | Every Settings destination and combined review checked at 1280/320px and 200% text, document width plus text ranges; keyboard fixture and selected accent/border/underline; focused-settings.png |
| 4 Unauthorized affordances/direct routes | Owner/Administrator/Auditor/Member matrix; Member no Settings; backups hidden and direct HTTP403 for non-Owners; invalid section route rejected |
| 5 Six focused destinations and reachable tasks/back | Selected-only panel, desktop current-page links, narrow labeled select, URL deep link/back; backups, restore-preview/recovery and operations regression reports |
| 6 Unsaved Stay/Save/Discard | HTTPS branches preserve input on Stay, persist only draft on Save, discard only current edits while saved Email remains; summary and no browser storage assertions |
| 7 Authorized label/help/alias search | Search limits metadata jumps/discloses/focuses exact field; no-match and clear retain section; role-filtered static catalog excludes Owner registry/backups for other roles; no values indexed |
| 8 Cross-section error and exact atomic review | HTTPS stale Email link focuses Email input while saved Limits/Email persist; two-section review names exact scope and applies both. console-settings.test.ts all-six success, Administrator-only scope, changed dependency/base/draft/role/SMTP credential version, expired/session-mismatched review, conflicting scanner fields and malformed input reject without partial apply |
| 9 Failure-safe responsive states | HTTPS offline read error/current navigation recovery and malformed review; direct audit/prepare failures no applied mutation; uncertain completion publishes complete persisted state and throws unknown; backup audit degradation/unknown outcome and recovery maintenance regressions. Secret inputs cleared on failure, safe persisted drafts retained |

## Commands and outcomes

- `npm run build`: PASS.
- `npm test`: PASS, 71 files / 662 tests. Initial sandbox run hit listener EPERM; reran unchanged with authorized loopback permission.
- `npx vitest run test/console-settings.test.ts`: PASS, 11 tests.
- Related operations/notifications/evidence/settings run: PASS, 47 tests at earlier 10-test Settings revision; new expiry/session/base case then passed and was included in final full suite.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-focused-settings-browser.mjs`: PASS; direct final report alongside this file.
- Retained SMTP deletion, backups (7 groups), operations/health (6), recovery (4), clients/authentication (5), advanced scanner/service (6): PASS, copied sanitized reports alongside this file. Temporary fixture directories were removed by their harnesses.

## Implementation decisions and limits

One bounded in-memory review per session expires after five minutes and is invalid after restart. Its fingerprint includes current configuration, draft generations, authority and relevant dependency state; raw secrets are never returned. Owner review includes all saved domains, Administrator protection only, and service drafts stay separate. Domain schemas/candidate preparation remain shared with established managers. One encrypted configuration commit precedes runtime publication; live pools/limiters remain intact. Retention cleanup follows that commit with its own truthful outcome. A retention draft records applied days so an unrelated draft save does not invalidate it, while changed retention still requires correction/review. Existing individual APIs remain compatible; the web interface offers one full-scope review.

M21 friendly form expansion/import is intentionally excluded. Existing external ChatGPT/Codex validation exception remains NOT RUN; no release, deployment or independent audit is claimed.

Additional retained actual HTTPS evidence: preview/restore clean-host flow PASS (4 groups, preview/browser-report.json), assisted reset PASS (33 checks, assisted-assisted-reset-browser-report.json). Historical M17 preview captures were restored unchanged; new captures belong to this milestone. Final focused fixture explicitly covers all four service tabs, all four configuration sections and expired-session denial.
