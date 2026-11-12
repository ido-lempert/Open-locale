# Optional plural-key creation

## Developer review
Existing CreateKeyDTO IsBoolean/isPlural and service defaultfalse/returnedflag;
extend typed client only. Defaultfalse omits preserving request shape; true sends
boolean true. Capture complete name/description/rawlimit/plural tuple and clear
only unchanged tuple after success. Newer anyfield keeps every field, unknown
pause/targeted insertion/destroy fences unchanged. Reject nonboolean local state.
No schema, endpoint, refresh or existing-key conversion.

## Product review
User can create a plural key without API tools; returned flag opens existing
locale-specific form editor. Optional unchecked default plain. Scope explicitly
newkeytype/notexistingconversion/notautomatictranslation. Does not create filled
plural translations, promise all CLDR support or guarantee saved form state.

## Design review
Checkbox and scopefullrowdesktop/singlecolumnmobile, native label click/keyboard.
First20/0 but pixels caught desktop row3 on mobile reordering checkbox before
maxLength contrary DOM order. Scopedmedia rowauto appfix/extended21/0 and input
visualorderassertion. Fixeddesktop390px inspected readable checkedtoggle/scope/
correctorder/nooverflow. Form grows vertically, no compactlayoutclaim.

## Security review
Existing create permission; boolean only, no HTML/privacy/network expansion.
Nonboolean methodstate refuses write; default omitted, not coerced from text.
Unconfirmed result keeps selectedtype and pauses replay without privateerror.
No external account/worker/scope/spend/license/credential changes; real local PG.

## QA review
11newunitsfirstPASS: defaultomit/trueexactcapturedmetadata/returnedpluralnoreread/
clearunchanged, newer eachname/description/limit/plural keepswhole tuple, pending
singlecall, failurepause, nonbooleanfalsevaluesrejected, destroyheldfence.
RealPGfocusedfirst20/0/fixed21/0: truepersisted/returned enone-other+Hebrewone-two-
other inputs, limit3advisory/noGET, literaldescription and localdraftretained,
newerfalse+4retained/pendingduplicateguard, defaultflagomit/serverfalse/unchanged
clear, invalidlimitrefusal and descriptionboundretained, unknowntrue5kept/replay
paused/noPRIVATE. Oldapp2PASS1FAIL missingtoggleselectorabortRC1,currentrestored.
Currentrestored rerun/full checks remain. Coverage22FULL7PARTIAL1MISSING/defaultOFF
and externalacceptancegaps unchanged.

## Broad checkpoint
Restoredfocusedfinal21/0. Fullweb1603/156actual (+11/+1),API265/31cached;
finalwebbuildactual/APIcachedRC0. APIa/b/c/d/syncpreview644/automations132/2fa37/
saml55allfirst0/positivePASS/zeroFAIL. Sync95+144239/native116+111+19246total
242unique4startuprepeatallfirst0(stagednotuninterrupted). Config16/14/docs4/
harness3/reaper4all0. Stable158browserlist /tmp/browser466-list;
001-020allfirstRC0/positivePASS/zeroFAIL, no executable changes during checks.
Remaining021-158/finaldocs/owner+livetodo/exactrepoauthority/commitpush/postchecks.
Browser checkpoint021-090 allfirstRC0/positivePASS/zeroFAIL. Source unchanged;
next091, preserve001-090 and earlier full checks.

Final158isolatedbrowser suites allfirstRC0/1758PASS/zeroFAIL, no executable
changes during sweep. Runtime restored saved files after completed091,092
continued fresh, no activeprocess carried/repeated. Final158regenerated desktop
390pxpixels inspected correctorder/readabletoggle/retainedtuple/nooverflow.
Finaldocs4/diffcheck0. Originalauthenticatedownerrequest/re-focus/live todo
recovered. Exactnamedpublicrepo/defaultmain/pushright/currentbase verified.
No worker/account/credentialscope/spend/license change.
