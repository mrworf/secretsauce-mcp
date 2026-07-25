# Milestone 21 Backup Export Plan

## Outcome and trust boundary

Milestone 21 exports a portable, schema-versioned configuration archive without
copying instance identity, authorization, operational evidence, or deployment
state. A browser-authenticated superadmin may create either a credential-less
archive or an archive with a distinct passphrase-encrypted vault payload after
exact operation-bound step-up. A `system` API-role key may create only the
credential-less form. Admins, ordinary users, and `service`/`all_services` keys
are denied before configuration projection or vault access.

The archive is delivered directly in the successful response and is never
published under a reusable URL. Generation is bounded in memory and produces no
server-side plaintext or public staging file. A failed request zeroes passphrase,
derived/encrypted secret buffers, and any incomplete archive buffer before
returning a stable error.

## Archive format and canonical serialization

The outer format is deterministic POSIX ustar inside gzip:

- fixed entry order: `manifest.yaml`, `services.yaml`, `credentials.yaml`,
  `policies.yaml`, then optional `secrets.enc`;
- regular files only, mode `0600`, uid/gid zero, empty owner/group names, fixed
  archive timestamp, no path prefixes, extensions, links, devices, or sparse
  records;
- 512-byte tar blocks, two zero end blocks, gzip `mtime = 0`;
- at most 10,000 portable objects, 16 MiB per YAML entry, 256 MiB total
  uncompressed payload, and 256 MiB final compressed archive.

YAML uses UTF-8, LF endings, a terminal newline, sorted mappings, deterministic
array ordering, quoted ambiguous scalars, aliases disabled, and no tags. The
portable schema version is `1`, archive type is
`secretsauce-portable-configuration`, and every document repeats its document
kind/version so restore can reject cross-file substitution.

`manifest.yaml` contains archive UUID, product version, created-at UTC
milliseconds, archive type/schema version, `credential-less` or
`encrypted-secrets` mode, included and always-excluded domain lists, object
counts, fixed file order, SHA-256 and byte length for every non-manifest entry,
and encryption metadata when present. It does not checksum itself. The outer
archive SHA-256 is computed after assembly and is recorded only in the safe
administrative audit/result metadata, avoiding a recursive manifest checksum.

## Portable documents and exclusions

`services.yaml` contains stable service/destination UUIDs and slugs, display
metadata, lifecycle, base URL, allowed schemes/hosts/ports, and TLS verification.
It excludes publication revisions/digests/generations, administrators,
assignments, invalidation rows, timestamps, and database versions.

`credentials.yaml` contains stable credential UUID/service UUID, name,
description, placement kind/name, prefix/suffix, explicit header-ownership
setting, and portable enabled/disabled/archived intent. Credential-less exports
always restore-capable definitions as unconfigured and omit vault locator,
generation, last-four, value timestamps, authorization generations, assignments,
and vault-operation state. Secret-bearing exports add only the locator and
generation required to bind an encrypted vault record; last-four remains
excluded.

`policies.yaml` contains stable policy/rule UUIDs, service/optional credential
relationship, name/description, operating mode, lifecycle, reason, effect,
priority, enabled state, methods, hosts, paths, and response safeguards. It
excludes all rule principal selectors, actor fields, revisions, invalidation
state, timestamps, evaluation generations, and database versions.

The manifest always lists excluded identities, roles, authenticators, provider
links, service admins, groups, principal/credential/rule assignments, sessions,
OAuth clients/grants/codes/tokens, API keys and activity, runtime references,
audit/activity, remediations, security/system settings, jobs, deployment/OIDC/
vault/branding configuration, local paths, key material, history, and runtime
generations.

Projection occurs in one serialized persistence read after verifying object and
serialized-size bounds. SQL names only allowlisted columns and never selects
prohibited tables or columns. A structural exclusion test seeds recognizable
canaries in every representative prohibited domain and proves the decoded
archive contains none.

## Filtered encrypted vault payload

Only credentials that are `configured` or `disabled`, have idle vault state,
and carry a complete locator/generation pair are eligible for `secrets.enc`.
The coordinator sorts exact `(service UUID, credential UUID, locator,
generation)` selections and computes a domain-separated SHA-256 operation
digest. It creates a short-lived durable authorization row, then issues a
five-minute one-use backup capability containing the authorization UUID,
superadmin UUID, operation, and exact selection digest.

The backup vault protocol adds a bounded selection to export start. The broker
canonicalizes the selection, verifies its digest against the consumed signed
capability, verifies every selected locator/generation/binding exists, and
exports exactly those records. Missing, duplicate, extra, stale, or malformed
records fail before a completed archive is returned. The existing Argon2id
(64 MiB, three iterations, parallelism one) and chunked AES-256-GCM format is
reused. The manifest records only its public algorithm/KDF parameters, salt/
nonce sizes, payload checksum, and selected count; it never includes the
passphrase, derived key, vault root/caller key, ciphertext internals, or
last-four hints.

The authorization is claimed once before vault export and finalized as
completed or failed with only safe codes/counts/checksums. It expires after five
minutes and bounded cleanup removes expired rows. API keys cannot create an
encrypted authorization or invoke the vault export.

## Control API, delivery, and audit

Add capability `create_portable_backup`: human superadmin and `system` API-role
key allow; every other role denies. Add:

- `POST /api/v2/backups/interactive`: browser-session only, exact exclusions
  acknowledgement, `always` step-up, optional passphrase only when
  `include_secrets` is true, backup rate limit, direct gzip response.
- `POST /api/v2/backups/programmatic`: API-key only, system-role permission,
  exact exclusions acknowledgement, no secret/passphrase fields, backup rate
  limit, direct gzip response.

The route registry gains an explicit bounded binary response contract so
authenticated archive endpoints remain in generated OpenAPI. The handler sets
`application/gzip`, a fixed safe filename, `Content-Disposition: attachment`,
`X-Content-Type-Options: nosniff`, and no-store. It never places passphrases or
archive bytes in URLs, logs, audit, errors, analytics, idempotency state, or
step-up responses. Browser CSRF remains mandatory.

Every attempt produces a sanitized administrative audit containing archive UUID,
actor/key safe identity, mode, counts, included/excluded domain names,
acknowledgement, archive byte length/SHA-256 when successful, stable failure code,
and outcome. It contains no response body, passphrase, secret-derived suffix,
vault locator, ciphertext, or local path. Backup never mutates portable live
configuration or invalidates sessions/references.

## Browser UX and deployment

Add a superadmin-only Backup workspace. It defaults to portable configuration
only, presents the permanent exclusion warning before creation, and makes the
encrypted-value option visually distinct. Passphrase and confirmation are body
only, 12–1,024 UTF-8 bytes, never persisted, and cleared after every attempt;
non-secret acknowledgement/selection survives a recoverable failure. Successful
responses use a browser Blob download and immediately revoke the object URL.

Production exposes the backup-vault client only through the backup caller key
and socket configuration. Credential-less export works without a vault client.
If the backup client is absent or unavailable, encrypted export fails with a
generic vault-unavailable response while credential-less export remains usable.
Container guidance mounts the backup caller key only into the process authorized
to perform backup coordination; it is not a control or data-plane capability.

## Minimal delivery slices

1. Migration 0021 for short-lived one-use backup authorizations/outcomes,
   portable projection schemas/repository, exact allowlisted columns, canonical
   YAML, counts/size bounds, and positive/negative exclusion fixtures.
2. Deterministic bounded tar/gzip codec, manifest/checksum rules, parser fixture
   used only by tests/future restore, Unicode/empty/max boundaries, malformed
   entry defenses, and no partial artifact behavior.
3. Filtered vault-record selection, selection-bound backup capabilities,
   broker/client protocol, exact/missing/stale/extra record tests, passphrase
   zeroization, KDF/resource bounds, and real broker integration.
4. Backup coordinator with browser/system-key authorization split,
   authorization claim/finalization/cleanup, sanitized success/failure audit,
   concurrency/rate bounds, and no live-configuration mutation.
5. Authenticated binary route-registry/OpenAPI support, strict interactive and
   programmatic APIs, CSRF/step-up/role/secret-field negative tests, and
   production wiring.
6. Responsive Backup workspace, warnings, encrypted option, secure Blob
   download and secret clearing, loading/error states, and accessibility tests.
7. Operator/archive-format documentation, container key-boundary example,
   production builds, OpenAPI currency, full regression, acceptance review,
   and milestone status.

Each completed slice receives positive and negative unit tests, the full
regression suite, and one concise commit. Durable findings are added to
`AGENTS.md`.

## Acceptance matrix

- Projection: every portable field survives, every prohibited domain/column and
  last-four canary is absent, deterministic ordering, empty/Unicode/max objects.
- Archive: exact entry names/order/modes, gzip/tar bounds, checksums/counts,
  schema/product/type metadata, truncation/duplicate/extra/path/link rejection.
- Secrets: correct passphrase decrypts exact selected configured values; wrong
  passphrase/tampering is uniform; missing/stale/extra vault records, unavailable
  vault, passphrase boundaries, and interrupted export leave no usable artifact.
- Authorization: browser superadmin plus exact step-up for both modes, system key
  credential-less only, every other human/key role denied, CSRF and backup rate
  limits enforced before projection/vault work.
- Delivery/audit: direct no-store attachment, no reusable URL/file, safe filename,
  safe success/failure audit, no passphrase/archive/ciphertext/path/suffix in
  logs/audit/error or persistent state.
- UX/integration: permanent exclusions warning, secure encrypted option,
  passphrase cleared after success/failure, produced archive independently
  inspected and checksummed, production broker path exercised, OpenAPI current,
  and full regression pass.

