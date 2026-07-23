# Milestone 04 Identity Bootstrap Acceptance Review

## Review conclusion

Milestone 04 is complete within its assigned boundary. The implementation adds
durable internal identity, local-authenticator state, security epoch, exact
provider-link, lifecycle, and one-time host-bootstrap foundations without adding
password/TOTP verification, sessions, remote identity administration, OIDC
network behavior, or MCP eligibility.

The milestone file's explicit requirement for one pending local superadmin is
authoritative over the validation matrix's shorthand about an active TOTP
account. The bootstrap result is therefore `enrollment_required` with both local
authenticator states `not_configured`. Milestones 05 and 06 own authentication
and activation.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Immutable UUIDv7 internal identity | Migration `0003` constraints, repository-generated IDs, restart/profile-stability tests |
| Normalized unique mutable email | NFKC/trim/case-fold plus IDNA domain normalization, unique index, duplicate and Unicode boundary tests |
| Roles and lifecycle | Closed role/status enums, exact transition graph, positive and exhaustive negative transition tests |
| Provider boundary | Canonical provider/HTTPS-origin/exact-subject validation, unique tuple, lookup API with no email fallback |
| Local state and epochs | One-to-one state-only authenticator row, user/global epochs, no hash/seed/token/value columns |
| Last active superadmin | Count predicate evaluated in the same immediate transaction as role/status mutation and audit |
| One-time host bootstrap | No-argument terminal CLI, no-users plus singleton-marker transaction, race/restart/existing-user denial tests |
| Sanitized audit | Generated `identity.bootstrap` event in the identity transaction, denormalized UUID target, configured-secret redaction tests |
| No authentication or MCP authority | Read models always report `mcpEligible: false`; no verifier, session, token, route, or MCP integration was added |

## Security review

- Profile and provider inputs are closed, normalized, byte/code-point bounded,
  and rejected before durable mutation.
- UUIDs and exact provider tuples—not email—are the relationship keys.
- Audit generation happens after the transaction reads the authoritative prior
  state but before commit; audit failure rolls the identity mutation back.
- Bootstrap authority exists only in the local CLI, requires terminal input and
  output, accepts no arguments, and is also checked by the repository operation.
- CLI errors and success output are stable and omit configuration paths, profile
  values, provider subjects, credentials, tokens, and downstream details.
- The database writer lock and immediate transaction serialize concurrent
  bootstrap attempts; exactly one can commit.

## Deliberate handoff

The identity schema contains only authenticator state at this milestone. It has
no password hash, TOTP seed, enrollment token, session, grant, or OAuth token
material. The pending bootstrap user cannot log in or use MCP. Milestone 05 may
add verification/session state while preserving these identity and invariant
contracts; Milestone 06 must complete the password/TOTP enrollment ceremony
before activating the bootstrap user.

## Validation

Acceptance requires the focused identity/transaction/bootstrap tests, production
build, generated control OpenAPI consistency check, `git diff --check`, and the
unchanged full test suite with its required loopback and Unix-socket permissions.
