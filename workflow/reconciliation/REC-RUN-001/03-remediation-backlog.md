# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: docs/web-console-prd.md UX-01/04, MIGRATE-01–04; product/ux/01-information-architecture.md UX-IA01–04; product/ux/05-accessibility.md
> Preservation baseline: ca6be40d83df9c204f804904c018870b6becc31f
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

Only the following independent outcomes are resolved. Whole-feedback delivery remains blocked by REC-DEC-001–003 and definition revalidation; do not infer that this backlog covers the unresolved fixes.

| Priority | Remediation | Desired outcome | Findings | Requirements | Dependencies | Required validation |
|---|---|---|---|---|---|---|
| MEDIUM | REC-RM-001 | Visible exclusive current navigation | REC-003 | UX-01/04, UX-IA01 | None | HTTPS browser, keyboard, narrow view |
| MEDIUM | REC-RM-002 | Discoverable lossless legacy YAML import | REC-007 | MIGRATE-01–04, UX-IA02–04 | None | Existing migration regressions, identifiers, role controls |

## REC-RM-001: Visible exclusive current navigation

Source findings: REC-003. Product Owner feedback: PO-FEEDBACK-2026-10-11-001 / PO-FB-005, PO-FB-006.
Authoritative basis: UX-IA01 current location; accessibility current-navigation state; confirmed directive PO-FB-006.
Desired/current/required outcome: current source lacks visual selection and leaves stale peers selected; make the active primary area and applicable subnavigation visibly distinct and expose exactly one current item per navigation group.
Affected users/roles: all authorized console roles. Interfaces: primary menu, service detail/section menus, account and nested return paths; no API change implied.
UX constraints: maintain independent visible keyboard focus, readable contrast and non-color selected cue; preserve existing area labels, narrow wrapping, allowed routes and account/logout reachability.
Architecture/security constraints: no permission widening; current role-based destinations remain enforced.
Acceptance criteria:
1. Moving among every permitted area selects exactly that area visually and programmatically, including return to Services and My account.
2. Each service tab/section shows its own selection without losing parent-area context; no inactive peer remains current.
3. Keyboard focus and selection remain distinguishable; controls reflow at 320 CSS pixels and text enlargement.
4. Hidden unauthorized routes never gain affordances and direct denial behavior remains unchanged.
Dependencies: None. Explicit exclusions: global redesign, new routes, authentication changes.
Required implementation validation: browser-visible selection assertions/screenshots and semantic assertions across role-appropriate navigation sequences, keyboard and narrow layout.

## REC-RM-002: Discoverable lossless legacy YAML import

Source findings: REC-007. Product Owner feedback: PO-FEEDBACK-2026-10-11-001 / PO-FB-014.
Authoritative basis: MIGRATE-01–04 and UX-IA02–04 already require guided import and preserved identifiers.
Desired/current/required outcome: retain the existing raw YAML importer and explicit mapping/value resolution; add the promised direct Services import action and remove first-import rejection of valid legacy identifier shapes. Do not recreate migration as a new incompatible feature.
Affected users/roles: Owner and Administrator within existing service/catalog versus instance-setting boundaries; Auditor/Member remain read-only or denied. Interfaces: Services entry, Configuration tools, existing configuration/import API and legacy rawConfigSchema.
UX constraints: import creates drafts, explains unresolved mappings/credentials and permits review; direct Services action reaches the same existing flow. Settings JSON redesign is outside this independent item.
Architecture/security constraints: own-property-safe dictionaries; no implicit email mapping; imported env/file references never trigger arbitrary host reads; write-only deliberately provided values, current lifecycle/access/credential preservation, audit and stale-revision checks remain. Preserved global proposals require separate Owner review; managed committed configuration remains authoritative.
Acceptance criteria:
1. Owner/Administrator find Import configuration directly from Services and import valid old gateway YAML plus scanner catalogs into drafts without automatic activation.
2. Supported legacy IDs outside new-creation restrictions, including dictionary-edge names, preserve exact identity on first import, subsequent edits/export and lookup; unsupported fields fail explicitly.
3. Explicit eligible local or registered exact issuer/subject mapping works; unresolved mappings/credentials block activation, disabled identities and implicit emails are rejected.
4. Deliberate values can create missing credentials but cannot silently rotate existing values; referenced environment variables/files are not read. No raw values appear in diagnostics/export/audit.
5. Stale/demoted/unauthorized/oversize/malformed/alias input fails without partial accepted import. Existing assignments, disabled lifecycle and active configuration stay current until authorized review.
Dependencies: None. Explicit exclusions: arbitrary server file access, profile packs, automatic activation or bulk replacement of identity/permissions.
Required implementation validation: existing migration/advanced service suites plus positive/negative legacy identifier and direct-entry browser coverage; exercise a complete legacy configuration with env/file credential declarations using separately supplied values. Existing tests were inspected only, not rerun by reconciliation.
