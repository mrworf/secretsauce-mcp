# Decisions required

REC-DEC-004, REC-DEC-005 and REC-DEC-007 are resolved by exact bounded specialist contracts and adopted PRD semantics; no additional Product Owner choice remains in those branches. Their source transaction is still root-owned pending commit and must match the canonical hashes.

## REC-DEC-006 — UX synthesis and approval

Type: SPECIALIST_RESOLUTION / product experience approval.
Source findings: REC-008, REC-010, REC-011, REC-016.
Product Owner feedback: PO-FB-015/016/017/019/020/021/022/023/024/029/033/035/036/037/038/039/041.
Question: What coherent language, layout, required-field, People detail and current-value settings pattern addresses this feedback while preserving review and permission safeguards?
Reason: Existing explicit terminology and applied-summary/edit patterns need design reconsideration. Exploratory mechanisms are not approved design.
Affected requirements: UX-02/03/04; CONFIG-03.
Affected users: Console administrators and authorized readers.
Affected artifacts: product/ux/01-information-architecture.md, 02-interaction-patterns.md, 03-responsive-and-platform.md, 04-visual-system.md, 05-accessibility.md, acceptance checklist and derived journeys.
Consequence of deferral: dependent design remains unready; no implementation against unapproved UX-DESIGN-003 proposal.
implementation_ready: false

Service overlap evidence gap is closed by UX-VIS-F001, six synthetic captures. Backup persistence loss and hard-coded diagnostic claims remain unproven; design synthesis must not assume them.
