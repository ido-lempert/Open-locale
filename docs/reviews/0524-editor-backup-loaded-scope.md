# Local backup identifies its last successful grid read

## Developer review
Capture project, branch and effective key search/tag/status/status-locale from
one request snapshot. Install only with a current successful key read, including
empty results. Failed/late/destroyed reads cannot replace it. Successful grid
replacement updates it; toolbar changes alone do not. The read's status locale
is null when no status filter was sent, not the import/export locale. Schema2
adds loadedGridScope and scopeMeaning; existing kind/value allowlist/filename/
URL cleanup stay. No extra requests, backend or persistence. Null scope means
unavailable, never inferred from toolbar. Top-level projectId still identifies
the current editor; loadedGridScope.projectId identifies the captured read.

## Product review
A failed superseding branch/filter read may retain older grid cells. Download
now identifies that last successful read instead of implying current toolbar
choices describe it. Local base/plural values remain unverified, not confirmed
saved, not an import file or all project keys. Scope does not certify each value
or a consistent database snapshot. Not a timestamp, full history, restore/import
feature or navigation guard. Existing pending work may finish independently.

## Design review
Adjacent native text names last successful branch/effective filters, explains
it can differ from current toolbar, and does not confirm saving. Explicit
unavailable fallback. Desktop/390px pixels inspected readable/wrapped/no document
overflow. Existing tall toolbar remains. First focused fixture clicked collapsed
details after loading destroyed it; fixture explicitly reopens the native
summary after failed read, no app fix. Textarea remains value-only; scope is
adjacent and included in downloaded JSON, not pasted into translation values.

## Security review
Only project/branch/effective filter strings already used in the read are added.
Angular text interpolation/JSON serialization, no HTML rendering or arbitrary
API object dump. No new sharing/upload, credentials, registration, worker,
license, spend or token scope. Local file may contain private translation/filter
text; adjacent private-text warning retained. Scope is not save or import authority.

## QA/integration review
New9units/fullweb1552/151actualRC0;initialwebbuildactual/APIcachedRC0.
Tests cover exact effective scope, no false locale filter, pending toolbar change,
failed replacement, old success/failure fencing, empty success, destroyed reply,
and no successful read. Existing actual Blob test asserts schema2/null scope.
Focusedfirst6PASS then collapsed-details click abort; corrected fixture only.
Second/restored11/0. Oldapp5PASS2FAIL then missingnewscopeelementabortRC1;
current restored/full logs retained. Strengthened realfailed-scope check to demand
explicit main/alpha, not two undefined values comparing equal, before restoredrun.
Actual filtered grid/local draft/plural download, failed real branch read retaining
prior scope/local values, zero action requests, actual Blob revoke, mobile/runtime.
APIa/b/c/dsyncpreview6442FA37SAML55allfirstactualRC0. Setup test:preview typo
launched no suite, corrected sync-preview firstactual644/0. Unused automation
bundle filename corrected/removed before actual launch. Automations132firstactual0
via12separatelypreparedunchangedsourcebundles/tempharnessskiponlyesbuildartifact
checks/assertionssleepsDBunchanged/fresh55887cleaned. Separate sync95+144239unique
firstinnerouter0;native116+111+19246total242unique4startuprepeats eachfirstinnerouter0.
Finalweb1552/151actual/API265/31cached0;finalbuildsbothcached0 afterinitialwebactual0.
Config16/14/docs4/reaper4first0. All151isolatedbrowser suites firstRC0/1657assertions,
no sourcechanges during sweep. Completedchecks retained across routine pauses;
staged equivalence, no canonical uninterrupted-run claim. Finaldocs/diffcheck beforepush.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/externalacceptance gaps unchanged.
