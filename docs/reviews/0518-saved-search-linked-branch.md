# 0518 Editor-to-saved-search explicit branch handoff

## Developer review
Editor link carries branch only. Search combines route project/query streams,
loads fresh metadata under existing options generation and validates exact branch
membership. No linked branch preserves main default; unavailable/empty link
selects no branch, blocks search and offers enabled current branch selector.
Metadata retry retains requested branch. Query-only navigation clears filters,
results and deferred focus, fencing held old replies. Route unsubscribe on exit.

## Product review
Stops a release-branch editor visit silently becoming a main-branch search.
Locale stays base default; import/export locale is not a search preference.
No automatic key read, values/drafts/filter text in URL or translation changes.
An unavailable link requires explicit choice, not a silent fallback. This does
not preserve editor drafts or change existing departure/blur-save behavior.
Search-to-editor return still defaults editor scope; no round-trip claim.

## Design review
Actual desktop390px pixels inspected for valid release result and unavailable
linked-branch warning/explicit chooser. Readable/wrapped/no horizontal overflow;
valid mobile result card still needs scrolling. Fixed warning does not echo
untrusted linked text. Other controls disabled until branch is chosen.

## Security review
Untrusted URL is a selector, never authorization. Current branches are fetched
and validated; backend access unchanged. Only branch name in normal internal
navigation, no translation/draft/private filter values. No external disclosures,
extra key read/write/storage/provider/worker/settings/account change. Existing
scope and generation fences prevent old private results after route changes.

## QA/integration review
New10units/fullweb1471/145/initialwebbuild0. Firstfocused8PASS then search-response
timeout: fixture tried typing into correctly disabled input before selecting a
valid branch. Moved typing after explicit selection/no app fix; second12/0.
Extended/restored/final13/0 adds actual options503/retry preserving release.
Old search component with new editor link2PASS2FAIL plus query-only idle-selector
timeout/suiteabort thirdFAIL; current restored/full log retained. Actual editor
selectrelease/linkclick/queryonlysamecomponent/realPGexcludesmain/noautokeyread/
unknownbranchblocked/explicitchoice/manualsearch/heldoldresponsefence/zero writes/
mobile/runtime. No editor-local-draft preservation acceptance. Finalunits/buildsbothcached0afterinitialwebbuild0/API265/31cached. APIa/b/c/d
preview6442fa37SAML55firstRC0;automations132/0firstactual12unchangedbundles
separatelyprepared/tempharnessskiponlyesbuildwithexistencechecks/assertionssleeps
DBunchanged/fresh55861cleaned. Separate sync95+144239unique/native116+111+19
246total242unique4startuprepeat eachfirstinnerouter0/config16/14/docs4/reaper4
all0. All145 isolatedbrowser suites finalRC0/1590assertions;144firstRC0.
Suite138first5PASS then obsolete a[href$="/find"] selector suiteabort after intended
branch query addition. Fixture uses named editor link; rerun15/0. No app change
in sweep. Full initialfailure log retained. README/PLAN updated; finaldocs4/0RC0 and diffcheck clean.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
