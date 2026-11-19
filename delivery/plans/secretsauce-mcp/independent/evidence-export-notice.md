# Evidence export confirmation

Base revision `6b58734`. Scope is the evidence export confirmation reported during the M46 walkthrough. The shared banner survives console navigation, which makes a completed export appear unrelated to the current screen.

## Slice 1

Attach the confirmation to the export action on its originating screen and provide a keyboard-accessible Dismiss action. A completion arriving after navigation still delivers the file but does not write feedback into the new screen. Keep the existing error reporting on the originating screen and preserve export permissions, audit admission and download format.

Own the evidence page and existing M46 browser scenario. Verify download confirmation, dismissal and navigation in the disposable HTTPS fixture, then build and publish one slice commit. The existing M46 suite covers all four export locations and role gates.

## Result

Build and the M46 HTTPS browser scenario passed, including dismissal, focus return, navigation cleanup, exports and role checks.
