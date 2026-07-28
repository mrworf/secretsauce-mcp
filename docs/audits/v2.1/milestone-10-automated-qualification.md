# v2.1 Milestone 10 Automated Qualification

## Candidate and environment

- Executable baseline: `b94a840`
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
- The full unit/integration/browser/security suite passed 168 files and 1,090
  tests.
- Generated control OpenAPI is current.
- The v2.1 readiness validator passed all 14 architecture/readiness artifacts.
- The release artifact/privacy scan passed 662 closed-scope files after the
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
1,090-test suite, a clean Compose rebuild, bounded pre-enrollment probes, and
forced recreation all pass.

A later sustained health check found that Compose overrode the image's
host-neutral gateway probe with the control liveness URL. The control listener
correctly rejected the probe's loopback Host value, so the setup process stayed
live while Docker eventually marked it unhealthy. Commit `b94a840` restores the
gateway `/health` probe in Compose and adds exact deployment assertions. The
recreated application became healthy, and the complete 1,090-test suite passes.

## Pending release blockers

- `npm run audit:production` could not query the public npm advisory endpoint
  in the sandbox. Escalation was rejected because it would disclose dependency
  metadata without explicit user authorization. No advisory result is claimed.
- The exact-candidate clean Compose start, pre-enrollment isolation, and
  generated-file recreation checks passed. The interactive enrollment,
  post-enrollment login/MCP and durable database/OAuth/audit journey, ephemeral
  authority checks, and both root rotations are not executed here.
- Hosted Codex and ChatGPT checks against a deployment are not supplied.
- Independent/human security, architecture, UX/accessibility, data/API,
  operations, documentation, and release approvals are not supplied.

All four items remain `pending` in the release matrix. No gate is waived and
Milestone 10 remains in progress.
