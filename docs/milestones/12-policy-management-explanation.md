# Milestone 12: Policy Management And Explanation

## Purpose and why

Extend the existing gateway policy model to principal-aware service and credential boundaries and make every outcome deterministic and explainable through one shared evaluator.

## Dependencies

- Milestones 09–11.

## PRD traceability

- Section 16: policy boundaries, fields, evaluation, and explanation.
- Sections 13.2, 14.2, and 15.1/15.3: assignments and editor/copy integration.
- Sections 22, 24.1, 30, 33, and 34.2: mutation, endpoint categories, permissions, UX, and acceptance.

## Scope

- Add persistent service- and credential-boundary policies with effect, integer priority, canonical method/host/path selectors, principal selector, enabled state, operating mode, response safeguards, reason, and version.
- Implement the exact highest-priority algorithm with deny winning equal-priority ties and default operating mode `deny`.
- Require the service boundary and every used credential boundary to allow; no credential allow can override service denial.
- Extend the existing canonical runtime evaluator rather than adding a second policy algorithm.
- Add policy APIs/editors, validation, optimistic concurrency, clone, safe copy/paste, and bulk copy between permitted services/credentials using new UUIDs.
- Add the policy helper that accepts service, user, destination, method, path/URL, and credentials and returns structured explanation with authorized quick links.
- Emit policy-change invalidation/activity metadata for later runtime/dashboard integration.

## Not in scope

- An enterprise policy language, group precedence, semantic HTTP-risk analysis, or raw-path analytics.
- Runtime cutover to persisted policies, completed in Milestone 13.
- Shared templates that keep copied policies linked.

## Required behavior and interfaces

- Principal applicability is based on current ordinary user UUID and service-group memberships.
- Matching uses normalized method, canonical host, and the exact canonical pathname sent downstream.
- Lower-priority matches are ignored; equal-priority deny wins; no match uses boundary mode.
- Explanation reports applicable/inapplicable rules and reasons, chosen priority, tie/default behavior, assignments, each boundary, and final outcome without secrets.
- Disabled/unassigned policies never authorize a request.

## Security, authorization, invalidation, and audit

- Assigned admins manage policies only inside assigned services; links/details are filtered to viewer authority.
- Policy input rejects routing-changing encodings and invalid/empty principal selectors.
- Copy/paste excludes credentials, secret data, references, grants, and foreign principal IDs not valid in the target service.
- Simulator and runtime calls use the same domain evaluator and equivalent immutable input snapshot.
- Audit sanitized rule diffs and simulator invocations without raw credential values or sensitive request bodies.

## Tests

- Positive: group/direct/`all` applicability, service and credential allows, priority selection, default modes, copy/bulk copy, and complete explanation.
- Negative: equal-priority deny, service deny versus credential allow, one denied credential among several, cross-service principals/copy, invalid selectors/encodings, stale update, and unauthorized quick links.
- Boundary: multiple groups, min/max priorities, many matching rules, disabled rules, no match, canonical path equality, and concurrent update/simulation.
- Integration: table-driven cases prove simulator and runtime evaluator results/explanations are identical.

## Acceptance criteria

- One evaluator implements the PRD algorithm for both enforcement and explanation.
- Service and every used credential boundary must independently allow.
- Editors support safe create/edit/clone/copy/bulk-copy with optimistic concurrency.
- Explanations show why without exposing secrets or unauthorized objects.

## Planning handoff

Specify normalized policy schema, snapshot input/output types, matcher reuse, explanation reason codes, copy ID/principal remapping, query/index strategy, editor validation, activity category emission, and parity-test fixture format.
