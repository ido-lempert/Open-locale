# Preserve new custom-status drafts edited during Add

## Developer review
Snapshot raw status before PATCH, derive existing trimmed uppercase candidate,
clear only if raw text still matches after success. Otherwise retain full newer
input with saved-submission/unsaved-draft receipt. Existing syntax/busy/reload
checks remain. No backend/schema change. Existing loaded-whole-array update is
unchanged, not a concurrent-server-merge fix.

## Product review
No automatic second PATCH or reload persistence. Valid attempt clears receipt;
invalid/busy calls keep it. Refused PATCH makes no saved claim. Refresh failure
after successful PATCH keeps accurate receipt and existing error. Equivalent
normalized newer raw input stays for review; server duplicate behavior unchanged.
Edits during reload already remain after old draft clear.

## Design review
Receipt role=status next to existing status guidance and correction. Pixels
inspected1278x899/390x844: readable wrapped complete receipt/correction, literal
newer text, invalid Add disabled, no horizontal clipping. No list redesign.

## Security review
No raw draft in receipt or HTML interpolation. Invalid newer text remains local
and cannot pass existing guards. No silent repair, auto retry, membership/grant/
account/worker/credential-scope/external/spend/registration/license changes.
Only local demo status array. Server checks remain authoritative.

## QA review
10newunits:newer valid/invalid/normalizedequivalent raw drafts,unchanged,
editrevert,editduringreload,PATCHfailure,reloadfailure,invalidbusy,nextreceiptclear.
Fullweb2110/180actualfirstRC0/API265/31cachedRC0;buildwebactual/APIcachedRC0.
Harness initial node syntax check caught generated identifier typo before launch;
fixed fixture. First focused run0PASS/1FAILRC1 signup404 from helper erroneously
using PATCH for signup; fixture corrected to POST(default), actual target remains
PATCH. Corrected11/0;oldappdiscriminator1PASS/2FAILRC1;restored11/0.
RealPGheldPATCH/exactoldtrimuppercase+loadedarray/duplicateblock/literalinvalid
newerdraft/oldonlypersisted/invalidnosendreceiptkept/secondexplicitcorrectedAdd/
unchangedclear/403noreloadnoclaim/503accuratereceipt+oldonlyDB.
APIa/b/c/d,sync-preview644,automations132,2fa37,SAML55allfirstRC0.
Sync95+144=239/native116+111+19=246allfirstRC0separatecalls/stages,
not uninterrupted. Config16/14/docs4/harness3/reaper4firstRC0.
Browser001-182latestRC0/2097PASS/0FAIL;181firstRC0. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.

## Project-create fixture follow-up review
Developer: create clears form before awaiting project-list reload. Fixture was
asserting completion on input clear only. Wait for busy=false/loading=false after
both successful clears, retaining all original payload/count/DB/card assertions.
Product: no application behavior change or change in accepted slug/name cases.
Design: literal-name card check still asserts text/no nested image, unchanged.
Security: no weakening of literal-markup or private-error checks.
QA:168first11PASS/1FAILRC1, unchangedretry11/1RC1. Diagnostic captured
posts2/reads2/exactpayload with busy/creating/loading=true and empty names/cards;
after completion literal card present and12/0RC0. Corrected fixture12/0RC0.
Original first/retry/diagnostic logs retained. Establishes490fixture race only,
not retrospective proof of489cause. No app change from broad checks.

Final full unit targets/builds bothcachedRC0; final docs4/4RC0 and diffcheck
clean. Latest182 desktop1278x899/mobile390x844 pixels re-inspected: readable
wrapped receipt/correction, literal raw draft and no horizontal clipping.
