# Preserve embed-origin drafts edited during Add

## Developer review
Snapshot raw origin before PATCH, derive existing trimmed candidate, clear only
if raw text still matches after success. Otherwise keep newer text with saved-
submission/unsaved-draft receipt. Existing canonical-origin/busy/reload checks
remain. No backend/schema change; loaded-whole-array update unchanged, not a
concurrent-server-merge fix.

## Product review
No automatic second PATCH or reload persistence. Valid attempt clears receipt;
invalid/busy calls keep it. Refused PATCH makes no saved claim. Refresh failure
after successful PATCH keeps accurate receipt and existing error. Equivalent
trimmed newer raw input stays for review; server duplicate behavior unchanged.
Edits during reload already remain after old draft clear.

## Design review
Receipt role=status next to existing guidance/correction. Desktop1278x899 and
mobile390x844 pixels inspected: complete readable wrapped receipt/correction,
literal raw draft, invalid Add disabled, no horizontal clipping. No list redesign.

## Security review
Saved receipt is not origin trust/ownership approval. No raw draft in receipt or
HTML interpolation. Invalid newer text stays local behind existing guards.
No silent repair, auto retry, production-origin/grant/account/worker/credential-
scope/external/spend/registration/license change. Only local demo .example
origins; no requests sent to configured origin hosts. Server checks authoritative.

## QA review
10newunits:newer valid/invalid/trimequivalent drafts,unchanged,editrevert,
editduringreload,PATCHfailure,reloadfailure,invalidbusy,nextreceiptclear.
Fullweb2120/181actualfirstRC0/API265/31cachedRC0;buildwebactual/APIcachedRC0.
Focusedfirst11/0,oldappdiscriminator1PASS/2FAILRC1,restored11/0. Before final
focused run, corrected copied diagnostic label Status->Origin only, no assertion
or app change. RealPGheldPATCH/exacttrimold+loadedarray/duplicateblock/literal
invalidnewer/oldonlyDB/invalidnosendkeepsreceipt/secondexplicitcorrection/
unchangedclear/403noreloadnoclaim/503accuratereceiptoldonlyDB.
APIa/b/c/d,sync-preview644,automations132,2fa37,SAML55allfirstRC0.
Sync95+144=239/native116+111+19=246allfirstRC0separatecalls/stages,
not uninterrupted. Config16/14/docs4/harness3/reaper4firstRC0.
Browser001-183allfirstRC0/2108PASS/0FAIL. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.

Final full unit targets/builds bothcachedRC0; final docs4/4RC0 and diffcheck
clean. Latest183 desktop1278x899/mobile390x844 pixels re-inspected: readable
wrapped receipt/correction, literal raw draft and no horizontal clipping.
