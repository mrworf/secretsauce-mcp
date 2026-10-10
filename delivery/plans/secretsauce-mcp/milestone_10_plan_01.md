# Milestone10: Establish secure audited console access

## Outcome
Host-authorized first Owner completes MFA, uses durable protected account access, and receives safe diagnosis when durable audit admission is unavailable.

## Delivery-goal context
Product secretsauce-mcp. Status delivery/milestones/secretsauce-mcp/status.yaml; active packet delivery/milestones/secretsauce-mcp/status.yaml and workflow/delivery-planning/handoff.yaml. Goal10–17 autonomous; this transaction10 only, new plan01. Source/planning provenance are recorded in the committed planning handoff. Parent c76de1e078f9091b3e9f012abd676ac0792d910c.

## Governing contracts and scope
Scope: exactly milestone10. Exclude invitations, recovery redemption, service editing, audit search/export, backup archive jobs and changes to MCP schemas. Parent transaction c76de1e078f9091b3e9f012abd676ac0792d910c; preserve untracked test-results and root-owned status.yaml. Authoritative contracts: delivery/milestones/secretsauce-mcp/10-secure-audited-setup.md, docs/web-console-prd.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, product/ux/manifest.yaml and referenced UX documents. One process owns encrypted state and audit storage. Synthetic credentials only in tests. Each new external input has positive/negative tests. Errors never echo secret inputs. Commit only slice-owned changes after focused validation; full npm test/build and rendered browser acceptance before milestone handoff.

## Current-state findings
Node26 local/Node22 CI; TypeScript NodeNext, native HTTP and vitest. Existing gateway is stateless, config immutable, audit has optional JSONL and fail-open behavior. No identity store or console exists. Baseline372 passing readiness tests; milestone must create current evidence. Root owns milestone manifest. No preexisting tracked changes.

## Decisions
Use native crypto (scrypt/AES256GCM/HMAC TOTP), encrypted atomic JSON snapshots with file+directory fsync, and synchronous single-process transaction admission. Persist write-only verifier material, sessions as hashes and encrypted TOTP seeds. Trusted console HTTPS origin is independent of inbound Host. Host CLI stores hash-only setup proof in protected directory; secret output only deliberate terminal action. Existing config remains explicit startup baseline until service migration in11, never silently fallback once managed marker exists. Journal uses chained authenticated records and fsync; committed operation starts without finish are uncertain, not retried. No framework selected merely for aesthetics; semantic server-delivered page plus memory-only browser state. Reproducibly declare QR/browser dependencies where used.

## Slice index
| Slice | Plan/outcome | Depends | Status | Commit | Evidence |
|---|---|---|---|---|---|
| 01 | [Host-authorized first Owner enrollment](milestone_10_plan_01_slice_01.md) | none | completed | slice01 subject | setup11 tests/build |
| 02 | [Durable MFA sessions and own account controls](milestone_10_plan_01_slice_02.md) | 01 | planned | | |
| 03 | [Audit admission, safe diagnostics and operational acceptance](milestone_10_plan_01_slice_03.md) | 01,02 | planned | | |

## Cross-slice concerns
Preserve destination/policy-before-substitution and MCP tools. Audit admission precedes effects; completion failure never rolls back downstream effects. One writable instance, protected key mounted separately from state; host control remains external trust. Account stores remain encrypted at rest, no secret browser persistence. Audit recovery requires durable recovery record and fresh normal login.

## Milestone completion gate
Reconcile all four acceptance clauses and named security/fault/browser checks. Run npm test and npm run build; inspect cumulative diff and slice commits; present exact evidence mapping to parent. Parent alone marks milestone completed.

## Rollback and recovery
Do not delete managed markers to resume old YAML. Stop process before host storage repair. Code rollback retains encrypted state/journal and keys; incompatible stores fail safely rather than reset. No backup archives implemented in10.

## Execution notes
Planning persisted before production edits; self-check confirms three independently testable outcomes, no unresolved product decision. TOTP recovery-code redemption is excluded12; display/hash creation included10. Detailed implementation facts may be refined in matching slice plan.

## Deferred follow-ups
None currently.
