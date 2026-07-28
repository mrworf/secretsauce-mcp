# v2.1 Milestone 07 Acceptance

## Result

Milestone 07 is accepted. Gateway/OAuth and control listeners resolve one
bounded canonical client source before authentication work. Direct,
trusted-proxy, and explicitly risky always-trust modes enforce the documented
header, hop, address, CIDR, and startup-validation contracts. Shared
application-owned global and concurrency ceilings cover control login and
local OAuth without relying on reverse-proxy controls.

Automatic suspension is disabled by default and accepts only thresholds 3
through 20. Only a valid current password followed by an invalid TOTP in
ordinary local login or local MCP OAuth creates durable UUID-keyed evidence in
the rolling 24-hour window. Public responses do not reveal whether evidence was
recorded.

## Security and persistence evidence

- Direct mode and untrusted peers ignore spoofed forwarding headers. Trusted
  chains are walked from the server side; malformed or oversized selected
  chains fail before body parsing and password work.
- Protective environment settings use canonical syntax, exact ranges, and
  cross-field validation. Invalid values stop startup without echoing them.
- Duplicate correlation identifiers cannot double count, concurrent attempts
  serialize through the database writer, expired evidence is removed, and
  counters survive restart.
- Lowering a threshold has no immediate effect. The next qualifying failure
  evaluates the new version. Disabling the setting clears all evidence.
- The exact threshold transition can suspend the final active superadmin while
  preserving the uniform authentication failure.
- Suspension, evidence clearing, security-epoch advancement,
  browser/restricted-session revocation, SQLite-triggered OAuth
  grant/family/token revocation, invalidation publication, and sanitized audit
  commit in one transaction. Newly authenticated gateway work is consequently
  rejected and its ephemeral references lose usable authority.
- Successful browser login or MCP proof, TOTP recovery, TOTP reset,
  host-local break glass, and disabling automatic suspension clear the
  applicable evidence.
- Passwords, TOTP codes, forwarding chains, full source addresses, environment
  values, cookies, tokens, and opaque references remain absent from logs,
  audits, telemetry, and release artifacts.

## Validation

- Focused source/config/OAuth/authentication/settings/enrollment/break-glass/
  browser/migration suite: 125 tests passed.
- Focused control/browser-session integration: 21 tests passed with real
  loopback listeners.
- Production build: passed.
- Full suite: 167 files and 1,073 tests passed.
- Generated control OpenAPI: current.
- v2.1 readiness validator: 14 artifacts passed.
- Release artifact scan: passed for 648 closed-scope files.

The production build retains the existing advisory for a JavaScript chunk over
500 kB. The release scan initially required the sandbox's approved Git
permission to run `git ls-files`; the unchanged scanner then passed. Container
qualification remains an integrated Milestone 10 gate.
