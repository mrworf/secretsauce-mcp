# Milestone 17: Self-API-Key Protection

## Purpose and why

Prevent an active SecretSauce management API key from being casually stored or sent through SecretSauce itself, where recursive authority could turn an MCP credential into management-plane control.

## Dependencies

- Milestones 13 and 16.

## PRD traceability

- Section 20: configuration-time and runtime self-use protection.
- Sections 11.3, 25, 30, and 34.3/34.5: step-up, limits, permissions, and acceptance.
- Section 31: logging/redaction invariants.

## Scope

- Add a dedicated interactive superadmin browser workflow that accepts an active SecretSauce API key as a downstream credential only after exact-transaction step-up, explicit risk presentation, and durable approval.
- Reject active SecretSauce API keys submitted to all general credential APIs, including API-key-authenticated requests.
- Recognize candidate key format and verify active keys without logging or retaining the submitted value outside the approved vault write.
- At invocation, structurally inspect headers, query values, and supported body values for raw active SecretSauce API keys when the target is SecretSauce.
- Block unapproved raw-key attempts before credential substitution and downstream I/O and emit sanitized security warning/audit events.
- Permit only a specifically approved vault credential referenced through normal `gref` flow after all ordinary authorization/policy checks.
- Document the accepted on-storage tampering and transformed/encoded-value limitations.

## Not in scope

- Universal detection of encoded, fragmented, encrypted, or transformed API keys.
- API-key access to the approval workflow.
- Bypassing service, credential, destination, policy, reference, or capacity checks for approved use.
- Detecting arbitrary third-party API-key formats.

## Required behavior and interfaces

- General credential creation/replacement fails when submitted material verifies as an active SecretSauce API key.
- Only a browser-authenticated superadmin with current step-up can create the durable approval record and vault write.
- Runtime raw-key detection blocks exact structural values before any downstream contact.
- Approved use requires the stored credential's durable approval identity and a valid scoped reference; approval is not inferred from matching plaintext.
- Warning/audit output includes safe key nickname/last-four or opaque ID, never the candidate value/header/body.

## Security, authorization, invalidation, and audit

- Candidate verification uses bounded work and rate limits to avoid turning the endpoint into an unlimited key oracle.
- Active-key status/revocation is checked at invocation, not only at configuration time.
- Inspection and error paths do not serialize raw headers, query values, bodies, authorization data, or downstream responses.
- Approval creation, denial, attempted bypass, and approved invocation are distinct audited actions.

## Tests

- Positive: stepped-up approval, approved `gref` substitution after normal checks, safe warning metadata, and revoked-key behavior.
- Negative: general UX/API storage, service/all/system key caller, missing/stale/wrong-target step-up, raw key in header/query/body, unapproved vault credential, cross-service reference, policy denial, and inactive/malformed candidate behavior.
- Boundary: candidate/key size, verifier concurrency/rate limits, last-four collisions, key rotation/revocation, body-format support, and target-origin normalization.
- Integration: a local SecretSauce target proves blocked attempts make no downstream request and approved references still follow the full gateway pipeline.

## Acceptance criteria

- No general configuration or API-key-authenticated path can store an active SecretSauce API key.
- Exact structural raw-key invocation is blocked and audited before downstream I/O.
- Only the explicit interactive superadmin risk-acceptance path can approve stored self-use.
- Documentation makes the exact/structural nature and accepted storage-tampering loophole explicit.

## Planning handoff

Specify self-target detection, candidate scanner/verification interface, approval schema and revocation semantics, dedicated endpoint/form, body formats inspected, inspection order, rate limits, warning schema, and no-downstream-call test harness.
