# Self-API-Key Protection

SecretSauce prevents an active `ssk_v1` management API key from silently
becoming recursive management authority when it is submitted as a downstream
credential or sent to this deployment through the gateway.

The ordinary credential create and replacement paths reject active
SecretSauce management keys. They do this before writing to the vault. Revoked,
expired, malformed, and noncanonical values continue through the ordinary
credential workflow because they are not current management authority.

## Exceptional superadmin approval

Use the exceptional workflow only when a managed integration must call the
same SecretSauce deployment. Prefer a separate narrowly scoped management
integration whenever possible.

1. Sign in to the browser control plane as a superadmin.
2. Open **Credentials**, select the service and credential, and find
   **Recursive management authority**.
3. Enter the active management API key and a specific justification.
4. Type the displayed acknowledgement exactly.
5. Enter the current password and TOTP code. The browser requests a step-up
   proof bound to the exact route, service, credential, version, idempotency
   key, and request body.
6. Submit once and retain the safe approval metadata for review.

The raw key, password, and TOTP are cleared from the form after the attempt.
The response shows only the API-key UUID, nickname, last four, approved vault
generation, and approval time. Admins and management API-key principals cannot
use this workflow. API keys cannot request or satisfy human step-up.

Approval authority is exactly
`(service UUID, credential UUID, vault generation, API-key UUID)`. Replacing or
deleting the credential value removes the approval. Rotating or revoking the
management key, reaching its exact expiry, changing the vault generation, or
archiving the credential makes the approval unusable. Renaming the key does
not change its UUID; retained audit fields remain safe snapshots.

## Runtime behavior

A request is self-targeting only when the fully validated downstream URL has
the same canonical origin as a configured SecretSauce-owned public origin:

- `control.public_origin`, when configured;
- `server.resource`, when configured;
- the built-in OAuth issuer, when configured.

Host aliases, paths, redirects, DNS equivalence, and unconfigured proxy names
do not widen this set.

For a self target, raw request header values, query values, and JSON-like body
string leaves are inspected after authentication, destination validation,
reference validation, policy evaluation, and capacity admission, but before
reference consumption, vault resolution, credential substitution, or
downstream I/O. An active raw key is rejected with
`self_api_key_denied`.

A referenced credential is inspected before it is added to substitution
state. An active management key must have the exact durable approval and must
still be active and unexpired in a fresh database read. Approved use still
requires an ordinary subject-, service-, destination-, credential-, epoch-,
and snapshot-bound `gref`; every normal service and credential policy remains
in force.

Database runtime is required for approved self-use. YAML authority has no
durable approval store, so it fails closed when a canonical self-key candidate
targets a configured self origin and inspection is unavailable. Clean
noncandidate credentials continue normally.

## Detection boundary

Protection recognizes the canonical fixed form
`ssk_v1_<16-character identifier>_<43-character secret>` in string values,
including a prefixed value such as `Bearer ssk_v1_…`. Scanning and Argon2id
verification are bounded by candidate, structure, worker-pool, per-principal,
direct-source, and runtime-global limits. Saturation fails closed.

This is structural defense, not a universal non-exfiltration guarantee.
Encoded, fragmented, encrypted, transformed, or binary representations are
not interpreted as keys. Destination policy and endpoint design remain part
of the security boundary. Database or vault administrator tampering is inside
the trusted-storage boundary.

## Audit and troubleshooting

Blocked attempts emit `self_api_key_blocked`; successful approved uses emit
`self_api_key_approved_use`. Records contain request and resource UUIDs,
canonical host/path, method, location category, and safe key
UUID/nickname/last-four snapshots when known. They do not contain the candidate
text, containing header/query/body value, vault plaintext, Authorization
header, proof, verifier, or downstream response.

- `active_self_api_key` on a credential write means the ordinary path detected
  live management authority. Use the superadmin workflow only after reviewing
  the recursion risk.
- `self_api_key_denied` on MCP means a raw active key, an unapproved or stale
  credential binding, unavailable inspection, or a bounded verifier limit
  prevented self-targeting use.
- Revocation and expiry are intentionally immediate. Create and approve a new
  credential generation rather than attempting to reuse stale approval.
- Keep request IDs for investigation, but never attach raw keys or full
  request/response bodies to logs or tickets.
