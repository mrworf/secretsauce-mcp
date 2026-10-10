# M11 slice 03 evidence

Final commands: `npm test` — 427/427 passed across 41 files; `npm run build` passed. First full-suite attempt hit sandbox `listen EPERM`; reran the identical `npm test` with loopback/network permission. No listener tests were weakened. The suite includes actual self-signed HTTPS `tls.verify:false/true`, canonical percent/path rejection, tolerant JSON source-range preservation, binary/Base64, cookies, header ownership and stateless MCP.

`PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-m10-browsers node scripts/verify-console-services-browser.mjs` passed seven check groups on actual local HTTPS using the declared Chromium revision. The in-app Browser reported unavailable after required skill/bootstrap/troubleshooting checks; the declared standalone harness supplied rendered evidence. Browser report and PNGs are adjacent. First straightforward no-auth service completed through five keyboard-operated steps in 994ms in the recorded scripted sample. This is reproducible functional timing, not a human usability study or a universal speed guarantee.

`PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-m10-browsers CONSOLE_BROWSER_EVIDENCE=/tmp/secretsauce-m11-auth-browser node scripts/verify-console-browser.mjs` passed seven existing setup/auth/account/diagnostic check groups against the service-first shell. M10 evidence is preserved; this rerun's generated images are temporary.

New HTTP boundary tests exercise scoped sanitized operations, no session, encoded existing IDs and malformed escapes, Origin, CSRF, content type, bounded oversized bodies, unknown paths, current Owner/Administrator/Auditor/Member checks, write-only values and actor status lookup. New basic-policy tests use the actual backend destination resolver/evaluator to permit literal `/v1.0/[item]` and descendants while rejecting regex-like `/v1x0/i`, wrong methods and unrelated targets. Root review identified the original UI escape error; the final shared literal-prefix helper corrects it.

The strengthened runtime suite also verifies a successful unchanged-authority partial-body request using the same observation fixture as all three zero-I/O rejection cases. Disabled prototype-like service names permit safe value rotation/access removal without touching inherited functions.

## Observable UX mapping

| Check | Current rendered evidence |
| --- | --- |
| UX-C02 | `services-desktop.png`, `services-320.png`, `archived-filter-320.png`: compact aligned desktop summaries, stacked narrow records, search/Archived filtering and independent lifecycle/draft/exception labels |
| UX-C03 | `details-*`, `destination-*`, `authentication-*`, `access-policy-*`, `review-*`; keyboard Back retains entered non-secret fields |
| UX-C05 | `applied-and-draft.png`, `review-desktop.png`, `review-320.png`: exact scope/base, Current/Proposed, initial grants, exceptions and disruption; existing applied state remains separate |
| UX-C06 | `stale-comparison-320.png`: real concurrent disable produces focused sanitized comparison and explicit reload/review |
| UX-C07 | `disable-confirmation-320.png`, `disabled.png`, `archived-filter-320.png`, credential images: target-specific immediate actions, cancel/focus return, no draft-undo implication |
| UX-C08 | `credential-dependency-320.png`; unarchive is Disabled and requires explicit current configuration review; last-Owner protection remains M10 and is exercised by the full suite |
| UX-C10 | `credential-metadata-320.png`, `destination-variants-*`, `variants-review.png`: cleared value fields, version availability, inherited/override TLS, broad/cleartext/disabled-TLS acknowledgments and best-effort/trusted-admin limitations; API/projection tests verify secret omission |
| UX-C15 | `stale-comparison-320.png`, `credential-dependency-320.png`, `read-only-outage-320.png`: safe next steps; operation loss/uncertainty and current permission paths covered by management/runtime tests; unsaved Stay/Discard exercised in browser |
| UX-C20 | All `*-320.png` have actual no-horizontal-overflow checks with account/logout and actions retained |
| UX-C21 | Every recorded flow completes by Tab/Enter/Space/Arrow keys; native dialog trap/cancel/focus return, current sections/navigation, labels, focused errors and status regions exercised |
| UX-C22 | `services-desktop.png`, `grouped-editor-desktop.png`, `grouped-editor-320.png`, review/confirmation images retain the approved restrained hierarchy and direct existing-service grouped editing |
| UX-C25 | `browser-report.json` records the first straightforward five-step setup sample at 994ms, below 15 minutes; investigation/user-disable timing belong to their later milestones |

No production release, real external client acceptance or human usability study is claimed at this intermediate milestone.
