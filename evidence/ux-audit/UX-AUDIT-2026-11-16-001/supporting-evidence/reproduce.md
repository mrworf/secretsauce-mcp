# Reproduction

Build current candidate with `npm run build`. Run each existing harness with read-only repository and audit-only write mount. Commands use disposable stores; no live data.

```sh
docker run --rm --ipc=host --mount type=bind,src=/home/ha/projects/secretsauce,dst=/work,readonly --mount type=bind,src=/home/ha/projects/secretsauce/evidence/ux-audit/UX-AUDIT-2026-11-16-001,dst=/artifacts -w /work -e CONSOLE_BROWSER_EVIDENCE_DIR=/artifacts/screenshots/settings mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-populated-settings-browser.mjs
```

Repeat with output navigation and script verify-console-navigation-browser.mjs; output approval and script verify-console-approval-browser.mjs. All three PASS. No modifications to harnesses. Container loopback hosts synthetic HTTPS server and browser. Secret-safe failure reporting preserved. npm build PASS. Browser version queried through chromium.launch()/version(). First direct executable wildcard query failed because exec did not expand a shell glob; API query succeeded. No product issue.

## Targeted audit extensions

Run the same pinned Docker command with node `/artifacts/supporting-evidence/focused-capture.mjs` and screenshot directory `/artifacts/screenshots/focused`; then remaining-capture.mjs with directory remaining. These retain navigation fixture setup and cleanup. First run captured seven states before a wrong auth route stopped it; remaining run corrected that route and passed. Synthetic missing-value draft was seeded via ConsoleServiceManager.save; no import flow or real credential was used.
