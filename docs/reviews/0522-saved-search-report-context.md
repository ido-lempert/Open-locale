# Keep loaded context in saved-search reports

## Developer review
Schema2 adds explicit contextScope and countsScope; row projection stays an
allowlist, never spreads response objects. Status is the matched locale's loaded
saved status. Description/tags and counts are loaded key-wide context. Existing
normalization retains null unavailable versus empty strings/arrays and zero.
No new reads, server changes or download lifecycle changes. All loaded matches
remain included even when the local key-name filter hides rows.

## Product review
Makes downloaded review context match already visible context without claiming
newer state. Schema version increments to2 for changed report shape. Not a full
project export, import file, plural report or live review confirmation. Counts
are not matching-locale counts and do not include comment/screenshot contents.
The report can contain private translation/context text; it stays a local
browser download, not an upload/share. Existing filters and scope remain.

## Design review
Adjacent download scope states new fields, version2, null/empty distinction and
contents exclusion. Desktop/390px pixels inspected: readable and wrapped, no
overflow. Larger caveat paragraph on mobile remains, no layout improvement claim.

## Security review
Explicit projection excludes arbitrary response fields, comment bodies,
screenshot URLs/bytes, plural forms and extras. Literal HTML-like text stays JSON
text, not markup. JSON is not CSV; no spreadsheet formula execution claim.
No new account, credential, worker, provider, storage or external disclosure.

## QA/integration review
New11units/fullweb1531/149actualRC0, initialwebbuildactualRC0. Units cover
version/scopes/allowlist, unavailable/empty/zero/invalid counts, local hidden rows,
post-read source mutations, and clear/query/locale/branch/destruction refusal.
Firstfocused15PASS1FAIL because fixture expected spaced tags but existing tagAPI
trims. Corrected stored-value expectation only, no appfix. Second/restored16/0.
Oldapp11PASS5FAILRC1 on schema/projection/context checks; currentrestored/full
logs retained. Actual downloaded JSON includes loaded persisted metadata despite
later server changes, includes hidden local rows, no extra APIread/write, no
comment/screenshot contents. Screenshotcount fixture is DBmetadata only, not an
upload acceptance claim. APIa/b/c/d,preview644,2FA37,SAML55allfirstRC0. Automations132/0firstactual
via12separatelypreparedunchangedsourcebundles/tempharnessskiponlyesbuildartifact
checks/assertionssleepsDBunchanged/fresh55879cleaned. Separate sync95+144239unique/
native116+111+19246total242unique4startuprepeats eachfirstinnerouter0/config16/14/
docs4/reaper4firstRC0. Finalunitsweb1531/149andAPI265/31bothcached0afterinitial
actualweb0;finalbuildsbothcached0afterinitialactualwebbuild0. All149isolatedbrowser
suites firstRC0/1638assertions, no sourcechanges during sweep. Completed checks
preserved across routine pauses; staged equivalence, no canonical uninterrupted
claim. READMEPLANupdated; finaldocs4/0RC0 and diffcheck clean.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
