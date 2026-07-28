# Milestone 10: Release Qualification And Documentation

## Outcome

Qualify one exact v2.1 candidate with reproducible product-wide gates and
decision-complete review artifacts. Automated protocol fixtures remain
evidence of protocol compatibility only; official Compose, hosted-client, and
independent review results must name the environment and candidate and cannot
be inferred from prior releases.

## Current-state findings and decisions

- Milestones 00–09 are complete with individual acceptance artifacts. The
  current production build, 168-file/1,087-test suite, generated OpenAPI,
  14-artifact readiness validator, and 653-file release scan pass.
- The existing release matrix and final review artifacts describe v2 milestone
  24 candidate `acf8b67`, not v2.1. They are useful templates but are not v2.1
  release evidence.
- Existing release tests cover the role matrix, route closure, deterministic
  scale workloads, responsive/accessibility contracts, and named
  Codex/ChatGPT OAuth/MCP restart/revocation fixtures. M10 will extend the
  documentation contracts to require v2.1 artifacts and record exact focused
  results.
- The official Compose topology now includes setup-only gating, an isolated
  no-network vault, durable generated/setup/database/audit/OAuth/vault stores,
  and ephemeral gateway references. A release journey must exercise that
  topology rather than treating the legacy bearer-only image smoke as a clean
  setup journey.
- This workspace has Node 26.4.0 on x86_64 but no Docker, Podman, or nerdctl.
  Container image and official Compose gates therefore require a separate
  Docker-capable environment and remain release-blocking until recorded for
  the exact executable candidate.
- Hosted Codex/ChatGPT interaction and final human/independent approvals are
  external assurance. Synthetic fixtures and agent-authored review artifacts
  cannot substitute for them.

## Slice plan

1. **Candidate-wide automated qualification:** add v2.1 release-document
   contracts and candidate matrix, run focused authorization, compatibility,
   scale, accessibility, documentation, setup, rotation, recovery, and
   persistence suites, then run production build, full suite, OpenAPI,
   dependency advisory, readiness, and release-artifact gates. Remediate only
   integration/release gaps discovered by those gates and commit exact
   executable evidence.
2. **Official container and Compose journey:** provide a reproducible
   exact-candidate official-Compose qualification command covering clean
   setup-only gating, browser enrollment handoff, operational health/MCP,
   container recreation, durable stores, process-lifetime authority
   invalidation, vault network isolation, and both root-rotation process
   suites. Execute it on a Docker-capable amd64 environment and record image,
   engine, filesystem, fixtures, and results.
3. **Final reviews and release decision:** complete v2.1 UX/accessibility,
   security/invariant, architecture/operations, data/API, and documentation
   reviews; run the live Codex and ChatGPT checklist against the documented
   origin and `/mcp` URL; close every blocker; update the matrix, milestone
   acceptance, status, and exact candidate commit without overstating
   independence.

## Release-blocking policy

Critical/High security findings, possible credential disclosure,
authorization/scope failures, data loss or rollback failures, stale generated
contracts, failed required client/container/Compose journeys, failed
performance/accessibility/privacy gates, or any full-suite failure block
release. Medium findings also block when they violate a settled invariant or
lack safe containment. Missing runtime or human evidence is pending, not pass.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | in progress | — | M09 baseline: build; 168 files/1,087 tests; current OpenAPI; 14 readiness artifacts; 653-file release scan | v2.1-specific release documents and focused integrated gates remain. |
| 2 | pending | — | Host audit: Node 26.4.0, x86_64; no Docker, Podman, or nerdctl available | Must execute on a Docker-capable environment; prior v2 image evidence is not reusable. |
| 3 | pending | — | Synthetic named-client fixtures exist; prior v2 review templates exist | Hosted-client and independent/human approval evidence is external and cannot be agent-inferred. |
