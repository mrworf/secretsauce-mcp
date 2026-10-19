# M38 acceptance

One presentation slice. Parent 12436b3d3b16d727dd14bd3b6a5069856954a35a. Source and planning remain unchanged; implementation commit recorded by parent acceptance. Production only changes review summary rendering and list styling; no backend/API/storage/permissions or runtime scanning changes.

| Criterion | Concrete evidence | Result |
|---|---|---|
| Zero/one/many before approval, both tabs | final/browser-report.json; no-exceptions-desktop, one-exception-desktop, new-desktop, changes-desktop; visibleExceptions asserts every actual safe label and no rejected text | PASS |
| Same risk scope/identities, TLS inheritance/override/mixed protocol | focused console-service-approval 7 cases; unchanged serviceExceptionLabel used directly by both surfaces; browser three actual server risks equal modal label meanings | PASS |
| Reading does not acknowledge; missing/partial/extra/forged/stale rejected; dialog recovery | focused exact-original acknowledgment test; browser unchecked/partial/reopen, stale renewal, pending duplicate prevention, successful atomic apply, lost-response status inspection and role loss | PASS |
| Safe labels and other risks/recovered restrictions | focused own-property/duplicate/internal-name/HTTP/defaultallow/recovered label cases; browser malicious HTML-like label inert and userinfo/query/fragment absent in bullets and modal; full regression preserves recovered Owner restriction | PASS |
| Actual layout/keyboard/narrow/text enlargement | final screenshots and visual-review.md; actual Chromium HTTPS, viewport/text-range overflow assertions, keyboard navigation and modal focus/cancel | PASS |

No new external input. Focused tests reuse existing tested risk semantics and server enforcement; new executable browser assertions qualify the actual new presentation. External LLM connectivity exception remains; no live deployment or Docker recovery drill required by this presentation-only scope. No required work deferred.
