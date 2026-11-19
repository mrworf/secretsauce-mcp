# Milestone prerequisite manifest — UX10

- Packet/product: `delivery/milestones/secretsauce-mcp/status.yaml`, `secretsauce-mcp`.
- Source transaction: `6a03a55`; planning start `e6a27bf`; parent-owned publication pending.
- Audited revisions: exact packet/source fingerprints in `workflow/delivery-planning/results/readiness.yaml`.
- Order: completed M10–48, then M49 → M50 → M51 per status/index. Audit: 2026-11-19.

| ID | Description | Consumers | Classification | Current status | Proposed provider | Class | Verification | Commands executed | Files changed | Blocking | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PRE-071 | Settled UX10 authority and appearance | M49–51 | Already satisfied | Verified | Published definition | AUTO | Source/compiler digest equality | Python hashes | Readiness docs | Yes | FACT: current definition-package/compiler/UX manifest |
| PRE-072 | Runtime and locked dependencies | M49–51 | Already satisfied | Verified | package.json/lock and npm ci | AUTO | Node >=22, npm tree, OpenSSL | node --version; npm --version; npm ls --depth=0; openssl version | None | Yes | FACT: package.json and docs/console-operations.md |
| PRE-073 | Synthetic HTTPS browser and isolated recovery facilities | M49–51 | Already satisfied | Available | Existing scripts and Playwright Docker image | AUTO | Image metadata and harness paths/source | docker image inspect; source/path inspection | None | Yes at acceptance | FACT: scripts/verify-console-service-editor-browser.mjs; verify-console-recovery-cleanhost-docker.mjs; verify-console-recovery-launcher-docker.mjs; verify-console-recovery-crashes-docker.mjs |
| PRE-074 | Earlier state and shared UI foundations | M49:43/45/48; M50:49/29/34/47; M51:50 | Provided by an earlier milestone | Completed providers preserved; pending predecessors required before consumption | Declared dependencies | AUTO | Full graph and completed history comparison | Python graph/byte comparison | None | Yes at consuming start | FACT: 42-node status graph,39 completed records/contracts unchanged |
| PRE-075 | Focused and integrated qualification | M49–51; UX10-INTEGRATED | Owned by the consuming milestone | Scheduled, not run | Implementation acceptance | AUTO | Required Validation/checkpoint and existing facilities | Source inspection | New milestone readiness checks | Yes at acceptance | FACT: terminal checkpoint full suite/build/joined browser/changed recovery |

No new secret, external account, LLM connection or live deployment is needed. Clean provisioning uses declared package/browser downloads; current cache is not an undeclared requirement. New behavior tests and any changed-format recovery fixture extensions belong to consuming milestones, not bootstrap.
