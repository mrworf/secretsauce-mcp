# M25 acceptance evidence

Scope: REC-RM-015, MIGRATE-01/02, UX-IA10/C51; no activation, implicit grant or live deployment.

| Requirement | Evidence |
|---|---|
| Original subject, exact source index, affected services; in-place recovery | `test/console-migration.test.ts` multi-service/two-subject correction; actual HTTPS browser journey and screenshots. Legacy drafts without indexes show the honest containing field. |
| Partial correction, unrelated safe work, no assignment bypass | Migration test saves unrelated description and explicit proposed assignment, confirms both blockers remain, resolves one then the other; second service is untouched. Browser preserves edited description through the journey. |
| Eligible exact targets and fresh authorization | Tests reject unknown/duplicate/malformed/ineligible/wrong-issuer targets, stale revision/generation/security generation, Auditor mutation and Member inspection. HTTP tests cover Origin/CSRF, current role, repeat stale correction and fresh review. Revoked mapped target can be explicitly replaced and its obsolete proposed grant removed. |
| No host reads, unsupported-field loss or secret output | Existing migration tests retain no-read source paths, advanced regex and scanner semantics, dictionary-edge identifiers and sanitized errors/export. Correction changes only source mapping metadata and new-service proposed access. Existing-service live assignments and values remain unchanged. |
| Durable admission and uncertain result | Audit start failure leaves generation unchanged; completion uncertainty preserves the actual committed mapping and exposes remaining issues without claiming activation. UI requires current status inspection before retry. |
| Portable schema | Projection validation retains bounded original subject/index/target metadata and rejects malformed exact-issuer provenance. Existing complete backup-domain tests pass. |
| Actual UX and accessibility | `evidence/ux-acceptance/secretsauce-mcp/milestone25/visual-review.md`, screenshots and browser report; 1440/390/320 CSS px and all computed text doubled. |

Validation record is finalized in the slice plan. Automatic full-suite concurrency hit the existing 5-second backup-generation test timeout (first with Chromium concurrently, then without it), followed by cascading backup-file failures; a gateway timing test also failed in the second attempt. The isolated backup file passed all 22 tests, then the backup/gateway subset passed all 57 tests with two workers. The complete suite subsequently passed 728 tests in 73 files with `npm test -- --maxWorkers=2`, without altering any assertion or timeout. Final validation repeated that bounded full command after the last archived-view/selection-preservation corrections and without concurrent browser work: all 728 tests in 73 files passed in 105.59 seconds, including the build. No tests were weakened.

Environment: Node v26.11.1; locked project dependencies; self-signed disposable HTTPS browser fixture. No downstream transport change, live container/volume mutation, deployment or actual external LLM connection. Gateway protocol compatibility remains covered by the full suite; external-client evidence is not claimed.
