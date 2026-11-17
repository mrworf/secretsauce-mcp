# M42 focused acceptance

PASS for configuration transfer tools. Starting revision b774bc4. Governed by current UX7 and M42; no deployment or whole-packet release claim.

## Delivered contract
Configuration tools downloads `gateway.yaml`, `secretlint.yaml` and `sensitive-names.yaml` via the existing audited export endpoint. The page explains matching import fields, missing credentials and review; it does not print YAML or suggest backup/authority restoration. History rendering/entry points are hidden; existing retained data, backend history and guarded reuse remain unchanged. Download controls disable during preparation, report download started rather than completed, and offer a safe retry on failure. Temporary Blob URLs are revoked.

## Verification
- `npm run build`: PASS.
- Focused migration/history/advanced suite: 38 tests passed. Added export role/audit regression: migration 20/20 passed, giving 39 distinct focused tests. Existing history coverage retains latest50, audit attribution, current dependencies, permission limits and no restored access/lifecycle/secrets. No backend changes.
- `CONSOLE_BROWSER_SCENARIO=transfer CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone42 node scripts/verify-console-advanced-browser.mjs` in Playwright v1.64.0-noble Docker: PASS. Synthetic HTTPS, ephemeral stores, no live instance mounts.
- Actual browser download events verify stable filenames; downloaded bytes are parsed and imported into a second isolated encrypted store through the existing importer. Destinations, custom identifiers, regexes, ordered methods, binary scan options, credential placement and both catalogs compare exactly. Secret source placeholders are converted by normal importer semantics. Imported service stays Draft, has no current assignment, and reports its missing credential; no automatic activation.
- Browser tests keyboard download, transient export failure/retry, current Member denial, malformed import preserving safe source context, absent history controls and desktop/390/320/200% text. Document and visible text-range overflow are checked. Errors suppress Playwright call logs. Files omit fixture secret values, source identity and bearer token.

## Visual evidence and corrections
Opened and inspected actual tools-desktop and tools-320-text200 alongside the current shared shell/card/button language represented by feedback003 services desktop/narrow references inspected in M41. Desktop uses current full-width shell and a restrained card; controls remain readable. Initial enlarged-text image squeezed download labels into narrow columns despite no overflow: fixed with dedicated stacked narrow controls and regenerated evidence. Final 320px enlarged text has full-width buttons with readable labels; no clipping. This is an in-scope layout correction, not an out-of-area regression. Configuration tools has no dedicated approved mockup; shared approved rules govern its composition. Parent also inspected desktop and narrow evidence.

Fixture failures were schema-invalid second-instance bootstrap metadata and stale setup revision after credential mutation; corrected fixtures without changing product validation. Initial status locator ambiguity corrected to the exact download-status region. No required assertion or timeout weakened.

## Boundaries
The dedicated transfer scenario is current M42 evidence; other historical scenarios in the advanced harness are not claimed as rerun. Second-instance roundtrip uses downloaded bytes and the actual importer/provider, not a second browser login. Existing provider tests cover invalid mappings, reviewed activation and credentials separately. Final joined M41–44/full-suite qualification remains outer-owned UX7-INTEGRATED; real external ChatGPT/Codex connection and deployment are outside this milestone.
