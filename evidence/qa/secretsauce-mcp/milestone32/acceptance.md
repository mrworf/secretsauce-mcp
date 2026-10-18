# M32 acceptance — Service guidance and execution access

Authority: milestone32 / REC-RM-024; approved UX4, UX-IA10, UX-IN15/16, UX-C46/52. Parent df4206e; slice01 be330b2. Final slice SHA recorded by parent in plans. No milestone contract/source authority changed.

| Criterion | Current evidence |
|---|---|
| API docs/LLM and accurate matcher semantics | Local docs helper browser assertion, existing destinationHostHelp matches URL matcher exact/domain-boundary suffix/regex semantics; full existing destination tests retained. Operator help explains purpose. |
| Contextual placement, placeholder preview, visible generic hint | service-help HTTPS browser changes header→query→body→custom and returns through sections; preserves prefix/suffix; no inline secrets; generic hint visible without disclosure. Enforced header blank rejection and conditional required cue. |
| Fallback/reason/access distinctions | Policy helper states default only when no rule matches and both effects remain possible; unchanged rule explanation describes its decision. Browser verifies fallback help and proposed/current access text; policy-dialog regression exercises rule behavior. |
| Existing confirmed access vs initial proposed grants | Domain/HTTP and actual browser grant/remove, initial proposed selection remains non-executable; Owner/Administrator allowed, Auditor read-only, Member detail forbidden in existing coverage. Mapping never silently grants. |
| Local help/cues and advanced preservation | Associated helper IDs, context labels, required header only when enforced; browser generic exact literal retention and M30/M31 regressions; existing encrypted roundtrip tests preserve custom placement/method/options. |
| Positive/negative state boundaries | Strict malformed fingerprint/confirmation/input, Origin/CSRF, role demotion, generation stale confirmation, ineligible target; unknown admitted remove reply has no retry, failed/current durable inspection recovery. No secret echo or browser storage. |
| Actual visual/keyboard/responsive | [Visual review](../../../ux-acceptance/secretsauce-mcp/milestone32/visual-review.md), matching desktop/390px plus320px and all computed text200% document/range checks. Keyboard focus trap and Cancel/Escape. |
| Independently observable checkpoint | All behavior runs before M33/M34; no tester/history work, deferred behavior, live deployment or Docker mutation. |

## Validation

- `npm run build`: PASS (final source).
- Focused `npx vitest run test/console-services.test.ts test/console-services-http.test.ts --maxWorkers=2`: 16 tests /2 files PASS. Earlier slice header boundary coverage: 18/3 PASS.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-service-help-browser.mjs`: PASS final source. New harness owns localhelp/access/malformed/stale/unknown/readonly/proposed/responsive/secret-free checks.
- M30 `verify-console-credential-dialogs-browser.mjs`: PASS final source with updated plain Add credential selector (evidence /tmp/m32-credential-regression; report copied alongside this file).
- M31 `verify-console-policy-dialogs-browser.mjs`: PASS; later changes only Add credential label and Access success-banner reset do not affect rule behavior (evidence /tmp/m32-policy-regression; report copied).
- `npm test -- --maxWorkers=2`: **751 tests / 74 files PASS**, 105.84s; final source, no concurrent browser/Docker.

Browser test listeners required permitted loopback after initial sandbox EPERM. Full suite runs alone with two workers; no browser/Docker overlaps. No transport/container implementation changed: no new self-signed downstream or Docker drill required here; existing suite transport tests and M34 integrated operational gates remain. All runtime fixtures synthetic/disposable. Actual external ChatGPT/Codex connection exception unchanged; this is not real-client validation.

## Compatibility and limitations

UI confirmations always carry a fingerprint binding service revision, assignments, values/draft state and identity eligibility/generations. The command retains legacy callers without optional fingerprint, with unchanged authorization, explicit confirmation, membership/eligibility and audit controls; no new unconfirmed path. Missing/wrong dependencies reject before mutation. This UI does not infer success from dialog closure. Archived/disabled assignment maintenance does not activate a service. Last-successful credential attribution and format5 mutation machinery are untouched.
