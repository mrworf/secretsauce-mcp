# M12 people and account recovery

Transaction start: e9663e5. Product: secretsauce-mcp. Only pre-existing dirty path: untracked test-results/ (excluded). Authority: milestone 12, docs/web-console-prd.md AUTHZ/IDENT, product/security/web-console-security-contract.md SECRES-01–03, product/architecture/web-console-state-contract.md STATE-01–03, product/ux manifest web-console-ux-1 and checklist C01/C07/C08/C11/C12/C15/C20/C21/C22/C25. M10 and M11 are accepted dependencies. No authority changes or later milestone authentication activation.

## Dependency-ordered slices
1. [People, invitations and identity registry](milestone_12_plan_01_slice_01.md).
2. [Self, Owner and host recovery](milestone_12_plan_01_slice_02.md).
3. [Optional delivery and complete role UI](milestone_12_plan_01_slice_03.md).

Synchronous encrypted snapshot transactions serialize competing effects; capability proofs are hash-only and identity/purpose/security-generation-bound. Completion uncertainty publishes committed invalidation. Existing broker/scanner/limiter resources survive. Durable audit is mandatory; no public password-only recovery and no auth-mode activation. SMTP uses bounded TLS delivery with synthetic tests; real external messaging is unauthorized. Manual links use trusted-origin fragments and only issuance displays them.

Validation: focused positive/negative input, authority, expiry, replay, outage and concurrency tests per slice; related console suites. Milestone end npm test and npm run build; actual HTTPS keyboard/320px Playwright harness, sanitized evidence under evidence/qa/secretsauce-mcp/milestone12/. Full-suite EPERM reruns exact command with network permission. One explicit owned-path commit per slice; root owns acceptance/status.
