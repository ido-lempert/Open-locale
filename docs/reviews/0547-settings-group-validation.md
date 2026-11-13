# Settings new-group name limits

## Developer review
Existing trimmed outgoing name checked nonempty/max100 with installed validator
surrogate/presentation-pair count before busy/error/API. Reuse existing raw-count
helper. Direct/busy guard; no native truncation or backend/schema change. Existing
valid name trim/locale parsing/create/clear/refresh/failure behavior unchanged.
Initial package-entry insertion script expected a trailing comma on last script;
asserted after writing browser fixture, corrected insertion before test execution.

## Product review
Invalid full name/role/locales retained without failed create or refresh. Correction
without reload. Check only name, not locale grants/role/permission/newerstate.
Existing valid success refresh may replace other Settings drafts, not fixed here.
No change to team-wide group effects or automatic creation.

## Design review
Linked rules/aria-invalid/correction/disabled Add. Desktop1278x899/mobile390x844
actual screenshots inspected readablewrapped/nooverflow. Existing singleline name
scrolls for longtext; no multiline redesign.

## Security review
Local validation not DTO/authz replacement. Literal markup stays input text.
Existing role/locale/permission rules unchanged. No real account/grant/security/
token/worker/spend/registration/scope/license change. LocalAPI/Postgres testdata.

## QA review
20newunits:12actualbackend trimmedcount comparisons,5invalidfullform/noAPI/reload/
state,error;correction/exactUnicode/parsedchoices, busyguard,validfailure. Fullweb
1953/171actualfirstRC0/API265/31cached0;buildwebactual/APIcached0. Focusedfirst10/0,
oldapp0PASS2FAILRC1,restored10/0. RealPG keyboardname101 retained/invalidEnterdirect
noGETPOST/Unicode101retained/whitespaceblocked/Unicode100persistsonce/trimmedbytes/
parsedlocales/busyduplicateblocked/refresh/valid403literalrawdraft+choices/error
withoutrefresh. Nativefirst116/0;middle110PASS1FAILRC1 duplicate-group error absent. Legacy fixture waited bodytext dup, which does not establish !busy or a cleared form before the second attempt. New busyguard can refuse that overlap. Original individual condition not captured. Fixture now waits !busy, cleared name and refreshed persisted dup row before duplicate submission. App unchanged; staged rerun116+111+19=246PASS/zeroFAIL/RC0 separatecalls,not uninterrupted. APIa/b/c/d,sync-preview644/auto132/2fa37/SAML55allfirst0;sync95+144=239allfirst0separatecalls. Config16/14/docs4/harness3/reaper4first0. Browser001-173latestRC0/1981PASS/zeroFAIL,172first.133first11PASS1FAILRC1 immediate compound filter-edit/removal of downloadcontrol+notice assertion. Exact subcondition/timing not captured. Original retained; independent134/135thenunchanged133second12/0, noappfixturefix,rootcause unproven. Browser159-173allfirstRC0. Broad regression complete. Finalunits/buildbothcachedRC0;finaldocs4/0. Coverage22FULL7PARTIAL1MISSING/defaultOFF/
externalacceptance unchanged.
