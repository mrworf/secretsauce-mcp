# Milestone10 slice02: Durable MFA sessions and own account controls

Status: completed; commit subject `delivery: M10 slice 02 add durable MFA account sessions` (exact SHA recorded in governing index after commit).

## Goal and observable outcome
Owner signs in with password+TOTP, reaches permission-safe shell, inspects own sessions and signs out. Change password and revoke other sessions enforce own scope. Five-minute action-bound reauthentication supports future consumers.

## Scope and contracts
Scope: exactly milestone10. Exclude invitations, recovery redemption, service editing, audit search/export, backup archive jobs and changes to MCP schemas. Parent transaction c76de1e078f9091b3e9f012abd676ac0792d910c; preserve untracked test-results and root-owned status.yaml. Authoritative contracts: delivery/milestones/secretsauce-mcp/10-secure-audited-setup.md, docs/web-console-prd.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, product/ux/manifest.yaml and referenced UX documents. One process owns encrypted state and audit storage. Synthetic credentials only in tests. Each new external input has positive/negative tests. Errors never echo secret inputs. Commit only slice-owned changes after focused validation; full npm test/build and rendered browser acceptance before milestone handoff.


## Dependencies
01

## Behavior and state
Owner signs in with password+TOTP, reaches permission-safe shell, inspects own sessions and signs out. Change password and revoke other sessions enforce own scope. Five-minute action-bound reauthentication supports future consumers. State commits precede successful responses; failures preserve last committed state and require deliberate retry or status inspection.

## Authorization
Host proof permits enrollment only; ordinary access requires completed password/TOTP identity. Four roles remain fixed; execution assignments remain separate. Owner continuity and current permission checks apply.

## Validation and recovery
Test login success/failure/throttle/concurrent TOTP replay; 30m idle12h overall; secure cookie/CSRF/origin/session forgery; revoke scope; old password/session invalidation; high-risk action binding; role enforcement and last Owner invariant.
Focused vitest files for changed surfaces and npm run build. Final slice owns cumulative validation.

## Implementation surfaces
src/consoleStore.ts, src/consoleHttp.ts, src/consolePage.ts, test/console-auth.test.ts, docs/console-operations.md

## Acceptance and commit boundary
All listed positive/negative/fault checks pass; behavior observable end-to-end. One reviewable commit with this plan, implementation, directly required support and evidence.

## Delivered evidence
`npm run build` passed; focused setup/auth/HTTP21 tests passed (11 setup,6auth,4HTTP). HTTP checks password+TOTP only, secure cookies, forged session, CSRF/trusted origin, current four-role direct requests and actor-scoped uncertain operation status. Auth checks replay/concurrency/restart, lockout, idle/absolute boundaries, own revocation, password invalidation and five-minute action binding. Body upload crossing absolute expiry is rejected using the current stored session. Restricted login never acquires sensitive authority after repair; unavailable replay/throttle storage fails closed. Factor replacement remains12.
