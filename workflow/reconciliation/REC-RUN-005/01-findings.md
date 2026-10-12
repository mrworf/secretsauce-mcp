# Reconciliation findings

Current inspection baseline `0fc959f5f13b5fb4751788910fdb4c48fcdf442c` plus exact source revisions in the canonical result. REC004 is immutable historical evidence; this run adopts resolved specialist semantics and UX-VIS-F001. Original and normalized feedback, classifications, relationships and producer provenance are preserved exactly in the canonical YAML.

| Finding | Classification | Resolution | Decision | Remediation |
|---|---|---|---|---|
| REC-008 | UX_SPEC_PROBLEM | Unresolved | REC-DEC-006 | None eligible |
| REC-009 | IMPLEMENTATION_DEFECT | Resolved | None | REC-RM-008 |
| REC-010 | UX_SPEC_GAP | Unresolved | REC-DEC-006 | None eligible |
| REC-011 | UX_SPEC_GAP | Unresolved | REC-DEC-006 | None eligible |
| REC-012 | PRODUCT_SPEC_PROBLEM | Resolved | None | REC-RM-009 |
| REC-013 | PRODUCT_SPEC_GAP | Resolved | None | REC-RM-010 |
| REC-014 | PRODUCT_SPEC_GAP | Resolved | None | REC-RM-011 |
| REC-015 | IMPLEMENTATION_DEFECT | Resolved | None | REC-RM-007 |
| REC-016 | UX_SPEC_PROBLEM | Unresolved | REC-DEC-006 | None eligible |
| REC-017 | EXPECTED_BEHAVIOR | Resolved | None | None eligible |
| REC-018 | EXPECTED_BEHAVIOR | Resolved | None | None eligible |

### REC-008: Comprehensible language and desktop space

Classification: UX_SPEC_PROBLEM
Severity: MEDIUM
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: DOCUMENTED: UX-IA05 explicitly names Response protection. REPOSITORY_EVIDENCED: src/consoleSettingsPage.ts uses that label; src/consolePage.ts caps main at 950px. REPORTED: novice comprehension and underused width.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-015, PO-FB-016, PO-FB-017, PO-FB-029.

Current observed behavior: Current vocabulary is canonical; width observation is advisory, not independently a defect. Existing plain-language principle does not establish replacement vocabulary or layout.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: UX-02; UX-IA05; UX-V01/V04; artifacts product/ux/01-information-architecture.md, product/ux/04-visual-system.md, product/ux/03-responsive-and-platform.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: UX_SPEC_PROBLEM; Current vocabulary is canonical; width observation is advisory, not independently a defect. Existing plain-language principle does not establish replacement vocabulary or layout.

Authoritative desired state: Resolve clear purpose-based terms and responsive use of available space within existing navigation and safety scope. Specific terminology/layout remains non-authoritative pending design.

Authoritative artifact requiring change: product/ux/01-information-architecture.md, product/ux/04-visual-system.md, product/ux/03-responsive-and-platform.md.
Changed automatically: No
Decision required: REC-DEC-006
Implementation remediation required: Blocked

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/04-visual-system.md, product/ux/03-responsive-and-platform.md

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

### REC-009: Overlapping service wizard progress

Classification: IMPLEMENTATION_DEFECT
Severity: MEDIUM
Confidence: High
Reproduction: REPRODUCED

Evidence: UX-VIS-F001 reproduces numeric progress markers over neighboring labels in Details, Destination and Authentication at 1280×900 and 320×900. Six captures and geometry under evidence/ux-acceptance/secretsauce-mcp/feedback-002-service-overlap/.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-018.
Current behavior: REC004 source findings remain the implementation baseline; no product code changed.
Relevant implementation: src/consoleServicePage.ts and consolePage.ts (009); consolePeople.ts/consoleStore.ts (012/013); consoleNotifications.ts/consolePeoplePage.ts (014).
Relevant UX rule: UX-R01 for 009; UX-IA04/UX-IN03/08 for account behavior; UX-IN09 for SMTP. UX presentation amendment remains pending and cannot override resolved security/state semantics.
Relevant user journey: J-OWNER-CONFIG / J-ADMIN-CONFIG (009); J-OWNER-PEOPLE and new Administrator editing flow (012/013); J-OWNER-SETTINGS (014).
Relevant product requirement: see corresponding REC-CHANGE entry and PRD adopted requirements.
Architecture/security constraint: SECRES-06/07 and STATE-07/08; retain existing reset, atomic-state, audit and credential lifecycle requirements.
Root source of inconsistency: IMPLEMENTATION_DEFECT; reproduced overlap violates existing layout authority, while the other findings required adoption of confirmed direction and bounded specialist semantics rather than preserving stale restrictions.
Authoritative desired state: Existing UX-R01 requires readable unclipped reflow. Preserve all step labels and current position, separating markers/text at supported widths. No authority change.
Authoritative artifact requiring change: None.
Changed automatically: No
Decision required: No for this bounded behavior; UX-DESIGN-003 remains separate pending presentation approval.
Implementation remediation required: REC-RM-008
Affected definition domains: all false.
Potentially stale artifacts: None for overlap.
Implementation validation: REC-RM-008 criteria; positive, negative, concurrency/restart and compatibility as applicable. The source contracts are exact-hash root-owned pending changes; this run commits only its own PRD adoption, not those source files.

### REC-010: Required indicators and concise field help

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED: src/consolePage.ts field() sets required=true but appends an unmarked label. DOCUMENTED: UX-IN01 already requires concise purpose/help text; mandatory visual marker pattern is not explicit.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-019, PO-FB-020, PO-FB-021, PO-FB-022.

Current observed behavior: Native validation exists without a uniform visible mandatory-field marker; red asterisk and under-label hints are suggestions.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: UX-04; UX-IN01; UX-A01; artifacts product/ux/02-interaction-patterns.md, product/ux/05-accessibility.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: UX_SPEC_GAP; Native validation exists without a uniform visible mandatory-field marker; red asterisk and under-label hints are suggestions.

Authoritative desired state: Visually identify required fields consistently and accessibly; preserve conditional requirements and existing concise help rule. Marker convention belongs in design, not implicit adoption of red-only cues.

Authoritative artifact requiring change: product/ux/02-interaction-patterns.md, product/ux/05-accessibility.md.
Changed automatically: No
Decision required: REC-DEC-006
Implementation remediation required: Blocked

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: product/ux/02-interaction-patterns.md, product/ux/05-accessibility.md

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

### REC-011: People list and selected account detail

Classification: UX_SPEC_GAP
Severity: MEDIUM
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED: src/consolePeoplePage.ts people() renders each user as a card with embedded actions. DOCUMENTED: UX-IA04 references person detail but does not specify a one-row list and selection model.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-023, PO-FB-024.

Current observed behavior: Current cards do not provide the newly requested one-row-per-user entry and selected account experience.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: UX-IA04; AUTHZ-02; artifacts product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: UX_SPEC_GAP; Current cards do not provide the newly requested one-row-per-user entry and selected account experience.

Authoritative desired state: One row per user opens that user’s account information. Define keyboard/narrow-screen behavior, role-aware controls and navigation without inventing new permission scope.

Authoritative artifact requiring change: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md.
Changed automatically: No
Decision required: REC-DEC-006
Implementation remediation required: Blocked

Affected definition domains: {'product': False, 'user_journeys': True, 'ux': True, 'architecture': False, 'security': False}
Potentially stale artifacts: product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

### REC-012: Administrator account editing

Classification: PRODUCT_SPEC_PROBLEM
Severity: HIGH
Confidence: High
Reproduction: NOT_ATTEMPTED

Evidence: SECRES-06 resolves hierarchy, exact fields, current authorization, recent authentication, contact verification, generation revocation and notices. PRD role matrix and IDENT-02B now adopt it.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-025.
Current behavior: REC004 source findings remain the implementation baseline; no product code changed.
Relevant implementation: src/consoleServicePage.ts and consolePage.ts (009); consolePeople.ts/consoleStore.ts (012/013); consoleNotifications.ts/consolePeoplePage.ts (014).
Relevant UX rule: UX-R01 for 009; UX-IA04/UX-IN03/08 for account behavior; UX-IN09 for SMTP. UX presentation amendment remains pending and cannot override resolved security/state semantics.
Relevant user journey: J-OWNER-CONFIG / J-ADMIN-CONFIG (009); J-OWNER-PEOPLE and new Administrator editing flow (012/013); J-OWNER-SETTINGS (014).
Relevant product requirement: see corresponding REC-CHANGE entry and PRD adopted requirements.
Architecture/security constraint: SECRES-06/07 and STATE-07/08; retain existing reset, atomic-state, audit and credential lifecycle requirements.
Root source of inconsistency: PRODUCT_SPEC_PROBLEM; reproduced overlap violates existing layout authority, while the other findings required adoption of confirmed direction and bounded specialist semantics rather than preserving stale restrictions.
Authoritative desired state: Implement the precise SECRES-06 and IDENT-02B rules; do not add invitations/lifecycle/Owner powers to Administrator.
Authoritative artifact requiring change: docs/web-console-prd.md, applied in this transaction.
Changed automatically: Yes, APPLIED_AFTER_DECISION
Decision required: No for this bounded behavior; UX-DESIGN-003 remains separate pending presentation approval.
Implementation remediation required: REC-RM-009
Affected definition domains: product, journeys, UX, architecture, security require revalidation after adoption.
Potentially stale artifacts: docs/web-console-prd-coverage.md; docs/web-console-prd-user-journey-audit.md; product/ux/01-information-architecture.md; product/ux/02-interaction-patterns.md; product/architecture/web-console-architecture-review.md; product/security/web-console-security-review.md.
Implementation validation: REC-RM-009 criteria; positive, negative, concurrency/restart and compatibility as applicable. The source contracts are exact-hash root-owned pending changes; this run commits only its own PRD adoption, not those source files.

### REC-013: Account timestamps

Classification: PRODUCT_SPEC_GAP
Severity: MEDIUM
Confidence: High
Reproduction: NOT_ATTEMPTED

Evidence: STATE-07 resolves durable creation and last full console sign-in, Never/Unknown/Not applicable, recovery-point history and preserved metadata. PRD IDENT-02A and BACKUP-01/05 adopt it.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-026, PO-FB-027.
Current behavior: REC004 source findings remain the implementation baseline; no product code changed.
Relevant implementation: src/consoleServicePage.ts and consolePage.ts (009); consolePeople.ts/consoleStore.ts (012/013); consoleNotifications.ts/consolePeoplePage.ts (014).
Relevant UX rule: UX-R01 for 009; UX-IA04/UX-IN03/08 for account behavior; UX-IN09 for SMTP. UX presentation amendment remains pending and cannot override resolved security/state semantics.
Relevant user journey: J-OWNER-CONFIG / J-ADMIN-CONFIG (009); J-OWNER-PEOPLE and new Administrator editing flow (012/013); J-OWNER-SETTINGS (014).
Relevant product requirement: see corresponding REC-CHANGE entry and PRD adopted requirements.
Architecture/security constraint: SECRES-06/07 and STATE-07/08; retain existing reset, atomic-state, audit and credential lifecycle requirements.
Root source of inconsistency: PRODUCT_SPEC_GAP; reproduced overlap violates existing layout authority, while the other findings required adoption of confirmed direction and bounded specialist semantics rather than preserving stale restrictions.
Authoritative desired state: Read-only creation and Last console sign-in with exact qualifying events and truthful legacy/restored states under STATE-07.
Authoritative artifact requiring change: docs/web-console-prd.md, applied in this transaction.
Changed automatically: Yes, APPLIED_AFTER_DECISION
Decision required: No for this bounded behavior; UX-DESIGN-003 remains separate pending presentation approval.
Implementation remediation required: REC-RM-010
Affected definition domains: product, journeys, UX, architecture, security require revalidation after adoption.
Potentially stale artifacts: docs/web-console-prd-coverage.md; docs/web-console-prd-user-journey-audit.md; product/ux/01-information-architecture.md; product/ux/02-interaction-patterns.md; product/architecture/web-console-architecture-review.md; product/security/web-console-security-review.md.
Implementation validation: REC-RM-010 criteria; positive, negative, concurrency/restart and compatibility as applicable. The source contracts are exact-hash root-owned pending changes; this run commits only its own PRD adoption, not those source files.

### REC-014: Explicit SMTP transport choice

Classification: PRODUCT_SPEC_GAP
Severity: HIGH
Confidence: High
Reproduction: NOT_ATTEMPTED

Evidence: SECRES-07 and STATE-08 agree on implicit TLS/default or deliberate None; optional auth independent; no downgrade, recent Owner acknowledgment and fresh restored review. PRD IDENT-04/SEC-01/BACKUP-05 adopt them.
Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-030, PO-FB-031.
Current behavior: REC004 source findings remain the implementation baseline; no product code changed.
Relevant implementation: src/consoleServicePage.ts and consolePage.ts (009); consolePeople.ts/consoleStore.ts (012/013); consoleNotifications.ts/consolePeoplePage.ts (014).
Relevant UX rule: UX-R01 for 009; UX-IA04/UX-IN03/08 for account behavior; UX-IN09 for SMTP. UX presentation amendment remains pending and cannot override resolved security/state semantics.
Relevant user journey: J-OWNER-CONFIG / J-ADMIN-CONFIG (009); J-OWNER-PEOPLE and new Administrator editing flow (012/013); J-OWNER-SETTINGS (014).
Relevant product requirement: see corresponding REC-CHANGE entry and PRD adopted requirements.
Architecture/security constraint: SECRES-06/07 and STATE-07/08; retain existing reset, atomic-state, audit and credential lifecycle requirements.
Root source of inconsistency: PRODUCT_SPEC_GAP; reproduced overlap violates existing layout authority, while the other findings required adoption of confirmed direction and bounded specialist semantics rather than preserving stale restrictions.
Authoritative desired state: Implement exact supported TLS/None modes, default/migration, acknowledgment, version fencing, testing/admission and restore rules; preserve write-only encrypted credentials.
Authoritative artifact requiring change: docs/web-console-prd.md, applied in this transaction.
Changed automatically: Yes, APPLIED_AFTER_DECISION
Decision required: No for this bounded behavior; UX-DESIGN-003 remains separate pending presentation approval.
Implementation remediation required: REC-RM-011
Affected definition domains: product, journeys, UX, architecture, security require revalidation after adoption.
Potentially stale artifacts: docs/web-console-prd-coverage.md; docs/web-console-prd-user-journey-audit.md; product/ux/01-information-architecture.md; product/ux/02-interaction-patterns.md; product/architecture/web-console-architecture-review.md; product/security/web-console-security-review.md.
Implementation validation: REC-RM-011 criteria; positive, negative, concurrency/restart and compatibility as applicable. The source contracts are exact-hash root-owned pending changes; this run commits only its own PRD adoption, not those source files.

### REC-015: Unconfigured SMTP renders undefined

Classification: IMPLEMENTATION_DEFECT
Severity: MEDIUM
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED: consolePeoplePage.ts emailSettings() passes n.applied to readableValues even when absent; consoleNotifications.ts safe(undefined) returns undefined; consoleFriendlyPage.ts readableValues converts it with String(value).

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-032.

Current observed behavior: An absent applied SMTP object reaches a renderer that produces “Applied email settings: undefined”. Source path established; not browser reproduced.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: UX-02/03; UX-IN05; UX-IA06; artifacts product/ux/02-interaction-patterns.md, product/ux/01-information-architecture.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: IMPLEMENTATION_DEFECT; An absent applied SMTP object reaches a renderer that produces “Applied email settings: undefined”. Source path established; not browser reproduced.

Authoritative desired state: Show a meaningful unconfigured/empty state instead of undefined; populated non-secret fields retain current values and saved secrets stay write-only.

Authoritative artifact requiring change: None established.
Changed automatically: No
Decision required: No
Implementation remediation required: REC-RM-007

Affected definition domains: {'product': False, 'user_journeys': False, 'ux': False, 'architecture': False, 'security': False}
Potentially stale artifacts: None

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

### REC-016: Settings state and save path are hard to understand

Classification: UX_SPEC_PROBLEM
Severity: MEDIUM
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: DOCUMENTED: current UX explicitly prescribes applied summaries plus editing and saved-draft review. REPOSITORY_EVIDENCED: diagnostic summary reads effective.loggingLevel, editor reads draft.settings or effective; backup form reads draft.settings or settings. REPORTED: backup changes appear unsaved and diagnostics appear static.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-033, PO-FB-035, PO-FB-036, PO-FB-037, PO-FB-038, PO-FB-039, PO-FB-041.

Current observed behavior: Different applied/draft values may be intentional. No persistence failure or hard-coded diagnostic value is established. Current interaction contract requires reconsideration for understandable current/proposed state and fewer unnecessary steps.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: CONFIG-03; UX-03; UX-IA05/06; UX-IN01/02; artifacts docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/architecture/web-console-state-contract.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: UX_SPEC_PROBLEM; Different applied/draft values may be intentional. No persistence failure or hard-coded diagnostic value is established. Current interaction contract requires reconsideration for understandable current/proposed state and fewer unnecessary steps.

Authoritative desired state: Resolve a consistent current-value editing and save/review experience, truthful success feedback and pending-change distinction. Preserve atomic reviewed activation and unrelated drafts unless a separate authoritative change explicitly settles otherwise.

Authoritative artifact requiring change: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/architecture/web-console-state-contract.md.
Changed automatically: No
Decision required: REC-DEC-006
Implementation remediation required: Blocked

Affected definition domains: {'product': True, 'user_journeys': True, 'ux': True, 'architecture': True, 'security': 'unknown'}
Potentially stale artifacts: docs/web-console-prd.md, product/ux/01-information-architecture.md, product/ux/02-interaction-patterns.md, product/architecture/web-console-state-contract.md

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

### REC-017: Use established settings and account patterns

Classification: EXPECTED_BEHAVIOR
Severity: MEDIUM
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: DOCUMENTED evidence: supporting note cites Carbon forms, GOV.UK hints, Auth0 user profiles, PatternFly primary-detail and Atlassian language. These are inspiration, not permission or save semantics.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-028, PO-FB-040.

Current observed behavior: Requested research was completed in debrief and is available for design synthesis.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: Design research direction; artifacts workflow/feedback/PO-FEEDBACK-2026-10-11-002/research.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: EXPECTED_BEHAVIOR; Requested research was completed in debrief and is available for design synthesis.

Authoritative desired state: Use cited research as input; no universal mandate for autosave or a specific drawer. Research request itself requires no implementation.

Authoritative artifact requiring change: None established.
Changed automatically: No
Decision required: No
Implementation remediation required: No

Affected definition domains: {'product': False, 'user_journeys': False, 'ux': False, 'architecture': False, 'security': False}
Potentially stale artifacts: None

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

### REC-018: SMTP saved password stays write-only

Classification: EXPECTED_BEHAVIOR
Severity: MEDIUM
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED: consoleNotifications.ts safe() omits password; emailSettings() creates blank password input and clears it after save. DOCUMENTED: UX-IN01 forbids repopulating credentials.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-034.

Current observed behavior: Saved password is not returned/prefilled in the inspected path.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: IDENT-04; UX-IN01; STATE-03; artifacts docs/web-console-prd.md, product/ux/02-interaction-patterns.md, product/architecture/web-console-state-contract.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: EXPECTED_BEHAVIOR; Saved password is not returned/prefilled in the inspected path.

Authoritative desired state: Preserve blank replacement input and credential-presence metadata, never reveal saved secret while simplifying other fields.

Authoritative artifact requiring change: None established.
Changed automatically: No
Decision required: No
Implementation remediation required: No

Affected definition domains: {'product': False, 'user_journeys': False, 'ux': False, 'architecture': False, 'security': False}
Potentially stale artifacts: None

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.
