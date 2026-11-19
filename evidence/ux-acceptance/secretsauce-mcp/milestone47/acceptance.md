# M47 — Service editing, review and discard acceptance

Bounded M47 acceptance under UX9 / UX-C79–82, STATE-10 and SECRES-09. API/state slice f128e14; this UI slice also corrects the initial over-restrictive Archived-discard check: authorized proposal removal preserves Archived rather than requiring an unarchive lifecycle mutation.

## Delivered behavior

Four service tabs share the readable name, Active/Inactive/Archived state and separate saved Draft marker. Configuration summarizes child blockers. New/existing Guided and Advanced use direct sections and the persistent white Settings-style Discard / Save for later / Review changes footer. Internal redundant Services links and stepwise Continue/Back are removed; specialized destination navigation remains.

Actual grouped review opens incomplete proposals without activation authority, defaults to New settings, keeps Changes and exact focused repair links, and disables approval until validated. Empty access is valid and explicitly grants nobody access. Saved discard retains independent values/current grants/configuration and readable never-active identity. Its generation floor survives removal/recreation and portable recovery; v6 rejects pinned prior v5 readers. Never-saved abandonment creates no record. Archived proposal discard is reachable without edit/apply controls.

Navigation Save is awaited and failure preserves input. Current dependency metadata refreshes after save. Additional edits made during an outstanding save remain dirty. Blank guided destination fields serialize as the existing omitted partial field; explicit Advanced literals are not silently rewritten. Settings and SMTP timing behavior are unchanged.

## Validation

- `npm run build` — PASS.
- `npx vitest run test/console-services.test.ts test/console-services-http.test.ts test/console-service-discard.test.ts test/console-service-navigation.test.ts test/console-service-review.test.ts --maxWorkers=2` — 38 tests PASS.
- Slice 1 service/HTTP/discard plus restore-install/restore-recovery — 52 tests PASS; portable backup suite — 22 tests PASS. Includes role/CSRF/input rejection, stale ABA, unrelated draft preservation, audit admission failure/unknown completion, restart, portable metadata validation and actual pinned prior-reader rejection.
- `docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-service-editor-browser.mjs` — PASS. Disposable synthetic HTTPS server/store, no external service or credential use. Browser report contains bounded checked states.

Inspected actual desktop1440, narrow390/320 and 320px/200% screenshots against the inherited approved feedback003 Authentication and feedback007 Settings footer family, with UX9 delta precedence. Layout, warm palette, width, card hierarchy, labels and controls remain coherent. Both producer and parent independently inspected populated states. Text ranges and document width fit. Every visible enabled form input/select/textarea/button, including Set value, is focused and its viewport bounds verified above the fixed footer at 320px/200%. The browser caught and drove correction of native select focus hidden behind the footer; full-page screenshots alone were not used to prove clearance.

The harness also exercises all four service headers; incomplete review/precise repair; successful and rejected guarded Save/reopen; unsaved discard; named saved-discard Cancel/success; retained identity/value; fresh setup without resurrection; never-saved abandonment; zero-access apply; Active preservation; Archived-only discard; and Advanced reflow.

## Boundary

No M48 import changes or deployment. No complete-suite or whole-product visual certification; unseen states remain outside this bounded evidence. Parent owns final frozen integrated M47–48 full-suite qualification and durable milestone status.
