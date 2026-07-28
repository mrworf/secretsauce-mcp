# v2.1 Milestone 10 Architecture And Operations Review

## Scope

- **Executable baseline:** `7e3a2fd`
- **Review time:** 2026-07-28 UTC
- **Assurance boundary:** project-authored white-box review, not independent
  architecture approval or human operations sign-off.
- **Scope:** setup/provisioning, combined application composition, gateway and
  control listeners, vault isolation, persistence ownership, OAuth/session
  state, startup/restart, rotation/recovery, scale, official Compose,
  generated contracts, and operator procedures.
- **Evidence:** production build; 168-file/1,090-test suite; exact
  100,000/100,001 revocation boundary; current OpenAPI; 14 readiness artifacts;
  container smoke; and partial clean/recreation Compose execution.

## Executive Summary

The v2.1 design is coherent for its stated small, self-hosted,
single-instance target. Browser-first provisioning, one combined application
writer, separate public listeners, and a network-isolated vault align with the
approved architecture. The final review found and closed one architecture gap:
the approved 100,000-record transactional global-revocation boundary was not
enforced. The correction landed in `b780201`.

Real Compose execution then found a production-only composition import cycle.
Commit `7e3a2fd` defers the operational application import until browser-first
handoff; the full suite and clean/recreated topology pass. No additional
source-level architecture blocker is confirmed. Release approval remains
pending because the interactive and operational portions of the Compose
journey are incomplete, the production advisory query is absent, and hosted
client and independent/human evidence are not available.

## What Is Good

**Privileged ordering is structural.** Authentication, canonical destination
validation, current role/service authorization, policy, and bounded admission
run before credential redemption, substitution, or downstream network I/O.

**Transport state and durable authority are separated.** MCP requests
authenticate independently. Durable browser/OAuth identity survives only
through stable keys and database records, while bootstrap authority, OAuth
codes, vault boot capabilities, and gateway/response references are
process-lifetime state.

**One composition root matches SQLite ownership.** Gateway and control retain
distinct listeners and auth surfaces while sharing one `PersistenceWorker`.
The vault remains a separate broker and container boundary.

**Fresh provisioning is fail closed.** Generated keys and the setup manifest
are validated before ordinary database/runtime authority starts. Maintenance
transitions use explicit state, bounded recovery, and restart-safe evidence.

**Scale limits are executable contracts.** Repository workloads cover the
settled product scale, and global access revocation now accepts exactly 100,000
active records while atomically rejecting 100,001.

## What Is Bad Or Risky

**The official deployment journey is only partially executed.** A clean image
build, bounded setup startup, mount directions, network isolation, and
generated-file recreation passed. Interactive enrollment, operational
database/OAuth/audit continuity, process-authority invalidation, and both root
rotations remain unexecuted.

**One application remains a shared fault and compromise domain.** A crash
affects both public surfaces, and arbitrary application-process compromise can
reach its logical data/control vault clients. This is acceptable only within
the declared single-instance model and separately enforced vault protocol.

**SQLite and audit writes serialize mutation work.** This gives useful
atomicity and ownership, but slow storage can affect latency. Current fixtures
bound supported workloads; production operators still need capacity and disk
monitoring.

**The access-management module is large.** Its policy, projection, cleanup,
and mutation responsibilities increase review cost. It is covered by strong
behavioral and transaction tests, so a release-time refactor would create more
risk than it removes.

**The passing container and partial Compose checks are not the complete v2.1
deployment proof.** They cover image startup and the browser-first boundary,
but not the post-enrollment operational and maintenance journey.

## What Should Change

- Continue `docs/v2.1-release-qualification.md` against `7e3a2fd` or the later
  exact executable candidate, recording interactive enrollment,
  post-enrollment durable/ephemeral state, operational MCP, and both root
  rotations.
- Run the production dependency gate under approved network/disclosure policy.
- Run hosted Codex and ChatGPT against the deployed origin and full `/mcp`
  Server URL, then obtain named independent security, architecture,
  UX/accessibility, data/API, operations, documentation, and human approval.
- Keep exact global operation limits close to repository transactions and
  retain positive and limit-plus-one tests.

## What I Would Not Change Yet

- Do not split gateway and control into independent SQLite writer processes.
  That would violate the exclusive-writer design without a new coordination
  boundary or persistence architecture.
- Do not add Redis, a queue, horizontal replicas, remote vault transport,
  service-specific tools, or a policy engine for the stated release.
- Do not refactor `accessManagement.ts` merely for file size before release;
  preserve the proven transaction and authorization behavior until a bounded
  follow-up can keep the same tests.
- Do not claim universal response non-exfiltration. Keep exact/pattern scanning
  as defense in depth behind structural route and credential constraints.

## Overall Opinion

The source architecture is implementation-ready and internally consistent for
the declared single-instance product, including the remediated global
revocation boundary and browser-first import graph. It is not yet
release-qualified: the remaining Compose journey, dependency advisory evidence,
hosted clients, and independent/human approvals remain blocking external
gates.
