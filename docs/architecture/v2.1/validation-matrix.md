# SecretSauce v2.1 Executable Validation Matrix

Status: approved implementation and release-evidence baseline.

Every implementation milestone replaces the planned evidence below with named
passing tests. A positive and negative case is mandatory for each new external
input. Security-sensitive tests assert both the outcome and that no domain/store
access, credential substitution, downstream I/O, or prohibited diagnostic
material occurred.

## Requirement and acceptance ownership

| Family | Primary milestone | Required evidence |
| --- | ---: | --- |
| `VAULTAPI-001`–`VAULTAPI-008`; Acceptance 21.7 | 01 | OpenAPI parse/conformance, strict HTTP, caller/response authentication, endpoint validation, allowlist, boot invalidation, no TCP |
| `SETUP-001`–`SETUP-007`, `009`, `013`, `015`–`020`, `023`–`024`, `026`; Acceptance 21.1 except rotation/browser gates | 02 | Fixed registry, manifest/adoption/inventory matrices, retry and privilege-drop process tests |
| `SETUP-008`, `010`–`012`, `014`, `021`–`025`; `HEALTH-001`–`HEALTH-009` | 03 | Public state projection, setup-only composition, Compose topology and restart continuity |
| `SETUP-027`–`SETUP-028`; Acceptance 21.1.28–30 | 04 | Both root targets, journal interruption/resume at every phase, conditional rewrap, atomic receipt |
| `ENROLL-001`–`ENROLL-013`; Acceptance 21.2 | 05 | Neutral browser ceremony, atomic first user, race, expiry/restart, secret-channel absence |
| `LOGIN-001`–`LOGIN-007`, `LOGOUT-001`–`LOGOUT-006`, `SESSION-001`–`SESSION-008` | 06 | Uniform login, session fixation/CSRF/expiry/revoke, logout commit/failure/retry browser evidence |
| `ABUSE-001`–`ABUSE-015`, `SOURCE-001`–`SOURCE-009`; Acceptance 21.3 | 07 | Rate/concurrency boundaries, timing method, suspension race, proxy matrix and configuration failures |
| `RECOVER-001`–`RECOVER-007`; Acceptance 21.4 | 08 | Reactivation/reset/break-glass matrices, TOTP reset/retention, restricted authority |
| `ACCESS-001`–`ACCESS-012`; Acceptance 21.5.3–9 and 21.6.3–5 | 09 | Own/admin visibility, stale-scope deciding transaction, atomic bulk, deletion/idempotency |
| PRD Sections 14–23; all Acceptance 21 groups | 10 and affected milestones | Full suite/build/OpenAPI, Compose fresh/recreate, browser/accessibility, ChatGPT/Codex, docs, secret scan |

## External-input registry

| Input | Valid/positive classes | Negative and boundary classes |
| --- | --- | --- |
| Setup adoption setting | Absent; exact boolean `true` with complete compatible keys | Empty/string/number; partial/no keys; incompatible or unavailable adapter; retained or indeterminate state |
| Setup key/manifest/store files | Exact owner/mode/type, canonical manifest, complete fixed registry | Missing verified key; mismatch; symlink/device/directory; partial/future registry; corrupt checksum; unwritable/full filesystem |
| Rotation CLI | Exact target `identity` or `vault` plus fresh canonical UUID | Missing one arg; unknown target; alternate UUID encoding; conflicting completed UUID; concurrent request; remote input |
| Private status request | Exact `GET /v1/status`, no query/body | Other method/path; query; body; content headers; oversized/slow/incomplete request |
| Vault endpoint metadata | Expected Unix socket, vault owner/mode, non-symlinked read-only parent | Absent; regular file; symlink component; wrong owner/mode; client-writable/replaced socket |
| Vault HTTP target/framing | Origin-form route, one length or valid bounded chunking where declared | Absolute/authority/asterisk form; encoded routing ambiguity; duplicate security header; conflicting length/transfer; upgrade; invalid UTF-8 |
| Vault caller auth | Exact caller, logical audience/version, method/target/representation, raw digest, UUID, timestamp, nonce, canonical MAC | Missing/duplicate; caller/audience/field/body tamper; noncanonical base64url; stale/future; nonce replay; wrong boot |
| Vault response auth | Exact caller, boot, request UUID, status, representations, raw digest, canonical MAC | Unsigned post-auth; forged/replayed; wrong caller/boot/request/status/header/body; parse attempted before verify |
| Vault domain inputs | Closed metadata, generation 1–safe integer, fixed operation/caller, valid capability | Unknown field; zero/fraction/unsafe generation; cross-caller operation; missing/replayed/wrong-bound capability |
| Vault streams | Declared media type, chunks 0–1 MiB, sequence 0–1,048,575, aggregate 0–1 GiB | Wrong media; empty when prohibited; over chunk/aggregate; duplicate/gap/out-of-order; close/timeout; digest mismatch |
| Enrollment code/flow | Bounded code, canonical UUID, live ceremony | Empty/overlong; malformed UUID; invalid/expired/replayed/restarted; concurrent completion |
| Password/TOTP | Password 12–1024 bytes and policy-valid; six ASCII digits | Short/overlong/common; invalid UTF-8; non-ASCII/lookalike/five/seven digit; reused TOTP; stale ceremony version |
| Login destination | Absent or normalized same-origin relative path if implementing `LOGIN-007` | Absolute, scheme-relative, backslash/control, encoded cross-origin, authentication/setup route loop |
| Login identity/secrets | Email 3–320 chars, password 1–1024 bytes, six digits | Empty/over bounds/invalid encoding/unknown fields; nonexistent/ineligible/wrong password/wrong TOTP uniformity |
| Protective-limit environment | Canonical unsigned decimal in documented range; window `[1-9][0-9]*m`; missing uses default | Empty, whitespace, sign, leading zero, decimal/exponent, unsafe/out-of-range; per-source above global |
| Client-source configuration | `direct`; `trusted_proxies` with canonical nonempty IP/CIDR set; `always`; supported header enum | Unknown/empty mode/header; hostnames; malformed/noncanonical CIDR; trusted mode empty; duplicates/ambiguous networks |
| Forwarding field | Absent fallback; selected format, ≤4096 bytes, ≤32 IP literal hops, valid optional ports | Over bytes/hops; empty hop; hostname/obfuscated/`unknown`/zone; duplicate/ambiguous field; invalid quote/bracket/port |
| Suspension setting | Disabled or integer 3–20 plus current version | Boolean/type confusion; 2/21; fraction; stale/missing version; unknown field |
| Cookie/session/CSRF/origin | Exact opaque cookie hash, current epoch/expiry, expected CSRF and same origin | Missing/duplicate/malformed; fixation; restricted cookie used normally; expired/revoked/stale epoch; cross-origin |
| Pagination/filter | Limit 1–100, supported closed filters, opaque cursor ≤512 | 0/101/fraction; unknown filter; malformed/overlong/cross-scope cursor; stale cursor safe behavior |
| Session/grant target | Canonical UUID, visible current target, expected version | Alternate UUID encoding; unknown/deleted; other user; admin target; stale version/scope/list |
| Bulk confirmation | Exact server-displayed phrase and allowed bounded scope | Case/spacing mismatch; incomplete/over-limit scope; initiating session incorrectly excluded |
| Justification/idempotency | Justification 1–1000 chars; canonical UUID; exact repeat body | Empty/overlong/control markup; malformed UUID; same key/different body; expired/deleted target |
| User agent/source metadata | UTF-8 ≤512 bytes; canonical address | Invalid/overlong/control/markup; ambiguous family; IPv4-mapped IPv6; missing value -> `Other`/`Unknown` |

## State, concurrency, and interruption scenarios

| Scenario | Positive result | Negative/failure assertion | Seam |
| --- | --- | --- | --- |
| Fresh provisioning | Progressive manifest, each fixed key verified, configured once | Failure after every create/manifest sync resumes without rotation | After preflight, create, fingerprint, entry replace, configured replace |
| Adoption | Complete compatible set adopted unchanged | None/some keys, adapter failure, retained state change nothing | Inventory and each adapter validation |
| Configured key loss | Matching set reaches ready | Missing/mismatch/future identity stays status-only; no retry/create/socket | Before credential listener |
| Root rotation | Both targets rewrap and commit exact receipt | Crash/corrupt/missing/nonzero reference never operational | Journal create, stage, activate, each batch, inventory, manifest/receipt, retire |
| Initial enrollment | One complete superadmin and audit | Concurrent contender, DB/audit failure, restart/expiry creates no user | Before zero-user check, each verifier, before/after transaction |
| Login/suspension | Valid session; threshold atomically suspends | Nonqualifying/rate event no count; concurrent qualifying events count once | Password result, TOTP result, counter insert, deciding transaction |
| Logout | Revoke+audit then clear cookie | Persistence/audit failure returns 503 and keeps cookie/session; retry commits once | Before revoke, audit insert, commit acknowledgement |
| Admin revoke | Current exact scope commits all effects | Scope/role/eligibility changes after list produce no mutation/disclosure | Barrier before deciding transaction |
| Bulk revoke | Boundary-size target set commits atomically | Limit+1, disk/audit failure, lock conflict leaves all active | Preflight count, mutation, dependent revoke, audit, commit |
| Physical cleanup | Eligible tombstones removed with audit preserved | Young/live/no-audit/idempotency-live rows retained | Each predicate and bounded batch cursor |

## Timing-comparability method

Local-login security tests use warmed workers, fixed fixtures, fake network I/O,
and at least 500 samples per failure class. They compare nonexistent,
suspended, deactivated, incomplete, wrong-password, and wrong-TOTP paths after
removing the slowest and fastest 1%. The median class must remain within 15% of
the slow-verification reference and no class may have a 95th percentile less
than 70% of it. Statistical evidence is a regression signal, not a claim of
identical timing. CI records aggregates only, never submitted values or user
identifiers.

## Compose and topology evidence

Automated deployment inspection and process tests must prove:

- vault has `network_mode: none` or no attached network in every phase, not
  merely no published port;
- only the vault mounts key/setup/state volumes writable;
- status and credential socket parents are distinct and vault-owned;
- every client socket mount is read-only and cannot bind, unlink, rename, or
  replace an endpoint;
- vault and application start concurrently without a health dependency cycle;
- setup-only application opens status/liveness but no SQLite writer, ordinary
  web/control, OAuth, MCP, or downstream path;
- credential socket is absent until configured commit and privilege drop;
- clean start, blocked retry, fatal configuration, ready, container recreation,
  and vault-only restart produce the specified projections and continuity.

## Browser and accessibility evidence

Vitest component tests cover semantics, labels, focus, error summaries, secret
clearing, and failure state. A real-browser suite covers 320×640, 768×1024, and
1280×800; keyboard-only completion; 200% zoom; reduced motion; live regions;
dialog trapping/restoration; logout injected failure/retry; neutral enrollment;
current-session bulk effects; stale admin scope; and automated WCAG 2.2 AA
violations. Manual review records screen-reader wording, contrast, reflow, and
the sensitive TOTP reveal/copy experience.

## Secret and diagnostic evidence

Each designated delivery channel has a positive canary test. The same canary is
asserted absent from unrelated responses, errors, logs, audit, telemetry,
browser storage, OpenAPI examples, status, and operator diagnostics. Tests also
cover raw headers, cookies, forwarding chains, user agents, full IPs, request
and downstream response bodies. Encoded/reflected variants are best-effort
defense only; evidence must not claim universal non-exfiltration.

## Commands and release evidence ownership

| Gate | Command/evidence | Owner |
| --- | --- | --- |
| Focused unit/integration | Milestone-specific Vitest files documented in each plan | Implementing engineer |
| Server/web build | `npm run build` | Implementing engineer |
| Canonical full suite | `npm test` | Implementing engineer |
| Public OpenAPI | `npm run check:control-openapi` | Implementing engineer |
| Private OpenAPI/readiness docs | `node scripts/validate-v2.1-readiness.mjs` plus Milestone 01 conformance suite | Implementing engineer |
| Release artifacts | `npm run scan:release-artifacts` | Release owner |
| Container/Compose | `npm run smoke:container` and v2.1 Compose scenario script | Release owner |
| Browsers/accessibility | Real-browser report plus manual checklist | UX/accessibility reviewer |
| ChatGPT and Codex | Fresh OAuth/MCP setup and post-revocation evidence from both clients | Release owner |
| Security/architecture | Cumulative diff, threat-boundary tests, dependency/crypto review | Named reviewer |

When `npm test` fails with `listen EPERM`, rerun the same command with loopback
permission. Resource failures are recorded as environment defects; tests and
timeouts are not weakened.

## Milestone 01 and 02 handoff

Milestone 01 owns every private route/header/body/media/caller combination plus
endpoint, response, replay, and boot negative tests. Milestone 02 owns the full
manifest/adoption/retained-state matrix and interruption seam. Shared fixtures
use deterministic clocks/randomness, fake closed store adapters, real Unix
sockets, filesystem owner/mode fixtures, and child-process crash barriers.
