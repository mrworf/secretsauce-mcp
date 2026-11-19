# Milestone prerequisite manifest — UX9

- Packet/product: `delivery/milestones/secretsauce-mcp/status.yaml`, `secretsauce-mcp`.
- Source transaction: `8c307a8`; planning start `985b8d0`; parent-owned planning publication pending.
- Audited revisions: exact packet/source digests in `workflow/delivery-planning/results/readiness.yaml`.
- Intended order: completed M10–46, then M47 → M48, per status dependencies/index. Audit: 2026-11-18.

| ID | Description | Consumers | Classification | Current status | Proposed provider | Class | Verification | Commands executed | Files changed | Blocking | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PRE-066 | Settled UX9 authority and appearance | M47/48 | Already satisfied | Verified | Published definition | AUTO | Current source/compiler hashes | Python hash/path checks | Readiness docs | Yes | FACT: current definition-package, compiler and UX manifest |
| PRE-067 | Node >=22, OpenSSL, locked dependencies | M47/48 | Already satisfied | Verified | package/lock; documented npm ci | AUTO | Runtime/dependency probes | node --version; npm --version; openssl version; npm ls --depth=0 | None | Yes | FACT: package.json, package-lock.json, docs/console-operations.md |
| PRE-068 | Disposable synthetic HTTPS browser facility | M47/48 | Already satisfied | Existing supported route verified from source and retained qualification | Declared Playwright/Chromium or pinned Docker image | AUTO | Existing harness and prior acceptance inspection | Source/path inspection; no container execution | None | Yes at visual qualification | FACT: scripts/verify-console-advanced-browser.mjs, verify-console-service-help-browser.mjs and evidence/qa/secretsauce-mcp/ux8-integrated/acceptance.md |
| PRE-069 | Earlier coherent state/review foundations | M47:35/41/45/46; M48:47/42 | Provided by an earlier milestone | Existing providers complete; M47 intentionally pending before M48 | Declared milestone dependency | AUTO | Full graph/order and history comparison | Python comparison with 985b8d0 | None | Yes at consuming milestone start | FACT: 39-node graph, 37 completed records/contracts preserved |
| PRE-070 | Focused and integrated qualification | M47/48; UX9-INTEGRATED | Owned by the consuming milestone | Scheduled, not executed | Implementation acceptance | AUTO | Named tests/harnesses exist; checkpoint explicit | Path inspection | M47/48 readiness checks | Yes at acceptance | FACT: Required Validation and UX9-INTEGRATED |

No external service account, real credential, live deployment or LLM connection is required. Fresh environment provisioning requires package/browser downloads as declared setup, not an assumed cache. Existing acceptance proves the facility, not these future features. Conditional transport/recovery gates remain.
