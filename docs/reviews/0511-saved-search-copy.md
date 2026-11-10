# 0511 Copy one loaded matched value

## Developer review
Copy resolves an ID against current successful loaded results and sends only that
row's value to the clipboard. No source/description/status/JSON projection copied.
Readiness guards block absent, pending, failed and departed scopes. Pending write
is serialized even across a new search, preventing two overlapping writes in this
component. Clear/new search/scope edits fence stale notice, not the OS operation.
Review caught an initial pending reset on scope changes before focused browser;
removed it and added an overlapping-new-search unit test. No automatic copy.

## Product review
A user can reuse one translation without downloading all matches. Private-text
clipboard notice states clear/departure cannot cancel a started operation or clear
the clipboard. Success appears only after browser write fulfillment; fixed failure
asks for manual selection/copy. Loaded text only, not newer server confirmation.
Clipboard support/permission depends on the browser. No hidden fallback or retry.

## Design review
Actual desktop390px pixels inspected. Copy is directly below matched value, separate
from source and description. Labels and literal multiline/RTL-containing text wrap
without horizontal overflow. Feedback is a status message; tall results can scroll.
Native button, disabled during pending. Not screen-reader acceptance certification.

## Security review
Explicit click only; no reads/writes to API, upload or new audience. Copies only
already loaded matched value, preserving spaces/newlines/markup literally. Fixed
failure never includes exception text. Clearing/private-scope changes drop feedback
and controls but cannot undo an already requested clipboard write. Pending lock
survives new search until settlement. No credentials/worker/spend/license changes.

## QA/integration review
New14units/fullweb1408/138/API265/31cached/builds0bothcached after initialwebbuild0.
Focused first0PASS timeout before clipboard-success signal: fixture granted wrong
Chromium write permission; changed to clipboard-sanitized-write/read. Second11PASS
1FAIL immediate disabled-DOM check before Angular render; added actual disabled
wait, no app change. Third12/0 and restored12/0. Full logs retained. Intentional
old-app0PASS absent copy-control abort. Actual browser clipboard readback equals
matched value with leading/trailing spaces,newline,markup,RTL, excluding source and
description; no extraGET/write. Intercepted denial fixed feedback, held clipboard
serializes new result/duplicates, late success after new search/clear fenced. Mobile
and runtime checked. APIa activity first and second0assertion PostgreSQL bind55438 startup abort,
loopbackTIME_WAITto55437 verified; waited actual bind success, unchangedthird32/0,
no app/test change/full logs retained. Other APIa/b/c/dpreview6442fa37SAML55first0.
Automations132/0firstactual via12 unchanged-source separately prepared bundles/temp
harness skiponlybundling with existencechecks/allassertionssleepsDBunchanged,
fresh55833cleaned. Separate sync95+144239unique/native116+111+19246total242unique
4startuprepeat eachfirstinnerouter0. Config16/14/docs4-138routes/reaper4all0.
All138 isolated browser suites first-attemptRC0,1498 passing assertions/no
failures or source changes. README/PLAN updated; final docs check passed4/0 before
commit/push. Completed results preserved through routine pauses, staged not
uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
