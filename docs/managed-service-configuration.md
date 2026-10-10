# Managed service configuration

An enrolled Owner or Administrator can save service configuration as a draft, review its exact service scope and activate it without restarting. Saving incomplete work has no execution effect. Active services keep their applied state while a draft exists. Auditors can read configuration; roles never confer service execution access.

The management interface uses the protected console cookie with current role, Origin and CSRF checks. `service/save` takes a stable `id`, current configuration `base`, current draft `generation` and a `service` object. The service uses the existing gateway schema, except credentials contain only identity and placement metadata, with no source or secret property. Service values are separate encrypted write-only operations. Incomplete fields may be saved; complete normalization and credential availability are required for review and apply. Advanced baseline fields survive these operations.

`service/review` returns exact service/settings scope, current and proposed sanitized configuration, base revision, explicit initial grants, exceptions and reference disruption. `service/apply` accepts only that actor's current review and exact exception acknowledgments. It rechecks current role, draft generation, active configuration base, identities, assignments, lifecycle and credential versions. Changes are installed atomically after complete preparation. A mixed draft containing instance name requires Owner permission for the whole transaction. Failed preparation retains the applied state; stale work has a sanitized comparison and must reload/save/review before applying.

If the response is lost, inspect the current service and actor-scoped operation status before taking another action. A durable start without completion is uncertain. Do not automatically replay consequential commands. Managed restart loads encrypted committed state and rehydrates host regexes; old YAML cannot override it.

Administrators are trusted to configure destinations. Exact and pattern response scanning is best-effort defense and cannot guarantee against all reflections or invertible encodings. Review explicitly acknowledges cleartext HTTP, disabled TLS, broad destination matching, default allow and reduced scanning.

Use stand-in destinations such as `https://api.example.org`. No service-specific templates are provided.
