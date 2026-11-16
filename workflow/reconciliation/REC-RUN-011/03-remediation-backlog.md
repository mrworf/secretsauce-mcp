# Product Reconciliation Remediation Backlog

> Mode: CHANGE_PLAN
> Implementation authority: docs/web-console-prd.md and product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, named rules below
> Preservation baseline: implementation6810fe3 and approved UX6, except exact applied directives
> Canonical result: [reconciliation-result.yaml](reconciliation-result.yaml)
> Delivery planning ready: false

Independent settled items below are resolved; whole-scope readiness awaits bounded design resolution and definition revalidation. No proposed Limits/search design is implementation-ready.

### REC-RM-034: Concise service readiness and honest review entry

Priority: MEDIUM
Source findings: REC-042
Product Owner feedback: PO-FB-149, PO-FB-150, PO-FB-163, PO-FB-164, PO-FB-165, PO-FB-166, PO-FB-167, PO-FB-168, PO-FB-169, PO-FB-170
Authoritative basis: UX-IA02, UX-IA09; CONFIG-05; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Service rows retain lifecycle/draft distinctions with concise Needs configuration. Overview identifies actual blockers and links to correction; ready Review draft changes opens real review, unavailable while known issues remain. Top-align list controls.
Current behavior: Overview labels and entry points imply review readiness despite missing dependencies; list rows repeat missing-value or mapping detail.
Required behavior: Service rows retain lifecycle/draft distinctions with concise Needs configuration. Overview identifies actual blockers and links to correction; ready Review draft changes opens real review, unavailable while known issues remain. Top-align list controls.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleServicePage.ts; src/consoleServicePage.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Service rows retain lifecycle/draft distinctions with concise Needs configuration. Overview identifies actual blockers and links to correction; ready Review draft changes opens real review, unavailable while known issues remain. Top-align list controls.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-035: Precise local validation and recovery

Priority: HIGH
Source findings: REC-043
Product Owner feedback: PO-FB-151, PO-FB-152, PO-FB-155, PO-FB-156, PO-FB-157, PO-FB-161
Authoritative basis: UX-IN01, UX-IN15; UX-03; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Identify actual invalid or missing fields, their section and safe recovery action. Incomplete imported and new services receive the same precise error handling; resolved issues disappear, safe input persists, and mere credential presence never proves downstream validity.
Current behavior: Observed missing-value review lists four potentially faulty sections and neutral Authentication status rather than the actual named missing credential.
Required behavior: Identify actual invalid or missing fields, their section and safe recovery action. Incomplete imported and new services receive the same precise error handling; resolved issues disappear, safe input persists, and mere credential presence never proves downstream validity.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleServices.ts; src/consoleServicePage.ts; src/consoleFriendlyPage.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Identify actual invalid or missing fields, their section and safe recovery action. Incomplete imported and new services receive the same precise error handling; resolved issues disappear, safe input persists, and mere credential presence never proves downstream validity.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-036: Affected-section attention cue

Priority: MEDIUM
Source findings: REC-044
Product Owner feedback: PO-FB-153, PO-FB-154
Authoritative basis: UX-03; UX-IN15; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Yellow circled exclamation with text/accessibility equivalent appears only beside affected section names; local affected controls are identifiable without color alone.
Current behavior: Current section labels lack the owner-selected affected-section indicator.
Required behavior: Yellow circled exclamation with text/accessibility equivalent appears only beside affected section names; local affected controls are identifiable without color alone.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleServicePage.ts; src/consoleFriendlyPage.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Yellow circled exclamation with text/accessibility equivalent appears only beside affected section names; local affected controls are identifiable without color alone.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-037: Four-section guided progression

Priority: MEDIUM
Source findings: REC-045
Product Owner feedback: PO-FB-158, PO-FB-159, PO-FB-160, PO-FB-162
Authoritative basis: CONFIG-01; UX-IA02, UX-IA09, UX-IN11, UX-IN15; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Create and edit share Details, Destination, Authentication, Access & policy. First three Continue; last Review & apply opens actual review. Keep direct navigation, safe history guards, existing real review and incomplete draft saving.
Current behavior: Five-step setup and edit Review changes placeholder follow stale UX6; edited services offer premature review instead of sequential progression.
Required behavior: Create and edit share Details, Destination, Authentication, Access & policy. First three Continue; last Review & apply opens actual review. Keep direct navigation, safe history guards, existing real review and incomplete draft saving.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleServicePage.ts; src/consoleFriendlyPage.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Create and edit share Details, Destination, Authentication, Access & policy. First three Continue; last Review & apply opens actual review. Keep direct navigation, safe history guards, existing real review and incomplete draft saving.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-038: Portable sanitized YAML download

Priority: MEDIUM
Source findings: REC-046
Product Owner feedback: PO-FB-172, PO-FB-173, PO-FB-174
Authoritative basis: MIGRATE-03; UX-IA03, UX-IA05; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Download gateway YAML accepted by existing importer on another instance, with existing optional scanner catalogs downloadable separately. No live authority/secret transfer, no activation, no new bundle schema.
Current behavior: Exporter already emits gateway and scanner catalog YAML strings, but UI renders them inline.
Required behavior: Download gateway YAML accepted by existing importer on another instance, with existing optional scanner catalogs downloadable separately. No live authority/secret transfer, no activation, no new bundle schema.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleMigration.ts exportConfiguration/importConfiguration; src/consoleServicePage.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Download gateway YAML accepted by existing importer on another instance, with existing optional scanner catalogs downloadable separately. No live authority/secret transfer, no activation, no new bundle schema.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-039: Temporarily hidden history UI

Priority: MEDIUM
Source findings: REC-047
Product Owner feedback: PO-FB-171, PO-FB-175
Authoritative basis: CONFIG-04; UX-IA02, UX-IA03, UX-IA05; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Hide history/reuse console UI while retaining latest50 history and current permission/dependency constrained revision reuse backend. Do not purge revisions or remove APIs.
Current behavior: History/reuse UI remains visible, including empty state.
Required behavior: Hide history/reuse console UI while retaining latest50 history and current permission/dependency constrained revision reuse backend. Do not purge revisions or remove APIs.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleServicePage.ts; src/consoleServices.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Hide history/reuse console UI while retaining latest50 history and current permission/dependency constrained revision reuse backend. Do not purge revisions or remove APIs.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-040: Visible Settings review effects and comparable values

Priority: MEDIUM
Source findings: REC-048
Product Owner feedback: PO-FB-176, PO-FB-177, PO-FB-178, PO-FB-179
Authoritative basis: UX-IN02, UX-IN18; UX-02; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Show Settings security/operational effects immediately. Preserve full-scope atomic apply and existing acknowledgments; shared exact-value comparison must not invent different semantics or normalize literals.
Current behavior: Settings effects are folded; reported comparison formats same values differently. Service review already has visible exceptions, but service-specific approval pattern does not automatically govern Settings.
Required behavior: Show Settings security/operational effects immediately. Preserve full-scope atomic apply and existing acknowledgments; shared exact-value comparison must not invent different semantics or normalize literals.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleSettingsPage.ts renderSettingsReview; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Show Settings security/operational effects immediately. Preserve full-scope atomic apply and existing acknowledgments; shared exact-value comparison must not invent different semantics or normalize literals.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-043: SMTP credential task presentation

Priority: MEDIUM
Source findings: REC-051
Product Owner feedback: PO-FB-185, PO-FB-186, PO-FB-187, PO-FB-188, PO-FB-189, PO-FB-190, PO-FB-191
Authoritative basis: IDENT-04, CONFIG-03; UX-IN09, UX-IN13, UX-EX03; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Visible current username/credential availability. Set/Replace opens username-prefilled/password-blank Save/Cancel dialog staging normal Settings review/apply; Clear is independent existing immediate deletion, blocked while enabled delivery depends on it. Yellow Not configured text state. Research informs presentation, never overrides timing.
Current behavior: Inline replacement password and folded authentication contrast with focused service secret dialogs; owner reports green Not configured.
Required behavior: Visible current username/credential availability. Set/Replace opens username-prefilled/password-blank Save/Cancel dialog staging normal Settings review/apply; Clear is independent existing immediate deletion, blocked while enabled delivery depends on it. Yellow Not configured text state. Research informs presentation, never overrides timing.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleSettingsPage.ts; src/consoleNotifications.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Visible current username/credential availability. Set/Replace opens username-prefilled/password-blank Save/Cancel dialog staging normal Settings review/apply; Clear is independent existing immediate deletion, blocked while enabled delivery depends on it. Yellow Not configured text state. Research informs presentation, never overrides timing.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-044: Safe backup schedule and clear retention units

Priority: MEDIUM
Source findings: REC-052
Product Owner feedback: PO-FB-192, PO-FB-193, PO-FB-194, PO-FB-195
Authoritative basis: UX-02, UX-03; UX-IN18; BACKUP-01; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Only valid UTC hours00–23 can be chosen; invalid legacy/external data remains explicit error with backend checks retained. Label retention in days. Slider suggestion is not a requirement.
Current behavior: Hour input accepts24 until validation; retention label obscures unit.
Required behavior: Only valid UTC hours00–23 can be chosen; invalid legacy/external data remains explicit error with backend checks retained. Label retention in days. Slider suggestion is not a requirement.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleSettingsPage.ts; src/consoleBackups.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Only valid UTC hours00–23 can be chosen; invalid legacy/external data remains explicit error with backend checks retained. Label retention in days. Slider suggestion is not a requirement.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.


### REC-RM-045: Visible organized health and retention

Priority: MEDIUM
Source findings: REC-053
Product Owner feedback: PO-FB-196, PO-FB-197, PO-FB-198
Authoritative basis: UX-IA06, UX-IN18; UX-02; current canonical PRD and UX corrections applied after confirmed directives.
Desired outcome: Show organized health details and audit retention directly with diagnostic context, current role-limited data and truthful loading/failure states; do not turn bounded public health into detailed diagnostics.
Current behavior: Health details and audit retention remain disclosed rather than immediately available.
Required behavior: Show organized health details and audit retention directly with diagnostic context, current role-limited data and truthful loading/failure states; do not turn bounded public health into detailed diagnostics.
Affected users/roles: authorized Owner/Administrator service editors; Owner-only operational settings; Auditor equivalent permitted read-only presentation. Members gain no new administrative surface.
Affected interfaces and compatibility: src/consoleSettingsPage.ts; src/consolePage.ts; existing importer/API/schema and exact supported values remain.
UX constraints: approved appearance and UX-V05/UX-C42; no generic JSON wall, overlapping controls, hidden essential decision information, or secret reveal.
Architecture/security constraints: STATE-01/03/09, SECRES-07/08 and UX-EX03; no new permissions, autoactivation or weakened audit.

Acceptance criteria:
1. Show organized health details and audit retention directly with diagnostic context, current role-limited data and truthful loading/failure states; do not turn bounded public health into detailed diagnostics.
2. Invalid/missing/dependency or permission errors name the actual safe cause and actionable destination; no unauthorized object disclosure.
3. Preserve exact imported IDs, regexes, typed options, order, active/draft distinctions and valid existing settings.
4. Cancel/navigation preserves authorized non-secret work; stale dependency and unknown outcomes never report success or replay a secret.
5. Record matching actual browser states at desktop/narrow widths and text enlargement; verify keyboard/focus/labels and compare against approved visual references plus this bounded delta.

Dependencies: applied canonical authority and required definition revalidation; no dependency on unresolved REC-050 navigation proposal.
Explicit exclusions: protocol or permission changes, new templates, blanket Settings redesign, live downstream credential testing, new export archive format.
Required implementation validation: focused positive/negative backend and browser cases, complete regression checks appropriate to change, visual evidence; imported identity blockers, SMTP-not-configured and accessibility states absent from initial audit must be explicitly covered where touched.
