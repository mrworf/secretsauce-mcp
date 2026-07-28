# Milestone 06: Browser Login, Sessions, And Logout

## Outcome

Local and configured OIDC identities share one branded login surface. Successful
authentication creates only a fresh server-side browser session, authenticated
views expose Settings and Log out everywhere, and logout clears its cookie only
after audited revocation commits.

## Current-state findings and decisions

- The identity domain already provides uniform local three-factor verification,
  fresh opaque session issuance, hash-only persistence, strict cookies, rotating
  CSRF, expiry/epoch/account checks, OIDC login, and transactional logout.
- Milestone work therefore preserves those operations and adds the missing
  browser shell, closed relative-destination contract, persistent account menu,
  and honest logout failure/retry behavior.
- Login accepts only `/control`-rooted relative destinations without authority,
  backslash, control characters, or cross-origin parsing. The validated value is
  returned only after successful authentication.
- Logout failure returns 503 plus `Retry-After`, retains cookie/session, emits
  one bounded operator event, and uses the exact accessible product message.

## Slice plan

1. **Branded login and destination contract:** local email/password/TOTP form,
   configured OIDC alternatives, uniform failure, fresh-session delivery, and
   positive/negative relative destination tests.
2. **Persistent account shell and durable logout:** Settings/Log out on every
   authenticated view, atomic success, injected persistence/audit uncertainty,
   retained page/focus/cookie, bounded event, and successful retry.
3. **Qualification:** browser/accessibility, leakage, build, full suite,
   OpenAPI, readiness, and release scan with acceptance evidence.

## Execution record

| Slice | Status | Commit | Evidence | Deviations |
| --- | --- | --- | --- | --- |
| 1 | completed | this commit | Production build; 3/3 login-page tests and 5/5 durable browser-session tests; all local factors in one labeled form; configured OIDC alternatives; uniform failure; secret-field clearing; safe relative destination acceptance plus cross-origin, authority, backslash, wrong-root, and normalization rejection; existing strict cookie/CSRF/expiry/restart tests retained | — |
| 2 | completed | this commit | Production build; 6/6 shell tests and 5/5 durable browser-session tests; account menu exposes Settings and Log out on every authenticated view; logout refreshes CSRF before revocation; injected audit failure returns 503 plus `Retry-After` without clearing the cookie, retains the authenticated page and focus, emits only bounded failure metadata, and succeeds on retry | — |
| 3 | pending | — | — | — |
