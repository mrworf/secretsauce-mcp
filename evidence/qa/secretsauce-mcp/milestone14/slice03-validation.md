# M14 slice 03 local validation

Result: PASS (local implementation verification; PRE-015 real platforms unverified).

`npm run build` passed. Related command passed 49 tests across six files:

`npx vitest run test/managed-external-oauth.test.ts test/console-authentication.test.ts test/managed-oauth.test.ts test/console-clients.test.ts test/console-migration.test.ts test/console-service-runtime.test.ts`

Loopback listener permission was used after sandbox EPERM. No listener assertions were weakened.

Coverage includes Owner scoped draft/review/recent MFA, malformed fields/confirmation and stale dependencies, CSRF/Origin and non-Owner/read-only denial, audit outage, committed uncertain completion publication, write-only bearer omission/preservation, mode/key continuity, managed startServer with stale configured refresh path and hash-only current refresh continuity, queued bearer body fencing, real signed JWT/JWKS verification with registry disable/re-enable race, exact issuer/subject mismatch and service assignment separation, namespaced principal claims/RFC scope characters and explicit inactive imported authentication proposals. Existing issuance/refresh signing, replay/revocation, service publication and migration regressions pass.

Apply invalidates client state in one bounded pass with unique subject callbacks and one secondary snapshot publication. Persisted authentication revision fences older snapshot families after restart. Actual rendered UX/browser and full regression evidence belong to slice 04. This record contains no tokens, credentials, cookies or raw downstream bodies.
