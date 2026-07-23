# Milestone 02: Control Plane Foundation

## Purpose and why

Establish the separately deployable management surface and its browser security baseline before exposing administrative workflows. Later domains need one consistent API, web session boundary, mutation contract, and responsive application shell.

## Dependencies

- Milestones 00 and 01.

## PRD traceability

- Sections 6.1–6.2: control-plane and trust boundaries.
- Sections 21–22: web control plane and mutation behavior.
- Section 25: applicable request limits.
- Sections 29, 32.2, and 33: management API, listener separation, and UX acceptance.

## Scope

- Add the approved Fastify management application on a listener and public origin distinct from MCP/OAuth.
- Add versioned JSON API routing, runtime-schema validation, structured errors, bounded pagination, ETags/expected versions, and idempotency-key infrastructure.
- Generate or validate OpenAPI from the runtime contracts.
- Add the React, TypeScript, and Vite application shell with SecretSauce branding, role-aware navigation placeholders, wide/narrow responsive structure, and accessible focus/navigation primitives.
- Establish Secure/HttpOnly cookie plumbing for later sessions without implementing login.
- Enforce Origin/Host validation, CSRF protection for cookie mutations, strict CSP, frame denial, referrer policy, MIME protection, safe CORS defaults, and cache prevention on sensitive route classes.
- Add management-request IDs, safe logging, body/query limits, and a sanitized health surface.

## Not in scope

- Authentication-provider logic, user login, or domain CRUD.
- API-key authentication.
- Production editor pages or dashboard data.
- Serving the control plane from the MCP listener.

## Required behavior and interfaces

- Browser and API routes have distinct public prefixes and stable content types.
- Unknown fields, malformed JSON, oversized bodies, untrusted origins/hosts, missing CSRF proofs, and stale expected versions return stable safe errors.
- OpenAPI documents common errors, pagination, concurrency, idempotency, and secret-input restrictions without real credentials or internal hosts.
- The application shell remains usable at supported wide and narrow viewport targets.

## Security, authorization, invalidation, and audit

- All non-public routes are deny-by-default behind an authentication/authorization seam populated by later milestones.
- Cookie-authenticated mutations require CSRF and origin validation; API-key routes will not infer browser step-up.
- Request logs exclude cookies, authorization headers, raw bodies, and query values classified as secrets.
- No domain mutation or invalidation is introduced.

## Tests

- Positive: separate listeners, health, API schema validation, OpenAPI generation, pagination shape, ETag/idempotency primitives, secure headers, and responsive shell smoke tests.
- Negative: listener/origin collision, untrusted Host/Origin, CSRF failure, permissive cross-origin request, oversized or unknown JSON fields, malformed pagination, and stale version.
- Boundary: hard page/body/idempotency-key limits and cache headers on authentication/secret route classes.
- Integration: real HTTP tests prove MCP and control-plane routing cannot be confused.

## Acceptance criteria

- The management API and SPA run on the separate configured listener.
- Browser security headers and CSRF/origin defenses are enabled by default.
- Runtime schemas and OpenAPI remain contract-tested together.
- No unauthenticated domain administration is possible.

## Planning handoff

Define package/workspace layout, dev and production asset serving, proxy trust rules, cookie/CSRF mechanism, OpenAPI generation path, error envelope, pagination limits, ETag representation, and idempotency-record lifecycle.
