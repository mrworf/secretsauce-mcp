# Reconciliation findings

Inspected source revision `532b2dd8c4631dccd9463194d3daa36d12722732`; runtime not exercised. Original and normalized feedback, classifications, relationships and producer provenance are preserved exactly in the canonical YAML.

| Finding | Title | Classification | Severity | Reproduction | Confidence | Decision | Implementation | Definition revalidation |
|---|---|---|---|---|---|---|---|---|
| REC-008 | Comprehensible language and desktop space | UX_SPEC_PROBLEM | MEDIUM | NOT_ATTEMPTED | High for source; reported experience unverified | REC-DEC-006 | Blocked | True |
| REC-010 | Required indicators and concise field help | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High for source; reported experience unverified | REC-DEC-006 | Blocked | True |
| REC-011 | People list and selected account detail | UX_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High for source; reported experience unverified | REC-DEC-006 | Blocked | True |
| REC-012 | Administrator account property and role management | PRODUCT_SPEC_PROBLEM | HIGH | NOT_ATTEMPTED | High for source; reported experience unverified | REC-DEC-004 | Blocked | True |
| REC-013 | Creation date and last-login metadata | PRODUCT_SPEC_GAP | MEDIUM | NOT_ATTEMPTED | High for source; reported experience unverified | REC-DEC-007 | Blocked | True |
| REC-014 | Explicit unencrypted SMTP support | PRODUCT_SPEC_GAP | HIGH | NOT_ATTEMPTED | High for source; reported experience unverified | REC-DEC-005 | Blocked | True |
| REC-015 | Unconfigured SMTP renders undefined | IMPLEMENTATION_DEFECT | MEDIUM | NOT_ATTEMPTED | High for source; reported experience unverified | None | REC-RM-007 | False |
| REC-016 | Settings state and save path are hard to understand | UX_SPEC_PROBLEM | MEDIUM | NOT_ATTEMPTED | High for source; reported experience unverified | REC-DEC-006 | Blocked | True |
| REC-017 | Use established settings and account patterns | EXPECTED_BEHAVIOR | MEDIUM | NOT_ATTEMPTED | High for source; reported experience unverified | None | None | False |
| REC-018 | SMTP saved password stays write-only | EXPECTED_BEHAVIOR | MEDIUM | NOT_ATTEMPTED | High for source; reported experience unverified | None | None | False |

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

### REC-009: Overlapping items during service creation

Classification: INSUFFICIENT_EVIDENCE
Severity: MEDIUM
Confidence: Low
Reproduction: REPORTED_ONLY

Evidence: REPORTED: owner saw overlapping list entries. No screenshot, exact list/step/viewport or runtime reproduction supplied. Source-only inspection cannot identify the offending layout.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-018.

Current observed behavior: Reported overlap is preserved; delivered M21 reflow evidence does not disprove this state.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: UX-04; UX-R01/02; artifacts product/ux/03-responsive-and-platform.md, product/ux/05-accessibility.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: INSUFFICIENT_EVIDENCE; Reported overlap is preserved; delivered M21 reflow evidence does not disprove this state.

Authoritative desired state: Reproduce affected service creation list and compare against existing readable/reflow rules; no authority change justified.

Authoritative artifact requiring change: None established.
Changed automatically: No
Decision required: No
Implementation remediation required: Blocked

Affected definition domains: {'product': False, 'user_journeys': False, 'ux': False, 'architecture': False, 'security': False}
Potentially stale artifacts: None

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

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

### REC-012: Administrator account property and role management

Classification: PRODUCT_SPEC_PROBLEM
Severity: HIGH
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: DOCUMENTED: PRD role matrix and SECRES-05 exclude Administrator role/contact management. REPOSITORY_EVIDENCED: src/consolePeople.ts list().writable is Owner-only. Current confirmed PO-FB-025 explicitly expands Administrator powers.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-025.

Current observed behavior: Implementation reflects superseded boundary; user confirmation settles expansion, not editable fields, target hierarchy or contact-security semantics.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: Roles matrix; IDENT-04/05; AUTHZ-02/03; SECRES-05; artifacts docs/web-console-prd.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md, product/architecture/web-console-state-contract.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: PRODUCT_SPEC_PROBLEM; Implementation reflects superseded boundary; user confirmation settles expansion, not editable fields, target hierarchy or contact-security semantics.

Authoritative desired state: Administrator can edit account properties and roles; define eligible targets, allowed properties, self/Owner boundaries, revocation, confirmations and audit without granting unrelated Owner capabilities.

Authoritative artifact requiring change: docs/web-console-prd.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md, product/architecture/web-console-state-contract.md.
Changed automatically: No
Decision required: REC-DEC-004
Implementation remediation required: Blocked

Affected definition domains: {'product': True, 'user_journeys': True, 'ux': True, 'architecture': True, 'security': True}
Potentially stale artifacts: docs/web-console-prd.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md, product/architecture/web-console-state-contract.md

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

### REC-013: Creation date and last-login metadata

Classification: PRODUCT_SPEC_GAP
Severity: MEDIUM
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED: src/consolePeople.ts list() projection omits created/last-login metadata; invitation inserts user without either. Current PRD lacks display/event definitions.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-026, PO-FB-027.

Current observed behavior: Requested metadata is absent and historical events cannot safely be fabricated.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: IDENT-02/03; AUTHZ-02; People detail; artifacts docs/web-console-prd.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, product/ux/01-information-architecture.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: PRODUCT_SPEC_GAP; Requested metadata is absent and historical events cannot safely be fabricated.

Authoritative desired state: Show creation date and last login with defined event/time semantics, truthful never/unknown states, authorized visibility and migration/backup/restore continuity.

Authoritative artifact requiring change: docs/web-console-prd.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, product/ux/01-information-architecture.md.
Changed automatically: No
Decision required: REC-DEC-007
Implementation remediation required: Blocked

Affected definition domains: {'product': True, 'user_journeys': True, 'ux': True, 'architecture': True, 'security': True}
Potentially stale artifacts: docs/web-console-prd.md, product/security/web-console-security-contract.md, product/architecture/web-console-state-contract.md, product/ux/01-information-architecture.md

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

### REC-014: Explicit unencrypted SMTP support

Classification: PRODUCT_SPEC_GAP
Severity: HIGH
Confidence: High for documented/source evidence; runtime unverified
Reproduction: NOT_ATTEMPTED

Evidence: REPOSITORY_EVIDENCED: src/consoleNotifications.ts always uses implicit TLS; src/consolePeoplePage.ts offers one-option Implicit TLS dropdown. PRD covers optional SMTP but lacks transport-mode semantics.

Product Owner feedback: PO-FEEDBACK-2026-10-11-002; PO-FB-030, PO-FB-031.

Current observed behavior: Unencrypted transport is unavailable. Confirmed PO-FB-031 selects support; SMTP transport encryption differs from required encrypted stored credentials.

Relevant implementation: source paths in evidence above; implementation read-only.

Relevant UX/product rule: IDENT-04; STATE-01/02/03 SMTP; artifacts docs/web-console-prd.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md.

Relevant user journey: docs/web-console-prd-user-journey-audit.md; People: J-OWNER-PEOPLE; Settings: J-OWNER-SETTINGS; service creation: J-OWNER-CONFIG / J-ADMIN-CONFIG. Timestamp and expanded Administrator account semantics are absent from these current journeys.

Architecture/security constraint: retain STATE-01/02/03 atomic reviewed activation, immediate identity authority and encrypted write-only secrets; SECRES-05 purpose/generation-bound resets remain distinct. Role expansion and unencrypted SMTP require bounded amendments, not silent weakening. Metadata needs recovery/privacy semantics. Other presentation changes do not themselves alter these boundaries.

Root source of inconsistency: PRODUCT_SPEC_GAP; Unencrypted transport is unavailable. Confirmed PO-FB-031 selects support; SMTP transport encryption differs from required encrypted stored credentials.

Authoritative desired state: Support explicit unencrypted SMTP alongside existing encrypted transport. Resolve mode persistence/defaults, no implicit downgrade, authentication/secret exposure acknowledgement, delivery admission and restore compatibility. Do not silently add STARTTLS as an additional feature.

Authoritative artifact requiring change: docs/web-console-prd.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md.
Changed automatically: No
Decision required: REC-DEC-005
Implementation remediation required: Blocked

Affected definition domains: {'product': True, 'user_journeys': True, 'ux': True, 'architecture': True, 'security': True}
Potentially stale artifacts: docs/web-console-prd.md, product/architecture/web-console-state-contract.md, product/security/web-console-security-contract.md, product/ux/01-information-architecture.md

Implementation validation: representative permitted/forbidden roles, current/draft/empty/error states, keyboard and narrow/wide reflow; secrets never prefilled; no unintended saves or role escalation. For REC-009 obtain a synthetic reproducible state and rendered evidence before defining the fix. No user production state is required.

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
