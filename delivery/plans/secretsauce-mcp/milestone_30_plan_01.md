# M30 — Focused credential value dialogs

Parent: 688c16fb7e1923288569809bfeec07a5576c46aa. Source definition d0dffc6; planning 49a58c3. Pre-existing untracked test-results/ is excluded. Contract: delivery/milestones/secretsauce-mcp/30-credential-value-dialogs.md. Product secretsauce-mcp; dependencies M27 and M29 accepted.

## Slice index

1. [Shared credential dialogs and attached metadata](milestone_30_plan_01_slice_01.md). One coherent vertical slice covers both consumers of the same write-only dialog, immediate command outcome recovery and repeated credential focus. No storage redesign or policy/help redesign.

## Validation

Focused service and browser tests; real HTTPS desktop, 390/320 width and 200% text, keyboard, stale/invalid/unknown/permission paths and approved authentication/replace/clear comparison. Final npm test -- --maxWorkers=2 and npm run build without concurrent browser workloads. Evidence under evidence/qa/secretsauce-mcp/milestone30 and evidence/ux-acceptance/secretsauce-mcp/milestone30. Root owns status and final exact commit provenance.

## Completion and evidence

Shared dialog, metadata, unknown-state lookup and new-row focus delivered. All eight M30 criteria mapped in [acceptance](../../../evidence/qa/secretsauce-mcp/milestone30/acceptance.md); matching approved-surface review in [visual review](../../../evidence/ux-acceptance/secretsauce-mcp/milestone30/visual-review.md). Full suite: 748/748 tests, 74 files, 106.48s; build PASS. New credential dialog browser and affected existing clear/services journeys PASS. No source change after full-suite validation; final hashes are in tested-inputs.json. Remaining background placement help belongs M32; M30 dialogs and metadata are complete. Root records exact slice commit in acceptance closeout.

Accepted commit provenance: `dede1136853e32456878dbc2c59f35e8afb73e54`.
