# Milestone 20: Navigate focused Settings with exact draft review

## Objective

Expose one focused Settings destination at a time while making current location and all pending settings changes clear.

## User/System Outcome

Expose one focused Settings destination at a time while making current location and all pending settings changes clear.

## Scope

Exclusive global/service/Settings selection, six focused Settings destinations, responsive selection, authorized field search, unsaved navigation guard and exact full-scope draft review.

## Explicit Exclusions

New settings capabilities, per-section partial apply, ARIA tabs for page navigation, reduced mobile permissions, global visual redesign and form-capability expansion owned by M21.

## Source Requirements

Resolved REC-RM-001, REC-RM-005 from [REC-RUN-003 remediation](../../../workflow/reconciliation/REC-RUN-003/03-remediation-backlog.md), adopted by the committed [definition handoff](../../../workflow/definition/state.yaml) and [validated package](../../../workflow/definition/definition-package.yaml). Detailed authority: UX-01/02/03/04, CONFIG-03; UX-IA01/05, UX-IN01/02/05, UX-R04, UX-V04, UX-A05; UX-C26/27. Findings are provenance, not independent scope.

## Preconditions

M15 supplies complete operating/settings surfaces; M17 supplies backup/restore task and maintenance views that must remain reachable within the section shell. No new application foundation is needed. Current approved definition revisions are pinned in [status](status.yaml); all definition gates have passed.


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

### REC-RM-001

Source findings: REC-003. Product Owner feedback: PO-FEEDBACK-2026-10-11-001 / PO-FB-005, PO-FB-006.
Authoritative basis: UX-IA01 current location; accessibility current-navigation state; confirmed directive PO-FB-006.
Desired/current/required outcome: current source lacks visual selection and leaves stale peers selected; make the active primary area and applicable subnavigation visibly distinct and expose exactly one current item per navigation group.
Affected users/roles: all authorized console roles. Interfaces: primary menu, service detail/section menus, account and nested return paths; no API change implied.
UX constraints: maintain independent visible keyboard focus, readable contrast and non-color selected cue; preserve existing area labels, narrow wrapping, allowed routes and account/logout reachability.
Architecture/security constraints: no permission widening; current role-based destinations remain enforced.


### REC-RM-005

Priority: MEDIUM. Source finding: REC-004. Feedback: PO-FB-007/008/009; PO-FB-009 remains exploratory historically. Authority: approved UX-DESIGN-002; UX-IA05, UX-R04, UX-V04, UX-A05, UX-C26/27 and PRD UX-02/CONFIG-03.
Current behavior: all Settings groups appended into a long page. Required outcome: six ordered destinations—Response protection, MCP authentication, Limits, Email, Backups & restore, Health & retention—with only selected content visible. Initial entry selects Response protection; links/back retain selected destination. Desktop secondary navigation uses current-page links; narrow layout a labeled ordinary select. Applied readable summary precedes authorized Edit.
Affected actors/interfaces: Owner full scope, Administrator editable response protection and authorized non-secret inspection, Auditor read-only, Member no Settings; existing account/logout and backup Owner boundaries remain. Navigation/search/error links and settings draft/review interfaces change coherently.
UX/state constraints: all editable sections use the permitted settings draft; section changes do not apply/discard it. Persistent draft summary distinguishes saved versus unsaved sections. Exact full-scope review lists all changed sections and applies the reviewed set atomically, without per-section partial apply or unrelated settings. Current permissions/dependencies/base revisions remain enforced. Immediate security/value actions can stale draft authority.


## UX Constraints

Follow canonical [UX manifest](../../../product/ux/manifest.yaml) `web-console-ux-2`. Apply [interaction states](../../../product/ux/02-interaction-patterns.md) UX-IN05, [responsive rules](../../../product/ux/03-responsive-and-platform.md) and [accessibility](../../../product/ux/05-accessibility.md): labeled loading/empty/error/success, linked field errors, safe expired/forbidden/offline/unknown outcomes, visible keyboard focus and return, text plus non-color status. Check actual HTTPS browser at desktop, 320 CSS px and 200% text; inspect document width and text ranges, not only component boxes. Account/logout and authorized recovery paths remain reachable. Preserve only authorized non-secret input; never cache secrets/proofs in browser storage. Use task-appropriate exceptions in [feature exceptions](../../../product/ux/06-feature-exceptions.md).

## Architecture / Security Constraints

Preserve [state contract](../../../product/architecture/web-console-state-contract.md) and [security contract](../../../product/security/web-console-security-contract.md). Enforce current server authorization, recent authentication where required, durable audit admission, generation/revision checks and fail-closed uncertain outcomes. Never log raw credentials, opaque values, cookies, headers, proof material or downstream bodies. Maintain encrypted persistence, live runtime instances, current subject/service references, lease ownership and audit boundaries; no broad infrastructure refactor.

## Interfaces and Compatibility

Preserve existing authorized routes and task entry points, saved settings draft and atomic apply. Existing deep links/back navigation retain valid context or resolve safely to the corresponding new destination. Navigation changes do not alter persisted configuration, lifecycle or role grants. Rollback of presentation must preserve saved drafts and current revision checks.

## Acceptance Criteria

- [ ] Moving among every permitted area selects exactly that area visually and programmatically, including return to Services and My account.
- [ ] Each service tab/section shows its own selection without losing parent-area context; no inactive peer remains current.
- [ ] Keyboard focus and selection remain distinguishable; controls reflow at 320 CSS pixels and text enlargement.
- [ ] Hidden unauthorized routes never gain affordances and direct denial behavior remains unchanged.
- [ ] Each of six authorized destinations renders only its own content; clear global/local selection, parent context, browser back/link entry and narrow selector preserve reachable actions.
- [ ] Section/search navigation with unsaved input offers Stay, Save draft and continue, Discard unsaved edits and continue; discard does not erase another section's saved draft. No secret browser storage or hidden autosave.
- [ ] Search indexes authorized non-secret labels/help/technical aliases; selecting a result opens containing section/disclosure and focuses field/value. No result leaks forbidden settings or secret data. Clearing search preserves selected section.
- [ ] Error-summary navigation reaches failures across sections without losing safe edits. Review names every changed section, preserves role scope, supports return to selected section, and rejects stale base/dependency/demotion without partial application.
- [ ] Settings work at 320 CSS pixels and 200% text enlargement; inspect document width, component and text-range overflow, keyboard/focus and accessible current-selection semantics. Offline/expiry/audit/unknown completion retains only safe context and requires current status before retry.

## Required Validation

Actual HTTPS browser role matrices for global/service/account/Settings navigation, deep links/back, search/disclosure/error focus, Stay/Save/Discard branches and exact all-section review. State/HTTP regressions prove no partial apply or authorized-scope widening, including permission/dependency/base changes. Retain backup/restore/health maintenance and action reachability checks.

Every new external input requires positive and negative tests. Run targeted and related regressions while implementing, then `npm test` and `npm run build` at milestone completion; retain full listener tests and rerun with required loopback permission if sandbox EPERM occurs. Record sanitized milestone evidence under `evidence/qa/secretsauce-mcp/milestone20/` with relevant UX/browser evidence. Preserve existing gateway, authentication and configuration behavior; actual self-signed HTTPS test is required if downstream transport changes. Do not count mocked or inert controls as browser completion. Documentation examples use `example.org`; include changed user/operator instructions. Readiness supplies executable environment prerequisites separately.

## Known Risks / Deferred Work

Cross-section unsaved input and immediate actions can stale shared drafts; do not invent autosave or silent rebase. Accepted SEC-DEF-001 remains; no universal credential non-exfiltration claim. Actual ChatGPT/Codex validation retains its existing explicit external exception, never represented as passed. No required feedback work is deferred; no implementation slices are prescribed here.
