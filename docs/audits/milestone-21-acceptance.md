# Milestone 21 acceptance review

## Outcome

Milestone 21 is accepted. SecretSauce now produces bounded schema-versioned
portable configuration archives, optionally containing an exact
selection-bound passphrase-encrypted vault payload, through stepped-up browser
and credential-less system-key workflows.

## Evidence

- Migration 0021 stores five-minute, one-use, hash-only backup authorizations
  and sanitized outcomes without passphrases, ciphertext, or vault material.
- Projection reads one serialized database snapshot through allowlisted columns,
  canonicalizes portable service/destination, credential-definition, and policy
  documents, and structurally excludes identities, assignments, settings,
  activity/audit, API/OAuth/session/reference state, local paths, runtime
  generations, and last-four canaries.
- The strict deterministic gzip/ustar codec enforces entry order, modes,
  canonical metadata, checksums, object/entry/archive bounds, and rejects
  duplicate, extra, linked, traversal, extended, malformed, or truncated input.
- Backup capabilities bind the exact sorted credential UUID/locator/generation
  selection digest. The broker rejects missing, stale, duplicate, and extra
  records before returning a completed encrypted payload.
- The coordinator authorizes only stepped-up browser superadmins for either mode
  and `system` API keys for credential-less mode, consumes durable authorization
  once, bounds concurrency/rate/cleanup, zeroes secret buffers, and records only
  sanitized success/failure evidence.
- Interactive and programmatic routes enforce independent authentication,
  permission, CSRF, step-up, strict body, UTF-8 passphrase, binary size, direct
  no-store attachment, safe filename, and stable error contracts. OpenAPI
  describes the authenticated gzip response.
- The responsive superadmin workspace defaults to credential-less export,
  presents permanent exclusions, distinguishes encrypted mode, validates
  confirmation/byte bounds, clears every secret after success/failure, preserves
  non-secret recovery state, and immediately revokes its Blob URL.
- Production readiness exposes the backup-only caller/capability pair only as a
  complete set. Credential-less backup remains available without that client.

## Verification

- Focused projection, archive, selection, coordinator, route, broker-process,
  browser, and browser-client acceptance: passed.
- Independently decoded archive entry order, YAML metadata, checksums,
  exclusions, and encrypted selection/decryption fixtures: passed.
- Production TypeScript and Vite build: passed.
- Control OpenAPI currency check: passed.
- Full privileged regression with isolated non-repository temp storage:
  117 files and 838 tests passed.

## Delivery commits

- `dfd7ac2` — decision-complete milestone plan
- `b9f9fc2` — portable configuration projection
- `d0118f0` — deterministic portable archive codec
- `f4764a8` — exact vault export selection binding
- `7c16d32` — bounded portable backup coordination
- `979a858` — strict binary backup routes and production wiring
- `e73fd4a` — responsive portable backup workspace

## Residual boundaries

- This is a portable configuration export, not an instance snapshot. Restore is
  implemented by Milestone 22.
- Encryption protects the optional credential payload at rest; operators remain
  responsible for passphrase custody, downloaded-file permissions, retention,
  and off-host storage.
- Credential selection is exact at export time. A concurrent credential
  generation change fails rather than silently exporting a different value.
- Archive processing is bounded in memory, but backups remain intentionally
  expensive and rate/concurrency limited.
- The supported topology remains a single database writer and one owning
  gateway process.
