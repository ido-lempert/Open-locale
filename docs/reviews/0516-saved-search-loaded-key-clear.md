# 0516 Keyboard reset of the local key-name filter

## Developer review
Shared guarded reset for the existing button and focused Escape. Uses the
existing local filter setter and deferred generation-bound focus helper, with
a dedicated conditional ViewChild. No duplicate request path or server change.
Empty/unready/pending/departed handlers refuse. Scope/project/departure clear
scheduled focus; new searches and local edits invalidate its generation.

## Product review
Restores all current loaded matches and focuses the local key-name input, not
the saved-value query. Keeps saved query, branch, locale and loaded snapshot.
No server refresh, translation edit, clipboard write or report change.

## Design review
Actual desktop and 390px pixels inspected: visible local-input focus outline,
readable wrapped controls/count text, no horizontal overflow. Tall page still
scrolls. Added visible (Esc) button hint after initial pixel inspection; final
updated screenshots inspected readable/no overflow. Escape is local input only, not global shortcut.

## Security review
No request/write/credential/audience/storage/worker change. Existing guarded
loaded-state and generation checks prevent stale captured handlers/focus from
acting after scope changes or navigation. Does not retain new private data.

## QA/integration review
New9units/fullweb1451/143 and initialwebbuild0. Focusedfirst/restored11/0 with
no fixture/app fixes; actual focus via button, focused Escape/repeated empty,
390px Enter button activation, same query/scope, all loaded rows restored,
zero extraGET/writes and same-event query edit preventing deferred focus.
Oldapp1PASS then intentional focus-wait timeout/1suiteabort, full log retained;
current restored. Hostile key names use direct DB fixture, not key-create API
acceptance. Final template-hint fullunits web1451/143/API265/31cached, final
browser11/0/builds0(APIcached/webactual). APIa/b/c/dpreview6442fa37SAML55first0;
automations132/0firstactual12unchanged-sourcebundlesseparatelyprepared/temp
harnessskiponlyesbuildwithexistencechecks/assertionssleepsDBunchanged/fresh55853
cleaned. Separate sync95+144239unique/native116+111+19246total242unique4startup
repeat eachfirstinnerouter0/config16/14/docs4/reaper4all0. All143 isolated
browser suites firstRC0,1563 passing assertions/no failures/source changes.
Completed checks preserved across run pauses, staged not uninterrupted.
README/plan updated; final docs check4/0RC0 and clean diff check.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
