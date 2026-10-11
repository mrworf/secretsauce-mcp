# Milestone 19: Delete SMTP credentials independently

## Objective

Provide a separate confirmed SMTP credential deletion that cannot be undone by stale drafts or hidden clear-on-apply behavior.

## User/System Outcome

Provide a separate confirmed SMTP credential deletion that cannot be undone by stale drafts or hidden clear-on-apply behavior.

## Scope

Email action and confirmation, current credential/version state, settings draft/review invalidation, delivery admission and restart coherence.

## Explicit Exclusions

Immediate SMTP creation/replacement, deletion of historical encrypted backups, new mail queues, new recovery screens or unrelated credential redesign.

## Source Requirements

Resolved REC-RM-004 from [REC-RUN-003 remediation](../../../workflow/reconciliation/REC-RUN-003/03-remediation-backlog.md), adopted by the committed [definition handoff](../../../workflow/definition/state.yaml) and [validated package](../../../workflow/definition/definition-package.yaml). Detailed authority: IDENT-04/06, CONFIG-03/04; STATE-01/02/03 SMTP amendment; UX-IN09, UX-EX03, UX-C32. Findings are provenance, not independent scope.

## Preconditions

M12 provides SMTP configuration, manual-link fallback and existing audited identity delivery. The existing settings transaction is already delivered. Current approved definition revisions are pinned in [status](status.yaml); all definition gates have passed.


Readiness prerequisite IDs below resolve to the [active feedback manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md#active-feedback-prerequisites).

- `PRE-019–024` — committed approved definition, locked developer tools, declared Chromium, permitted disposable loopback/storage, optional Docker regression facility and delivered console baseline; available with the execution limits recorded in the readiness report. Use isolated synthetic state, never the running user instance.
- `PRE-025` — this milestone owns new positive/negative, browser and failure fixtures for its stated acceptance criteria; existing test/harness infrastructure is a provider, not evidence that changed behavior passes.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml` and `delivery/milestones/secretsauce-mcp/status.yaml`: parent planning commit is finalized, current authority revisions match, this milestone is selected from this packet and its direct predecessors are completed. The completed M10–17 delivery goal and legacy next-MVP selector do not select this new work.
- Run `node --version`, `npm --version`, `openssl version`; Node meets `package.json` >=22, CI/Docker use22, OpenSSL supports the synthetic HTTPS fixtures. From a fresh checkout run `npm ci` using the committed lockfile and `npm run build`. `npm test` remains the full-suite acceptance command; on listener EPERM rerun the same suite with loopback permission.
- Provision the declared browser with `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` (documented Playwright setup in `docs/console-operations.md`). Retain that same environment variable for browser harness commands. This temporary cache can disappear after reboot; reinstall rather than assuming an older cached browser matches the locked version. Browser/network permission may require narrow execution approval; do not change host security or install OS packages implicitly.
- Inspect relevant `scripts/verify-console-*-browser.mjs` and `test/console-*.test.ts` facilities before adapting the owning slice's fixture commands. Pass when actual HTTPS, synthetic roles/state, keyboard, 320px and 200% text/range checks can run without real accounts, SMTP recipients or credentials. Feature evidence is recorded by implementation, not by this readiness check.
- Before any required container regression, `docker version` must report both client/server and `docker compose version` must succeed. Use only disposable loopback-bound test resources and existing launcher/kernel leases. Do not run deployment Compose against the user's current mounts; no container is a prerequisite for starting ordinary source work.

## Functional Requirements

### REC-RM-004

Priority: HIGH. Source finding: REC-006. Product Owner feedback: PO-FB-012/013.
Authoritative basis: adopted PRD IDENT-04/06, CONFIG-03/04, STATE-01/02/03 SMTP amendment. Desired/current behavior: replace clear-on-apply checkbox with independent confirmed deletion of the current credential version; retain existing creation/replacement through draft/review/apply.
Affected actors/interfaces: current recently authenticated Owner; SMTP settings, credential state, delivery admission, pending draft/review/history. Administrator reset privilege does not grant this operation.
UX constraints: distinct Delete SMTP credential action; target/version and consequence confirmation; cancellation leaves state; enabled dependency denial names disable-and-review path; no implicit disable or anonymous fallback.
Security/architecture constraints: current authorization, recent authentication, audit, revision/version and dependency checks at mutation; delete live and pending secret copies atomically, invalidate reviews, retain non-secret drafts for refresh, version-fence old submissions, preserve admitted delivery outcome.


## UX Constraints

Follow canonical [UX manifest](../../../product/ux/manifest.yaml) `web-console-ux-2`. Apply [interaction states](../../../product/ux/02-interaction-patterns.md) UX-IN05, [responsive rules](../../../product/ux/03-responsive-and-platform.md) and [accessibility](../../../product/ux/05-accessibility.md): labeled loading/empty/error/success, linked field errors, safe expired/forbidden/offline/unknown outcomes, visible keyboard focus and return, text plus non-color status. Check actual HTTPS browser at desktop, 320 CSS px and 200% text; inspect document width and text ranges, not only component boxes. Account/logout and authorized recovery paths remain reachable. Preserve only authorized non-secret input; never cache secrets/proofs in browser storage. Use task-appropriate exceptions in [feature exceptions](../../../product/ux/06-feature-exceptions.md).

## Architecture / Security Constraints

Preserve [state contract](../../../product/architecture/web-console-state-contract.md) and [security contract](../../../product/security/web-console-security-contract.md). Enforce current server authorization, recent authentication where required, durable audit admission, generation/revision checks and fail-closed uncertain outcomes. Never log raw credentials, opaque values, cookies, headers, proof material or downstream bodies. Maintain encrypted persistence, live runtime instances, current subject/service references, lease ownership and audit boundaries; no broad infrastructure refactor.

## Interfaces and Compatibility

Creation/replacement retain ordinary draft/review/apply. Disable retains credential and non-secret settings. Independent delete removes live/pending copies, fences older versions and reviews, and permits only fresh deliberate value entry afterward. Existing stored clear-on-apply intent cannot execute as an independent delete without current explicit confirmation; invalidate it safely. Restart/rollback cannot resurrect a deleted version. Archived encrypted backups keep explicit restore semantics.

## Acceptance Criteria

- [ ] Enabled SMTP dependency blocks delete. Disable through review/apply retains secret; subsequent independent delete removes it without changing non-secret settings.
- [ ] Wrong role, expired recent auth, stale confirm/version, concurrent replacement and audit failure reject before deletion. Missing secret reports already absent.
- [ ] Delete removes pending copies; stale draft/history/blank input/browser submission cannot recreate deleted value. Fresh explicit value entry into a current draft and ordinary review/apply remains supported.
- [ ] Queued delivery checks current dependency before dispatch; already-dispatched mail may finish with captured admitted context and cannot resurrect configuration. Manual links and gateway remain available under existing rules.
- [ ] Restart selects coherent prior or completed deletion; uncertain persistence is not reported successful and fences new use. Encrypted historic backups retain their existing explicit restore semantics.

## Required Validation

Synthetic SMTP state/HTTP/browser positive and negative tests, current versus stale version, role/reauth, enabled dependency, audit failure, concurrent replacement, queued versus dispatched mail, restart and uncertain persistence. Demonstrate cancel leaves state and already-absent is not a fresh deletion.

Every new external input requires positive and negative tests. Run targeted and related regressions while implementing, then `npm test` and `npm run build` at milestone completion; retain full listener tests and rerun with required loopback permission if sandbox EPERM occurs. Record sanitized milestone evidence under `evidence/qa/secretsauce-mcp/milestone19/` with relevant UX/browser evidence. Preserve existing gateway, authentication and configuration behavior; actual self-signed HTTPS test is required if downstream transport changes. Do not count mocked or inert controls as browser completion. Documentation examples use `example.org`; include changed user/operator instructions. Readiness supplies executable environment prerequisites separately.

## Known Risks / Deferred Work

In-flight delivery may finish under admitted context; the UI must not promise recall or retroactive backup shredding. Accepted SEC-DEF-001 remains; no universal credential non-exfiltration claim. Actual ChatGPT/Codex validation retains its existing explicit external exception, never represented as passed. No required feedback work is deferred; no implementation slices are prescribed here.
