# Milestone 18 Security Settings And Automation Plan

## Outcome and boundary

Milestone 18 makes the approved identity, lifetime, abuse-control, and
inactivity settings durable and bounded in database mode. It adds qualifying
human activity, leased inactivity automation, and system-wide password/TOTP
events without weakening immediate epoch invalidation or last-active-
superadmin protection.

YAML remains the deployment bootstrap and fallback for installations without
database identity. On first database initialization, validated YAML values
seed the durable settings row. After that row exists, database settings are
authoritative for supported runtime controls; restart does not overwrite them.
Paths, encryption/signing keys, OIDC provider trust, listener values, and
other deployment-only configuration remain YAML-owned.

This milestone does not add audit search/dashboard presentation, backup or
restore behavior, notification, password composition/expiry, passkeys,
recovery codes, or human-inactivity effects on system-owned API keys.

## Durable schema and initialization

Migration 0018 adds:

- `security_settings`, one `singleton = 1` row with strict checks, current
  password-policy version, all supported values, positive optimistic
  `version`, and timestamps;
- `security_global_events`, immutable UUIDv7 rows for `password_change` and
  `totp_reset`, actor UUID/role, safe justification, affected local-user
  counts, resulting global epoch/policy version, and time;
- `security_job_state`, one row per `inactivity` job with due time, bounded
  lease owner/expiry, cursor, last-start/completion times, safe outcome/code,
  affected counts, and version;
- `users.last_qualifying_activity_at`, `suspended_at`,
  `suspension_origin` (`manual` or `inactivity`), and nullable positive
  suspension-rule version;
- `identity_security_state.password_policy_version` and
  `password_change_epoch`, both positive;
- `local_password_credentials.password_change_epoch`, recording the global
  password event satisfied by the current hash.

The settings row is inserted transactionally by
`SecuritySettingsRepository.initialize` using the already validated
deployment configuration and product defaults. Concurrent initializers use
insert-or-read and must converge on the same stored row. Schema and domain
validation are duplicated deliberately: malformed database state fails
startup/readiness rather than being clamped.

The current password-policy version increments only when minimum length
increases or the blocklist policy marker increases. Minimum length may later
decrease without rewriting existing password markers. The blocklist marker is
positive, begins at the bundled/operator policy version, and is monotonic.
Changing the marker asserts that the already deployed offline blocklist is
stricter; the UI/API never accepts a filesystem path or blocklist contents.

## Settings schema, defaults, and hard ranges

Durations are represented as integer milliseconds in storage/API responses
and as bounded numeric controls in the browser.

| Setting | Default | Range / invariant |
| --- | ---: | --- |
| password minimum Unicode code points | 12 | 8–128 |
| blocklist policy version | 1 | 1–2,147,483,647; cannot decrease |
| admin absolute session | 12 h | 1–24 h |
| admin inactivity | 15 min | 5 min–2 h; strictly below absolute |
| user absolute session | 24 h | 1–72 h |
| user inactivity | 1 h | 5 min–24 h; strictly below absolute |
| OAuth access token | 5 min | 1–15 min |
| refresh inactivity | 30 d | 1–90 d |
| refresh absolute | 90 d | 7–365 d; at least inactivity |
| step-up mode | `five_minutes` | `five_minutes` or `always` |
| login attempts/window | 10 / 15 min | 3–20 / 5–60 min |
| password attempts/window | 10 / 15 min | 3–20 / 5–60 min |
| TOTP attempts/window | 5 / 5 min | 3–10 / 1–15 min |
| management API attempts/window | 120 / 1 min | 10–600 / 1–60 min |
| search/report attempts/window | 30 / 1 min | 5–120 / 1–60 min |
| backup attempts/window | 2 / 60 min | 1–10 / 15–1,440 min |
| inactivity suspension | disabled | disabled or 1–3,650 whole days |
| suspended deactivation | disabled | disabled or 1–3,650 whole days |
| security-job interval | 5 min | 1 min–24 h |
| security-job batch | 500 | 50–2,000 |
| security-job wall time | 30 s | 5–120 s |

Existing verifier-pool capacity limits remain deployment controls. Settings
updates reject unknown fields, non-integers, inconsistent lifetime pairs,
out-of-range values, stale versions, NUL/newline-bearing justification, and a
body larger than the ordinary management bound.

## Authoritative in-process view

`SecuritySettingsStore` owns one deeply immutable validated snapshot and a
monotonic version. Control and data-plane construction load it after
persistence migration/initialization. A successful settings transaction
returns the committed row; only then does the process atomically replace the
snapshot. Failed or stale mutations leave it unchanged. Startup always reloads
the durable row.

SecretSauce supports one active instance, so this store is not a distributed
cache. Components read it synchronously at the point of enforcement:

- password validation and post-verification policy checks;
- browser-session validation and new-session issuance;
- database OAuth token/grant validation and issuance;
- browser step-up mode selection;
- local login/password/TOTP limiters;
- API-key/control search/backup rate limiters;
- inactivity-job due/batch/wall-time decisions.

Lower session/grant lifetimes use
`min(issued_value, current_setting)` during every validation, so reductions
affect existing state. Increases never extend existing absolute or inactivity
records and apply only at issuance. Refresh inactivity remains based on the
last qualifying token-family use; a refresh operation never updates human
inactivity activity.

Rate-window changes apply to new checks. Existing counters retain their
original reset timestamp; the current attempt limit is compared to the
current setting. Bounded maps are not enlarged by configuration.

## Password policy transition

Password hashes are never inspected or guessed. Local login performs the
existing comparable-work hash verification first. Only after a successful
hash match does it normalize and validate the supplied password against the
current minimum/blocklist/context policy.

- If the credential already records the current policy version, login
  continues normally.
- If the marker is old and the supplied password is compliant, a
  compare-and-set transaction advances the user/credential policy markers and
  records qualifying login activity before ordinary TOTP completion.
- If the marker is old and the supplied password is noncompliant, SecretSauce
  consumes successful password/TOTP verification and issues the existing
  restricted `password_change` session instead of an ordinary browser
  session. The public login response does not reveal the policy reason.
- A global password event increments `password_change_epoch`; every older
  local credential is routed to restricted password change even when its
  value still satisfies policy. The hash is preserved only to enter that
  restricted flow.
- Completing password change writes the current policy and password-change
  epochs, increments the user security epoch, and revokes other restricted
  state as the existing flow requires.

OIDC-only users have no local hash and are excluded from password-policy and
global-password affected counts. Linked users with configured local
credentials are included for local login while external-provider
authentication remains provider-owned.

## Qualifying human activity

`last_qualifying_activity_at` is initialized from the greatest available
successful login/authentication time, otherwise account creation time.
Updates are monotonic and coalesced to at most one durable write per user per
minute.

Qualifying events are:

- successful local or assured OIDC interactive login;
- an authenticated MCP HTTP request for an eligible human OAuth principal,
  after token authentication and before tool dispatch;
- a successful management mutation authenticated by a browser human;
- a successful management read explicitly marked by the first-party browser
  with `x-secretsauce-user-activity: interactive`.

The session polling endpoint, OAuth refresh/token exchange, maintenance,
health/readiness, and unmarked browser background reads do not qualify.
API-key requests never update creator or target human activity. The
interactive marker is accepted only on an authenticated browser session,
contains a fixed literal, is excluded from audit, and affects only that
session's user; spoofing it cannot affect another principal or grant
authority.

Activity and automation race through conditional transactions. An inactivity
transition succeeds only if the user is still in the expected state and the
stored activity remains at or before the exact cutoff. If activity commits
first, suspension loses. If suspension commits first, later authentication is
denied until an authorized justified reactivation.

## Inactivity automation

The single inactivity task runs through the existing maintenance registry but
uses durable `next_run_at` and a lease. A random non-secret process UUID can
acquire an expired/due lease for at most the configured wall time plus one
minute. Restart or failure therefore permits retry without duplicate state
changes.

Each run processes at most the configured batch and wall time:

1. Active users with `last_qualifying_activity_at <=
   now - suspension_days * 86_400_000` are candidates when suspension is
   enabled.
2. Suspended users with `suspended_at <=
   now - deactivation_days * 86_400_000` are candidates when deactivation is
   enabled.
3. Candidates are ordered by cutoff time then UUID. Each update predicates
   exact prior state/cutoff, increments security epoch and version, persists
   origin/rule version, emits invalidation, and appends a self-contained
   automated audit in the same transaction.
4. Ordinary users/admins are processed before superadmins. A superadmin
   transition additionally proves more than one active superadmin remains in
   that transaction. The final active superadmin is skipped and recorded as a
   bounded safe job outcome, never retried in a tight loop.
5. Deactivation reuses the existing authenticator/session/grant/reference
   cleanup invariant. Suspension preserves authenticators but invalidates
   authorization state.

The cursor is advisory and safe to restart; state predicates provide
idempotency. At completion the lease is cleared, next due time is based on the
current interval, and safe counts/outcome are stored. Disabled automation
still advances job state without touching users.

Manual reactivation remains the existing authorized, stepped-up, justified
operation. It clears suspension time/origin/rule metadata, increments the
security epoch, and audits the prior automated/manual origin. Automation never
silently reactivates a suspended account.

## Global security events

Add exact-operation, browser-only superadmin routes:

- `POST /api/v2/security/events/password-change`
- `POST /api/v2/security/events/totp-reset`

Both require `stepUp: always`, current global-state `If-Match`, idempotency,
justification, and exact high-friction acknowledgement:

- `REQUIRE ALL LOCAL USERS TO CHANGE PASSWORDS`
- `ERASE ALL LOCAL TOTP AUTHENTICATORS`

The password event transaction:

- revalidates the active initiating superadmin and proof;
- increments global security epoch and password-change epoch;
- revokes all browser/restricted sessions, OAuth codes/grants/families/tokens,
  and advances the global runtime-reference epoch;
- preserves password hashes solely for restricted password-change entry;
- records the number of local credentials/users affected;
- appends immutable event, invalidation, and administrative audit rows.

The TOTP event transaction performs the same global invalidation, deletes all
local TOTP authenticators and accepted/pending steps, changes local TOTP state
to `not_configured`, revokes restricted sessions, and records affected counts.
Every local account with a password can enter the existing restricted TOTP
enrollment after password verification. The initiator's response may complete,
but its cookie is invalid immediately after commit.

System-owned API keys and verifier rows are deliberately not selected,
revoked, epoch-bound, or counted. API-key authentication is hard denied on
both routes. A transaction failure changes no epoch/authenticator/state and
creates no success audit. Idempotent replay returns the original safe counts
without repeating the event.

## API, permission, and audit contracts

Add:

- `GET|PATCH /api/v2/security/settings`
- `GET /api/v2/security/events`
- `GET /api/v2/security/jobs/inactivity`
- `POST /api/v2/security/jobs/inactivity/run`
- the two global-event routes above.

All schemas are strict, bounded, no-store, and versioned with strong ETags.
Browser superadmins can read/update every setting. Browser changes require
configured human step-up and justification. Changes to password policy,
session/grant lifetimes, step-up mode, inactivity rules, or security-job
execution require the exact acknowledgement
`I ACCEPT SYSTEM-WIDE SECURITY POLICY CHANGES`.

The `system` API role may read settings and patch only management/search/backup
rate values plus job interval/batch/wall-time bounds. It cannot change
password, session/grant, step-up, login/password/TOTP, or inactivity values;
cannot run jobs; and cannot call global-event routes. Service and all-services
keys remain denied. The route performs field allowlisting before mutation, and
the static permission matrix remains the outer check.

Settings audits contain field names and safe old/new numbers/enums/null,
settings versions, actor UUID/role, justification, and request ID. Automation
audits use system actor label `security-inactivity-job` plus settings version
and cutoff category. Global-event audits contain kind, event UUID, epoch,
affected counts, and justification. They never contain passwords/hashes,
TOTP seeds/codes, session/grant/token/reference IDs or values, cookies,
Authorization headers, request bodies, or blocklist contents/paths.

## Browser UX

Replace the Security placeholder with a responsive page:

- all human roles retain a concise personal-security link/status;
- superadmins receive grouped password, session/grant, step-up, abuse,
  inactivity, and job forms with current version and visible bounds;
- dangerous changes show the exact acknowledgement, justification, and
  password/TOTP step-up fields, preserving non-secret edits after stale/error;
- job state shows last/next run, outcome, counts, and a stepped-up manual-run
  control;
- global password and TOTP actions are separate danger panels with exact
  consequence/target copy and their distinct acknowledgements;
- successful global TOTP reset transitions to a signed-out message;
- no UI state or error redisplays password, TOTP, session IDs, tokens,
  hashes, seeds, or raw API keys.

The first-party request layer marks only user-initiated management reads as
interactive. Existing automatic session/bootstrap refresh calls remain
unmarked.

## Minimal delivery slices

1. Migration 0018, settings schema/repository/store, YAML initialization,
   exact defaults/ranges/invariants, optimistic mutation, API-role field
   allowlist, and positive/negative/boundary tests.
2. Wire dynamic password/session/OAuth/step-up and rate settings into issuance
   and validation, including reduction/increase semantics and regression
   tests.
3. Post-verification password-policy transition and global password-change
   epoch restricted flow with compliant/noncompliant, blocklist, and
   enumeration-safe tests.
4. Qualifying activity writes across local/OIDC login, MCP, and browser
   management; explicitly exclude refresh/API-key/background activity; test
   coalescing and exact races.
5. Durable leased inactivity job, last-superadmin predicate, conditional
   suspend/deactivate, manual reactivation cleanup, job API/readiness, and
   retry/cutoff/concurrency tests.
6. Atomic system-wide password and TOTP events, exact step-up/idempotency,
   total invalidation, API-key preservation, initiating logout, strict routes,
   and integration tests.
7. Responsive Security settings/job/global-event UX, exact confirmations,
   non-secret edit preservation, sensitive-field clearing, role visibility,
   and accessibility tests.
8. Operator/security documentation, production builds, OpenAPI currency,
   full regression, acceptance review, and milestone status.

Each slice receives positive and negative tests, a bounded full-suite
regression, and one concise commit. New external fields/headers/routes receive
invalid, unknown, oversized, wrong-role, and stale/replay coverage.

## Acceptance matrix

- Settings: every default/min/max, below/above/unknown, stale/concurrent update,
  cross-field lifetime constraints, restart persistence, failed-store
  immutability, system-key allow/deny fields, and sanitized old/new audit.
- Runtime settings: shorter existing and longer new session/grant behavior,
  step-up mode changes including route-level `always`, rate-window changes,
  and no unsupported distributed-cache claim.
- Password policy: 8/12/128, Unicode, blocklist/context, stricter minimum and
  marker, compliant marker advance, noncompliant restricted flow, global event
  force, wrong-password comparable failure, and no hash inspection.
- Activity: local/OIDC login, MCP, browser mutation/marked read; background
  session/read, OAuth refresh, API-key use, failure, coalescing, monotonic
  clock, and activity-versus-job transaction ordering.
- Automation: disabled defaults, exact cutoff on both transitions, batch/wall
  bounds, lease expiry/retry, idempotent state predicates, manual origin,
  final-superadmin skip, concurrent superadmin transitions, and immediate
  session/grant/reference denial.
- Global events: all local users including superadmins, linked/OIDC-only
  distinctions, current proof/version/acknowledgement, replay/stale/concurrent
  events, total session/grant/reference invalidation, password hash
  preservation only for restricted entry, TOTP seed/step deletion, initiator
  logout, and unchanged API keys.
- Exposure/integration: no authenticator/token/reference material in
  DB event projections, audit, logs, errors, OpenAPI examples, or UI; restart
  reload; real browser/control and MCP validation paths; production builds and
  complete regression.
