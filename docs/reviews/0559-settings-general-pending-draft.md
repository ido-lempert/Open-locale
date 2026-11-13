# Preserve General drafts edited during Save

## Developer review
Fix exact raw name/description submission before PATCH. Pass it only to that
Save's reload, preserving the entire pair when newer edits differ at project GET.
All other reload callers retain their existing replacement behavior. Loaded
project still refreshes; no backend/schema/concurrent-server-merge change.
Review caught missing receipt for edits during later list reads. Scoped finally
compares current draft to loaded project (or submitted pair when GET fails).
It preserves readable saved/unsaved receipt through all refresh phases.

## Product review
Explicit Save still required for newer draft. No auto second PATCH or persisted
form. Busy/invalid calls keep receipt; next valid Save clears it. Refused PATCH
makes no saved claim. Refresh error retains accurate receipt for unsaved edits.
Unchanged Save still refreshes server form values, including canonical response.
Edit-and-revert matching saved values needs no unsaved receipt. Unrelated Settings
refreshes can still replace General fields: this is a scoped pending-Save fix.

## Design review
role=status receipt beside existing count guidance/correction. Desktop1278x899
and mobile390x844 actual pixels inspected: both full draft fields, Save, guidance
and complete wrapped receipt readable without horizontal clipping. No redesign.

## Security review
Literal form binding, fixed receipt with no raw text interpolation. Existing
count, busy and server permission checks remain authoritative. No auto-submit,
permission/merge claim, worker, credential scope, production project/account,
external registration, spend or license change. Local demo project only.

## QA review
12newunits:pendingname/description,unchangedserverrefresh,editrevert,editduringGET,
PATCHrefusal,GETfailure,busyinvalid,nextreceiptclear,unrelatedreload,latelistedit,
editduringfailedGET. Firstweb2140/183actual;reviewed2142/183actual;API265/31cached
RC0. Initialbuildwebactual/APIcachedRC0. Firstfocused10/0RC0;reviewfix+latelist
leg11/0RC0;exactold492component1PASS/2FAILRC1;restored11/0RC0. RealPGheldPATCH/
exactrawpayload/duplicateblock/wholepairpreserved/originalonlyDB/secondSave/
unchangedrefresh/heldGET/heldlaterlist/403noreloadnoclaim/503accuratereceipt+DB.
Reviewedbuildwebactual/APIcachedRC0. APIa/b/c/d,sync-preview644,automations132,
2fa37,SAML55allfirstRC0. Sync95+144=239/native116+111+19=246allfirstRC0 in
separatecalls/stages,not uninterrupted. Config16/14/docs4/harness3/reaper4
firstRC0. Browser001-185allfirstRC0/2130PASS/0FAIL. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.

Final full unit targets/builds bothcachedRC0. Latest185 desktop1278x899 and
mobile390x844 pixels re-inspected: whole newer pair, Save, full count guidance
and complete receipt readable without horizontal clipping. Final docs/diff checks
precede commit.
