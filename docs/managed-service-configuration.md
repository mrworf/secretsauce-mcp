# Managed service configuration

An enrolled Owner or Administrator can save service configuration as a draft, review its exact service scope and activate it without restarting. Saving incomplete work has no execution effect. Active services keep their applied state while a draft exists. Auditors can read configuration; roles never confer service execution access.

The management interface uses the protected console cookie with current role, Origin and CSRF checks. `service/save` takes a stable `id`, current configuration `base`, current draft `generation` and a `service` object. The service uses the existing gateway schema, except credentials contain only identity and placement metadata, with no source or secret property. Service values are separate encrypted write-only operations. Incomplete fields may be saved; complete normalization and credential availability are required for review and apply. Advanced baseline fields survive these operations.

`service/review` returns exact service/settings scope, current and proposed sanitized configuration, base revision, explicit initial grants, exceptions and reference disruption. `service/apply` accepts only that actor's current review and exact exception acknowledgments. It rechecks current role, draft generation, active configuration base, identities, assignments, lifecycle and credential versions. Changes are installed atomically after complete preparation. A mixed draft containing instance name requires Owner permission for the whole transaction. Failed preparation retains the applied state; stale work has a sanitized comparison and must reload/save/review before applying.

If the response is lost, inspect the current service and actor-scoped operation status before taking another action. A durable start without completion is uncertain. Do not automatically replay consequential commands. Managed restart loads encrypted committed state and rehydrates host regexes; old YAML cannot override it.

Administrators are trusted to configure destinations. Exact and pattern response scanning is best-effort defense and cannot guarantee against all reflections or invertible encodings. Review explicitly acknowledges cleartext HTTP, disabled TLS, broad destination matching, default allow and reduced scanning.

Use stand-in destinations such as `https://api.example.org`. No service-specific templates are provided.

Credential value create/replace/delete uses an explicit confirmation and changes value availability/version immediately. No value returns in a response; create or rotation advances version/last-change metadata and invalidates affected references. Remove placement from both applied configuration and saved draft before deleting a dependent value. Discarding a draft never undoes a value operation.

Access grants/removals on an existing service act immediately and require explicit eligible enrolled identities for new grants. Existing external subjects remain compatible; they never authorize console management. Disable/archive immediately remove the service from admission and revoke references. Unarchive returns Disabled, and only a fresh configuration/dependency review can enable it. Already-dispatched work may complete; its captured credential response protection survives rotation. Any new placeholders from an old revoked completion remain unregistered and unusable. The existing reference broker and capacity counters survive publication.

Immediate action evidence records the acting identity, target service, affected credential identity/version or assigned identity, admitted revision and outcome without secret bytes. Existing identifiers remain supported, including namespace-style identifiers; new identifiers use a simpler bounded format. Dictionary lookup never treats an inherited property as a configured object.

The console opens a searchable Services list with lifecycle filtering, description/access summaries, separate applied/draft state and visible exceptions. Add service follows Details → Destination → Authentication → Access & policy → Review. Existing services open grouped sections directly and use the same draft/review transaction. Overview, Configuration, Access and Activity tabs keep immediate commands separate from drafts. Destination sections support multiple entries, schemes/ports, exact/suffix/regex matchers and visible inherited TLS or overrides. Authentication supports multiple placements and separate write-only value actions. Basic policy rules use literal path prefixes converted to the backend's existing regex semantics, with the usual highest-priority/deny-tie ordering.

Unsaved navigation offers Stay, Save draft or Discard. Confirmations identify the target and immediate consequences; Cancel restores focus. Stale work retains permitted non-secret proposed configuration, displays Current and Proposed and offers an explicit reload/review path. Narrow views retain My account, logout, state and consequential controls.

Reproducible browser verification uses the declared `@playwright/test` Chromium dependency: `PLAYWRIGHT_BROWSERS_PATH=/tmp/secretsauce-m10-browsers node scripts/verify-console-services-browser.mjs` after `npm run build` in this sandbox. Other installations can use their declared Playwright browser path. The harness uses actual local HTTPS, synthetic `example.org` certificates, keyboard completion and 320px screenshots without persisting browser secrets.

### Focused service configuration

Overview groups the configuration currently in use into connections, authentication, request policy, and access/exceptions. A separate notice identifies a saved draft; a service without current configuration cannot run yet.

Configuration opens populated Details, Destinations, Authentication, Access & policy, Secret detection, and Review changes sections. Select one section at a time. Auditor views use the same grouping without mutation actions. Guided and Advanced are two representations of the entire service draft; Advanced retains exact imported fields and patterns. Invalid JSON stays visible for correction and cannot overwrite the guided draft or be saved.

Creation step links can be visited directly. Switching sections retains safe edits without saving or applying. Save draft stores non-secret work for later; Review & apply validates the entire service and requires explicit activation. Incomplete configuration can be saved but cannot activate. Leaving unsaved work offers Stay, Save draft, or Discard; immediate credential operations are not undone by discard.
