# Keep grid read scope visible when tools are hidden

## Developer review
Pure template/CSS over existing captured loadedGridScope signal. Only renders
when tools collapsed, with explicit unavailable fallback. No state assignment,
read, write, schema, toggle-default or lifecycle change. Captured scope still
installed only by current successful key reads, not toolbar changes. Existing
read errors/loading remain visible outside toolbar. Scope describes the last
successful read, not a pending or failed requested branch/filter.

## Product review
Hiding tool controls also hides branch and filters, so clean grid rows previously
lost their visible scope anchor. Compact text names successful branch/search/tag/
status/status-locale, explicitly not save confirmation or current toolbar choices.
Unknown scope is not inferred. This is read scope, not per-value provenance or
snapshot consistency. Null status locale means not applied, not export locale.
No restoration, newer read, navigation guard, automatic refresh or saved-state
claim. Local backup keeps its own adjacent caveats when expanded.

## Design review
Native paragraph above hidden toolbar/grid, removed when tools reopen. Clean
and failed-read desktop/390px inspected readable/wrapped/no document overflow.
Clean390px grid begins within viewport. Extended test caught real160char tag
overflow; component-local overflow-wrap:anywhere fixes it. Literal markup stays
text, long tag wraps. Long-scope screenshot uses injected fixture state, not
server acceptance evidence. Existing toolbar and backup controls unchanged.

## Security review
Angular text interpolation only, never innerHTML. No arbitrary data-object dump,
new requests/persistence, private sources or account credentials. Existing scope
contains read filters and branch, already visible in tools. Browser verifies
literal img markup yields no image node; no upload/share/worker/spend/license/
credential scope change. Scope does not authorize mutation or confirm saving.

## QA/integration review
No new TypeScript behavior; real browser exercises template branches and CSS.
Initialwebbuildactual/APIcached0. Focusedfirst16/0. Oldapp2PASS then new selector
timeoutabortRC1/currentrestored/full logs. Extendedrestored17PASS1FAIL unbroken
filter overflow, app CSS fixed; fixed/final18/0 twice. Actual clean filteredread,
hide tools, grid scope main/alpha, failed superseding real branch read keeps
prior scope and localbase/pluralvalues, zero backupactionrequests, Blob revoke,
unknown fallback, reopen keeps current choices/runtime. Injected fixture-only
long literal markup/status-locale checks prove escaping/layout, not API acceptance.
Fullweb1555/152actual/API265/31cached0;finalwebbuildactual/APIcached0 afterinitial
webactual0. APIa/b/c/dsyncpreview6442FA37SAML55firstactual0;automations132firstactual0
via12separatelypreparedunchangedsourcebundles/tempharnessskiponlyesbuildartifact
checks/assertionssleepsDBunchanged/fresh55895cleaned. Separate sync95+144239unique/
native116+111+19246total242unique4startuprepeats eachfirstinnerouter0. Config16/14/
docs4/reaper4first0. All153isolatedbrowser suites firstRC0/1685assertions, no source
changes during sweep. Completedchecks retained across routine pauses; staged
equivalence, no uninterrupted-run claim. Finaldocs/diffcheck beforepush.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/externalacceptancegaps unchanged.
