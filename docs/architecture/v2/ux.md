# UX Workflow and Wireframe Packet

## Information architecture

Desktop uses a persistent left rail and a bounded reading column with wide editor
workspace. Mobile uses a top bar, disclosure navigation, stacked summaries, and
bottom-sticky primary action only when it does not cover validation/errors.

```text
┌ SecretSauce ───────────────────── profile/security ┐
│ Overview          │ page title · status · actions  │
│ Services          │ filters / warnings / help       │
│ Credentials       │                                 │
│ Policies          │ responsive content workspace    │
│ Users / Groups    │                                 │
│ Access / API keys │                                 │
│ Activity / Audits │                                 │
│ Security          │                                 │
│ Backup / Restore  │                                 │
└───────────────────┴─────────────────────────────────┘
```

Navigation is permission-filtered but never used as authorization. Users receive
only profile/security and their own sessions/grants/service-name access. Admins
receive assigned-service views. Superadmins receive global views. OpenAPI is
clearly labeled with its authentication model.

## Shared interaction rules

- Minimum 44-by-44 CSS-pixel touch targets; visible keyboard focus; logical DOM
  order; skip link; landmarks; semantic headings, tables, forms, status, and
  dialogs.
- WCAG 2.2 AA contrast in light/dark themes. Color never carries status alone.
  Motion respects `prefers-reduced-motion`.
- Validation appears beside fields and in a focusable summary. Server errors focus
  the summary and preserve non-secret edits. Secret fields are cleared after
  submission/failure and never repopulated.
- Destructive dialogs name exact target, consequences, and affected counts.
  Restore/global security require typed target text plus step-up. Cancel receives
  initial focus; destructive action is not the default.
- At widths below 768 px, tables become labeled cards preserving identity, status,
  critical scope, and actions. At 768–1199 px navigation collapses. Above 1200 px,
  editors use two panes while prose stays at about 80 characters.
- Toasts announce concise outcomes through a polite live region and contain no
  credentials, keys, references, request bodies, or internal errors.

## Enrollment

```text
[1 Verify temporary password] → [2 Choose password] → [3 Scan/copy TOTP once]
                                                        [enter code] → [active]
```

Password guidance states length and blocklist behavior, permits paste, and avoids
composition meters. TOTP screen warns that TOTP is not phishing-resistant. Seed
and QR exist only in the enrollment view, are excluded from telemetry/DOM
diagnostics, and disappear after successful confirmation. Expiry/reuse shows the
same safe recovery route without revealing account eligibility.

## Service editing and publication

```text
Service: lab-api (Draft)                 [Validate] [Publish]
├ Basics            │ Name, slug, documentation URL
├ Destinations      │ Base URL · canonical preview · TLS warning
├ Credentials       │ status only; assignments; policy link
├ Access            │ groups first · direct-user exception warning
├ Policy            │ operating mode · rules · simulator
└ Review             │ errors/warnings · safe diff · version/author
```

Wide view uses section navigation plus editor/preview panes. Mobile uses an ordered
step list with a persistent draft summary. Publish requires a current version,
shows a secret-free diff, and reports stale writes without overwriting. Clone/copy
preview states that credential values and principal bindings are excluded.

## Credential writing

```text
Credential: deploy token      Status: configured · ending 1234
Usage: header / X-Example-Key     Assignment: operators
[Replace value] [Delete value]    Value is write-only and cannot be retrieved.
```

Replace opens a blank password-manager-compatible field with byte-limit guidance.
Success returns status, last four, and time. Clone starts `unconfigured`. A
SecretSauce API-key-shaped value routes only an interactive superadmin to the
dedicated risk approval; all general forms reject it without echoing it.

## Policy explanation

```text
User [Ada] Service [lab-api] Destination [primary] Method [POST] Path [/v1/jobs]
Credentials [deploy]                                            [Simulate]
Final: DENY
Service boundary: priority 80 DENY wins tie
  ✓ rule: maintenance lock [open]
  ✓ rule: operators allow  [open]
Credential boundary: ALLOW
Canonical target: https://api.example.org/v1/jobs
```

The simulator uses the live evaluator, labels applicable and inapplicable reasons,
and links only to objects the viewer may inspect. Deny tie/default behavior is
plain language, not color alone.

## Audit, activity, and security

Audit keeps the active inclusive UTC/local time range visible. Search and filters
use keyset pagination. Results show safe actor/target snapshots, action, outcome,
service, and correlation ID; details never show raw bodies or bearer material.
Mobile cards retain time, action, outcome, target, and details action.

Security prioritizes actionable cards: vault/audit degradation, enrollment,
missing credentials, non-expiring/stale keys, login limits, break glass, account
without access, and last-superadmin protections. Scope-limited admins never see
global identities/counts.

## Backup and restore

```text
Backup
( ) Portable configuration only
( ) Include downstream values encrypted with passphrase [superadmin + step-up]
Always excluded: identities, bindings, sessions, grants, API keys, audit, settings
[Review manifest] [Create]

Restore: configuration-backup.tar.gz
1 Upload → 2 Validate → 3 Preview → 4 Step-up/confirm → 5 Maintenance/result
Replaces: services, credentials, policies
Preserves: target users, roles, authenticators, instance settings
Clears: groups/bindings; policies disabled/unassigned; keys/sessions/grants
Type RESTORE lab-api-gateway: [________________] [Restore]
```

Wrong/missing archive passphrase still offers non-secret restore and lists
credentials that become `unconfigured`. Progress is server-derived, resumable
after navigation, and never optimistic about completion. Post-restore remediation
persists until completed or explicitly dismissed with audit.

## API-key creation

The form makes role and immutable scope/expiry consequences explicit. `all_services`
and non-expiring selections carry durable warnings. The raw key appears exactly
once in a focused, non-cacheable view with copy control and a required “saved”
confirmation; later views show only nickname, UUID, suffix, static role/scope,
status, expiry, and activity.
