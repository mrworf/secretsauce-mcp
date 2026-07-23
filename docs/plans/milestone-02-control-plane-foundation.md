# Milestone 02 Implementation Plan

Status: approved for implementation.

This plan implements only `docs/milestones/02-control-plane-foundation.md`.
Identity providers, login/session persistence, API-key verification, domain CRUD,
production editors, and dashboard data remain deferred to their named milestones.

## Package and deployment shape

The existing root package remains the Node.js data-plane and control-plane server
package. `src/control/` is a separately startable Fastify application and listener.
The React/Vite SPA lives in the `control-ui` npm workspace and builds to
`control-ui/dist`, which the control server serves in production. Vite development
proxies `/api/v2` to the independently configured control listener.

The control plane is opt-in through a closed `control` configuration object:

- `listen`: required host and port, distinct from `server.listen`.
- `public_origin`: required canonical HTTPS origin, or loopback HTTP for local
  development, distinct from configured MCP/OAuth public origins.
- `idempotency_hmac_key_file`: required mode-restricted file containing an
  independently provisioned 32-byte base64url key.

Proxy trust remains disabled. The exact authority from `public_origin` is the Host
allowlist; no forwarding header changes client identity or authority. Existing v1
configuration and the data-plane listener remain unchanged when `control` is
omitted.

## Slice 1: separate listener and browser security boundary

Outcome: Fastify 5 runs a separately startable control application with `/api/v2`
and browser prefixes, sanitized health, management request IDs, safe lifecycle,
and no route overlap with MCP/OAuth. Configuration rejects listener/origin
collisions, URL userinfo/path/query/fragment, insecure non-loopback origins,
malformed key files, unknown fields, and invalid host/port forms.

An `onRequest` boundary validates the exact Host and any Origin before body
parsing. The default authentication seam denies every non-public route. Unsafe
cookie-authenticated requests require an exact same-origin Origin and a
synchronizer proof through an injected CSRF verifier. Secure host-only HttpOnly
cookie helpers are plumbing only; this slice does not issue a login session.

All API responses receive strict CSP/frame/referrer/MIME/permissions headers and
no permissive CORS. API and HTML responses default to `no-store`; immutable
fingerprinted assets may be cached. Request logging records only method, registered
route, status, duration class, request ID, and safe authenticated identifiers—never
headers, cookie values, raw URLs/query values, or bodies. Global and route body
limits reject before handlers.

Focused tests: control configuration and real HTTP listener/security integration,
including data/control route confusion.

Commit: `Add separate control listener`.

## Slice 2: route registry, wire contracts, and authorization policy

Outcome: later domains register routes through one typed registry containing
method/path, public or explicit authentication methods, permission, step-up rule,
closed Zod request/response schemas, rate-limit class, audit action, secret-field
JSON pointers, cache class, and idempotency/concurrency requirements. Registry
validation rejects duplicate/ambiguous paths and unsafe incomplete metadata.

The runtime adapter emits the stable v2 data/error envelopes, rejects unknown
fields and malformed JSON without echoing values, and exposes bounded pagination
(`limit` 1–200, default 50, opaque cursor), strong version ETags, `If-Match`, and
16–128 printable-ASCII `Idempotency-Key` parsing. A table-driven permission module
encodes every PRD Section 30 role/capability cell as allow, scoped, step-up, or
deny; navigation uses it only for visibility and server authorization remains
authoritative.

OpenAPI 3.1 is generated from the same Zod registry with common errors,
pagination, concurrency, idempotency, authentication declarations, and tagged
secret inputs. The generated release artifact is checked in and a drift test
compares it byte-for-byte.

Focused tests: route/wire contract tests, full permission-matrix tests, and
generated OpenAPI drift/secret-example tests.

Commit: `Add control API contracts`.

## Slice 3: durable idempotency lifecycle

Outcome: migration `0002` adds only bounded control idempotency metadata—never raw
keys or request bodies. An injected HMAC-SHA-256 hasher binds the 16–128 byte key
to principal and route. Transaction helpers atomically claim a digest, identify
same-digest replay, reject a different digest as a conflict, store only a safe
result reference/status, expire records after 24 hours, and prune at most 500
expired rows per command.

The primitive is usable only from an explicit persistence transaction so a later
domain mutation, administrative audit, and idempotency result can share one unit
of work. It introduces no domain mutation or unaudited privileged route.

Focused tests: maximum/minimum keys, limit-plus-one/minus-one, same-key replay,
different-body conflict, principal/route isolation, restart persistence, expiry,
bounded pruning, rollback, and assurance that raw keys/bodies are absent.

Commit: `Persist control idempotency records`.

## Slice 4: responsive accessible application shell

Outcome: a React 19/TypeScript/Vite 6/React Router workspace builds a branded SPA
with skip link, landmarks, visible focus, semantic headings, live status region,
role-filtered placeholder navigation, desktop rail, tablet disclosure navigation,
and mobile stacked layout. Navigation covers the approved primary sections but
does not imply authorization or expose domain data. Secret values/references are
absent from state, URLs, diagnostics, and notifications.

CSS enforces 44-pixel targets, bounded prose, wide workspace use, breakpoints below
768, 768–1199, and 1200+, reduced motion, non-color-only status, and light/dark
contrast tokens. Production uses hashed assets and SPA fallback without allowing
path traversal; Vite development proxies only the API prefix.

Focused tests: React semantic/navigation tests, built-asset serving, keyboard/focus
contracts, and wide/narrow responsive CSS/render smoke tests.

Commit: `Add responsive control shell`.

## Gates and handoff

Every slice runs its focused tests, `npm run build`, and the unchanged `npm test`
suite before commit. A loopback `EPERM` reruns the same full suite with network
permission. Milestone completion additionally requires real simultaneous listener
separation, byte-for-byte OpenAPI generation, a production SPA build, no
unauthenticated administrative route, and a clean restart.

Later milestones may add routes only through the registry, authenticate through
the declared seam, authorize through the centralized table plus resource scope,
and perform retry-sensitive mutations inside the audited persistence transaction.
They may not loosen Host/Origin/CSRF order, enable permissive CORS, trust forwarding
headers by default, handwrite OpenAPI, or store idempotency keys/request bodies.
