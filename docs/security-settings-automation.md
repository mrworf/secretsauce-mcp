# Security Settings And Automation

Database identity mode stores supported security policy in SQLite and exposes
it through the browser Security workspace and the versioned control API. The
deployment YAML seeds the row only on first initialization. Once initialized,
the database row is authoritative across restart.

## Ownership boundary

The durable settings row owns:

- password minimum length and the monotonic blocklist policy marker;
- browser-session and database OAuth access/refresh lifetimes;
- the default browser step-up mode;
- login, password, TOTP, management, search, and backup rate windows;
- optional inactivity suspension and delayed deactivation; and
- inactivity-job interval, batch, and wall-time limits.

YAML continues to own listener addresses, public origins, database and audit
paths, identity encryption/signing/HMAC key files, OIDC provider trust,
password blocklist file contents, and verifier-pool capacities. The browser
never accepts a path, key, blocklist body, provider document, or other
deployment-owned value.

Run one active SecretSauce instance for a database and public endpoint.
Settings are held in one immutable in-process snapshot after startup and after
each successful local update; this is not a distributed configuration cache.

## Changes and runtime effects

Open `/control/security` as a browser-authenticated superadmin. Every update
uses a current revision, justification, the exact displayed acknowledgement,
and password/TOTP step-up. Bounds are visible beside each input and are also
enforced by the API and database.

Reducing a session or OAuth lifetime constrains existing state at its next
validation. Increasing a lifetime never extends an already issued session or
grant. Rate changes apply to subsequent checks without extending existing
counter reset times.

Increasing the password minimum or blocklist policy marker advances the
password-policy version. SecretSauce does not inspect hashes. After a correct
password is verified, an older credential is checked against current policy:
a compliant value advances its marker, while a noncompliant value enters the
restricted password-change flow. The blocklist marker asserts that the
operator has already deployed a stricter offline blocklist and cannot be
decreased.

The `always` step-up mode requires proof bound to each protected request.
Routes that are intrinsically stricter, including global authenticator events,
still require exact-operation proof when the default is `five_minutes`.

## Qualifying activity and inactivity automation

Qualifying human activity includes successful interactive local or assured
OIDC login, an authenticated MCP request by an eligible human OAuth principal,
a successful browser management mutation, and a first-party interactive
management read. Session polling, background reads, OAuth refresh, maintenance,
and API-key traffic do not update a human account.

Inactivity suspension and delayed deactivation are disabled by default. When
enabled, the leased job applies exact whole-day cutoffs, bounded batches, and a
bounded wall time. It rechecks activity and account state in each transition,
processes ordinary accounts before superadmins, and never removes the final
active superadmin. Automated suspension retains authenticators but invalidates
authorization state. Automated deactivation disables authenticators and
revokes the same durable human state as manual deactivation.

The Security workspace shows the next/last run, safe outcome code, and affected
counts. A superadmin can request a stepped-up run. An expired lease permits
safe retry after process failure; account predicates make repeated processing
idempotent. Manual reactivation remains justified and stepped-up, clears the
automation origin metadata, and is never performed automatically.

## System-wide authenticator events

Two browser-only superadmin actions are available:

- require every local password credential to complete password change; and
- erase every local TOTP authenticator and require enrollment again.

Each action requires current global-state concurrency, idempotency,
justification, its distinct exact acknowledgement, and password/TOTP proof
bound to that exact operation. The transaction invalidates every human browser
and restricted session, database OAuth code/grant/family/token, and runtime
gateway reference. The initiating browser is therefore signed out after the
response.

The password event preserves hashes only so a correct existing password can
enter restricted password change. The TOTP event deletes confirmed, pending,
and accepted TOTP state. OIDC-only accounts without a local password are not
counted by the password event. System-owned API keys are deliberately neither
revoked nor counted by either event, and API-key callers cannot invoke these
routes.

## Recovery and observation

Use the local break-glass command described in
[Local Browser Authentication](local-authentication.md) if interactive
superadmin access is lost. Keep more than one active superadmin so inactivity
automation can act on stale privileged accounts without leaving the instance
unmanaged.

Security settings, job state, and global event responses are `no-store`.
Administrative audits contain safe setting names/numbers, actor and event IDs,
justification, versions, and affected counts. They exclude passwords, hashes,
TOTP seeds/codes, cookies, Authorization data, session/grant/token/reference
values, request bodies, and blocklist paths or contents.

