# SecretSauce v2.1 UX And Accessibility Contract

Status: approved detailed interaction baseline. It extends the v2 UX contract
and is authoritative for setup, enrollment, authentication, account security,
and session/connection administration.

## Shared behavior

- Every flow is completable at 320 CSS pixels wide, 200% zoom, keyboard-only,
  and with a screen reader. Touch targets are at least 44 by 44 CSS pixels.
- Pages use one `h1`, landmarks, semantic controls, persistent labels,
  descriptive errors, visible focus, logical DOM order, and a skip link.
- A focusable error summary receives focus after a failed submission and links
  to invalid fields. A polite live region announces progress/success; an
  assertive region announces a failed security transition.
- Server failures preserve non-secret fields and return focus to the triggering
  control or error summary. Password, code, TOTP, seed, and confirmation-secret
  fields clear after submission or ceremony termination and are never
  repopulated.
- No UI uses color alone. Motion honors `prefers-reduced-motion`. Status updates
  do not steal focus while a user is typing.
- Destructive dialogs name the target, scope, current-session effect, and
  irreversibility. Cancel receives initial focus; Escape cancels; focus is
  trapped and restored. Bulk actions require the exact displayed typed phrase.
- At 768 pixels and above, lists use tables. Below 768 pixels, labeled cards
  preserve identity, state, scope, time, and actions in the same reading order.
- Authentication pages reveal no internal hostname, key name/path, user count,
  account eligibility, stack trace, forwarding data, or request/response body.

## Setup status

Wide and narrow layouts use the same linear content:

```text
┌ SecretSauce ──────────────────────────────────────┐
│ Setting up SecretSauce                            │
│ [progress/status icon] Preparing this installation│
│ This may take a moment. It is safe to refresh.    │
│ [Try again] (only when retry is user-actionable)  │
│ Status updates automatically.                     │
└───────────────────────────────────────────────────┘
```

`preparing` polls with bounded backoff and announces only meaningful state
changes. `not_ready` says the installation needs operator attention without
identifying a key, path, store, or user. `enrollment` changes the primary action
to “Continue to secure enrollment” without saying no users exist. `available`
redirects to the fixed login route. Loss or malformed private status never
optimistically advances the page.

Keyboard focus stays on the current task. Automatic refresh neither reloads the
document nor resets focus. With scripting failure, the page offers a normal
refresh link and safe status text.

## Unified enrollment

The URL and first screen are identical for initial, invited, reactivation, and
reset ceremonies:

```text
Step 1 of 3             Verify your enrollment
Enrollment code  [____________________________]
                  [Continue]

Step 2 of 3             Choose a password
New password     [____________________________]
Confirm password [____________________________]
                  [Back] [Continue]

Step 3 of 3             Set up an authenticator
[QR image with equivalent manual key control]
Manual key [Reveal] [Copy]
6-digit code     [______]
                  [Back] [Complete enrollment]
```

The page never labels a ceremony “first administrator” or exposes its purpose.
Password guidance states the length and blocklist behavior, permits paste and
password managers, and has no composition score. The QR has accessible text
that identifies it as sensitive and provides the manual-key alternative.
Reveal is explicit; copy announces success without reading the key aloud.

Expiry, replay, invalid code, invalid profile, weak password, invalid TOTP,
restart, race loss, and persistence/audit failure use the same safe recovery
route. Failure clears all secret fields. Successful completion announces
“Enrollment complete. Sign in to continue,” then uses a fixed login link; it
does not create a session.

## Branded login

```text
┌ SecretSauce ──────────────────────────────────────┐
│ Sign in                                           │
│ Email              [___________________________]  │
│ Password           [___________________________]  │
│ Authenticator code [______]                       │
│                    [Sign in]                      │
│ ─────────────── or use your organization ─────── │
│ [Provider label]                                  │
└───────────────────────────────────────────────────┘
```

There is no remember-me, forgot-password, or recovery-instruction action.
Email, password, and TOTP submit together. All local authentication failures
announce “Sign-in details are invalid” and retain only the email. Rate limiting
uses the same message and comparable focus behavior. OIDC buttons are real
buttons/links with provider names and do not reveal account existence.

On success, the server creates a new session identifier and navigates to the
fixed same-origin overview. A return URL is not accepted by this flow.

## Global logout

Every authenticated header/menu contains a “Sign out” control reachable
immediately after the account menu. Activation opens a small confirmation:

```text
Sign out of this browser?
This ends the current browser session. Agent connections remain active.
[Cancel] [Sign out]
```

Success navigates to login and announces completion there. On persistence or
audit failure, the dialog/page remains authenticated, the cookie remains, focus
moves to: “Sign out failed. Your session is still active. Try again.” The retry
button remains operable and is the next tab stop. The UI never clears local
authenticated state or announces success before the server commit.

## Account security

Account settings group:

- profile and authentication method;
- change password;
- active browser sessions;
- agent connections.

Changing a password uses current authentication/step-up, blank password-manager
fields, visible requirements, and a success statement about affected sessions.
Reactivation/reset enrollment replaces password and TOTP; self-change visibly
states that the existing authenticator remains.

## Browser sessions

```text
Browser sessions                              [Sign out all sessions]
Current · Chrome on Desktop
Created …  Last active …  Expires …  Network 192.0.2.0/24
                                              [Sign out]

Firefox on Mobile
Created …  Last active …  Expires …  Network Unknown
                                              [Sign out]
```

Only the documented derived metadata appears. “Current” is text plus an icon.
Unknown values say “Unknown.” Individual confirmation names the device/time and
whether it is current. Bulk confirmation states that the current browser is
included and requires `REVOKE ALL SESSIONS`. After a successful current/bulk
revoke, navigation waits for the commit and then goes to login.

## Agent connections

Each row/card shows client name/public ID, authentication method, time fields,
requested scopes, current service names, and usability. Tokens, hashes,
cookies, CSRF values, and gateway references never appear.

Own-user actions use “Disconnect.” Administration uses “Revoke connection” and
shows the target user and complete service scope. Regular admins never receive
browser-session UI and see an agent connection only when every current service
is in scope. A stale-scope or inaccessible mutation produces the same
non-disclosing message and refresh affordance.

Bulk dialogs state users, services, connections, and whether the actor's own
connection/session is included. They require the server-provided confirmation
phrase, non-secret justification where administrative, and re-fetch scope
before enabling submission.

## Suspension settings and recovery

The superadmin security page exposes a switch and integer threshold 3–20.
Disabling warns that current qualifying counters will be cleared. Saving uses a
version check and announces either the exact committed setting or a stale-state
refresh requirement. It never shows per-account failure counts.

Suspended users receive the ordinary uniform login failure. Authorized
administrative reactivation explains that password and TOTP will both reset,
revokes active authority, requires confirmation and justification, and returns
one neutral enrollment delivery result. Host break glass remains CLI-only and
has no remote UI.

## Responsive and accessibility evidence

Browser tests must cover 320×640, 768×1024, and 1280×800 viewports; keyboard
completion; focus order and restoration; accessible names/descriptions;
validation summary links; live-region changes; dialog trapping/cancel; reduced
motion; 200% zoom without two-dimensional page scrolling; and automated WCAG
2.2 AA checks. Manual review remains required for screen-reader wording,
contrast, reflow, and secret clearing.

## Failure and interruption walkthroughs

| Scenario | Required visible result |
| --- | --- |
| Provisioning retry | Stable page, one bounded update announcement, no internal detail. |
| Configuration error/private status loss | Safe operator-attention state; ordinary navigation absent. |
| Enrollment expiry/restart/race | Secret fields cleared, neutral invalid ceremony, fixed restart route. |
| Login suspension race | Uniform invalid sign-in; no suspension/count disclosure. |
| Logout audit/persistence failure | Authenticated page and cookie retained, assertive failure, focused retry. |
| Stale admin scope | No mutation or existence disclosure; refresh guidance. |
| Session revoked in another tab | Next authenticated request navigates to login with generic expiry message. |
| Network interruption after commit | Idempotent retry returns committed outcome without duplicate audit. |

## Approval

The project-authored UX/accessibility review is recorded in
[`docs/audits/v2.1/milestone-00-acceptance.md`](../../audits/v2.1/milestone-00-acceptance.md).
This is an implementation baseline, not independent accessibility certification.
