# Milestone 07: Authentication Abuse Controls And Suspension

## Outcome

Every password-bearing local authentication path derives one bounded canonical
client source before authentication work, shares application-owned global and
concurrency ceilings, and optionally converts only password-valid/TOTP-invalid
evidence into an atomic durable account suspension.

## Current-state findings and decisions

- Local authentication already has bounded account/source password and TOTP
  windows plus separate global/per-source password and TOTP work concurrency.
  Enrollment has an independent bounded credential limiter.
- The built-in OAuth listener already has a global/account/source limiter and
  unauthenticated/password concurrency, but it currently keys them directly
  from the socket and does not share the database-local login budget.
- Security settings already provide versioned, step-up-protected, audited
  global policy mutation and browser forms. Automatic suspension will extend
  that existing contract rather than introduce a second settings authority.
- One host-local resolver will canonicalize the immediate peer and the selected
  forwarding format. Invalid present headers fail before body parsing or
  password work; direct and untrusted-peer modes ignore them.
- Protective environment overrides remain outside browser/control mutation,
  use the exact canonical syntax and PRD ranges, and are projected into the
  runtime configuration only after validation.

## Slice plan

1. **Canonical source and host protection config:** source modes/header/CIDRs,
   canonical parsing and trust walk, protective environment defaults/bounds,
   sanitized `always` warning, and positive/negative boundary tests.
2. **Shared admission before authentication work:** one runtime global attempt
   window and unauthenticated/password concurrency for control and local OAuth,
   canonical-source wiring, uniform retry responses, and concurrency tests.
3. **Durable automatic suspension:** threshold setting/UI, rolling UUID-keyed
   counters, only qualifying factor evidence, success/disable clears, atomic
   suspension and capability invalidation, restart/race tests, and docs.
4. **Qualification:** browser/privacy, build, full suite, OpenAPI, readiness,
   release scan, acceptance evidence, and milestone status.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | in progress | — | — | — |
| 2 | pending | — | — | — |
| 3 | pending | — | — | — |
| 4 | pending | — | — | — |
