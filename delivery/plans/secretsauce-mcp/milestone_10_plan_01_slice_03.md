# Milestone10 slice03: Audit admission, safe diagnostics and operational acceptance

Status: planned

## Goal and observable outcome
Sensitive gateway/OAuth/console effects require durable tamper-evident admission before substitution/I/O; audit failure preserves safe diagnostics, restricted sessions never upgrade. Operation starts without durable completion stay uncertain across restart. Browser setup/login/account/diagnostics are usable at320px with keyboard.

## Scope and contracts
Scope: exactly milestone10. Exclude invitations, recovery redemption, service editing, audit search/export, backup archive jobs and changes to MCP schemas. Parent transaction c76de1e078f9091b3e9f012abd676ac0792d910c; preserve untracked test-results and root-owned status.yaml. Authoritative contracts: delivery/milestones/secretsauce-mcp/10-secure-audited-setup.md, docs/web-console-prd.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, product/ux/manifest.yaml and referenced UX documents. One process owns encrypted state and audit storage. Synthetic credentials only in tests. Each new external input has positive/negative tests. Errors never echo secret inputs. Commit only slice-owned changes after focused validation; full npm test/build and rendered browser acceptance before milestone handoff.


## Dependencies
01,02

## Behavior and state
Sensitive gateway/OAuth/console effects require durable tamper-evident admission before substitution/I/O; audit failure preserves safe diagnostics, restricted sessions never upgrade. Operation starts without durable completion stay uncertain across restart. Browser setup/login/account/diagnostics are usable at320px with keyboard. State commits precede successful responses; failures preserve last committed state and require deliberate retry or status inspection.

## Authorization
Host proof permits enrollment only; ordinary access requires completed password/TOTP identity. Four roles remain fixed; execution assignments remain separate. Owner continuity and current permission checks apply.

## Validation and recovery
Disk-full/write/open/fsync faults, downstream call countzero before admission, interrupted starts and uncertain completions, restart/outage recovery, safe/unsafe diagnostic login, no restricted upgrade, health bounds. npm test; npm run build; declared browser harness desktop/320px keyboard and safe errors.
Focused vitest files for changed surfaces and npm run build. Final slice owns cumulative validation.

## Implementation surfaces
src/audit.ts, src/gateway.ts, src/tokens.ts, src/server.ts, src/builtinOAuth.ts, src/runtime.ts, console modules, tests, browser harness/package declarations, evidence/qa/secretsauce-mcp/milestone10, docs/console-operations.md

Additional cumulative evidence: built-in OAuth authorization/token issuance/refresh, gateway reference issuance and dispatch fail closed; all four roles direct-request boundaries; bearer/external credentials cannot establish console authority; operation status checks actor scope. Browser artifacts omit all synthetic secrets.

## Acceptance and commit boundary
All listed positive/negative/fault checks pass; behavior observable end-to-end. One reviewable commit with this plan, implementation, directly required support and evidence.
