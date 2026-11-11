# Preserve translation work when choosing branches

## Developer review
Both disabled native select and branch handler guard dirty value/plural forms,
pending save/review and needsReload, including equal-value unconfirmed state.
No key read, branch mutation or feedback clearing occurs on refusal. Clean
superseding branch reads remain allowed while an earlier read is pending or
failed. Branch handler keeps prior generation fencing. Native rejected event
restores actual select value as well as retaining component branch. No storage,
backend, automatic save/retry or reload change.

## Product review
Protects branch picker only, not filters, other navigation or browser reload.
Existing blur save stays; wait for confirmation or save draft explicitly. After
an unconfirmed result, copy retained values before an explicit reload. Does not
promise that reload preserves drafts. Equal saved text alone is not enough
when result is unknown. Other local form edits are outside this translation
work guard, not broadly protected.

## Design review
Fixed adjacent guidance and conditional aria-describedby; native disabled state.
Actual desktop390px pixels caught a rejected synthetic event displaying main
while component stayed release. Fixed picker restoration, added UI and unit
assertion, reran focused10/0 and inspected updated screenshots showing release.
Guidance readable/wrapped/no overflow. Toolbar is taller and grid below mobile
fold, not a mobile layout improvement claim.

## Security review
Local data-loss guard, not server authorization. Forced disabled change and
captured method refuse. No private values in URL/logs, no new write, account,
worker, provider, credential, storage or external disclosure. Existing scope
fences remain; no global protection or permission change.

## QA/integration review
Initial9units/fullweb1499/147first0 and initialwebbuild0. Firstfocused10/0 but
visual review found incorrect displayed picker after synthetic refused change;
app pickBranch restoration added plus strengthened branch-state/UI assertions.
Second10/0. Existingkeys14/0firstafterfixtureupdate: revert intentionally injected
retained draft before clean superseding read; explicit reload triggers failed
read with dirty draft instead of unsafe branch switch. Retry reads same main,
then explicit clean feature switch; all original error/inert/late-response checks
retained. Newpickerunit adds10total/finalfullweb1500/147actual/API265/31cached. Finalbuilds0
APIcached/webactual afterinitialwebbuild0. Oldapp0PASS then missingblockedguidance
timeout/suiteabort; currentrestored10/0/full logretained. APIa/b allfirstRC0.
APIc/d/preview6442fa37SAML55allfirstRC0;automations132/0firstactualvia12
separatelypreparedunchangedsourcebundles/tempharnessskiponlyesbuildartifactchecks/
assertionssleepsDBunchanged/fresh55871cleaned. Separate sync95+144239unique/
native116+111+19246total242unique4startuprepeat eachfirstinnerouter0/config16/14/
docs4/reaper4all0. All147isolatedbrowser suites finalRC0/1610assertions,145firstactualRC0/no sourcechanges.
Before018 shellredirectiontypo preventedlaunch; correctedbeforeitsfirstactual36/0.
049first0PASSPGbind55684abort;096first0PASSPGbind55738abort. Each actualbind
unavailable7timesat5s thenavailable/unchangedsecond7/0and11/0/full logs retained.
Completedchecks preserved through routinepauses/stagednotuninterrupted.
READMEPLANupdated/finaldocs4/0RC0/diffcheckclean.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
