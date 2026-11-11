# Copy local grid values before a read fails

## Developer review
Existing retained-grid backup is now available outside the key-error branch when
local base/plural work, pending save/review or unconfirmed results remain. Uses
the existing translation-work predicate; requires project, keys, live component
and no pending key read. Clean healthy grid does not offer this action. Error
recovery, schema1, filename, allowlist and URL lifecycle stay unchanged. Summary
and download button prevent mouse-down blur; other focus movement keeps existing
blur-save behavior. No save/retry/read/wait or cell mutation in backup handler.

## Product review
Provides a local copy before leaving/reloading, not only after a failed key read.
Copies all currently displayed keys/locales/base/plural values, not only changed
cells or all project keys. Unverified local values, not confirmed saved state or
an import file. Pending work can still finish separately; copy does not wait.
No auto-storage, restore/import feature, navigation/close guard or saved-server
export change. User must check the downloaded file before leaving/reloading.

## Design review
Native collapsed details above grid with selectable JSON, local download and
fixed caveats. Summary names leaving/reloading, not only retry. Mouse-down does
not trigger a blur-save. Desktop/390px inspected: first mobile capture blank
textarea despite actual JSON; fixture resets textarea scroll and waits two paint
frames, updated pixels show JSON/readable scope/nooverflow. No app screenshot fix.
Tall existing toolbar remains, no mobile layout improvement claim.

## Security review
Local JSON only, not uploaded/shared. Existing allowlist includes displayed key,
locale/value/pluralForms; no credentials, account, provider, worker, backend or
new persistence. JSON can contain private text; caveat stays adjacent. Fixed
failure copy fallback and Blob URL cleanup remain. No saved-state guarantee.

## QA/integration review
New12units/fullweb1543/150actualRC0 before finalsummarymousedown addition.
Units cover healthy dirtybase/plural/saving/reviewing/unknown, exactreversion,
clean/loading/empty/noProject/departure refusal and actual Blob parsed value
projection with no save/read/cellchange. InitialwebbuildactualRC0. Focusedfirst/
second/restored8/0. Existing failedgridbackup8/0first, unchanged assertions.
Oldapp1PASS then missingnewsummarytimeout/suiteabortRC1, currentrestored/full logs.
Actual browser dirty edit/summary/download zero requests/no keyerror/exactlocal
base+pluralJSON/revocation/loadingrefusal checked. Finalweb1543/150actual/API265/31cached0;finalbuildsbothcached0afterinitialwebactual0.
APIa/b/c/dpreview6442FA37SAML55allfirstRC0;automations132/0firstactualvia12
separatelypreparedunchangedsourcebundles/tempharnessskiponlyesbuildartifactchecks/
assertionssleepsDBunchanged/fresh55883cleaned. Separate sync95+144239unique first
innerouter0. Nativeinitialfirst116/0thenmiddle57PASSouter1missingretryKeys:
fixturewaitedretainedtextareaalreadyhealthyexists. FixedfixtureONLYwaitactual
retryKeys visible, noassertionremoval/noappfix. Failedcleanupdeletedcheckpoint/
sourcehashchanged, repeatedfirst116/0thenmiddle111/0tail19/0allinnerouter0;
final246total242unique4startuprepeats, originalfirst/failurelogs retained.
Config16/14docs4reaper4first0. All150isolatedbrowser suites firstRC0/1646assertions,
no sourcechanges during sweep. Completedchecks retained across routine pauses;
staged equivalence, no canonical uninterrupted claim. READMEPLANupdated;
finaldocs4/0RC0 and diffcheck clean.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
