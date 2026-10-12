# Findings

### UX-VIS-F001: Service wizard progress numbers paint over neighboring labels

Category: COMPOSITION_MISMATCH
Materiality: MEDIUM
Scope: Local shared wizard progress list

Actor/journey/state: Owner → Services → Add service; Details, Destination and Authentication.

Observed implementation: at 1280×900 the numeric markers 2–5 overlap the preceding step labels. At 320×900 the list wraps, but marker 2 still overlaps Details and marker 4 overlaps Authentication. The first Add service render reproduces the issue before any input. The same collision persists after Continue transitions. This obscures the wizard's progress text.

Evidence: UXVIS-001 through UXVIS-006, linked individually in [coverage](01-coverage.md). Exact browser and item geometry are in [observations](observations.json). Component bounding boxes and whole-document widths alone do not reveal the painted marker collision.

Governing authority: product/ux/03-responsive-and-platform.md, approved web-console-ux-2, UX-R01 requires readable reflow without clipping; current task position remains understandable across desktop and narrow layouts.

Reproduction: run manifest execution.command using synthetic fixture; sign in, activate Services → Add service. Inspect the numbered progress row above Details. Continue with a valid service ID/name and destination to see the same row on subsequent steps. No service apply is necessary.

Targeted revalidation: recapture all six states and visually inspect marker/label separation. Product Reconciliation determines disposition; this report makes no root-cause or design decision.
