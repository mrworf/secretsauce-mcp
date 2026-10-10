# M15 slice01 validation

Parent d24d5f66832be2f44d7aef8ee8ccfde17e7537fb. Scoped Activity, bounded exports and reviewed retention.

- `npm test -- test/console-evidence.test.ts test/console-evidence-http.test.ts test/audit.test.ts test/console-admission.test.ts test/console-http.test.ts`: PASS33tests/5files; pretest build PASS. Initial related test loopback EPERM was environmental; identical command rerun with loopback permission. Latest verification includes bounded verification-loop deadline checks.
- New cases: valid/invalid time/type/count/unknown/prototype/duplicate filters; foreign Member actor/service/detail/export; target is not acting identity; Origin/CSRF; one10k-record snapshot/max500rows; filter and injected label secret sanitization; role change at admission; Auditor export/no Owner mutation; degraded/tampered disk denial;365day defaults; stale review/role; preserved unresolved starts/live revocation intents; signed redo recovery after prepared/partial chain replacement; raw-digest compaction restart integrity.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-m10-browsers node scripts/verify-console-operations-browser.mjs`: PASS4groups actual synthetic HTTPS, keyboard-only actions and320CSSpx reflow. [Report](browser-report.json), filtered Activity/retention review/read-only role/outage screenshots in this directory. Credential inputs/seeds/proofs masked; no persistent browser application storage.
- Visually inspected activity-filtered-320.png: calm grouped filters, readable labeled cards, visible focus, no horizontal overflow, account/logout/export actions retained. Denial investigation time is recorded in browser-report.json and is below120seconds.

Full milestone suite/build and final limits/health/Docker/envelope coverage belong to remaining slices. Real ChatGPT/Codex LLM connections NOT RUN under the explicit local-validation exception. Backup/restore provider remains pending M16/17.
