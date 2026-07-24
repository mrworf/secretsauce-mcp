# Milestone 24 Architecture And Operations Review

## Scope

- **Review baseline:** `acf8b67`
- **Review time:** 2026-07-24 UTC
- **Scope:** composition roots, gateway/control/vault boundaries, persistence,
  runtime state, startup/shutdown, jobs, deployment/CI, scale, recovery, proxy
  examples, and operator documentation.
- **Commands:** `npm run build`; `npm test`; `npm run
  check:control-openapi`; `npm run audit:production`; `node
  scripts/scan-release-artifacts.mjs`; focused application, container, scale,
  compatibility, backup, restore, and migration suites.
- **Limitations:** container validation used rootless Docker 29.6.2 on amd64;
  no deployed reverse-proxy or hosted-client environment was available.

## Executive Summary

The architecture is appropriate for a small, self-hosted, single-instance
product. The review found one release-blocking contradiction: separate gateway
and control processes could not both acquire the deliberately exclusive SQLite
writer. The new `src/application.ts` composition root owns one
`PersistenceWorker`, starts the control listener before the gateway listener,
shares only bounded runtime seams, and closes partial/full startup
idempotently. The vault remains the separate process/container isolation
boundary.

No further source-level architecture blocker remains. The exact executable
candidate built and passed non-root/read-only startup, health, stateless MCP,
restart, and durable-audit checks in a real amd64 container.

## What Is Good

**Good: privileged ordering is structural.** Authentication, current service
authorization, canonical destination resolution, policy, and admission precede
reference redemption, credential substitution, and downstream I/O.

**Good: transport statelessness is separated from durable identity.** Every MCP
POST authenticates independently; durable OAuth/session/API state is hash-only,
while gateway and response-secret references are deliberately process-local
and restart-ephemeral.

**Good: one composition root now matches persistence reality.** Gateway and
control keep distinct listeners, origins, auth surfaces, and route registries
while sharing exactly one serialized SQLite owner. Startup failure closes the
already-started listener and releases the writer lock.

**Good: vault roles remain protocol-enforced.** The combined application holds
separate caller keys, but data, control, and backup operations remain disjoint
at the broker; vault root keys and encrypted store stay outside the
application container.

**Good: work and data are bounded.** Release workloads cover 1,000 users, 500
services, 5,000 credentials, 20,000 policy rules, 10,000 OAuth records,
retained audit search, and capped background batches.

**Good: recovery is designed as state, not a runbook wish.** Backup, restore,
migration, encrypted recovery journals, maintenance exclusion, revocation, and
durable remediation have repository and process-level tests.

## What Is Bad Or Risky

**Risky: one process is an intentional fault and compromise domain.** A process
crash affects both public surfaces, and arbitrary application-process
compromise can reach logical data/control clients. This is acceptable for the
small-instance target only because the vault remains separately enforced and
the product does not claim intra-application OS isolation.

**Risky: the product is deliberately single-instance.** Runtime capability
state and the exclusive writer prevent horizontal replicas. Sticky sessions do
not fix this. Availability depends on one application and one vault broker.

**Risky: audit writes and SQLite serialize work.** This simplifies atomicity
and ownership, but slow storage can affect latency. Readiness and scale tests
contain the current risk; a queue or multi-writer database is not justified
without measurement.

**Risky: one local engine cannot represent every deployment host.** The
rootless amd64 smoke proves the image builds and exercises read-only start,
health, stateless MCP, restart, durable audit, and ephemeral references. CI
must continue repeating the command on its rootful runner before publication.

## What Should Change

**Change: preserve `npm run smoke:container` as a blocking pre-publication
gate.** Record the exact commit/image digest and sanitized result for every
release candidate.

**Change: execute the documented Codex and ChatGPT checklist for each real
deployment.** Synthetic fixtures prove protocol behavior, not hosted UI or
platform policy behavior.

**Change: track the MCP SDK's transitive Hono advisory.** Do not force an
incompatible major override; upgrade once upstream permits a patched compatible
version, especially before adding any Hono static-file surface or Windows
runtime support.

## What I Would Not Change Yet

**Do not change yet: do not split gateway and control into separate database
writer processes.** That would require a real coordination/API boundary or a
different persistence architecture; duplicating SQLite ownership is incorrect.

**Do not change yet: do not add Redis, a queue, an enterprise policy engine, or
service-specific tools.** Current limits, registry contracts, and SQLite design
fit the stated scale and adding infrastructure would expand failure modes
without resolving a measured release problem.

**Do not change yet: do not promise universal response non-exfiltration.** Keep
structural route/credential constraints and exact/pattern scanning as defense
in depth.

## Overall Opinion

The implementation is a coherent, testable single-instance architecture with
strong security ordering and unusually complete recovery contracts. The
release-blocking composition contradiction is fixed. Source architecture,
operator documentation, and actual container execution pass review; no
source-release environment gate remains open.
