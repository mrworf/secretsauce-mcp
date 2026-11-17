# M41 focused acceptance

Result: PASS for M41 only. Starting revision ceb68e0c20913149065ef9fe4e8e76b545fb7ece. Product UX7 and M41 contract govern; no deployment or whole-packet release claim.

## Acceptance mapping
- Exact readiness: backend tests cover missing credential, malformed URL, malformed policy regex, schema errors, missing value plus invalid placement, no credential value echo, and current active configuration preserved under incomplete draft. Browser shows only Authentication warning for the credential fixture, explicit Overview repair, highlighted missing value, and immediate removal after Set. Correction focuses Set value.
- Coherent guided journey: browser exercises four navigable sections for new/edit, Continue progression and actual New settings review; legacy section URLs normalize without dirtying; Advanced retains exact literals. No fifth placeholder is navigable.
- Overview/list: incomplete Overview offers exact repair and no review shortcut; ready Overview goes directly to reviewed New settings. List has Needs configuration without repeated credential instructions, with top-aligned filters. Active plus draft remains visible.
- Preservation: focused services/review/migration tests retain stale revision/generation/identity gates, durable audit admission, missing-value execution blocking, mapping resolution, default and exact-literal semantics. Browser retains Owner editing, Auditor readonly, Member denial, actual Back/Forward, dirty Stay/Save/Discard, delayed-read fencing, policy tester, exception acknowledgment and session-loss clearing. These are focused preservation checks, not a new broad security audit.

## Reproduction and results
`npm run build` PASS. `npx vitest run test/console-services.test.ts test/console-service-navigation.test.ts test/console-service-review.test.ts test/console-migration.test.ts --maxWorkers=2`: 44 passed. One subsequently added missing-value-plus-placement test passed with all 15 service tests (45 distinct focused tests). No assertion/timeouts weakened.

Run isolated synthetic HTTPS browser harness using Playwright 1.64 container, repository mounted at /work, command `node scripts/verify-console-navigation-browser.mjs`, environment `CONSOLE_BROWSER_EVIDENCE_DIR=evidence/ux-acceptance/secretsauce-mcp/milestone41`. It creates disposable state and certificate, never mounts local review-instance state, and suppresses request call logs. Final browser-report.json is PASS. Final backend-only diagnostic dedup was covered by focused tests after browser qualification; it changes no rendered successful fixture state.

## Visual inspection
Actual images were opened and inspected, not merely generated. Compared services desktop and 390px list against feedback-003 services-desktop/narrow; policy desktop against freshly rendered reference-policy-desktop at 1440x1031; reviewed missing-credential desktop and 320px 200% text, actual review desktop, and parent independently inspected incomplete Overview. Layout retains wide content, compact cards, orange actions/selection, subdued neutral background, visible status and sensible spacing. At 390px rows stack and preserve actions; 320px text enlargement wraps without document/text-range overflow. Yellow marker includes accessible Needs attention label and local status text. Current UX7 explicitly supersedes old reference fifth/sixth sections, redundant list blocker text and filter misalignment. Different fixture counts/content explain height differences; proposal-only header banner is absent in product. No material M41 visual deviation found.

## Boundary
Imported mapping and stale/audit failures have focused provider test coverage; this browser run did not reenact every import failure or every durable storage fault. Full project regression, joined M41–44 journeys and broad shared-pattern terminal checks remain UX7-INTEGRATED, owned by outer orchestration. Settings/export/SMTP changes and deployment are outside this slice.
