# M36 visual and interaction review

Authority: approved UX-DESIGN-005, `workflow/definition/drafts/product-ux/web-console-feedback-004/` and canonical UX-IN17/R07/V07/A08/C54–58. Proposal historical banners do not imply a pending approval.

Actual implementation: `final/` screenshots from the disposable HTTPS approval browser on the source hashes in `evidence/qa/secretsauce-mcp/milestone36/tested-inputs.json`. Root independently reviewed exception desktop/390 and no-exception desktop. Result: PASS, no scoped exception needed.

| Reference | Actual | Assessment |
|---|---|---|
| exception-dialog-desktop.png1440×1000 | final/exception-dialog-desktop.png1440×1000 | Same centered640px white modal, neutral backdrop, warm accent, heading/body hierarchy, pale amber bordered risk cards with strong title/muted detail, neutral disabled Continue and right-aligned action row. Actual fixture has three required risks, including reduced scanning, rather than the reference's two. Each still has its own checkbox. One checkbox selected intentionally demonstrates partial gating and remaining count. |
| exception-dialog-narrow.png390×844 | final/exception-dialog-390.png390×844 | Preserves full readable risk text in bounded scrolling dialog; footer and every checkbox remain reachable. No nested foldouts or clipped text. |
| no-exception-dialog-desktop.png1440×1000 | final/no-exception-dialog-desktop.png1440×1000 | Same compact centered confirmation, service/review metadata, activation statement, Cancel and enabled warm Continue. Visible initial heading focus follows accessibility authority. |
| Narrow / text enlargement constraints | final/*-320.png and final/*-320-text200.png | 320px layout and doubled computed font sizes; document width and visible text ranges fit viewport. Long dialogs scroll vertically; controls and literal text wrap. Both Changes/New settings also remain conforming. |

The actual changed-value fixture includes exact custom methods, regex and binary-response controls, so its background review contains more data than the concept. General visual appearance is retained; no source reference was changed. Dialog captures use viewport-only images to compare actual modal/backdrop geometry. Review captures use full page to retain all comparison data.

Interaction evidence: `final/browser-report.json`: tab keyboard switching, trapped modal focus, Escape/Cancel return, read-only tab changes, all-risk gating, stale reset, pending guard, known success, unknown-status inspection, hostile-text safety. Screenshots alone do not certify these behaviors; actual assertions do.
