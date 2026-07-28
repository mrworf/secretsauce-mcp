# v2.1 Milestone 10 Automated Qualification

## Candidate and environment

- Executable baseline: `1768357`
- Qualification environment: Node 26.4.0, npm 12.0.1, linux/x86_64
- Container runtime: unavailable; Docker, Podman, and nerdctl are absent
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
- The full unit/integration/browser/security suite passed 168 files and 1,087
  tests with approved loopback/private-socket permission.
- Generated control OpenAPI is current.
- The v2.1 readiness validator passed all 14 architecture/readiness artifacts.
- The release artifact/privacy scan passed 657 closed-scope files.

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

## Pending release blockers

- `npm run audit:production` could not query the public npm advisory endpoint
  in the sandbox. Escalation was rejected because it would disclose dependency
  metadata without explicit user authorization. No advisory result is claimed.
- No Docker-compatible runtime exists on this host. The exact-candidate
  official Compose clean setup, enrollment, MCP, recreation, durable-state,
  vault-isolation, and rotation journey is not executed here.
- Hosted Codex and ChatGPT checks against a deployment are not supplied.
- Independent/human security, architecture, UX/accessibility, data/API,
  operations, documentation, and release approvals are not supplied.

All four items remain `pending` in the release matrix. No gate is waived and
Milestone 10 remains in progress.
