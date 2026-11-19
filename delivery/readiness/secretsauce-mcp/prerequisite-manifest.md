# Milestone Prerequisite Manifest — UX8

- Packet: `delivery/milestones/secretsauce-mcp/status.yaml`; product `secretsauce-mcp`.
- Audited revision: all-file fingerprint and exact digests in `workflow/delivery-planning/results/readiness.yaml`.
- Source transaction: `80edc3f0b720b3a5bf7b49a8585817a38072ed54`; planning transaction parent-owned pending publication, start `5a95a349a326af07a32869e10d69c22fae299fcf`.
- Intended order: completed M10–44, then M45, M46. Both pending outcomes independently consume completed providers; explicit status dependencies govern.
- Audit: 2026-11-18. Previous prerequisite versions remain in Git.

| ID | Description | Consumers | Classification | Current status | Proposed provider | Class | Verification | Commands executed | Files changed | Blocking | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PRE-061 | Settled UX8 authority and appearance | M45/46 | Already satisfied | Verified | Published definition | AUTO | Source/compiler hashes and current approved UX | Python hashes/path checks | Readiness docs | Yes | FACT: definition-package.yaml, compiler.yaml, UX manifest |
| PRE-062 | Node >=22, npm packages and OpenSSL | M45/46 | Already satisfied | Verified versions/dependencies | package/lock and documented npm ci | AUTO | Runtime and dependency probes | node --version; npm --version; openssl version; npm ls --depth=0 | None | Yes | FACT: package.json, lockfile, console-operations setup |
| PRE-063 | Synthetic HTTPS browser facilities | M45/46 | Already satisfied | Pinned Playwright1.64 image verified; default host Chromium absent, supported Docker route available | Existing harnesses and image; documented Chromium installation for fresh hosts | AUTO | Image inspect and retained passing harness evidence | docker image inspect; executable-path existence probe | None | Yes at browser qualification | FACT: existing scripts, UX7 integrated acceptance and reproduction |
| PRE-064 | Completed editing/evidence/navigation foundations | M45:31/32/41/43/44; M46:15/42/43 | Provided by an earlier milestone | Verified completed and unchanged | Repository completed milestones | AUTO | Exact status/contract comparison and graph | Python dependency/preservation check | None | Yes | FACT: status.yaml and contracts |
| PRE-065 | New assertions, screenshots and integrated qualification | M45/46; UX8-INTEGRATED | Owned by the consuming milestone | Scheduled, not run | Milestone acceptance and integrated checkpoint | AUTO | Named tests/harnesses and commands exist | Path inspection | M45/46 readiness sections | Yes at acceptance | FACT: Required Validation, status regression checkpoint |

No external LLM integration change, real SMTP account, live secrets or persistent service is needed. Fresh setup requires declared package/browser downloads; this is documented provisioning, not an undeclared cache assumption. Retained browser evidence establishes facility availability, not current feature acceptance. Conditional transport/recovery gates remain unchanged.
