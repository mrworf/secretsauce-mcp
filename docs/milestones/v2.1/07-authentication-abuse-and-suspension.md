# Milestone 07: Authentication Abuse Controls And Suspension

## Purpose and why

Bound unauthenticated and expensive authentication work, derive one trustworthy
canonical client source, and optionally suspend local accounts after durable
password-valid/TOTP-invalid evidence. These behaviors belong together because
source derivation and capacity admission must occur before password work, while
suspension may count only the narrowly defined post-password result.

## Dependencies

- `06` — Consumes the stable local login/OAuth authentication path, browser
  session invalidation, uniform failures, and authenticated security settings.

## PRD traceability

- `ABUSE-001`–`ABUSE-015` — account/source/global/factor/concurrency limits,
  bounded configuration, durable counters, and suspension transition.
- `SOURCE-001`–`SOURCE-009` — canonical source, forwarding formats, trust modes,
  validation, normalization, and warnings.
- Sections 4–5, 7, 10.3, 11.4, 12.3, 13.4, 14.2, 15, 16.4–16.5, 17.2 and
  17.5, 18.3, 20, 21.3, 22, 23, and 25 — principles, proxy/OIDC boundaries,
  UX, operations, acceptance, tests, and documentation.
- Section 24 question 6 — shared request-boundary source resolver.

## Scope

- Implement one shared bounded client-source resolver used before authentication
  and rate-limit work by control and OAuth/MCP listeners.
- Support host-local `direct`, `trusted_proxies`, and explicitly risky `always`
  modes plus selected `X-Forwarded-For` or RFC `Forwarded` parsing.
- Validate proxy configuration and bounded headers/hops; canonicalize IPv4,
  IPv6, IPv4-mapped IPv6, and optional format-valid ports.
- Enforce account, canonical-source, global, password-verification,
  TOTP-verification, enrollment-credential, unauthenticated-inflight, and
  expensive-work concurrency controls with the exact PRD defaults and bounds.
- Parse application-owned protective environment settings at startup and fail
  closed on empty, malformed, out-of-range, or inconsistent values.
- Add the superadmin security setting for automatic suspension: default
  disabled or threshold 3–20.
- Count qualifying control-login and local OAuth failures durably by immutable
  user UUID in one rolling 24-hour window after valid current password.
- On threshold, atomically suspend, clear counters, increment security epoch,
  revoke browser/restricted sessions, OAuth grants/families/tokens, and gateway
  references, and write sanitized audit evidence.
- Clear counters on successful login/recovery/break glass and when disabling the
  setting; apply lower thresholds only on the next qualifying failure.
- Document source trust, `always` spoofing risk, limits, defaults, startup
  failures, and reverse-proxy defense in depth.

## Not in scope

- OIDC-provider failure counting or suspension, enrollment/replacement/step-up
  failure counting, reverse-proxy provisioning, or a claim that proxy headers
  are trustworthy in `always` mode.
- Direct account reactivation, temporary-password issuance, or the recovery
  ceremony implemented in Milestone 08.
- Removing existing manual-suspension last-superadmin protections.

## Required behavior and interfaces

- Direct mode ignores forwarding headers. Trusted-proxy mode uses a selected
  valid header only from a configured immediate peer and walks the chain from
  the server side. Always mode accepts the client-most supplied address and
  emits a sanitized startup warning.
- Headers over 4096 bytes or 32 hops and malformed, hostname, obfuscated,
  `unknown`, zone-qualified, empty, or ambiguous chains fail before
  authentication work.
- Nonselected headers do not affect source identity; absent selected headers
  fall back to the immediate peer.
- Reached capacity/rate limits use uniform temporary-unavailability with
  `Retry-After`, perform no further expensive verification, and do not change
  suspension counters.
- Only invalid TOTP after successful current-password verification in control
  login or local OAuth qualifies. Concurrency cannot bypass or double count the
  threshold.
- Suspension retains the same public authentication failure, including for the
  final active superadmin.

## Security, authorization, invalidation, and audit

- Source settings and protective environment controls are host-local and
  unavailable to browser, control, OAuth, MCP, or remote CLI mutation.
- Automatic suspension settings require superadmin authorization, step-up,
  confirmation/justification where existing controls require them, and
  sanitized audit.
- Counters are keyed by immutable UUID after password verification, not raw
  email; public clients never learn whether a failure counted.
- The threshold transition invalidates every affected capability atomically and
  rejects the first newly authenticated request after commit.
- Forwarding chains, received environment values, full IPs, passwords, TOTP
  codes, tokens, cookies, and references stay out of logs/audits/telemetry.

## Required tests and validation

- Positive/negative tests cover every environment setting, security setting,
  source mode, selected header, proxy/CIDR entry, valid chain form, threshold,
  and factor outcome.
- Boundary tests cover all configured ranges, cross-field constraints, header
  bytes/hops, IPv4/IPv6/mapped equivalence, ports, windows, concurrency, global
  sharing across control/local OAuth, and rolling 24-hour expiry.
- Negative tests prove spoofed headers are ignored in direct/untrusted-peer
  cases, invalid sources fail before password work, reverse-proxy controls do
  not replace application ceilings, and nonqualifying failures never count.
- Persistence/concurrency tests prove durable restart-safe counters, no double
  count, exact threshold transition, disable clearing, lower-threshold
  semantics, and atomic suspension/revocation/audit.
- Browser tests cover security settings, uniform login behavior, accessible
  errors, and no counter/account disclosure.
- Focused auth/OAuth/security tests, production build, full suite, OpenAPI
  conformance, and secret/privacy scan pass.

## Acceptance criteria

- [ ] All application-owned rate and concurrency ceilings enforce documented
      defaults and validated bounds without depending on a reverse proxy.
- [ ] Control and OAuth/MCP listeners use one canonical source decision before
      authentication work.
- [ ] Only qualifying password-valid/TOTP-invalid attempts affect the durable
      counter and threshold transition.
- [ ] Suspension atomically invalidates all required capabilities while
      preserving uniform public failures.
- [ ] Invalid host configuration stops startup safely and `always` mode produces
      its required bounded warning.
- [ ] Required boundary, concurrency, browser, build, full-suite, OpenAPI, and
      privacy gates pass.

## Planning handoff

Resolve shared resolver placement, RFC parsing library or internal parser,
canonical address representation, limiter storage/clock strategy, admission
ordering, environment schema, rolling-window persistence, suspension
transaction, OAuth/control sharing, and timing/concurrency fixtures. Likely
slices are: source resolution and configuration; capacity/rate admission; then
durable suspension setting, counters, atomic invalidation, UX, and operations.
