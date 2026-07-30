# v2.1 Milestone 10 Automated Qualification

## Candidate and environment

- Executable baseline: `bfac16c`
- Qualified image:
  `sha256:b2ef16bc5d640a9523f6807f52cac205a07a4f5107daf151c323aa9119dd68a6`
- Qualification environment: Node 26.4.0, npm 12.0.1, linux/x86_64
- Container runtime: rootless Docker Engine 29.6.1, Compose 5.3.1,
  linux/amd64, VFS storage, with a disposable data root outside the repository.
  The rootless toolchain packages were signature-verified before use.
- Decision rule: a missing external gate remains pending and blocks release

This artifact records project-authored automated evidence. It is not an
independent security, architecture, accessibility, operations, or human
approval.

## Integrated evidence

- Milestones 00–09 have completed acceptance artifacts and no recorded open
  release blocker.
- Focused authorization, Codex/ChatGPT protocol compatibility, scale,
  accessibility, setup, root rotation, initial enrollment, browser session,
  access management, break-glass, combined application, persistence, container
  contract, and documentation suites passed: 22 files and 120 tests.
- The v2.1 Compose/configuration documentation suite passed 4 files and 28
  tests, including positive validation of the official database identity/
  database runtime config and negative validation of an incomplete identity
  boundary.
- The production server and web build passed. The existing Vite advisory for
  one JavaScript chunk over 500 kB remains non-blocking.
- The full unit/integration/browser/security suite passed 169 files and 1,097
  tests.
- Generated control OpenAPI is current.
- The v2.1 readiness validator passed all 14 architecture/readiness artifacts.
- The release artifact/privacy scan passed 663 closed-scope files after the
  exact-candidate runbook and project-authored review packet were staged.
- `npm run smoke:container` passed against a real Docker daemon.
- Official `docker compose config` passed. A clean `up --build --detach`
  built the production image and started both services. Before enrollment,
  application liveness and setup status returned 200, readiness returned 503,
  MCP returned 503, and the vault was healthy with network mode `none`, no
  published ports, and the declared read-only inventory mounts.
- Forced recreation restored both services with zero restart count. All 11
  generated files remained byte-identical, application liveness and setup
  status returned 200, and the vault remained networkless.
- A second clean exact-candidate deployment completed enrollment, ordinary
  login, current-session retrieval, logout, first-request post-logout
  rejection, and bounded unauthenticated MCP rejection through the HTTP
  contracts. Recreation preserved readiness and did not emit replacement
  enrollment authority.
- Identity and vault envelope-root rotations completed on disposable
  snapshots. Only identity rotation made the database inventory writable.
  Journal resume and exact-request replay passed. Vault rotation rewrapped a
  populated record while preserving `1001:1001` ownership and `0600` mode; the
  application decrypted record metadata afterward and normal topology
  recreation remained ready.

## Integration finding and remediation

The official Compose file still mounted `examples/config.yaml`, the legacy
bearer/YAML-development configuration. It also required optional downstream
secret and restore bind mounts, so a clean checkout could not represent the
browser-first v2.1 topology.

The remediation adds `examples/config-v2.1.yaml` with control, persistence,
database runtime authority, database-backed built-in OAuth, local identity,
generated-key paths, direct source trust, durable audit, and empty YAML
services. Compose now mounts that file, relies on automatic fixed-registry key
provisioning, and treats portable restore as an explicit complete opt-in. The
operator guide and README agree with the topology. Positive and negative
configuration tests and the complete post-change suite pass.

M10 source review also found that the approved ADR fixed the global access
revocation boundary at 100,000 selected active records, while the accepted M09
fixture covered only 252 and the repository had no preflight cap. The owning
access behavior now accepts and atomically revokes exactly 100,000 records,
rejects 100,001 before any domain/idempotency/success-audit commit, and documents
the supported operator contract. The focused remediation suite passes 4 files
and 45 tests.

The first real clean Compose start exposed a production-only module evaluation
cycle: `application.ts` dynamically loaded the browser-first lifecycle while
the lifecycle statically imported the operational application starter. Node
exited with code 13 before either listener started. Unit tests had injected the
starter and therefore did not exercise the default import graph. Commit
`7e3a2fd` makes the operational import type-only at entrypoint evaluation and
defers the runtime import until handoff. A structural regression test, the full
suite, a clean Compose rebuild, bounded pre-enrollment probes, and
forced recreation all pass.

A later sustained health check found that Compose overrode the image's
host-neutral gateway probe with the control liveness URL. The control listener
correctly rejected the probe's loopback Host value, so the setup process stayed
live while Docker eventually marked it unhealthy. Commit `b94a840` restores a
gateway probe in Compose and adds exact deployment assertions.

The complete browser-first journey then exposed three further integration
gaps. Fresh named volumes left the vault store inaccessible to the runtime UID;
generated key validation ran before the provisioning sidecar could create
those files; and the readiness endpoint was being used as container liveness.
Commit `a38edc1` gives the new store a strict runtime-owned `0700` boundary,
defers only the provisioned-key existence checks until the setup handoff, and
adds a bounded `/health/live` endpoint while retaining readiness semantics.

The first real vault-root rotation found that the vault container lacked the
manifest's shared group and that privileged rotation rejected and would replace
runtime-owned records as root. Commit `3377e8c` supplies the declared shared
group and gives rotation an explicit, validated runtime record owner. Ordinary
record access remains strict. Positive and negative ownership tests, the full
suite, clean startup, populated-record rotation, and post-rotation recreation
pass.

## Remediation and pending post-M10 evidence

- The authorized production audit initially confirmed two High React Router
  findings and two Medium MCP SDK/Hono findings. Candidate `bfac16c` removes
  React Router, pins MCP SDK 1.30.0 with Hono 2.0.12, and reports zero
  production advisories through Moderate. It also upgrades `better-sqlite3`
  to 13.0.2, removes deprecated `prebuild-install`, passes a clean production
  install and forced source build, and retains Docker native build tooling.
- Clean enrollment/login/session/logout/recreation and both actual rotations
  passed through HTTP and process contracts. Browser end-to-end testing is
  scheduled after M10 by product-owner direction; automated browser and
  accessibility contracts pass in M10. Authenticated live MCP tools, complete
  database/OAuth/audit
  durability, and the full ephemeral-authority matrix are not executed here.
  A qualification-only bearer probe was correctly rejected by the database
  runtime because the bearer subject was not an active durable user; it is
  negative boundary evidence, not a substitute for built-in OAuth. The live
  journey needs an approved externally reachable HTTPS client-metadata
  document.
- Hosted Codex and ChatGPT checks against a deployment are not supplied.
- Independent/human security, architecture, UX/accessibility, data/API,
  operations, documentation, and release approvals are not supplied.

The remaining external items stay `pending` in the release matrix. Per the
2026-07-30 product-owner qualification boundary, they are post-M10 release
evidence rather than M10 implementation blockers. No release gate is waived;
M10 is complete for its bounded implementation and automated qualification
scope.
