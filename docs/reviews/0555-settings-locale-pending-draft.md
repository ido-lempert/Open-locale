# Preserve new-locale drafts edited during Add

## Developer review
Snapshot raw code before POST and derive existing trimmed payload from it. Clear
only when raw code still matches after success, otherwise keep complete newer
input with explicit added-submission/unadded-draft receipt. Existing syntax,
busy, reload and server checks stay intact. No backend/schema changes.

## Product review
No automatic second Add or reload persistence. Next valid attempt clears receipt;
invalid/busy calls keep it. POST failure makes no added claim; refresh failure
after successful POST keeps accurate receipt and existing error. Raw whitespace
change counts as newer even when trimmed candidate matches. This is not duplicate
or language-registry validation. Edits during reload already remain after clear.

## Design review
Receipt role=status adjacent to existing locale guidance and correction.
Desktop1278x899/mobile390x844 pixels inspected: readable wrapped receipt and
correction, literal newer draft, disabled invalid Add, no horizontal clipping.
No locale-list redesign.

## Security review
No raw input in receipt or HTML interpolation. Literal markup stays literal in
input. Invalid newer draft is retained but cannot submit through existing guards.
No silent repair, auto retry, membership/grant/account/worker/credential-scope/
external/spend/registration/license changes. Only local demo project locales.

## QA review
10newunits:valid/invalid/equivalenttrim newer raw drafts,unchanged,edit/revert,
editduringreload,POSTfailure,reloadfailure,invalidbusy,nextreceiptclear.
Full web2100/179 actualfirstRC0/API265/31cachedRC0;buildwebactual/APIcachedRC0.
Focusedfirst11PASS/0FAIL,oldapp1PASS/2FAILRC1,restored11/0. RealPGheldPOST/
exactoldtrimcode/duplicateblock/invalidliteralnewerdraft/oldonlypersisted/
invalidkeepsreceiptnoPOST/secondexplicitcorrectedAdd/unchangedclear/
403noreloadnoclaim/503accuratereceipt+DBpersistedoldonly.
APIa/b/c/d,sync-preview644,automations132,2fa37,SAML55allfirstRC0.
Sync95+144=239/native116+111+19=246allfirstRC0separatecalls/stages,
not uninterrupted. Config16/14/docs4/harness3/reaper4firstRC0.
Browser001-181latestRC0/2086PASS/0FAIL;178firstRC0.
106first outer120s timeout, log0PASS/1FAIL web4200readiness;107first outer120s timeout, logPGstartup/no completed checks. Read-only diagnostic also timedout. After pause environment restart notice/no live runners,108first9/0 then unchanged10610/0,10711/0. No app/test fix;rootcauseunproven;original106/107logs retained. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.

168first11PASS/1FAILRC1 compound trailingdashslug literalname persistence/render
assertion.169/170firstRC0,then unchanged168retry12/0RC0. No app/test fix;
rootcauseunproven;original168logretained.

Final full unit targets/builds bothcachedRC0; final docs4/4RC0 and diffcheck
clean. Latest181 desktop1278x899/mobile390x844pixels re-inspected: readable
wrapped receipt/correction, literal raw draft and no horizontal clipping.
