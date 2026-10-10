# M11 slice 02 evidence

Focused checks: `npx vitest run test/console-service-runtime.test.ts test/console-services.test.ts test/console-admission.test.ts test/tokens.test.ts test/response-tokenizer.test.ts` — 52/52 passed across five files; build passed. The sandbox reported `listen EPERM`; the identical command was rerun with loopback permission. Listener tests were preserved.

Real HTTP queued-body cases begin with a valid assigned external subject and issued credential reference, wait until the bounded body reader is installed, then rotate, revoke or apply a denying policy before delivering remaining bytes. Every case rejects with zero downstream calls. Delayed real downstream responses exercise rotation and access removal after dispatch: admitted old credentials are protected, removed configured references remain invalid, and completion cannot allocate live response references. The occupied limiter remains occupied across publication. Broker/scanner/limiter instances survive; unrelated configuration is retained. Service request audit contains admitted revision.

Write-only create/replace/delete covers versions and missing/dependency/error cases; values absent from detail/review metadata. Lifecycle covers immediate disable/archive, unarchive Disabled and fresh review requirements. Stale initial/current grant and current identity/role checks cannot revive eligibility. Failed completion after durable apply reports uncertain while committed state is published for operation/current-state reconciliation.

Prototype-like IDs constructor/toString are explicit own records, forged inherited lookups fail, and pre-existing namespace/underscore service/credential identifiers remain readable/editable/rotatable. Durable immediate events identify affected credential/version or identity using sanitized metadata. M10 audit/admission regressions retained.

Fixture correction: an early request observer consumed initial stream bytes before authentication's body reader; the corrected test observes reader installation without consuming bytes. This was a test fixture defect, not a production change.
