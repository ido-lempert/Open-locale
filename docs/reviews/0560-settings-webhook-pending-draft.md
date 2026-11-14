# Preserve webhook drafts edited during Create

## Developer review
Snapshot raw URL and both event choices before POST; derive existing trimmed
URL/events from snapshot. Clear URL only if all three still match after success;
otherwise keep whole newer draft and receipt. Direct busy guard blocks duplicate
calls. Existing event-selection validation and reload remain. No backend change.

## Product review
Receipt distinguishes created submitted webhook from uncreated newer draft and
asks URL/event review before explicit second Create. Signing secret reveal remains
bound to submitted ID; receipt names that association. Busy/no-event call retains
receipt; next event-bearing attempt clears it. POST refusal makes no created
claim; refresh failure keeps accurate receipt and reveal. No auto second POST.

## Design review
Receipt role=status beside form. Desktop1278x899/mobile390x844 actual pixels
inspected: newer URL, both labeled event choices, Create and complete wrapped
receipt readable without horizontal clipping. Fixture secret replaced in screenshot
DOM only with explicit hidden-fixture placeholder; no app reveal masking change.

## Security review
Fixed receipt does not echo raw URL or secret. Existing server URL/egress/admin
checks remain authoritative. One-time secret stays in existing createdWebhook
state, no additional log/store. Local demo DB URLs only, no triggering key,
translation or restore writes; zero webhook delivery records. No requests to
configured hosts, worker enablement, production config/account, credential-scope,
external registration, spend or license change. This is not endpoint approval.

## QA review
11newunits:threependingfields,unchanged,editrevert,editduringreload,POSTrefusal,
reloadfailure,busy,noevent,nextreceiptclear. Fullweb2153/184actual/API265/31cached
RC0;buildwebactual/APIcachedRC0. Focusedfirst11/0RC0,isolatedunconditionaloldclear
1PASS/2FAILRC1,restored11/0RC0;not fulloldHEAD. RealPGheldPOST/exactURL+events/
duplicateblock/wholepreserved/originalonlyDB/revealID/noeventnosendkeepsreceipt/
secondexplicitCreate/unchangedclearselectedevents/403norefreshnoclaim/503accurate
receipt+DB/zeroDeliveryRecords. Fixture generated secret not printed/shared;
DOM screenshot placeholder only, actual reveal verified by ID and shape.
Browser001-186allfirstRC0/2141PASS/0FAIL. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.

APIa/b/c/d,syncpreview644,automations132,2fa37,SAML55allfirstRC0. Sync95+144
allfirstRC0separatecalls. Nativeinitialfirst116/0RC0,middle11PASS/0FAILlines
butRC1explicitincompletetimeout at dependent denied-webhook submission. Its
checkpoint cleaned. Diagnosticfreshfirst116/middle111/tail19RC0: webhook listed
whilebusy=true,URLcleared/errorempty;directduplicate0POST;afterbusyfalse dependent
refusal passed. Provenfixturecompletionrace,not app fix. Finalfixture adds only
busy=false completion wait after created row before dependent second submission;
all original assertions retained. Finalfreshnative116+111+19=246RC0separatecalls,
not uninterrupted or first-run. Config16/14/docs4/harness3/reaper4firstRC0.

Final full unit targets/builds bothcachedRC0. Latest186 desktop1278x899 and
mobile390x844 pixels re-inspected: whole URL/event draft, Create and complete
receipt readable without horizontal clipping. Fixture-only secret placeholder
remains in screenshot DOM. Final docs/diff checks precede commit.
