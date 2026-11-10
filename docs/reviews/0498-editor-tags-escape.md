# 0498 Keyboard local tag cancellation

## Developer review
Template Escape prevents default and calls the existing guarded local cancel.
No new mutation path or handler logic. Enter/blur saves are unchanged. Scoped
key-cell wrapping/max-width keeps adjacent desktop controls out of translation
columns; mobile full-width tags remain unchanged.

## Product review
Keyboard users can cancel the focused tag field directly without leaving its
blur-saving field. Cancel tags (Esc) names the shortcut; input title explains
Enter/leave saves and Escape cancels. Cancel discards only local tag text, not
saved tags or translation drafts; reopening starts from loaded saved tags.

## Design review
Initial actual desktop pixels showed nearby controls crowded/partly covered by
translation column. Scoped wrapping/max-width fixed it. Rebuilt/retested and
inspected final desktop/390px pixels: controls, focused tag and retained
translation readable. Desktop compact input scrolls long text; mobile full-width.

## Security review
Reuses current loaded healthy key/editor/no pending-unknown tag write/deletion/
departure cancel guard. Escape does not bypass submitted-write boundaries or
submit tags. No endpoint/storage/auth/dependency/license/registration/spend/
worker/credential change. Existing Enter/blur submission remains separate.

## QA/integration review
No new units for template event; existing web1306 in126/API265 in31/builds0
(APIcached), full rerun0 after design fix. New browser4/0 initial/design rerun/
sweep: actual focused Escape zero requests/no blur save, translation/loaded tags
kept, reopening uses saved tags rather than canceled text, runtime. Intentional
oldapp2PASS2FAIL: Escape left editor open and reopen kept discarded local text;
full log retained. All API first-attempt0/125 isolated browsers final0.
Suite099 tasks-retained-options first preassertionPG55750 bind abort0PASS,
TIME_WAIT observed, unchanged delayed11/0/no app-test fix/full log retained.
Other browser suites first-attempt0. Separate sync95+144=239unique/native
116+111+19=246total242unique/four startup repeats, every stage inner/outer0
first attempt. Config16/14/docs4-138routes/reaper4 all0. Completed checks
preserved across continuations; staged, not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
