# M31 — Focused policy rule authoring

Parent: `4b76b3f2ac9ba733cdd6a10963551570ebad44ef`. Product: secretsauce-mcp.
Authority: milestone 31, REC-RM-023, POLICY-01/02, UX-IN16/C49 and approved UX4 policy/rule-dialog references. Source d0dffc6; planning 49a58c3. Preexisting unrelated path: test-results/ (preserved).

## Slice index
1. [Shared rule authoring dialog and effective-order list](milestone_31_plan_01_slice_01.md). One coherent authoring transaction; no independently useful backend layer is needed.

## Validation and scope
Existing service save remains the authorization, generation, audit and persistence boundary. Rules change only the in-memory proposal until explicit Save draft and review/apply. Preserve exact imported IDs, regexes, custom methods and advanced scanner/binary settings; no evaluation algorithm changes. M32 broad help, M33 tester/history and M34 integrated operational drills remain separate. No transport/container changes or live deployment.

Required final checks: focused rule tests; HTTPS browser positive/negative authoring and save boundary checks; matching UX4 screenshots, keyboard/390/320/200% text; affected services/friendly-form browser regressions; `npm test -- --maxWorkers=2` and build without browser/Docker concurrency. Record final hashes and acceptance map. Root records final commit SHA and milestone status.

Status: implemented and validated; parent records final slice commit after acceptance.

## Delivered validation
Shared authoring dialog and effective-order list delivered. Focused 32 tests passed; final full suite 749/749 across 74 files and build passed. HTTPS M31 authoring browser and affected service/friendly-form regressions pass. Final narrow CSS correction separately covered by final browser/build; no unrelated retest. See [acceptance](../../../evidence/qa/secretsauce-mcp/milestone31/acceptance.md), final source hashes and visual comparison. No new durable AGENTS lesson; existing browser-concurrency and text-range checks followed. Commit SHA is recorded by the parent after this single slice commit.
