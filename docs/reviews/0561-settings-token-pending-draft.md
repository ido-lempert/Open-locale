# Preserve token drafts edited during Create

## Developer review
Snapshot raw name and access before POST. Existing raw name and parsed scopes
stay unchanged. Clear name only if both still match; otherwise preserve whole
newer draft with receipt. Direct busy guard prevents duplicate calls. Existing
one-time reveal and reload remain, no backend or default-access change.

## Product review
Scope-only edit must keep its name: receipt separates created submission from
uncreated newer draft, asks name/access review and identifies actual token reveal.
No automatic second Create. Busy retains receipt; next explicit call clears it.
POST refusal makes no created claim; refresh failure retains accurate receipt and
submitted reveal. Unchanged success clears name and keeps selected access.

## Design review
role=status receipt beside form. Desktop1278x899/mobile390x844 actual pixels
inspected: complete name/access/Create/receipt readable with no horizontal
clipping. Generated demo token replaced in screenshot DOM only with explicit
hidden-fixture label; app reveal remains unchanged.

## Security review
Fixed receipt does not echo token bytes. Existing server checks authoritative;
UI retention does not expand any existing credential. Only disposable demo DB
tokens created and revoked in focused fixture. No connected/external/production
credential, account, worker, token-scope grant, registration, spend or license
change. Generated demo bytes never printed/shared; reveal ID/shape checked only.

## QA review
9newunits:pendingname/scope,unchanged,editrevert,editduringreload,POSTrefusal,
reloadfailure,busy,nextreceiptclear. FirstfullunitsRC1 with3newtestfailures:
helper assumed defaultread,actual existingdefaultreadwrite. Corrected helper to
explicitread fixture, no app/default change. Correctedweb2162/185actual/API265/31
cachedRC0;buildwebactual/APIcachedRC0. Focusedfirst10/0,isolatedoldnameonlyclear
1PASS/2FAILRC1,restored10/0RC0;not fulloldHEAD. RealPGheldPOST/exactrawname+scope/
duplicateblock/scopeonlykeepswholepair/originalreadDB/revealID/explicitsecond/
unchangedclear/403norefreshnoclaim/503accuratereceipt+DB/demotokensrevoked.
Broad regression pending. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.

## Broad regression
All187browser suites firstRC0/2151PASS/zeroFAIL, each own call. API batches
a/b/c/d plus separatesync-preview644/automations132/2fa37/SAML55 firstRC0.
Syncfirst95+second144=239; nativefirst116+middle111+tail19=246 allfirstRC0,
each stage owncall, staged not uninterrupted. Config16/14/docs4/glossaryharness3
passed, wrapper thenRC2 solely nonexistent reaper-test filename typo. Correct
reaped-runner-test.py4/4RC0, no app/fixture fix. Earlier focused discriminator
and corrected-unit chronology above preserved. Final units/build bothcachedRC0; docs4/diffcheckRC0.
