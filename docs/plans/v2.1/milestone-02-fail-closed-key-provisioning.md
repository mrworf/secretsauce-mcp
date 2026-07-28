# Milestone 02: Fail-Closed Key Provisioning

## Outcome

The vault entrypoint is the single writer and generator for the fixed v2.1
application-key registry. It converges only a provably fresh or explicitly
adopted installation to a checksum-protected configured manifest, retains only
bounded status during retryable/fatal setup, drops setup authority before
opening the credential socket, and never replaces continuity keys.

## Governing contracts

- PRD `SETUP-001`–`SETUP-007`, `SETUP-009`, `SETUP-013`,
  `SETUP-015`–`SETUP-024`, `SETUP-026`, and Acceptance 21.1.
- Milestone
  [`02-fail-closed-key-provisioning.md`](../../milestones/v2.1/02-fail-closed-key-provisioning.md).
- Architecture
  [`provisioning.md`](../../architecture/v2.1/provisioning.md),
  [`decisions.md`](../../architecture/v2.1/decisions.md), and
  [`validation-matrix.md`](../../architecture/v2.1/validation-matrix.md).
- Milestone 01 private REST/status boundary and repository `AGENTS.md`.

## Current-state findings

- `src/vault/keyFile.ts` already provides canonical 32-byte base64url
  validation and atomic no-replace creation with file/directory sync.
- `src/vault/config.ts` currently assumes every key already exists and loads
  key bytes before the broker starts. Provisioning therefore needs a structural
  config phase that does not read keys, followed by configured runtime loading.
- `src/vault/main.ts` starts both sockets together. The composition must start
  status first, run/validate provisioning, irreversibly release setup writers,
  and only then start the credential server.
- Milestone 01 made the status response and credential listener distinct, but
  the broker still owns both in one `listen()` call. This milestone will expose
  explicit lifecycle methods without changing resource authorization.
- The full permission-correct baseline after Milestone 01 passes, as do build,
  OpenAPI, readiness validation, and release-artifact scanning.

## Decisions

- The fixed registry is a tuple of exactly the eleven PRD logical identities.
  Each entry declares one closed adapter ID, format/version, consumer set, and
  configured absolute path. Feature flags never filter this registry.
- Symmetric identities use the existing canonical 32-byte base64url adapter.
  `oauth.signing` uses a dedicated asymmetric signing-key adapter; adapter
  format details are closed and independently validated.
- The canonical manifest is strict JSON with deterministic key ordering,
  version, installation UUIDv4, state, fixed entries, optional configured
  aggregate, retry metadata, and a domain-separated SHA-256 checksum. Atomic
  state replacement uses write–sync–rename–directory-sync; key creation remains
  no-replace.
- Store inventory is a closed registry returning only `absent_or_empty`,
  `present`, or `indeterminate`. Structural configuration supplies every
  recognized store path. Inspection errors are indeterminate.
- Adoption is a deployment-only Boolean in vault configuration. It is honored
  only without a manifest and with the complete valid key set; it becomes
  inert after configuration.
- The entrypoint owns the approved single-timer monotonic retry sequence
  (1/2/4/8/16/30 seconds, 0.75–1.25 cryptographic jitter). Durable state is
  re-read for every attempt. Only fresh pending write failures retry.
- A narrow setup-authority object owns key/setup-state writes and is
  irreversibly closed before the credential listener starts or status-only
  fatal service remains. Tests prove post-close calls fail.

## Slice plan

### Slice 1: Fixed registry and durable manifest primitives

**Contract:** represent, validate, fingerprint, checksum, and atomically persist
the exhaustive fixed registry and progressive manifest without starting
provisioning.

**Included:** key/store adapter registries, structural config paths, canonical
fingerprints and aggregate, strict manifest codec, atomic no-replace manifest
creation/replacement, bounded status/retry state, positive and negative unit
tests.

**Excluded:** startup matrix, adoption execution, retry loop, listener/privilege
lifecycle.

**Evidence:** exact registry independent of features; unknown/missing/duplicate
identity and adapter rejection; raw/malformed/checksum/future-version manifest
rejection; restrictive setup-state modes; atomic persistence; fingerprints and
aggregate contain no raw key. Run
`npx vitest run test/vault-provisioning-registry.test.ts
test/vault-provisioning-manifest.test.ts` and `npm run build:server`.

### Slice 2: Preflight, adoption, and convergent provisioning

**Contract:** apply the authoritative no-manifest/key/store/adoption matrix and
converge permitted fresh/adopted state without replacement.

**Included:** closed retained-store inventories, full preflight, progressive
pending/verified transitions, configured aggregate commit, retry classifier and
scheduler, failure injection, sanitized status.

**Excluded:** process privilege drop and application setup-only composition.

**Evidence:** full none/some/all-key and retained-state matrix; complete valid
adoption; every per-key interruption/restart; malformed pending, verified, and
configured mismatches; retry timing/cap/cancellation; no-write assertions.
Run `npx vitest run test/vault-provisioning.test.ts
test/vault-provisioning-retry.test.ts`.

### Slice 3: Entrypoint authority and listener/deployment lifecycle

**Contract:** status remains available throughout setup, credential service
opens only after configured commit and irreversible setup-authority release,
and configured startup validates rather than regenerates.

**Included:** broker split lifecycle, vault entrypoint composition, structural
then runtime config, runtime manifest validation, Compose volumes/no-network,
process crash/restart/adoption/privilege evidence, documentation.

**Excluded:** public application setup projection (Milestone 03) and root
rotation (Milestone 04).

**Evidence:** process matrix and restart continuity, status-only fatal/retry,
credential absence before drop, post-drop write denial, configured validation,
read-only consumer mounts, no network attachment. Run focused provisioning,
vault process, deployment, config, and runtime tests, then build, OpenAPI,
readiness validator, release scan, and permission-correct full suite.

## Cross-slice constraints

- No raw key, header, capability, credential, protected store content, or
  downstream body enters diagnostics, manifests, status, or tests.
- All manifest/config/inventory inputs have positive and negative tests.
- No service-specific tool, profile pack, remote setup trigger, general plugin
  registry, reset, clear, or regenerate-all path is introduced.
- Key and manifest filesystem writes remain bounded, atomic, restrictive, and
  separately authorized.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | `66a2b91` | 6/6 registry/manifest tests; server build; negative external-input and unsafe-storage cases included | Asymmetric signing-key generation/validation moved with the adapter execution lifecycle in Slice 2. |
| 2 | completed | `36c8066` | 14/14 registry/manifest/provisioning/retry tests; server build; fresh/adoption/partial/retained/pending/configured/future-state and real RSA/symmetric adapter cases | Durable retry metadata is best-effort status only and never authorizes a transition; every retry re-reads the authoritative manifest and key/store state. |
| 3 | completed | `7ead067` | 48/48 focused lifecycle/protocol/process tests; real mapped-root UID/GID drop; 996/996 bounded-worker full suite; build, OpenAPI, readiness, release scan | Public setup-only application composition remains Milestone 03. The host's unconstrained Vitest worker count caused unrelated five-second authentication timeouts; every unchanged test and timeout passed with four file workers. |
