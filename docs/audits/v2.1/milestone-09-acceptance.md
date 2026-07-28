# v2.1 Milestone 09 Acceptance

## Result

Milestone 09 is accepted. Users can inspect and revoke one or all of their own
web sessions and agent connections. Superadmins can administer individual,
per-user, and global access, while regular administrators can administer only
ordinary-user agent connections whose complete nonempty reachable-service set
is currently managed by that administrator.

Every administrative mutation repeats current actor, owner, and service-scope
authorization in its transaction. Bulk revocation is atomic, newly
authenticated use fails immediately after commit, and inaccessible targets do
not disclose whether a record exists.

## Security, privacy, and persistence evidence

- Session display metadata is derived at authentication time and limited to the
  authentication method, a conservative device family, and a coarse `/24`
  IPv4 or `/48` IPv6 source. Raw user agents, full addresses, forwarding chains,
  cookies, proofs, tokens, and opaque gateway references are not retained or
  displayed.
- Signed pagination cursors bind the viewer, resource, scope, and effective
  filters, preventing reuse across authorization or query boundaries.
- Self revocation supports individual and atomic all-record scopes. Revoking
  the initiating web session clears its browser cookie after commit.
- Administrative revocation requires exact scope confirmation,
  operation-bound step-up, justification, CSRF, current transactional
  authorization, and generated sanitized audit.
- Regular administrators cannot access web sessions, privileged owners,
  zero-service connections, or connections containing any service outside
  their current management scope.
- Migration 26 adds immutable cleanup evidence. Physical cleanup records the
  owner, bounded service-scope snapshot, correlation, inactivity, and evidence
  expiry in the same transaction as deletion and sanitized audit.
- Evidence-backed retries remain no-change successes only while the current
  actor, owner, and scope still authorize the action. Unknown targets, expired
  evidence, and lost scope remain inaccessible.
- A supported-scale test atomically revokes 100,000 active agent connections
  within the bounded performance budget. A separate 100,001-session fixture
  proves limit-plus-one rejection leaves every session, idempotency record, and
  success audit unchanged.

## Validation

- Focused access, browser, OAuth, persistence, API, and UI qualification: 14
  files and 130 tests passed. M10 release review then added the approved
  100,000-record boundary and limit-plus-one regression; the affected access
  and persistence suite passes 4 files and 45 tests.
- Test-only migration-registry regression suite: 26 tests passed.
- Production build: passed.
- Full suite after the M10 remediation: 168 files and 1,089 tests passed.
- Generated control OpenAPI: current.
- v2.1 readiness validator: 14 artifacts passed.
- Release artifact scan: passed for 653 closed-scope files.

The production build retains the existing advisory for a JavaScript chunk over
500 kB. The first full-suite run hit the sandbox's listener restriction and was
rerun with approved loopback/socket permission. That run found two test-only
migration fixtures colliding with the new production schema version; advancing
those fixtures to versions 27 and 28 resolved the regression. The corrected
full suite then passed. The release scan required the sandbox's approved Git
process permission and passed unchanged.
