# M33 delivery plan — service navigation and policy testing

Parent: `f12be0eb43b5978a08e349f2e635fa84c52d0c51`. Source definition `d0dffc6`, planning `49a58c3`. Scope and acceptance: [M33](../../milestones/secretsauce-mcp/33-service-navigation-and-testing.md), approved UX4 UX-IN15/16 and UX-IA10. Prior untracked `test-results/` is excluded. No product decisions remain open.

## Slice index
1. [Browser context and guards](milestone_33_plan_01_slice_01.md).
2. [Focused policy tester and shared settings](milestone_33_plan_01_slice_02.md).

Use existing authenticated routes; do not persist draft contents or secret values in history/storage/URLs. Refresh restores the authorized location and saved state, with browser unload protection for unsaved work. History within an editor preserves its in-memory exact work. Leaving uses existing explicit stay/save/discard semantics. No global router redesign.

Final acceptance requires focused positive/negative tests, actual HTTPS browser history/modal/reflow tests with approved-reference comparison, full `npm test -- --maxWorkers=2` and build with no concurrent browser workload. Parent records exact slice SHAs and milestone status. Evidence under `evidence/qa/secretsauce-mcp/milestone33/` and `evidence/ux-acceptance/secretsauce-mcp/milestone33/`.
