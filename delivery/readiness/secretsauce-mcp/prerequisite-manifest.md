# Milestone prerequisite manifest — approved feedback

- Packet: `delivery/milestones/secretsauce-mcp/status.yaml`
- Product ID: `secretsauce-mcp`
- Audited revision: compiler packet `sha256:ef5ac5285860c20f70df161413849909f4ff06f1ca80fa295d8f7fb68e6e6611`; exact post-readiness packet pinned in `workflow/delivery-planning/results/readiness.yaml`.
- Source transaction: `4d46db3fa08a25df52b8d7b0aa2357cf8446b2fd`
- Planning transaction: parent-owned, pending finalization in `workflow/delivery-planning/handoff.yaml`; start `9ff135f3299fa36d773c243b72c0185a5fbd7fb5`.
- Intended pending order: M18, M19, M20, M21; only M20 → M21 is a new dependency.
- Order evidence: packet `status.yaml` dependencies and `index.md#milestones-and-dependencies`.
- Last audit: 2026-10-11.

## Active feedback prerequisites

These rows govern M18–21. The original PRE-001–018 manifest is retained below as historical initial-build evidence, including its then-pending providers and external gates. Its old status is not the current delta status; completed M10–17 records and the explicit local-validation exception remain intact.

| ID | Description | Consumers | Classification | Current status | Proposed provider | Class | Verification | Commands executed | Files changed | Blocking | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRE-019 | Committed current definition, approved UX2, resolved remediation and planned packet | M18–21 | Already satisfied | Compiler verified source hashes/history; final planning commit remains parent closeout | Repository definition package and parent transaction | AUTO | Inspect source hashes and finalized parent handoff before delivery | Compiler result consumed; Git HEAD/status inspection | None | Yes before delivery handoff | FACT: workflow/definition/definition-package.yaml; compiler.yaml eligibility and source |
| PRE-020 | Declared runtime, lockfile dependencies, compiler and HTTPS fixture tools | M18–21 | Already satisfied | Node26.11.1/npm12.2.0/OpenSSL3.6.5; isolated locked install and build pass | package.json, package-lock.json, CI Node22, Dockerfile | AUTO | npm ci; npm run build; node/npm/openssl versions | Isolated npm ci --offline --no-audit --no-fund:215 packages; npm run build PASS | None | Yes before implementation/build | FACT: package.json engines/scripts; .github/workflows/ci.yml; scripts/verify-console-people-browser.mjs |
| PRE-021 | Matching declared Playwright Chromium for actual HTTPS/keyboard/reflow checks | M18–21 | Already satisfied | Missing current browser remediated using documented download to disposable /tmp; headless launch/focus PASS | Locked @playwright/test and documented install | AUTO | Same PLAYWRIGHT_BROWSERS_PATH for install and harness execution; launch current browser | Documented install completed with network permission; synthetic headless page/focus PASS Chromium156.0.8078.4 | None; temporary browser files only | Yes before UI acceptance | FACT: docs/console-operations.md browser procedure; current scripts import declared Playwright |
| PRE-022 | Writable synthetic temp state and loopback/network execution permission | M18–21 | Already satisfied | Disposable checkout/storage and loopback request verified; restricted default fails EPERM | Authorized execution runner and isolated test facilities | AUTO | Ephemeral 127.0.0.1 listener/fetch; permission-preserving rerun on EPERM | Default EPERM; identical permitted probe PASS | None | Yes before local validation | FACT: AGENTS.md; test/setupAudit.ts; existing HTTP/HTTPS fixtures |
| PRE-023 | Docker/Compose and isolated mounts for any affected container regression | M18–21 when container checks are required | Already satisfied | Client/server29.9.0 and Compose5.6.0 available through narrow permission; no container started | Existing local Docker and committed launcher/drill scripts | AUTO | docker version; docker compose version; inspect target isolation before each drill | Socket denied by default; permitted read-only version PASS | None | Conditional before required container validation, not source-work start | FACT: Dockerfile; scripts/docker-launcher.mjs; scripts/verify-console-*-docker.mjs; prior M17 acceptance |
| PRE-024 | Delivered encrypted state, audit, identity/grants, settings/import, operating and recovery infrastructure | M18–21 | Already satisfied | M10–17 completed with committed local acceptance; known real-client NOT RUN preserved | Existing repository M10–17 | AUTO | Inspect completed records and source/harness/acceptance artifacts, retain working behavior | Records, source facilities and M17 cumulative acceptance inspected | None | Yes before dependent work | FACT: status.yaml records; evidence/qa/secretsauce-mcp/milestone17/acceptance.md; src and test console/OAuth modules |
| PRE-025 | Delta-specific fixtures, migrations, failure/race tests and capability/browser coverage | M18–21 | Owned by the consuming milestone | Pending implementation by each outcome; credible reusable local facilities verified | Each consuming milestone | AUTO | Required Validation and slice plan identify test data, safe output and exact executable commands before acceptance | Not run: future feature acceptance; existing harness/test files inspected | None | Yes before owning milestone acceptance | FACT: M18–21 Required Validation; test/console-people*, console-notifications, console-advanced, managed-oauth; scripts/verify-console-* |
| PRE-026 | Focused Settings shell, authorized field navigation and exact settings draft review | M21 | Provided by an earlier milestone | Pending M20, ordered before M21 | M20 | AUTO | M20 completed with current committed acceptance and preserved full-console routes | Not run: future implementation | None | Yes before M21 starts | FACT: status.yaml M21 dependencies; M20 Scope and M21 Preconditions |

No newly required real external account, SMTP provider, production secret, database, hosted endpoint or OS installation. Actual LLM platform connection evidence remains historical NOT RUN; this delta's reset revocation, configuration and import checks use actual local HTTPS plus synthetic OAuth/MCP clients. This does not extend the old waiver to a new release/interoperability claim. Any such claim still needs the existing real-client procedure. No external node consumes a new milestone in the audited graph.

## Active dependency graph

```mermaid
flowchart LR
  R[Declared repository and execution facilities] -->|PRE-019–023| M18[18]
  R -->|PRE-019–023| M19[19]
  R -->|PRE-019–023| M20[20]
  R -->|PRE-019–023| M21[21]
  C12[Completed12] -->|PRE-024 identity and SMTP| M18
  C14[Completed14] -->|PRE-024 current durable grants| M18
  C12 -->|PRE-024 SMTP and drafts| M19
  C15[Completed15] -->|PRE-024 settings and operations| M20
  C17[Completed17] -->|PRE-024 recovery surfaces| M20
  C13[Completed13] -->|PRE-024 importer and catalogs| M21
  M20 -->|PRE-026| M21
```

Each milestone owns PRE-025. Completed baseline providers have all transitive dependencies in the preserved manifest. M13 is already completed and is available transitively through M20's M15 dependency. Shared files do not require new feature ordering: M18/19 can deliver in the current shell; M20 must preserve whichever completed actions exist. Sequential M18, M19, M20, M21 minimizes concurrent editing without inventing dependencies.

## Clean-environment setup and verification

From a clean checkout, provide declared Node>=22/npm, OpenSSL, writable temporary storage and permitted loopback execution. `npm ci` uses the lockfile; `npm run build` compiles. Use `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-feedback-browsers npx playwright install chromium` and pass the same variable to browser commands. Network/browser execution needs normal narrow sandbox permission here. If OS libraries are missing on a different host, that host must supply them; this host's launch succeeded without OS changes. The `/tmp` browser cache is disposable and not an undeclared permanent provider.

All synthetic keys/users/SMTP/downstreams/archives derive from existing fixture code; no running application or real account is assumed. M18 consumes completed identity/grant providers; M19 consumes SMTP/store/review providers; M20 consumes delivered settings/backup/recovery routes; M21 consumes completed M20 plus existing M13. Implementing each new behavior and updating affected fixtures is PRE-025, not missing bootstrap.

Current evidence separates facility checks from feature acceptance. Clean lockfile installation used available npm cache, not a cold registry or CI Node22 run. npm12 blocked esbuild postinstall under its existing allowScripts policy; build nevertheless succeeded, and no policy was weakened. Baseline620-test/67-file evidence is historical M17 acceptance, not a newly executed suite. Run required new/related tests, full suite and browser tasks during delivery. No application test or acceptance is claimed by this document-only readiness transaction.

## Historical initial-build manifest (preserved)

# Milestone Prerequisite Manifest

- Packet: `delivery/milestones/secretsauce-mcp/status.yaml`
- Product ID: `secretsauce-mcp`
- Audited revision: final packet content digest in `workflow/delivery-planning/results/readiness.yaml`; compiler input `sha256:be71b3924591bc444b5da8b31ef0982f9e5e207024683c4c74806d2e13b8fe0d`.
- Source transaction: `06dd0ee59defd1a75db121f1d8133c7100238b80`; definition provenance closeout `bb6f29cd318b77c2cf70efa5b1f9adaf25fdf2cb`.
- Planning transaction: pending parent finalization; canonical commit is `workflow/delivery-planning/handoff.yaml` transaction.repository_commit. No child commit.
- Intended order: `10 → 11 → 12 → {13,14} → 15 → 16 → 17`.
- Order evidence: packet `status.yaml` dependencies and `index.md` Milestones and dependency contracts.
- Last audit: `2026-10-10T02:04:36+00:00`.

Current readiness concerns providers and execution facilities, not implementation completion. All eight milestones remain pending. A future provider is not described as already satisfied. Common developer inputs are explicit: supported Node/npm, locked package retrieval via registry or populated cache, writable working/temp directories, loopback permission and a local browser. No undeclared global frontend/database/service is assumed.

| ID | Description | Consumers | Classification | Current status | Proposed provider | Class | Verification | Commands executed | Files changed | Blocking | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRE-001 | Committed definition, approved UX and unchanged historical gateway authority | 10–17 | Already satisfied | Verified source package/manifest revisions; no product decisions pending | Repository definition package and compiled_from | AUTO | Inspect exact source revisions and producer history; inspect approved UX manifest | Compiler source checks consumed; Git HEAD/status inspected | None | Yes, before starting | FACT: status.yaml compiled_from; workflow/definition/definition-package.yaml |
| PRE-002 | Existing source, fixture catalogs, build/test scripts and CI baseline | 10–17 | Already satisfied | Verified 33 test files / 372 tests and build in isolated install | Repository package.json, lockfile, src, test, .github/workflows/ci.yml | AUTO | npm run build; npm test | Passed; initial sandbox listener failure resolved by unchanged permitted rerun | None | Yes, before validating | FACT: package.json scripts; CI quality-gates; test/gateway.test.ts self-signed fixtures |
| PRE-003 | Node >=22, npm, package retrieval and writable checkout/temp storage | 10–17 | Already satisfied | Host Node26.11.1/npm12.2.0; isolated cached installation verified; CI pins Node22 | Declared developer runtime plus locked npm packages | AUTO | node --version; npm --version; npm ci on clean checkout with registry/cache access | Versions; isolated npm ci --offline --no-audit --no-fund succeeded | None | Yes, before starting | FACT: package.json engines; Dockerfile Node22; CI setup-node22. Cold-network retrieval not exercised |
| PRE-004 | Loopback listener permission and disposable filesystem for tests | 10–17 | Already satisfied | Available through approved narrow network execution; restricted default denies bind | Execution runner / existing synthetic test facilities | AUTO | npm test with loopback permission; no public bind required | Sandbox EPERM; identical npm test with loopback permission passed372 | None | Yes, before validating | FACT: AGENTS.md loopback rule; test/server.test.ts and test/gateway.test.ts |
| PRE-005 | Browser available for rendered, keyboard and narrow-width evidence | 10–17 | Already satisfied | Chrome154 installed; approved concept rendered earlier; no product browser acceptance yet | Developer browser; clean runner must explicitly provide browser | AUTO | Check installed browser version; render implemented local page and verify keyboard/320px when available | /opt/google/chrome/chrome --version; prior UX inspection consumed | None | Yes, before UI validation | FACT: installed Chrome; workflow/definition/drafts/product-ux/web-console-initial/index.md Visual inspection |
| PRE-006 | Reproducible console build/browser harness, durable-store setup and synthetic auth/fault fixtures | 10 | Owned by the consuming milestone | Not implemented; explicit first outcome scope | 10 secure setup vertical outcome | AUTO | Inspect 10 implementation plan for declared dependencies, lockfile, fixture-only storage/keys, browser commands and safe teardown; execute at acceptance | Not run: future implementation | None | Yes, before 10 acceptance, not before 10 implementation | FACT: 10 Scope/Architecture/Required Validation; no mandated external DB, framework or paid tooling |
| PRE-007 | Durable enrolled identity, current RBAC/audit admission, proof/session and operation status contracts | 11–17 | Provided by an earlier milestone | Pending provider10; baseline fail-open audit is intentionally replaced there | 10 | AUTO | Inspect completed10 status, slice commits and acceptance evidence before11; recheck transitive consumers | Not run: future implementation | None | Yes, at each consuming start | FACT: 10 outcome; 11 Preconditions; downstream audit constraints |
| PRE-008 | Shared drafts/apply/runtime publication, write-only credentials, service assignment/lifecycle | 12–17 | Provided by an earlier milestone | Pending provider11 | 11 | AUTO | Inspect completed11 status and atomicity/current-admission evidence before12 | Not run: future implementation | None | Yes, at each consuming start | FACT: 11 Interfaces; 12–17 Preconditions |
| PRE-009 | Four-role lifecycle/recovery, external issuer-subject registry and optional notification boundary | 13–17 | Provided by an earlier milestone | Pending provider12 | 12 | AUTO | Inspect completed12 status and identity-registry/recovery/notification evidence | Not run: future implementation | None | Yes, at each consuming start | FACT: 12 registry Functional Requirements; 13/14 both explicitly consume12 |
| PRE-010 | Complete advanced settings, explicit migration, sanitized history and export | 15–17 | Provided by an earlier milestone | Pending provider13 | 13 | AUTO | Inspect completed13 status and field-round-trip/history validation | Not run: future implementation | None | Yes, before15 | FACT: 13 outcome; 15 Preconditions |
| PRE-011 | Per-user MCP grants, current auth modes and client/restart integration | 15–17 | Provided by an earlier milestone | Pending provider14 including live-client evidence | 14 | AUTO | Inspect completed14 status and client evidence satisfying PRE-015 | Not run: future implementation | None | Yes, before15 | FACT: 14 acceptance; 15 Preconditions |
| PRE-012 | All persisted product domains, limits, audit provenance views and persistent deployment runbook | 16–17 | Provided by an earlier milestone | Pending provider15 including Docker evidence | 15 | AUTO | Inspect completed15 status, operating-envelope and deployment evidence | Not run: future implementation | None | Yes, before16 | FACT: 15 outcome; 16/17 Preconditions |
| PRE-013 | Portable encrypted archives, independent recovery material, manifest and job gate | 17 | Provided by an earlier milestone | Pending provider16; synthetic key material generated during implementation | 16 | AUTO | Inspect completed16 status and independently decrypted archive fixture with exclusion checks | Not run: future implementation | None | Yes, before17 | FACT: 16 Interfaces/acceptance; 17 Preconditions |
| PRE-014 | New fixtures, bounded parsers, fault/clock/load/storage harnesses and operational validation for each outcome | 11–17 | Owned by the consuming milestone | Future implementation; existing local HTTP/HTTPS fixtures are reusable | Each consuming milestone; earlier shared harness from10 | AUTO | Inspect owning Required Validation and implement declared fixture commands; synthetic credentials only | Not run: future implementation | None | Yes, before owning acceptance | FACT: each contract Required Validation; test/auth.test.ts temp key/state fixtures; no real downstream service required |
| PRE-015 | Authorized real ChatGPT and Codex test access with reachable isolated MCP endpoint | 14,17 | Requires user action | Unverified; no account authorization or external reachability assumed | Product Owner / authorized interoperability tester | USER_ACTION | Instructions below; dated real-client flow results for both clients | Not run: no account sign-in or endpoint provisioning authorized here | None | Yes at14 acceptance, repeated17; no block on10 | FACT: 14 acceptance explicitly real clients; 17 required reconnect evidence |
| PRE-016 | Permitted Docker daemon, isolated proxy/storage deployment and disposable recovery target | 15–17 | Requires user action | CLI29.9.0/Compose5.6.0 present; daemon denied in current sandbox; usable test host unverified | Host operator / CI maintainer | USER_ACTION | Instructions below; daemon/version evidence then milestone smoke/restart and isolated restore records | docker version denied daemon socket; docker compose version passed | None | Yes at15 Docker validation and16/17 operational drills; no block on10 | FACT: 15 Docker smoke acceptance; 16 mounted backups; 17 clean-host drill |
| PRE-017 | Optional SMTP delivery exercised safely without real recipients/provider setup | 12,16 | Owned by the consuming milestone | Local stub/manual-link path allowed; production SMTP is optional | 12 notification fixtures;16 backup-alert fixtures | AUTO | Verify bounded synthetic delivery success/failure and manual fallback; no live mail required | Not run: future implementation | None | Yes for feature evidence; external SMTP non-blocking | FACT:12 Known Risks and functional manual fallback;16 notification tests |
| PRE-018 | Protected synthetic archive/keys, separate empty storage and failure-injection fixtures for recovery | 16,17 | Owned by the consuming milestone | Generated from completed providers in disposable directories; not production data | 16 archive fixtures and17 recovery fixtures; PRE-016 operator test host for deployment drill | AUTO | Verify independence from original state/key, rollback isolation and fresh enrollment with synthetic data | Not run: future implementation | None | Yes before recovery acceptance | FACT:16 clean isolated decryption;17 validation and conditional RTO. Replacement production infrastructure is outside drill scope |

## External completion instructions

**PRE-015 — Product Owner / authorized interoperability tester; first consuming boundary: milestone14 acceptance, repeated at17 after restore.** Before that boundary, confirm access to both clients capable of custom MCP connections and provide an authorized isolated test endpoint reachable from those clients. Use synthetic services/accounts and HTTPS reachable from ChatGPT; keep management exposure constrained as designed. The operator owns any account registration, authentication, DNS/certificate/firewall or existing test-infrastructure changes. Do not publish a private instance automatically or send raw client secrets in workflow evidence. Record tester authorization, client/version/date, successful consent/discovery/reference/request/denial/revoke/restart/reconnect for both clients with safe screenshots/results under `evidence/platform/`. Re-run fresh authorization/reconnect after restore in17. No mocks substitute for these records. Milestone14 may develop protocol behavior beforehand but cannot complete without this evidence;15 cannot start before14 completes.

**PRE-016 — Host operator / CI maintainer; first consuming boundary: milestone15 Docker/proxy validation, continued16/17.** Supply an already authorized disposable Docker-capable host or CI job with permitted daemon access, image/package retrieval, writable independent app/audit/backup mounts and sufficient temporary staging/rollback storage for the declared synthetic fixture. Verify `docker version` reports client and server successfully and `docker compose version` succeeds. Then, using the implemented milestone15 deployment instructions, record one-instance build/start/health/restart, persisted state/audit/signing behavior and ephemeral references. Before16/17 drills, record separate disposable empty target storage, archive plus independently held synthetic recovery material, fault-injection cleanup procedure and disk-capacity check for the actual fixture. Record snapshot/decryption and clean-host/failed-install/reconnect timing evidence under `evidence/platform/`. Do not change Docker group membership, install OS packages, start persistent services or alter real deployment state during readiness. Current socket denial proves this sandbox lacks access, not that Docker is absent or globally broken. Existing CI defines Docker builds; actual updated runtime smoke/drill execution is still unverified.

## Developer and milestone-owned facilities

**PRE-003/004:** The isolated installation used the committed lockfile and local npm cache, not the original node_modules. It is not a cold-network Node22 environment test. Current Node26 satisfies the declared >=22 range; CI/Docker still specify22. A future clean runner executes `npm ci`, `npm run build`, `npm test` with its declared Node22 CI baseline. Network/cache failure is an environment prerequisite to resolve then, not evidence that packages are missing now. npm12 warned that esbuild postinstall was blocked by its allowScripts policy; no approval/config was changed, and build/test worked with locked platform packages. If a chosen future dependency requires build scripts, make the need explicit within its consuming implementation plan.

**PRE-005/006:** Installed browser existence/version and earlier concept rendering establish a usable current facility, not console UX acceptance. An isolated prior browser cache and undeclared Playwright/React/database packages in the original node_modules are not clean-environment providers. Milestone10 must declare and lock its actual console/test dependencies and reproducible browser commands or documented manual procedure as part of its vertical outcome. Browser/OS installation, if needed on a different runner, is operator-owned; pause that runner until available. No particular framework/database/browser library is required by this packet.

**PRE-014/017/018:** Fixture generation, in-process mock SMTP/HTTP services, disposable key/identity stores, workload/fault clocks and archive corruption fixtures belong to the outcome they prove. No real service credential, external SMTP account, production data, remote backup integration or new shared infrastructure is needed for these cases. The full self-signed HTTPS gateway tests already carry their certificate fixture; OpenSSL is not a newly imposed runtime prerequisite.

## Dependency graph

Repository/environment provides PRE-001–005 to every milestone. Milestone10 owns PRE-006. Each consumer owns PRE-014 where listed;12/16 own PRE-017;16/17 own PRE-018. The graph below shows every cross-milestone provider plus explicit external gates. Edges to the earliest dependent carry the same prerequisite transitively to all consumers listed above.

```mermaid
flowchart LR
  R[Repository and declared developer facilities] -->|PRE-001–005| M10[10]
  M10 -->|PRE-007| M11[11]
  M11 -->|PRE-008| M12[12]
  M12 -->|PRE-009| M13[13]
  M12 -->|PRE-009| M14[14]
  M13 -->|PRE-010| M15[15]
  M14 -->|PRE-011| M15
  M15 -->|PRE-012| M16[16]
  M16 -->|PRE-013| M17[17]
  E1{{Authorized real clients and reachability}} -->|PRE-015 acceptance| M14
  E1 -->|PRE-015 reconnect| M17
  E2{{Host operator Docker and disposable storage}} -->|PRE-016 validation| M15
  E2 -->|PRE-016 operational drills| M16
  E2 -->|PRE-016 recovery drill| M17
```

No unresolved provider, forward provider or cycle was found. External setup does not depend on a later product milestone; concrete product smoke/drill evidence waits for the owning implementation. M13 and M14 share the already-provided registry from12 and need no dependency on each other. Combined import/client integration is checked after both at15.
