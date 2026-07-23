# SecretSauce v2 Architecture Baseline

Status: approved for implementation planning on 2026-07-23.

This packet is the decision-complete architecture contract for Milestones 01–24. It
extends the existing gateway contract in `docs/prd.md` with the v2 product baseline
in `docs/plans/secretsauce-v2-prd.md`. If these documents conflict, the v2 PRD
controls only the v2 administration and identity behavior; the existing stateless
MCP safety order remains mandatory.

## Approval record

The architecture, security, data/API, and UX review passes found no unresolved
product ambiguity. Their approved artifacts are:

| Review | Artifact | Result |
| --- | --- | --- |
| Architecture and deployment | [System architecture](system-architecture.md) and [ADRs](decisions.md) | Approved |
| Security and abuse cases | [Threat model](threat-model.md) | Approved |
| Data, deletion, and retention | [Data model](data-model.md) | Approved |
| API and authorization | [Management API](management-api.md) | Approved |
| Identity, grants, and invalidation | [Identity and OAuth](identity-oauth.md) | Approved |
| Vault and key lifecycle | [Vault specification](vault.md) | Approved |
| UX and accessibility | [UX packet](ux.md) | Approved |
| Dependencies and delivery order | [Dependencies and sequencing](dependencies-and-sequencing.md) | Approved |
| Cross-artifact scenario review | [Validation matrix](validation-matrix.md) | Approved |

Approval means the contracts are ready for implementation, not that later code has
already passed its milestone tests. A change to a mandatory decision requires an
ADR amendment plus security and compatibility review.

## Mandatory invariants

1. MCP HTTP is stateless. Authenticate every POST and never issue or trust
   `mcp-session-id`.
2. Runtime order is authenticate, authorize service and every credential, validate
   the canonical destination, evaluate every policy boundary, enforce capacity,
   resolve/substitute credentials, then perform downstream I/O.
3. The management API authorizes browser sessions, API keys, and local host
   authority explicitly. API keys never satisfy human step-up.
4. A control-plane write and its sanitized administrative audit event commit in
   one SQLite transaction or neither commits.
5. Only the vault broker possesses downstream-credential plaintext and vault
   master keys. Its public operation set is capability-specific, not a general
   secret read API.
6. Raw credentials, password material, TOTP values/seeds, API keys/verifiers,
   authorization headers, cookies, opaque references, authenticated request
   bodies, and downstream response bodies are prohibited from logs and audits.
7. Immutable UUIDv7 IDs, not mutable email or names, bind identity, assignments,
   grants, and ownership. Audit snapshots intentionally have no live-user foreign
   key.
8. One active application stack owns one database and vault. Multi-replica and
   multi-tenant operation are unsupported.

## Boundary of replaceability

Mandatory contracts are the trust boundaries, authorization matrices, data
semantics, wire behavior, cryptographic envelope formats, invalidation events,
safe configuration ranges, and delivery order in this packet. Repository class
names, SQL statement layout, React component structure, worker messaging details,
and equivalent internal algorithms remain local implementation choices when they
preserve those contracts.
