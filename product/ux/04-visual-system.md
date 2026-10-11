# Visual system

## UX-V01 — Hierarchy and density

Use the existing SecretSauce mark with neutral near-white surfaces, dark navy text and a restrained warm orange primary accent, as approved in the concepts. The administrative workspace is calm and practical; avoid decorative dashboards, gradients, large illustrations or animated urgency. One clear page title, concise description, grouped content and visible next action form the hierarchy. Use moderate density: aligned list columns for scanning, more breathing room around form groups and consequential review.

Maintain a shared spacing/type rhythm, with readable body/help text and clear section headings. Exact pixels/fonts remain designer discretion provided hierarchy, reflow and contrast are preserved. Use monospace selectively for host/path/identifier examples, not ordinary prose. Long technical values wrap or have an accessible inspect/copy treatment without silently losing distinguishing characters. Never copy credential values back.

## UX-V02 — State and action language

Represent lifecycle, editing and health separately: **Active** versus **Draft changes**; **Applied revision N** versus **Saved draft**; **Degraded** versus **Failed**. Distinguish Disabled from Archived. Use text with icons/shape plus restrained green/blue/amber/red status accents. Color alone cannot encode severity, allowed/denied or before/after.

Primary action is visually strongest for the current task (Add service, Review & apply, Apply reviewed changes). Secondary actions use quieter controls; destructive actions become prominent only in their relevant confirmation. Never style a noninteractive status badge as an action. Read-only views have a clear scope label and omit forbidden edit affordances. Runtime banners for audit outage, restricted diagnosis or recovery precede normal content and cannot be dismissed while the state persists.

Use sentence case and concrete action verbs. State actual consequence: “Disable service”, “Replace value”, “Use as draft”, “Apply 2 changes”. Avoid “secure/compliant” success badges that imply guarantees beyond the product. Explain administrative destination trust and best-effort response scanning in contextual help without repeating dense warnings on every routine field.

## UX-V03 — Coherence with approved evidence

Match the approved service-list hierarchy, grouped edit sections, explicit impact review and recovery checklist character. Prototype header labels and illustrative sample counts are not production fixtures. Treat proposal navigation, inert controls and truncated screen coverage as design-evidence scaffolding. No exact pixel-match requirement supersedes accessibility or functional completeness. New screens extend these shared rules rather than inventing another design language.


## UX-V04 — Settings and location state

Extend UX-DESIGN-001 with UX-DESIGN-002: compact secondary section navigation, readable applied summaries, clearly labeled editing state and a single prominent full-draft review action. Global and section selection use restrained accent plus weight/shape, not color alone. Keep raw JSON/YAML behind an explicitly optional advanced editor. Friendly repeated rows, selectors, units and typed option controls replace object dumps in ordinary editing and read-only views. Immediate deletion/reset controls remain secondary until their specific confirmation.
