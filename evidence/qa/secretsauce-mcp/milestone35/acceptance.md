# M35 acceptance

Scope: REC-RM-027, approved UX-DESIGN-005. Only service review presentation; existing inline acknowledgment/apply remains until M36. No live deployment or data changes.

| Milestone criterion | Evidence |
|---|---|
| Imported/bootstrap service edited Guided and Advanced; complete grouped proposal | Actual disposable HTTPS fixture: configuration adopted from legacy gateway configuration; Guided description then Advanced destination/custom method/regex/binary fields. Browser compares every rendered proposal literal against the reviewed candidate, including multiplicity. |
| Add/remove/change, exact types, no baseline/no change, identities/order | Eight focused tests; browser explicit typed/own-property boundary, no-baseline and no-change state. Unique IDs compare only same identity; replacement remains separately labeled removed/added; multi-item ordering is explicit, anonymous arrays remain ordered. |
| Immutable bound scope/grants/disruption and secret-free tabs | Browser compares managed snapshot before/after both tabs; credential value absent, no browser storage, no false dirty after Back. Context displays service name/base, affected service/settings, proposed initial grants where present, reference invalidation and admitted in-flight protection. No backend mutation implementation changed. |
| Actual desktop/narrow/text200/keyboard visual acceptance | Final browser screenshots and report under evidence/ux-acceptance/secretsauce-mcp/milestone35/final. Parent inspected paired changes and domain-specific New settings against approved feedback004 direction. |
| Existing apply/stale/permissions and round trips | Actual stale apply rejected after current acknowledgment, Auditor review rejected, full suite at final checkpoint. Existing inline server-bound apply unchanged; M36 owns new confirmation. |

Focused command: `npx vitest run test/console-service-review.test.ts` — 8 passing tests.
Browser command: `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers node scripts/verify-console-review-browser.mjs` — PASS. Loopback permission used after sandbox EPERM; assertions and timeouts unchanged.
Final full suite: **765 tests across76 files PASS** in113.91s; `npm run build` PASS. No concurrent browser/Docker workloads. Frozen executable hashes verified unchanged after completion.

See `tested-inputs.json` for exact final source/fixture hashes. All fixture domains are synthetic example.org. No saved credential values, cookies, authorization headers, review proofs or response bodies are included in evidence.

Limitations: Existing external ChatGPT/Codex client-validation exception retained; this presentation change makes no new interoperability claim. No API, storage format, credential lifecycle, transport or global Settings changes. Existing M34 operational evidence remains unaffected.

Validation provenance: an earlier broad run began before the final literal-Order edge-case repair. Vitest loaded the prior helper while later reading updated expectations, yielding two mixed-snapshot failures in the new test file; all other75 files passed. That run is superseded. Final focused8 tests and browser passed after the repair; executable source/tests/fixture were frozen and hashed before the final complete run. Synthetic order metadata is explicit, so literal IDs named Order retain their identity.
