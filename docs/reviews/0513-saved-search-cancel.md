# 0513 Cancel a pending saved-text search

## Developer review
Guarded local cancellation uses the existing clear/generation fence and deferred
text focus. Filters and branch/locale remain exact. Older success/failure/finally
cannot replace results or settle a newer pending read. Idle/unready/departed
handlers refuse. No request abort claim; no backend or report/copy schema change.

## Product review
Cancel differs from Clear search filters: stop waiting without re-entering the
query, status, tag and match mode. Only pending reads offer it. Explicit new Search
is needed afterward; no automatic retry. No translations change.

## Design review
Actual desktop and390px screenshots inspected: pending button and honest scope
fit readable/wrapped without horizontal overflow. Keyboard Enter cancels and
focus returns to text after render. No screen-reader acceptance certification.

## Security review
No requests/writes/uploads/audience/credentials/settings/workers/spend/license
changes. Pending private results remain cleared; held late canceled success and
failure cannot revive them. A canceled request may still finish on the network.

## QA/integration review
New8units/fullweb1421/140 passed; initialwebbuild0. Firstfocused7PASS then timeout
waiting actual result: fixture used tag PATCH which trims spaces, but exact query
kept spaces. Fixture creates exact spaced tags through existing create input;
no app fix. Second/restored14/0. Oldapp intentionally0PASS2FAIL (missing pending
cancel check then absent cancel scroll abort); current restored. Full logs kept.
Actual PostgreSQL persisted match after explicit search, six retained filters,
keyboard focus, same oneGET/no cancel requests, held late private success/failure,
old reply during newer read, mobile/runtime and zero writes. APIa/b/c/dpreview6442fa37SAML55firstRC0;automations132/0RC0firstactual
via12separatelypreparedunchanged-sourcebundles/tempharnessskipsonlyesbuildwith
existencechecks/assertionssleepsDBunchanged/fresh55841cleaned. Bothbuilds0cached
afterinitialwebbuild0. Separate sync95+144239unique/native116+111+19246total
242unique4startuprepeat eachfirstinnerouter0/config16/14/docs4/reaper4all0.
All140 isolated browser suites firstRC0,1524 passing assertions/no failed
assertions/source changes. Completed checks preserved through routine pauses;
staged, not uninterrupted. Final docs consistency4/0RC0 and diff check clean.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
