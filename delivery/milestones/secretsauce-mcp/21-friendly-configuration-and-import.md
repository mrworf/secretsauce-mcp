# Milestone 21: Configure all capabilities with forms and lossless import

## Objective

Make every existing configuration capability usable through friendly controls and readable summaries, with discoverable lossless legacy import into the same permitted drafts.

## User/System Outcome

Make every existing configuration capability usable through friendly controls and readable summaries, with discoverable lossless legacy import into the same permitted drafts.

## Scope

Every UX-IA06 capability row across Settings, service configuration, read/review and Configuration tools; guided import from Services and tools; supported legacy IDs on first import; structured mapping and bounded typed option editors.

## Explicit Exclusions

New gateway features, service-specific templates/profile packs, arbitrary host file/environment reads, automatic activation, reduced advanced capabilities and replacement of working importer or state architecture.

## Source Requirements

Resolved REC-RM-002, REC-RM-006 from [REC-RUN-003 remediation](../../../workflow/reconciliation/REC-RUN-003/03-remediation-backlog.md), adopted by the committed [definition handoff](../../../workflow/definition/state.yaml) and [validated package](../../../workflow/definition/definition-package.yaml). Detailed authority: BASE-01/03, CONFIG-01/03/04, POLICY-02, MIGRATE-01–04, UX-02; UX-IA02/03/04/06, UX-IN01/04; UX-C04/10/23/28/33. Findings are provenance, not independent scope.

## Preconditions

M20 provides focused section navigation, same-settings-draft review and field search; completed M13 supplies import, advanced editor, policy/catalog semantics and history. M20 transitively preserves the completed full console baseline. Current approved definition revisions are pinned in [status](status.yaml); all definition gates have passed.


Readiness prerequisite IDs below resolve to the [active feedback manifest](../../readiness/secretsauce-mcp/prerequisite-manifest.md#active-feedback-prerequisites).

- `PRE-019–024` — committed approved definition, locked developer tools, declared Chromium, permitted disposable loopback/storage, optional Docker regression facility and delivered console baseline; available with the execution limits recorded in the readiness report. Use isolated synthetic state, never the running user instance.
- `PRE-025` — this milestone owns new positive/negative, browser and failure fixtures for its stated acceptance criteria; existing test/harness infrastructure is a provider, not evidence that changed behavior passes.
- `PRE-026` — M20 must be completed with committed Settings/navigation/draft acceptance before this milestone starts; completed M13 already supplies the importer and policy/catalog baseline.

## Readiness checks

- Inspect `workflow/delivery-planning/handoff.yaml` and `delivery/milestones/secretsauce-mcp/status.yaml`: parent planning commit is finalized, current authority revisions match, this milestone is selected from this packet and its direct predecessors are completed. The completed M10–17 delivery goal and legacy next-MVP selector do not select this new work.
- Run `node --version`, `npm --version`, `openssl version`; Node meets `package.json` >=22, CI/Docker use22, OpenSSL supports the synthetic HTTPS fixtures. From a fresh checkout run `npm ci` using the committed lockfile and `npm run build`. `npm test` remains the full-suite acceptance command; on listener EPERM rerun the same suite with loopback permission.
- Provision the declared browser with `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` (documented Playwright setup in `docs/console-operations.md`). Retain that same environment variable for browser harness commands. This temporary cache can disappear after reboot; reinstall rather than assuming an older cached browser matches the locked version. Browser/network permission may require narrow execution approval; do not change host security or install OS packages implicitly.
- Inspect relevant `scripts/verify-console-*-browser.mjs` and `test/console-*.test.ts` facilities before adapting the owning slice's fixture commands. Pass when actual HTTPS, synthetic roles/state, keyboard, 320px and 200% text/range checks can run without real accounts, SMTP recipients or credentials. Feature evidence is recorded by implementation, not by this readiness check.
- Before any required container regression, `docker version` must report both client/server and `docker compose version` must succeed. Use only disposable loopback-bound test resources and existing launcher/kernel leases. Do not run deployment Compose against the user's current mounts; no container is a prerequisite for starting ordinary source work.

## Functional Requirements

### REC-RM-002

Source findings: REC-007. Product Owner feedback: PO-FEEDBACK-2026-10-11-001 / PO-FB-014.
Authoritative basis: MIGRATE-01–04 and UX-IA02–04 already require guided import and preserved identifiers.
Desired/current/required outcome: retain the existing raw YAML importer and explicit mapping/value resolution; add the promised direct Services import action and remove first-import rejection of valid legacy identifier shapes. Do not recreate migration as a new incompatible feature.
Affected users/roles: Owner and Administrator within existing service/catalog versus instance-setting boundaries; Auditor/Member remain read-only or denied. Interfaces: Services entry, Configuration tools, existing configuration/import API and legacy rawConfigSchema.
UX constraints: import creates drafts, explains unresolved mappings/credentials and permits review; direct Services action reaches the same existing flow. Friendly mapping/value and readable import summary controls follow UX-IA06; existing raw YAML remains the deliberate source input.
Architecture/security constraints: own-property-safe dictionaries; no implicit email mapping; imported env/file references never trigger arbitrary host reads; write-only deliberately provided values, current lifecycle/access/credential preservation, audit and stale-revision checks remain. Preserved global proposals require separate Owner review; managed committed configuration remains authoritative.


### REC-RM-006

Priority: MEDIUM. Source finding: REC-005. Feedback PO-FB-010/011. Authority: PRD UX-02 and approved UX-IA06, UX-IN01/04, UX-C28.
Current behavior: shared scanner catalog editing requires JSON and ordinary Settings/read/review surfaces expose raw structure. Required outcome: every preserved supported capability in UX-IA06 has labeled controls and readable effective summaries; raw JSON/YAML remains optional expert tooling, not the sole editing path. Technical literals such as regexes/URLs/claims remain labeled inputs with help and original semantics.
Affected actors/interfaces: all role-permitted configuration forms/read-only views/review/import summaries, same-draft advanced editor, settings and service inheritance links; do not broaden permissions or introduce host filesystem/key controls.
Capability coverage: repeatable destinations; credential metadata/no-auth; placement/header ownership; ordered policy rules and binary/scanning exceptions; Secretlint/sensitive-name Extend/Replace catalogs, pattern/exclusion/allow rows and bounded typed key/value/list rule options; OAuth client/scope/lifetime/throttle controls; limits with units/capacity; email, backup/retention and health summaries; guided import/export/history. The exact normative table UX-IA06 governs, preserving every supported field.


## UX Constraints

Follow canonical [UX manifest](../../../product/ux/manifest.yaml) `web-console-ux-2`. Apply [interaction states](../../../product/ux/02-interaction-patterns.md) UX-IN05, [responsive rules](../../../product/ux/03-responsive-and-platform.md) and [accessibility](../../../product/ux/05-accessibility.md): labeled loading/empty/error/success, linked field errors, safe expired/forbidden/offline/unknown outcomes, visible keyboard focus and return, text plus non-color status. Check actual HTTPS browser at desktop, 320 CSS px and 200% text; inspect document width and text ranges, not only component boxes. Account/logout and authorized recovery paths remain reachable. Preserve only authorized non-secret input; never cache secrets/proofs in browser storage. Use task-appropriate exceptions in [feature exceptions](../../../product/ux/06-feature-exceptions.md).

## Architecture / Security Constraints

Preserve [state contract](../../../product/architecture/web-console-state-contract.md) and [security contract](../../../product/security/web-console-security-contract.md). Enforce current server authorization, recent authentication where required, durable audit admission, generation/revision checks and fail-closed uncertain outcomes. Never log raw credentials, opaque values, cookies, headers, proof material or downstream bodies. Maintain encrypted persistence, live runtime instances, current subject/service references, lease ownership and audit boundaries; no broad infrastructure refactor.

## Interfaces and Compatibility

Forms, expert editor and import edit identical semantic drafts. Preserve all supported literal regexes, ordering, nested options, exceptions, inheritance, existing IDs and own-property-safe dictionary behavior. Keep new-creation restrictions separate from valid legacy import identity. No automatic schema loss or value rotation. Preserve managed encrypted authority and original YAML handover precedence. Rollback of UI leaves supported persisted values readable/editable through retained compatible tooling.

## Acceptance Criteria

- [ ] Owner/Administrator find Import configuration directly from Services and Configuration tools. Guided main YAML and optional scanner-catalog uploads, field/source validation, explicit identity selectors and write-only credential fields produce drafts without automatic activation; show a readable result and unresolved needs under UX-IA04/06/C33. Preserve supported input methods and role boundaries.
- [ ] Supported legacy IDs outside new-creation restrictions, including dictionary-edge names, preserve exact identity on first import, subsequent edits/export and lookup; unsupported fields fail explicitly.
- [ ] Explicit eligible local or registered exact issuer/subject mapping works; unresolved mappings/credentials block activation, disabled identities and implicit emails are rejected.
- [ ] Deliberate values can create missing credentials but cannot silently rotate existing values; referenced environment variables/files are not read. No raw values appear in diagnostics/export/audit.
- [ ] Stale/demoted/unauthorized/oversize/malformed/alias input fails without partial accepted import. Existing assignments, disabled lifecycle and active configuration stay current until authorized review.
- [ ] Each UX-IA06 row is operable using its specified friendly controls; Auditor gets readable effective values without mutation; ordinary reviews summarize named differences instead of forcing raw JSON reading.
- [ ] Forms, expert editor and import round-trip supported values without loss, including regex sources, nested options, legacy IDs, ordering, inheritance and exceptions. No implicit matcher simplification or flattening; unknown imports fail explicitly.
- [ ] Add/remove/reorder or value edits obey existing validation, assignment and priority semantics; unauthorized/direct inputs, invalid regex/limits/options and stale changes fail with field-linked safe recovery and no partial application.
- [ ] Write-only values never reappear in summaries/history/errors/browser storage. Effective inherited values identify defining scope and authorized links; no competing copies of shared defaults. Missing usage metrics are not fabricated.
- [ ] New structured external inputs have positive/negative tests, bounded sizes/depth/work, and current policy/audit checks; preserve supported advanced options even when unusual. All row controls/search/error focus work via keyboard and narrow reflow.

## Required Validation

Produce capability-by-capability UX-IA06 form/read/round-trip evidence. Exercise main YAML and both optional catalogs, missing catalog defaults, complete env/file declarations resolved with separately supplied values, exact registered identities and dictionary-edge legacy IDs through first import/edit/export/lookup. Positive/negative bounded structured inputs, malformed/alias/oversize YAML, unknown fields, invalid regex/options/limits, inheritance, stale scope and disabled identities. HTTPS browser complete tasks without raw JSON, with expert-editor fidelity and read-only role checks.

Every new external input requires positive and negative tests. Run targeted and related regressions while implementing, then `npm test` and `npm run build` at milestone completion; retain full listener tests and rerun with required loopback permission if sandbox EPERM occurs. Record sanitized milestone evidence under `evidence/qa/secretsauce-mcp/milestone21/` with relevant UX/browser evidence. Preserve existing gateway, authentication and configuration behavior; actual self-signed HTTPS test is required if downstream transport changes. Do not count mocked or inert controls as browser completion. Documentation examples use `example.org`; include changed user/operator instructions. Readiness supplies executable environment prerequisites separately.

## Known Risks / Deferred Work

Nested general-purpose rule options require bounded typed key/value/list controls; literal technical values remain literal and must not be guessed or simplified. Accepted SEC-DEF-001 remains; no universal credential non-exfiltration claim. Actual ChatGPT/Codex validation retains its existing explicit external exception, never represented as passed. No required feedback work is deferred; no implementation slices are prescribed here.
