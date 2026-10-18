# M33 slice 01 — browser context

Goal: Back/Forward, direct links and refresh identify service, detail tab, configuration section and global mode without manufactured edits or loss of safe current work.

Scope: service route/history helpers, authenticated initial route and service-specific popstate handling; existing editor guards and readonly routes. Excludes global routing redesign and policy dialog (slice 02). Depends on completed M27/M31/M32.

Behavior: list/detail/editor transitions record location-only history. Same-editor history keeps the current object and exact advanced text. Leaving dirty work offers Stay/Save draft/Discard; Stay restores the previous history position, success continues the pending location. Invalid routes fail clearly, without mutation. Initial/deep links recheck server permissions and use saved state; refresh never promises persistence of unsaved work. Readonly users reach allowed views, Members cannot inspect editor. Destination subeditor changes must be kept or canceled before leaving their context. Session loss clears restricted work.

Surfaces: consoleServicePage, consolePage, tests and browser harness. No backend authority changes. No credentials/configuration in browser history or storage.

Validation: focused console tests and actual HTTPS browser positive history/deep-link/refresh, exact Advanced preservation, dirty stay/discard/save, malformed/unauthorized paths, readonly and session loss. Full suite at milestone completion. Commit only after current slice evidence passes; record commands/results below.

Delivered: location-only indexed history with safe bounce to the originating entry for dirty guards, authenticated direct routing, readonly section routing and exact Advanced representation retention. Navigation invalidates outstanding reads before route loading so an older page cannot overwrite the destination. Refresh restores saved state, not unsaved edits. Existing focused browser fixture now explicitly opens Services after reload where its scenario needs the list.

Validation: `npm run build` PASS; `npx vitest run test/console-advanced.test.ts test/console-history.test.ts test/console-service-runtime.test.ts --maxWorkers=2` PASS (35 tests); `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-navigation-browser.mjs` PASS; focused-service browser regression PASS (output /tmp/m33-focused-regression). Local listener EPERM was resolved by rerunning with local network permission; no assertions/timeouts weakened. Parent records slice SHA. Full milestone suite remains slice 02 boundary.

Accepted commit provenance: `cf543659067029d3a83ffb74edb5de066fcf4721`.
