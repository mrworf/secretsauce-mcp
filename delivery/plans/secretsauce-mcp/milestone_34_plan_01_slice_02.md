# M34 slice 02 — Integrated browser and supported Docker acceptance

Outcome: complete M25–34 local journey and supported recovery are demonstrably usable and durable.

Depends on slice 01 and all accepted M25–33. Scope: extend isolated fixtures, fix stale selectors without weakening assertions, operator guidance and evidence; production repairs only for observed contract defects. No live review deployment/volumes or external client claims.

Entry/state: import→explicit mapping→Guided/Advanced→credential/policy→review/apply→lifecycle; archive post-clear then explicit restore retains missing/historical metadata and Disabled state. Owner authorization and negative Member/Auditor/stale inputs remain checked. Docker uses current immutable image and managed launcher with isolated mounts; SIGKILL and competing writer reject/recover under kernel leases. Faults preserve coherent prior or new state and local audit. No secret-bearing outputs.

Surfaces: scripts/verify-console-*-browser.mjs and recovery Docker fixtures as necessary; evidence/qa, evidence/platform, evidence/ux-acceptance/secretsauce-mcp/milestone34; docs/console-operations.md.

Validation: all new M25–33 actual browser suites, recovery state desktop/narrow/200% text/keyboard compared with approved UX4 authentication; encrypted current/legacy recovery Docker plus restart and competing writer; existing complete installer fault boundary checks. Finally npm test -- --maxWorkers=2 and npm run build without concurrent browser/Docker. Preserve local MCP protocol tests and documented external-client exception.

Acceptance: milestone criteria mapped to reproducible sanitized evidence, tested input hashes and immutable image ID; screenshots inspect width, hierarchy, density, spacing, typography and controls. No material unapproved drift. Commit fixture/docs/evidence/plan only after gates pass; root records final SHA and updates status.
