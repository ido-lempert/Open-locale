# 0514 Local key-name narrowing of loaded saved-text matches

## Developer review
Computed visible rows derive from loaded results and a bounded local input.
Saved-value server query/count remains unchanged. Clear/scope/new-search resets
local text, and filtering makes no request. Download projects all loaded rows.
Review added generation advancement on local edits to fence held clipboard
feedback and visible-row copy guard to refuse a captured hidden-row handler.
Pending clipboard operation stays serialized; no network abort or cancel claim.

## Product review
Find a key within a long saved-value result list without running another query.
Explicit visible/loaded count and local-only description distinguish it from
server value search. Empty local filter restores loaded rows; no-match wording
points to Clear key-name filter. JSON still includes all loaded matches regardless
of local narrowing, explicitly labeled; not a filtered export or import file.

## Design review
Actual desktop390px pixels inspected: input, clear button, visible/loaded count
and download scope readable/wrapped without horizontal overflow. Taller mobile
results still require scrolling. Local filtering adds no automatic focus move.

## Security review
Only already-loaded key names, literal substring/interpolated output. No added
read/write/upload/audience/credentials/settings/workers/spend/license change.
Hidden rows remain loaded and are included in report, explicitly disclosed.
Filtering is not a privacy-erasure control. Copy guard and stale-feedback fence
review fixes covered by units. Scope/new-search clearing removes old private rows.

## QA/integration review
New11units/finalfullweb1432/141 passed after review fixes; initialwebbuild0.
Firstfocused0PASS400fixtureabort: key create rejects punctuation/space markup
names. Corrected fixture creates valid placeholder keys, then explicitly sets
hostile names through local Prisma DB fixture (not accepted create behavior).
Second/restored15/0;oldapp intentional0PASS missing local-count selector abort,
current restored/full logs retained. ActualPG persisted rows, literal case and
punctuation/spaces, not value search, visible/loaded count, no requests/writes,
reportBlob parsed/all3rows under1visible, clear/newsearch reset/mobile/runtime.
APIa/b/c/dpreview6442fa37SAML55firstRC0;automations132/0firstactual via12
unchanged-sourcebundlesseparatelyprepared/tempharnessskiponlyesbuildwithexistence
checks/assertionssleepsDBunchanged/fresh55845cleaned. Finalbuilds0bothcached.
Separate sync95+144239unique/native116+111+19246total242unique4startuprepeat
eachfirstinnerouter0/config16/14/docs4/reaper4all0. All141 isolated browser suites complete,1539 passing assertions;140firstRC0.
129download first timed out after9PASS/no failed assertions/no finalRC. Surviving
page showed enabled Search and previous empty result, not pending: mobile click
did not submit. Fixture centers Search before final click and bounds held-request
wait10s, no app change. Rerun0PASS stalePGsocketlockabort tied to confirmed
zombiePID33987; verified no listener/zombie state, removed that stale socket/lock.
Third12/0RC0. All full logs retained; completed checks preserved against unchanged
app source. Staged through routine pauses, not uninterrupted. Finaldocs4/0/diff
check clean. Coverage22FULL7PARTIAL1MISSING/
defaultOFF unchanged.
