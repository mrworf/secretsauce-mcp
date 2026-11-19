# PO-FEEDBACK-2026-11-18-002

Source: realtime service walkthrough and typed handoff. Status: CONFIRMED.

| ID | Classification | Confirmation | Meaning |
|---|---|---|---|
| PO-FB-238 | OBSERVATION | CONFIRMED | Back to Services appears inconsistently across service tabs and the editor. |
| PO-FB-239 | DIRECTIVE | CONFIRMED | Remove Back to Services controls from Overview, Configuration, Access and Activity. Use the main Services navigation. |
| PO-FB-240 | OBSERVATION | CONFIRMED | Service editing uses scattered actions and has no obvious Discard operation. |
| PO-FB-241 | DIRECTIVE | CONFIRMED | Use a persistent Settings-style action bar in service editing with status, Discard, Save for later and Review changes. |
| PO-FB-242 | OBSERVATION | CONFIRMED | Continue merely advances rather than pointing to what the editor needs to complete. |
| PO-FB-243 | DIRECTIVE | CONFIRMED | Accepted design recommendation to remove Continue from service configuration and use direct section navigation with indicators for known blockers. |
| PO-FB-244 | DIRECTIVE | CONFIRMED | Accepted design recommendation to allow Review changes for incomplete setup. Show specific issues and fix links while keeping Apply unavailable until required settings are complete. |
| PO-FB-245 | DIRECTIVE | CONFIRMED | Accepted design recommendation that discarding never-saved setup abandons those edits and returns to Services. |
| PO-FB-246 | DIRECTIVE | CONFIRMED | Accepted design recommendation that unsaved edits can revert to the saved draft and discarding a saved draft requires separate explicit confirmation. |
| PO-FB-247 | DIRECTIVE | CONFIRMED | Accepted design recommendation that an active service keeps running its active configuration when unsaved edits or its saved draft are discarded. |
| PO-FB-248 | OBSERVATION | CONFIRMED | Overview already calls out missing configuration. |
| PO-FB-249 | PREFERENCE | CONFIRMED | Retain useful Overview guidance and build on existing actionable validation indicators. |
| PO-FB-250 | OBSERVATION | CONFIRMED | The identity-mapping warning repeats across service screens. |
| PO-FB-251 | IDEA_OR_QUESTION | CONFIRMED | Earlier idea to require identity mapping before editing, superseded by the later direction to drop mapping. |
| PO-FB-252 | OBSERVATION | CONFIRMED | Reported that Save draft from the navigation guard did not complete navigation or save the Access & policy selection. Discard left without the selection. |
| PO-FB-253 | DIRECTIVE | CONFIRMED | Remove the separate identity-mapping flow and repeated mapping warnings for service imports. |
| PO-FB-254 | DIRECTIVE | CONFIRMED | Imported drafts start with nobody selected. Use the ordinary Access & policy controls for selecting who can use them. |
| PO-FB-255 | DIRECTIVE | CONFIRMED | Allow Apply with nobody assigned. Nobody has execution access until explicitly assigned. |
| PO-FB-256 | OBSERVATION | CONFIRMED | Lifecycle and draft badges are confusing when displayed together as Draft and Draft changes. |
| PO-FB-257 | DIRECTIVE | CONFIRMED | Use Active and Inactive to describe lifecycle independently of saved drafts. |
| PO-FB-258 | DIRECTIVE | CONFIRMED | Use Active, Inactive and Archived as lifecycle labels. |
| PO-FB-259 | IDEA_OR_QUESTION | CONFIRMED | Reconcile existing service lifecycle states and transitions with the intended presentation. |
| PO-FB-260 | DIRECTIVE | CONFIRMED | Show Draft as a separate indicator when there is a saved draft. |
| PO-FB-261 | DIRECTIVE | CONFIRMED | Keep Needs configuration on the Services list and use section indicators instead of a duplicate badge within the service. |
| PO-FB-262 | DIRECTIVE | CONFIRMED | Show the issue indicator on the parent Configuration tab when any configuration section needs attention. |
| PO-FB-263 | DIRECTIVE | CONFIRMED | Import a separate service instead of overwriting a pre-existing service or its access. |
| PO-FB-264 | DIRECTIVE | CONFIRMED | Resolve name collisions using Imported Java, Imported Java (2), Imported Java (3), and so on. |

Reconciliation ready: false. No unresolved debrief items. Confirmed directives establish product intent. Preferences guide quality, observations record evidence, and ideas or questions record exploration.
