# Information architecture

## UX-IA01 — Shell, navigation and orientation

Use four primary areas in this order: **Services**, **People & Access**, **Activity**, **Settings**. Services is the landing page. Show instance name as context, never as an implied tenant switcher. Show current area, selected service and page title. A persistent **My account** control exposes password, MFA/recovery codes, own browser sessions and logout. Own connected clients are accessible from both My account and People & Access. Preserve account/logout reachability on narrow screens even though the compact prototype omits this control.

Only show destinations the actor may use. Owner receives all areas. Administrator receives service configuration/access, eligible-identity assignment and activity; Owner-only instance settings are readable where non-secret configuration is authorized but not editable; shared response-protection editing remains available under the PRD scanning permission. Auditor receives read-only configuration and evidence, including read-only Settings, and no MCP execution or mutation affordances. Member sees assigned-service discovery and connection information, own activity, My account and My connected clients; hide global people administration and instance settings. An empty assigned-service list explains how to contact an existing administrator without adding a request-access workflow. Unauthorized direct navigation shows a permission-safe explanation and return path without disclosing restricted object details.

## UX-IA02 — Services and object context

Use a searchable service list with status filtering including Archived. Show name/description, runtime lifecycle (Draft, Active, Disabled, Archived), separate unapplied-change state, access summary and configuration attention. Do not imply that an Active service's draft is live. A security exception stays visible on the relevant row/detail. Owners/Administrators get **Add service** and **Import configuration**; Members get connection guidance for eligible assigned services; Auditors inspect non-secret details.

Service detail uses **Overview**, **Configuration**, **Access**, **Activity** tabs. Overview summarizes effective destinations, authentication availability, policy, security exceptions and lifecycle. Configuration edits the draft, with applied revision/history accessible. Access shows current explicit assignments; changes are immediate confirmed actions. Activity opens the shared activity view scoped to this service. Preserve search/filter and return context when returning to Services.

Initial Add service follows the PRD's five steps: Details → Destination → Authentication → Access & policy → Review. Show progress, preserve non-secret entries on Back, and support saving incomplete drafts. An incomplete service cannot activate. Review names proposed grants and required credential availability; they are not historical grants that can later be replayed. Existing services use the grouped editor rather than forcing the setup wizard on every edit.

## UX-IA03 — Configuration coverage and disclosure

Keep ordinary fields visible and advanced capabilities one named disclosure away. A settings search matches field labels/help and opens the containing section; it searches non-secret labels, never credential values. Guided forms and advanced editor operate on the same draft without lossy conversions. Existing regex rules remain regexes unless the user deliberately replaces them. No service-specific templates or profile packs are introduced.

| Location | Required capability placement |
| --- | --- |
| Service Configuration → Details | Stable service identifier (read-only after creation), name, description, documentation links |
| Destinations | Multiple destination entries, base URLs, schemes and ports; exact host default; suffix/regex matching under Advanced; service-default TLS verification plus visible destination inheritance/overrides |
| Authentication | Multiple credential identities with availability/version/last-change metadata; explicit No downstream authentication choice; placement/name/prefix/suffix/header-ownership controls; separate write-only value creation/replacement/deletion |
| Request policy | Default allow/deny, ordered rules, explicit numeric priority, methods, host/path matching, reasons; exact/prefix/regex path choices; safe policy tester |
| Response protection | Effective Secretlint and sensitive-name settings, catalogs, extend/replace modes, rule options, custom patterns/exclusions and allow patterns; per-rule exceptions; binary controls |
| Configuration tools | Same-draft advanced editor, sanitized export, import validation and revision history; historic configuration opens as a fresh permitted draft |
| Settings → Response protection | Shared scanning defaults/catalogs and effective inheritance; roles follow the PRD configuration/scanning permissions, not an Owner-only navigation assumption |
| Settings → MCP authentication | Built-in OAuth clients/scopes/principal/token lifetimes; advanced external OAuth registrations and legacy bearer; distinct console security context; Owner writes only |
| Settings → Limits | Existing request/response byte limits, timeouts, concurrent work, references, denial records, authentication and scanner capacity; values with units, current consumption and capacity outcome; Owner writes only |
| Settings → Email | Optional SMTP, sender, encryption/credentials, test and delivery status; manual-link fallback; Owner writes only |
| Settings → Backups & restore | Encrypted backups, schedule/retention, job history/progress, download, restore preview and recovery; Owner only |
| Settings → Health & retention | Gateway/storage/audit/scanner/SMTP/backup health, audit retention and operational guidance; view/write authorization follows the PRD |

No duplicated competing settings: shared defaults belong in Settings and effective inherited summaries appear inside each service. Links take eligible actors to the defining setting. A read-only inherited value states its source. Exact technical field names remain available in advanced help/import errors to correlate with existing configuration.

## UX-IA04 — People, clients and evidence

People & Access exposes the fixed role label and a concise permission explanation; do not imply Owner/Administrator automatically executes services. Owner manages invitations, disable/recovery/roles, while Administrator can select existing eligible identities for service assignments without getting identity-administration powers. Clearly separate pending invitations, active users, disabled users and pending recovery. Keep disable/revoke reachable from person/client detail without navigating through configuration drafts.

My connected clients lists the user's grants and revocation action. ChatGPT and Codex connection instructions are distinct. Display copyable non-secret origin and complete MCP URL separately (for example https://mcp.example.org and https://mcp.example.org/mcp), network reachability guidance and authorization context. OAuth consent identifies client, requested scope and acting identity; it never implies that consent itself grants a service assignment. Auditors receive no execution connection action.

Activity provides time, actor, service, action, result and request-ID filters, readable event rows and sanitized details. Service Activity reuses these controls. Show request outcome, policy reason and admitted revision, including uncertain recorded outcomes. Explicitly distinguish local events from imported archive provenance and unavailable intervals. Export honors the visible authorized filter scope; Members have only own permitted reads, not global export. Saved request bodies, raw secrets and opaque references are never detail views.

Import is available from Services and Configuration tools. Show validation issues by field/source location, unknown fields, unresolved credentials and identity mappings. Permit correction in a draft; no silent dropping or inferred email-based grant. Import/existing environment precedence is explained at handover. History shows sanitized changes, actor and revision; **Use as draft** states that old access, lifecycle and credential values are not restored.
