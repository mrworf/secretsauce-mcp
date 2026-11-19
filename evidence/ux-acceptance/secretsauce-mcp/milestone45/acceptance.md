# M45 acceptance — consistent editing actions

M45 scope only, UX8 / REC-RM-048–050. No deployment or M46 behavior changes. One coherent slice retains the existing mutation and authorization contracts.

| Contract | Evidence |
|---|---|
| One persistent editable Settings footer; no duplicated global pending banner | Populated Settings browser: all six sections; unchanged controls disabled, one footer; saved and unsaved review through the same footer; desktop/narrow images. |
| Accurate discard/save/review scope, all forms retained | Discard Cancel preserves edits; Discard unsaved restores current values; saved-discard confirmation preserved. Health saves two forms together. Partial failure retry refreshes dependencies; stale apply rejected; lost reply reports unknown then durable reopening. Immediate registry action separately guarded. |
| Named bordered credentials and clear value/removal semantics | Service browser: populated key plus missing second credential, Add focus, removal of second configuration leaves stored first value untouched; version/actor metadata and distinct value actions visible. |
| Complete concise policy and access wording | Policy explanation beside default at desktop, below on narrow; five facts once and short reorder help. Service access grant/cancel/stale/unknown/read-only checks pass. Existing policy dialog suite covers exact values, custom methods, invalid input, override preservation, stale/unknown and authorization. |
| Responsive and keyboard behavior | Actual 1440/390/320 images and 320px enlarged text inspected. Document and text-range overflow checks pass. At 320px/200% every visible enabled Email control is focused and its rectangle must fit above the fixed footer. Dialog focus/Escape/return focus preserved. |

## Executed checks

- `npm run build`: PASS.
- `npx vitest run test/console-settings.test.ts test/console-services.test.ts test/console-services-http.test.ts test/policy.test.ts --maxWorkers=2`: 40 tests / 4 files PASS. Initial sandbox loopback EPERM was rerun with permission, unchanged assertions.
- `verify-console-populated-settings-browser.mjs`: PASS; `settings/populated-settings-browser-report.json`.
- `verify-console-service-help-browser.mjs`: PASS; `services/browser-report.json`.
- `verify-console-policy-dialogs-browser.mjs`: PASS; `policy/browser-report.json`.

Browser invocation (each scenario uses an independent disposable HTTPS fixture):

```sh
docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work \
  -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone45/settings \
  mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-populated-settings-browser.mjs
```

Use `services` / `verify-console-service-help-browser.mjs` and `policy` / `verify-console-policy-dialogs-browser.mjs` for the other reports. No live instance mounts or real downstream calls.

## Visual review and limits

Compared with the active UX8 shared-pattern requirements and retained approved visual family: white bordered surfaces, warm primary action, named grouped cards, existing shell and responsive density retained. Independent visual review found squeezed narrow credential/policy actions; these now stack. Configuration removal is a contextual text action. Full-page screenshots include the viewport-fixed footer at its capture position; explicit focus geometry checks establish reachability rather than assuming a static image proves it. No clipped text/range or horizontal overflow accepted.

No backend transport, persistence, policy algorithm or role change. SMTP Set/Replace stays staged, Clear independent; service values remain immediate. Existing focused state tests and populated browser preserve these boundaries. Full clean-source regression and joined UX8 qualification remain parent-owned after M46; this report does not claim remote ChatGPT/Codex qualification. Unrelated private/untracked files remain untouched.
