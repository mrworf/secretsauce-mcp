# Local Browser Authentication

SecretSauce can authenticate local control-plane users with a password and
mandatory TOTP. This is separate from MCP authentication: browser cookies are
accepted only on the control listener and are never credentials for `/mcp`.

Milestone 05 supplies authentication for an already active, fully configured
identity. It intentionally does not expose enrollment, reset, recovery, or
replacement routes. The initial `enrollment_required` superadmin becomes usable
only through the restricted Milestone 06 enrollment ceremony.

## Configuration and stable key mounts

Local authentication requires the control listener and durable SQLite
persistence. A minimal identity block is:

```yaml
control:
  listen: 127.0.0.1:8081
  public_origin: https://control.example.org
  idempotency_hmac_key_file: /run/secretsauce-keys/idempotency.key

persistence:
  database_file: /var/lib/secretsauce/control.sqlite

identity:
  active_root_key_id: identity-2026-01
  root_key_files:
    identity-2026-01: /run/secretsauce-keys/identity-2026-01.key
  session_hmac_key_file: /run/secretsauce-keys/session-hmac.key
  password:
    minimum_length: 12
    # Optional file containing one lowercase SHA-256 password digest per line.
    compromised_blocklist_file: /config/compromised-passwords.sha256
  sessions:
    admin_absolute: 12h
    admin_inactivity: 15m
    user_absolute: 24h
    user_inactivity: 1h
  step_up_mode: five_minutes
  limits:
    login_attempts: 10
    login_window: 15m
    password_attempts: 10
    password_window: 15m
    totp_attempts: 5
    totp_window: 5m
    max_password_verifications: 2
    max_password_verifications_per_source: 1
    max_totp_verifications: 8
    max_totp_verifications_per_source: 2
```

Each identity root key and the session HMAC key is a distinct canonical
32-byte base64url value in a regular file with mode `0400`. The idempotency HMAC
key is also a distinct canonical 32-byte base64url value and may use mode
`0600`. Provision key files through a secret manager or an offline key
generation procedure that does not print key values. Never put key values in
YAML, environment-variable values committed to source control, command
arguments, logs, or container image layers.

Mount the identity and idempotency keys read-only and keep the database on
writable persistent storage. For example:

```yaml
services:
  secretsauce:
    deploy:
      replicas: 1
    volumes:
      - ./identity-keys:/run/secretsauce-keys:ro
      - ./control-state:/var/lib/secretsauce
```

Keep every historical identity root key configured while an authenticator
envelope still names it. Changing or losing the session HMAC key invalidates all
browser session, CSRF, and step-up proof values after restart. Keep these keys
stable across routine restarts, restrict them to the gateway process, and
include their recovery handling in the operator's key-management procedure.

## Password and TOTP behavior

New passwords are normalized with Unicode NFKC, are never truncated, and use
Argon2id with 64 MiB memory, three iterations, parallelism one, and a 32-byte
result. The configurable minimum is 8–128 Unicode code points and defaults to
12. Inputs are bounded to 1,024 code points and 4,096 UTF-8 bytes. New values
are checked against the bundled common-password set, the optional operator
SHA-256 blocklist, and identity/product context.

TOTP uses six digits, 30-second steps, HMAC-SHA-1 for authenticator
compatibility, and only the previous, current, or next step. Seeds are
envelope-encrypted with AES-256-GCM; the database does not contain the identity
root key. An accepted time step is transactionally single-use across login,
confirmation, and step-up.

TOTP is not phishing-resistant. A convincing site or real-time relay can steal
both a password and a current code. Protect the control origin with HTTPS,
verify the hostname before entering credentials, restrict network access, and
use the `always` step-up mode for installations that prefer per-transaction
proofs. A future phishing-resistant factor would require a separate design.

## Sessions, origin boundary, and revocation

The browser receives only the `__Host-secretsauce_session` cookie. It is
`Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`; no `Domain` attribute is
set. Login, session, logout, step-up, and other secret-entry responses are
`Cache-Control: no-store`. State-changing browser calls additionally require
the rotating CSRF value returned by the session API and the exact configured
origin.

Admin and superadmin sessions default to 12 hours absolute and 15 minutes idle.
User sessions default to 24 hours absolute and 60 minutes idle. Reducing a
configured lifetime shortens already issued sessions on their next validation;
increasing it never extends an existing session. Logout, account ineligibility,
authenticator-state change, or user/global security-epoch change invalidates a
session immediately.

Rate limits use the direct socket source and a keyed account identity. Proxy
forwarding headers are not trusted. Login, password work, and TOTP work have
separate windows and concurrency budgets, and public failures do not reveal
whether an account exists.

## Step-up modes

`five_minutes` verifies the current user's password and a fresh TOTP step, then
permits declared sensitive browser operations for exactly five minutes. Each
operation still revalidates the session and security epochs.

`always` issues a random proof for one canonical operation. The stored proof
hash is bound to the session, user, method, registered route, sorted target
UUIDs, expected version, idempotency key when present, request-body digest,
security epochs, and five-minute expiry. The protected request sends the proof
in `x-step-up-proof`. The domain mutation must consume it in the same database
transaction as the mutation and audit record; it cannot be reused or moved to a
different transaction.

API keys cannot request or satisfy human step-up.

## Readiness and shutdown

When local authentication is configured, `GET /api/v2/health` reports only the
stable `checks.identity` state (`ready` or `unavailable`). It never returns key
paths, key values, password/TOTP material, cookies, proofs, or internal error
details. Shutdown is idempotent, stops the listener, closes the persistence
owner, and destroys in-memory identity key material.
