# Decisions required

Settled Product Owner intent is preserved. These are bounded domain-resolution requests, not an independent user interview.
## REC-DEC-001

Type: SPECIALIST_RESOLUTION. Domain: security. Source findings: REC-001, REC-002. Product Owner feedback: PO-FB-002, PO-FB-004. Authority: confirmed package; affected requirement: IDENT-05 / AUTHZ-02 / AUTHZ-03.

Question: Derive the permitted target matrix and revocation/enrollment/issuer-continuity checks for Owner and Administrator password and MFA reset initiation, keeping unrelated identity administration Owner-only.
Reason: Current authority explicitly permits Owner only. Role expansion is settled; target hierarchy, final Owner restriction, password-versus-factor transitions and pending proof issuer eligibility need precise safe semantics.
Affected actors/artifacts: see corresponding findings and impact map. Deferral blocks only dependent remediation. No candidate design is authoritative. implementation_ready: false.

## REC-DEC-002

Type: SPECIALIST_RESOLUTION. Domain: ux. Source findings: REC-004, REC-005. Product Owner feedback: PO-FB-008, PO-FB-009, PO-FB-011. Authority: confirmed package; affected requirement: UX-02 / UX-IA03 / UX-IN01.

Question: Specify focused Settings navigation, search/draft transitions and minimum friendly control/read-summary coverage for existing configuration, preserving advanced capabilities and role scopes.
Reason: No-long-page and friendly controls are settled; subtabs are exploratory. Derive bounded UX within the approved calm grouped design, without adding features or assuming a new global redesign.
Affected actors/artifacts: see corresponding findings and impact map. Deferral blocks only dependent remediation. No candidate design is authoritative. implementation_ready: false.

## REC-DEC-003

Type: SPECIALIST_RESOLUTION. Domain: architecture. Source findings: REC-006. Product Owner feedback: PO-FB-013. Authority: confirmed package; affected requirement: CONFIG-03 / IDENT-04 / STATE-01–03.

Question: Define independent confirmed deletion for SMTP credentials and the audit/dependency/current-state/stale-draft/history behavior needed to prevent later apply from restoring deleted values.
Reason: Independent deletion is settled, but active SMTP dependency handling and stored draft credentials cross existing configuration and immediate-value boundaries; the existing service-value contract cannot simply be assumed complete for SMTP.
Affected actors/artifacts: see corresponding findings and impact map. Deferral blocks only dependent remediation. No candidate design is authoritative. implementation_ready: false.
