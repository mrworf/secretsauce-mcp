# Supporting design-pattern research

This reference note answers the requested research task. It does not classify product defects, choose a new design, amend product authority, or override the feedback YAML. Sources were consulted during this debrief; applicability remains for downstream Product Reconciliation/UX work.

| Topic | Documented pattern | Primary reference |
| --- | --- | --- |
| Current values and editing | Carbon documents prefilling known values and editing in place to avoid separate-page navigation. It also says inline editing varies by product and has no single consolidated rule. This supports considering fewer steps; it does not establish that every setting should autosave or bypass review. | [IBM Carbon forms](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms) |
| Required fields | Carbon distinguishes simple forms from complex configuration forms and recommends consistent required/optional labeling based on which fields predominate. A red asterisk is one possible mechanism from the feedback, not a universal requirement established by research. | [IBM Carbon forms](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms) |
| Short field explanations | GOV.UK recommends brief hints for help relevant to most users and associates hints with inputs through accessible descriptions. Long instructions do not belong in every field hint. | [GOV.UK text inputs](https://design-system.service.gov.uk/components/text-input/) |
| User list and account detail | Auth0 documents selecting a user from User Management → Users to view that user's profile. This is a real SaaS list-to-detail example, not evidence for changing this product's role permissions. | [Auth0 user profiles](https://auth0.com/docs/manage-users/user-accounts/user-profiles) |
| Horizontal layout | PatternFly documents primary-detail layouts with a list beside the selected item's details. It is a candidate reference for using width, not a selection of a drawer, split view, or fixed form width for this product. | [PatternFly primary-detail](https://www.patternfly.org/patterns/primary-detail/design-guidelines/) |
| Clear language | Atlassian emphasizes clear, consistent content and active voice. Terminology needs to be understandable in its audience's context. | [Atlassian language and grammar](https://atlassian.design/foundations/content/language-and-grammar) |

## Research limits

The cited patterns support evaluating populated forms, concise hints, consistent required markers, and list-to-detail management. They do not settle SMTP encryption support, Administrator authority, account metadata definitions, or this product's save/apply semantics. The reports of overlap, undefined values, apparently unsaved backups and stale diagnostics are preserved as Product Owner observations; no code or runtime investigation was performed in this debrief. No universal claim that a separate view/edit mode is always wrong is made.
