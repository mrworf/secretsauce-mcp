# Shared service header

Base revision `68dcc36`. Overview, Configuration, Access and Activity currently use different service headings and some omit revision or lifecycle.

## Slice 1

Render one shared header for all four tabs, with the service name, adjacent lifecycle and draft badges, revision or no-current-configuration text, Services back link and tab navigation. Use the applied service name when available, then the saved draft name. Preserve the existing unsaved-editor guard, link behavior and service-scoped Activity query. Global Activity keeps its own heading.

Own shared header rendering, focused styles and existing service/Activity browser coverage. Verify that all tabs agree in the synthetic HTTPS browser and that enlarged text reflows without hiding status. Build and commit the slice.

## Result

Build and the isolated HTTPS browser scenario passed. The browser checked all four tabs with active and archived services, consistent revisions, current-tab markers and title focus. The 390px Activity screenshot was inspected, and the existing 320px/200% Activity text-width checks passed.
