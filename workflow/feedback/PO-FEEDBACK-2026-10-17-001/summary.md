# PO-FEEDBACK-2026-10-17-001

Status: **CONFIRMED**. Source: two Product Owner transcripts and a clarification covering service setup, import, and editing.

Canonical source: [feedback.yaml](feedback.yaml). Excerpts have recording-local timestamp locators. Reported behavior has not been independently verified.

## Captured feedback

33 observation, 9 idea or question, 36 directive, 5 preference.

| ID | Class | Confirmation | Meaning |
| --- | --- | --- | --- |
| PO-FB-042 | OBSERVATION | CONFIRMED | YAML import worked well for the Product Owner. |
| PO-FB-043 | OBSERVATION | CONFIRMED | The service list does not clearly communicate which services are active. |
| PO-FB-044 | IDEA_OR_QUESTION | CONFIRMED | Consider left status bars: red for off, yellow for configuration/draft, green for active. |
| PO-FB-045 | DIRECTIVE | CONFIRMED | Service status must accommodate an active service that also has a draft. |
| PO-FB-046 | IDEA_OR_QUESTION | CONFIRMED | Consider showing both yellow and green for an active service with a draft. |
| PO-FB-047 | DIRECTIVE | CONFIRMED | Make the service row clickable to open its settings. |
| PO-FB-048 | DIRECTIVE | CONFIRMED | Provide enable, disable, and delete actions on the right of each service row. |
| PO-FB-049 | DIRECTIVE | CONFIRMED | Ask for confirmation for service delete, enable, and disable actions. |
| PO-FB-050 | OBSERVATION | CONFIRMED | The empty applied overview message is cryptic. |
| PO-FB-051 | IDEA_OR_QUESTION | CONFIRMED | Consider explaining an empty overview as no current configuration and not running. |
| PO-FB-052 | OBSERVATION | CONFIRMED | The top draft/apply/unchanged bar does not communicate useful information to the Product Owner. |
| PO-FB-053 | OBSERVATION | CONFIRMED | The white bar below the top bar has no understandable purpose. |
| PO-FB-054 | OBSERVATION | CONFIRMED | The long configuration display and labels such as primary are difficult to understand. |
| PO-FB-055 | DIRECTIVE | CONFIRMED | Organize the configuration view into understandable, distinguishable sections. |
| PO-FB-056 | OBSERVATION | CONFIRMED | Rules run together visually instead of appearing as distinct items. |
| PO-FB-057 | OBSERVATION | CONFIRMED | The Product Owner finds JSON easier to read than the current human-facing configuration display. |
| PO-FB-058 | DIRECTIVE | CONFIRMED | Further iterate on service configuration UX to address its perceived complexity. |
| PO-FB-059 | PREFERENCE | CONFIRMED | Use fewer fold-out controls that produce long pages, especially for single settings. |
| PO-FB-060 | DIRECTIVE | CONFIRMED | Show who last changed a credential value alongside its change information. |
| PO-FB-061 | DIRECTIVE | CONFIRMED | Remove the inline credential value input from the configuration display. |
| PO-FB-062 | DIRECTIVE | CONFIRMED | Use Set or Replace value actions that open a credential entry dialog with Save and Cancel. |
| PO-FB-063 | OBSERVATION | CONFIRMED | Credential deletion wording does not make clear whether deletion is possible or what it does. |
| PO-FB-064 | DIRECTIVE | CONFIRMED | When dependencies prevent deletion, clearly say that deletion is blocked. |
| PO-FB-065 | DIRECTIVE | CONFIRMED | When a credential key is still in use, Delete clears only its value and retains the key. |
| PO-FB-066 | DIRECTIVE | CONFIRMED | Before proceeding with Delete on an in-use credential key, explain that only its value will be cleared and the key will remain. |
| PO-FB-067 | DIRECTIVE | CONFIRMED | Only allow deletion of the credential key itself when it is unreferenced. |
| PO-FB-068 | OBSERVATION | CONFIRMED | The Access view is unclear and appears to offer no usable action. |
| PO-FB-069 | OBSERVATION | CONFIRMED | The service Activity view is satisfactory. |
| PO-FB-070 | OBSERVATION | CONFIRMED | The guided editor and availability of advanced editing are liked. |
| PO-FB-071 | DIRECTIVE | CONFIRMED | Remove the redundant same draft wording from the Advanced Editor entry. |
| PO-FB-072 | IDEA_OR_QUESTION | CONFIRMED | An initial idea was nested guided/advanced tabs within Details; the speaker subsequently revises the placement because Advanced edits the whole configuration. |
| PO-FB-073 | PREFERENCE | CONFIRMED | Avoid demeaning terminology such as simple for the guided editing mode. |
| PO-FB-074 | DIRECTIVE | CONFIRMED | Avoid repeating the selected wizard step label as a redundant content heading. |
| PO-FB-075 | IDEA_OR_QUESTION | CONFIRMED | Consider placing the full Advanced Editor switch beside Save Draft in the footer. |
| PO-FB-076 | DIRECTIVE | CONFIRMED | Make wizard step headers clickable for navigation between steps. |
| PO-FB-077 | OBSERVATION | CONFIRMED | Backtracking through the wizard currently requires scrolling to bottom navigation. |
| PO-FB-078 | DIRECTIVE | CONFIRMED | Explain that the API documentation link can help an LLM understand how to use the service. |
| PO-FB-079 | DIRECTIVE | CONFIRMED | Explain what allowed destinations mean. |
| PO-FB-080 | DIRECTIVE | CONFIRMED | Explain host matching and its exact, suffix, and regular-expression choices. |
| PO-FB-081 | OBSERVATION | CONFIRMED | Adding another destination behaves as expected. |
| PO-FB-082 | DIRECTIVE | CONFIRMED | Show the TLS verification control without a fold-out and make its scope explicit. |
| PO-FB-083 | DIRECTIVE | CONFIRMED | If TLS verification is per destination, place it with that destination. |
| PO-FB-084 | DIRECTIVE | CONFIRMED | Do not nest multiple fold-out layers in destination settings. |
| PO-FB-085 | IDEA_OR_QUESTION | CONFIRMED | Consider a per-destination Advanced settings action opening a focused page for advanced matching and identifiers. |
| PO-FB-086 | DIRECTIVE | CONFIRMED | Do not expose service and destination identifiers in ordinary user interaction if they are only system references; retain the stated conditional nature of this request. |
| PO-FB-087 | DIRECTIVE | CONFIRMED | Offer a global Guided/Advanced editing mode switch, rather than repeating full-configuration Advanced Editor entries in individual sections. |
| PO-FB-088 | OBSERVATION | CONFIRMED | The explanation of whether a downstream service needs credentials is understandable. |
| PO-FB-089 | PREFERENCE | CONFIRMED | Improve the placement name label; no replacement wording has been selected. |
| PO-FB-090 | OBSERVATION | CONFIRMED | The meaning of usage prefix is unclear. |
| PO-FB-091 | DIRECTIVE | CONFIRMED | Explain or illustrate how prefix and suffix relate to a credential value. |
| PO-FB-092 | DIRECTIVE | CONFIRMED | Show the single placement hint field directly instead of hiding it in a fold-out. |
| PO-FB-093 | OBSERVATION | CONFIRMED | Placement kind and generic hint terminology are not understandable. |
| PO-FB-094 | OBSERVATION | CONFIRMED | Visual boundaries between advanced placement hints and subsequent controls are unclear. |
| PO-FB-095 | OBSERVATION | CONFIRMED | The enforce gateway owned header option is unexplained to the Product Owner. |
| PO-FB-096 | OBSERVATION | CONFIRMED | The relationship between the displayed credential metadata and the configured credential is not immediately apparent. |
| PO-FB-097 | OBSERVATION | CONFIRMED | An inline required credential value field is confusing because Continue works without it and the requirement applies to immediate replacement. |
| PO-FB-098 | DIRECTIVE | CONFIRMED | Use the credential entry dialog pattern in the authentication wizard as well. |
| PO-FB-099 | OBSERVATION | CONFIRMED | Adding another credential jumps the view to the top. |
| PO-FB-100 | DIRECTIVE | CONFIRMED | Scroll to the newly added credential when it is created. |
| PO-FB-101 | OBSERVATION | CONFIRMED | The meaning of selecting a user under explicit service access is unclear. |
| PO-FB-102 | DIRECTIVE | CONFIRMED | Explain the default policy using clear allow/deny wording. |
| PO-FB-103 | IDEA_OR_QUESTION | CONFIRMED | Question: does an allow default mean all individual rules are deny rules? This is an inference to clarify, not a requested restriction on rule effects. |
| PO-FB-104 | DIRECTIVE | CONFIRMED | Select HTTP methods from a list instead of typing comma-separated values. |
| PO-FB-105 | DIRECTIVE | CONFIRMED | Explain what a policy rule reason means. |
| PO-FB-106 | OBSERVATION | CONFIRMED | The existing policy rules are not visually recognizable as a list. |
| PO-FB-107 | DIRECTIVE | CONFIRMED | Show a rule list with an Add rule button and Edit/Delete actions per rule, instead of an always-visible blank add form. |
| PO-FB-108 | DIRECTIVE | CONFIRMED | Avoid repeating the rule identifier in visible action labels when the row supplies context. |
| PO-FB-109 | PREFERENCE | CONFIRMED | Prefer not exposing policy rule identifiers in ordinary user interaction; the speaker remains uncertain. |
| PO-FB-110 | DIRECTIVE | CONFIRMED | Open a modal to add a policy rule. |
| PO-FB-111 | OBSERVATION | CONFIRMED | The shared secret detection settings link unexpectedly leaves service editing for global settings. |
| PO-FB-112 | OBSERVATION | CONFIRMED | Rule movement controls appear inconsistent: the first rule cannot be moved while subsequent rules offer movement. |
| PO-FB-113 | OBSERVATION | CONFIRMED | The policy tester is liked. |
| PO-FB-114 | IDEA_OR_QUESTION | CONFIRMED | Consider presenting the policy tester in a modal. |
| PO-FB-115 | OBSERVATION | CONFIRMED | Returning to services from policy testing produces an unexpected unsaved draft warning. |
| PO-FB-116 | OBSERVATION | CONFIRMED | Unresolved imported identities block review/apply without explaining the required action. |
| PO-FB-117 | OBSERVATION | CONFIRMED | Policy rule add and edit forms look substantially different. |
| PO-FB-118 | PREFERENCE | CONFIRMED | Use a consistent focused interaction for adding and editing rules. |
| PO-FB-119 | OBSERVATION | CONFIRMED | Selecting the Product Owner account does not resolve the reported import blocker. |
| PO-FB-120 | OBSERVATION | CONFIRMED | Browser Back and Forward are unreliable in this workflow; lack of browser history updates is the speaker’s explanation, not a verified root cause. |
| PO-FB-121 | OBSERVATION | CONFIRMED | The blocker does not identify unresolved identities or reveal a way to map them while editing. |
| PO-FB-122 | DIRECTIVE | CONFIRMED | Explain service and rule errors sufficiently for users to understand the problem and how to proceed, including unresolved imported identities. |
| PO-FB-123 | DIRECTIVE | CONFIRMED | Research established UX practices when refining service configuration editing. |
| PO-FB-124 | IDEA_OR_QUESTION | CONFIRMED | The final suggested presentation is Guided by default with a switch to full-configuration JSON editing. |

## Suggested mechanisms

Exploratory items retain the status-bar colors, dual colors, overview wording, initial nested tabs, footer switch placement, focused destination settings, policy tester modal, and final Guided-default presentation as suggestions. The later global mode request clarifies the initial section-level Advanced idea. The question about default allow implying only deny rules remains a question, not a rule restriction.

## Clarification resolved

Referenced-value clearing is required: Delete clears only the value, retains the in-use key, and explains that behavior.

No unresolved questions remain.

## Authority and handoff

- Confirmed directives are authoritative Product Owner intent.
- Preferences are advisory.
- Observations are reported evidence.
- Ideas and questions are exploratory.

Reconciliation ready: **true**. No product, UX, or implementation changes are included.

Transaction payload: `facc26dcf8cb488ff1204091b18a5a9179a7ba51`.

Run product-reconciliation using `workflow/feedback/PO-FEEDBACK-2026-10-17-001/feedback.yaml`.
