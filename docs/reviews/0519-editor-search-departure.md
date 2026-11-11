# Editor saved-search departure guard

## Developer review
A button uses a handler that independently rechecks readiness before Router
navigation. Optional Router injection preserves existing direct-construction
unit harnesses; normal app navigation is exercised by a real browser. Reuses
translation-work guard; adds project/current-branch and bulk/import pending
checks. Carries branch only. No action-owned save, retry or reload. Existing
blur-save behavior remains. Replaced linked-branch fixture's href inspection
with the actual navigated URL because this is now a button, not a new-tab link.

## Product review
Protects this one departure action when translation drafts, plural edits,
pending saves/reviews or unconfirmed results remain. Does not preserve drafts,
protect other navigation, browser close/reload or edits in other forms. Disabled
copy states that other navigation is not protected. User must save drafts/wait
or copy retained values before choosing reload after an unknown result.

## Design review
Native disabled button with fixed adjacent guidance and conditional
aria-describedby. No modal or implied successful save. Actual desktop390px
pixels inspected: readable, wrapped guidance, no horizontal overflow. Existing
mobile toolbar is tall and grid remains below the fold; no mobile grid layout
improvement claim. Clean action accepts keyboard Enter in actual390px browser.

## Security review
No text/translation values in navigation, only current validated branch.
Handler refuses forced stale click as well as disabled UI activation. No new
write, backend, storage, credential, account, worker or external disclosure.
This is local data-loss prevention, not a server authorization boundary.

## QA/integration review
New19units/fullweb1490/146 first0; initialwebbuild0. Focusedfirst andsecond each
6PASS then missing action selector abort. Diagnostic second URL was unrelated
File sync preview: mobile coordinate-dependent focus/blur clicks hit another
navigation. Fixture now focuses actual input, types keyboard text and uses Tab
to trigger ordinary blur. No app fix. Third10/0: dirty/forced disabled click/
actual held blur save/newer draft after older confirmed save/real saved DBvalue/
actual503 unknown result/no replay/explicit fixture reload then clean390pxEnter/
release branch/no key-value search read/runtime. Fixture reload intentionally
discards its unconfirmed draft after verifying retention; it is not a recovery
feature or claim of safe reload. Full initial failure logs retained.
Oldapp0PASS then missingblockedguidance timeout/suiteabort, currentrestored10/0.
Finalfullweb1490/146actual/API265/31cached/buildsbothcached0. APIa/b/c/d
preview6442fa37SAML55allfirstRC0. Automations132/0firstactual through12
separatelyprepared unchangedsourcebundles/tempharnessskiponlyesbuildwithartifact
checks/assertionssleepsDBunchanged/fresh55865cleaned. Separate sync95+144239unique/
native116+111+19246total242unique4startuprepeat eachfirstinnerouter0/config16/14/
docs4/reaper4all0. All146isolatedbrowser suites firstRC0/1600assertions/no failures/sourcechanges.
Completedchecks preserved through routinepauses/stagednotuninterrupted. Finaldocs4/0RC0 and diffcheckclean.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
