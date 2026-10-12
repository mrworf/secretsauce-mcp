# Design-pattern basis

Accessed 12 October 2026. Primary sources inform the recommendation; they do not establish this product's permissions or activation semantics.

| Source | Observed convention | Bounded use here |
| --- | --- | --- |
| [IBM Carbon forms](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms) | Group related inputs, prepopulate known values, use concise labels and consistent required/optional marking. Inline editing is context-dependent. | Populated settings forms remove redundant steps; red asterisk plus legend is this proposal's consistent indicator, not a universal mandate from Carbon. |
| [GOV.UK text input](https://design-system.service.gov.uk/components/text-input/) | Brief hint text can explain an input and be associated through accessible descriptions. | Put useful purpose/units guidance under non-obvious controls rather than in hidden tooltips. |
| [Shopify Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api) | Contextual saving and leave confirmation make unsaved changes explicit. | A visible state/action area and navigation guard. Shopify's pattern does not justify bypassing this product's reviewed activation. |
| [Auth0 user profiles](https://auth0.com/docs/manage-users/user-accounts/user-profiles) | Administrators select a user from the user list to inspect the profile. | Compact account list leading to account details. Permission and timestamp semantics come from this product's contracts. |
| [Atlassian language and grammar](https://atlassian.design/foundations/content/language-and-grammar) | Clear, consistent language and active voice support comprehension. | Plain labels and explicit action/result language; technical names stay in help where needed. |

The recommendation is deliberately not “every setting autosaves” or “all pages must always be forms.” Forms suit authorized configuration work; health/jobs remain status views, account metadata remains read-only, and immediate security actions retain confirmation. Changing terminology alone cannot fix stale data or persistence defects; downstream acceptance must verify loaded, saved, applied and restarted values.
