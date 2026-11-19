# PRD targeted revalidation — feedback 003

**Implementation-ready: yes**, for the bounded adopted product contract. This is a PRD-stage PASS, not a completed definition-package, delivery, UX implementation or release acceptance. Other required specialist stages and committed package provenance remain the orchestrator's completion gates.

## Scope and authority

Reviewed all feedback PO-FB-042–124, settled REC-DEC-008/009/010, approved UX-DESIGN-004 direction, adopted CONFIG-01–05, AUDIT-01, backup and migration changes, and directly affected authorization/policy boundaries. Preserved existing single-organization scope, roles, client compatibility and unrelated passed requirements. The historical proposal's Unapproved label is superseded by the exact-proposal approval ledger and canonical UX4; it is not a new product question. The reconciler confirmed PRD content stable before this result.

## Contract checks

| Scope | Result and concrete authority |
| --- | --- |
| Service rows and lifecycle | CONFIG-05 plus UX-IA09/C43 distinguish lifecycle, draft and executable readiness. Row navigation and actions coexist; Delete confirms existing retained-history archive and restoration to Disabled. Enable still reviews current dependencies. No purge or health-check claim was invented. |
| Configuration structure and navigation | CONFIG-01 and UX-IA09/IN15/C44–46 define focused populated sections, one full-service Guided/Advanced switch, linked creation steps, history navigation, actual-change guards and repeated-item focus. Existing literal/advanced capabilities survive. |
| Help and technical identifiers | UX-IN15 explains API documentation, allowed hosts, matching modes, certificate default/override scope and placement prefixes/suffixes without secrets. MCP-visible service IDs remain discoverable; imported identifiers are never silently changed. The conditional hiding request is preserved. |
| Credential entry and attribution | CONFIG-02/03 and UX-IN14/C47–48 consistently separate immediate write-only Set/Replace dialogs from metadata drafts. Last successful actor/time is durable and honest for legacy, removed and restored identities. Navigation cannot submit or require an unrelated replacement secret. |
| Clear versus delete | CONFIG-02/03 and STATE-09/SECRES-08 agree on current plus saved-draft dependencies, exact retained key, current/draft-only impact, missing-value dispatch gating, stale confirmation, no-op, cancellation and current permission. Set restores only otherwise eligible Active use; no lifecycle/grant/authentication change is implicit. |
| Uncertainty and recovery | CONFIG-03/04, AUDIT-01 and backup clauses incorporate audit admission, removal of normalized copies, generation/restart fencing, late-response protection, no resurrection through history and coherent absence/attribution in snapshots. Older archives remain explicitly recoverable only under disabled-and-reviewed whole-instance restore. SMTP retains its distinct dependency block and draft replacement semantics. |
| Policies and tester | POLICY-01–04 plus UX-IN16/C49–50 preserve highest-priority/equal-priority deny rules, mixed effects under either default, custom methods and exact patterns/options. Common methods are selectable; Add/Edit share dialogs; test is no-I/O and returns without spurious dirty state. The user's allow-default inference was not turned into a new policy restriction. |
| Access and import repair | AUTHZ-01/02, CONFIG-03, MIGRATE-01/02 and UX-IA10/C51–52 distinguish explicit current grants, proposed first activation and legacy-subject mapping. Errors name unresolved subject/context with in-draft repair; no guessing identity, implicit grant or loss of unrelated safe work. |
| Visual and accessibility acceptance | Existing UX-04 and UX-C43–53 require text statuses, keyboard/focus, dialogs, narrow layouts, matching-state screenshot comparison and preserved exact distinguishing literals. UX approval is not a substitute for later implementation evidence. |

## Readiness gates and traceability

All twelve PRD gates were considered proportionally. Product purpose and unchanged operating/client boundaries retain prior validated authority. Changed actor/lifecycle/data/security/recovery contracts are explicit above. Positive, denial, stale, no-op, uncertainty/restart and backup cases are specified by STATE-09 and SECRES-T17–T21; service interaction cases are UX-C43–53. No material product choice or unconfirmed assumption remains in this scope. REC008 is RESOLVED with no required decisions and correctly requires definition revalidation before delivery.

Architecture and security retain their independent final review responsibilities; internal persistence mechanisms remain their concern, not a new owner decision. Coverage/journey validation must trace the newly adopted requirements. No PRD correction was necessary, no behavior was implemented, and no live-system test was claimed. Exact validated hashes are recorded in prd.yaml; unchanged historical review results remain in version control rather than being reopened.

## Provenance freshness check

Verified by exact reconstruction of the previous validated hashes that subsequent central ledger changes only close REC-DEC-008/009/010 routing/adoption; manifest and brief changes only refresh the ledger and dependent brief hashes. All substantive validated inputs remain byte-identical. PASS retained; no renewed product review or authority mutation.
