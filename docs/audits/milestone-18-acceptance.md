# Milestone 18 Security Settings And Automation Acceptance Review

## Outcome

Accepted. Database identity mode now has bounded durable security settings,
runtime enforcement, password-policy transitions, qualifying human activity,
leased inactivity lifecycle automation, and atomic system-wide password/TOTP
events. The responsive Security workspace exposes the supported controls
without retaining password or TOTP inputs.

## Accepted controls

- Migration 0018 adds constrained settings, job/event state, password-policy
  and password-change epochs, and user activity/suspension metadata.
- First initialization seeds validated deployment values once; subsequent
  restarts load the database row without overwriting it.
- Optimistic updates enforce every range and cross-field invariant, a
  monotonic blocklist marker, browser-superadmin authority, and an explicit
  system-key field allowlist.
- Runtime password/session/OAuth/step-up and abuse controls read the immutable
  current snapshot. Reductions constrain existing lifetime state and increases
  do not extend it.
- Older password-policy markers are evaluated only after correct hash
  verification. Compliant passwords advance atomically; noncompliant or
  globally forced credentials enter restricted password change.
- Qualifying activity is monotonic and coalesced. Interactive login, human MCP,
  browser mutation, and marked first-party reads qualify; refresh, background,
  health, maintenance, and API-key work do not.
- The inactivity job uses durable due/lease state, exact cutoffs, conditional
  transitions, bounded batch/wall time, ordinary-first order, and final-active-
  superadmin protection.
- Password and TOTP global events use current global-state concurrency,
  idempotency, exact acknowledgements, and transaction-bound `always` proof.
  Human sessions, grants, tokens, and references are invalidated atomically;
  system-owned API keys remain unchanged.
- Inactivity job read/run routes are explicitly browser-only even though
  system keys have limited settings authority.
- Settings updates and manual job acquisition consume `always` proofs inside
  their persistence transaction.
- The role-aware Security workspace shows all bounds and job state to
  superadmins, keeps personal security visible to other humans, preserves
  non-secret edits after errors, and clears password/TOTP fields after every
  attempt.
- Generated OpenAPI includes the strict no-store settings, job, event-list,
  password-event, and TOTP-event contracts.

## Verification

- Positive and negative tests cover initialization, all bounded fields,
  optimistic writes, system-key allow/deny fields, dynamic runtime effects,
  policy transition, qualifying/nonqualifying activity, exact job cutoffs,
  leases, final-superadmin protection, both global events, replay/stale state,
  browser-only job controls, exact acknowledgements, role visibility, and
  sensitive-field clearing.
- Production server and browser builds pass.
- Generated control OpenAPI is current.
- Full regression with listener/socket permission and bounded concurrency:
  **102 test files, 762 tests passed**.

## Implementation commits

- `caa7b3c` — decision-complete milestone plan
- `42883a7` — durable settings schema, repository, and store
- `66d05ff` — dynamic runtime settings
- `4b3db1b` — password-policy transitions
- `61be4fc` — qualifying human activity
- `1d22821` — inactivity lifecycle automation
- `2560aa8` — global password and TOTP events
- `58c0dce` — responsive Security workspace and exact step-up integration

## Deferred boundary

Searchable audit storage and retention are Milestone 19. Activity, status, and
security dashboards are Milestone 20. Backup/export and restore behavior remain
Milestones 21 and 22.

