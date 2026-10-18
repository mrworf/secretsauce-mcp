# Visual system

## UX-V01 — Hierarchy and density

Use the existing SecretSauce mark with neutral near-white surfaces, dark navy text and a restrained warm orange primary accent, as approved in the concepts. The administrative workspace is calm and practical; avoid decorative dashboards, gradients, large illustrations or animated urgency. One clear page title, concise description, grouped content and visible next action form the hierarchy. Use moderate density: aligned list columns for scanning, more breathing room around form groups and consequential review.

Maintain a shared spacing/type rhythm, with readable body/help text and clear section headings. Exact pixels/fonts remain designer discretion provided hierarchy, reflow and contrast are preserved. Use monospace selectively for host/path/identifier examples, not ordinary prose. Long technical values wrap or have an accessible inspect/copy treatment without silently losing distinguishing characters. Never copy credential values back.

## UX-V02 — State and action language

Represent lifecycle, editing and health separately: **Active** versus **Draft changes**; **In use / Applied revision N** versus **Saved for later · Not in use yet**; **Degraded** versus **Failed**. Distinguish Disabled from Archived. Use text with icons/shape plus restrained green/blue/amber/red status accents. Color alone cannot encode severity, allowed/denied or before/after.

Primary action is visually strongest for the current task (Add service, Review & apply, Apply reviewed changes). Secondary actions use quieter controls; destructive actions become prominent only in their relevant confirmation. Never style a noninteractive status badge as an action. Read-only views have a clear scope label and omit forbidden edit affordances. Runtime banners for audit outage, restricted diagnosis or recovery precede normal content and cannot be dismissed while the state persists.

Use sentence case and concrete action verbs. State actual consequence: “Disable service”, “Replace value”, “Use as draft”, “Apply 2 changes”. Avoid “secure/compliant” success badges that imply guarantees beyond the product. Explain administrative destination trust and best-effort response scanning in contextual help without repeating dense warnings on every routine field.

## UX-V03 — Coherence with approved evidence

Match the approved service-list hierarchy, grouped edit sections, explicit impact review and recovery checklist character. Prototype header labels and illustrative sample counts are not production fixtures. Treat proposal navigation, inert controls and truncated screen coverage as design-evidence scaffolding. No exact pixel-match requirement supersedes accessibility or functional completeness. New screens extend these shared rules rather than inventing another design language.


## UX-V04 — Settings and location state

Extend UX-DESIGN-001 with UX-DESIGN-002: compact secondary section navigation, populated current-value forms under UX-DESIGN-003, clearly labeled change state and a single prominent full-draft review action. Global and section selection use restrained accent plus weight/shape, not color alone. Keep raw JSON/YAML behind an explicitly optional advanced editor. Friendly repeated rows, selectors, units and typed option controls replace object dumps in ordinary editing and read-only views. Immediate deletion/reset controls remain secondary until their specific confirmation.

## UX-V05 — Material fidelity to approved feedback 002 mockups

UX-DESIGN-003 explicitly requires the implementation’s general appearance to match the approved mockups. Preserve the demonstrated overall composition, useful horizontal space, moderate density, typography hierarchy, spacing rhythm, grouped white cards on pale neutral surfaces, dark text, restrained orange primary/selection accents, input/button treatment, primary/secondary action hierarchy, primary and Settings rails, and responsive form/list transformation. Functional equivalence alone does not satisfy this requirement.

Compare actual implementation screenshots with the manifest-hashed concepts at representative matching states and viewports: populated Email, None warning, saved backup settings/full review/applied result, People list and account detail, Add service destinations, diagnostics, and narrow Email/People. Use synthetic data and equivalent permissions; record meaningful visual differences and their resolution. Correct material divergence before claiming UX conformance, or record an explicitly accepted, scoped exception with rationale. Do not rewrite reference concepts to disguise drift.

This is general visual fidelity, not pixel-perfect geometry, identical sample text/counts or font-antialias matching. Accessibility, real capability completeness, dynamic state and current security contracts remain mandatory; if they require material deviation, document it and obtain explicit acceptance rather than silently changing the design. Minor implementation-specific rendering differences need no cosmetic approval ceremony. Existing approved unaffected recovery/service flows retain their prior visual authority.


## UX-V06 — Approved service configuration fidelity

UX-DESIGN-004 extends UX-V05 to the feedback 003 concepts: compact service rows, separate lifecycle/readiness/draft badges, grouped current Overview, populated focused Configuration sections, global Guided/Advanced control, direct creation-step navigation, readable rule rows, credential/rule dialogs and explicit import mapping recovery. Preserve pale neutral background, grouped white surfaces, dark text, restrained orange selection/action accent, spacing/type rhythm and useful desktop width. Avoid repetitive banners, redundant selected-step headings and accordion stacks. Lifecycle accent is supplementary to text; green Active never conceals a missing-value warning or implies a health test.

Compare matching-state/role/viewport implementation screenshots with the manifest-hashed feedback 003 references for hierarchy, width, density, navigation, control treatment, grouping, spacing and responsive transformation. Correct material drift or obtain an explicit scoped exception; functional tests alone cannot establish this visual conformance. Prototype sample omissions or inert behavior never remove capabilities. Preserve unaffected UX1–3 visuals and existing acceptance requirements.


## UX-V07 — Grouped service review

Preserve the UX4 shell and visual character. Use clear section headings, white bordered groups and restrained low-saturation change cells with dark readable values. Before and After have equal wide-screen columns and shared row alignment. Label additions **+ Added** with green, removals **− Removed** with red, and changed values **~ Changed** with amber/yellow; color is never the sole signal. Unchanged complete proposed settings use ordinary neutral cards in New settings. Use the existing active-tab underline/accent, bottom action bar and warm primary Approve changes button.

Keep the exception summary concise; detailed acknowledgment belongs in the focused modal. Preserve clear heading, consequence, service/revision context, individually labeled exception blocks and Cancel/Continue hierarchy. UX-DESIGN-005 approves the general appearance of feedback 004 renders; compare actual matching states/widths for density, spacing, typography and hierarchy under UX-C42, not merely functional outcomes.
