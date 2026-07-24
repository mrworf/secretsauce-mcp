# Milestone 16 System-Owned API Keys Acceptance Review

## Outcome

Accepted. SecretSauce now supports durable system-owned management API keys
with immutable `service`, `all_services`, and `system` roles. Raw values are
shown only after creation or rotation; persistence retains a canonical
identifier, safe metadata, and a bounded Argon2id verifier.

Key authority is independent of the creator's account. Every management route
is checked against the central static permission matrix, API keys never satisfy
human step-up, and lifecycle routes remain browser-only.

## Acceptance evidence

- The exact `ssk_v1_<16-character identifier>_<43-character secret>` grammar
  provides 256 secret bits and rejects non-canonical base64url, alternate
  encodings, whitespace, and size deviations.
- The verifier uses Argon2id with 64 MiB, time cost 3, parallelism 1, a random
  16-byte salt, and a four-operation semaphore. Unknown identifiers perform
  dummy verification; saturated work fails closed.
- Schema checks enforce mutually exclusive role/service scope, immutable
  expiration policy, lifecycle consistency, safe metadata bounds, and indexed
  identifier/status/scope lookup. No ownership foreign key ties authority to
  the creator.
- Assigned administrators see and manage only service keys for currently
  assigned services. Superadmins see all key metadata. Browser lifecycle
  routes require step-up and reject API-key authentication.
- Creation supports forever or 1–3650 day expiry. `all_services` requires the
  exact durable acknowledgement and includes services created later.
- Finite expiry is effective at the exact instant and can only move earlier.
  Revocation is terminal and idempotent. Rotation is atomic replacement plus
  revocation and retains the old absolute finite expiry.
- Authentication validates one exact bounded bearer, independently reloads
  active key state, advances last use, and applies direct-source and key-UUID
  request windows. Secret buffers are zeroed after verifier work.
- Repository mutations revalidate API-key UUID, static role, service scope,
  status, and expiry in the same transaction before changing domain state.
- Service keys are cross-service denied; all-services keys cover current and
  future services; system keys do not inherit service authority.
- Service/all-services keys can perform only their eligible ordinary-user
  invitation, view, and reset operations. Only system keys can manage eligible
  ordinary/admin profiles, status, roles, and deletion. Every API role hides
  and cannot affect superadmins.
- Production OpenAPI route coverage proves each management operation accepts
  `api_key` if and only if at least one static API role is permitted. Hard
  denials include key lifecycle, step-up, restore, global authenticators,
  service-admin assignment, permanent service deletion, and vault operations.
- Authentication and route activity record key UUID, safe role/scope
  snapshots, action, UUID target when present, outcome, request ID, source
  digest where applicable, bounded failure code, and time. Browser-only,
  matrix, scope, invalid-input, and throttle denials are represented without
  storing bodies or headers.
- The responsive browser workspace provides role-scoped metadata, creation,
  shortening, rotation, revocation, recent activity, the durable all-services
  warning, and a dedicated one-time copy panel. Reloads never reconstruct a
  raw value.
- Raw keys, verifiers, Authorization headers, temporary passwords, reset
  inputs, request bodies, and response bodies are absent from logs, audits,
  metadata projections, OpenAPI examples, and post-dismissal UI.

## Verification

- Focused positive, negative, boundary, concurrency, creator-independence,
  scope, user-lifecycle, route-coverage, activity, and browser tests pass.
- Production server and web builds pass.
- `npm run check:control-openapi` reports the committed artifact current.
- Full regression with listener/socket permission and bounded runner
  concurrency: **96 test files, 730 tests passed**.

## Implementation commits

- `771d601` — API-key schema, grammar, verifier, and storage primitives
- `500f726` — metadata, expiry, revocation, rotation, and activity lifecycle
- `a8457f0` — management bearer authentication and safe use records
- `40096bf` — service/configuration static-role authority
- `48e6e09` — ordinary/admin user-operation authority
- `847ce88` — browser-only lifecycle HTTP and OpenAPI contracts
- `46a8a15` — responsive API-key management workspace
- `f8c72be` — route-level allow/deny/error activity

## Deferred boundary

Detection and approval of an active SecretSauce management key used as a
downstream credential remains Milestone 17. Backup endpoint behavior remains
Milestone 21. Restore continues to reject every API-key role.
