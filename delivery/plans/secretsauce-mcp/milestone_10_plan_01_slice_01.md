# Milestone10 slice01: Host-authorized first Owner enrollment

Status: completed; commit identified by subject `delivery: M10 slice 01 establish host-authorized encrypted setup` (exact SHA recorded in governing index after commit).

## Goal and observable outcome
New host-local setup command creates expiring instance-bound hash-only proof; protected enrollment collects trusted HTTPS origin, instance name, password, authenticator confirmation and independently saved backup material. Atomic encrypted state survives restart. No discovery or incomplete MFA gives ordinary access.

## Scope and contracts
Scope: exactly milestone10. Exclude invitations, recovery redemption, service editing, audit search/export, backup archive jobs and changes to MCP schemas. Parent transaction c76de1e078f9091b3e9f012abd676ac0792d910c; preserve untracked test-results and root-owned status.yaml. Authoritative contracts: delivery/milestones/secretsauce-mcp/10-secure-audited-setup.md, docs/web-console-prd.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, product/ux/manifest.yaml and referenced UX documents. One process owns encrypted state and audit storage. Synthetic credentials only in tests. Each new external input has positive/negative tests. Errors never echo secret inputs. Commit only slice-owned changes after focused validation; full npm test/build and rendered browser acceptance before milestone handoff.


## Dependencies
none

## Behavior and state
New host-local setup command creates expiring instance-bound hash-only proof; protected enrollment collects trusted HTTPS origin, instance name, password, authenticator confirmation and independently saved backup material. Atomic encrypted state survives restart. No discovery or incomplete MFA gives ordinary access. State commits precede successful responses; failures preserve last committed state and require deliberate retry or status inspection.

## Authorization
Host proof permits enrollment only; ordinary access requires completed password/TOTP identity. Four roles remain fixed; execution assignments remain separate. Owner continuity and current permission checks apply.

## Validation and recovery
Test proof entropy/binding/expiry/reissue/replay/concurrent setup; password15/64+ and compromised negatives; MFA wrong/replay; missing/wrong keys, corrupted/interrupted persistence; no secret output/log URLs; audit durable-before-activation.
Focused vitest files for changed surfaces and npm run build. Final slice owns cumulative validation.

## Implementation surfaces
src/consoleStore.ts, src/consoleCrypto.ts, src/consoleSetup.ts, src/consoleHttp.ts, src/consolePage.ts, src/server.ts, test/console-setup.test.ts, docs/console-operations.md

## Acceptance and commit boundary
All listed positive/negative/fault checks pass; behavior observable end-to-end. One reviewable commit with this plan, implementation, directly required support and evidence.

## Delivered evidence
`npm run build` passed; `npx vitest run test/console-setup.test.ts`11 tests passed. Includes actual encrypted restart, MFA proof/race/attempt boundaries, trusted-origin HTTP/QR positives and negatives, broken state/key, authenticated journal tampering, directory fsync failure and uncertain writer ownership. Durable file+directory journal initialization and bounded admission prevent unbounded setup denial history. Vendored MIT SecLists10k corpus is local and packaged in Docker.
