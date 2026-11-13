# Settings automation active text-template limits

## Developer review
Task title/notify message use service-level raw UTF16 length<=200 and nonblank
trim, not DTO isLength counting. Active action only; no trimming outgoing payload.
Remove notify native truncation, guard before busy/error/API and overlap. Existing
valid create/name-trim/list-refresh/clear/failure/pretranslate behavior unchanged.
No backend/schema/worker change.

## Product review
Invalid full active template and all rule choices stay local, correction without
reload. Not rule-name/provider/locale/permission/delivery validation. Switching
actions retains templates and only active text can block Add. Existing future
rule-effect warning remains. No automatic repair/save/create.

## Design review
Linked rules/aria-invalid/correction/disabled Add. Desktop1278x899/mobile390x844
pixels inspected readablewrapped/nooverflow; existing long singleline input
scrolls. UTF16 units explicitly described instead of inaccurate character claim.

## Security review
Local checks not service/authz replacement. Literal markup remains input text.
Existing automation delegation/runtime permission/whitelisted effects unchanged.
LocalAPI/Postgres fixture rules only; no real worker/rule enablement, external
receiver, account/token/security/spend/registration/scope/license change.

## QA review
29newunits:20rawUTF16/nonblank comparisons,4invalidallchoices/state/API,2exactraw
corrections/activeonly,pseudo inactivepayloadunchanged,busyguard,validfailure.
Fullweb1982/172actualfirstRC0/API265/31cached0. Initialbuildwebactual/APIcached
both successful but outercallRC1 detached-child cleanup notice; clean reaped build
verification bothcachedRC0. Focusedfirst14/0,oldapp0PASS2FAILRC1,restored14/0. RealPG
keyboardmessage201/Unicode101pairs/whitespacetitle blocked/fullraw/noGETPOST;
actiontoggle retainedinactiveinvalidtext/pretranslateunblocked;raw200UTF16notify
and tasktitlepersist/name trimmed/busyduplicateblocked/listrefresh/clear;valid403
literalrawdraftchoiceserror/norefresh. APIa/b/c/d,sync-preview644/auto132/2fa37/SAML55allfirst0. Sync95+144=239/native116+111+19=246allfirst0 separatecalls/stages,not uninterrupted. Config16/14/docs4/harness3/reaper4first0. Browser174latestRC0/1995PASS/zeroFAIL,173first.167first10PASS1FAILRC1 whitespace-description/title-literal compoundassertion; independent168/169then unchangedsecond10PASS1FAILRC1sameassertion. Originalfailedruns retained. Subsequent diagnostic showed posts2/reads2/expectedpayload/APIpersist correct but UIrows empty at that point; originalassertion thenpassed11/0 after diagnostic awaits. Supports refresh-render timinggap, not capturing originalfailedsubcondition. Fixture now waits clearedinput+expectedliteralrow;diagnosticremoved/appunchanged/final16711/0. Other173first0. Broadcloseoutcomplete;finalunits/buildbothcachedRC0;finaldocs4/0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/externalacceptance unchanged.
