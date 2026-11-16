# PO-FEEDBACK-2026-10-18-003

Source: pasted transcript in prompt. Status: CONFIRMED.

| ID | Class | Confirmation | Meaning |
|---|---|---|---|
| PO-FB-149 | OBSERVATION | CONFIRMED | A draft service is shown as needing configuration and with a separate missing-assignment indication. |
| PO-FB-150 | DIRECTIVE | CONFIRMED | Keep the service list status concise as Needs configuration; leave specific missing-configuration explanations inside the service. |
| PO-FB-151 | OBSERVATION | CONFIRMED | Review reports a broad incomplete/invalid message naming many configuration areas. |
| PO-FB-152 | OBSERVATION | CONFIRMED | In the reported example, the missing credential value in Authentication is the actual problem, while other sections appear correct. |
| PO-FB-153 | DIRECTIVE | CONFIRMED | Explain the specific configuration problem rather than listing every possible section as potentially wrong. |
| PO-FB-154 | DIRECTIVE | CONFIRMED | Mark affected configuration section names with a yellow circled exclamation indicator. |
| PO-FB-155 | OBSERVATION | CONFIRMED | The missing credential value status is visually subdued and easy to miss. |
| PO-FB-156 | DIRECTIVE | CONFIRMED | Make the missing value visibly identifiable in the Authentication section. |
| PO-FB-157 | DIRECTIVE | CONFIRMED | Apply precise, visible identification of missing or invalid configuration generally rather than giving a generic list of tabs. |
| PO-FB-158 | OBSERVATION | CONFIRMED | The guided Review changes step provides redundant explanatory text rather than the actual review. |
| PO-FB-159 | IDEA_OR_QUESTION | CONFIRMED | Earlier in the walkthrough, consider making the Review changes step the actual review. The later four-section flow is the selected direction. |
| PO-FB-160 | OBSERVATION | CONFIRMED | New-service creation already uses sequential Continue actions followed by Review and Apply, unlike editing imported services. |
| PO-FB-161 | OBSERVATION | CONFIRMED | New-service review also produces a generic invalid-input error without locating the problem. |
| PO-FB-162 | DIRECTIVE | CONFIRMED | Use a consistent four-section guided flow for new and edited services: Details, Destination and Authentication use Continue; Access and policy uses Review and apply. Remove the separate fifth Review placeholder step while retaining the actual review. |
| PO-FB-163 | OBSERVATION | CONFIRMED | Overview has multiple differently named routes to the same configuration editor, including a review action that does not open review. |
| PO-FB-164 | DIRECTIVE | CONFIRMED | Make Review draft changes a direct shortcut to the actual review when the draft is ready; missing configuration prevents that shortcut from proceeding. |
| PO-FB-165 | OBSERVATION | CONFIRMED | The overview says changes await review even when configuration is incomplete. |
| PO-FB-166 | DIRECTIVE | CONFIRMED | Distinguish missing configuration from a draft ready for review in the overview. Exact wording remains open. |
| PO-FB-167 | OBSERVATION | CONFIRMED | The identity-mapping explanation is helpful, but the same overview also implies the draft is ready for review. |
| PO-FB-168 | DIRECTIVE | CONFIRMED | Do not offer the review shortcut as available while known configuration or identity-mapping issues remain; once resolved it should go directly to review. |
| PO-FB-169 | DIRECTIVE | CONFIRMED | Align Find a service and Status at the top so differing helper-text lengths do not offset their controls. |
| PO-FB-170 | DIRECTIVE | CONFIRMED | Remove the credential-value and mapping-specific messages from service list rows; present those details in the service overview. |
| PO-FB-171 | OBSERVATION | CONFIRMED | Applied configuration history is confusing and its usefulness is unclear to the Product Owner. |
| PO-FB-172 | OBSERVATION | CONFIRMED | Import and export are understandable capabilities. |
| PO-FB-173 | OBSERVATION | CONFIRMED | The current sanitized export displays configuration on screen rather than providing the expected downloadable file. |
| PO-FB-174 | DIRECTIVE | CONFIRMED | Export sanitized configuration as a downloadable YAML file that can be imported into another SecretSauce instance. |
| PO-FB-175 | DIRECTIVE | CONFIRMED | Hide the applied configuration history/reuse console interface for now; retain the underlying history and revision-reuse capability. |
| PO-FB-176 | OBSERVATION | CONFIRMED | Settings review hides Security and operational effect in a disclosure despite its short contents. |
| PO-FB-177 | DIRECTIVE | CONFIRMED | Show Security and operational effect directly in Settings review without requiring expansion. |
| PO-FB-178 | OBSERVATION | CONFIRMED | Secret-detection rule and timeout values are formatted differently across the Settings comparison, making even identical values difficult to compare. |
| PO-FB-179 | PREFERENCE | CONFIRMED | Settings comparisons should be easy to compare visually. |
| PO-FB-180 | IDEA_OR_QUESTION | CONFIRMED | Explain or evaluate why required MCP scopes are editable and what they mean; no change to scope semantics was selected. |
| PO-FB-181 | OBSERVATION | CONFIRMED | Limits settings contain many folded groups and are experienced as messy. |
| PO-FB-182 | PREFERENCE | CONFIRMED | Use the improved services configuration organization as direction for Limits settings. |
| PO-FB-183 | IDEA_OR_QUESTION | CONFIRMED | Consider subtabs to organize Limits settings instead of many expandable groups. |
| PO-FB-184 | OBSERVATION | CONFIRMED | Repeating the selected Settings tab name as a page heading feels redundant. |
| PO-FB-185 | OBSERVATION | CONFIRMED | The current SMTP username/password replacement experience is unsatisfactory. |
| PO-FB-186 | DIRECTIVE | CONFIRMED | Keep the SMTP authentication/credential area visible without a disclosure. |
| PO-FB-187 | DIRECTIVE | CONFIRMED | Show current SMTP credential information including the username; Replace opens a dialog with the username prefilled, password blank, and Save/Cancel actions. |
| PO-FB-188 | DIRECTIVE | CONFIRMED | Provide Set credential when none is configured and a Clear credential action. |
| PO-FB-189 | DIRECTIVE | CONFIRMED | Research best practices for the SMTP credential management experience. |
| PO-FB-190 | OBSERVATION | CONFIRMED | Mail-server Not configured status is shown in green. |
| PO-FB-191 | DIRECTIVE | CONFIRMED | Use yellow for the mail server Not configured state, consistent with other incomplete configuration states. |
| PO-FB-192 | OBSERVATION | CONFIRMED | The daily backup UTC-hour field permits entry of 24 and reports an error only when saving. |
| PO-FB-193 | IDEA_OR_QUESTION | CONFIRMED | Consider a slider for the daily backup UTC hour; the selected broader outcome is preventing invalid hour entry, not a required slider mechanism. |
| PO-FB-194 | DIRECTIVE | CONFIRMED | Provide a daily backup UTC-hour control that prevents choosing an invalid hour. |
| PO-FB-195 | DIRECTIVE | CONFIRMED | Make the backup-retention field label immediately clear that the value is a number of days. |
| PO-FB-196 | DIRECTIVE | CONFIRMED | Show health details directly in an organized layout rather than hiding them behind Unfold all health details. |
| PO-FB-197 | DIRECTIVE | CONFIRMED | Keep audit retention visibly available without a disclosure. |
| PO-FB-198 | PREFERENCE | CONFIRMED | Prefer placing audit retention underneath diagnostics. |
| PO-FB-199 | OBSERVATION | CONFIRMED | Settings search is useful but was discovered late in the walkthrough. |
| PO-FB-200 | PREFERENCE | CONFIRMED | Make Settings search easier to discover rather than placing it at the bottom. |
| PO-FB-201 | IDEA_OR_QUESTION | CONFIRMED | Consider a search button near the Settings section navigation that opens a modal with a query field and result links. |

## Clarification

PO-UNRESOLVED-009 resolved: “1. hide it for now”. Hide the console interface; retain the history/reuse capability.

## Authority and handoff

Confirmed directives establish product intent; preferences are advisory; observations are evidence; ideas/questions are exploratory. Subtabs, a backup-hour slider and a search modal remain suggested mechanisms.

No unresolved questions. Reconciliation ready: false until producer commit/provenance closeout.

