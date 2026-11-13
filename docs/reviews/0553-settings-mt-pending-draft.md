# Preserve pseudo-provider drafts edited during Add

## Developer review
Snapshot raw name/type before POST; use that snapshot for outgoing trimmed name
and type. Clear name only if both fields still match after success; otherwise
keep entire newer draft with receipt. Existing refresh/first selection/prior
selection and unchanged-name clear stay as before. No automatic second POST.

## Product review
Receipt distinguishes added submitted provider from newer unadded draft. Next
explicit valid attempt clears receipt; invalid/busy calls keep it. POST refusal
does not claim added. Refresh failure after added POST keeps accurate receipt
and existing error. No reload persistence. Edits during refresh already remain.
Adding pseudo fixture does not run pretranslation or enable external engines.

## Design review
Receipt role=status near form, literal newer name retained. Desktop1278x899 and
mobile390x844 pixels inspected readablewrapped/no document overflow. Existing
pretranslation controls stay visible and separate; no panel redesign.

## Security review
Local draft retention, not new permission/provider approval. Existing name/busy
checks and backend authz remain. Literal markup stays text, no raw draft in
receipt. No real provider/worker/account/security/token-scope enablement, spend,
registration, external delivery or license change. Local pseudo fixtures only.

## QA review
9newunits:2pendingfields,unchanged,edit/revert,editduringrefresh,POSTfailure,
refreshfailure,invalid/busy,receiptclear. Fullweb2080/177actualfirstRC0/API265/31
cachedRC0;buildwebactual/APIcachedRC0. Focusedfirst11/0,oldapp1PASS2FAILRC1,
restored11/0. RealPGheldPOST/duplicateblock/exactoldsnapshot/newliteralname/type/
onlyoldpersisted/firstselection/secondexplicitAdd/unchangedclear/priorselection/
403norefreshnoaddedclaim/503accuratereceipt+DBpersisted/zeroMTPOST/runtimeclean.
APIa/b/c/d,sync-preview644/automations132/2fa37/SAML55allfirstRC0. Sync95+144=239allfirstRC0,separatecalls/stages,not uninterrupted. Native116+111+19=246allfirstRC0,separatecalls/stages. Config16/14/docs4/harness3/reaper4first0. Browser179latestRC0/2065PASS/zeroFAIL;178firstRC0.149first15PASS1FAILRC1 filter-edit download-control/feedback compound assertion, unchanged rerun16/0 after independent150/151. Original log retained; root cause unproven/no fix. Finalunits/buildbothcachedRC0,finaldocs4/0,diffclean.Latestdesktop/mobilepixelsreinspectedreadablewrapped/nooverflow. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.
