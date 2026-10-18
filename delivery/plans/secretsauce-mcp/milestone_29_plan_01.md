# M29 — Durable credential clearing

Parent: 95b1415. Source: definition d0dffc6; planning 49a58c3. Scope is the immutable M29 contract, STATE-09 and SECRES-08. Pre-existing untracked `test-results/` is excluded.

## Slice index

1. [Durable immediate credential mutations](milestone_29_plan_01_slice_01.md): one coherent vertical slice. Missing state, confirmation, fencing, attribution, persistence and UI cannot safely ship separately.

No product decisions remain. Investigate existing journal replay, admission and backup schema before editing. Preserve SMTP and existing live runtime instances. Root owns milestone status and final commit provenance.

## Validation

Focused service/storage/gateway/backup tests during implementation, real HTTPS browser against approved clear-dialog and authentication references including keyboard/narrow/200% text, prior-reader compatibility and fault/restart tests. Final `npm test -- --maxWorkers=2` and `npm run build` without competing browser/Docker workloads. Evidence in `evidence/qa/secretsauce-mcp/milestone29` and `evidence/ux-acceptance/secretsauce-mcp/milestone29`.

## Completion

Slice 01 delivered and verified: 748 tests across 74 files passed (106.96s), build passed, final real HTTPS browser and matching visual evidence passed. Frozen tested inputs matched after validation. See [acceptance](../../../evidence/qa/secretsauce-mcp/milestone29/acceptance.md) and [visual review](../../../evidence/ux-acceptance/secretsauce-mcp/milestone29/visual-review.md). Root records the resulting slice commit SHA in its acceptance closeout.
