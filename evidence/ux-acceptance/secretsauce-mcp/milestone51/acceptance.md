# M51 focused milestone acceptance

PASS on core commit `a457bca` plus the exact UI/harness hashes in ui-source-revisions.json. Core focused32 tests and M50 cleanup13 passed; see core-acceptance.md. Build passed. The isolated HTTPS Docker browser harness passed on the final source, including retained shared service/recovery journeys and new Archived deletion cases.

New browser coverage: direct Archived Overview entry, rapid double-open remains one dialog, exact typed text (extra space rejected), Cancel/Escape restores opener, stale lifecycle refuses deletion and disables resubmission, successful list deletion returns Services and removes only the target, committed truncated response remains unknown until current-state inspection, Auditor lacks destructive controls. At320/200% each dialog input/button is focused and checked within the modal bounds; document/text-range overflow checks remain enabled.

Actual desktop1440,390,320 and320/200% screenshots were inspected against the existing approved dialog/control family and UX10 deletion delta. Short Delete service title, one required legend, readable target/consequences, distinct destructive action and preserved retained-history warning match. The focused enlarged-text viewport demonstrates the field and both actions are reachable rather than certifying only the modal top. Stale and unknown outcomes are separately captured.

Fixture corrections retained assertions: stable direct Overview entry avoids an outstanding prior saved-discard render replacing the opener; truncated committed JSON response models an unknown outcome without Chromium socket retry; no request logs or credential data are emitted. Opening is reserved before the asynchronous detail read and rechecked afterward.

Command: `docker run --rm --user 1000:1000 -v /home/ha/projects/secretsauce:/work -w /work -e CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone51/browser mcr.microsoft.com/playwright:v1.64.0-noble node scripts/verify-console-service-editor-browser.mjs`.

No live instance was changed. All browser/container workloads ended. Parent-owned UX10-INTEGRATED frozen-source full regression and actual clean-host Docker recovery remain pending at this companion checkpoint; this report does not claim those gates passed.
