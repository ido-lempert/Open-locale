# Comment deletion confirmation

## Developer
Reviewed exact selected key/comment identity, project/branch, project/grid/thread
generations and serialized selected-comment/direct-reply metadata. The capture
includes IDs, parent, locale, body, time, author and mention data. Clearing before
confirmation prevents double submission. Project load, grid clearing, thread
read/close and comment mutation cancel the capture; current loading, errors and
unknown writes still block it. Existing comment-only refresh and recovery remain
unchanged. No application edits were needed after initial implementation.

## Product
Parent comments and replies have a separate cancelable decision with loaded
identity, body, language scope, parent ID and direct-reply count. The warning
matches the API/schema: only the author may delete, a parent deletion cascades
replies including other authors' replies, and deleted comments lose mention
links. Key, translations, screenshots and unrelated comments are not deleted.
Loaded counts are not current server state, permission or a complete impact
scan. No undo promise. Existing thread close/switch still resets the comment
form; this change does not claim to preserve it across closing the thread.

## Designer
Inspected desktop, 390px mobile top/bottom, long escaped metadata and the real
post-delete result. The desktop warning/identity/choices are readable. Mobile
uses vertical scrolling to reach both choices without horizontal overflow. Long
markup-like text wraps and remains plain text. Pointer opening, cancel and
confirm preserve translation focus and do not cause a blur-save. Complete
keyboard/focus-trap accessibility is not claimed by this slice.

## Security
Identity and body render with Angular interpolation, not HTML. Stale/replaced
comments, changed bodies, changed replies and new thread generations reject the
captured decision. Server author-only permission is unchanged and still checked
at deletion; the UI does not claim permission from loaded author data. No new
external destination, worker enablement, registration, spending, credential
change, token-scope change or license choice.

## QA / integration
- 37 new unit cases passed. All 269 configured web-unit paths were deliberately
  split before execution to stay within bounded runtimes: 135 suites / 1622 tests
  in 60.438s and 134 suites / 1477 tests in 58.179s, both exit 0 under the normal
  process-reaping wrapper. Total 3099 tests across nonoverlapping stages, not an
  uninterrupted full run or a seeded whole-web cache.
- Initial focused browser setup aborted with 400 before application assertions:
  the fixture used unsupported member role TRANSLATOR. Corrected to MEMBER and
  used the creation DTO's locale field rather than localeCode. Next run: 14 PASS,
  1 FAIL. A diagnostic rerun confirmed the fixture focused the comment input
  after preserving a translation draft, triggering existing blur-save behavior.
  Refilling only that post-close fixture through local signals avoided an
  unrelated focus change. Application code unchanged; restored run 15/0 exit 0.
- A temporary wrong-ID expectation produced 14/1. A stronger temporary probe
  actually omitted the displayed comment ID from the DOM and produced the same
  targeted 14/1, exit 1. Both removed; restored focused run 15/0 exit 0.
- Real pointer open/cancel makes no request and preserves focused local
  translation, comment text/language/reply target and new-key form. Changed
  selected body or loaded reply body rejects confirmation. Real thread refresh
  and close/reopen reject old captures. Exact reply deletion retains its parent;
  exact parent deletion cascades a real other-author reply and retains the
  unrelated root. Confirmed deletes read only thread data, with no translation
  PUT, comment POST or key GET; local forms and persisted translation stay put.
  The removed reply target clears through existing thread-read behavior.
- Existing comments browser: 13/0 first-run. Recovery initially reached five
  passes then timed out because its actual delete fixture lacked confirmation.
  Adapted its two real-delete decisions; it reached six passes then raced the
  old form during a thread switch. Tightened the fixture wait to the loaded
  Stored B thread and form. Recovery passed 8/0, application unchanged.
- Broad browser sweep: 271 currently passing suites, 3417 PASS / 0 FAIL in their
  final logs. 270 suites passed first-run. Suite 041 initially aborted before
  application checks because PostgreSQL port 55588 was in use. Socket inspection
  found a TIME_WAIT connection from 55588 to API port 3000, not a listener. After
  expiry, the unchanged same-port retry passed 14/0, exit 0. Initial abort log
  retained. Every browser suite ran in its own call.
- API legs passed, including sync preview 644, automations 132 and 2FA 37.
  Two batch entries used nonexistent npm names docker-static/api-tokens; correct
  docker/apitokens commands passed 23/34 checks. No application failure hidden.
- Sync browser stages 95 + 144 = 239; native UI stages 116 + 111 + 19 = 246,
  all first-run exit 0, each stage in its own call. Native needed no adaptation.
- Build passed with actual web compilation. API unit cache, docs 4, sync-stage
  configuration 16, native-stage configuration 14, reset harness 3, process runner
  4 and changed-script syntax/diff checks passed again before publication.
  Final build was 2/2 cached, exit 0; final API unit cache exited 0.

Coverage stays 22 FULL / 7 PARTIAL / 1 MISSING, with workers off. External
runtime/receiver/CDN, real provider/SSO and accepted GitHub two-way remote-write
acceptance gaps remain outside this comment confirmation change.
